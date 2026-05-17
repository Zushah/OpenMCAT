import { DEFAULT_DASHBOARD_PAGES, state, patchGeneration, resetGenerationState } from "./app.js";
import { BATCH_SIZE_LIMITS, DEFAULT_CONFIG, QUESTION_COUNT_LIMITS } from "./data/defaults.js";
import { CARS_SKILLS, SCIENCE_SKILLS, SECTIONS, TOPICS, getSkillsForSection, getTopicsBySection } from "./data/taxonomy.js";
import { compilePracticePrompt } from "./prompts/compiler.js";
import { extractJsonObject } from "./schema/repair.js";
import { validatePracticeSession } from "./schema/validators.js";
import { setHashForRoute } from "./router.js";
import { buildExportPayload, downloadExport, importPayload, parseImportText } from "./storage/exportimport.js";
import { clearAllData, deleteFlagForQuestion, getAllData, saveAttempt, saveFlag, saveSession, updateAttempt, updateSession } from "./storage/db.js";
import { saveSettings as persistSettings } from "./storage/settings.js";
import { computeMetrics, normalizeDashboardFilters } from "./analytics/metrics.js";
import { buildRecommendation } from "./analytics/recommendations.js";
import { showToast } from "./components/toast.js";

const cb = Chalkboard;

const id = (prefix) => `${prefix}_${Date.now()}_${cb.numb.random(0, 1).toString(36).slice(2, 8)}`;

const clamp = (value, min, max) => cb.numb.constrain(value, [cb.stat.min([min, max]), cb.stat.max([min, max])]);

const getDefaultTopicsForSection = (sectionId) => getTopicsBySection(sectionId).slice(0, 2).map((topic) => topic.id);

const getDefaultSkillsForSection = (sectionId) => getSkillsForSection(sectionId).map((skill) => skill.id);

const normalizeConfig = (config) => {
    const normalized = { ...structuredClone(DEFAULT_CONFIG), ...config };
    normalized.questionCount = clamp(Number(normalized.questionCount) || DEFAULT_CONFIG.questionCount, QUESTION_COUNT_LIMITS.min, QUESTION_COUNT_LIMITS.max);
    normalized.batchSize = clamp(Number(normalized.batchSize) || DEFAULT_CONFIG.batchSize, BATCH_SIZE_LIMITS.min, BATCH_SIZE_LIMITS.max);
    normalized.secondsPerQuestion = normalized.timingMode === "timed" ? clamp(Number(normalized.secondsPerQuestion) || 95, 30, 240) : null;
    const sectionExists = SECTIONS.some((section) => section.id === normalized.sectionId);
    if (!sectionExists) normalized.sectionId = DEFAULT_CONFIG.sectionId;
    const sectionTopics = getTopicsBySection(normalized.sectionId).map((topic) => topic.id);
    normalized.topicIds = (normalized.topicIds ?? []).filter((topicId) => sectionTopics.includes(topicId));
    const sectionSkills = getSkillsForSection(normalized.sectionId).map((skill) => skill.id);
    normalized.skillIds = (normalized.skillIds ?? []).filter((skillId) => sectionSkills.includes(skillId));
    if (normalized.skillIds.length === 0) normalized.skillIds = sectionSkills;
    if (normalized.sectionId === "cars" && normalized.questionFormat === "discrete") normalized.questionFormat = "cars_beta";
    if (normalized.sectionId !== "cars" && normalized.questionFormat === "cars_beta") normalized.questionFormat = "mixed";
    return normalized;
};

const getValidationContext = (config) => {
    const validTopicIds = TOPICS.filter((topic) => topic.sectionId === config.sectionId).map((topic) => topic.id);
    const validSkillIds = config.sectionId === "cars" ? CARS_SKILLS.map((skill) => skill.id) : SCIENCE_SKILLS.map((skill) => skill.id);
    return { requestedCount: config.questionCount, validTopicIds, validSkillIds };
};

const prepareSessionForRuntime = (session, config) => {
    const normalized = structuredClone(session);
    normalized.session = normalized.session ?? {};
    normalized.session.sectionId = normalized.session.sectionId || config.sectionId;
    normalized.session.topicIds = normalized.session.topicIds?.length ? normalized.session.topicIds : config.topicIds;
    normalized.session.skillIds = normalized.session.skillIds?.length ? normalized.session.skillIds : config.skillIds;
    normalized.session.difficulty = normalized.session.difficulty || config.difficulty;
    normalized.session.questionFormat = normalized.session.questionFormat || config.questionFormat;
    normalized.session.disclaimer = normalized.session.disclaimer || "AI-generated practice; verify explanations when uncertain.";
    return normalized;
};

const ensureQuestionStart = (activeSession, questionId) => {
    const questionState = activeSession.questionStateById[questionId];
    if (!questionState.startedAt) questionState.startedAt = new Date().toISOString();
    return questionState.startedAt;
};

const buildMaps = () => {
    const sectionsById = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
    const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
    const skills = [...SCIENCE_SKILLS, ...CARS_SKILLS];
    const skillsById = Object.fromEntries(skills.map((skill) => [skill.id, skill]));
    return { sectionsById, topicsById, skillsById };
};

export const createActions = ({ render, applyTheme }) => {
    const refreshAnalytics = async () => {
        const data = await getAllData();
        state.dashboard.filters = normalizeDashboardFilters(state.dashboard.filters);
        state.dashboard.pages = { ...DEFAULT_DASHBOARD_PAGES, ...(state.dashboard.pages ?? {}) };
        const metrics = computeMetrics({
            attempts: data.attempts,
            sessions: data.sessions,
            flags: data.flags,
            filters: state.dashboard.filters
        });
        const maps = buildMaps();
        const recommendation = buildRecommendation({
            attempts: data.attempts,
            topicsById: maps.topicsById,
            skillsById: maps.skillsById,
            sectionsById: maps.sectionsById,
            metrics
        });
        state.analytics = { metrics, recommendation, ...data };
        return state.analytics;
    };

    const navigate = (route) => {
        state.route = route;
        setHashForRoute(route);
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        render();
    };

    const updateConfig = (patch) => {
        const next = normalizeConfig({ ...state.currentConfig, ...patch });
        state.currentConfig = next;
        render();
    };

    const updateDashboardFilters = async (patch) => {
        state.dashboard.filters = normalizeDashboardFilters({
            ...state.dashboard.filters,
            ...patch
        });
        state.dashboard.pages = { ...DEFAULT_DASHBOARD_PAGES };
        await refreshAnalytics();
        render();
    };

    const resetDashboardFilters = async () => {
        state.dashboard.filters = normalizeDashboardFilters();
        state.dashboard.pages = { ...DEFAULT_DASHBOARD_PAGES };
        await refreshAnalytics();
        render();
    };

    const setDashboardPage = (key, page, pageCount = 1) => {
        const maxPage = cb.stat.max([0, Number(pageCount) - 1]);
        const nextPage = Math.floor(clamp(Number(page) || 0, 0, maxPage));
        state.dashboard.pages = {
            ...DEFAULT_DASHBOARD_PAGES,
            ...state.dashboard.pages,
            [key]: nextPage
        };
        render();
    };

    const applySection = (sectionId) => {
        const next = normalizeConfig({
            ...state.currentConfig,
            sectionId,
            topicIds: getDefaultTopicsForSection(sectionId).slice(0, 1),
            skillIds: getDefaultSkillsForSection(sectionId).slice(0, 2),
            questionFormat: sectionId === "cars" ? "cars_beta" : "mixed",
            secondsPerQuestion: sectionId === "cars" ? 110 : 95
        });
        state.currentConfig = next;
        render();
    };

    const toggleMultiValue = (field, value) => {
        const set = new Set(state.currentConfig[field] ?? []);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        updateConfig({ [field]: Array.from(set) });
    };

    const saveAppSettings = async (nextSettings) => {
        state.settings = persistSettings(nextSettings);
        applyTheme(state.settings.theme, state.settings.reducedMotion);
        render();
        showToast("Settings saved.", "success");
    };

    const resetManualGeneration = () => {
        resetGenerationState();
        render();
    };

    const closeGenerationPipeline = () => {
        patchGeneration({
            pipelineOpen: false,
            error: null,
            manualInput: ""
        });
        render();
    };

    const startPracticeSession = async (prepared, runtimeConfig, providerMeta = {}) => {
        const sessionId = id("session");
        const nowIso = new Date().toISOString();
        const sessionRecord = {
            id: sessionId,
            createdAt: nowIso,
            completedAt: null,
            config: structuredClone(runtimeConfig),
            generatedSession: prepared,
            providerMeta: {
                providerId: providerMeta.providerId ?? runtimeConfig.providerId,
                model: runtimeConfig.model
            }
        };
        await saveSession(sessionRecord);
        const questionStateById = Object.fromEntries(prepared.questions.map((question) =>
            [
                question.id,
                {
                    selectedChoiceId: null,
                    submitted: false,
                    isCorrect: null,
                    confidence: null,
                    elapsedMs: null,
                    startedAt: null,
                    answeredAt: null,
                    flagged: false,
                    flagReason: null,
                    attemptId: null
                }
            ]
        ));
        const firstQuestionId = prepared.questions[0]?.id ?? null;
        if (firstQuestionId) questionStateById[firstQuestionId].startedAt = nowIso;
        state.activeSession = {
            id: sessionId,
            createdAt: nowIso,
            completedAt: null,
            config: structuredClone(runtimeConfig),
            generatedSession: prepared,
            currentQuestionIndex: 0,
            questionStateById,
            reviewFilter: "all",
            viewQuestionIndex: 0
        };
        state.route = "practice";
        setHashForRoute("practice");
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        render();
        showToast("Practice session started.", "success");
    };

    const validateAndStartSession = async (parsedSession, providerMeta = {}, options = {}) => {
        const runtimeConfig = normalizeConfig(options.configOverride ?? state.currentConfig);
        patchGeneration({ status: "validating", error: null, warnings: [] });
        render();
        const validation = validatePracticeSession(parsedSession, getValidationContext(runtimeConfig));
        if (!validation.valid) {
            patchGeneration({
                status: options.manualMode ? "manual" : "error",
                error: validation.errors.join(" "),
                warnings: validation.warnings,
                parsedSession: null,
                pipelineOpen: options.manualMode ? true : state.generation.pipelineOpen,
                manualInput: options.manualMode ? "" : state.generation.manualInput
            });
            render();
            return false;
        }
        const prepared = prepareSessionForRuntime(validation.normalized, runtimeConfig);
        patchGeneration({
            status: "ready",
            parsedSession: prepared,
            error: null,
            warnings: validation.warnings,
            configSnapshot: structuredClone(runtimeConfig),
            providerMeta: structuredClone(providerMeta),
            pipelineOpen: options.manualMode ? false : state.generation.pipelineOpen,
            manualInput: options.manualMode ? "" : state.generation.manualInput
        });
        if (options.deferStart) {
            render();
            showToast("Session generated and validated. Click Start session when ready.", "success");
            return true;
        }
        await startPracticeSession(prepared, runtimeConfig, providerMeta);
        return true;
    }

    const generateSession = async () => {
        const config = normalizeConfig(state.currentConfig);
        state.currentConfig = config;
        patchGeneration({
            status: "compiling",
            error: null,
            warnings: [],
            rawText: "",
            parsedSession: null,
            showRawResponse: false,
            configSnapshot: null,
            providerMeta: null,
            pipelineOpen: false,
            manualInput: ""
        });
        render();
        const effectiveConfig = structuredClone(config);
        if (!effectiveConfig.topicIds.length) {
            effectiveConfig.topicIds = getTopicsBySection(config.sectionId).map((topic) => topic.id);
            showToast("No topics selected. Generating with all topics in this section.", "info");
        }
        if (!effectiveConfig.skillIds.length) effectiveConfig.skillIds = getDefaultSkillsForSection(config.sectionId);
        const fullPrompt = compilePracticePrompt(effectiveConfig);
        patchGeneration({
            status: "manual",
            compiledPrompt: fullPrompt,
            error: null,
            warnings: [],
            configSnapshot: structuredClone(effectiveConfig),
            providerMeta: { providerId: "manual_json" },
            pipelineOpen: true,
            manualInput: ""
        });
        render();
    }

    const submitManualJson = async (rawText) => {
        if (!rawText || !rawText.trim()) {
            patchGeneration({
                status: "manual",
                error: "Invalid output. Paste a valid JSON session object.",
                manualInput: "",
                pipelineOpen: true
            });
            render();
            return;
        }
        const extraction = extractJsonObject(rawText);
        if (extraction.error || !extraction.parsed) {
            patchGeneration({
                status: "manual",
                rawText: extraction.cleaned || rawText,
                error: extraction.error || "Invalid output. Paste a valid JSON session object.",
                manualInput: "",
                pipelineOpen: true,
                showRawResponse: false
            });
            render();
            return;
        }
        patchGeneration({
            rawText: extraction.cleaned || rawText,
            error: null,
            status: "validating",
            showRawResponse: false
        });
        render();
        await validateAndStartSession(extraction.parsed, { providerId: "manual_json"}, { manualMode: true, deferStart: false });
    }

    const getActiveQuestion = () => {
        const active = state.activeSession;
        if (!active) return null;
        return active.generatedSession.questions[active.currentQuestionIndex] ?? null;
    };

    const selectChoice = (choiceId) => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        if (qState.submitted) return;
        qState.selectedChoiceId = choiceId;
        render();
    };

    const setConfidence = async (value) => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        qState.confidence = qState.confidence === value ? null : value;
        if (qState.attemptId) {
            await updateAttempt(qState.attemptId, { confidence: qState.confidence });
            await refreshAnalytics();
        }
        render();
    };

    const flagCurrentQuestion = async () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        if (qState.flagged) {
            qState.flagged = false;
            qState.flagReason = null;
            await deleteFlagForQuestion(active.id, question.id);
            if (qState.attemptId) await updateAttempt(qState.attemptId, { flagged: false, flagReason: null });
            await refreshAnalytics();
            render();
            showToast("Flag removed.");
            return;
        }
        const reasonInput = prompt("Flag reason: ambiguous | factual_error | wrong_answer | bad_explanation | not_mcat_aligned | formatting_issue | other", "ambiguous");
        if (!reasonInput) return;
        qState.flagged = true;
        qState.flagReason = reasonInput;
        const flagRecord = {
            id: id("flag"),
            sessionId: active.id,
            questionId: question.id,
            createdAt: new Date().toISOString(),
            reason: reasonInput,
            note: ""
        };
        await deleteFlagForQuestion(active.id, question.id);
        await saveFlag(flagRecord);
        if (qState.attemptId) await updateAttempt(qState.attemptId, { flagged: true, flagReason: reasonInput });
        await refreshAnalytics();
        render();
        showToast("Question flagged for review.");
    }

    const submitAnswer = async () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        if (qState.submitted) return;
        if (!qState.selectedChoiceId) { showToast("Select an answer before submitting.", "error"); return; }
        const startedAt = ensureQuestionStart(active, question.id);
        const startedMs = new Date(startedAt).getTime();
        const answeredAt = new Date();
        const elapsedMs = cb.stat.max([0, answeredAt.getTime() - startedMs]);
        const isCorrect = qState.selectedChoiceId === question.correctChoiceId;
        qState.submitted = true;
        qState.isCorrect = isCorrect;
        qState.answeredAt = answeredAt.toISOString();
        qState.elapsedMs = elapsedMs;
        const attempt = {
            id: id("attempt"),
            sessionId: active.id,
            questionId: question.id,
            sectionId: active.generatedSession.session.sectionId,
            topicIds: question.testedTopicIds ?? [],
            skillIds: question.testedSkillIds ?? [],
            difficulty: question.estimatedDifficulty ?? active.generatedSession.session.difficulty,
            selectedChoiceId: qState.selectedChoiceId,
            correctChoiceId: question.correctChoiceId,
            isCorrect,
            confidence: qState.confidence ?? null,
            startedAt,
            answeredAt: qState.answeredAt,
            elapsedMs,
            reviewMode: active.config.reviewMode,
            timingMode: active.config.timingMode,
            flagged: qState.flagged,
            flagReason: qState.flagReason
        };
        qState.attemptId = attempt.id;
        await saveAttempt(attempt);
        if (active.config.reviewMode === "later") { await nextQuestion(); return; }
        render();
    }

    const nextQuestion = async () => {
        const active = state.activeSession;
        if (!active) return;
        const nextIndex = active.currentQuestionIndex + 1;
        if (nextIndex >= active.generatedSession.questions.length) { await finishSession(); return; };
        active.currentQuestionIndex = nextIndex;
        const nextQuestionId = active.generatedSession.questions[nextIndex].id;
        ensureQuestionStart(active, nextQuestionId);
        render();
    }

    const finishSession = async () => {
        const active = state.activeSession;
        if (!active) return;
        const completedAt = new Date().toISOString();
        active.completedAt = completedAt;
        await updateSession(active.id, { completedAt });
        await refreshAnalytics();
        state.route = "review";
        setHashForRoute("review");
        render();
        showToast("Session complete. Review ready.", "success");
    };

    const setReviewFilter = (filterId) => {
        if (!state.activeSession) return;
        state.activeSession.reviewFilter = filterId;
        render();
    };

    const setReviewQuestionIndex = (index) => {
        if (!state.activeSession) return;
        const nextIndex = clamp(index, 0, state.activeSession.generatedSession.questions.length - 1);
        state.activeSession.viewQuestionIndex = nextIndex;
        render();
        const target = document.querySelector(`[data-review-index="${state.activeSession.viewQuestionIndex}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const exportData = async () => {
        const payload = await buildExportPayload();
        downloadExport(payload);
        showToast("Exported OpenMCAT data.", "success");
    };

    const importDataFromText = async (text) => {
        const parsed = parseImportText(text);
        await importPayload(parsed);
        await refreshAnalytics();
        render();
        showToast("Data imported.", "success");
    };

    const deleteAllLocalData = async () => {
        await clearAllData();
        state.activeSession = null;
        await refreshAnalytics();
        render();
        showToast("All local study data deleted.");
    };

    const applyDashboardDrill = (config = {}) => {
        if (!config || typeof config !== "object") { showToast("No drill configuration is available yet."); return; }
        const next = normalizeConfig({
            ...state.currentConfig,
            ...config,
            providerId: state.currentConfig.providerId,
            model: state.currentConfig.model,
            batchSize: state.currentConfig.batchSize,
            explanationDepth: state.currentConfig.explanationDepth,
            promptStrictness: state.currentConfig.promptStrictness
        });
        state.currentConfig = next;
        resetGenerationState();
        navigate("generator");
        showToast("Generator prefilled from dashboard analytics.", "success");
    };

    const applyRecommendation = () => {
        const recommendation = state.analytics?.recommendation;
        if (!recommendation?.config) { showToast("No recommendation ready yet."); return; }
        applyDashboardDrill(recommendation.config);
    }

    const initApp = async () => {
        const initialModel = state.settings.provider.selectedModel || state.currentConfig.model || DEFAULT_CONFIG.model;
        const nextModel = initialModel === "mock-mcat-v1" ? DEFAULT_CONFIG.model : initialModel;
        state.settings = persistSettings({
            ...state.settings,
            provider: {
                ...state.settings.provider,
                selectedProviderId: "manual_json",
                selectedModel: nextModel
            }
        });
        state.currentConfig = normalizeConfig({
            ...state.currentConfig,
            providerId: "manual_json",
            model: nextModel
        });
        applyTheme(state.settings.theme, state.settings.reducedMotion);
        await refreshAnalytics();
        render();
    };

    const resetToNewSession = () => {
        state.activeSession = null;
        resetGenerationState();
        navigate("generator");
    };

    return {
        initApp,
        navigate,
        updateConfig,
        applySection,
        toggleMultiValue,
        saveAppSettings,
        generateSession,
        submitManualJson,
        resetManualGeneration,
        closeGenerationPipeline,
        selectChoice,
        setConfidence,
        flagCurrentQuestion,
        submitAnswer,
        nextQuestion,
        finishSession,
        setReviewFilter,
        setReviewQuestionIndex,
        exportData,
        importDataFromText,
        deleteAllLocalData,
        refreshAnalytics,
        updateDashboardFilters,
        resetDashboardFilters,
        setDashboardPage,
        applyDashboardDrill,
        applyRecommendation,
        resetToNewSession
    };
}
