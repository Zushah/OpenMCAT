import { SCIENCE_SKILLS, TOPICS } from "../taxonomy.js";
import { PRACTICE_SCHEMA_VERSION } from "../../schema/practice.js";
import { validatePracticeSession } from "../../schema/validators.js";
import { DEFAULT_QUESTION_BANK_COUNT, QUESTION_BANK_MODEL, QUESTION_BANK_PROVIDER_ID, QUESTION_BANK_SKILL_IDS, QUESTION_BANKS, getQuestionBankCatalogEntry } from "./catalog.js";

const cache = new Map();
const validSkillIds = SCIENCE_SKILLS.map((skill) => skill.id);
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));

const safeDateMs = (value) => {
    const ms = new Date(value ?? "").getTime();
    return Number.isFinite(ms) ? ms : 0;
};

const clampQuestionCount = (value, fallback = DEFAULT_QUESTION_BANK_COUNT) => {
    const number = Math.floor(Number(value) || fallback);
    return Math.max(1, Math.min(number, 50));
};

const getValidTopicIdsForSection = (sectionId) => TOPICS.filter((topic) => topic.sectionId === sectionId).map((topic) => topic.id);

const getBankQuestionId = (attempt) => attempt?.bankQuestionId ?? attempt?.questionId ?? null;

const getLatestAttemptByQuestionId = (attempts = [], bankId) => {
    const latest = new Map();
    attempts.forEach((attempt) => {
        if (attempt?.bankId !== bankId) return;
        const questionId = getBankQuestionId(attempt);
        if (!questionId) return;
        const previous = latest.get(questionId);
        if (!previous || safeDateMs(attempt.answeredAt) >= safeDateMs(previous.answeredAt)) latest.set(questionId, attempt);
    });
    return latest;
};

const getQuestionTypeCounts = (questions = []) => questions.reduce((counts, question) => {
    if (question.passageId) counts.passageBased += 1;
    else counts.discrete += 1;
    return counts;
}, { discrete: 0, passageBased: 0 });

const validateQuestionBank = (candidate, catalog) => {
    const validation = validatePracticeSession(candidate, {
        validTopicIds: getValidTopicIdsForSection(catalog.sectionId),
        validSkillIds
    });
    const errors = validation.errors.slice();
    const warnings = validation.warnings.slice();
    const normalized = validation.normalized;
    if (!normalized) return { valid: false, errors, warnings, normalized: null, empty: false };
    const bankMeta = normalized.bank ?? {};
    if (bankMeta.id && bankMeta.id !== catalog.id) warnings.push(`bank.id is "${bankMeta.id}", expected "${catalog.id}".`);
    if (bankMeta.sectionId && bankMeta.sectionId !== catalog.sectionId) errors.push(`bank.sectionId must be "${catalog.sectionId}".`);
    if (normalized.session?.sectionId !== catalog.sectionId) errors.push(`session.sectionId must be "${catalog.sectionId}".`);
    const questions = normalized.questions ?? [];
    const empty = questions.length === 0;
    const topicIds = new Set();
    const skillIds = new Set();
    questions.forEach((question, index) => {
        (question.testedTopicIds ?? []).forEach((topicId) => {
            topicIds.add(topicId);
            const topicSectionId = topicsById[topicId]?.sectionId;
            if (topicSectionId && topicSectionId !== catalog.sectionId) errors.push(`questions[${index}] uses ${topicId}, which belongs to ${topicSectionId}, not ${catalog.sectionId}.`);
        });
        (question.testedSkillIds ?? []).forEach((skillId) => skillIds.add(skillId));
    });
    QUESTION_BANK_SKILL_IDS.forEach((skillId) => { if (!empty && !skillIds.has(skillId)) warnings.push(`Question bank has no questions tagged with ${skillId}.`); });
    catalog.topicIds.forEach((topicId) => { if (!empty && !topicIds.has(topicId)) warnings.push(`Question bank has no questions tagged with ${topicId}.`); });
    const typeCounts = getQuestionTypeCounts(questions);
    if (!empty && typeCounts.discrete === 0) warnings.push("Question bank has no discrete questions.");
    if (!empty && typeCounts.passageBased === 0) warnings.push("Question bank has no passage-based questions.");
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        normalized,
        empty
    };
};

const fetchBankJson = async (catalog) => {
    if (cache.has(catalog.id)) return structuredClone(cache.get(catalog.id));
    const response = await fetch(catalog.url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${catalog.title} (${response.status}).`);
    const parsed = await response.json();
    cache.set(catalog.id, parsed);
    return structuredClone(parsed);
};

export const clearQuestionBankCache = () => { cache.clear(); };

export const getQuestionBankProgress = ({ bank, catalog, attempts = [] }) => {
    const questions = bank?.questions ?? [];
    const questionIds = new Set(questions.map((question) => question.id));
    const latestAttempts = getLatestAttemptByQuestionId(attempts, catalog.id);
    const answeredQuestionIds = Array.from(latestAttempts.keys()).filter((questionId) => questionIds.has(questionId));
    const answeredAttempts = answeredQuestionIds.map((questionId) => latestAttempts.get(questionId)).filter(Boolean);
    const correctCount = answeredAttempts.filter((attempt) => Boolean(attempt.isCorrect)).length;
    const lastPracticedAt = answeredAttempts.reduce((latest, attempt) => {
        const ms = safeDateMs(attempt.answeredAt);
        return ms > safeDateMs(latest) ? attempt.answeredAt : latest;
    }, null);
    return {
        bankId: catalog.id,
        sectionId: catalog.sectionId,
        targetQuestionCount: catalog.targetQuestionCount,
        loadedQuestionCount: questions.length,
        answeredCount: answeredQuestionIds.length,
        remainingCount: Math.max(0, questions.length - answeredQuestionIds.length),
        correctCount,
        accuracy: answeredQuestionIds.length ? correctCount / answeredQuestionIds.length : null,
        lastPracticedAt
    };
};

export const loadQuestionBank = async (sectionId, attempts = []) => {
    const catalog = getQuestionBankCatalogEntry(sectionId);
    if (!catalog) throw new Error("Unknown question bank section.");
    const rawBank = await fetchBankJson(catalog);
    const validation = validateQuestionBank(rawBank, catalog);
    const bank = validation.normalized;
    const progress = bank ? getQuestionBankProgress({ bank, catalog, attempts }) : null;
    if (!validation.valid) {
        return {
            status: "error",
            catalog,
            bank,
            progress,
            errors: validation.errors,
            warnings: validation.warnings,
            error: validation.errors.join(" ")
        };
    }
    return {
        status: validation.empty ? "empty" : "ready",
        catalog,
        bank,
        progress,
        errors: [],
        warnings: validation.warnings,
        error: null
    };
};

export const loadQuestionBankOverviews = async (attempts = []) => {
    const entries = await Promise.all(QUESTION_BANKS.map((catalog) => loadQuestionBank(catalog.sectionId, attempts).catch((error) => ({
        status: "error",
        catalog,
        bank: null,
        progress: null,
        errors: [error.message || "Could not load question bank."],
        warnings: [],
        error: error.message || "Could not load question bank."
    }))));
    return Object.fromEntries(entries.map((entry) => [entry.catalog.sectionId, entry]));
};

const groupQuestionBankQuestions = (questions = []) => {
    const groups = [];
    let index = 0;
    while (index < questions.length) {
        const question = questions[index];
        if (!question.passageId) {
            groups.push({ passageId: null, questions: [question] });
            index += 1;
            continue;
        }
        const passageId = question.passageId;
        const group = [];
        while (index < questions.length && questions[index].passageId === passageId) {
            group.push(questions[index]);
            index += 1;
        }
        groups.push({ passageId, questions: group });
    }
    return groups;
};

const selectNextQuestions = ({ bank, catalog, attempts, questionCount }) => {
    const latestAttempts = getLatestAttemptByQuestionId(attempts, catalog.id);
    const answeredQuestionIds = new Set(latestAttempts.keys());
    const targetCount = clampQuestionCount(questionCount, catalog.defaultQuestionCount);
    const selected = [];
    groupQuestionBankQuestions(bank.questions).some((group) => {
        const remaining = group.questions.filter((question) => !answeredQuestionIds.has(question.id));
        if (!remaining.length) return false;
        if (selected.length >= targetCount) return true;
        selected.push(...remaining);
        return selected.length >= targetCount;
    });
    return selected;
};

const collectUniqueQuestionValues = (questions, key, fallback = []) => {
    const values = questions.flatMap((question) => Array.isArray(question[key]) ? question[key] : []);
    return Array.from(new Set(values.length ? values : fallback));
};

const prepareQuestionBankSession = ({ entry, attempts = [], questionCount }) => {
    if (entry.status === "empty") throw new Error(`${entry.catalog.title} does not contain questions yet.`);
    if (entry.status !== "ready") throw new Error(entry.error || `${entry.catalog.title} is not ready.`);
    const selectedQuestions = selectNextQuestions({
        bank: entry.bank,
        catalog: entry.catalog,
        attempts,
        questionCount
    });
    if (!selectedQuestions.length) throw new Error(`All questions in ${entry.catalog.title} have already been answered.`);
    const selectedPassageIds = new Set(selectedQuestions.map((question) => question.passageId).filter(Boolean));
    const selectedPassages = (entry.bank.passages ?? []).filter((passage) => selectedPassageIds.has(passage.id)).map((passage) => structuredClone(passage));
    const questions = selectedQuestions.map((question) => ({
        ...structuredClone(question),
        bankId: entry.catalog.id,
        bankSectionId: entry.catalog.sectionId,
        bankQuestionId: question.bankQuestionId ?? question.id,
        bankVersion: entry.catalog.version
    }));
    const topicIds = collectUniqueQuestionValues(questions, "testedTopicIds", entry.catalog.topicIds);
    const skillIds = collectUniqueQuestionValues(questions, "testedSkillIds", entry.catalog.skillIds);
    const prepared = {
        schemaVersion: entry.bank.schemaVersion ?? PRACTICE_SCHEMA_VERSION,
        bank: {
            ...(entry.bank.bank ?? {}),
            id: entry.catalog.id,
            sectionId: entry.catalog.sectionId,
            version: entry.catalog.version,
            source: QUESTION_BANK_PROVIDER_ID
        },
        session: {
            ...(entry.bank.session ?? {}),
            title: `${entry.catalog.shortName} Question Bank Practice`,
            sectionId: entry.catalog.sectionId,
            topicIds,
            skillIds,
            difficulty: "medium",
            questionFormat: "mixed",
            estimatedTimeMinutes: Math.ceil((questions.length * 95) / 60),
            aiModel: QUESTION_BANK_MODEL,
            disclaimer: "AI-generated OpenMCAT question-bank practice. Verify explanations when uncertain."
        },
        passages: selectedPassages,
        questions
    };
    const validation = validatePracticeSession(prepared, {
        requestedCount: questions.length,
        validTopicIds: getValidTopicIdsForSection(entry.catalog.sectionId),
        validSkillIds
    });
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    return {
        prepared: validation.normalized,
        warnings: [...entry.warnings, ...validation.warnings],
        runtimeConfig: {
            sectionId: entry.catalog.sectionId,
            topicIds,
            skillIds,
            difficulty: "medium",
            questionFormat: "mixed",
            questionCount: questions.length,
            timingMode: "untimed",
            secondsPerQuestion: null,
            reviewMode: "immediate",
            explanationDepth: "standard",
            providerId: QUESTION_BANK_PROVIDER_ID,
            model: QUESTION_BANK_MODEL,
            batchSize: 5,
            promptStrictness: "strict"
        },
        providerMeta: {
            providerId: QUESTION_BANK_PROVIDER_ID,
            model: QUESTION_BANK_MODEL,
            source: QUESTION_BANK_PROVIDER_ID,
            bankId: entry.catalog.id,
            bankSectionId: entry.catalog.sectionId,
            bankVersion: entry.catalog.version,
            requestedQuestionCount: clampQuestionCount(questionCount, entry.catalog.defaultQuestionCount),
            selectedQuestionCount: questions.length
        }
    };
};

export const buildQuestionBankSession = async ({ sectionId, attempts = [], questionCount = DEFAULT_QUESTION_BANK_COUNT }) => {
    const entry = await loadQuestionBank(sectionId, attempts);
    return prepareQuestionBankSession({ entry, attempts, questionCount });
};
