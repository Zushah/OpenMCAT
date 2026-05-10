export const buildValidatorPrompt = () => {
    return `Validator placeholder:
    - Check exactly one correct answer.
    - Check explanation consistency.
    - Check topic/skill alignment.
    - Check scientific coherence.
    - Check passage entailment for passage-based questions.
    - Check obvious ambiguity.
    - Check no official/proprietary content patterns.

    Note: This is a placeholder aid and not a proof of correctness.`;
};
