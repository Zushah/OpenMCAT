import { SECTIONS, TOPICS } from "../data/taxonomy.js";
import { computeMastery } from "./mastery.js";

const cb = Chalkboard;

const DEFAULT_ALPHA = 2;
const DEFAULT_BETA = 2;
const DEFAULT_MIN_ATTEMPTS = 3;
const DEFAULT_TARGET_TIME_MS = 95000;
const CARS_TARGET_TIME_MS = 110000;
const DAY_MS = 24 * 60 * 60 * 1000;
const validTopicIds = new Set(TOPICS.map((topic) => topic.id));

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

const round = (value, places = 0.01) => cb.numb.roundTo(safeNumber(value), places);

const constrain = (value, min, max) => cb.numb.constrain(safeNumber(value), [min, max]);

const sum = (values) => values.length ? cb.stat.sum(values) : 0;

const mean = (values) => values.length ? cb.stat.mean(values) : 0;

const dateMs = (value, fallback = 0) => { const parsed = new Date(value ?? "").getTime(); return Number.isFinite(parsed) ? parsed : fallback; };

const toIsoOrNull = (value) => { const parsed = dateMs(value, NaN); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; };

const getDateKey = (ms) => { if (!Number.isFinite(ms) || ms <= 0) return "unknown"; const date = new Date(ms); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${date.getFullYear()}-${month}-${day}`; };

const uniqueValues = (values) => Array.from(new Set((values ?? []).filter(Boolean)));

const accuracyFromRows = (rows) => {
    if (!rows.length) return 0;
    return rows.filter((row) => row.isCorrect).length / rows.length;
};

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

const buildFlagIndex = (flags = []) => {
    const index = new Map();
    flags.forEach((flag) => {
        if (!flag.sessionId || !flag.questionId) return;
        const key = `${flag.sessionId}__${flag.questionId}`;
        const previous = index.get(key);
        const currentMs = dateMs(flag.createdAt, 0);
        const previousMs = dateMs(previous?.createdAt, 0);
        if (!previous || currentMs >= previousMs) index.set(key, flag);
    });
    return index;
};

const getTargetTimeMs = ({ sectionId, timingMode, config, attempt }) => {
    const configuredSeconds = safeNumber(attempt.secondsPerQuestion, safeNumber(config?.secondsPerQuestion, 0));
    if (configuredSeconds > 0) return configuredSeconds * 1000;
    if (sectionId === "cars") return CARS_TARGET_TIME_MS;
    if (timingMode === "timed") return DEFAULT_TARGET_TIME_MS;
    return sectionId === "cars" ? CARS_TARGET_TIME_MS : DEFAULT_TARGET_TIME_MS;
};

const normalizeAttempt = (attempt, sessionIndex, flagIndex) => {
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
    const flagKey = `${attempt.sessionId}__${attempt.questionId}`;
    const persistedFlag = flagIndex.get(flagKey);
    const hasAttemptFlag = Object.prototype.hasOwnProperty.call(attempt, "flagged");
    const flagged = hasAttemptFlag ? Boolean(attempt.flagged) : Boolean(persistedFlag);
    return {
        ...attempt,
        sectionId,
        topicIds,
        skillIds,
        difficulty: attempt.difficulty ?? question?.estimatedDifficulty ?? generatedSession.difficulty ?? config.difficulty ?? "mixed",
        timingMode,
        reviewMode,
        isTimed: timingMode === "timed",
        isCorrect: Boolean(attempt.isCorrect),
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
        generatedQuestionCount: session?.generatedSession?.questions?.length ?? 0,
        flagged,
        flagReason: attempt.flagReason ?? persistedFlag?.reason ?? null
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
    flaggedWeight: 0,
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
    if (attempt.flagged) record.flaggedWeight += weight;
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
        const midpoint = cb.numb.roundTo((sortedTrendRows.length - 0.5) / 2, 1);
        const older = sortedTrendRows.slice(0, midpoint);
        const newer = sortedTrendRows.slice(midpoint);
        trendDelta = accuracyFromRows(newer) - accuracyFromRows(older);
    }
    const timeRatio = targetTimeMs ? averageElapsedMs / targetTimeMs : 0;
    const accuracyWeakness = (1 - smoothedAccuracy) * 64;
    const timingWeakness = constrain((timeRatio - 1) * 24, 0, 18);
    const flagWeakness = (attempts ? record.flaggedWeight / attempts : 0) * 8;
    const confidenceAverage = record.confidenceWeight ? record.confidenceWeightedTotal / record.confidenceWeight : null;
    const confidenceWeakness = confidenceAverage && confidenceAverage >= 4 && attempts && correct / attempts < 0.7 ? 5 : 0;
    const volumeFactor = constrain(cb.real.sqrt(attempts / minAttempts), 0.4, 1.15);
    const priorityScore = constrain((accuracyWeakness + timingWeakness + flagWeakness + confidenceWeakness) * volumeFactor, 0, 100);
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
        flaggedCount: round(record.flaggedWeight, 0.01),
        flaggedRate: attempts ? record.flaggedWeight / attempts : 0,
        confidenceAverage,
        firstSeenAt: record.firstSeenAtMs ? new Date(record.firstSeenAtMs).toISOString() : null,
        lastSeenAt: record.lastSeenAtMs ? new Date(record.lastSeenAtMs).toISOString() : null,
        lastSeenAtMs: record.lastSeenAtMs ?? 0,
        trendDelta,
        priorityScore: round(priorityScore, 0.1),
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
        return {
            id: session.id,
            title: session.generatedSession?.session?.title ?? "Practice session",
            createdAt: toIsoOrNull(session.createdAt),
            completedAt: toIsoOrNull(session.completedAt),
            createdAtMs,
            completedAtMs,
            sectionId: session.generatedSession?.session?.sectionId ?? session.config?.sectionId ?? rows[0]?.sectionId ?? "unknown",
            timingMode: session.config?.timingMode ?? rows[0]?.timingMode ?? "untimed",
            reviewMode: session.config?.reviewMode ?? rows[0]?.reviewMode ?? "immediate",
            generatedQuestionCount: session.generatedSession?.questions?.length ?? 0,
            questionCount: session.generatedSession?.questions?.length ?? 0,
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

export const computeMetrics = ({ attempts = [], sessions = [], flags = [], filters = {} }) => {
    const normalizedFilters = normalizeDashboardFilters(filters);
    const sessionIndex = buildSessionIndex(sessions);
    const flagIndex = buildFlagIndex(flags);
    const answeredAttempts = attempts.filter((attempt) => Boolean(attempt.selectedChoiceId)).map((attempt) => normalizeAttempt(attempt, sessionIndex, flagIndex)).sort((a, b) => a.answeredAtMs - b.answeredAtMs);
    const filteredAttempts = filterAttempts(answeredAttempts, normalizedFilters);
    const minAttempts = normalizedFilters.minAttempts;
    const coveredTopicIds = new Set(answeredAttempts.flatMap((attempt) => attempt.topicIds ?? []).filter((topicId) => validTopicIds.has(topicId)));
    const filteredCoveredTopicIds = new Set(filteredAttempts.flatMap((attempt) => attempt.topicIds ?? []).filter((topicId) => validTopicIds.has(topicId)));
    const totalTopicCount = validTopicIds.size;
    const totalAttemptsStored = answeredAttempts.length;
    const totalQuestionsAnswered = filteredAttempts.length;
    const totalCorrect = filteredAttempts.filter((attempt) => attempt.isCorrect).length;
    const elapsedValues = filteredAttempts.map((attempt) => attempt.elapsedMs).filter(Number.isFinite);
    const totalStoredGeneratedQuestions = sessions.reduce((total, session) => total + (session.generatedSession?.questions?.length ?? 0), 0);
    const completedSessions = sessions.filter((session) => Boolean(session.completedAt));
    const activeFlagKeys = new Set(filteredAttempts.filter((attempt) => attempt.flagged).map((attempt) => `${attempt.sessionId}__${attempt.questionId}`));
    const timedAttempts = filteredAttempts.filter((attempt) => attempt.timingMode === "timed");
    const untimedAttempts = filteredAttempts.filter((attempt) => attempt.timingMode === "untimed");
    const timedAccuracy = timedAttempts.length ? accuracyFromRows(timedAttempts) : null;
    const untimedAccuracy = untimedAttempts.length ? accuracyFromRows(untimedAttempts) : null;
    const smoothedAccuracy = totalQuestionsAnswered ? (totalCorrect + DEFAULT_ALPHA) / (totalQuestionsAnswered + DEFAULT_ALPHA + DEFAULT_BETA) : 0;
    const averageElapsedMs = elapsedValues.length ? mean(elapsedValues) : 0;
    const averageTargetTimeMs = filteredAttempts.length ? mean(filteredAttempts.map((attempt) => attempt.targetTimeMs).filter(Number.isFinite)) : DEFAULT_TARGET_TIME_MS;
    const overallMastery = computeMastery({ correct: totalCorrect, attempts: totalQuestionsAnswered, averageTimeMs: averageElapsedMs, targetTimeMs: averageTargetTimeMs });
    const bySection = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.sectionId, sectionId: attempt.sectionId }], { minAttempts }).sort((a, b) => b.mastery - a.mastery || b.attempts - a.attempts);
    const byTopic = aggregateAttempts(filteredAttempts, (attempt) => attempt.topicIds.map((topicId) => ({ id: topicId, sectionId: attempt.sectionId })), { minAttempts }).sort((a, b) => b.priorityScore - a.priorityScore || b.attempts - a.attempts);
    const bySkill = aggregateAttempts(filteredAttempts, (attempt) => attempt.skillIds.map((skillId) => ({ id: skillId, sectionId: attempt.sectionId })), { minAttempts }).sort((a, b) => b.priorityScore - a.priorityScore || b.attempts - a.attempts);
    const byDifficulty = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.difficulty }], { minAttempts }).sort((a, b) => ["easy", "medium", "hard", "mixed"].indexOf(a.id) - ["easy", "medium", "hard", "mixed"].indexOf(b.id));
    const byTimingMode = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.timingMode }], { minAttempts });
    const byReviewMode = aggregateAttempts(filteredAttempts, (attempt) => [{ id: attempt.reviewMode }], { minAttempts });
    const topicSkillPairs = buildTopicSkillPairs(filteredAttempts, minAttempts);
    const topicSkillMatrix = buildTopicSkillMatrix(topicSkillPairs);
    const confidence = buildConfidenceAnalytics(filteredAttempts);
    const sessionSummaries = buildSessionSummaries(filteredAttempts, sessions, normalizedFilters);
    const totalGeneratedQuestions = sessionSummaries.reduce((total, session) => total + (session.generatedQuestionCount || 0), 0);
    const totals = {
        totalAttemptsStored,
        totalQuestionsAnswered,
        totalCorrect,
        totalSessions: sessions.length,
        totalCompletedSessions: completedSessions.length,
        totalGeneratedQuestions,
        totalStoredGeneratedQuestions,
        overallAccuracy: totalQuestionsAnswered ? totalCorrect / totalQuestionsAnswered : 0,
        smoothedAccuracy,
        mastery: overallMastery.mastery,
        averageElapsedMs,
        averageTargetTimeMs,
        completionRate: totalGeneratedQuestions ? totalQuestionsAnswered / totalGeneratedQuestions : 0,
        activeFlagCount: activeFlagKeys.size,
        flaggedRate: totalQuestionsAnswered ? activeFlagKeys.size / totalQuestionsAnswered : 0,
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
        weakestTopics: byTopic.slice().sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 12),
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
        timedAccuracy,
        untimedAccuracy,
        trends,
        timing,
        weakness,
        recent,
        insights,
        dataHealth,
        normalizedAttempts: filteredAttempts
    };
};

export const computeWeakTopicSkillPairs = (attempts, minAttempts = DEFAULT_MIN_ATTEMPTS) => {
    const metrics = computeMetrics({ attempts, sessions: [], flags: [], filters: { minAttempts } });
    return metrics.weakness.topicSkillPairs.filter((pair) => pair.attempts >= minAttempts);
};
