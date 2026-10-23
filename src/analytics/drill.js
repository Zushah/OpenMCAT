import { SECTIONS, getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";

const SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getMostMissedId = (missedQuestions, field, validIds) => {
    const counts = new Map();
    missedQuestions.forEach((question) => {
        const ids = Array.isArray(question?.[field]) ? question[field] : [];
        new Set(ids.filter((id) => typeof id === "string" && validIds.has(id))).forEach((id) => { counts.set(id, (counts.get(id) ?? 0) + 1); });
    });
    let best = null;
    let bestCount = 0;
    counts.forEach((count, id) => { if (count > bestCount) { best = id; bestCount = count; } });
    return best;
};

export const buildReviewDrillConfig = (sessionLike) => {
    const config = isObject(sessionLike?.config) ? sessionLike.config : {};
    const questions = Array.isArray(sessionLike?.generatedSession?.questions) ? sessionLike.generatedSession.questions : [];
    const states = isObject(sessionLike?.questionStateById) ? sessionLike.questionStateById : {};
    const missedQuestions = questions.filter((question) => isObject(question) && typeof question.id === "string" && states[question.id]?.submitted === true && states[question.id]?.isCorrect === false);
    if (!missedQuestions.length) return null;
    const sectionId = [sessionLike.generatedSession?.session?.sectionId, config.sectionId].find((id) => SECTION_IDS.has(id)) ?? config.sectionId;
    const topTopicId = getMostMissedId(missedQuestions, "testedTopicIds", new Set(getTopicsBySection(sectionId).map((topic) => topic.id)));
    const topSkillId = getMostMissedId(missedQuestions, "testedSkillIds", new Set(getSkillsForSection(sectionId).map((skill) => skill.id)));
    const drillConfig = { ...structuredClone(config), sectionId };
    if (topTopicId) drillConfig.topicIds = [topTopicId];
    if (topSkillId) drillConfig.skillIds = [topSkillId];
    return drillConfig;
};
