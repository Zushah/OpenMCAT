export const PRACTICE_SCHEMA_VERSION = "1.0";

export const PRACTICE_SCHEMA_SUMMARY = `{
    "schemaVersion": "1.0",
    "session": {
        "title": "string",
        "sectionId": "cp|bb|ps|cars",
        "topicIds": ["topic_id"],
        "skillIds": ["skill_id"],
        "difficulty": "easy|medium|hard",
        "questionFormat": "discrete|mini_passage|mixed|cars_beta",
        "estimatedTimeMinutes": 1,
        "aiModel": "string",
        "disclaimer": "string"
    },
    "passages": [
        {
            "id": "p1",
            "title": "string",
            "text": "string",
            "tables": [
                {
                    "id": "t1",
                    "caption": "string",
                    "columns": ["string"],
                    "rows": [["string"]]
                }
            ],
            "figureDescriptions": [
                {
                    "id": "f1",
                    "caption": "string",
                    "description": "string"
                }
            ]
        }
    ],
    "questions": [
        {
            "id": "q1",
            "passageId": null,
            "type": "discrete|passage_based",
            "stem": "string",
            "choices": [
                { "id": "A", "text": "string" },
                { "id": "B", "text": "string" },
                { "id": "C", "text": "string" },
                { "id": "D", "text": "string" }
            ],
            "correctChoiceId": "A|B|C|D",
            "explanation": "string",
            "choiceExplanations": {
                "A": "string",
                "B": "string",
                "C": "string",
                "D": "string"
            },
            "testedTopicIds": ["topic_id"],
            "testedSkillIds": ["skill_id"],
            "estimatedDifficulty": "easy|medium|hard",
            "commonMistake": "string",
            "requiresExternalKnowledge": true,
            "selfCheck": {
                "oneCorrectAnswer": true,
                "answerDerivableFromPassage": true,
                "noOfficialMaterialCopied": true,
                "scientificallyCoherent": true
            }
        }
    ]
}`;
