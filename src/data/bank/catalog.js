export const QUESTION_BANK_PROVIDER_ID = "question_bank";
export const QUESTION_BANK_MODEL = "openai/gpt-5.5-pro";
export const QUESTION_BANK_COUNT_OPTIONS = [5, 10, 20, 25, 50];
export const DEFAULT_QUESTION_BANK_COUNT = 10;
export const QUESTION_BANK_TARGET_COUNT = 100;
export const QUESTION_BANK_SKILL_IDS = ["sirs_1", "sirs_2", "sirs_3", "sirs_4"];

const bankUrl = (fileName) => new URL(fileName, import.meta.url).href;

export const QUESTION_BANKS = [
    {
        id: "cp_core",
        sectionId: "cp",
        shortName: "C/P",
        title: "C/P Core Bank",
        description: "100 pregenerated chemistry and physics questions on selected high-yield topics with all skills.",
        version: "0.1.0",
        targetQuestionCount: 100,
        defaultQuestionCount: DEFAULT_QUESTION_BANK_COUNT,
        questionCountOptions: QUESTION_BANK_COUNT_OPTIONS,
        url: bankUrl("cp.json"),
        topicIds: [
            "cp_work",
            "cp_gas_phase",
            "cp_electrostatics",
            "cp_circuit_elements",
            "cp_electrochemistry",
            "cp_geometrical_optics",
            "cp_stoichiometry",
            "cp_acid_base_equilibria",
            "cp_separations_and_purifications",
            "cp_carboxylic_acids"
        ],
        skillIds: [
            "sirs_1",
            "sirs_2",
            "sirs_3",
            "sirs_4"
        ]
    },
    {
        id: "bb_core",
        sectionId: "bb",
        shortName: "B/B",
        title: "B/B Core Bank",
        description: "100 pregenerated biology and biochemistry questions on selected high-yield topics with all skills.",
        version: "0.1.0",
        targetQuestionCount: 100,
        defaultQuestionCount: DEFAULT_QUESTION_BANK_COUNT,
        questionCountOptions: QUESTION_BANK_COUNT_OPTIONS,
        url: bankUrl("bb.json"),
        topicIds: [
            "bb_amino_acids",
            "bb_protein_structure",
            "bb_control_of_enzyme_activity",
            "bb_transcription",
            "bb_translation",
            "bb_nucleic_acid_structure_and_function",
            "bb_mendelian_concepts",
            "bb_principles_of_bioenergetics",
            "bb_glycolysis_gluconeogenesis_and_the_pentose_phosphate_pathway",
            "bb_oxidative_phosphorylation"
        ],
        skillIds: [
            "sirs_1",
            "sirs_2",
            "sirs_3",
            "sirs_4"
        ]
    },
    {
        id: "ps_core",
        sectionId: "ps",
        shortName: "P/S",
        title: "P/S Core Bank",
        description: "100 pregenerated psychology and sociology questions on selected high-yield topics with all skills.",
        version: "0.1.0",
        targetQuestionCount: 100,
        defaultQuestionCount: DEFAULT_QUESTION_BANK_COUNT,
        questionCountOptions: QUESTION_BANK_COUNT_OPTIONS,
        url: bankUrl("ps.json"),
        topicIds: [
            "ps_sensory_processing",
            "ps_cognition",
            "ps_memory",
            "ps_stress",
            "ps_biological_bases_of_behavior",
            "ps_psychological_disorders",
            "ps_associative_learning",
            "ps_formation_of_identity",
            "ps_theoretical_approaches",
            "ps_social_class"
        ],
        skillIds: [
            "sirs_1",
            "sirs_2",
            "sirs_3",
            "sirs_4"
        ]
    }
];

export const getQuestionBankCatalogEntry = (sectionId) => QUESTION_BANKS.find((bank) => bank.sectionId === sectionId) ?? null;
