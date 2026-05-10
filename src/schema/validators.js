import { PRACTICE_SCHEMA_VERSION } from "./practice.js";

const CHOICE_IDS = ["A", "B", "C", "D"];

const isText = (value) => typeof value === "string" && value.trim().length > 0;

const unique = (values) => Array.from(new Set(values));

const normalizeSessionShape = (rawSession) => {
    const session = structuredClone(rawSession);
    if (!Array.isArray(session.passages)) session.passages = [];
    if (!Array.isArray(session.questions)) session.questions = [];
    session.questions = session.questions.map((question, index) => {
        const normalized = { ...question };
        normalized.id = isText(normalized.id) ? normalized.id : `q${index + 1}`;
        normalized.type = isText(normalized.type) ? normalized.type : "discrete";
        normalized.passageId = normalized.passageId === null || isText(normalized.passageId) ? normalized.passageId : null;
        normalized.stem = isText(normalized.stem) ? normalized.stem.trim() : "";
        normalized.choices = Array.isArray(normalized.choices) ? normalized.choices.map((choice, choiceIndex) => ({
            id: isText(choice?.id) ? choice.id.trim().toUpperCase() : CHOICE_IDS[choiceIndex] ?? "A",
            text: isText(choice?.text) ? choice.text.trim() : ""
        })) : [];
        normalized.correctChoiceId = isText(normalized.correctChoiceId) ? normalized.correctChoiceId.trim().toUpperCase() : "";
        normalized.explanation = isText(normalized.explanation) ? normalized.explanation.trim() : "";
        normalized.choiceExplanations = normalized.choiceExplanations ?? {};
        normalized.testedTopicIds = Array.isArray(normalized.testedTopicIds) ? unique(normalized.testedTopicIds.filter(isText)) : [];
        normalized.testedSkillIds = Array.isArray(normalized.testedSkillIds) ? unique(normalized.testedSkillIds.filter(isText)) : [];
        normalized.estimatedDifficulty = isText(normalized.estimatedDifficulty) ? normalized.estimatedDifficulty : "medium";
        normalized.commonMistake = isText(normalized.commonMistake) ? normalized.commonMistake : "";
        normalized.requiresExternalKnowledge = typeof normalized.requiresExternalKnowledge === "boolean" ? normalized.requiresExternalKnowledge : false;
        normalized.selfCheck = normalized.selfCheck ?? {};
        return normalized;
    });
    return session;
};

const validateStringField = (errors, value, path) => { if (!isText(value)) errors.push(`${path} must be a non-empty string.`); };

export const validatePracticeSession = (candidate, context = {}) => {
    const errors = [];
    const warnings = [];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return {
            valid: false,
            errors: ["Top-level JSON must be an object."],
            warnings,
            normalized: null
        };
    }
    const normalized = normalizeSessionShape(candidate);
    if (!isText(normalized.schemaVersion)) errors.push("schemaVersion is required.");
    else if (normalized.schemaVersion !== PRACTICE_SCHEMA_VERSION) warnings.push(`schemaVersion is "${normalized.schemaVersion}", expected "${PRACTICE_SCHEMA_VERSION}".`);
    if (!normalized.session || typeof normalized.session !== "object") errors.push("session object is required."); else {
        validateStringField(errors, normalized.session.title, "session.title");
        validateStringField(errors, normalized.session.sectionId, "session.sectionId");
        if (!Array.isArray(normalized.session.topicIds)) errors.push("session.topicIds must be an array.");
        if (!Array.isArray(normalized.session.skillIds)) errors.push("session.skillIds must be an array.");
        validateStringField(errors, normalized.session.difficulty, "session.difficulty");
        validateStringField(errors, normalized.session.questionFormat, "session.questionFormat");
        validateStringField(errors, normalized.session.aiModel, "session.aiModel");
        validateStringField(errors, normalized.session.disclaimer, "session.disclaimer");
    }
    if (!Array.isArray(normalized.questions)) errors.push("questions must be an array.");
    const questionIds = new Set();
    const passageIds = new Set(Array.isArray(normalized.passages) ? normalized.passages.map((passage) => (isText(passage?.id) ? passage.id : null)).filter(Boolean) : []);
    normalized.passages.forEach((passage, index) => {
        const path = `passages[${index}]`;
        validateStringField(errors, passage.id, `${path}.id`);
        validateStringField(errors, passage.title, `${path}.title`);
        validateStringField(errors, passage.text, `${path}.text`);
        if (passage.tables && !Array.isArray(passage.tables)) errors.push(`${path}.tables must be an array if provided.`);
        if (Array.isArray(passage.tables)) {
            passage.tables.forEach((table, tableIndex) => {
                const tablePath = `${path}.tables[${tableIndex}]`;
                validateStringField(errors, table.id, `${tablePath}.id`);
                validateStringField(errors, table.caption, `${tablePath}.caption`);
                if (!Array.isArray(table.columns)) errors.push(`${tablePath}.columns must be an array.`);
                else table.columns.forEach((columnValue, columnIndex) => { validateStringField(errors, columnValue, `${tablePath}.columns[${columnIndex}]`); });
                if (!Array.isArray(table.rows)) errors.push(`${tablePath}.rows must be an array.`);
                else {
                    table.rows.forEach((row, rowIndex) => {
                        if (!Array.isArray(row)) errors.push(`${tablePath}.rows[${rowIndex}] must be an array.`);
                        else row.forEach((value, colIndex) => { validateStringField(errors, value, `${tablePath}.rows[${rowIndex}][${colIndex}]`); });
                    });
                }
                });
        }
        if (passage.figureDescriptions && !Array.isArray(passage.figureDescriptions)) errors.push(`${path}.figureDescriptions must be an array if provided.`);
        if (Array.isArray(passage.figureDescriptions)) {
            passage.figureDescriptions.forEach((figure, figureIndex) => {
                const figurePath = `${path}.figureDescriptions[${figureIndex}]`;
                validateStringField(errors, figure.id, `${figurePath}.id`);
                validateStringField(errors, figure.caption, `${figurePath}.caption`);
                validateStringField(errors, figure.description, `${figurePath}.description`);
            });
        };
    });
    normalized.questions.forEach((question, index) => {
        const path = `questions[${index}]`;
        if (questionIds.has(question.id)) errors.push(`Duplicate question id: ${question.id}`);
        questionIds.add(question.id);
        validateStringField(errors, question.stem, `${path}.stem`);
        validateStringField(errors, question.explanation, `${path}.explanation`);
        validateStringField(errors, question.type, `${path}.type`);
        if (!Array.isArray(question.choices) || question.choices.length !== 4) errors.push(`${path}.choices must contain exactly 4 choices.`);
        else {
            const ids = question.choices.map((choice) => choice.id);
            const duplicateChoice = ids.find((id, idIndex) => ids.indexOf(id) !== idIndex);
            if (duplicateChoice) errors.push(`${path} has duplicate choice id "${duplicateChoice}".`);
            CHOICE_IDS.forEach((choiceId) => { if (!ids.includes(choiceId)) errors.push(`${path} choices must include "${choiceId}".`); });
            question.choices.forEach((choice, choiceIndex) => { validateStringField(errors, choice.text, `${path}.choices[${choiceIndex}].text`); });
        }
        if (!CHOICE_IDS.includes(question.correctChoiceId)) errors.push(`${path}.correctChoiceId must be one of A/B/C/D.`);
        CHOICE_IDS.forEach((choiceId) => { if (!isText(question.choiceExplanations?.[choiceId])) errors.push(`${path}.choiceExplanations.${choiceId} must be a non-empty string.`); });
        if (!Array.isArray(question.testedTopicIds) || question.testedTopicIds.length < 1) errors.push(`${path}.testedTopicIds must include at least one topic.`);
        if (!Array.isArray(question.testedSkillIds) || question.testedSkillIds.length < 1) errors.push(`${path}.testedSkillIds must include at least one skill.`);
        if (question.passageId !== null && !passageIds.has(question.passageId)) errors.push(`${path}.passageId references missing passage "${question.passageId}".`);
        const selfCheck = question.selfCheck ?? {};
        const requiredChecks = ["oneCorrectAnswer", "answerDerivableFromPassage", "noOfficialMaterialCopied", "scientificallyCoherent"];
        requiredChecks.forEach((field) => { if (selfCheck[field] !== true) errors.push(`${path}.selfCheck.${field} must be true.`); });
        const stemLower = question.stem.toLowerCase();
        if (stemLower.includes("as an ai")) warnings.push(`${path} includes refusal-style language.`);
        if (question.explanation.length < 20) warnings.push(`${path} explanation is very short.`);
        const choiceTexts = question.choices.map((choice) => choice.text.trim().toLowerCase());
        if (new Set(choiceTexts).size !== choiceTexts.length) warnings.push(`${path} has repeated choice text.`);
    });
    if (typeof context.requestedCount === "number") {
        if (normalized.questions.length > context.requestedCount) { normalized.questions = normalized.questions.slice(0, context.requestedCount); warnings.push(`Model returned ${candidate.questions?.length ?? 0} questions; trimmed to requested count ${context.requestedCount}.`); }
        if (normalized.questions.length !== context.requestedCount) errors.push(`Question count mismatch. Expected ${context.requestedCount}, received ${normalized.questions.length}.`);
    }
    if (Array.isArray(context.validTopicIds) && context.validTopicIds.length > 0) {
        normalized.questions.forEach((question, index) => {
            question.testedTopicIds.forEach((topicId) => { if (!context.validTopicIds.includes(topicId)) warnings.push(`questions[${index}] uses unknown topic id "${topicId}".`); });
        });
    }
    if (Array.isArray(context.validSkillIds) && context.validSkillIds.length > 0) {
        normalized.questions.forEach((question, index) => {
            question.testedSkillIds.forEach((skillId) => { if (!context.validSkillIds.includes(skillId)) warnings.push(`questions[${index}] uses unknown skill id "${skillId}".`); });
        });
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        normalized
    };
}
