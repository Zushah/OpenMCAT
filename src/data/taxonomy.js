export const SECTIONS = [
    {
        id: "cp",
        shortName: "C/P",
        name: "Chemical and Physical Foundations of Biological Systems",
        description: "Tests chemical, physical, and biochemical principles through their application to biological systems and human body functions."
    },
    {
        id: "bb",
        shortName: "B/B",
        name: "Biological and Biochemical Foundations of Living Systems",
        description: "Tests biological and biochemical processes that support life, from molecular and cellular mechanisms to integrated organ-system function."
    },
    {
        id: "ps",
        shortName: "P/S",
        name: "Psychological, Social, and Biological Foundations of Behavior",
        description: "Tests how psychological, social, and biological factors shape behavior, health, well-being, identity, culture, and access to resources."
    },
    {
        id: "cars",
        shortName: "CARS",
        name: "Critical Analysis and Reasoning Skills",
        description: "Tests critical analysis and reasoning skills through close reading of humanities and social science passages, emphasizing comprehension and reasoning both within and beyond the text. Currently an experimental section in OpenMCAT.",
        beta: true
    }
];

export const SCIENCE_SKILLS = [
    {
        id: "sirs_1",
        name: "Knowledge of Scientific Concepts and Principles",
        shortName: "Knowledge of Scientific Concepts and Principles",
        description: "Construct questions that require recognition, recall, definition, representation, and direct application of scientific concepts and relationships. Concepts may be expressed in prose, equations, graphs, tables, diagrams, or other scientific representations."
    },
    {
        id: "sirs_2",
        name: "Scientific Reasoning and Problem Solving",
        shortName: "Scientific Reasoning and Problem Solving",
        description: "Construct questions that require students to use scientific knowledge, theories, models, observations, equations, or mechanisms to explain phenomena, make predictions, evaluate explanations, judge cause-and-effect claims, or solve qualitative and quantitative problems."
    },
    {
        id: "sirs_3",
        name: "Reasoning about the Design and Execution of Research",
        shortName: "Reasoning about the Design and Execution of Research",
        description: "Construct questions that center scientific inquiry: forming hypotheses, choosing samples, identifying variables and controls, evaluating measurements and procedures, detecting confounds or faulty logic, recognizing study limitations, and applying ethical research constraints."
    },
    {
        id: "sirs_4",
        name: "Data-based and Statistical Reasoning",
        shortName: "Data-based and Statistical Reasoning",
        description: "Construct questions that require reasoning from data in tables, graphs, charts, figures, or study results. Emphasize pattern detection, comparisons between variables, uncertainty, random and systematic error, statistical interpretation, warranted conclusions, and alternative explanations."
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

const buildTopic = (topic) => {
    const subtopics = topic.subtopics ?? [];
    return {
        ...topic,
        shortName: topic.name,
        description: subtopics.length ? `Includes ${subtopics.join(", ")}.` : "Topic area from the MCAT content scope.",
        tags: topic.tags ?? []
    };
};

const SCIENCE_TOPIC_DATA = [
    {
        id: "cp_translational_motion",
        sectionId: "cp",
        name: "Translational Motion",
        subtopics: ["units and dimensions", "vectors", "speed and velocity", "acceleration"]
    },
    {
        id: "cp_force",
        sectionId: "cp",
        name: "Force",
        subtopics: ["Newton's Laws", "friction", "center of mass"]
    },
    {
        id: "cp_equilibrium_vector_analysis_of_forces",
        sectionId: "cp",
        name: "Equilibrium",
        subtopics: ["vector analysis of forces", "torques", "lever arms"]
    },
    {
        id: "cp_work",
        sectionId: "cp",
        name: "Work",
        subtopics: ["work done by a constant force", "mechanical advantage", "Work Kinetic Energy Theorem", "conservative forces"]
    },
    {
        id: "cp_energy_of_point_object_systems",
        sectionId: "cp",
        name: "Energy of Point Object Systems",
        subtopics: ["kinetic energy", "potential energy", "conservation of energy", "power"]
    },
    {
        id: "cp_periodic_motion",
        sectionId: "cp",
        name: "Periodic Motion",
        subtopics: ["amplitude", "frequency", "phase", "transverse and longitudinal waves"]
    },
    {
        id: "cp_fluids",
        sectionId: "cp",
        name: "Fluids",
        subtopics: ["density", "specific gravity", "buoyancy", "hydrostatic pressure", "Poiseuille Flow"]
    },
    {
        id: "cp_gas_phase",
        sectionId: "cp",
        name: "Gas Phase",
        subtopics: ["absolute temperature", "Ideal Gas Law", "Kinetic Molecular Theory of Gases", "heat capacity", "partial pressure"]
    },
    {
        id: "cp_electrostatics",
        sectionId: "cp",
        name: "Electrostatics",
        subtopics: ["charge", "Coulomb's Law", "electric field", "electrostatic energy", "electric potential"]
    },
    {
        id: "cp_circuit_elements",
        sectionId: "cp",
        name: "Circuit Elements",
        subtopics: ["current", "electromotive force", "resistance", "capacitance", "conductivity"]
    },
    {
        id: "cp_magnetism",
        sectionId: "cp",
        name: "Magnetism",
        subtopics: ["definition of magnetic field", "motion of charged particles", "Lorentz force"]
    },
    {
        id: "cp_electrochemistry",
        sectionId: "cp",
        name: "Electrochemistry",
        subtopics: ["electrolytic cell", "Faraday's Law", "galvanic cells", "reduction potentials", "concentration cell"]
    },
    {
        id: "cp_sound",
        sectionId: "cp",
        name: "Sound",
        subtopics: ["production of sound", "intensity", "attenuation", "Doppler Effect", "resonance"]
    },
    {
        id: "cp_light_and_electromagnetic_radiation",
        sectionId: "cp",
        name: "Light and Electromagnetic Radiation",
        subtopics: ["interference", "diffraction", "polarization", "velocity", "visual spectrum"]
    },
    {
        id: "cp_molecular_structure_and_absorption_spectra",
        sectionId: "cp",
        name: "Molecular Structure and Absorption Spectra",
        subtopics: ["infrared region", "visible region", "ultraviolet region", "NMR spectroscopy", "spin-spin splitting"]
    },
    {
        id: "cp_geometrical_optics",
        sectionId: "cp",
        name: "Geometrical Optics",
        subtopics: ["reflection", "refraction", "total internal reflection", "spherical mirrors", "thin lenses"]
    },
    {
        id: "cp_atomic_nucleus",
        sectionId: "cp",
        name: "Atomic Nucleus",
        subtopics: ["atomic number", "neutrons and protons", "nuclear forces", "radioactive decay", "mass spectrometer"]
    },
    {
        id: "cp_electronic_structure",
        sectionId: "cp",
        name: "Electronic Structure",
        subtopics: ["orbital structure", "ground and excited states", "absorption and emission line spectra", "Pauli Exclusion Principle", "Heisenberg Uncertainty Principle"]
    },
    {
        id: "cp_the_periodic_table_and_classification_of_elements",
        sectionId: "cp",
        name: "The Periodic Table and Classification of Elements",
        subtopics: ["alkali metals", "halogens", "noble gases", "transition metals", "representative elements"]
    },
    {
        id: "cp_variations_of_chemical_properties_with_group_and_row",
        sectionId: "cp",
        name: "Variations of Chemical Properties with Group and Row",
        subtopics: ["valence electrons", "ionization energy", "electron affinity", "electronegativity", "electron shells"]
    },
    {
        id: "cp_stoichiometry",
        sectionId: "cp",
        name: "Stoichiometry",
        subtopics: ["molecular weight", "empirical vs. molecular formula", "mole concept", "oxidation number", "balancing equations"]
    },
    {
        id: "cp_acid_base_equilibria",
        sectionId: "cp",
        name: "Acid-Base Equilibria",
        subtopics: ["Brønsted-Lowry definition", "ionization of water", "conjugate acids and bases", "strong and weak acids/bases", "buffers"]
    },
    {
        id: "cp_ions_in_solutions",
        sectionId: "cp",
        name: "Ions in Solutions",
        subtopics: ["anion and cation nomenclature", "hydration", "hydronium ion"]
    },
    {
        id: "cp_solubility",
        sectionId: "cp",
        name: "Solubility",
        subtopics: ["units of concentration", "solubility product constant", "common-ion effect", "complex ion formation", "solubility and pH"]
    },
    {
        id: "cp_titration",
        sectionId: "cp",
        name: "Titration",
        subtopics: ["indicators", "neutralization", "interpretation of titration curves", "redox titration"]
    },
    {
        id: "cp_covalent_bond",
        sectionId: "cp",
        name: "Covalent Bond",
        subtopics: ["Lewis electron dot formulas", "formal charge", "dipole moment", "hybrid orbitals", "stereochemistry"]
    },
    {
        id: "cp_liquid_phase_and_intermolecular_forces",
        sectionId: "cp",
        name: "Liquid Phase and Intermolecular Forces",
        subtopics: ["hydrogen bonding", "dipole interactions", "Van der Waals' Forces"]
    },
    {
        id: "cp_separations_and_purifications",
        sectionId: "cp",
        name: "Separations and Purifications",
        subtopics: ["extraction", "distillation", "chromatography", "electrophoresis", "racemic mixtures"]
    },
    {
        id: "cp_nucleotides_and_nucleic_acids",
        sectionId: "cp",
        name: "Nucleotides and Nucleic Acids",
        subtopics: ["nucleotides and nucleosides", "sugar phosphate backbone", "pyrimidine and purine residues", "DNA and RNA structure"]
    },
    {
        id: "cp_amino_acids_peptides_and_proteins",
        sectionId: "cp",
        name: "Amino Acids, Peptides, and Proteins",
        subtopics: ["absolute configuration", "dipolar ions", "synthesis of alpha-amino acids", "peptide linkage", "isoelectric point"]
    },
    {
        id: "cp_three_dimensional_protein_structure",
        sectionId: "cp",
        name: "Three-Dimensional Protein Structure",
        subtopics: ["conformational stability", "hydrophobic interactions", "solvation layer", "quaternary structure", "denaturing and folding"]
    },
    {
        id: "cp_nonenzymatic_protein_function",
        sectionId: "cp",
        name: "Nonenzymatic Protein Function",
        subtopics: ["binding", "immune system", "motor"]
    },
    {
        id: "cp_lipids",
        sectionId: "cp",
        name: "Lipids",
        subtopics: ["triacyl glycerols", "free fatty acids", "phospholipids", "fat-soluble vitamins", "steroids"]
    },
    {
        id: "cp_carbohydrates",
        sectionId: "cp",
        name: "Carbohydrates",
        subtopics: ["nomenclature and classification", "absolute configuration", "cyclic structure", "epimers and anomers", "hydrolysis of the glycoside linkage"]
    },
    {
        id: "cp_aldehydes_and_ketones",
        sectionId: "cp",
        name: "Aldehydes and Ketones",
        subtopics: ["nucleophilic addition reactions", "imine/enamine", "cyanohydrin", "oxidation", "keto-enol tautomerism"]
    },
    {
        id: "cp_alcohols",
        sectionId: "cp",
        name: "Alcohols",
        subtopics: ["physical properties", "oxidation", "substitution reactions", "protection of alcohols", "mesylates and tosylates"]
    },
    {
        id: "cp_carboxylic_acids",
        sectionId: "cp",
        name: "Carboxylic Acids",
        subtopics: ["physical properties", "carboxyl group reactions", "amides/esters/anhydride formation", "reduction", "decarboxylation"]
    },
    {
        id: "cp_acid_derivatives",
        sectionId: "cp",
        name: "Acid Derivatives",
        subtopics: ["nucleophilic substitution", "transesterification", "hydrolysis of amides", "relative reactivity", "steric and electronic effects"]
    },
    {
        id: "cp_phenols",
        sectionId: "cp",
        name: "Phenols",
        subtopics: ["oxidation and reduction", "hydroquinones", "biological 2e- redox centers"]
    },
    {
        id: "cp_polycyclic_and_heterocyclic_aromatic_compounds",
        sectionId: "cp",
        name: "Polycyclic and Heterocyclic Aromatic Compounds",
        subtopics: ["biological aromatic heterocycles"]
    },
    {
        id: "cp_enzymes",
        sectionId: "cp",
        name: "Enzymes",
        subtopics: ["classification by reaction type", "active-site model", "Michaelis-Menten kinetics", "inhibition", "allosteric regulation"]
    },
    {
        id: "cp_principles_of_bioenergetics",
        sectionId: "cp",
        name: "Principles of Bioenergetics",
        subtopics: ["free energy", "ATP hydrolysis", "biological oxidation-reduction", "half-reactions", "soluble electron carriers"]
    },
    {
        id: "cp_thermochemistry_and_thermodynamics",
        sectionId: "cp",
        name: "Thermochemistry and Thermodynamics",
        subtopics: ["First Law", "PV diagram", "Second Law", "heat transfer", "enthalpy and standard heats"]
    },
    {
        id: "cp_kinetics_and_rate_processes_in_chemical_reactions",
        sectionId: "cp",
        name: "Kinetics and Rate Processes in Chemical Reactions",
        subtopics: ["reaction rate", "rate law", "activation energy", "Arrhenius Equation", "catalysts"]
    },
    {
        id: "cp_equilibrium_law_of_mass_action",
        sectionId: "cp",
        name: "Equilibrium",
        subtopics: ["Law of Mass Action", "equilibrium constant", "Le Châtelier's Principle", "relationship of the equilibrium constant and standard free energy change"]
    },
    {
        id: "bb_amino_acids",
        sectionId: "bb",
        name: "Amino Acids",
        subtopics: ["absolute configuration", "dipolar ions", "classification", "reactions"]
    },
    {
        id: "bb_protein_structure",
        sectionId: "bb",
        name: "Protein Structure",
        subtopics: ["primary structure", "secondary structure", "tertiary structure", "denaturing and folding", "isoelectric point"]
    },
    {
        id: "bb_nonenzymatic_protein_function",
        sectionId: "bb",
        name: "Nonenzymatic Protein Function",
        subtopics: ["binding", "immune system", "motors"]
    },
    {
        id: "bb_enzyme_structure_and_function",
        sectionId: "bb",
        name: "Enzyme Structure and Function",
        subtopics: ["mechanism of catalysis", "cofactors", "active site model", "induced-fit model"]
    },
    {
        id: "bb_control_of_enzyme_activity",
        sectionId: "bb",
        name: "Control of Enzyme Activity",
        subtopics: ["Michaelis-Menten kinetics", "cooperativity", "feedback regulation", "allosteric enzymes"]
    },
    {
        id: "bb_nucleic_acid_structure_and_function",
        sectionId: "bb",
        name: "Nucleic Acid Structure and Function",
        subtopics: ["nucleotides and nucleosides", "sugar phosphate backbone", "DNA double helix", "Watson-Crick model"]
    },
    {
        id: "bb_dna_replication",
        sectionId: "bb",
        name: "DNA Replication",
        subtopics: ["mechanism of replication", "semiconservative nature", "origins of replication"]
    },
    {
        id: "bb_repair_of_dna",
        sectionId: "bb",
        name: "Repair of DNA",
        subtopics: ["repair during replication", "repair of mutations"]
    },
    {
        id: "bb_genetic_code",
        sectionId: "bb",
        name: "Genetic Code",
        subtopics: ["central dogma", "triplet code", "codon-anticodon relationship"]
    },
    {
        id: "bb_transcription",
        sectionId: "bb",
        name: "Transcription",
        subtopics: ["mechanism of transcription", "mRNA processing", "ribozymes"]
    },
    {
        id: "bb_translation",
        sectionId: "bb",
        name: "Translation",
        subtopics: ["roles of mRNA/tRNA/rRNA", "role of ribosomes", "post-translational modification"]
    },
    {
        id: "bb_eukaryotic_chromosome_organization",
        sectionId: "bb",
        name: "Eukaryotic Chromosome Organization",
        subtopics: ["chromosomal proteins", "single copy vs. repetitive DNA", "telomeres"]
    },
    {
        id: "bb_control_of_gene_expression_in_prokaryotes",
        sectionId: "bb",
        name: "Control of Gene Expression in Prokaryotes",
        subtopics: ["Operon Concept", "gene repression", "positive control"]
    },
    {
        id: "bb_control_of_gene_expression_in_eukaryotes",
        sectionId: "bb",
        name: "Control of Gene Expression in Eukaryotes",
        subtopics: ["transcriptional regulation", "DNA binding proteins", "DNA methylation"]
    },
    {
        id: "bb_recombinant_dna_and_biotechnology",
        sectionId: "bb",
        name: "Recombinant DNA and Biotechnology",
        subtopics: ["restriction enzymes", "DNA libraries", "polymerase chain reaction", "gel electrophoresis"]
    },
    {
        id: "bb_mendelian_concepts",
        sectionId: "bb",
        name: "Mendelian Concepts",
        subtopics: ["phenotype and genotype", "allele", "complete dominance", "independent assortment"]
    },
    {
        id: "bb_meiosis_and_other_factors_affecting_genetic_variability",
        sectionId: "bb",
        name: "Meiosis and Other Factors Affecting Genetic Variability",
        subtopics: ["significance of meiosis", "crossing-over", "sex-linked characteristics"]
    },
    {
        id: "bb_analytic_methods",
        sectionId: "bb",
        name: "Analytic Methods",
        subtopics: ["Hardy-Weinberg Principle", "testcross", "gene mapping"]
    },
    {
        id: "bb_evolution",
        sectionId: "bb",
        name: "Evolution",
        subtopics: ["natural selection", "speciation", "bottlenecks"]
    },
    {
        id: "bb_principles_of_bioenergetics",
        sectionId: "bb",
        name: "Principles of Bioenergetics",
        subtopics: ["free energy", "Le Châtelier's Principle", "ATP hydrolysis", "biological oxidation-reduction"]
    },
    {
        id: "bb_carbohydrates",
        sectionId: "bb",
        name: "Carbohydrates",
        subtopics: ["nomenclature and classification", "absolute configuration", "monosaccharides", "disaccharides"]
    },
    {
        id: "bb_glycolysis_gluconeogenesis_and_the_pentose_phosphate_pathway",
        sectionId: "bb",
        name: "Glycolysis, Gluconeogenesis, and the Pentose Phosphate Pathway",
        subtopics: ["glycolysis", "fermentation", "gluconeogenesis"]
    },
    {
        id: "bb_principles_of_metabolic_regulation",
        sectionId: "bb",
        name: "Principles of Metabolic Regulation",
        subtopics: ["regulation of metabolic pathways", "maintenance of a dynamic steady state", "allosteric control"]
    },
    {
        id: "bb_citric_acid_cycle",
        sectionId: "bb",
        name: "Citric Acid Cycle",
        subtopics: ["acetyl-CoA production", "reactions of the cycle", "regulation of the cycle"]
    },
    {
        id: "bb_metabolism_of_fatty_acids_and_proteins",
        sectionId: "bb",
        name: "Metabolism of Fatty Acids and Proteins",
        subtopics: ["digestion/mobilization/transport of fats", "oxidation of fatty acids", "ketone bodies"]
    },
    {
        id: "bb_oxidative_phosphorylation",
        sectionId: "bb",
        name: "Oxidative Phosphorylation",
        subtopics: ["electron transport chain", "ATP synthase", "chemiosmotic coupling", "apoptosis"]
    },
    {
        id: "bb_hormonal_regulation_and_integration_of_metabolism",
        sectionId: "bb",
        name: "Hormonal Regulation and Integration of Metabolism",
        subtopics: ["tissue-specific metabolism", "hormonal regulation of fuel metabolism", "obesity"]
    },
    {
        id: "bb_plasma_membrane",
        sectionId: "bb",
        name: "Plasma Membrane",
        subtopics: ["lipid components", "fluid mosaic model", "membrane dynamics", "membrane potential"]
    },
    {
        id: "bb_membrane_bound_organelles_and_defining_characteristics_of_eukaryotic_cells",
        sectionId: "bb",
        name: "Membrane-Bound Organelles and Defining Characteristics of Eukaryotic Cells",
        subtopics: ["nucleus", "mitochondria", "lysosomes", "endoplasmic reticulum", "Golgi apparatus"]
    },
    {
        id: "bb_cytoskeleton",
        sectionId: "bb",
        name: "Cytoskeleton",
        subtopics: ["microfilaments", "microtubules", "intermediate filaments", "cilia and flagella"]
    },
    {
        id: "bb_tissues_formed_from_eukaryotic_cells",
        sectionId: "bb",
        name: "Tissues Formed From Eukaryotic Cells",
        subtopics: ["epithelial cells", "connective tissue cells"]
    },
    {
        id: "bb_cell_theory",
        sectionId: "bb",
        name: "Cell Theory",
        subtopics: ["history and development", "impact on biology"]
    },
    {
        id: "bb_classification_and_structure_of_prokaryotic_cells",
        sectionId: "bb",
        name: "Classification and Structure of Prokaryotic Cells",
        subtopics: ["prokaryotic domains", "bacilli/spirilli/cocci", "lack of nuclear membrane"]
    },
    {
        id: "bb_growth_and_physiology_of_prokaryotic_cells",
        sectionId: "bb",
        name: "Growth and Physiology of Prokaryotic Cells",
        subtopics: ["reproduction by fission", "exponential growth", "chemotaxis"]
    },
    {
        id: "bb_genetics_of_prokaryotic_cells",
        sectionId: "bb",
        name: "Genetics of Prokaryotic Cells",
        subtopics: ["plasmids", "transformation", "conjugation", "transposons"]
    },
    {
        id: "bb_virus_structure",
        sectionId: "bb",
        name: "Virus Structure",
        subtopics: ["general structural characteristics", "lack organelles", "genomic content RNA or DNA"]
    },
    {
        id: "bb_viral_life_cycle",
        sectionId: "bb",
        name: "Viral Life Cycle",
        subtopics: ["attachment to host", "retrovirus life cycle", "prions and viroids"]
    },
    {
        id: "bb_mitosis",
        sectionId: "bb",
        name: "Mitosis",
        subtopics: ["mitotic process", "mitotic structures", "phases of cell cycle", "loss of cell cycle controls in cancer"]
    },
    {
        id: "bb_reproductive_system_gametogenesis_by_meiosis",
        sectionId: "bb",
        name: "Reproductive System",
        subtopics: ["gametogenesis by meiosis", "ovum and sperm", "reproductive sequence"]
    },
    {
        id: "bb_embryogenesis",
        sectionId: "bb",
        name: "Embryogenesis",
        subtopics: ["fertilization", "cleavage", "gastrulation", "neurulation"]
    },
    {
        id: "bb_mechanisms_of_development",
        sectionId: "bb",
        name: "Mechanisms of Development",
        subtopics: ["cell specialization", "cell-cell communication", "stem cells", "programmed cell death"]
    },
    {
        id: "bb_nervous_system_structure_and_function",
        sectionId: "bb",
        name: "Nervous System Structure and Function",
        subtopics: ["sensor and effector neurons", "sympathetic and parasympathetic nervous systems", "reflexes"]
    },
    {
        id: "bb_nerve_cell",
        sectionId: "bb",
        name: "Nerve Cell",
        subtopics: ["dendrites", "axon", "action potential", "synapse"]
    },
    {
        id: "bb_electrochemistry",
        sectionId: "bb",
        name: "Electrochemistry",
        subtopics: ["concentration cell", "Nernst equation"]
    },
    {
        id: "bb_biosignaling",
        sectionId: "bb",
        name: "Biosignaling",
        subtopics: ["gated ion channels", "receptor enzymes", "G protein-coupled receptors"]
    },
    {
        id: "bb_lipids",
        sectionId: "bb",
        name: "Lipids",
        subtopics: ["steroids", "terpenes and terpenoids"]
    },
    {
        id: "bb_endocrine_system_hormones_and_their_sources",
        sectionId: "bb",
        name: "Endocrine System Hormones and Their Sources",
        subtopics: ["major endocrine glands", "major types of hormones", "neuroendocrinology"]
    },
    {
        id: "bb_endocrine_system_mechanisms_of_hormone_action",
        sectionId: "bb",
        name: "Endocrine System Mechanisms of Hormone Action",
        subtopics: ["cellular mechanisms", "transport of hormones", "specificity", "regulation by second messengers"]
    },
    {
        id: "bb_respiratory_system",
        sectionId: "bb",
        name: "Respiratory System",
        subtopics: ["gas exchange", "thermoregulation", "structure of lungs and alveoli", "breathing mechanisms"]
    },
    {
        id: "bb_circulatory_system",
        sectionId: "bb",
        name: "Circulatory System",
        subtopics: ["arterial and venous systems", "capillary beds", "composition of blood", "oxygen transport"]
    },
    {
        id: "bb_lymphatic_system",
        sectionId: "bb",
        name: "Lymphatic System",
        subtopics: ["structure of lymphatic system", "equalization of fluid distribution", "production of lymphocytes"]
    },
    {
        id: "bb_immune_system",
        sectionId: "bb",
        name: "Immune System",
        subtopics: ["innate vs. adaptive immunity", "macrophages", "antigen-antibody recognition", "major histocompatibility complex"]
    },
    {
        id: "bb_digestive_system",
        sectionId: "bb",
        name: "Digestive System",
        subtopics: ["ingestion", "stomach", "liver", "small intestine", "large intestine"]
    },
    {
        id: "bb_excretory_system",
        sectionId: "bb",
        name: "Excretory System",
        subtopics: ["roles in homeostasis", "kidney structure", "nephron structure", "formation of urine"]
    },
    {
        id: "bb_reproductive_system_male_and_female_reproductive_structures",
        sectionId: "bb",
        name: "Reproductive System",
        subtopics: ["male and female reproductive structures", "gonads", "hormonal control of reproduction"]
    },
    {
        id: "bb_muscle_system",
        sectionId: "bb",
        name: "Muscle System",
        subtopics: ["functions", "structure of three basic muscle types", "oxygen debt", "nervous control"]
    },
    {
        id: "bb_specialized_cell_muscle_cell",
        sectionId: "bb",
        name: "Specialized Cell - Muscle Cell",
        subtopics: ["structural characteristics", "sarcomeres", "calcium regulation of contraction"]
    },
    {
        id: "bb_skeletal_system",
        sectionId: "bb",
        name: "Skeletal System",
        subtopics: ["functions", "skeletal structure", "bone structure", "cartilage"]
    },
    {
        id: "bb_skin_system",
        sectionId: "bb",
        name: "Skin System",
        subtopics: ["layer differentiation", "functions in thermoregulation", "physical protection"]
    },
    {
        id: "ps_sensory_processing",
        sectionId: "ps",
        name: "Sensory Processing",
        subtopics: ["sensation", "threshold", "sensory receptors", "sensory pathways"]
    },
    {
        id: "ps_vision",
        sectionId: "ps",
        name: "Vision",
        subtopics: ["structure and function of the eye", "visual processing", "parallel processing", "feature detection"]
    },
    {
        id: "ps_hearing",
        sectionId: "ps",
        name: "Hearing",
        subtopics: ["structure and function of the ear", "auditory processing", "sensory reception by hair cells"]
    },
    {
        id: "ps_other_senses",
        sectionId: "ps",
        name: "Other Senses",
        subtopics: ["somatosensation", "taste", "smell", "kinesthetic sense"]
    },
    {
        id: "ps_perception",
        sectionId: "ps",
        name: "Perception",
        subtopics: ["bottom-up/top-down processing", "perceptual organization", "Gestalt principles"]
    },
    {
        id: "ps_attention",
        sectionId: "ps",
        name: "Attention",
        subtopics: ["selective attention", "divided attention"]
    },
    {
        id: "ps_cognition",
        sectionId: "ps",
        name: "Cognition",
        subtopics: ["information-processing model", "cognitive development", "problem-solving and decision-making", "intellectual functioning"]
    },
    {
        id: "ps_consciousness",
        sectionId: "ps",
        name: "Consciousness",
        subtopics: ["states of consciousness", "sleep", "dreaming", "consciousness-altering drugs"]
    },
    {
        id: "ps_memory",
        sectionId: "ps",
        name: "Memory",
        subtopics: ["encoding", "storage", "retrieval", "forgetting"]
    },
    {
        id: "ps_language",
        sectionId: "ps",
        name: "Language",
        subtopics: ["theories of language development", "influence of language on cognition", "brain areas that control language and speech"]
    },
    {
        id: "ps_emotion",
        sectionId: "ps",
        name: "Emotion",
        subtopics: ["three components of emotion", "universal emotions", "theories of emotion", "role of the limbic system"]
    },
    {
        id: "ps_stress",
        sectionId: "ps",
        name: "Stress",
        subtopics: ["the nature of stress", "stress outcomes", "managing stress"]
    },
    {
        id: "ps_biological_bases_of_behavior",
        sectionId: "ps",
        name: "Biological Bases of Behavior",
        subtopics: ["the nervous system", "the brain", "the endocrine system", "behavioral genetics"]
    },
    {
        id: "ps_personality",
        sectionId: "ps",
        name: "Personality",
        subtopics: ["theories of personality", "situational approach to explaining behavior"]
    },
    {
        id: "ps_psychological_disorders",
        sectionId: "ps",
        name: "Psychological Disorders",
        subtopics: ["understanding psychological disorders", "types of psychological disorders", "biological bases of nervous system disorders"]
    },
    {
        id: "ps_motivation",
        sectionId: "ps",
        name: "Motivation",
        subtopics: ["factors that influence motivation", "theories that explain how motivation affects human behavior", "biological and sociocultural motivators"]
    },
    {
        id: "ps_attitudes",
        sectionId: "ps",
        name: "Attitudes",
        subtopics: ["components of attitudes", "the link between attitudes and behavior"]
    },
    {
        id: "ps_how_the_presence_of_others_affects_individual_behavior",
        sectionId: "ps",
        name: "How the Presence of Others Affects Individual Behavior",
        subtopics: ["social facilitation", "deindividuation", "bystander effect", "peer pressure"]
    },
    {
        id: "ps_group_decision_making_processes",
        sectionId: "ps",
        name: "Group Decision-Making Processes",
        subtopics: ["group polarization", "groupthink"]
    },
    {
        id: "ps_normative_and_nonnormative_behavior",
        sectionId: "ps",
        name: "Normative and Nonnormative Behavior",
        subtopics: ["social norms", "deviance", "aspects of collective behavior"]
    },
    {
        id: "ps_socialization",
        sectionId: "ps",
        name: "Socialization",
        subtopics: ["agents of socialization"]
    },
    {
        id: "ps_habituation_and_dishabituation",
        sectionId: "ps",
        name: "Habituation and Dishabituation",
        subtopics: []
    },
    {
        id: "ps_associative_learning",
        sectionId: "ps",
        name: "Associative Learning",
        subtopics: ["classical conditioning", "operant conditioning", "role of cognitive processes"]
    },
    {
        id: "ps_observational_learning",
        sectionId: "ps",
        name: "Observational Learning",
        subtopics: ["modeling", "biological processes that affect observational learning", "applications of observational learning"]
    },
    {
        id: "ps_theories_of_attitude_and_behavior_change",
        sectionId: "ps",
        name: "Theories of Attitude and Behavior Change",
        subtopics: ["elaboration likelihood model", "social cognitive theory", "factors that affect attitude change"]
    },
    {
        id: "ps_self_concept_self_identity_and_social_identity",
        sectionId: "ps",
        name: "Self-Concept, Self-Identity, and Social Identity",
        subtopics: ["role of self-esteem/self-efficacy/locus of control", "different types of identities"]
    },
    {
        id: "ps_formation_of_identity",
        sectionId: "ps",
        name: "Formation of Identity",
        subtopics: ["theories of identity development", "influence of social factors", "influence of culture and socialization"]
    },
    {
        id: "ps_attributing_behavior_to_persons_or_situations",
        sectionId: "ps",
        name: "Attributing Behavior to Persons or Situations",
        subtopics: ["attributional processes", "how self-perceptions shape perceptions of others", "how perceptions of the environment shape perceptions of others"]
    },
    {
        id: "ps_prejudice_and_bias",
        sectionId: "ps",
        name: "Prejudice and Bias",
        subtopics: ["processes that contribute to prejudice", "stereotypes", "stigma", "ethnocentrism"]
    },
    {
        id: "ps_processes_related_to_stereotypes",
        sectionId: "ps",
        name: "Processes Related to Stereotypes",
        subtopics: ["self-fulfilling prophecy", "stereotype threat"]
    },
    {
        id: "ps_elements_of_social_interaction",
        sectionId: "ps",
        name: "Elements of Social Interaction",
        subtopics: ["status", "role", "groups", "networks", "organizations"]
    },
    {
        id: "ps_self_presentation_and_interacting_with_others",
        sectionId: "ps",
        name: "Self-Presentation and Interacting With Others",
        subtopics: ["expressing and detecting emotion", "presentation of self", "verbal and nonverbal communication", "animal signals and communication"]
    },
    {
        id: "ps_social_behavior",
        sectionId: "ps",
        name: "Social Behavior",
        subtopics: ["attraction", "aggression", "attachment", "altruism", "social support"]
    },
    {
        id: "ps_discrimination",
        sectionId: "ps",
        name: "Discrimination",
        subtopics: ["individual vs. institutional discrimination", "relationship between prejudice and discrimination", "how power/prestige/class facilitate discrimination"]
    },
    {
        id: "ps_theoretical_approaches",
        sectionId: "ps",
        name: "Theoretical Approaches",
        subtopics: ["microsociology vs. macrosociology", "functionalism", "conflict theory", "symbolic interactionism"]
    },
    {
        id: "ps_social_institutions",
        sectionId: "ps",
        name: "Social Institutions",
        subtopics: ["education", "family", "religion", "government and economy", "health and medicine"]
    },
    {
        id: "ps_culture",
        sectionId: "ps",
        name: "Culture",
        subtopics: ["elements of culture", "material vs. symbolic culture", "culture lag", "assimilation"]
    },
    {
        id: "ps_demographic_structure_of_society",
        sectionId: "ps",
        name: "Demographic Structure of Society",
        subtopics: ["age", "gender", "race and ethnicity", "immigration status", "sexual orientation"]
    },
    {
        id: "ps_demographic_shifts_and_social_change",
        sectionId: "ps",
        name: "Demographic Shifts and Social Change",
        subtopics: ["theories of demographic change", "population growth and decline", "fertility/migration/mortality", "social movements", "globalization", "urbanization"]
    },
    {
        id: "ps_spatial_inequality",
        sectionId: "ps",
        name: "Spatial Inequality",
        subtopics: ["residential segregation", "neighborhood safety and violence", "environmental justice"]
    },
    {
        id: "ps_social_class",
        sectionId: "ps",
        name: "Social Class",
        subtopics: ["aspects of social stratification", "socioeconomic gradient in health", "global inequalities", "patterns of social mobility", "poverty"]
    },
    {
        id: "ps_health_disparities",
        sectionId: "ps",
        name: "Health Disparities",
        subtopics: []
    },
    {
        id: "ps_health_care_disparities",
        sectionId: "ps",
        name: "Health Care Disparities",
        subtopics: []
    }
];

export const TOPICS = [
    ...SCIENCE_TOPIC_DATA.map(buildTopic),
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
