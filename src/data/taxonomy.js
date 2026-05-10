export const SECTIONS = [
    {
        id: "cp",
        shortName: "C/P",
        name: "Chemical and Physical Foundations",
        description: "Chemistry, physics, biochemistry, and biology reasoning in biological systems."
    },
    {
        id: "bb",
        shortName: "B/B",
        name: "Biological and Biochemical Foundations",
        description: "Biology and biochemistry reasoning across living systems."
    },
    {
        id: "ps",
        shortName: "P/S",
        name: "Psychological, Social, and Biological Foundations",
        description: "Behavioral science, psychology, sociology, and research reasoning."
    },
    {
        id: "cars",
        shortName: "CARS",
        name: "Critical Analysis and Reasoning Skills",
        description: "Passage comprehension and reasoning. Experimental in OpenMCAT MVP.",
        beta: true
    }
];

export const SCIENCE_SKILLS = [
    {
        id: "sirs_1",
        name: "Concepts and principles",
        shortName: "Concepts",
        description: "Recognize, define, relate, and apply scientific concepts."
    },
    {
        id: "sirs_2",
        name: "Scientific reasoning and problem-solving",
        shortName: "Reasoning",
        description: "Use principles, models, equations, and mechanisms to solve problems."
    },
    {
        id: "sirs_3",
        name: "Research design and execution",
        shortName: "Research design",
        description: "Analyze experiments, variables, controls, methods, validity, and ethics."
    },
    {
        id: "sirs_4",
        name: "Data and statistical reasoning",
        shortName: "Data/statistics",
        description: "Interpret data, tables, figures, uncertainty, trends, and conclusions."
    }
];

export const CARS_SKILLS = [
    {
        id: "cars_1",
        name: "Foundations of comprehension",
        shortName: "Comprehension",
        description: "Identify meaning, structure, tone, and author intent in local context."
    },
    {
        id: "cars_2",
        name: "Reasoning within the text",
        shortName: "Within text",
        description: "Integrate passage claims and evidence into broader interpretations."
    },
    {
        id: "cars_3",
        name: "Reasoning beyond the text",
        shortName: "Beyond text",
        description: "Apply passage ideas to new information, scenarios, or implications."
    }
];

export const TOPICS = [
    {
        id: "cp_atoms_periodic_trends",
        sectionId: "cp",
        name: "Atomic structure and periodic trends",
        shortName: "Atoms/trends",
        description: "Atomic structure and periodic relationships.",
        tags: ["chemistry"]
    },
    {
        id: "cp_bonding_interactions",
        sectionId: "cp",
        name: "Bonding and intermolecular interactions",
        shortName: "Bonding/interactions",
        description: "Bonding, structure, and intermolecular forces.",
        tags: ["chemistry"]
    },
    {
        id: "cp_stoichiometry",
        sectionId: "cp",
        name: "Stoichiometry and solutions",
        shortName: "Stoichiometry",
        description: "Moles, concentration, reaction balancing, and solutions.",
        tags: ["chemistry"]
    },
    {
        id: "cp_thermo_kinetics",
        sectionId: "cp",
        name: "Thermodynamics and kinetics",
        shortName: "Thermo/kinetics",
        description: "Energy, equilibrium tendencies, rates, and mechanisms.",
        tags: ["chemistry", "physics"]
    },
    {
        id: "cp_equilibrium_acids_bases",
        sectionId: "cp",
        name: "Equilibrium, acids, and bases",
        shortName: "Equilibrium/acids-bases",
        description: "Equilibrium constants, buffers, and titration behavior.",
        tags: ["chemistry"]
    },
    {
        id: "cp_electrochemistry",
        sectionId: "cp",
        name: "Redox and electrochemistry",
        shortName: "Electrochemistry",
        description: "Redox, galvanic/electrolytic behavior, and potentials.",
        tags: ["chemistry"]
    },
    {
        id: "cp_separations_spectroscopy",
        sectionId: "cp",
        name: "Separations and spectroscopy",
        shortName: "Lab methods",
        description: "Chromatography, extraction, and spectral interpretation.",
        tags: ["lab"]
    },
    {
        id: "cp_organic_structure_reactivity",
        sectionId: "cp",
        name: "Organic structure and reactivity",
        shortName: "Organic reactivity",
        description: "Functional groups, stereochemistry, and reaction logic.",
        tags: ["organic"]
    },
    {
        id: "cp_mechanics_fluids",
        sectionId: "cp",
        name: "Mechanics and fluids",
        shortName: "Mechanics/fluids",
        description: "Forces, motion, pressure, and fluid flow.",
        tags: ["physics"]
    },
    {
        id: "cp_electricity_magnetism",
        sectionId: "cp",
        name: "Electricity and magnetism",
        shortName: "E&M",
        description: "Charge, fields, circuits, and magnetic interactions.",
        tags: ["physics"]
    },
    {
        id: "cp_waves_light_sound",
        sectionId: "cp",
        name: "Waves, light, and sound",
        shortName: "Waves/light",
        description: "Wave behavior, optics, and acoustics.",
        tags: ["physics"]
    },
    {
        id: "cp_biochem_foundations",
        sectionId: "cp",
        name: "Biochemistry foundations in C/P",
        shortName: "Biochem in C/P",
        description: "Biochemical concepts commonly integrated into C/P contexts.",
        tags: ["biochemistry"]
    },
    {
        id: "bb_amino_acids_proteins",
        sectionId: "bb",
        name: "Amino acids and proteins",
        shortName: "Amino acids/proteins",
        description: "Structure, charge, folding, and protein function.",
        tags: ["biochemistry", "high-yield"]
    },
    {
        id: "bb_enzymes",
        sectionId: "bb",
        name: "Enzymes and regulation",
        shortName: "Enzymes",
        description: "Kinetics, inhibition, and regulatory control.",
        tags: ["biochemistry", "high-yield"]
    },
    {
        id: "bb_carbs_lipids_membranes",
        sectionId: "bb",
        name: "Carbohydrates, lipids, and membranes",
        shortName: "Carbs/lipids/membranes",
        description: "Macromolecule properties and membrane transport.",
        tags: ["biochemistry"]
    },
    {
        id: "bb_dna_rna_genetics",
        sectionId: "bb",
        name: "DNA, RNA, and genetics",
        shortName: "Genetics",
        description: "Genetic information flow and inheritance patterns.",
        tags: ["biology"]
    },
    {
        id: "bb_metabolism_bioenergetics",
        sectionId: "bb",
        name: "Metabolism and bioenergetics",
        shortName: "Metabolism",
        description: "Pathways, energy transfer, and regulation.",
        tags: ["biochemistry"]
    },
    {
        id: "bb_cell_structure_function",
        sectionId: "bb",
        name: "Cell structure and function",
        shortName: "Cell structure/function",
        description: "Organelles, membranes, and cell processes.",
        tags: ["biology"]
    },
    {
        id: "bb_cell_cycle_reproduction",
        sectionId: "bb",
        name: "Cell cycle and reproduction",
        shortName: "Cell cycle/reproduction",
        description: "Division, inheritance, and developmental basics.",
        tags: ["biology"]
    },
    {
        id: "bb_signaling_endocrine",
        sectionId: "bb",
        name: "Cell signaling and endocrine control",
        shortName: "Signaling/endocrine",
        description: "Signal transduction and hormonal coordination.",
        tags: ["biology"]
    },
    {
        id: "bb_nervous_muscle",
        sectionId: "bb",
        name: "Nervous and muscle systems",
        shortName: "Nervous/muscle",
        description: "Neural signaling, muscle contraction, and integration.",
        tags: ["physiology"]
    },
    {
        id: "bb_cardiovascular_respiratory",
        sectionId: "bb",
        name: "Cardiovascular and respiratory systems",
        shortName: "Cardio/respiratory",
        description: "Circulation, gas exchange, and related physiology.",
        tags: ["physiology"]
    },
    {
        id: "bb_renal_digestive",
        sectionId: "bb",
        name: "Renal and digestive systems",
        shortName: "Renal/digestive",
        description: "Filtration, absorption, and fluid balance.",
        tags: ["physiology"]
    },
    {
        id: "bb_immune_homeostasis",
        sectionId: "bb",
        name: "Immune function and homeostasis",
        shortName: "Immune/homeostasis",
        description: "Defense systems and physiological balance.",
        tags: ["physiology"]
    },
    {
        id: "ps_sensation_perception",
        sectionId: "ps",
        name: "Sensation and perception",
        shortName: "Sensation/perception",
        description: "Sensory pathways and perceptual processing.",
        tags: ["psychology"]
    },
    {
        id: "ps_learning_behavior",
        sectionId: "ps",
        name: "Learning and behavior change",
        shortName: "Learning/behavior",
        description: "Conditioning, reinforcement, and behavior patterns.",
        tags: ["psychology"]
    },
    {
        id: "ps_memory_cognition",
        sectionId: "ps",
        name: "Memory and cognition",
        shortName: "Memory/cognition",
        description: "Encoding, retrieval, language, and reasoning.",
        tags: ["psychology"]
    },
    {
        id: "ps_consciousness_sleep",
        sectionId: "ps",
        name: "Consciousness and sleep",
        shortName: "Consciousness/sleep",
        description: "Sleep stages, awareness, and psychoactive effects.",
        tags: ["psychology"]
    },
    {
        id: "ps_emotion_stress_motivation",
        sectionId: "ps",
        name: "Emotion, stress, and motivation",
        shortName: "Emotion/stress",
        description: "Affect, stress responses, and motivational theories.",
        tags: ["psychology"]
    },
    {
        id: "ps_identity_personality",
        sectionId: "ps",
        name: "Identity and personality",
        shortName: "Identity/personality",
        description: "Self-concept, development, and personality models.",
        tags: ["psychology", "sociology"]
    },
    {
        id: "ps_social_interaction",
        sectionId: "ps",
        name: "Social interaction and behavior",
        shortName: "Social interaction",
        description: "Groups, influence, and social behavior dynamics.",
        tags: ["sociology"]
    },
    {
        id: "ps_social_structure",
        sectionId: "ps",
        name: "Social structure and institutions",
        shortName: "Social structure",
        description: "Institutions, demographics, and social organization.",
        tags: ["sociology"]
    },
    {
        id: "ps_culture_inequality",
        sectionId: "ps",
        name: "Culture, inequality, and disparities",
        shortName: "Culture/inequality",
        description: "Cultural systems, stratification, and disparities.",
        tags: ["sociology"]
    },
    {
        id: "ps_research_methods_stats",
        sectionId: "ps",
        name: "Behavioral research methods and statistics",
        shortName: "Research methods/stats",
        description: "Study designs, data interpretation, and basic statistics.",
        tags: ["research", "statistics"]
    },
    {
        id: "cars_humanities",
        sectionId: "cars",
        name: "Humanities passages",
        shortName: "Humanities",
        description: "Reading and argument interpretation in humanities contexts.",
        tags: ["cars"],
        beta: true
    },
    {
        id: "cars_social_sciences",
        sectionId: "cars",
        name: "Social sciences passages",
        shortName: "Social sciences",
        description: "Reading and interpretation in social science contexts.",
        tags: ["cars"],
        beta: true
    },
    {
        id: "cars_author_argument",
        sectionId: "cars",
        name: "Author argument and tone",
        shortName: "Argument/tone",
        description: "Main idea, argument form, and author perspective.",
        tags: ["cars"],
        beta: true
    },
    {
        id: "cars_evidence_structure",
        sectionId: "cars",
        name: "Evidence and structure",
        shortName: "Evidence/structure",
        description: "How evidence and structure support claims.",
        tags: ["cars"],
        beta: true
    },
    {
        id: "cars_application",
        sectionId: "cars",
        name: "Application and implications",
        shortName: "Application",
        description: "Applying passage logic to new scenarios.",
        tags: ["cars"],
        beta: true
    }
];

export const DIFFICULTIES = [
    { id: "easy", name: "Easy" },
    { id: "medium", name: "Medium" },
    { id: "hard", name: "Hard" }
];

export const QUESTION_FORMATS = [
    { id: "discrete", name: "Discrete", description: "Short standalone items." },
    { id: "mini_passage", name: "Mini-passage", description: "Short passage with related questions." },
    { id: "mixed", name: "Mixed", description: "Blend of discrete and passage." },
    { id: "cars_beta", name: "CARS beta", description: "Experimental passage reasoning workflow.", beta: true }
];

export const getSectionById = (sectionId) => SECTIONS.find((section) => section.id === sectionId) ?? null;

export const getTopicsBySection = (sectionId) => TOPICS.filter((topic) => topic.sectionId === sectionId);

export const getSkillsForSection = (sectionId) => sectionId === "cars" ? CARS_SKILLS : SCIENCE_SKILLS;

export const getTopicById = (topicId) => TOPICS.find((topic) => topic.id === topicId) ?? null;

export const getSkillById = (skillId) => [...SCIENCE_SKILLS, ...CARS_SKILLS].find((skill) => skill.id === skillId);
