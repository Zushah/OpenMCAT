import { computeMastery } from "./mastery.js";

const cb = Chalkboard;

const DEFAULT_ALPHA = 2;
const DEFAULT_BETA = 2;

const groupAttempts = (attempts, getKeys) => {
    const groups = new Map();
    attempts.forEach((attempt) => {
        const keys = getKeys(attempt).filter(Boolean);
        keys.forEach((key) => {
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(attempt);
        });
    });
    return groups;
}

const aggregateGroupRows = (groupMap) => {
    return Array.from(groupMap.entries()).map(([id, rows]) => {
        const attempts = rows.length;
        const correct = rows.filter((row) => row.isCorrect).length;
        const elapsedValues = rows.map((row) => row.elapsedMs).filter(Number.isFinite);
        const avgTimeMs = elapsedValues.length ? cb.stat.mean(elapsedValues) : 0;
        const smoothedAccuracy = (correct + DEFAULT_ALPHA) / (attempts + DEFAULT_ALPHA + DEFAULT_BETA);
        return {
            id,
            attempts,
            correct,
            accuracy: attempts ? correct / attempts : 0,
            smoothedAccuracy,
            avgTimeMs,
            mastery: computeMastery({ correct, attempts, averageTimeMs: avgTimeMs }).mastery
        };
    });
};

export const computeMetrics = ({ attempts, sessions, flags }) => {
    const answeredAttempts = attempts.filter((attempt) => Boolean(attempt.selectedChoiceId));
    const totalQuestionsAnswered = answeredAttempts.length;
    const totalSessionsCompleted = sessions.filter((session) => Boolean(session.completedAt)).length;
    const generatedQuestionCounts = sessions.map((session) => session.generatedSession?.questions?.length ?? 0);
    const totalGeneratedQuestions = generatedQuestionCounts.length ? cb.stat.sum(generatedQuestionCounts) : 0;
    const totalCorrect = answeredAttempts.filter((attempt) => attempt.isCorrect).length;
    const overallAccuracy = totalQuestionsAnswered ? totalCorrect / totalQuestionsAnswered : 0;
    const elapsedValues = answeredAttempts.map((attempt) => attempt.elapsedMs).filter(Number.isFinite);
    const averageElapsedMs = elapsedValues.length ? cb.stat.mean(elapsedValues) : 0;
    const completionRate = totalGeneratedQuestions ? totalQuestionsAnswered / totalGeneratedQuestions : 0;
    const bySection = aggregateGroupRows(groupAttempts(answeredAttempts, (attempt) => [attempt.sectionId]));
    const byTopic = aggregateGroupRows(groupAttempts(answeredAttempts, (attempt) => attempt.topicIds ?? []));
    const bySkill = aggregateGroupRows(groupAttempts(answeredAttempts, (attempt) => attempt.skillIds ?? []));
    const byDifficulty = aggregateGroupRows(groupAttempts(answeredAttempts, (attempt) => [attempt.difficulty]));
    const confidenceGroups = aggregateGroupRows(groupAttempts(answeredAttempts.filter((attempt) => typeof attempt.confidence === "number"), (attempt) => [`${attempt.confidence}`])).sort((a, b) => Number(a.id) - Number(b.id));
    const timedAttempts = answeredAttempts.filter( (attempt) => attempt.timingMode === "timed");
    const untimedAttempts = answeredAttempts.filter((attempt) => attempt.timingMode === "untimed");
    return {
        totals: {
            totalQuestionsAnswered,
            totalSessionsCompleted,
            overallAccuracy,
            averageElapsedMs,
            completionRate,
            flaggedRate: totalQuestionsAnswered ? flags.length / totalQuestionsAnswered : 0
        },
        bySection,
        byTopic,
        bySkill,
        byDifficulty,
        confidenceGroups,
        timedAccuracy: timedAttempts.length ? timedAttempts.filter((attempt) => attempt.isCorrect).length / timedAttempts.length : null,
        untimedAccuracy: untimedAttempts.length ? untimedAttempts.filter((attempt) => attempt.isCorrect).length / untimedAttempts.length : null,
        recentAttempts: answeredAttempts.slice().sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt)).slice(0, 10)
    };
};

export const computeWeakTopicSkillPairs = (attempts, minAttempts = 3) => {
    const pairMap = new Map();
    attempts.forEach((attempt) => {
        const topics = attempt.topicIds ?? [];
        const skills = attempt.skillIds ?? [];
        topics.forEach((topicId) => {
            skills.forEach((skillId) => {
                const key = `${topicId}__${skillId}`;
                if (!pairMap.has(key)) pairMap.set(key, []);
                pairMap.get(key).push(attempt);
            });
        });
    });
    return Array.from(pairMap.entries()).map(([key, rows]) => {
        const attemptsCount = rows.length;
        const correct = rows.filter((row) => row.isCorrect).length;
        const elapsedOrZeroValues = rows.map((row) => row.elapsedMs || 0);
        const avgTimeMs = elapsedOrZeroValues.length ? cb.stat.mean(elapsedOrZeroValues) : 0;
        const smoothedAccuracy = (correct + DEFAULT_ALPHA) / (attemptsCount + DEFAULT_ALPHA + DEFAULT_BETA);
        const timingPenaltyComponent = avgTimeMs > 95000 ? cb.numb.constrain((avgTimeMs - 95000) / 220000, [0, 0.4]) : 0;
        const weakness = (1 - smoothedAccuracy) * cb.real.ln(1 + attemptsCount) + timingPenaltyComponent;
        const [topicId, skillId] = key.split("__");
        return {
            topicId,
            skillId,
            attempts: attemptsCount,
            correct,
            smoothedAccuracy,
            weakness
        };
    }).filter((row) => row.attempts >= minAttempts).sort((a, b) => b.weakness - a.weakness);
};
