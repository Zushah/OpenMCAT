import { DEFAULT_DASHBOARD_PAGES, DEFAULT_QUESTION_BANK_COUNTS, state, patchGeneration, resetGenerationState } from "./app.js";
import { DEFAULT_CONFIG, QUESTION_COUNT_LIMITS } from "./data/defaults.js";
import { QUESTION_BANK_PROVIDER_ID } from "./data/bank/catalog.js";
import { buildQuestionBankSession, clearQuestionBankCache, loadQuestionBankOverviews } from "./data/bank/loader.js";
import { SCIENCE_SKILLS, SECTIONS, TOPICS, getSkillsForSection, getTopicsBySection } from "./data/taxonomy.js";
import { isValidMistakeTypeId, normalizeMistakeTypeIds } from "./data/mistakes.js";
import { compilePracticePrompt } from "./prompts/compiler.js";
import { extractJsonObject } from "./schema/repair.js";
import { validatePracticeSession } from "./schema/validators.js";
import { setHashForRoute } from "./router.js";
import { buildExportPayload, combineBackupPayloads, createExportPayload, downloadExport, getExportFileName, importPayload, parseImportText, previewBackupCombination } from "./storage/exportimport.js";
import { clearAllData, getAllData, initializeStorage, saveAttempt, saveSession, updateAttempt, updateSession } from "./storage/db.js";
import { saveSettings as persistSettings } from "./storage/settings.js";
import { getBackupStatus, isBackupReminderDue, markBackupCompleted, scheduleBackupReminder } from "./storage/backup.js";
import { checkPersistentStorage, requestPersistentStorage } from "./storage/persistence.js";
import { canShareBackup, getShareableBackupDetails, shareBackup } from "./storage/share.js";
import { computeMetrics, normalizeDashboardFilters } from "./analytics/metrics.js";
import { buildRecommendation } from "./analytics/recommendations.js";
import { getSelectionHighlightRanges, toggleHighlightRange } from "./components/highlights.js";
import { showToast } from "./components/toast.js";

const cb = Chalkboard;

const id = (prefix) => `${prefix}_${Date.now()}_${cb.numb.random(0, 1).toString(36).slice(2, 8)}`;

const clamp = (value, min, max) => cb.numb.constrain(value, [cb.stat.min([min, max]), cb.stat.max([min, max])]);

const getDefaultTopicsForSection = (sectionId) => getTopicsBySection(sectionId).slice(0, 2).map((topic) => topic.id);

const getDefaultSkillsForSection = (sectionId) => getSkillsForSection(sectionId).map((skill) => skill.id);

const isQuestionBankSession = (activeSession) => activeSession?.providerMeta?.source === QUESTION_BANK_PROVIDER_ID || activeSession?.generatedSession?.bank?.source === QUESTION_BANK_PROVIDER_ID;

const hasReachedSessionReviewPoint = (activeSession) => { const questionCount = activeSession?.generatedSession?.questions?.length ?? 0; return activeSession?.hasReachedFinalQuestion === true || (questionCount > 0 && activeSession.currentQuestionIndex >= questionCount - 1); };

const markFinalQuestionReached = (activeSession, questionIndex = activeSession?.currentQuestionIndex ?? 0) => { const questionCount = activeSession?.generatedSession?.questions?.length ?? 0; if (questionCount > 0 && questionIndex >= questionCount - 1) activeSession.hasReachedFinalQuestion = true; return hasReachedSessionReviewPoint(activeSession); };

const normalizeConfig = (config) => {
    const source = { ...structuredClone(DEFAULT_CONFIG), ...(config ?? {}) };
    const normalized = structuredClone(DEFAULT_CONFIG);
    normalized.questionCount = clamp(Number(source.questionCount) || DEFAULT_CONFIG.questionCount, QUESTION_COUNT_LIMITS.min, QUESTION_COUNT_LIMITS.max);
    normalized.timingMode = source.timingMode === "timed" ? "timed" : "untimed";
    normalized.secondsPerQuestion = normalized.timingMode === "timed" ? clamp(Number(source.secondsPerQuestion) || 95, 30, 240) : null;
    normalized.reviewMode = source.reviewMode === "later" ? "later" : "immediate";
    normalized.difficulty = ["easy", "medium", "hard"].includes(source.difficulty) ? source.difficulty : DEFAULT_CONFIG.difficulty;
    normalized.questionFormat = ["discrete", "passage", "mixed"].includes(source.questionFormat) ? source.questionFormat : DEFAULT_CONFIG.questionFormat;
    normalized.sectionId = SECTIONS.some((section) => section.id === source.sectionId) ? source.sectionId : DEFAULT_CONFIG.sectionId;
    const sectionTopics = getTopicsBySection(normalized.sectionId).map((topic) => topic.id);
    normalized.topicIds = (source.topicIds ?? []).filter((topicId) => sectionTopics.includes(topicId));
    const sectionSkills = getSkillsForSection(normalized.sectionId).map((skill) => skill.id);
    normalized.skillIds = (source.skillIds ?? []).filter((skillId) => sectionSkills.includes(skillId));
    if (normalized.skillIds.length === 0) normalized.skillIds = sectionSkills;
    return normalized;
};

const getValidationContext = (config) => {
    const validTopicIds = TOPICS.filter((topic) => topic.sectionId === config.sectionId).map((topic) => topic.id);
    const validSkillIds = SCIENCE_SKILLS.map((skill) => skill.id);
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
    normalized.session.disclaimer = normalized.session.disclaimer || "AI-generated practice. Verify explanations when uncertain.";
    return normalized;
};

const getQuestionElapsedMs = (questionState, now = new Date()) => {
    const storedElapsedMs = Number(questionState?.elapsedMs ?? 0);
    const baseElapsedMs = Number.isFinite(storedElapsedMs) ? cb.stat.max([0, storedElapsedMs]) : 0;
    if (!questionState || questionState.submitted || !questionState.startedAt) return baseElapsedMs;
    const startedAtMs = new Date(questionState.startedAt).getTime();
    const nowMs = now.getTime();
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return baseElapsedMs;
    return baseElapsedMs + cb.stat.max([0, nowMs - startedAtMs]);
};

const pauseQuestionTimer = (activeSession, questionId, now = new Date()) => {
    const questionState = activeSession?.questionStateById?.[questionId];
    if (!questionState || questionState.submitted) return;
    questionState.elapsedMs = getQuestionElapsedMs(questionState, now);
    questionState.startedAt = null;
};

const ensureQuestionStart = (activeSession, questionId, now = new Date()) => {
    const questionState = activeSession.questionStateById[questionId];
    if (!questionState || questionState.submitted) return questionState?.startedAt ?? null;
    const startedAt = now.toISOString();
    if (!questionState.firstStartedAt) questionState.firstStartedAt = startedAt;
    if (!questionState.startedAt) questionState.startedAt = startedAt;
    return questionState.startedAt;
};

const buildMaps = () => {
    const sectionsById = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
    const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
    const skillsById = Object.fromEntries(SCIENCE_SKILLS.map((skill) => [skill.id, skill]));
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
        const backupStatus = await getBackupStatus({ ...data, settings: state.settings });
        state.analytics = { metrics, recommendation, backupStatus, ...data };
        return state.analytics;
    };

    const refreshStoragePersistence = async () => {
        try {
            state.storagePersistence = { ...await checkPersistentStorage(), requesting: false };
        } catch (error) {
            console.warn("OpenMCAT: unexpected persistent browser storage check failure.", error);
            state.storagePersistence = { status: "error", persisted: false, canRequest: false, requesting: false };
        }
        return state.storagePersistence;
    };

    const refreshQuestionBank = async (options = {}) => {
        const forceReload = options.clearCache === true;
        if (forceReload) clearQuestionBankCache();
        state.questionBank.loading = true;
        state.questionBank.error = null;
        render();
        try { const data = await getAllData(); state.questionBank.entries = await loadQuestionBankOverviews(data.attempts, { forceReload }); }
        catch (error) { state.questionBank.error = error.message || "Could not load question bank."; }
        finally { state.questionBank.loading = false; render(); }
    };

    const navigate = (route) => {
        if (route !== "dashboard") { state.dashboard.aiAnalysisOpen = false; state.dashboard.backupReminderOpen = false; }
        if (route !== "settings") state.settingsDataConfirmation = null;
        state.route = route;
        if (route === "dashboard") maybeOpenDashboardBackupReminder();
        setHashForRoute(route);
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        render();
        if (route === "bank") refreshQuestionBank();
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

    const openDashboardAiAnalysis = () => {
        if (!state.analytics?.metrics?.totals?.totalQuestionsAnswered) {
            state.dashboard.aiAnalysisOpen = false;
            showToast("Complete a practice session before copying an AI analysis prompt.");
            return;
        }
        state.dashboard.aiAnalysisOpen = true;
        render();
    };

    const closeDashboardAiAnalysis = () => {
        state.dashboard.aiAnalysisOpen = false;
        render();
    };

    const maybeOpenDashboardBackupReminder = () => {
        const backupStatus = state.analytics?.backupStatus;
        if (!backupStatus?.hasData || !backupStatus.hasChanges || !isBackupReminderDue()) return false;
        scheduleBackupReminder(state.settings.backupReminderSnoozedTiming);
        state.dashboard.backupReminderOpen = true;
        return true;
    };

    const closeDashboardBackupReminder = () => {
        state.dashboard.backupReminderOpen = false;
        render();
    };

    const backupDataFromReminder = async () => {
        const payload = await buildExportPayload();
        downloadExport(payload);
        await markBackupCompleted(payload, state.settings.backupReminderCompletedTiming);
        state.dashboard.backupReminderOpen = false;
        await refreshAnalytics();
        navigate("settings");
        showToast("Exported OpenMCAT data.", "success");
    };

    const applySection = (sectionId) => {
        const next = normalizeConfig({
            ...state.currentConfig,
            sectionId,
            topicIds: getDefaultTopicsForSection(sectionId).slice(0, 1),
            skillIds: getDefaultSkillsForSection(sectionId).slice(0, 2),
            questionFormat: "mixed",
            secondsPerQuestion: 95
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

    const updateQuestionBankCount = (sectionId, questionCount) => {
        state.questionBank.selectedCounts = {
            ...DEFAULT_QUESTION_BANK_COUNTS,
            ...state.questionBank.selectedCounts,
            [sectionId]: Math.floor(clamp(Number(questionCount) || 10, 1, 50))
        };
        render();
    };

    const startQuestionBankSession = async ({ sectionId, questionCount } = {}) => {
        try { const data = await getAllData(); const bundle = await buildQuestionBankSession({ sectionId, questionCount, attempts: data.attempts }); await startPracticeSession(bundle.prepared, bundle.runtimeConfig, bundle.providerMeta); if (bundle.warnings?.length) console.warn("OpenMCAT question bank warnings", bundle.warnings); }
        catch (error) { showToast(error.message || "Question bank session could not start.", "error"); if (state.route === "bank") await refreshQuestionBank(); }
    };

    const saveAppSettings = async (nextSettings, options = {}) => {
        const persistenceRequest = options.enablePersistentStorage && !state.storagePersistence?.persisted ? requestPersistentStorage() : null;
        state.settings = persistSettings(nextSettings);
        applyTheme(state.settings.theme);
        let persistenceResult = null;
        try {
            persistenceResult = persistenceRequest ? await persistenceRequest : null;
        } catch (error) {
            console.warn("OpenMCAT: unexpected persistent browser storage request failure.", error);
            persistenceResult = { status: "error", persisted: false, canRequest: false, outcome: "error" };
        }
        if (persistenceResult) state.storagePersistence = { ...persistenceResult, requesting: false };
        await refreshAnalytics();
        render();
        if (persistenceResult?.outcome === "granted") showToast("Settings saved. Persistent storage enabled in this browser.", "success");
        else if (persistenceResult?.outcome === "denied") showToast("Settings saved. Persistent storage was not granted in this browser.");
        else if (persistenceResult?.outcome === "unsupported") showToast("Settings saved. Persistent storage is not available in this browser.");
        else if (persistenceResult?.outcome === "error") showToast("Settings saved. Persistent storage encountered an error in this browser.", "error");
        else showToast("Settings saved.", "success");
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
        const normalizedProviderMeta = structuredClone(providerMeta ?? {});
        const sessionRecord = {
            id: sessionId,
            createdAt: nowIso,
            completedAt: null,
            config: structuredClone(runtimeConfig),
            generatedSession: prepared,
            providerMeta: normalizedProviderMeta,
            highlightRangesByTargetKey: {},
            hasReachedFinalQuestion: prepared.questions.length <= 1
        };
        await saveSession(sessionRecord);
        const questionStateById = Object.fromEntries(prepared.questions.map((question) =>
            [
                question.id,
                {
                    selectedChoiceId: null,
                    submittedChoiceId: null,
                    submitted: false,
                    isCorrect: null,
                    confidence: null,
                    submittedConfidence: null,
                    elapsedMs: 0,
                    startedAt: null,
                    firstStartedAt: null,
                    answeredAt: null,
                    flagged: false,
                    mistakeTypeIds: [],
                    attemptId: null
                }
            ]
        ));
        const firstQuestionId = prepared.questions[0]?.id ?? null;
        if (firstQuestionId) {
            questionStateById[firstQuestionId].startedAt = nowIso;
            questionStateById[firstQuestionId].firstStartedAt = nowIso;
        }
        state.activeSession = {
            id: sessionId,
            createdAt: nowIso,
            completedAt: null,
            config: structuredClone(runtimeConfig),
            generatedSession: prepared,
            providerMeta: structuredClone(sessionRecord.providerMeta),
            currentQuestionIndex: 0,
            questionStateById,
            highlightRangesByTargetKey: {},
            hasReachedFinalQuestion: prepared.questions.length <= 1,
            navigationOpen: false,
            navigationFilter: "all",
            finalReviewOpen: false,
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
            providerMeta: null,
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
        await validateAndStartSession(extraction.parsed, {}, { manualMode: true, deferStart: false });
    }

    const getActiveQuestion = () => {
        const active = state.activeSession;
        if (!active) return null;
        return active.generatedSession.questions[active.currentQuestionIndex] ?? null;
    };

    const selectChoice = async (choiceId) => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        if (qState.submitted && active.config.reviewMode === "immediate") return;
        qState.selectedChoiceId = qState.selectedChoiceId === choiceId ? null : choiceId;
        render();
    };

    const setConfidence = async (value) => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        if (qState.submitted && active.config.reviewMode === "immediate") return;
        qState.confidence = qState.confidence === value ? null : value;
        render();
    };

    const flagCurrentQuestion = async () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const qState = active.questionStateById[question.id];
        qState.flagged = !qState.flagged;
        render();
        showToast(qState.flagged ? "Question flagged." : "Flag removed.");
    };

    const toggleHighlightFromSelection = () => {
        const active = state.activeSession;
        if (!active) return;
        const selectionRanges = getSelectionHighlightRanges();
        if (!selectionRanges.length) { showToast("Select passage or question text to highlight.", "error"); return; }
        active.highlightRangesByTargetKey = active.highlightRangesByTargetKey ?? {};
        selectionRanges.forEach((selectionRange) => {
            const currentRanges = active.highlightRangesByTargetKey[selectionRange.targetKey] ?? [];
            const nextRanges = toggleHighlightRange(currentRanges, selectionRange);
            if (nextRanges.length) active.highlightRangesByTargetKey[selectionRange.targetKey] = nextRanges;
            else delete active.highlightRangesByTargetKey[selectionRange.targetKey];
        });
        window.getSelection()?.removeAllRanges();
        render();
    };

    const saveCurrentAnswer = async () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return false;
        const qState = active.questionStateById[question.id];
        if (qState.submitted && active.config.reviewMode === "immediate") return false;
        if (!qState.selectedChoiceId) { showToast("Select an answer before submitting.", "error"); return false; }
        const submittedChoiceId = qState.submittedChoiceId ?? null;
        const submittedConfidence = qState.submittedConfidence ?? null;
        const currentConfidence = qState.confidence ?? null;
        if (qState.submitted && qState.selectedChoiceId === submittedChoiceId && currentConfidence === submittedConfidence) return false;
        const answeredAt = new Date();
        const startedAt = qState.firstStartedAt ?? qState.startedAt ?? active.createdAt;
        const elapsedMs = qState.submitted ? qState.elapsedMs ?? 0 : getQuestionElapsedMs(qState, answeredAt);
        const isCorrect = qState.selectedChoiceId === question.correctChoiceId;
        qState.mistakeTypeIds = isCorrect ? [] : normalizeMistakeTypeIds(qState.mistakeTypeIds);
        qState.submittedChoiceId = qState.selectedChoiceId;
        qState.submittedConfidence = currentConfidence;
        qState.submitted = true;
        qState.isCorrect = isCorrect;
        qState.answeredAt = answeredAt.toISOString();
        qState.elapsedMs = elapsedMs;
        qState.startedAt = null;
        const attemptPatch = {
            sessionId: active.id,
            questionId: question.id,
            sectionId: active.generatedSession.session.sectionId,
            topicIds: question.testedTopicIds ?? [],
            skillIds: question.testedSkillIds ?? [],
            difficulty: question.estimatedDifficulty ?? active.generatedSession.session.difficulty,
            selectedChoiceId: qState.submittedChoiceId,
            correctChoiceId: question.correctChoiceId,
            isCorrect,
            confidence: qState.submittedConfidence,
            startedAt,
            answeredAt: qState.answeredAt,
            elapsedMs,
            mistakeTypeIds: structuredClone(qState.mistakeTypeIds),
            reviewMode: active.config.reviewMode,
            timingMode: active.config.timingMode
        };
        if (isQuestionBankSession(active)) {
            attemptPatch.bankId = active.providerMeta?.bankId ?? question.bankId ?? null;
            attemptPatch.bankSectionId = active.providerMeta?.bankSectionId ?? question.bankSectionId ?? active.generatedSession.session.sectionId;
            attemptPatch.bankQuestionId = question.bankQuestionId ?? question.id;
            attemptPatch.bankVersion = active.providerMeta?.bankVersion ?? question.bankVersion ?? null;
        }
        if (qState.attemptId) await updateAttempt(qState.attemptId, attemptPatch);
        else {
            const attempt = { id: id("attempt"), ...attemptPatch };
            qState.attemptId = attempt.id;
            await saveAttempt(attempt);
        }
        return true;
    };

    const submitAnswer = async () => {
        const saved = await saveCurrentAnswer();
        if (saved) render();
    };

    const previousQuestion = async () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const previousIndex = active.currentQuestionIndex - 1;
        if (previousIndex < 0) return;
        pauseQuestionTimer(active, question.id);
        active.currentQuestionIndex = previousIndex;
        const previousQuestionId = active.generatedSession.questions[previousIndex].id;
        ensureQuestionStart(active, previousQuestionId);
        render();
    };

    const nextQuestion = async () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active || !question) return;
        const nextIndex = active.currentQuestionIndex + 1;
        if (nextIndex >= active.generatedSession.questions.length) {
            openFinalReviewPanel();
            return;
        }
        pauseQuestionTimer(active, question.id);
        active.currentQuestionIndex = nextIndex;
        markFinalQuestionReached(active, nextIndex);
        const nextQuestionId = active.generatedSession.questions[nextIndex].id;
        ensureQuestionStart(active, nextQuestionId);
        render();
    };

    const openNavigationPanel = (filterId = null) => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active) return;
        if (hasReachedSessionReviewPoint(active)) {
            openFinalReviewPanel();
            return;
        }
        if (question) pauseQuestionTimer(active, question.id);
        active.navigationOpen = true;
        active.finalReviewOpen = false;
        active.navigationFilter = ["all", "incomplete", "flagged"].includes(filterId) ? filterId : active.navigationFilter ?? "all";
        render();
    };

    const closePracticePanel = () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active) return;
        active.navigationOpen = false;
        active.finalReviewOpen = false;
        if (question) ensureQuestionStart(active, question.id);
        render();
    };

    const setNavigationFilter = (filterId) => {
        const active = state.activeSession;
        if (!active) return;
        active.navigationFilter = ["all", "incomplete", "flagged"].includes(filterId) ? filterId : "all";
        render();
    };

    const openFinalReviewPanel = () => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active) return;
        markFinalQuestionReached(active);
        if (question) pauseQuestionTimer(active, question.id);
        active.navigationOpen = false;
        active.finalReviewOpen = true;
        render();
    };

    const goToQuestion = (index) => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active) return;
        const nextIndex = Math.floor(clamp(Number(index) || 0, 0, active.generatedSession.questions.length - 1));
        if (question) pauseQuestionTimer(active, question.id);
        active.currentQuestionIndex = nextIndex;
        markFinalQuestionReached(active, nextIndex);
        const questionId = active.generatedSession.questions[nextIndex]?.id;
        if (questionId) ensureQuestionStart(active, questionId);
        active.navigationOpen = false;
        active.finalReviewOpen = false;
        render();
    };

    const stopSessionEarly = async () => {
        openFinalReviewPanel();
    };

    const finishSession = async (message = "Session complete. Review ready.") => {
        const active = state.activeSession;
        const question = getActiveQuestion();
        if (!active) return;
        if (question) pauseQuestionTimer(active, question.id);
        const completedAt = new Date().toISOString();
        active.completedAt = completedAt;
        active.navigationOpen = false;
        active.finalReviewOpen = false;
        const records = active.generatedSession.questions.map((item) => active.questionStateById[item.id]);
        const submitted = records.filter((item) => item?.submitted).length;
        const flagged = records.filter((item) => item?.flagged).length;
        await updateSession(active.id, {
            completedAt,
            questionStateById: structuredClone(active.questionStateById),
            highlightRangesByTargetKey: structuredClone(active.highlightRangesByTargetKey ?? {}),
            hasReachedFinalQuestion: active.hasReachedFinalQuestion === true,
            summary: {
                submitted,
                incomplete: records.length - submitted,
                flagged,
                total: records.length
            }
        });
        await refreshAnalytics();
        state.route = "review";
        setHashForRoute("review");
        render();
        showToast(message, "success");
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

    const toggleMistakeTypeForQuestion = async (questionId, mistakeTypeId) => {
        const active = state.activeSession;
        if (!active || !isValidMistakeTypeId(mistakeTypeId)) return;
        const question = active.generatedSession.questions.find((item) => item.id === questionId);
        const qState = active.questionStateById?.[questionId];
        if (!question || !qState?.submitted || qState.isCorrect) return;
        const selected = new Set(normalizeMistakeTypeIds(qState.mistakeTypeIds));
        if (selected.has(mistakeTypeId)) selected.delete(mistakeTypeId);
        else selected.add(mistakeTypeId);
        qState.mistakeTypeIds = normalizeMistakeTypeIds(Array.from(selected));
        await updateSession(active.id, { questionStateById: structuredClone(active.questionStateById) });
        if (qState.attemptId) await updateAttempt(qState.attemptId, { mistakeTypeIds: structuredClone(qState.mistakeTypeIds) });
        await refreshAnalytics();
        render();
    };

    const exportData = async (preparedPayload = null) => {
        const payload = preparedPayload ?? await buildExportPayload();
        downloadExport(payload);
        await markBackupCompleted(payload, state.settings.backupReminderCompletedTiming);
        await refreshAnalytics();
        render();
        showToast("Exported OpenMCAT data.", "success");
    };

    const shareDataBackup = (options = {}, preparedPayload = null) => {
        const payload = preparedPayload ?? createExportPayload({
            settings: state.settings,
            sessions: state.analytics?.sessions ?? [],
            attempts: state.analytics?.attempts ?? []
        });
        const sharing = shareBackup(payload);
        return sharing.then(async (result) => {
            if (result.outcome === "canceled") return result;
            if (result.outcome !== "shared") { showToast("Your web browser could not share the OpenMCAT data backup."); return result; }
            await markBackupCompleted(payload, state.settings.backupReminderCompletedTiming);
            if (options.closeReminder) state.dashboard.backupReminderOpen = false;
            await refreshAnalytics();
            render();
            showToast("Shared OpenMCAT data backup.", "success");
            return result;
        }).catch((error) => {
            console.warn("OpenMCAT: unexpected data backup sharing failure.", error);
            showToast("Your web browser could not share the OpenMCAT data backup.");
            return { outcome: "failed" };
        });
    };

    const formatInspectionDate = (value) => {
        if (!value) return "Not recorded";
        return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    };

    const formatInspectionSize = (bytes) => {
        const value = Number(bytes);
        if (!Number.isFinite(value) || value < 0) return "Unknown";
        if (value < 1024) return `${value} ${value === 1 ? "byte" : "bytes"}`;
        if (value < 1024 * 1024) return `${cb.numb.roundTo(value / 1024, 0.1)} KB`;
        return `${cb.numb.roundTo((value / 1024) / 1024, 0.01)} MB`;
    };

    const currentDataInspection = () => {
        const sessions = state.analytics?.sessions ?? [];
        const attempts = state.analytics?.attempts ?? [];
        return { sessions, attempts };
    };

    const dataCounts = (label, sessions, attempts, change = false) => ({ label, sessions, attempts, change });

    const openSettingsDataConfirmation = (action) => {
        const current = currentDataInspection();
        if (action !== "backup" && action !== "share" && action !== "delete") return;
        const payload = action === "delete" ? null : createExportPayload({
            settings: state.settings,
            sessions: current.sessions,
            attempts: current.attempts
        });
        const descriptions = {
            backup: "Save a backup of the current OpenMCAT data on this device. The current OpenMCAT data will not be changed.",
            share: "Send a backup of the current OpenMCAT data to the destination that you select. The current OpenMCAT data will not be changed.",
            delete: "Delete all of the current OpenMCAT data on this web browser. The current OpenMCAT data will only be able to be restored if you have previously saved a backup of it."
        };
        const backupStatus = action === "delete" ? null : state.analytics?.backupStatus;
        const contentSize = payload ? new Blob([JSON.stringify(payload, null, 2)]).size : 0;
        const shareDetails = action === "share" ? getShareableBackupDetails(payload) : null;
        const previousSessions = backupStatus?.completedSessionCount;
        const previousAttempts = backupStatus?.completedAttemptCount;
        const hasPreviousCounts = Number.isFinite(previousSessions) && Number.isFinite(previousAttempts);
        state.settingsDataConfirmation = {
            action,
            description: descriptions[action],
            metadata: action === "delete" ? [] : [
                { label: action === "share" ? "Shared backup name" : "New backup name", value: shareDetails?.fileName ?? getExportFileName(payload) },
                { label: action === "share" ? "Shared backup size" : "New backup size", value: formatInspectionSize(shareDetails?.fileSize ?? contentSize) },
                { label: action === "share" ? "Shared backup date" : "New backup date", value: formatInspectionDate(payload.exportedAt) }
            ],
            stats: action === "delete" ? [
                dataCounts("Current data", current.sessions.length, current.attempts.length),
                dataCounts("Difference", -current.sessions.length, -current.attempts.length, true)
            ] : [
                dataCounts(action === "share" ? "Shared backup data" : "New backup data", current.sessions.length, current.attempts.length),
                !hasPreviousCounts ? { label: "Previous backup data", empty: "None" } : dataCounts("Previous backup data", previousSessions, previousAttempts),
                dataCounts("Difference", current.sessions.length - (hasPreviousCounts ? previousSessions : 0), current.attempts.length - (hasPreviousCounts ? previousAttempts : 0), true)
            ],
            payload
        };
        render();
    };

    const prepareDataRestore = (source) => {
        const payload = parseImportText(source.text, source.name || "Backup");
        const current = currentDataInspection();
        state.settingsDataConfirmation = {
            action: "restore",
            description: payload.settings && typeof payload.settings === "object"
                ? "Restore the current OpenMCAT data with the selected backup data. The current OpenMCAT data will be replaced. The current settings will be merged with the backup settings."
                : "Restore the current OpenMCAT data with the selected backup data. The current OpenMCAT data will be replaced.",
            metadata: [
                { label: "Selected backup name", value: source.name || "Backup" },
                { label: "Selected backup size", value: formatInspectionSize(source.size) },
                { label: "Selected backup date", value: formatInspectionDate(payload.exportedAt) }
            ],
            stats: [
                dataCounts("Current data", current.sessions.length, current.attempts.length),
                dataCounts("Selected backup data", payload.sessions.length, payload.attempts.length),
                dataCounts("Difference", payload.sessions.length - current.sessions.length, payload.attempts.length - current.attempts.length, true)
            ],
            source: { ...source, payload }
        };
        render();
    };

    const parseBackupSources = (sources) => sources.map((source, index) => ({
        name: source.name || `Backup ${index + 1}`,
        payload: parseImportText(source.text, source.name || `Backup ${index + 1}`)
    }));

    const prepareDataMerge = async (sources) => {
        const backups = parseBackupSources(sources);
        const preview = await previewBackupCombination(backups);
        const current = currentDataInspection();
        state.settingsDataConfirmation = {
            action: "merge",
            description: "Merge the current OpenMCAT data with up to several selected backups data. The current OpenMCAT data will not be replaced.",
            metadata: [
                { label: "Selected backups names", value: sources.map((source) => source.name).join(", ") },
                { label: "Selected backups size", value: formatInspectionSize(sources.reduce((total, source) => total + Number(source.size || 0), 0)) },
                { label: "Selected backups dates", value: backups.map((backup) => `${formatInspectionDate(backup.payload.exportedAt)}`).join("; ") }
            ],
            stats: [
                dataCounts("Current data", current.sessions.length, current.attempts.length),
                dataCounts("Selected backups data", preview.selectedSessions, preview.selectedAttempts),
                dataCounts("Difference", preview.addedSessions, preview.addedAttempts, true)
            ],
            sources
        };
        render();
    };

    const closeSettingsDataConfirmation = () => {
        state.settingsDataConfirmation = null;
        render();
    };

    const confirmSettingsDataAction = () => {
        const confirmation = state.settingsDataConfirmation;
        if (!confirmation) return null;
        state.settingsDataConfirmation = null;
        render();
        if (confirmation.action === "backup") return exportData(confirmation.payload);
        if (confirmation.action === "share") return shareDataBackup({}, confirmation.payload);
        if (confirmation.action === "restore") return confirm("Restore this OpenMCAT data backup? It will replace the current OpenMCAT data in this browser.") ? importDataFromText(confirmation.source.text) : null;
        if (confirmation.action === "merge") return combineDataFromTexts(confirmation.sources);
        if (confirmation.action === "delete") return confirm("Are you sure you want to delete all of the current OpenMCAT data? It will be lost forever! (A long time!)") ? deleteAllLocalData() : null;
        return null;
    };

    const importDataFromText = async (text) => {
        const parsed = parseImportText(text);
        await importPayload(parsed);
        await refreshAnalytics();
        render();
        showToast("Data imported.", "success");
    };

    const combineDataFromTexts = async (sources) => {
        const backups = parseBackupSources(sources);
        const preview = await previewBackupCombination(backups);
        const newRecords = preview.addedSessions + preview.addedAttempts;
        const duplicateRecords = preview.duplicateSessions + preview.duplicateAttempts;
        const confirmationLines = [
            `Combine ${preview.backupCount} OpenMCAT ${preview.backupCount === 1 ? "backup" : "backups"}?`,
            "",
            `${preview.addedSessions} new ${preview.addedSessions === 1 ? "session" : "sessions"} and ${preview.addedAttempts} new ${preview.addedAttempts === 1 ? "attempt" : "attempts"} will be added.`,
        ];
        if (duplicateRecords) confirmationLines.push(`${duplicateRecords} duplicate ${duplicateRecords === 1 ? "record" : "records"} will be skipped.`);
        confirmationLines.push("", "The current OpenMCAT data will not be replaced.");
        const confirmed = confirm(confirmationLines.join("\n"));
        if (!confirmed) return null;
        if (!newRecords) { const message = duplicateRecords ? `No new data found. ${duplicateRecords} duplicate ${duplicateRecords === 1 ? "record was" : "records were"} skipped.` : "No data was found in the selected backups."; showToast(message); return null; }
        const result = await combineBackupPayloads(backups);
        await refreshAnalytics();
        render();
        const addedRecords = result.addedSessions + result.addedAttempts;
        showToast(`Combined ${result.backupCount} ${result.backupCount === 1 ? "backup" : "backups"} and added ${addedRecords} new ${addedRecords === 1 ? "record" : "records"}.`, "success");
        return result;
    };

    const deleteAllLocalData = async () => {
        await clearAllData();
        state.activeSession = null;
        state.dashboard.aiAnalysisOpen = false;
        state.dashboard.backupReminderOpen = false;
        state.questionBank.entries = {};
        state.questionBank.selectedCounts = { ...DEFAULT_QUESTION_BANK_COUNTS };
        state.questionBank.error = null;
        await refreshAnalytics();
        render();
        showToast("All current data deleted.");
    };

    const applyDashboardDrill = (config = {}) => {
        if (!config || typeof config !== "object") { showToast("No drill configuration is available yet."); return; }
        const next = normalizeConfig({
            ...state.currentConfig,
            ...config
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
        state.storageError = null;
        try {
            state.settings = persistSettings(state.settings);
            state.currentConfig = normalizeConfig(state.currentConfig);
            applyTheme(state.settings.theme);
            await initializeStorage();
            await refreshAnalytics();
            state.backupSharingSupported = canShareBackup();
            await refreshStoragePersistence();
            if (state.route === "dashboard") maybeOpenDashboardBackupReminder();
            if (state.route === "bank") await refreshQuestionBank();
            else render();
        } catch (error) {
            console.error("OpenMCAT storage initialization failed.", error);
            state.storageError = error?.name === "QuotaExceededError" ? "There is not enough browser storage available to finish preparing OpenMCAT data." : error?.message || "OpenMCAT could not open its private browser database.";
            render();
        }
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
        updateQuestionBankCount,
        startQuestionBankSession,
        refreshQuestionBank,
        saveAppSettings,
        generateSession,
        submitManualJson,
        resetManualGeneration,
        closeGenerationPipeline,
        selectChoice,
        setConfidence,
        flagCurrentQuestion,
        toggleHighlightFromSelection,
        submitAnswer,
        previousQuestion,
        nextQuestion,
        openNavigationPanel,
        closePracticePanel,
        setNavigationFilter,
        goToQuestion,
        openFinalReviewPanel,
        stopSessionEarly,
        finishSession,
        setReviewFilter,
        setReviewQuestionIndex,
        toggleMistakeTypeForQuestion,
        exportData,
        shareDataBackup,
        openSettingsDataConfirmation,
        prepareDataRestore,
        prepareDataMerge,
        closeSettingsDataConfirmation,
        confirmSettingsDataAction,
        importDataFromText,
        combineDataFromTexts,
        deleteAllLocalData,
        refreshAnalytics,
        updateDashboardFilters,
        resetDashboardFilters,
        setDashboardPage,
        openDashboardAiAnalysis,
        closeDashboardAiAnalysis,
        maybeOpenDashboardBackupReminder,
        closeDashboardBackupReminder,
        backupDataFromReminder,
        applyDashboardDrill,
        applyRecommendation,
        resetToNewSession
    };
}
