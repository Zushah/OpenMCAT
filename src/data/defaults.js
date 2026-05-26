export const DEFAULT_CONFIG = {
    sectionId: "bb",
    topicIds: ["bb_amino_acids"],
    skillIds: ["sirs_1", "sirs_2"],
    difficulty: "medium",
    questionFormat: "discrete",
    questionCount: 5,
    timingMode: "untimed",
    secondsPerQuestion: null,
    reviewMode: "immediate"
};

export const QUESTION_COUNT_LIMITS = {
    min: 1,
    max: 50
};

export const DEFAULT_SETTINGS = {
    theme: "system"
};

export const REVIEW_MODES = [
    { id: "immediate", label: "Review immediately" },
    { id: "later", label: "Review later" }
];

export const TIMING_MODES = [
    { id: "untimed", label: "Untimed" },
    { id: "timed", label: "Timed" }
];
