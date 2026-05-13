export const DEFAULT_CONFIG = {
    sectionId: "bb",
    topicIds: ["bb_amino_acids_proteins"],
    skillIds: ["sirs_1", "sirs_2"],
    difficulty: "medium",
    questionFormat: "discrete",
    questionCount: 5,
    timingMode: "untimed",
    secondsPerQuestion: null,
    reviewMode: "immediate",
    explanationDepth: "standard",
    providerId: "manual_json",
    model: "any",
    batchSize: 5,
    promptStrictness: "strict"
};

export const QUESTION_COUNT_LIMITS = {
    min: 1,
    max: 50
};

export const BATCH_SIZE_LIMITS = {
    min: 1,
    max: 10
};

export const DEFAULT_SETTINGS = {
    theme: "system",
    reducedMotion: "system",
    provider: {
        selectedProviderId: "manual_json",
        selectedModel: "any"
    }
};

export const PROVIDER_OPTIONS = [
    {
        id: "mock",
        name: "Mock provider",
        description: "Local sample session for testing and demo.",
        requiresApiKey: false
    },
    {
        id: "manual_json",
        name: "Manual JSON paste",
        description: "Copy prompt to any model and paste its response.",
        requiresApiKey: false
    }
];

export const REVIEW_MODES = [
    { id: "immediate", label: "Review immediately" },
    { id: "later", label: "Review later" }
];

export const TIMING_MODES = [
    { id: "untimed", label: "Untimed" },
    { id: "timed", label: "Timed" }
];
