import { SAMPLE_SESSION } from "../data/samples.js";

const cb = Chalkboard;

export const mockProvider = {
    id: "mock",
    name: "Mock provider",
    description: "Instant local sample data.",
    requiresApiKey: false,
    supportsBrowserDirect: true,
    supportsCustomBaseUrl: false,
    async generatePracticeSession({ config }) {
        const parsedJson = structuredClone(SAMPLE_SESSION);
        const requestedCount = cb.stat.max([1, Number(config?.questionCount) || 5]);
        const effectiveTopicIds = config.topicIds && config.topicIds.length ? config.topicIds : parsedJson.session.topicIds;
        const effectiveSkillIds = config.skillIds && config.skillIds.length ? config.skillIds : parsedJson.session.skillIds;
        const baseQuestions = parsedJson.questions.slice();
        const expanded = [];
        for (let index = 0; index < requestedCount; index += 1) {
            const template = structuredClone(baseQuestions[index % baseQuestions.length]);
            template.id = `q${index + 1}`;
            if (index >= baseQuestions.length) template.stem = `${template.stem} (Variant ${index + 1})`;
            const topic = effectiveTopicIds[index % effectiveTopicIds.length];
            const skill = effectiveSkillIds[index % effectiveSkillIds.length];
            template.testedTopicIds = topic ? [topic] : template.testedTopicIds;
            template.testedSkillIds = skill ? [skill] : template.testedSkillIds;
            if (config.questionFormat === "discrete") { template.passageId = null; template.type = "discrete"; }
            if (config.questionFormat === "mini_passage" || config.questionFormat === "cars_beta") { template.passageId = "p1"; template.type = "passage_based"; }
            expanded.push(template);
        }
        parsedJson.questions = expanded;
        if (config.questionFormat === "discrete") parsedJson.passages = [];
        parsedJson.session.estimatedTimeMinutes = cb.stat.max([1, cb.numb.roundTo((requestedCount * 95) / 60, 1)]);
        parsedJson.session.topicIds = effectiveTopicIds;
        parsedJson.session.skillIds = effectiveSkillIds;
        parsedJson.session.sectionId = config.sectionId;
        parsedJson.session.difficulty = config.difficulty;
        parsedJson.session.questionFormat = config.questionFormat;
        parsedJson.session.title = `${config.sectionId.toUpperCase()} targeted drill`;
        parsedJson.session.aiModel = "mock-mcat-v1";
        return {
            rawText: JSON.stringify(parsedJson, null, 2),
            parsedJson,
            error: null,
            meta: { providerId: "mock", model: "mock-mcat-v1" }
        };
    }
};
