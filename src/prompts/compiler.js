import { getSectionById, getSkillById, getTopicById } from "../data/taxonomy.js";
import { PRACTICE_SCHEMA_SUMMARY } from "../schema/practice.js";
import { BASE_SYSTEM_PROMPT } from "./base.js";
import { buildDifficultyPrompt } from "./difficulty.js";
import { FORMAT_PROMPTS } from "./format.js";
import { SECTION_PROMPTS } from "./section.js";
import { buildSkillPrompt } from "./skill.js";
import { buildTopicPrompt } from "./topic.js";

const formatTopicList = (topicIds) => topicIds.map((topicId) => getTopicById(topicId)).filter(Boolean).map((topic) => `${topic.name} (${topic.id})`).join(", ");

const formatSkillList = (skillIds) => skillIds.map((skillId) => getSkillById(skillId)).filter(Boolean).map((skill) => `${skill.name} (${skill.id})`).join(", ");

export const compileSystemPrompt = (config) => {
    const sectionPrompt = SECTION_PROMPTS[config.sectionId] ?? "";
    const difficultyPrompt = buildDifficultyPrompt(config);
    const formatPrompt = FORMAT_PROMPTS[config.questionFormat] ?? "";
    const selectedSkills = config.skillIds.map((skillId) => getSkillById(skillId)).filter(Boolean);
    return [
        BASE_SYSTEM_PROMPT,
        "Legal and quality constraints:",
        "- Do not claim official affiliation or score prediction.",
        "- Use selected topic IDs and skill IDs exactly in question tags.",
        "- Avoid unsupported claims and avoid medical advice.",
        sectionPrompt,
        buildTopicPrompt(config.topicIds),
        buildSkillPrompt(selectedSkills),
        difficultyPrompt,
        formatPrompt
    ].filter(Boolean).join("\n\n");
};

export const compileUserPrompt = (config) => {
    const section = getSectionById(config.sectionId);
    const topicList = formatTopicList(config.topicIds);
    const skillList = formatSkillList(config.skillIds);
    const secondsPerQuestion = config.timingMode === "timed" && typeof config.secondsPerQuestion === "number" ? config.secondsPerQuestion : "default";
    return `Generate a practice session with the following settings:
    Section: ${section?.name ?? config.sectionId} (${config.sectionId})
    Topics: ${topicList}
    Skills: ${skillList}
    Difficulty: ${config.difficulty}
    Question format: ${config.questionFormat}
    Question count: ${config.questionCount}
    Timing mode: ${config.timingMode}
    Seconds per question: ${secondsPerQuestion}
    Review mode: ${config.reviewMode}
    Explanation depth: ${config.explanationDepth}
    Batch size: ${config.batchSize}

    Return JSON matching this schema exactly:
    ${PRACTICE_SCHEMA_SUMMARY}

    Additional requirements:
    - Use the selected topic IDs and skill IDs exactly as provided.
    - Each question must include testedTopicIds and testedSkillIds.
    - If using a passage, include passageId and ensure the passage exists.
    - If not using a passage, set passageId to null.
    - Include session.estimatedTimeMinutes.
    - Include selfCheck for each question.
    - Do not include text besides a single-line (i.e., no line breaks) JSON object.`;
};

export const compilePracticePrompt = (config) => { return { system: compileSystemPrompt(config), user: compileUserPrompt(config) }; };
