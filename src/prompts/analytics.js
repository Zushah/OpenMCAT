import { SCIENCE_SKILLS, SECTIONS, TOPICS } from "../data/taxonomy.js";

const cb = Chalkboard;

const LIMITS = { trendPoints: 30, weakestTopics: 10, weakestSkills: 10, weakestPairs: 20, heatmapRows: 10, heatmapCellsPerRow: 4, recentMisses: 15, recentSessions: 15, insights: 5 };

const sectionsById = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
const skillsById = Object.fromEntries(SCIENCE_SKILLS.map((skill) => [skill.id, skill]));

const ROUND_RATIO = 0.0001;
const ROUND_SCORE = 0.01;
const ROUND_INTEGER = 1;

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

const nullableNumber = (value, fallback = null) => { if (value === null || value === undefined || value === "") return fallback; return safeNumber(value, fallback); };

const nullableRound = (value, places = ROUND_RATIO, fallback = null) => { const number = nullableNumber(value, fallback); return number === fallback ? fallback : round(number, places); };

const compactObject = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const limitList = (rows = [], limit, mapRow) => { const source = Array.isArray(rows) ? rows : []; return { totalRows: source.length, includedRows: source.slice(0, limit).map(mapRow), omittedRows: Math.max(0, source.length - limit) }; };

const sectionLabel = (sectionId) => sectionsById[sectionId]?.shortName ?? sectionId ?? null;

const topicLabel = (topicId) => topicsById[topicId]?.name ?? topicId ?? null;

const skillLabel = (skillId) => skillsById[skillId]?.shortName ?? skillsById[skillId]?.name ?? skillId ?? null;

const difficultyLabel = (difficultyId) => String(difficultyId ?? "n/a").replace(/^./, (character) => character.toUpperCase());

const labelForRow = (type, id) => {
    if (type === "section") return sectionLabel(id);
    if (type === "topic") return topicLabel(id);
    if (type === "skill") return skillLabel(id);
    if (type === "difficulty") return difficultyLabel(id);
    return id ?? null;
};

const sectionForTopic = (topicId, fallback = null) => topicsById[topicId]?.sectionId ?? fallback;

const formatTopicIds = (topicIds = []) => (Array.isArray(topicIds) ? topicIds : []).map((topicId) => compactObject({
    id: topicId,
    label: topicLabel(topicId),
    sectionId: sectionForTopic(topicId),
    sectionLabel: sectionLabel(sectionForTopic(topicId))
}));

const formatSkillIds = (skillIds = []) => (Array.isArray(skillIds) ? skillIds : []).map((skillId) => compactObject({
    id: skillId,
    label: skillLabel(skillId)
}));

const formatAggregateRow = (row = {}, type = "row") => compactObject({
    id: row.id,
    label: labelForRow(type, row.id),
    sectionId: row.sectionId,
    sectionLabel: sectionLabel(row.sectionId),
    attempts: nullableRound(row.attempts, ROUND_SCORE),
    weightedAttempts: nullableRound(row.weightedAttempts, ROUND_SCORE),
    rawQuestionCount: nullableNumber(row.rawCount ?? row.questionAttempts),
    correct: nullableRound(row.correct, ROUND_SCORE),
    accuracy: nullableRound(row.accuracy, ROUND_RATIO),
    smoothedAccuracy: nullableRound(row.smoothedAccuracy, ROUND_RATIO),
    mastery: nullableRound(row.mastery, ROUND_SCORE),
    contentMastery: nullableRound(row.contentMastery, ROUND_SCORE),
    priorityScore: nullableRound(row.priorityScore, ROUND_SCORE),
    averageElapsedMs: nullableRound(row.averageElapsedMs, ROUND_INTEGER),
    targetTimeMs: nullableRound(row.targetTimeMs, ROUND_INTEGER),
    timeRatio: nullableRound(row.timeRatio, ROUND_RATIO),
    timingPenalty: nullableRound(row.timingPenalty, ROUND_RATIO),
    volumeMultiplier: nullableRound(row.volumeMultiplier, ROUND_RATIO),
    confidenceAverage: nullableRound(row.confidenceAverage, ROUND_SCORE),
    trendDelta: nullableRound(row.trendDelta, ROUND_RATIO),
    signalStrength: row.signalStrength,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    topicCoverageRate: nullableRound(row.topicCoverageRate, ROUND_RATIO),
    coveredTopicCount: nullableNumber(row.coveredTopicCount),
    totalTopicCount: nullableNumber(row.totalTopicCount)
});

const formatTopicSkillPair = (pair = {}) => compactObject({
    id: pair.id,
    sectionId: pair.sectionId ?? sectionForTopic(pair.topicId),
    sectionLabel: sectionLabel(pair.sectionId ?? sectionForTopic(pair.topicId)),
    topicId: pair.topicId,
    topicLabel: topicLabel(pair.topicId),
    skillId: pair.skillId,
    skillLabel: skillLabel(pair.skillId),
    attempts: nullableRound(pair.attempts, ROUND_SCORE),
    weightedAttempts: nullableRound(pair.weightedAttempts, ROUND_SCORE),
    rawQuestionCount: nullableNumber(pair.rawCount ?? pair.questionAttempts),
    correct: nullableRound(pair.correct, ROUND_SCORE),
    accuracy: nullableRound(pair.accuracy, ROUND_RATIO),
    smoothedAccuracy: nullableRound(pair.smoothedAccuracy, ROUND_RATIO),
    mastery: nullableRound(pair.mastery, ROUND_SCORE),
    priorityScore: nullableRound(pair.priorityScore, ROUND_SCORE),
    averageElapsedMs: nullableRound(pair.averageElapsedMs, ROUND_INTEGER),
    targetTimeMs: nullableRound(pair.targetTimeMs, ROUND_INTEGER),
    timeRatio: nullableRound(pair.timeRatio, ROUND_RATIO),
    confidenceAverage: nullableRound(pair.confidenceAverage, ROUND_SCORE),
    trendDelta: nullableRound(pair.trendDelta, ROUND_RATIO),
    signalStrength: pair.signalStrength
});

const formatConfidenceRow = (row = {}) => compactObject({
    confidenceLevel: nullableNumber(row.level ?? row.confidence ?? row.id),
    attempts: nullableRound(row.attempts, ROUND_SCORE),
    correct: nullableRound(row.correct, ROUND_SCORE),
    accuracy: nullableRound(row.accuracy, ROUND_RATIO),
    smoothedAccuracy: nullableRound(row.smoothedAccuracy, ROUND_RATIO),
    expectedAccuracy: nullableRound(row.expectedAccuracy, ROUND_RATIO),
    calibrationGap: nullableRound(row.calibrationGap, ROUND_RATIO)
});

const formatTrendRow = (row = {}) => compactObject({
    label: row.label,
    date: row.date,
    attemptNumber: nullableNumber(row.attemptNumber ?? row.index),
    attempts: nullableRound(row.attempts, ROUND_SCORE),
    correct: nullableRound(row.correct, ROUND_SCORE),
    accuracy: nullableRound(row.accuracy, ROUND_RATIO),
    smoothedAccuracy: nullableRound(row.smoothedAccuracy, ROUND_RATIO),
    rollingAccuracy: nullableRound(row.rollingAccuracy, ROUND_RATIO),
    averageElapsedMs: nullableRound(row.averageElapsedMs, ROUND_INTEGER)
});

const formatRecentMiss = (attempt = {}) => compactObject({
    answeredAt: attempt.answeredAt,
    sectionId: attempt.sectionId,
    sectionLabel: sectionLabel(attempt.sectionId),
    topicIds: formatTopicIds(attempt.topicIds),
    skillIds: formatSkillIds(attempt.skillIds),
    difficulty: attempt.difficulty,
    timingMode: attempt.timingMode,
    reviewMode: attempt.reviewMode,
    confidence: nullableNumber(attempt.confidence),
    elapsedMs: nullableRound(attempt.elapsedMs, ROUND_INTEGER),
    targetTimeMs: nullableRound(attempt.targetTimeMs, ROUND_INTEGER),
    timeRatio: nullableRound(attempt.timeRatio, ROUND_RATIO)
});

const formatRecentSession = (session = {}) => compactObject({
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    completed: Boolean(session.completed),
    aiModel: session.aiModel,
    sectionId: session.sectionId,
    sectionLabel: sectionLabel(session.sectionId),
    timingMode: session.timingMode,
    reviewMode: session.reviewMode,
    generatedQuestionCount: nullableNumber(session.generatedQuestionCount ?? session.questionCount),
    answeredAttempts: nullableNumber(session.attempts),
    correct: nullableNumber(session.correct),
    accuracy: nullableRound(session.accuracy, ROUND_RATIO),
    averageElapsedMs: nullableRound(session.averageElapsedMs, ROUND_INTEGER),
    missedTopicIds: formatTopicIds(session.missedTopicIds ?? session.missedTopics)
});

const formatModelUsageRow = (row = {}) => compactObject({
    model: row.model,
    sessionCount: nullableNumber(row.sessionCount),
    generatedQuestionCount: nullableNumber(row.generatedQuestionCount),
    answeredAttempts: nullableNumber(row.answeredAttempts),
    correct: nullableNumber(row.correct),
    accuracy: nullableRound(row.accuracy, ROUND_RATIO)
});

const formatRecommendationConfig = (config = {}) => compactObject({
    sectionId: config.sectionId,
    sectionLabel: sectionLabel(config.sectionId),
    topicIds: formatTopicIds(config.topicIds),
    skillIds: formatSkillIds(config.skillIds),
    questionCount: nullableNumber(config.questionCount),
    timingMode: config.timingMode,
    secondsPerQuestion: nullableNumber(config.secondsPerQuestion),
    difficulty: config.difficulty,
    questionFormat: config.questionFormat,
    reviewMode: config.reviewMode
});

const formatRecommendation = (recommendation = null) => {
    if (!recommendation) return null;
    return compactObject({
        type: recommendation.type,
        headline: recommendation.headline,
        body: recommendation.body,
        rationale: Array.isArray(recommendation.rationale) ? recommendation.rationale : [],
        evidence: recommendation.evidence ? compactObject({
            attempts: nullableRound(recommendation.evidence.attempts, ROUND_SCORE),
            rawQuestionCount: nullableNumber(recommendation.evidence.rawCount),
            weightedAttempts: nullableRound(recommendation.evidence.weightedAttempts, ROUND_SCORE),
            accuracy: nullableRound(recommendation.evidence.accuracy, ROUND_RATIO),
            smoothedAccuracy: nullableRound(recommendation.evidence.smoothedAccuracy, ROUND_RATIO),
            mastery: nullableRound(recommendation.evidence.mastery, ROUND_SCORE),
            averageElapsedMs: nullableRound(recommendation.evidence.averageElapsedMs, ROUND_INTEGER),
            targetTimeMs: nullableRound(recommendation.evidence.targetTimeMs, ROUND_INTEGER),
            confidenceAverage: nullableRound(recommendation.evidence.confidenceAverage, ROUND_SCORE),
            signalStrength: recommendation.evidence.signalStrength,
            priorityScore: nullableRound(recommendation.evidence.priorityScore, ROUND_SCORE)
        }) : null,
        config: formatRecommendationConfig(recommendation.config),
        alternatives: (recommendation.alternatives ?? []).map((alternative) => compactObject({
            label: alternative.label,
            config: formatRecommendationConfig(alternative.config)
        }))
    });
};

const normalizeMatrixSections = (matrix) => {
    if (Array.isArray(matrix)) return matrix;
    if (!matrix || typeof matrix !== "object") return [];
    return [{
        sectionId: matrix.sectionIds?.length === 1 ? matrix.sectionIds[0] : "mixed",
        skills: (matrix.skillIds ?? []).map((skillId) => skillsById[skillId] ?? { id: skillId, shortName: skillId }),
        rows: matrix.rows ?? []
    }];
};

const formatHeatmap = (matrix) => {
    const rows = normalizeMatrixSections(matrix).flatMap((section) => (section.rows ?? []).map((row) => ({
        ...row,
        matrixSectionId: section.sectionId
    })));
    return limitList(rows, LIMITS.heatmapRows, (row) => compactObject({
        topicId: row.topicId,
        topicLabel: topicLabel(row.topicId),
        sectionId: row.sectionId ?? (row.matrixSectionId !== "mixed" ? row.matrixSectionId : sectionForTopic(row.topicId)),
        sectionLabel: sectionLabel(row.sectionId ?? (row.matrixSectionId !== "mixed" ? row.matrixSectionId : sectionForTopic(row.topicId))),
        maxPriorityScore: nullableRound(row.maxPriorityScore ?? row.worstPriority, ROUND_SCORE),
        attempts: nullableRound(row.attempts ?? row.totalWeightedAttempts, ROUND_SCORE),
        topCells: (row.cells ?? []).slice(0, LIMITS.heatmapCellsPerRow).map(formatTopicSkillPair),
        omittedCells: Math.max(0, (row.cells ?? []).length - LIMITS.heatmapCellsPerRow)
    }));
};

const buildAnalyticsPayload = ({ metrics = {}, recommendation = null } = {}) => {
    const totals = metrics.totals ?? {};
    const confidence = metrics.confidence ?? {};
    const trends = metrics.trends ?? {};
    const rows = metrics.rows ?? {};
    const weakness = metrics.weakness ?? {};
    const timing = metrics.timing ?? {};
    const recent = metrics.recent ?? {};
    return {
        generatedAt: new Date().toISOString(),
        activeFilters: metrics.filters ?? {},
        rowLimits: LIMITS,
        dataHealth: compactObject({
            ...(metrics.dataHealth ?? {}),
            sectionsWithLowSignal: (metrics.dataHealth?.sectionsWithLowSignal ?? []).map((sectionId) => ({ id: sectionId, label: sectionLabel(sectionId) })),
            emptySections: (metrics.dataHealth?.emptySections ?? []).map((sectionId) => ({ id: sectionId, label: sectionLabel(sectionId) }))
        }),
        summaryCards: compactObject({
            questionsAnswered: nullableNumber(totals.totalQuestionsAnswered),
            correct: nullableNumber(totals.totalCorrect),
            overallAccuracy: nullableRound(totals.overallAccuracy, ROUND_RATIO),
            smoothedAccuracy: nullableRound(totals.smoothedAccuracy, ROUND_RATIO),
            masteryEstimate: nullableRound(totals.mastery, ROUND_SCORE),
            contentMasteryBeforeCoverageAdjustment: nullableRound(totals.contentMastery, ROUND_SCORE),
            topicCoverageMultiplier: nullableRound(totals.topicCoverageMultiplier, ROUND_RATIO),
            averageElapsedMs: nullableRound(totals.averageElapsedMs, ROUND_INTEGER),
            averageTargetTimeMs: nullableRound(totals.averageTargetTimeMs, ROUND_INTEGER),
            completionRate: nullableRound(totals.completionRate, ROUND_RATIO),
            completedSessions: nullableNumber(totals.totalCompletedSessions),
            timedAccuracy: nullableRound(totals.timedAccuracy, ROUND_RATIO),
            untimedAccuracy: nullableRound(totals.untimedAccuracy, ROUND_RATIO),
            timedUntimedGap: nullableRound(totals.timedUntimedGap, ROUND_RATIO),
            confidenceCalibrationScore: nullableRound(totals.confidenceCalibrationScore, ROUND_SCORE),
            attemptsWithoutConfidence: nullableNumber(confidence.noConfidenceCount),
            topicCoverageRate: nullableRound(totals.topicCoverageRate, ROUND_RATIO),
            coveredTopicCount: nullableNumber(totals.coveredTopicCount),
            totalTopicCount: nullableNumber(totals.totalTopicCount),
            filteredCoveredTopicCount: nullableNumber(totals.filteredCoveredTopicCount),
            filteredTopicCoverageRate: nullableRound(totals.filteredTopicCoverageRate, ROUND_RATIO),
            firstAttemptAt: totals.firstAttemptAt,
            latestAttemptAt: totals.latestAttemptAt,
            totalAttemptsStored: nullableNumber(totals.totalAttemptsStored),
            filteredOutAttempts: nullableNumber(metrics.dataHealth?.filteredOutAttempts)
        }),
        recommendedNextDrill: formatRecommendation(recommendation),
        insights: limitList(metrics.insights ?? [], LIMITS.insights, (insight) => insight),
        chartsAndTables: {
            accuracyTrend: {
                rollingAccuracy: limitList((trends.rollingAccuracy ?? []).slice().reverse(), LIMITS.trendPoints, formatTrendRow),
                dailyAccuracy: limitList((trends.dailyAccuracy ?? []).slice().reverse(), LIMITS.trendPoints, formatTrendRow),
                sessionAccuracy: limitList((trends.sessionAccuracy ?? []).slice().reverse(), LIMITS.trendPoints, formatTrendRow)
            },
            sectionMastery: (rows.bySection ?? []).map((row) => formatAggregateRow(row, "section")),
            aiModelUsage: {
                totalModels: nullableNumber(metrics.models?.totalModels),
                totalGeneratedQuestions: nullableNumber(metrics.models?.totalGeneratedQuestions),
                topModel: metrics.models?.topModel ? formatModelUsageRow(metrics.models.topModel) : null,
                rows: (metrics.models?.rows ?? []).map(formatModelUsageRow)
            },
            topicWeaknessPriority: limitList(weakness.weakestTopics ?? rows.byTopic, LIMITS.weakestTopics, (row) => formatAggregateRow(row, "topic")),
            skillPerformance: (rows.bySkill ?? []).map((row) => formatAggregateRow(row, "skill")),
            confidenceCalibration: {
                calibrationScore: nullableRound(confidence.calibrationScore, ROUND_SCORE),
                overconfidence: nullableRound(confidence.overconfidence, ROUND_RATIO),
                underconfidence: nullableRound(confidence.underconfidence, ROUND_RATIO),
                noConfidenceCount: nullableNumber(confidence.noConfidenceCount),
                groups: (confidence.groups ?? []).map(formatConfidenceRow)
            },
            timingAndAccuracyByDifficulty: (rows.byDifficulty ?? timing.byDifficulty ?? []).map((row) => formatAggregateRow(row, "difficulty")),
            topicSkillHeatmap: formatHeatmap(weakness.topicSkillMatrix),
            weakestTopicSkillPairs: limitList(weakness.topicSkillPairs ?? [], LIMITS.weakestPairs, formatTopicSkillPair),
            timingPressureRows: limitList(timing.pressureRows ?? [], LIMITS.weakestTopics, (row) => formatAggregateRow(row, row.id && sectionsById[row.id] ? "section" : "difficulty")),
            recentMissedQuestions: limitList(recent.misses ?? [], LIMITS.recentMisses, formatRecentMiss),
            recentSessions: limitList(recent.sessions ?? [], LIMITS.recentSessions, formatRecentSession)
        }
    };
};

const FIELD_DESCRIPTIONS = {
    attempts: "Weighted attempts contributing to a row. Topic and skill rows may split one question across multiple tagged topics or skills.",
    rawQuestionCount: "Unweighted number of attempted questions that touched the row, when available.",
    accuracy: "Raw correct / attempts as a decimal from 0 to 1.",
    smoothedAccuracy: "Bayesian-smoothed accuracy using OpenMCAT's alpha/beta prior so low-volume rows are less extreme.",
    mastery: "OpenMCAT 0-100 mastery estimate using smoothed accuracy, practice volume, timing penalty, and sometimes topic coverage.",
    priorityScore: "OpenMCAT 0-100 weakness priority. Higher means more drill-worthy; it combines accuracy weakness, timing pressure, confidence mismatch, and volume.",
    averageElapsedMs: "Average time per question in milliseconds.",
    targetTimeMs: "OpenMCAT target time for the row in milliseconds. Current default is generally 95 seconds per science question.",
    timeRatio: "averageElapsedMs / targetTimeMs. Above 1.0 means slower than target; above about 1.12 suggests visible timing pressure.",
    timedUntimedGap: "untimedAccuracy - timedAccuracy. Positive values suggest the student performs better without time pressure.",
    confidenceCalibrationScore: "OpenMCAT 0-100 score for how closely confidence ratings match observed accuracy. Higher is better calibrated.",
    calibrationGap: "actual accuracy - expected accuracy for that confidence level. Negative gaps suggest overconfidence; positive gaps suggest underconfidence or conservative confidence.",
    signalStrength: "stable means enough attempts under the active min-attempt setting; early means useful but low sample; none means absent.",
    topicCoverageMultiplier: "Coverage adjustment applied to mastery so narrow practice does not look like broad mastery.",
    filteredOutAttempts: "Answered attempts stored locally but excluded by the active dashboard filters.",
    aiModelUsage: "Generated question counts grouped by recorded session AI model metadata when available."
};

export const compileAnalyticsPrompt = ({ metrics, recommendation } = {}) => {
    return `You are an expert MCAT tutor and learning-analytics coach. Analyze the student's OpenMCAT dashboard data and turn it into a helpful and practical study evaluation.

About OpenMCAT:
- OpenMCAT is an independent, browser-only, open-source MCAT practice tool. It is not affiliated with or endorsed by the AAMC.
- OpenMCAT practice questions come from pregenerated question banks or the copy-paste generation pipeline, then are answered in OpenMCAT. Analytics are computed locally from the user's practice history.
- OpenMCAT is not a score predictor. Do not estimate an official MCAT score or percentile from these data.
- OpenMCAT currently covers C/P, B/B, and P/S science sections plus the four SIRS. OpenMCAT currently does not cover CARS at all.
- OpenMCAT data below intentionally excludes raw question stems, answer choices, explanations, and session titles. Analyze aggregate performance patterns only.

Interpretation rules:
- Treat low sample sizes as tentative. Use signalStrength, minAttemptsForStableSignal, and total attempts to qualify confidence.
- Distinguish raw accuracy, smoothed accuracy, mastery, and priority score. They are related but not interchangeable.
- Higher priorityScore means more drill-worthy, not necessarily more important to the MCAT overall.
- Timing metrics are based on elapsed time recorded in OpenMCAT. timeRatio > 1 means slower than target.
- Confidence calibration should be framed as a behavior pattern, not a personality judgment.
- If filters exclude many attempts, explain that the active slice may not reflect the student's full history.
- Give practical next steps, not generic motivation.

Technical field descriptions:
${JSON.stringify(FIELD_DESCRIPTIONS, null, 2)}

OpenMCAT analytics payload:
${JSON.stringify(buildAnalyticsPayload({ metrics, recommendation }), null, 2)}

Your task:
1. Start with a concise executive summary of the student's most important study patterns.
2. Analyze content gaps, skill vulnerabilities, timing pressure, confidence calibration, topic coverage, and data reliability.
3. Explain what the recommended next drill is trying to accomplish, and whether you agree with it based on the evidence.
4. Provide a prioritized study plan for the next three-to-five OpenMCAT sessions, including what to drill, whether to use timed or untimed mode, and what to focus the review on after each session.
5. Call out any metrics that are too low-sample to trust yet.
6. Do not claim official AAMC alignment or official score prediction. Make uncertainty explicit when the data are thin.
7. Speak to the student directly, rather than referring to "the student" or "the user" in the third person.`;
};
