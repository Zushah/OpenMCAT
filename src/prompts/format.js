export const FORMAT_PROMPTS = {
    discrete: `Question format: discrete.
    - Make every question standalone with passageId: null; do not include passages for this format.
    - Make the stem, answers, and explanations follow the selected section, topic, skill, and difficulty guidance already provided.
    - Use concise MCAT-style clinical, experimental, quantitative, conceptual, or social-science scenarios when useful, but include all information needed to answer in the stem.
    - Test application and reasoning rather than isolated flashcard recall; use the selected skills through calculations, predictions, mechanism reasoning, study-design judgments, data interpretation, or concept application as appropriate.
    - Keep each item focused, plausible, and self-contained, with one clearly best answer and distractors tied to common MCAT errors.`,
    passage: `Question format: passage.
    - Generate original, fictional MCAT-style passages rather than short vignettes; each passage should present a compact experiment, mechanism, dataset, study summary, or scenario that can support several linked questions.
    - Make the passage subject matter, question stems, answers, and explanations follow the selected section, topic, skill, and difficulty guidance already provided. The selected difficulty should affect passage density, reasoning steps, data interpretation, and distractor subtlety.
    - Make every question passage-based with a valid passageId. Questions should require using passage information with MCAT-level knowledge, not simply recalling isolated facts or copying a sentence.
    - For C/P, use biological or biochemical contexts requiring chemistry/physics reasoning; for B/B, use molecular, cellular, biochemical, genetic, or physiological scenarios; for P/S, use behavioral, psychological, sociological, or public-health-style studies.
    - Keep passages fully fictional and do not cite, adapt, or claim that a passage is based on a real study. Do not use actual images; describe any graph, pathway, reaction, apparatus, structure, or study result using passage text, tables, or figureDescriptions.`,
    mixed: `Question format: mixed.
    - Include a real combination of standalone discrete questions and passage-linked questions when the requested count allows; use passageId: null for discrete questions and valid passageId values for passage questions.
    - Make both portions follow the selected section, topic, skill, and difficulty guidance already provided, rather than using one portion as filler or unrelated review.
    - For discrete questions, use concise self-contained MCAT-style stems that test application or reasoning without requiring passage context.
    - For passage-linked questions, use original fictional MCAT-style passages that support multiple related questions when practical and require passage evidence plus MCAT-level knowledge.
    - Use passage text, tables, or figureDescriptions for any needed passage data or visual information, and do not use real studies or official/proprietary passage content.`,
    cars_beta: `Question format: CARS beta.
    - Include passage-based reasoning.
    - Do not require outside factual knowledge.
    - Focus on meaning, structure, tone, inference, and application.`
};
