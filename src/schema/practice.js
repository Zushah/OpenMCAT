export const PRACTICE_SCHEMA_VERSION = "1.1";
export const SUPPORTED_PRACTICE_SCHEMA_VERSIONS = Object.freeze(["1.0", PRACTICE_SCHEMA_VERSION]);

export const PRACTICE_SCHEMA_SUMMARY = `{
    "schemaVersion": "1.1",
    "session": {
        "title": "string",
        "sectionId": "cp|bb|ps",
        "topicIds": ["topic_id"],
        "skillIds": ["skill_id"],
        "difficulty": "easy|medium|hard",
        "questionFormat": "discrete|passage|mixed",
        "estimatedTimeMinutes": 1,
        "aiModel": "provider/model",
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
            "charts": [
                {
                    "id": "c1",
                    "caption": "string",
                    "config": {
                        "type": "line|bar|scatter",
                        "data": {
                            "labels": ["optional category labels"],
                            "datasets": [
                                {
                                    "label": "optional string",
                                    "type": "optional line|bar|scatter override",
                                    "data": [1, 2, 3]
                                }
                            ]
                        },
                        "options": {
                            "scales": {
                                "x": {
                                    "type": "category|linear|logarithmic",
                                    "title": { "display": true, "text": "string" },
                                    "min": 0,
                                    "max": 10,
                                    "beginAtZero": false
                                },
                                "y": {
                                    "type": "linear|logarithmic",
                                    "title": { "display": true, "text": "string" },
                                    "min": 0,
                                    "max": 10,
                                    "beginAtZero": true
                                }
                            }
                        }
                    }
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
            "charts": [
                {
                    "id": "c1",
                    "caption": "string",
                    "config": {
                        "type": "scatter",
                        "data": {
                            "datasets": [
                                {
                                    "label": "optional string",
                                    "data": [
                                        { "x": 0.5, "y": 2.1 },
                                        { "x": 1.0, "y": 4.2 }
                                    ]
                                }
                            ]
                        },
                        "options": { "scales": { "x": { "type": "linear" }, "y": { "type": "linear" } } }
                    }
                }
            ],
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
