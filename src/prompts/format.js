export const FORMAT_PROMPTS = {
    discrete: `Question format: discrete.
    - No passage required.
    - Use concise standalone stems and scenarios.`,
    mini_passage: `Question format: mini-passage.
    - Include short passage text (about 150-350 words).
    - Include 2-4 questions per passage when practical.`,
    mixed: `Question format: mixed.
    - Include a blend of discrete and passage-linked questions.
    - Keep output compact and coherent.`,
    cars_beta: `Question format: CARS beta.
    - Include passage-based reasoning.
    - Do not require outside factual knowledge.
    - Focus on meaning, structure, tone, inference, and application.`
};
