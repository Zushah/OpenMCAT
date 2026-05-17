const DIFFICULTY_LEVELS = {
    easy: {
        label: "Easy",
        guidance: [
            "Test a high-yield MCAT idea in a direct but still exam-style way.",
            "Require recognition, basic application, or one clear reasoning move rather than several chained inferences.",
            "Use familiar MCAT contexts, but avoid burying the central concept under heavy experimental detail.",
            "Distractors should be plausible and educational, but they should usually reflect straightforward misconceptions rather than fine-grained traps.",
            "The correct answer should be accessible to a prepared student who knows the relevant content and reads carefully."
        ],
        discrete: [
            "For discrete questions, keep the stem focused on one central concept, relationship, calculation, or interpretation.",
            "A short scenario is fine, but the question should not depend on synthesizing multiple independent facts or interpreting a dense dataset."
        ],
        passage: [
            "For passage-based questions, the passage may provide context or a simple result, but the question should usually hinge on one salient passage detail plus ordinary MCAT background knowledge.",
            "Avoid requiring the student to track several variables, compare multiple experimental groups, or infer a complex mechanism from the passage."
        ]
    },
    medium: {
        label: "Medium",
        guidance: [
            "Test MCAT-style application rather than simple recall.",
            "Require the student to connect content knowledge to a scenario, experiment, graph, table, mechanism, or reasoning skill.",
            "Use one or two meaningful reasoning steps, such as predicting an outcome, identifying an assumption, applying a relationship, or interpreting a result.",
            "Distractors should be plausible because they reflect common MCAT errors: reversed relationships, overgeneralization, confusing similar concepts, ignoring controls, or misreading what the question asks.",
            "The question should feel fair to a prepared student, but not answerable by recognizing a single keyword."
        ],
        discrete: [
            "For discrete questions, use enough context to require application, but do not turn the item into a hidden passage question.",
            "A medium discrete question may combine two related ideas, require a modest calculation, or ask for the best explanation of a short scenario."
        ],
        passage: [
            "For passage-based questions, require the student to use passage information actively rather than treating the passage as decoration.",
            "A medium passage question may ask the student to interpret a result, connect an experimental manipulation to a concept, identify a reasonable conclusion, or apply a passage finding to a new condition."
        ]
    },
    hard: {
        label: "Hard",
        guidance: [
            "Create a challenging but fair MCAT-style question that rewards deep conceptual understanding and careful reasoning.",
            "Require multiple connected reasoning steps, integration across related concepts, or careful interpretation of experimental design, data, mechanism, or argument structure.",
            "Make distractors subtle because they are scientifically or logically tempting, not because the wording is tricky or the fact tested is obscure.",
            "Difficulty should come from synthesis, transfer, precision, and attention to constraints rather than memorization of low-yield trivia.",
            "The correct answer must still be clearly best when the student applies the relevant MCAT content and passage information correctly."
        ],
        discrete: [
            "For discrete questions, hard difficulty may come from integrating multiple high-yield concepts, applying a concept in an unfamiliar context, or reasoning through a multi-step relationship.",
            "Do not make a discrete question hard merely by making the stem long, hiding the actual task, or requiring niche facts beyond normal MCAT scope."
        ],
        passage: [
            "For passage-based questions, hard difficulty may come from synthesizing multiple passage details, interpreting controls or experimental design, comparing conditions, evaluating a conclusion, or applying a result to a new scenario.",
            "The answer should depend on the passage in a meaningful way, but the passage should contain enough information for a careful student to reason to the correct choice."
        ]
    }
};

const FORMAT_DIFFICULTY_CONTEXT = {
    discrete: [
        "The selected format is discrete. Calibrate difficulty through the stem, answer choices, required MCAT knowledge, and reasoning steps, not through passage-like volume.",
        "Do not rely on a long setup to create difficulty; keep the item standalone and focused."
    ],
    mini_passage: [
        "The selected format is mini-passage. Calibrate difficulty through how much passage information must be selected, connected, and interpreted.",
        "Use passage details, experiments, data, or scenarios as meaningful evidence for the answer rather than decorative background."
    ],
    mixed: [
        "The selected format is mixed. Apply the discrete guidance to standalone questions and the passage guidance to passage-linked questions.",
        "Vary the structure naturally across questions so the set does not feel formulaic."
    ],
    cars_beta: [
        "The selected format is CARS beta. Do not use outside science knowledge to create difficulty.",
        "For CARS, easy means direct comprehension or local inference; medium means connecting claims, tone, structure, or implications; hard means subtle inference, argument evaluation, author's purpose, or application to a new situation.",
        "The answer must be supported by the passage, and distractors should be tempting because they misread scope, tone, evidence, implication, or the author's logic."
    ]
};

const getFormatGuidance = (questionFormat) => {
    if (questionFormat === "mini_passage") return FORMAT_DIFFICULTY_CONTEXT.mini_passage;
    if (questionFormat === "mixed") return FORMAT_DIFFICULTY_CONTEXT.mixed;
    if (questionFormat === "cars_beta") return FORMAT_DIFFICULTY_CONTEXT.cars_beta;
    return FORMAT_DIFFICULTY_CONTEXT.discrete;
};

const getDifficultyFormatGuidance = (level, questionFormat) => {
    if (questionFormat === "mini_passage" || questionFormat === "cars_beta") return level.passage;
    if (questionFormat === "mixed") return [...level.discrete, ...level.passage];
    return level.discrete;
};

const formatBulletList = (items) => items.map((item) => `    - ${item}`).join("\n");

export const buildDifficultyPrompt = (config) => {
    const level = DIFFICULTY_LEVELS[config.difficulty];
    if (!level) return "";
    return [
        `${level.label} difficulty calibration:`,
        formatBulletList(level.guidance),
        "",
        "Format-specific calibration:",
        formatBulletList(getFormatGuidance(config.questionFormat)),
        "",
        "How this difficulty should appear in the selected format:",
        formatBulletList(getDifficultyFormatGuidance(level, config.questionFormat)),
        "",
        "Avoid cookie-cutter difficulty patterns:",
        formatBulletList([
            "Do not make every question follow the same template, stem structure, or distractor pattern.",
            "Do not signal the difficulty level explicitly inside the question text.",
            "Do not make hard questions artificially confusing, and do not make easy questions feel non-MCAT or simplistic.",
            "Maintain realistic MCAT style: concise stems, scientifically coherent scenarios, meaningful distractors, and explanations that teach the underlying reasoning."
        ])
    ].join("\n");
};
