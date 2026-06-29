import { QUESTION_BANK_PROVIDER_ID } from "../data/bank/catalog.js";
import { MISTAKE_TYPES, normalizeMistakeTypeIds } from "../data/mistakes.js";
import { SCIENCE_SKILLS, SECTIONS, TOPICS } from "../data/taxonomy.js";
import { computeMastery } from "./mastery.js";

const cb = Chalkboard;

const DEFAULT_ALPHA = 2;
const DEFAULT_BETA = 2;
const DEFAULT_MIN_ATTEMPTS = 3;
const DEFAULT_TARGET_TIME_MS = 95000;
const DAY_MS = 24 * 60 * 60 * 1000;
const validSectionIds = new Set(SECTIONS.map((section) => section.id));
const validTopicIds = new Set(TOPICS.map((topic) => topic.id));
const validSkillIds = new Set(SCIENCE_SKILLS.map((skill) => skill.id));
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));

export const DEFAULT_DASHBOARD_FILTERS = {
    range: "all",
    sectionId: "all",
    timingMode: "all",
    reviewMode: "all",
    minAttempts: DEFAULT_MIN_ATTEMPTS
};

const rangeOptions = new Set(["all", "7d", "30d", "90d"]);
const timingOptions = new Set(["all", "timed", "untimed"]);
const reviewOptions = new Set(["all", "immediate", "later"]);
const sectionOptions = new Set(["all", ...SECTIONS.map((section) => section.id)]);

const safeNumber = (value, fallback = 0) => { const number = Number(value); return Number.isFinite(number) ? number : fallback; };

const round = (num, places = 0.01) => {
    const rounded = cb.numb.roundTo(safeNumber(num), safeNumber(places));
    const str = Math.abs(safeNumber(places)).toString().toLowerCase();
    let decimalPlaces = 0;
    if (str.includes("e-")) {
        const [coefficient, exponent] = str.split("e-");
        const coefficientDecimals = coefficient.split(".")[1]?.length ?? 0;
        decimalPlaces = Number(exponent) + coefficientDecimals;
    } else if (!str.includes("e+")) decimalPlaces = str.split(".")[1]?.length ?? 0;
    return Number(rounded.toFixed(decimalPlaces));
};

const constrain = (value, min, max) => cb.numb.constrain(safeNumber(value), [min, max]);

const sum = (values) => values.length ? cb.stat.sum(values) : 0;

const mean = (values) => values.length ? cb.stat.mean(values) : 0;

const dateMs = (value, fallback = 0) => { const parsed = new Date(value ?? "").getTime(); return Number.isFinite(parsed) ? parsed : fallback; };

const toIsoOrNull = (value) => { const parsed = dateMs(value, NaN); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; };

const getDateKey = (ms) => { if (!Number.isFinite(ms) || ms <= 0) return "unknown"; const date = new Date(ms); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${date.getFullYear()}-${month}-${day}`; };

const uniqueValues = (values) => Array.from(new Set((values ?? []).filter(Boolean)));

const normalizeModelName = (value) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/\s*\/\s*/g, "/").toLowerCase();
    return normalized.length ? normalized : null;
};

const getSessionAiModel = (session) => normalizeModelName(session?.generatedSession?.session?.aiModel) ?? normalizeModelName(session?.providerMeta?.model) ?? "unknown";

const getSessionSectionId = (session) => session?.config?.sectionId ?? session?.generatedSession?.session?.sectionId ?? "unknown";

const isQuestionBankSession = (session) => session?.providerMeta?.source === QUESTION_BANK_PROVIDER_ID || session?.generatedSession?.bank?.source === QUESTION_BANK_PROVIDER_ID || session?.generatedSession?.questions?.some((question) => question.bankQuestionId || question.bankId);

const getGeneratedQuestionKeys = (session) => {
    const questions = session?.generatedSession?.questions ?? [];
    const bankSession = isQuestionBankSession(session);
    const bankId = session?.providerMeta?.bankId ?? session?.generatedSession?.bank?.id ?? "question_bank";
    const bankSectionId = session?.providerMeta?.bankSectionId ?? session?.generatedSession?.bank?.sectionId ?? getSessionSectionId(session);
    const bankVersion = session?.providerMeta?.bankVersion ?? session?.generatedSession?.bank?.version ?? "unknown";
    return questions.map((question, index) => {
        const questionId = question?.id ?? `question_${index + 1}`;
        const bankQuestionId = question?.bankQuestionId ?? (bankSession ? questionId : null);
        if (bankSession && bankQuestionId) return `${QUESTION_BANK_PROVIDER_ID}:${bankId}:${bankSectionId}:${bankVersion}:${bankQuestionId}`;
        return `session:${session?.id ?? "unknown"}:${questionId}`;
    });
};

const accuracyFromRows = (rows) => { if (!rows.length) return 0; return rows.filter((row) => row.isCorrect).length / rows.length; };

const getTopicCoverageMultiplier = (coverageRate) => constrain(coverageRate, 0, 1) > 0 ? constrain(0.45 + (0.55 * cb.real.sqrt(constrain(coverageRate, 0, 1))), 0, 1) : 0;

const getRangeStartMs = (range) => {
    if (range === "7d") return Date.now() - (7 * DAY_MS);
    if (range === "30d") return Date.now() - (30 * DAY_MS);
    if (range === "90d") return Date.now() - (90 * DAY_MS);
    return null;
};

export const normalizeDashboardFilters = (filters = {}) => {
    const next = { ...DEFAULT_DASHBOARD_FILTERS, ...filters };
    next.range = rangeOptions.has(next.range) ? next.range : DEFAULT_DASHBOARD_FILTERS.range;
    next.sectionId = sectionOptions.has(next.sectionId) ? next.sectionId : DEFAULT_DASHBOARD_FILTERS.sectionId;
    next.timingMode = timingOptions.has(next.timingMode) ? next.timingMode : DEFAULT_DASHBOARD_FILTERS.timingMode;
    next.reviewMode = reviewOptions.has(next.reviewMode) ? next.reviewMode : DEFAULT_DASHBOARD_FILTERS.reviewMode;
    next.minAttempts = constrain(Number(next.minAttempts) || DEFAULT_MIN_ATTEMPTS, 1, 20);
    return next;
};

export const buildSessionIndex = (sessions = []) => {
    const index = new Map();
    sessions.forEach((session) => {
        const questionById = new Map();
        (session.generatedSession?.questions ?? []).forEach((question) => {
            questionById.set(question.id, question);
        });
        index.set(session.id, { session, questionById });
    });
    return index;
};

const getTargetTimeMs = ({ sectionId, timingMode, config, attempt }) => {
    const configuredSeconds = safeNumber(attempt.secondsPerQuestion, safeNumber(config?.secondsPerQuestion, 0));
    if (configuredSeconds > 0) return configuredSeconds * 1000;
    if (timingMode === "timed") return DEFAULT_TARGET_TIME_MS;
    return DEFAULT_TARGET_TIME_MS;
};

const normalizeAttempt = (attempt, sessionIndex) => {
    const sessionEntry = sessionIndex.get(attempt.sessionId);
    const session = sessionEntry?.session ?? null;
    const question = sessionEntry?.questionById.get(attempt.questionId) ?? null;
    const generatedSession = session?.generatedSession?.session ?? {};
    const config = session?.config ?? {};
    const sectionId = attempt.sectionId ?? generatedSession.sectionId ?? config.sectionId ?? "unknown";
    const topicIds = uniqueValues((attempt.topicIds?.length ? attempt.topicIds : question?.testedTopicIds?.length ? question.testedTopicIds : generatedSession.topicIds) ?? []);
    const skillIds = uniqueValues((attempt.skillIds?.length ? attempt.skillIds : question?.testedSkillIds?.length ? question.testedSkillIds : generatedSession.skillIds) ?? []);
    const timingMode = attempt.timingMode ?? config.timingMode ?? "untimed";
    const reviewMode = attempt.reviewMode ?? config.reviewMode ?? "immediate";
    const answeredAtMs = dateMs(attempt.answeredAt, dateMs(session?.completedAt, dateMs(session?.createdAt, 0)));
    const startedAtMs = dateMs(attempt.startedAt, dateMs(session?.createdAt, answeredAtMs));
    const elapsedMs = safeNumber(attempt.elapsedMs, answeredAtMs && startedAtMs ? answeredAtMs - startedAtMs : 0);
    const targetTimeMs = getTargetTimeMs({ sectionId, timingMode, config, attempt });
    const isCorrect = Boolean(attempt.isCorrect);
    const mistakeTypeIds = isCorrect ? [] : normalizeMistakeTypeIds(attempt.mistakeTypeIds);
    return {
        ...attempt,
        sectionId,
        topicIds,
        skillIds,
        difficulty: attempt.difficulty ?? question?.estimatedDifficulty ?? generatedSession.difficulty ?? config.difficulty ?? "mixed",
        timingMode,
        reviewMode,
        isTimed: timingMode === "timed",
        isCorrect,
        mistakeTypeIds,
        confidence: typeof attempt.confidence === "number" ? attempt.confidence : null,
        answeredAtMs,
        answeredAt: toIsoOrNull(attempt.answeredAt) ?? toIsoOrNull(answeredAtMs),
        answeredDateKey: getDateKey(answeredAtMs),
        startedAtMs,
        elapsedMs: cb.stat.max([0, elapsedMs]),
        targetTimeMs,
        timeRatio: targetTimeMs ? cb.stat.max([0, elapsedMs]) / targetTimeMs : 0,
        sessionCreatedAtMs: dateMs(session?.createdAt, answeredAtMs),
        sessionCompletedAtMs: dateMs(session?.completedAt, 0),
        sessionTitle: session?.generatedSession?.session?.title ?? "Practice session",
        generatedQuestionCount: session?.generatedSession?.questions?.length ?? 0
    };
};

const filterAttempts = (attempts, filters) => {
    const startMs = getRangeStartMs(filters.range);
    return attempts.filter((attempt) => {
        if (startMs && attempt.answeredAtMs < startMs) return false;
        if (filters.sectionId !== "all" && attempt.sectionId !== filters.sectionId) return false;
        if (filters.timingMode !== "all" && attempt.timingMode !== filters.timingMode) return false;
        if (filters.reviewMode !== "all" && attempt.reviewMode !== filters.reviewMode) return false;
        return true;
    });
};

const createAggregateRecord = (id, sectionId = null) => ({
    id,
    sectionId,
    weightedAttempts: 0,
    correctWeight: 0,
    rawCount: 0,
    elapsedWeight: 0,
    elapsedWeightedTotal: 0,
    targetWeight: 0,
    targetWeightedTotal: 0,
    confidenceWeight: 0,
    confidenceWeightedTotal: 0,
    firstSeenAtMs: null,
    lastSeenAtMs: null,
    attemptsForTrend: []
});

const addToAggregate = (record, attempt, weight = 1) => {
    record.weightedAttempts += weight;
    record.correctWeight += attempt.isCorrect ? weight : 0;
    record.rawCount += 1;
    if (Number.isFinite(attempt.elapsedMs)) {
        record.elapsedWeight += weight;
        record.elapsedWeightedTotal += attempt.elapsedMs * weight;
    }
    if (Number.isFinite(attempt.targetTimeMs) && attempt.targetTimeMs > 0) {
        record.targetWeight += weight;
        record.targetWeightedTotal += attempt.targetTimeMs * weight;
    }
    if (typeof attempt.confidence === "number") {
        record.confidenceWeight += weight;
        record.confidenceWeightedTotal += attempt.confidence * weight;
    }
    record.firstSeenAtMs = record.firstSeenAtMs === null ? attempt.answeredAtMs : cb.stat.min([record.firstSeenAtMs, attempt.answeredAtMs]);
    record.lastSeenAtMs = record.lastSeenAtMs === null ? attempt.answeredAtMs : cb.stat.max([record.lastSeenAtMs, attempt.answeredAtMs]);
    record.attemptsForTrend.push(attempt);
};

const finalizeAggregate = (record, minAttempts = DEFAULT_MIN_ATTEMPTS) => {
    const attempts = record.weightedAttempts;
    const correct = record.correctWeight;
    const averageElapsedMs = record.elapsedWeight ? record.elapsedWeightedTotal / record.elapsedWeight : 0;
    const targetTimeMs = record.targetWeight ? record.targetWeightedTotal / record.targetWeight : DEFAULT_TARGET_TIME_MS;
    const smoothedAccuracy = attempts ? (correct + DEFAULT_ALPHA) / (attempts + DEFAULT_ALPHA + DEFAULT_BETA) : 0;
    const mastery = computeMastery({ correct, attempts, averageTimeMs: averageElapsedMs, targetTimeMs, alpha: DEFAULT_ALPHA, beta: DEFAULT_BETA });
    const sortedTrendRows = record.attemptsForTrend.slice().sort((a, b) => a.answeredAtMs - b.answeredAtMs);
    let trendDelta = null;
    if (sortedTrendRows.length >= 4) {
        const midpoint = Math.floor(sortedTrendRows.length / 2);
        const older = sortedTrendRows.slice(0, midpoint);
        const newer = sortedTrendRows.slice(midpoint);
        trendDelta = accuracyFromRows(newer) - accuracyFromRows(older);
    }
    const timeRatio = targetTimeMs ? averageElapsedMs / targetTimeMs : 0;
    const accuracyWeakness = (1 - smoothedAccuracy) * 64;
    const timingWeakness = constrain((timeRatio - 1) * 24, 0, 18);
    const confidenceAverage = record.confidenceWeight ? record.confidenceWeightedTotal / record.confidenceWeight : null;
    const confidenceWeakness = confidenceAverage && confidenceAverage >= 4 && attempts && correct / attempts < 0.7 ? 5 : 0;
    const volumeFactor = constrain(cb.real.sqrt(attempts / minAttempts), 0.4, 1.15);
    const priorityScore = constrain((accuracyWeakness + timingWeakness + confidenceWeakness) * volumeFactor, 0, 100);
    return {
        id: record.id,
        sectionId: record.sectionId,
        attempts: round(attempts, 0.01),
        weightedAttempts: round(attempts, 0.01),
        questionAttempts: record.rawCount,
        rawCount: record.rawCount,
        correct: round(correct, 0.01),
        accuracy: attempts ? correct / attempts : 0,
        smoothedAccuracy,
        averageElapsedMs,
        avgTimeMs: averageElapsedMs,
        targetTimeMs,
        timeRatio,
        mastery: mastery.mastery,
        timingPenalty: mastery.timingPenalty,
        volumeMultiplier: mastery.volumeMultiplier,
        confidenceAverage,
        firstSeenAt: record.firstSeenAtMs ? new Date(record.firstSeenAtMs).toISOString() : null,
        lastSeenAt: record.lastSeenAtMs ? new Date(record.lastSeenAtMs).toISOString() : null,
        lastSeenAtMs: record.lastSeenAtMs ?? 0,
        trendDelta,
        priorityScore: round(priorityScore, 0.01),
        signalStrength: attempts >= minAttempts || record.rawCount >= minAttempts ? "stable" : attempts >= 1 ? "early" : "none"
    };
};

const aggregateAttempts = (attempts, getKeys, options = {}) => {
    const groups = new Map();
    const minAttempts = options.minAttempts ?? DEFAULT_MIN_ATTEMPTS;
    attempts.forEach((attempt) => {
        const pairs = getKeys(attempt).filter((entry) => entry && entry.id);
        pairs.forEach((entry) => {
            if (!groups.has(entry.id)) groups.set(entry.id, createAggregateRecord(entry.id, entry.sectionId ?? attempt.sectionId));
            addToAggregate(groups.get(entry.id), attempt, entry.weight ?? 1);
        });
    });
    return Array.from(groups.values()).map((record) => finalizeAggregate(record, minAttempts));
};

const buildSectionTopicCoverage = (attempts) => {
    const topicsBySection = new Map();
    SECTIONS.forEach((section) => {
        topicsBySection.set(section.id, TOPICS.filter((topic) => topic.sectionId === section.id).map((topic) => topic.id));
    });
    const coveredBySection = new Map(SECTIONS.map((section) => [section.id, new Set()]));
    attempts.forEach((attempt) => {
        const sectionId = attempt.sectionId;
        if (!coveredBySection.has(sectionId)) coveredBySection.set(sectionId, new Set());
        (attempt.topicIds ?? []).forEach((topicId) => {
            const topic = TOPICS.find((item) => item.id === topicId);
            const topicSectionId = topic?.sectionId ?? sectionId;
            if (topicSectionId === sectionId && validTopicIds.has(topicId)) coveredBySection.get(sectionId).add(topicId);
        });
    });
    return Object.fromEntries(SECTIONS.map((section) => {
        const total = topicsBySection.get(section.id)?.length ?? 0;
        const covered = coveredBySection.get(section.id)?.size ?? 0;
        return [section.id, {
            sectionId: section.id,
            coveredTopicCount: covered,
            totalTopicCount: total,
            topicCoverageRate: total ? covered / total : 0
        }];
    }));
};

const applyTopicCoverageToSectionRows = (rows, coverageBySection) => rows.map((row) => {
    const coverage = coverageBySection[row.id] ?? { coveredTopicCount: 0, totalTopicCount: 0, topicCoverageRate: 0 };
    const coverageMultiplier = getTopicCoverageMultiplier(coverage.topicCoverageRate);
    return {
        ...row,
        contentMastery: row.mastery,
        topicCoverageMultiplier: round(coverageMultiplier, 0.01),
        topicCoverageRate: coverage.topicCoverageRate,
        coveredTopicCount: coverage.coveredTopicCount,
        totalTopicCount: coverage.totalTopicCount,
        mastery: round(row.mastery * coverageMultiplier, 0.01)
    };
});

const buildTopicSkillPairs = (attempts, minAttempts) => {
    return aggregateAttempts(attempts, (attempt) => {
        const topics = attempt.topicIds.length ? attempt.topicIds : ["unknown_topic"];
        const skills = attempt.skillIds.length ? attempt.skillIds : ["unknown_skill"];
        const weight = 1 / (topics.length * skills.length);
        return topics.flatMap((topicId) => skills.map((skillId) => ({
            id: `${topicId}__${skillId}`,
            topicId,
            skillId,
            sectionId: attempt.sectionId,
            weight
        })));
    }, { minAttempts }).map((row) => {
        const [topicId, skillId] = row.id.split("__");
        return { ...row, topicId, skillId };
    }).sort((a, b) => b.priorityScore - a.priorityScore || b.attempts - a.attempts);
};

const buildTopicSkillMatrix = (pairs) => {
    const rowsByTopic = new Map();
    const skillIds = new Set();
    const sectionIds = new Set();
    pairs.forEach((pair) => {
        const sectionId = pair.sectionId ?? "unknown";
        skillIds.add(pair.skillId);
        sectionIds.add(sectionId);
        if (!rowsByTopic.has(pair.topicId)) {
            rowsByTopic.set(pair.topicId, {
                topicId: pair.topicId,
                sectionId,
                cells: [],
                maxPriorityScore: 0,
                worstPriority: 0,
                attempts: 0,
                totalWeightedAttempts: 0
            });
        }
        const row = rowsByTopic.get(pair.topicId);
        row.cells.push(pair);
        row.maxPriorityScore = cb.stat.max([row.maxPriorityScore, pair.priorityScore]);
        row.worstPriority = row.maxPriorityScore;
        row.attempts += pair.attempts;
        row.totalWeightedAttempts += pair.weightedAttempts ?? pair.attempts;
    });
    return {
        skillIds: Array.from(skillIds),
        sectionIds: Array.from(sectionIds),
        rows: Array.from(rowsByTopic.values()).map((row) => ({
            ...row,
            attempts: round(row.attempts, 0.01),
            totalWeightedAttempts: round(row.totalWeightedAttempts, 0.01),
            cells: row.cells.sort((a, b) => b.priorityScore - a.priorityScore || b.attempts - a.attempts)
        })).sort((a, b) => b.maxPriorityScore - a.maxPriorityScore || b.attempts - a.attempts)
    };
};

const NON_DRILL_DRIVER_MISTAKE_IDS = new Set(["flawed_question", "other"]);

const roundWeightedCount = (value) => Math.abs(safeNumber(value) - Math.round(safeNumber(value))) < 0.000001 ? Math.round(safeNumber(value)) : round(value, 0.01);

const createMistakeSummaryMap = () => new Map(MISTAKE_TYPES.map((type, index) => [type.id, {
    id: type.id,
    label: type.label,
    count: 0,
    elapsedWeight: 0,
    elapsedTotalMs: 0,
    timeRatioWeight: 0,
    timeRatioTotal: 0,
    sortIndex: index
}]));

const sortMistakeRows = (summariesById, { totalSelections = 0, incorrectAttemptCount = 0 } = {}) => MISTAKE_TYPES.map((type, index) => {
    const summary = summariesById.get(type.id) ?? {};
    const count = summary.count ?? 0;
    return {
        id: type.id,
        label: summary.label ?? type.label,
        count: roundWeightedCount(count),
        selectionRate: totalSelections ? count / totalSelections : 0,
        incorrectQuestionRate: incorrectAttemptCount ? count / incorrectAttemptCount : 0,
        averageElapsedMs: summary.elapsedWeight ? summary.elapsedTotalMs / summary.elapsedWeight : null,
        averageTimeRatio: summary.timeRatioWeight ? summary.timeRatioTotal / summary.timeRatioWeight : null,
        sortIndex: summary.sortIndex ?? index
    };
}).sort((a, b) => b.count - a.count || a.sortIndex - b.sortIndex).map(({ sortIndex, ...row }) => row);

const createMistakeBreakdownRecord = ({ id, sectionId = null, topicId = null, skillId = null }) => ({
    id,
    sectionId,
    topicId,
    skillId,
    incorrectAttemptCount: 0,
    taggedIncorrectAttemptCount: 0,
    rawIncorrectAttemptCount: 0,
    rawTaggedIncorrectAttemptCount: 0,
    totalSelections: 0,
    elapsedWeight: 0,
    elapsedTotalMs: 0,
    timeRatioWeight: 0,
    timeRatioTotal: 0,
    summariesById: createMistakeSummaryMap(),
    sectionCounts: new Map()
});

const addMistakeBreakdownAttempt = (record, attempt, weight = 1) => {
    const normalizedWeight = safeNumber(weight, 0);
    if (!normalizedWeight) return;
    const mistakeTypeIds = normalizeMistakeTypeIds(attempt.mistakeTypeIds);
    record.incorrectAttemptCount += normalizedWeight;
    record.rawIncorrectAttemptCount += 1;
    if (!mistakeTypeIds.length) return;
    record.taggedIncorrectAttemptCount += normalizedWeight;
    record.rawTaggedIncorrectAttemptCount += 1;
    if (Number.isFinite(attempt.elapsedMs)) {
        record.elapsedWeight += normalizedWeight;
        record.elapsedTotalMs += cb.stat.max([0, attempt.elapsedMs]) * normalizedWeight;
    }
    if (Number.isFinite(attempt.timeRatio)) {
        record.timeRatioWeight += normalizedWeight;
        record.timeRatioTotal += cb.stat.max([0, attempt.timeRatio]) * normalizedWeight;
    }
    if (attempt.sectionId) record.sectionCounts.set(attempt.sectionId, (record.sectionCounts.get(attempt.sectionId) ?? 0) + (normalizedWeight * mistakeTypeIds.length));
    mistakeTypeIds.forEach((mistakeTypeId) => {
        const summary = record.summariesById.get(mistakeTypeId);
        if (!summary) return;
        summary.count += normalizedWeight;
        record.totalSelections += normalizedWeight;
        if (Number.isFinite(attempt.elapsedMs)) {
            summary.elapsedWeight += normalizedWeight;
            summary.elapsedTotalMs += cb.stat.max([0, attempt.elapsedMs]) * normalizedWeight;
        }
        if (Number.isFinite(attempt.timeRatio)) {
            summary.timeRatioWeight += normalizedWeight;
            summary.timeRatioTotal += cb.stat.max([0, attempt.timeRatio]) * normalizedWeight;
        }
    });
};

const getSectionBreakdownRows = (sectionCounts) => Array.from(sectionCounts.entries()).map(([sectionId, count]) => ({
    sectionId,
    count: roundWeightedCount(count)
})).sort((a, b) => b.count - a.count || a.sectionId.localeCompare(b.sectionId));

const finalizeMistakeBreakdownRecord = (record) => {
    const rows = sortMistakeRows(record.summariesById, {
        totalSelections: record.totalSelections,
        incorrectAttemptCount: record.incorrectAttemptCount
    }).filter((row) => row.count > 0);
    const dominantRow = rows[0] ?? null;
    const actionableRow = rows.find((row) => !NON_DRILL_DRIVER_MISTAKE_IDS.has(row.id)) ?? null;
    const sectionBreakdown = getSectionBreakdownRows(record.sectionCounts);
    const resolvedSectionId = record.sectionId ?? sectionBreakdown[0]?.sectionId ?? null;
    return {
        id: record.id,
        sectionId: resolvedSectionId,
        topicId: record.topicId,
        skillId: record.skillId,
        incorrectAttemptCount: roundWeightedCount(record.incorrectAttemptCount),
        taggedIncorrectAttemptCount: roundWeightedCount(record.taggedIncorrectAttemptCount),
        untaggedIncorrectAttemptCount: roundWeightedCount(cb.stat.max([0, record.incorrectAttemptCount - record.taggedIncorrectAttemptCount])),
        rawIncorrectAttemptCount: record.rawIncorrectAttemptCount,
        rawTaggedIncorrectAttemptCount: record.rawTaggedIncorrectAttemptCount,
        totalSelections: roundWeightedCount(record.totalSelections),
        tagCoverageRate: record.incorrectAttemptCount ? record.taggedIncorrectAttemptCount / record.incorrectAttemptCount : 0,
        dominantMistakeTypeId: dominantRow?.id ?? null,
        dominantMistakeTypeLabel: dominantRow?.label ?? null,
        dominantMistakeRate: dominantRow?.selectionRate ?? 0,
        actionableMistakeTypeId: actionableRow?.id ?? null,
        actionableMistakeTypeLabel: actionableRow?.label ?? null,
        actionableMistakeRate: actionableRow?.selectionRate ?? 0,
        averageElapsedMs: record.elapsedWeight ? record.elapsedTotalMs / record.elapsedWeight : null,
        averageTimeRatio: record.timeRatioWeight ? record.timeRatioTotal / record.timeRatioWeight : null,
        sectionBreakdown,
        rows
    };
};

const sortMistakeBreakdownRows = (rows) => rows.sort((a, b) => {
    return safeNumber(b.totalSelections) - safeNumber(a.totalSelections)
        || safeNumber(b.taggedIncorrectAttemptCount) - safeNumber(a.taggedIncorrectAttemptCount)
        || safeNumber(b.incorrectAttemptCount) - safeNumber(a.incorrectAttemptCount)
        || String(a.id).localeCompare(String(b.id));
});

const buildMistakeBreakdownAnalytics = (incorrectAttempts) => {
    const byTopicRecords = new Map();
    const bySkillRecords = new Map();
    const byTopicSkillRecords = new Map();
    const ensureRecord = (records, entry) => {
        if (!records.has(entry.id)) records.set(entry.id, createMistakeBreakdownRecord(entry));
        return records.get(entry.id);
    };
    incorrectAttempts.forEach((attempt) => {
        const topicIds = uniqueValues(attempt.topicIds).filter((topicId) => validTopicIds.has(topicId));
        const skillIds = uniqueValues(attempt.skillIds).filter((skillId) => validSkillIds.has(skillId));
        const topicWeight = topicIds.length ? 1 / topicIds.length : 0;
        const skillWeight = skillIds.length ? 1 / skillIds.length : 0;
        const pairWeight = topicIds.length && skillIds.length ? 1 / (topicIds.length * skillIds.length) : 0;
        topicIds.forEach((topicId) => {
            addMistakeBreakdownAttempt(ensureRecord(byTopicRecords, {
                id: topicId,
                topicId,
                sectionId: topicsById[topicId]?.sectionId ?? attempt.sectionId
            }), attempt, topicWeight);
        });
        skillIds.forEach((skillId) => {
            addMistakeBreakdownAttempt(ensureRecord(bySkillRecords, {
                id: skillId,
                skillId
            }), attempt, skillWeight);
        });
        topicIds.forEach((topicId) => {
            skillIds.forEach((skillId) => {
                addMistakeBreakdownAttempt(ensureRecord(byTopicSkillRecords, {
                    id: `${topicId}__${skillId}`,
                    topicId,
                    skillId,
                    sectionId: topicsById[topicId]?.sectionId ?? attempt.sectionId
                }), attempt, pairWeight);
            });
        });
    });
    const finalizeRows = (records) => sortMistakeBreakdownRows(Array.from(records.values()).map(finalizeMistakeBreakdownRecord).filter((row) => safeNumber(row.totalSelections) > 0));
    return {
        byTopic: finalizeRows(byTopicRecords),
        bySkill: finalizeRows(bySkillRecords),
        byTopicSkill: finalizeRows(byTopicSkillRecords)
    };
};

const createMistakeTrendCounts = () => Object.fromEntries(MISTAKE_TYPES.map((type) => [type.id, 0]));

const createMistakeTrendRecord = (date) => ({
    date,
    label: date === "unknown" ? "Unknown date" : date,
    taggedIncorrectAttemptCount: 0,
    totalSelections: 0,
    countsByType: createMistakeTrendCounts()
});

const buildMistakeTrendRowMix = (countsByType, totalSelections) => MISTAKE_TYPES.map((type, index) => ({
    id: type.id,
    label: type.label,
    count: countsByType[type.id] ?? 0,
    selectionRate: totalSelections ? (countsByType[type.id] ?? 0) / totalSelections : 0,
    sortIndex: index
})).filter((row) => row.count > 0).sort((a, b) => b.count - a.count || a.sortIndex - b.sortIndex).map(({ sortIndex, ...row }) => row);

const buildMistakeTypeTrend = (incorrectAttempts) => {
    const recordsByDate = new Map();
    incorrectAttempts.forEach((attempt) => {
        const mistakeTypeIds = normalizeMistakeTypeIds(attempt.mistakeTypeIds);
        if (!mistakeTypeIds.length) return;
        const date = attempt.answeredDateKey && attempt.answeredDateKey !== "unknown" ? attempt.answeredDateKey : getDateKey(attempt.answeredAtMs);
        if (!recordsByDate.has(date)) recordsByDate.set(date, createMistakeTrendRecord(date));
        const record = recordsByDate.get(date);
        record.taggedIncorrectAttemptCount += 1;
        mistakeTypeIds.forEach((mistakeTypeId) => {
            record.countsByType[mistakeTypeId] = (record.countsByType[mistakeTypeId] ?? 0) + 1;
            record.totalSelections += 1;
        });
    });
    const rows = Array.from(recordsByDate.values()).sort((a, b) => {
        if (a.date === "unknown") return 1;
        if (b.date === "unknown") return -1;
        return a.date.localeCompare(b.date);
    }).map((record) => ({
        ...record,
        countsByType: Object.fromEntries(MISTAKE_TYPES.map((type) => [type.id, record.countsByType[type.id] ?? 0])),
        rows: buildMistakeTrendRowMix(record.countsByType, record.totalSelections)
    }));
    const activeMistakeTypes = MISTAKE_TYPES.map((type) => ({
        id: type.id,
        label: type.label,
        count: sum(rows.map((row) => safeNumber(row.countsByType[type.id], 0)))
    })).filter((type) => type.count > 0).sort((a, b) => b.count - a.count || MISTAKE_TYPES.findIndex((type) => type.id === a.id) - MISTAKE_TYPES.findIndex((type) => type.id === b.id));
    return {
        rows,
        activeMistakeTypes,
        totalSelections: sum(activeMistakeTypes.map((type) => type.count)),
        taggedIncorrectAttemptCount: sum(rows.map((row) => row.taggedIncorrectAttemptCount))
    };
};

const buildMistakeTypeAnalytics = (attempts) => {
    const incorrectAttempts = attempts.filter((attempt) => !attempt.isCorrect);
    const summariesById = createMistakeSummaryMap();
    let taggedIncorrectAttemptCount = 0;
    let totalSelections = 0;
    incorrectAttempts.forEach((attempt) => {
        const ids = normalizeMistakeTypeIds(attempt.mistakeTypeIds);
        if (ids.length) taggedIncorrectAttemptCount += 1;
        ids.forEach((id) => {
            const summary = summariesById.get(id);
            if (!summary) return;
            summary.count += 1;
            totalSelections += 1;
            if (Number.isFinite(attempt.elapsedMs)) {
                summary.elapsedWeight += 1;
                summary.elapsedTotalMs += cb.stat.max([0, attempt.elapsedMs]);
            }
            if (Number.isFinite(attempt.timeRatio)) {
                summary.timeRatioWeight += 1;
                summary.timeRatioTotal += cb.stat.max([0, attempt.timeRatio]);
            }
        });
    });
    const incorrectAttemptCount = incorrectAttempts.length;
    const rows = sortMistakeRows(summariesById, { totalSelections, incorrectAttemptCount });
    const breakdown = buildMistakeBreakdownAnalytics(incorrectAttempts);
    const trend = buildMistakeTypeTrend(incorrectAttempts);
    return {
        incorrectAttemptCount,
        taggedIncorrectAttemptCount,
        untaggedIncorrectAttemptCount: incorrectAttemptCount - taggedIncorrectAttemptCount,
        totalSelections,
        tagCoverageRate: incorrectAttemptCount ? taggedIncorrectAttemptCount / incorrectAttemptCount : 0,
        rows,
        trend,
        ...breakdown
    };
};

const buildConfidenceAnalytics = (attempts) => {
    const confidenceRows = aggregateAttempts(attempts.filter((attempt) => typeof attempt.confidence === "number"), (attempt) => [{ id: String(attempt.confidence) }]);
    const expectedByConfidence = { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 0.9 };
    const groups = [1, 2, 3, 4, 5].map((level) => {
        const row = confidenceRows.find((item) => item.id === String(level));
        const expectedAccuracy = expectedByConfidence[level];
        return {
            id: String(level),
            level,
            confidence: level,
            attempts: row?.attempts ?? 0,
            correct: row?.correct ?? 0,
            accuracy: row?.accuracy ?? 0,
            smoothedAccuracy: row?.smoothedAccuracy ?? 0,
            expectedAccuracy,
            calibrationGap: row ? row.accuracy - expectedAccuracy : null
        };
    });
    const rowsWithData = groups.filter((row) => row.attempts > 0);
    const weightedError = rowsWithData.length ? sum(rowsWithData.map((row) => {
        const gap = row.accuracy >= row.expectedAccuracy ? row.accuracy - row.expectedAccuracy : row.expectedAccuracy - row.accuracy;
        return gap * row.attempts;
    })) / sum(rowsWithData.map((row) => row.attempts)) : null;
    const calibrationScore = weightedError === null ? null : constrain((1 - weightedError) * 100, 0, 100);
    const highConfidence = attempts.filter((attempt) => typeof attempt.confidence === "number" && attempt.confidence >= 4);
    const lowConfidence = attempts.filter((attempt) => typeof attempt.confidence === "number" && attempt.confidence <= 2);
    return {
        groups,
        calibrationRows: groups,
        calibrationScore,
        overconfidence: highConfidence.length ? 1 - accuracyFromRows(highConfidence) : null,
        underconfidence: lowConfidence.length ? accuracyFromRows(lowConfidence) : null,
        noConfidenceCount: attempts.filter((attempt) => typeof attempt.confidence !== "number").length,
        confidenceAttempts: sum(groups.map((row) => row.attempts))
    };
};

const buildDailyTrend = (attempts) => {
    const rows = aggregateAttempts(attempts, (attempt) => [{ id: attempt.answeredDateKey }]).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return rows.map((row) => ({
        date: row.id,
        label: row.id,
        attempts: row.attempts,
        correct: row.correct,
        accuracy: row.accuracy,
        smoothedAccuracy: row.smoothedAccuracy,
        averageElapsedMs: row.averageElapsedMs
    }));
};

const buildRollingTrend = (attempts, windowSize = 10) => {
    const sorted = attempts.slice().sort((a, b) => a.answeredAtMs - b.answeredAtMs);
    if (sorted.length < 3) return [];
    const effectiveWindow = constrain(windowSize, 3, sorted.length);
    return sorted.map((attempt, index) => {
        const start = cb.stat.max([0, index - effectiveWindow + 1]);
        const windowRows = sorted.slice(start, index + 1);
        const rollingAccuracy = accuracyFromRows(windowRows);
        return {
            index: index + 1,
            attemptNumber: index + 1,
            label: `${index + 1}`,
            date: attempt.answeredDateKey,
            attempts: windowRows.length,
            windowSize: windowRows.length,
            accuracy: rollingAccuracy,
            rollingAccuracy,
            isCorrect: attempt.isCorrect
        };
    });
};

const buildSessionSummaries = (attempts, sessions, filters) => {
    const attemptsBySession = new Map();
    attempts.forEach((attempt) => {
        if (!attemptsBySession.has(attempt.sessionId)) attemptsBySession.set(attempt.sessionId, []);
        attemptsBySession.get(attempt.sessionId).push(attempt);
    });
    return sessions.map((session) => {
        const rows = attemptsBySession.get(session.id) ?? [];
        const createdAtMs = dateMs(session.createdAt, 0);
        const completedAtMs = dateMs(session.completedAt, createdAtMs);
        if (filters.range !== "all") {
            const startMs = getRangeStartMs(filters.range);
            if (startMs && completedAtMs < startMs && createdAtMs < startMs && !rows.length) return null;
        }
        if (filters.sectionId !== "all" && session.config?.sectionId !== filters.sectionId && session.generatedSession?.session?.sectionId !== filters.sectionId && !rows.length) return null;
        const correct = rows.filter((attempt) => attempt.isCorrect).length;
        const elapsedValues = rows.map((attempt) => attempt.elapsedMs).filter(Number.isFinite);
        const missedTopicIds = Array.from(new Set(rows.filter((attempt) => !attempt.isCorrect).flatMap((attempt) => attempt.topicIds ?? [])));
        const generatedQuestionKeys = getGeneratedQuestionKeys(session);
        return {
            id: session.id,
            title: session.generatedSession?.session?.title ?? "Practice session",
            createdAt: toIsoOrNull(session.createdAt),
            completedAt: toIsoOrNull(session.completedAt),
            createdAtMs,
            completedAtMs,
            config: session.config ? structuredClone(session.config) : null,
            aiModel: getSessionAiModel(session),
            sectionId: session.generatedSession?.session?.sectionId ?? session.config?.sectionId ?? rows[0]?.sectionId ?? "unknown",
            timingMode: session.config?.timingMode ?? rows[0]?.timingMode ?? "untimed",
            reviewMode: session.config?.reviewMode ?? rows[0]?.reviewMode ?? "immediate",
            generatedQuestionKeys,
            generatedQuestionCount: generatedQuestionKeys.length,
            questionCount: generatedQuestionKeys.length,
            attempts: rows.length,
            correct,
            accuracy: rows.length ? correct / rows.length : 0,
            averageElapsedMs: elapsedValues.length ? mean(elapsedValues) : 0,
            missedTopicIds,
            missedTopics: missedTopicIds,
            completed: Boolean(session.completedAt)
        };
    }).filter(Boolean).sort((a, b) => (b.completedAtMs || b.createdAtMs) - (a.completedAtMs || a.createdAtMs));
};

const buildModelUsage = (sessionSummaries) => {
    const groups = new Map();
    sessionSummaries.forEach((session) => {
        const model = normalizeModelName(session.aiModel) ?? "unknown";
        const generatedQuestionKeys = session.generatedQuestionKeys ?? [];
        if (!generatedQuestionKeys.length) return;
        if (!groups.has(model)) {
            groups.set(model, {
                id: model,
                model,
                sessionCount: 0,
                generatedQuestionKeys: new Set(),
                answeredAttempts: 0,
                correct: 0
            });
        }
        const row = groups.get(model);
        row.sessionCount += 1;
        generatedQuestionKeys.forEach((key) => row.generatedQuestionKeys.add(key));
        row.answeredAttempts += safeNumber(session.attempts, 0);
        row.correct += safeNumber(session.correct, 0);
    });
    const rows = Array.from(groups.values()).map((row) => ({
        id: row.id,
        model: row.model,
        sessionCount: row.sessionCount,
        generatedQuestionCount: row.generatedQuestionKeys.size,
        answeredAttempts: row.answeredAttempts,
        correct: row.correct,
        accuracy: row.answeredAttempts ? row.correct / row.answeredAttempts : null
    })).sort((a, b) => b.generatedQuestionCount - a.generatedQuestionCount || b.sessionCount - a.sessionCount || a.model.localeCompare(b.model));
    return {
        rows,
        totalModels: rows.length,
        totalGeneratedQuestions: sum(rows.map((row) => row.generatedQuestionCount)),
        topModel: rows[0] ?? null
    };
};

const buildInsights = ({ filteredAttempts, totals, weakness, confidence, minAttempts }) => {
    const insights = [];
    if (!filteredAttempts.length) {
        insights.push({ type: "empty", severity: "info", title: "No matching attempts", body: "Complete a practice session or relax the dashboard filters to see analytics." });
        return insights;
    }
    const strongestPair = weakness.topicSkillPairs.find((pair) => pair.attempts >= minAttempts);
    if (strongestPair) {
        insights.push({
            type: "weak_pair",
            severity: "warning",
            title: "Most drill-worthy pair",
            topicId: strongestPair.topicId,
            skillId: strongestPair.skillId,
            priorityScore: strongestPair.priorityScore,
            attempts: strongestPair.attempts,
            body: `The highest-priority topic-skill pair has a ${round(strongestPair.priorityScore, 0.1)} priority score across ${round(strongestPair.attempts, 0.1)} weighted attempts.`
        });
    }
    if (typeof totals.timedUntimedGap === "number" && totals.timedUntimedGap > 0.1) insights.push({ type: "timing_gap", severity: "warning", title: "Timing pressure is visible", body: `Untimed accuracy is ${round(totals.timedUntimedGap * 100, 0.1)} percentage points higher than timed accuracy.` });
    if (typeof confidence.overconfidence === "number" && confidence.overconfidence > 0.35) insights.push({ type: "confidence", severity: "warning", title: "High-confidence misses", body: "Questions marked confidence 4-5 are missing often enough to review explanations carefully before increasing speed." });
    if (filteredAttempts.length < 20) insights.push({ type: "data_health", severity: "info", title: "Early signal", body: "The dashboard is usable, but mastery estimates stabilize after more attempts across sections, topics, and skills." });
    return insights.slice(0, 4);
};

const buildDataHealth = (filteredAttempts, bySection, minAttempts, totalStoredAnsweredAttempts) => {
    const sectionsWithLowSignal = bySection.filter((row) => row.attempts > 0 && row.attempts < minAttempts).map((row) => row.id);
    const attemptedSectionIds = new Set(bySection.map((row) => row.id));
    const emptySections = SECTIONS.filter((section) => !attemptedSectionIds.has(section.id)).map((section) => section.id);
    return {
        hasEnoughData: filteredAttempts.length >= 20,
        minAttemptsForStableSignal: minAttempts,
        sectionsWithLowSignal,
        emptySections,
        totalStoredAnsweredAttempts,
        filteredOutAttempts: cb.stat.max([0, totalStoredAnsweredAttempts - filteredAttempts.length])
    };
};

export const computeMetrics = ({ attempts = [], sessions = [], filters = {} }) => {
    const normalizedFilters = normalizeDashboardFilters(filters);
    const supportedSessions = sessions.filter((session) => validSectionIds.has(getSessionSectionId(session)));
    const sessionIndex = buildSessionIndex(supportedSessions);
    const answeredAttempts = attempts.filter((attempt) => Boolean(attempt.selectedChoiceId)).map((attempt) => normalizeAttempt(attempt, sessionIndex)).filter((attempt) => validSectionIds.has(attempt.sectionId)).sort((a, b) => a.answeredAtMs - b.answeredAtMs);
    const filteredAttempts = filterAttempts(answeredAttempts, normalizedFilters);
    const minAttempts = normalizedFilters.minAttempts;
    const coveredTopicIds = new Set(answeredAttempts.flatMap((attempt) => attempt.topicIds ?? []).filter((topicId) => validTopicIds.has(topicId)));
    const filteredCoveredTopicIds = new Set(filteredAttempts.flatMap((attempt) => attempt.topicIds ?? []).filter((topicId) => validTopicIds.has(topicId)));
    const masteryTopicIds = normalizedFilters.sectionId === "all" ? validTopicIds : new Set(TOPICS.filter((topic) => topic.sectionId === normalizedFilters.sectionId).map((topic) => topic.id));
    const masteryCoveredTopicIds = new Set(filteredAttempts.flatMap((attempt) => attempt.topicIds ?? []).filter((topicId) => masteryTopicIds.has(topicId)));
    const masteryTopicCoverageRate = masteryTopicIds.size ? masteryCoveredTopicIds.size / masteryTopicIds.size : 0;
    const masteryTopicCoverageMultiplier = getTopicCoverageMultiplier(masteryTopicCoverageRate);
    const totalTopicCount = validTopicIds.size;
    const totalAttemptsStored = answeredAttempts.length;
    const totalQuestionsAnswered = filteredAttempts.length;
    const totalCorrect = filteredAttempts.filter((attempt) => attempt.isCorrect).length;
    const elapsedValues = filteredAttempts.map((attempt) => attempt.elapsedMs).filter(Number.isFinite);
    const totalStoredGeneratedQuestions = supportedSessions.reduce((total, session) => total + (session.generatedSession?.questions?.length ?? 0), 0);
    const completedSessions = supportedSessions.filter((session) => Boolean(session.completedAt));
    const timedAttempts = filteredAttempts.filter((attempt) => attempt.timingMode === "timed");
    const untimedAttempts = filteredAttempts.filter((attempt) => attempt.timingMode === "untimed");
    const timedAccuracy = timedAttempts.length ? accuracyFromRows(timedAttempts) : null;
    const untimedAccuracy = untimedAttempts.length ? accuracyFromRows(untimedAttempts) : null;
    const smoothedAccuracy = totalQuestionsAnswered ? (totalCorrect + DEFAULT_ALPHA) / (totalQuestionsAnswered + DEFAULT_ALPHA + DEFAULT_BETA) : 0;
    const averageElapsedMs = elapsedValues.length ? mean(elapsedValues) : 0;
    const averageTargetTimeMs = filteredAttempts.length ? mean(filteredAttempts.map((attempt) => attempt.targetTimeMs).filter(Number.isFinite)) : DEFAULT_TARGET_TIME_MS;
    const overallMastery = computeMastery({ correct: totalCorrect, attempts: totalQuestionsAnswered, averageTimeMs: averageElapsedMs, targetTimeMs: averageTargetTimeMs });
    const sectionTopicCoverage = buildSectionTopicCoverage(filteredAttempts);
    const bySectionRaw = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.sectionId, sectionId: attempt.sectionId }], { minAttempts });
    const bySection = applyTopicCoverageToSectionRows(bySectionRaw, sectionTopicCoverage).sort((a, b) => b.mastery - a.mastery || b.attempts - a.attempts);
    const byTopic = aggregateAttempts(filteredAttempts, (attempt) => attempt.topicIds.map((topicId) => ({ id: topicId, sectionId: attempt.sectionId })), { minAttempts }).sort((a, b) => b.priorityScore - a.priorityScore || b.attempts - a.attempts);
    const bySkill = aggregateAttempts(filteredAttempts, (attempt) => attempt.skillIds.map((skillId) => ({ id: skillId, sectionId: attempt.sectionId })), { minAttempts }).sort((a, b) => b.priorityScore - a.priorityScore || b.attempts - a.attempts);
    const byDifficulty = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.difficulty }], { minAttempts }).sort((a, b) => ["easy", "medium", "hard", "mixed"].indexOf(a.id) - ["easy", "medium", "hard", "mixed"].indexOf(b.id));
    const byTimingMode = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.timingMode }], { minAttempts });
    const byReviewMode = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.reviewMode }], { minAttempts });
    const topicSkillPairs = buildTopicSkillPairs(filteredAttempts, minAttempts);
    const topicSkillMatrix = buildTopicSkillMatrix(topicSkillPairs);
    const confidence = buildConfidenceAnalytics(filteredAttempts);
    const mistakes = buildMistakeTypeAnalytics(filteredAttempts);
    const sessionSummaries = buildSessionSummaries(filteredAttempts, supportedSessions, normalizedFilters);
    const modelUsage = buildModelUsage(sessionSummaries);
    const totalGeneratedQuestions = modelUsage.totalGeneratedQuestions;
    const totals = {
        totalAttemptsStored,
        totalQuestionsAnswered,
        totalCorrect,
        totalSessions: supportedSessions.length,
        totalCompletedSessions: completedSessions.length,
        totalGeneratedQuestions,
        totalStoredGeneratedQuestions,
        overallAccuracy: totalQuestionsAnswered ? totalCorrect / totalQuestionsAnswered : 0,
        smoothedAccuracy,
        mastery: round(overallMastery.mastery * masteryTopicCoverageMultiplier, 0.01),
        contentMastery: overallMastery.mastery,
        topicCoverageMultiplier: round(masteryTopicCoverageMultiplier, 0.01),
        masteryCoveredTopicCount: masteryCoveredTopicIds.size,
        masteryTotalTopicCount: masteryTopicIds.size,
        masteryTopicCoverageRate,
        averageElapsedMs,
        averageTargetTimeMs,
        completionRate: totalGeneratedQuestions ? totalQuestionsAnswered / totalGeneratedQuestions : 0,
        timedAccuracy,
        untimedAccuracy,
        timedUntimedGap: typeof timedAccuracy === "number" && typeof untimedAccuracy === "number" ? untimedAccuracy - timedAccuracy : null,
        confidenceCalibrationScore: confidence.calibrationScore,
        firstAttemptAt: filteredAttempts[0]?.answeredAt ?? null,
        latestAttemptAt: filteredAttempts[filteredAttempts.length - 1]?.answeredAt ?? null,
        recentSessionsCount: sessionSummaries.filter((session) => session.completed).length,
        coveredTopicCount: coveredTopicIds.size,
        filteredCoveredTopicCount: filteredCoveredTopicIds.size,
        totalTopicCount,
        topicCoverageRate: totalTopicCount ? coveredTopicIds.size / totalTopicCount : 0,
        filteredTopicCoverageRate: totalTopicCount ? filteredCoveredTopicIds.size / totalTopicCount : 0
    };
    const weakness = {
        topicSkillPairs,
        topicSkillMatrix,
        weakestTopics: byTopic.slice().sort((a, b) => b.priorityScore - a.priorityScore),
        weakestSkills: bySkill.slice().sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10),
        weakestSections: bySection.slice().sort((a, b) => b.priorityScore - a.priorityScore)
    };
    const timing = {
        byDifficulty,
        bySection: bySection.slice().sort((a, b) => b.timeRatio - a.timeRatio),
        slowestTopics: byTopic.slice().filter((row) => row.attempts >= minAttempts).sort((a, b) => b.timeRatio - a.timeRatio).slice(0, 10),
        pressureRows: [...bySection, ...byDifficulty].sort((a, b) => b.timeRatio - a.timeRatio).slice(0, 10)
    };
    const trends = {
        dailyAccuracy: buildDailyTrend(filteredAttempts),
        rollingAccuracy: buildRollingTrend(filteredAttempts),
        sessionAccuracy: sessionSummaries.filter((session) => session.attempts > 0).map((session) => ({
            id: session.id,
            label: session.completedAt ? getDateKey(dateMs(session.completedAt, session.createdAtMs)) : getDateKey(session.createdAtMs),
            attempts: session.attempts,
            correct: session.correct,
            accuracy: session.accuracy,
            averageElapsedMs: session.averageElapsedMs
        })).reverse()
    };
    const recent = {
        attempts: filteredAttempts.slice().sort((a, b) => b.answeredAtMs - a.answeredAtMs),
        misses: filteredAttempts.filter((attempt) => !attempt.isCorrect).sort((a, b) => b.answeredAtMs - a.answeredAtMs),
        sessions: sessionSummaries
    };
    const dataHealth = buildDataHealth(filteredAttempts, bySection, minAttempts, totalAttemptsStored);
    const insights = buildInsights({ filteredAttempts, totals, weakness, confidence, minAttempts });
    return {
        filters: normalizedFilters,
        allAnsweredAttempts: answeredAttempts,
        filteredAttempts,
        attempts: {
            answered: answeredAttempts,
            filtered: filteredAttempts
        },
        totals,
        rows: {
            bySection,
            byTopic,
            bySkill,
            byDifficulty,
            byTimingMode,
            byReviewMode
        },
        bySection,
        byTopic,
        bySkill,
        byDifficulty,
        confidence,
        confidenceGroups: confidence.groups,
        mistakes,
        timedAccuracy,
        untimedAccuracy,
        trends,
        timing,
        weakness,
        models: modelUsage,
        recent,
        insights,
        dataHealth,
        normalizedAttempts: filteredAttempts
    };
};

export const computeWeakTopicSkillPairs = (attempts, minAttempts = DEFAULT_MIN_ATTEMPTS) => {
    const metrics = computeMetrics({ attempts, sessions: [], filters: { minAttempts } });
    return metrics.weakness.topicSkillPairs.filter((pair) => pair.attempts >= minAttempts);
};
