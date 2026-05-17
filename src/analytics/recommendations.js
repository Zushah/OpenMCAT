import { getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";

const cb = Chalkboard;

const pct = (value) => `${cb.numb.roundTo((value || 0) * 100, 1)}%`;

const msToSeconds = (ms) => Number.isFinite(ms) ? cb.numb.roundTo(ms / 1000, 1) : null;

const getDefaultSectionId = (metrics) => {
    const filteredSection = metrics?.filters?.sectionId;
    if (filteredSection && filteredSection !== "all") return filteredSection;
    const weakestSection = metrics?.weakness?.weakestSections?.[0]?.id;
    if (weakestSection) return weakestSection;
    const emptySection = metrics?.dataHealth?.emptySections?.[0];
    if (emptySection) return emptySection;
    return "bb";
};

const getDefaultTopicIds = (sectionId, count = 2) => getTopicsBySection(sectionId).slice(0, count).map((topic) => topic.id);

const getDefaultSkillIds = (sectionId, count = 2) => getSkillsForSection(sectionId).slice(0, count).map((skill) => skill.id);

const getQuestionFormat = (sectionId) => sectionId === "cars" ? "cars_beta" : "mixed";

const getTargetSeconds = (sectionId) => sectionId === "cars" ? 110 : 95;

const getSectionLabel = (sectionsById, sectionId) => sectionsById?.[sectionId]?.shortName ?? sectionId ?? "section";

const getTopicLabel = (topicsById, topicId) => topicsById?.[topicId]?.name ?? topicId ?? "selected topic";

const getSkillLabel = (skillsById, skillId) => skillsById?.[skillId]?.shortName ?? skillsById?.[skillId]?.name ?? skillId ?? "selected skill";

const buildBaselineConfig = (sectionId, { timed = false, count = 8 } = {}) => ({
    sectionId,
    topicIds: getDefaultTopicIds(sectionId, sectionId === "cars" ? 5 : 2),
    skillIds: getDefaultSkillIds(sectionId, sectionId === "cars" ? 3 : 2),
    questionCount: count,
    timingMode: timed ? "timed" : "untimed",
    secondsPerQuestion: timed ? getTargetSeconds(sectionId) : null,
    difficulty: "medium",
    questionFormat: getQuestionFormat(sectionId),
    reviewMode: timed ? "later" : "immediate"
});

const hasTimingGap = (metrics) => Number.isFinite(metrics?.totals?.timedUntimedGap) && metrics.totals.timedUntimedGap > 0.1;

const hasOverconfidence = (metrics) => {
    const confidence = metrics?.confidence;
    if (Array.isArray(confidence?.overconfidence)) return confidence.overconfidence.some((row) => row.level >= 4 && row.attempts > 0);
    return Number.isFinite(confidence?.overconfidence) && confidence.overconfidence > 0.35;
};

const buildEvidence = (pair) => ({
    attempts: pair.attempts,
    rawCount: pair.rawCount,
    weightedAttempts: pair.weightedAttempts,
    accuracy: pair.accuracy,
    smoothedAccuracy: pair.smoothedAccuracy,
    mastery: pair.mastery,
    averageElapsedMs: pair.averageElapsedMs,
    targetTimeMs: pair.targetTimeMs,
    confidenceAverage: pair.confidenceAverage,
    flaggedRate: pair.flaggedRate,
    signalStrength: pair.signalStrength,
    priorityScore: pair.priorityScore
});

const getPairAttempts = (pair) => pair.rawCount ?? pair.attempts ?? pair.weightedAttempts ?? 0;

export const buildRecommendation = ({ topicsById, skillsById, sectionsById, metrics }) => {
    const totals = metrics?.totals ?? {};
    const sectionId = getDefaultSectionId(metrics);
    if (!totals.totalQuestionsAnswered) {
        const config = buildBaselineConfig(sectionId, { timed: false, count: 8 });
        return {
            type: "new_user",
            headline: "Recommended next drill",
            body: `Start with a medium ${getSectionLabel(sectionsById, sectionId)} baseline drill so the dashboard has enough local data to identify useful patterns.`,
            rationale: [
                "No answered questions match the current dashboard view yet.",
                "A short baseline drill gives the analytics model section, topic, skill, timing, and confidence data to work with."
            ],
            evidence: {
                attempts: 0,
                signalStrength: "none"
            },
            config,
            alternatives: [
                {
                    label: "Timed baseline",
                    config: buildBaselineConfig(sectionId, { timed: true, count: 10 })
                }
            ]
        };
    }
    const minAttempts = metrics?.filters?.minAttempts ?? 3;
    const pairs = metrics?.weakness?.topicSkillPairs ?? [];
    const stablePair = pairs.find((pair) => getPairAttempts(pair) >= minAttempts);
    const topPair = stablePair ?? pairs[0];
    if (!topPair) {
        const timed = hasTimingGap(metrics);
        const config = buildBaselineConfig(sectionId, { timed, count: timed ? 10 : 8 });
        return {
            type: "insufficient_pair_data",
            headline: "Recommended next drill",
            body: `Build more topic-skill signal with a medium ${getSectionLabel(sectionsById, sectionId)} drill.`,
            rationale: [
                `The current view has ${totals.totalQuestionsAnswered} answered question${totals.totalQuestionsAnswered === 1 ? "" : "s"}, but not enough repeated topic-skill pairs yet.`,
                timed ? "Timed accuracy is lagging untimed accuracy, so the next baseline should include time pressure." : "Untimed review is appropriate while the dashboard is still building signal."
            ],
            evidence: {
                attempts: totals.totalQuestionsAnswered,
                signalStrength: "early"
            },
            config,
            alternatives: []
        };
    }
    const topic = topicsById?.[topPair.topicId];
    const targetSectionId = topPair.sectionId || topic?.sectionId || sectionId;
    const timingGap = hasTimingGap(metrics);
    const overconfidence = hasOverconfidence(metrics);
    const slowPair = topPair.timeRatio > 1.15;
    const timed = timingGap || slowPair;
    const reviewMode = timed && !overconfidence ? "later" : "immediate";
    const questionCount = timed ? 8 : 6;
    const config = {
        sectionId: targetSectionId,
        topicIds: [topPair.topicId],
        skillIds: [topPair.skillId],
        questionCount,
        timingMode: timed ? "timed" : "untimed",
        secondsPerQuestion: timed ? getTargetSeconds(targetSectionId) : null,
        difficulty: "medium",
        questionFormat: getQuestionFormat(targetSectionId),
        reviewMode
    };
    const topicLabel = getTopicLabel(topicsById, topPair.topicId);
    const skillLabel = getSkillLabel(skillsById, topPair.skillId);
    const sectionLabel = getSectionLabel(sectionsById, targetSectionId);
    const avgSeconds = msToSeconds(topPair.averageElapsedMs);
    const targetSeconds = msToSeconds(topPair.targetTimeMs);
    const pairAttempts = getPairAttempts(topPair);
    const rationale = [
        `${topicLabel} with ${skillLabel} is the highest-priority topic-skill target in the current dashboard view.`,
        `${cb.numb.roundTo(pairAttempts, pairAttempts % 1 ? 0.1 : 1)} related attempt${pairAttempts === 1 ? "" : "s"}, ${pct(topPair.accuracy)} raw accuracy, ${pct(topPair.smoothedAccuracy)} smoothed accuracy, and ${cb.numb.roundTo(topPair.mastery ?? 1, 0.1)} mastery.`
    ];
    if (avgSeconds && targetSeconds && avgSeconds > targetSeconds) rationale.push(`Average time is ${avgSeconds}s against a ${targetSeconds}s target.`);
    if (timingGap) rationale.push("Timed accuracy is materially lower than untimed accuracy in the current view.");
    if (overconfidence) rationale.push("Confidence calibration suggests reviewing explanations before increasing speed.");
    if (topPair.signalStrength === "early") rationale.push("This is still an early signal, so the drill is short and targeted rather than definitive.");
    return {
        type: "weak_pair",
        headline: "Recommended next drill",
        body: `Drill ${sectionLabel}: ${topicLabel} plus ${skillLabel}. Use ${questionCount} ${timed ? "timed" : "untimed"} medium questions with ${reviewMode === "later" ? "review after the set" : "immediate explanations"}.`,
        rationale,
        evidence: buildEvidence(topPair),
        config,
        alternatives: pairs.slice(1, 4).map((pair) => ({
            label: `${getTopicLabel(topicsById, pair.topicId)} / ${getSkillLabel(skillsById, pair.skillId)}`,
            config: {
                sectionId: pair.sectionId || topicsById?.[pair.topicId]?.sectionId || targetSectionId,
                topicIds: [pair.topicId],
                skillIds: [pair.skillId],
                questionCount: 6,
                timingMode: "untimed",
                secondsPerQuestion: null,
                difficulty: "medium",
                questionFormat: getQuestionFormat(pair.sectionId || topicsById?.[pair.topicId]?.sectionId || targetSectionId),
                reviewMode: "immediate"
            }
        }))
    };
};
