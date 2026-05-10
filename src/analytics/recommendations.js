import { computeWeakTopicSkillPairs } from "./metrics.js";

export const buildRecommendation = ({ attempts, topicsById, skillsById, sectionsById, metrics }) => {
    if (!attempts.length) {
        return {
            type: "new_user",
            headline: "Recommended next drill",
            body: "Start with 5 mixed medium questions in your strongest section to establish baseline data."
        };
    }
    const weakPairs = computeWeakTopicSkillPairs(attempts, 3);
    if (!weakPairs.length) {
        return {
            type: "insufficient_pair_data",
            headline: "Recommended next drill",
            body: "Not enough topic-skill pair data yet. Try 6 mixed medium questions in timed mode to build signal."
        };
    }
    const pair = weakPairs[0];
    const topic = topicsById[pair.topicId];
    const skill = skillsById[pair.skillId];
    const section = topic ? sectionsById[topic.sectionId] : null;
    const timedWorse =
    typeof metrics.timedAccuracy === "number" &&
    typeof metrics.untimedAccuracy === "number" &&
    metrics.untimedAccuracy - metrics.timedAccuracy > 0.1;
    const count = timedWorse ? 8 : 6;
    const mode = timedWorse ? "timed" : "untimed";
    return {
        type: "weak_pair",
        headline: "Recommended next drill",
        body: `Your weakest current area is ${section?.shortName ?? "section"} - ${topic?.name ?? pair.topicId} - ${skill?.name ?? pair.skillId}. Try ${count} medium questions in ${mode} mode.`,
        config: {
            sectionId: section?.id,
            topicIds: [pair.topicId],
            skillIds: [pair.skillId],
            questionCount: count,
            timingMode: mode,
            difficulty: "medium"
        }
    };
}
