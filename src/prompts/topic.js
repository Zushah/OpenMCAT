import { getTopicById } from "../data/taxonomy.js";

const formatTopicScope = (topic) => {
    if (!topic?.subtopics?.length) return topic?.name ?? "selected topic";
    return `${topic.name} (e.g. ${topic.subtopics.join(", ")})`;
};

export const buildTopicPrompt = (topicIds) => {
    const topics = (topicIds ?? []).map((topicId) => getTopicById(topicId)).filter(Boolean);
    if (!topics.length) return "Use a balanced section-wide mix of MCAT-relevant content areas for the selected section.";
    const lines = topics.map((topic) => `- ${topic.id}: ${formatTopicScope(topic)}`);
    return `Target these content areas. Treat each topic name as the user-facing content target, and use the parenthetical examples as scope cues for what may be tested within that target. Do not try to test every example in one question; instead, make each question clearly align with one or more selected topic IDs and keep testedTopicIds limited to the selected IDs.\n${lines.join("\n")}`;
};
