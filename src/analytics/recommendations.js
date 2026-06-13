import { MISTAKE_TYPES, getMistakeTypeLabel, normalizeMistakeTypeIds } from "../data/mistakes.js";
import { getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";

const cb = Chalkboard;

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

const pct = (value) => `${round((value || 0) * 100, 0.1)}%`;

const msToSeconds = (ms) => Number.isFinite(ms) ? round(ms / 1000, 0.1) : null;

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

const getQuestionFormat = () => "mixed";

const getTargetSeconds = () => 95;

const getSectionLabel = (sectionsById, sectionId) => sectionsById?.[sectionId]?.shortName ?? sectionId ?? "section";

const getTopicLabel = (topicsById, topicId) => topicsById?.[topicId]?.name ?? topicId ?? "selected topic";

const getSkillLabel = (skillsById, skillId) => skillsById?.[skillId]?.shortName ?? skillsById?.[skillId]?.name ?? skillId ?? "selected skill";

const getPairAttempts = (pair) => pair.rawCount ?? pair.attempts ?? pair.weightedAttempts ?? 0;

const clampQuestionCount = (value, min = 5, max = 20) => Math.round(cb.numb.constrain(safeNumber(value, min), [min, max]));

const NON_DRILL_DRIVER_MISTAKE_IDS = new Set(["flawed_question", "other"]);
const MIN_MISTAKE_FOCUS_TAGGED_ATTEMPTS = 2;

const MISTAKE_DRILL_STRATEGIES = {
    content_gap: {
        label: "Content-first review",
        rationale: "Prioritize concept repair before speed.",
        reviewFocus: "Name the missing rule, equation, definition, or relationship before moving to the next question.",
        configPatch: { timingMode: "untimed", secondsPerQuestion: null, reviewMode: "immediate" },
        applyConfig: (config) => ({ ...config, timingMode: "untimed", secondsPerQuestion: null, reviewMode: "immediate" })
    },
    stem_misread: {
        label: "Stem precision",
        rationale: "Slow down on task wording, qualifiers, and what the question is actually asking.",
        reviewFocus: "Mark the exact stem phrase that changed the task, then restate the question in one sentence.",
        configPatch: { reviewMode: "immediate" },
        applyConfig: (config) => ({ ...config, reviewMode: "immediate" })
    },
    choice_misread: {
        label: "Answer-choice discrimination",
        rationale: "Review why tempting wrong choices looked attractive and why the credited choice is narrower or better supported.",
        reviewFocus: "Compare the selected answer with the correct answer and identify the wording that made the wrong choice tempting.",
        configPatch: { reviewMode: "immediate" },
        applyConfig: (config) => ({ ...config, reviewMode: "immediate" })
    },
    passage_misread: {
        label: "Passage handling",
        rationale: "Use passage-based practice and review where the passage changed the answer.",
        reviewFocus: "Before checking explanations, identify the passage sentence, phrase, table, or figure that should have controlled the answer.",
        configPatch: { questionFormat: "passage", reviewMode: "immediate" },
        applyConfig: (config) => ({ ...config, questionFormat: "passage", reviewMode: "immediate" })
    },
    data_misinterpretation: {
        label: "Data interpretation",
        rationale: "Emphasize table, figure, trend, and comparison reasoning.",
        reviewFocus: "State the axes, units, trend, comparison, and experimental condition before evaluating answer choices.",
        configPatch: { questionFormat: "passage", addSkillIds: ["sirs_4"] },
        applyConfig: (config) => ({ ...config, questionFormat: "passage", skillIds: Array.from(new Set([...(config.skillIds ?? []), "sirs_4"])) })
    },
    time_pressure: {
        label: "Timed execution",
        rationale: "Practice under realistic pacing and review after the set.",
        reviewFocus: "After the set, identify whether time was lost reading, calculating, choosing, or second-guessing.",
        configPatch: { timingMode: "timed", secondsPerQuestion: getTargetSeconds(), reviewMode: "later" },
        questionCountAdjustment: 1,
        applyConfig: (config) => ({ ...config, timingMode: "timed", secondsPerQuestion: getTargetSeconds(config.sectionId), reviewMode: "later", questionCount: clampQuestionCount(safeNumber(config.questionCount, 8) + 1, 5, 15) })
    },
    math_error: {
        label: "Calculation discipline",
        rationale: "Review setup, units, substitutions, and magnitude estimates.",
        reviewFocus: "Write the equation, substitution, units, and final magnitude estimate before reading the full explanation.",
        configPatch: { reviewMode: "immediate" },
        applyConfig: (config) => ({ ...config, reviewMode: "immediate" })
    },
    reasoning_error: {
        label: "Reasoning repair",
        rationale: "Focus on why the selected explanation chain failed.",
        reviewFocus: "Write the incorrect reasoning chain, then replace the first unsupported step with the evidence or concept that fixes it.",
        configPatch: { reviewMode: "immediate" },
        applyConfig: (config) => ({ ...config, reviewMode: "immediate" })
    },
    changed_from_correct: {
        label: "Answer-change discipline",
        rationale: "Review when second-guessing helped versus hurt.",
        reviewFocus: "Separate evidence-based answer changes from anxiety-based changes, and note what would have justified keeping the first answer.",
        configPatch: { reviewMode: "immediate" },
        questionCountAdjustment: -1,
        applyConfig: (config) => ({ ...config, reviewMode: "immediate", questionCount: clampQuestionCount(safeNumber(config.questionCount, 6) - 1, 5, 20) })
    }
};

const buildBaselineConfig = (sectionId, { timed = false, count = 8 } = {}) => ({
    sectionId,
    topicIds: getDefaultTopicIds(sectionId, 2),
    skillIds: getDefaultSkillIds(sectionId, 2),
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
    signalStrength: pair.signalStrength,
    priorityScore: pair.priorityScore
});

const calculateBaselineQuestionCount = (metrics, timed = false) => {
    const answered = safeNumber(metrics?.totals?.totalQuestionsAnswered, 0);
    const experienceBump = answered >= 80 ? 2 : answered >= 30 ? 1 : 0;
    return clampQuestionCount((timed ? 9 : 7) + experienceBump, 5, timed ? 15 : 20);
};

const calculateTargetedQuestionCount = ({ pair, metrics, timed = false }) => {
    const minAttempts = safeNumber(metrics?.filters?.minAttempts, 3);
    const pairAttempts = getPairAttempts(pair);
    const priority = safeNumber(pair?.priorityScore, 0);
    const accuracy = Number.isFinite(pair?.smoothedAccuracy) ? pair.smoothedAccuracy : safeNumber(pair?.accuracy, 0.5);
    const mastery = safeNumber(pair?.mastery, 50);
    const timeRatio = safeNumber(pair?.timeRatio, 1);
    let count = timed ? 6 : 5;
    count += priority >= 70 ? 4 : priority >= 55 ? 3 : priority >= 40 ? 2 : 1;
    count += accuracy < 0.45 ? 2 : accuracy < 0.6 ? 1 : 0;
    count += mastery < 45 ? 2 : mastery < 65 ? 1 : 0;
    count += timeRatio > 1.25 ? 1 : 0;
    count += pairAttempts >= minAttempts * 4 ? 2 : pairAttempts >= minAttempts * 2 ? 1 : pairAttempts < minAttempts ? -1 : 0;
    return clampQuestionCount(count, 5, timed ? 15 : 20);
};

const getFilteredAttempts = (metrics) => metrics?.filteredAttempts ?? metrics?.attempts?.filtered ?? metrics?.normalizedAttempts ?? [];

const attemptHasTopic = (attempt, topicId) => !topicId || (attempt.topicIds ?? []).includes(topicId);

const attemptHasSkill = (attempt, skillId) => !skillId || (attempt.skillIds ?? []).includes(skillId);

const sortMistakeRows = (rows) => rows.slice().sort((a, b) => b.count - a.count || a.sortIndex - b.sortIndex).map(({ sortIndex, ...row }) => row);

const buildMistakeProfile = ({ attempts = [], scope, scopeLabel }) => {
    const summaries = new Map(MISTAKE_TYPES.map((type, index) => [type.id, { id: type.id, label: type.label, count: 0, sortIndex: index }]));
    let taggedIncorrectAttemptCount = 0;
    let totalSelections = 0;
    attempts.forEach((attempt) => {
        if (attempt?.isCorrect) return;
        const mistakeTypeIds = normalizeMistakeTypeIds(attempt.mistakeTypeIds);
        if (!mistakeTypeIds.length) return;
        taggedIncorrectAttemptCount += 1;
        mistakeTypeIds.forEach((mistakeTypeId) => {
            const summary = summaries.get(mistakeTypeId);
            if (!summary) return;
            summary.count += 1;
            totalSelections += 1;
        });
    });
    if (!totalSelections) return null;
    const rows = sortMistakeRows(Array.from(summaries.values()).map((summary) => ({
        id: summary.id,
        label: summary.label ?? getMistakeTypeLabel(summary.id),
        count: summary.count,
        selectionRate: totalSelections ? summary.count / totalSelections : 0,
        taggedQuestionRate: taggedIncorrectAttemptCount ? summary.count / taggedIncorrectAttemptCount : 0,
        taggedMissRate: taggedIncorrectAttemptCount ? summary.count / taggedIncorrectAttemptCount : 0,
        sortIndex: summary.sortIndex
    })));
    const activeRows = rows.filter((row) => row.count > 0);
    const dominantRow = activeRows[0] ?? null;
    const actionableRow = activeRows.find((row) => !NON_DRILL_DRIVER_MISTAKE_IDS.has(row.id)) ?? null;
    const strategy = actionableRow ? MISTAKE_DRILL_STRATEGIES[actionableRow.id] ?? null : null;
    const ignoredDominantRow = dominantRow && actionableRow && dominantRow.id !== actionableRow.id ? dominantRow : null;
    return {
        scope,
        scopeLabel,
        taggedIncorrectAttemptCount,
        totalSelections,
        dominantMistakeTypeId: dominantRow?.id ?? null,
        dominantMistakeTypeLabel: dominantRow?.label ?? null,
        actionableMistakeTypeId: actionableRow?.id ?? null,
        actionableMistakeTypeLabel: actionableRow?.label ?? null,
        ignoredDominantMistakeTypeId: ignoredDominantRow?.id ?? null,
        ignoredDominantMistakeTypeLabel: ignoredDominantRow?.label ?? null,
        label: actionableRow?.label ?? dominantRow?.label ?? null,
        strategyLabel: strategy?.label ?? null,
        strategyRationale: strategy?.rationale ?? null,
        reviewFocus: strategy?.reviewFocus ?? null,
        configPatch: strategy?.configPatch ?? null,
        questionCountAdjustment: strategy?.questionCountAdjustment ?? 0,
        isDrillSteering: Boolean(strategy),
        nonSteeringSelectionCount: activeRows.filter((row) => NON_DRILL_DRIVER_MISTAKE_IDS.has(row.id)).reduce((total, row) => total + row.count, 0),
        flawedQuestionSelections: activeRows.find((row) => row.id === "flawed_question")?.count ?? 0,
        topMistakeTypes: activeRows.slice(0, 4),
        rows: activeRows.slice(0, 4)
    };
};

const getMistakeFocus = ({ metrics, topPair, targetSectionId, topicLabel, skillLabel, sectionLabel }) => {
    const attempts = getFilteredAttempts(metrics);
    if (!attempts.length) return null;
    const candidates = [
        {
            scope: "topic_skill_pair",
            scopeLabel: `${topicLabel} with ${skillLabel}`,
            attempts: attempts.filter((attempt) => attemptHasTopic(attempt, topPair.topicId) && attemptHasSkill(attempt, topPair.skillId))
        },
        {
            scope: "topic",
            scopeLabel: topicLabel,
            attempts: attempts.filter((attempt) => attemptHasTopic(attempt, topPair.topicId))
        },
        {
            scope: "skill",
            scopeLabel: skillLabel,
            attempts: attempts.filter((attempt) => attemptHasSkill(attempt, topPair.skillId))
        },
        {
            scope: "section",
            scopeLabel: sectionLabel,
            attempts: attempts.filter((attempt) => attempt.sectionId === targetSectionId)
        },
        {
            scope: "filtered_view",
            scopeLabel: "the active dashboard filter",
            attempts
        }
    ].map(buildMistakeProfile).filter(Boolean);
    return candidates.find((profile) => profile.taggedIncorrectAttemptCount >= MIN_MISTAKE_FOCUS_TAGGED_ATTEMPTS) ?? candidates[0] ?? null;
};

const applyMistakeFocusToConfig = (config, mistakeFocus) => {
    const strategy = MISTAKE_DRILL_STRATEGIES[mistakeFocus?.actionableMistakeTypeId];
    if (!strategy?.applyConfig) return config;
    const next = strategy.applyConfig({ ...config });
    return {
        ...next,
        questionCount: clampQuestionCount(next.questionCount, 5, next.timingMode === "timed" ? 15 : 20),
        secondsPerQuestion: next.timingMode === "timed" ? (safeNumber(next.secondsPerQuestion, 0) || getTargetSeconds(next.sectionId)) : null
    };
};

const formatMistakeFocusEvidence = (mistakeFocus) => mistakeFocus?.actionableMistakeTypeLabel ?? mistakeFocus?.dominantMistakeTypeLabel ?? mistakeFocus?.label ?? null;

export const buildRecommendation = ({ topicsById, skillsById, sectionsById, metrics }) => {
    const totals = metrics?.totals ?? {};
    const sectionId = getDefaultSectionId(metrics);
    if (!totals.totalQuestionsAnswered) {
        const config = buildBaselineConfig(sectionId, { timed: false, count: calculateBaselineQuestionCount(metrics, false) });
        return {
            type: "new_user",
            headline: "Recommended next drill",
            body: `Start with a ${config.questionCount}-question medium ${getSectionLabel(sectionsById, sectionId)} baseline drill so the dashboard has enough local data to identify useful patterns.`,
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
                    config: buildBaselineConfig(sectionId, { timed: true, count: calculateBaselineQuestionCount(metrics, true) })
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
        const config = buildBaselineConfig(sectionId, { timed, count: calculateBaselineQuestionCount(metrics, timed) });
        return {
            type: "insufficient_pair_data",
            headline: "Recommended next drill",
            body: `Build more topic-skill signal with a ${config.questionCount}-question medium ${getSectionLabel(sectionsById, sectionId)} drill.`,
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
    const topicLabel = getTopicLabel(topicsById, topPair.topicId);
    const skillLabel = getSkillLabel(skillsById, topPair.skillId);
    const sectionLabel = getSectionLabel(sectionsById, targetSectionId);
    const timingGap = hasTimingGap(metrics);
    const overconfidence = hasOverconfidence(metrics);
    const slowPair = topPair.timeRatio > 1.15;
    const timed = timingGap || slowPair;
    const reviewMode = timed && !overconfidence ? "later" : "immediate";
    const questionCount = calculateTargetedQuestionCount({ pair: topPair, metrics, timed });
    const baseConfig = {
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
    const mistakeFocus = getMistakeFocus({ metrics, topPair, targetSectionId, topicLabel, skillLabel, sectionLabel });
    const config = applyMistakeFocusToConfig(baseConfig, mistakeFocus);
    const avgSeconds = msToSeconds(topPair.averageElapsedMs);
    const targetSeconds = msToSeconds(topPair.targetTimeMs);
    const pairAttempts = getPairAttempts(topPair);
    const rationale = [
        `${topicLabel} with ${skillLabel} is the highest-priority topic-skill target in the current dashboard view.`,
        `${round(pairAttempts, pairAttempts % 1 ? 0.01 : 1)} related attempt${pairAttempts === 1 ? "" : "s"}, ${pct(topPair.accuracy)} raw accuracy, ${pct(topPair.smoothedAccuracy)} smoothed accuracy, and ${round(topPair.mastery ?? 1, 0.01)} mastery.`
    ];
    if (avgSeconds && targetSeconds && avgSeconds > targetSeconds) rationale.push(`Average time is ${avgSeconds}s against a ${targetSeconds}s target.`);
    if (timingGap) rationale.push("Timed accuracy is materially lower than untimed accuracy in the current view.");
    if (overconfidence) rationale.push("Confidence calibration suggests reviewing explanations before increasing speed.");
    if (mistakeFocus?.strategyRationale) rationale.push(`${mistakeFocus.actionableMistakeTypeLabel ?? mistakeFocus.label} is the leading actionable self-reported mistake focus for ${mistakeFocus.scopeLabel}, so the drill setup emphasizes ${mistakeFocus.strategyLabel.toLowerCase()}.`);
    if (mistakeFocus?.ignoredDominantMistakeTypeLabel) rationale.push(`${mistakeFocus.ignoredDominantMistakeTypeLabel} was the most common tagged issue in that scope, but it is tracked as context rather than used to steer learner weakness recommendations.`);
    if (mistakeFocus?.flawedQuestionSelections) rationale.push("Flawed-question tags are tracked as quality signals but are not used to steer learner weakness recommendations.");
    if (topPair.signalStrength === "early") rationale.push("This is still an early signal, so the drill is short and targeted rather than definitive.");
    const evidence = buildEvidence(topPair);
    const mistakeFocusLabel = formatMistakeFocusEvidence(mistakeFocus);
    if (mistakeFocusLabel) {
        evidence.mistakeFocusLabel = mistakeFocusLabel;
        evidence.mistakeFocusTaggedMisses = mistakeFocus.taggedIncorrectAttemptCount;
    }
    return {
        type: "weak_pair",
        headline: "Recommended next drill",
        body: `Drill ${sectionLabel}: ${topicLabel} with ${skillLabel}. Use ${config.questionCount} ${config.timingMode === "timed" ? "timed" : "untimed"} medium questions with ${config.reviewMode === "later" ? "post-session review" : "immediate review"}.`,
        rationale,
        evidence,
        mistakeFocus,
        config,
        alternatives: pairs.slice(1, 4).map((pair) => {
            const alternativeSectionId = pair.sectionId || topicsById?.[pair.topicId]?.sectionId || targetSectionId;
            const alternativeTimed = pair.timeRatio > 1.15;
            return {
                label: `${getTopicLabel(topicsById, pair.topicId)} with ${getSkillLabel(skillsById, pair.skillId)}`,
                config: {
                    sectionId: alternativeSectionId,
                    topicIds: [pair.topicId],
                    skillIds: [pair.skillId],
                    questionCount: calculateTargetedQuestionCount({ pair, metrics, timed: alternativeTimed }),
                    timingMode: alternativeTimed ? "timed" : "untimed",
                    secondsPerQuestion: alternativeTimed ? getTargetSeconds(alternativeSectionId) : null,
                    difficulty: "medium",
                    questionFormat: getQuestionFormat(alternativeSectionId),
                    reviewMode: alternativeTimed ? "later" : "immediate"
                }
            };
        })
    };
};
