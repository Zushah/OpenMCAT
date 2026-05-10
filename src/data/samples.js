export const SAMPLE_SESSION = {
    schemaVersion: "1.0",
    session: {
        title: "B/B amino acids and enzymes mixed drill",
        sectionId: "bb",
        topicIds: ["bb_amino_acids_proteins", "bb_enzymes"],
        skillIds: ["sirs_1", "sirs_2", "sirs_4"],
        difficulty: "medium",
        questionFormat: "mixed",
        estimatedTimeMinutes: 8,
        aiModel: "mock-mcat-v1",
        disclaimer: "AI-generated practice; verify explanations when uncertain."
    },
    passages: [
        {
            id: "p1",
            title: "Fictional kinase inhibition study",
            text: "A research group studies a fictional kinase, KZ-1, that phosphorylates a peptide substrate. They compare initial reaction velocity in the absence and presence of Compound Q at constant enzyme concentration and pH 7.4. Across the tested substrate range, the velocity with Compound Q is consistently close to half of control values.",
            tables: [
                {
                    id: "t1",
                    caption: "Initial velocity at varying substrate concentration",
                    columns: ["Substrate (uM)", "Control v0", "Compound Q v0"],
                    rows: [
                        ["5", "8", "4"],
                        ["10", "14", "7"],
                        ["20", "22", "11"],
                        ["40", "30", "15"]
                    ]
                }
            ],
            figureDescriptions: []
        }
    ],
    questions: [
        {
            id: "q1",
            passageId: null,
            type: "discrete",
            stem: "At physiological pH, which amino acid side chain is most likely to carry a positive charge?",
            choices: [
                { id: "A", text: "Glutamate" },
                { id: "B", text: "Lysine" },
                { id: "C", text: "Serine" },
                { id: "D", text: "Valine" }
            ],
            correctChoiceId: "B",
            explanation: "Lysine has a basic side chain that is typically protonated at physiological pH and therefore positively charged.",
            choiceExplanations: {
                A: "Glutamate is generally deprotonated and negatively charged.",
                B: "Correct. Lysine is basic and commonly positively charged.",
                C: "Serine is polar but usually uncharged.",
                D: "Valine is nonpolar and uncharged."
            },
            testedTopicIds: ["bb_amino_acids_proteins"],
            testedSkillIds: ["sirs_1"],
            estimatedDifficulty: "easy",
            commonMistake: "Mixing up polar side chains with ionizable basic side chains.",
            requiresExternalKnowledge: true,
            selfCheck: {
                oneCorrectAnswer: true,
                answerDerivableFromPassage: true,
                noOfficialMaterialCopied: true,
                scientificallyCoherent: true
            }
        },
        {
            id: "q2",
            passageId: null,
            type: "discrete",
            stem: "An enzyme-catalyzed reaction has unchanged Vmax but increased apparent Km in the presence of an inhibitor. Which inhibitor type is most consistent with this pattern?",
            choices: [
                { id: "A", text: "Competitive inhibitor" },
                { id: "B", text: "Uncompetitive inhibitor" },
                { id: "C", text: "Noncompetitive inhibitor with lower Vmax" },
                { id: "D", text: "Irreversible covalent inhibitor" }
            ],
            correctChoiceId: "A",
            explanation: "Competitive inhibition can be overcome by increasing substrate concentration, so Vmax is unchanged while apparent Km increases.",
            choiceExplanations: {
                A: "Correct. Competitive inhibition raises apparent Km and leaves Vmax unchanged.",
                B: "Uncompetitive inhibition reduces both Km and Vmax.",
                C: "Pure noncompetitive inhibition lowers Vmax with little change in Km.",
                D: "Irreversible inhibition usually lowers active enzyme concentration and effective Vmax."
            },
            testedTopicIds: ["bb_enzymes"],
            testedSkillIds: ["sirs_2"],
            estimatedDifficulty: "medium",
            commonMistake: "Confusing competitive and noncompetitive inhibition trends.",
            requiresExternalKnowledge: true,
            selfCheck: {
                oneCorrectAnswer: true,
                answerDerivableFromPassage: true,
                noOfficialMaterialCopied: true,
                scientificallyCoherent: true
            }
        },
        {
            id: "q3",
            passageId: "p1",
            type: "passage_based",
            stem: "Based on the table, which statement best describes the effect of Compound Q over the tested substrate range?",
            choices: [
                { id: "A", text: "Compound Q causes nearly constant proportional reduction in velocity." },
                { id: "B", text: "Compound Q only affects velocity at low substrate concentrations." },
                { id: "C", text: "Compound Q increases the maximum observed velocity." },
                { id: "D", text: "Compound Q has no measurable effect on velocity." }
            ],
            correctChoiceId: "A",
            explanation: "Each velocity value with Compound Q is close to half of control at every listed substrate concentration, indicating a roughly proportional effect.",
            choiceExplanations: {
                A: "Correct. The reduction appears proportional across all listed concentrations.",
                B: "The effect persists at every concentration in the table.",
                C: "Velocities with Compound Q are lower than control in all rows.",
                D: "The effect is substantial and consistent, not absent."
            },
            testedTopicIds: ["bb_enzymes"],
            testedSkillIds: ["sirs_4"],
            estimatedDifficulty: "medium",
            commonMistake: "Overfocusing on one row and ignoring the full trend.",
            requiresExternalKnowledge: false,
            selfCheck: {
                oneCorrectAnswer: true,
                answerDerivableFromPassage: true,
                noOfficialMaterialCopied: true,
                scientificallyCoherent: true
            }
        },
        {
            id: "q4",
            passageId: "p1",
            type: "passage_based",
            stem: "Which follow-up experiment would most directly test whether Compound Q competes with substrate binding at the active site?",
            choices: [
                { id: "A", text: "Measure kinetics across substrate concentrations at multiple fixed Compound Q levels." },
                { id: "B", text: "Repeat the assay at room temperature instead of 37 C." },
                { id: "C", text: "Replace peptide substrate with unrelated dye." },
                { id: "D", text: "Reduce all reaction times by half." }
            ],
            correctChoiceId: "A",
            explanation: "A substrate series with multiple inhibitor concentrations allows comparison of kinetic shifts consistent with competitive versus other mechanisms.",
            choiceExplanations: {
                A: "Correct. This is the standard design to evaluate competitive behavior.",
                B: "Temperature changes affect rates broadly but do not directly isolate competition.",
                C: "An unrelated substrate may invalidate interpretation of active-site competition.",
                D: "Shorter timing changes throughput, not mechanism inference."
            },
            testedTopicIds: ["bb_enzymes"],
            testedSkillIds: ["sirs_3"],
            estimatedDifficulty: "hard",
            commonMistake: "Choosing a procedural change that does not isolate mechanism.",
            requiresExternalKnowledge: false,
            selfCheck: {
                oneCorrectAnswer: true,
                answerDerivableFromPassage: true,
                noOfficialMaterialCopied: true,
                scientificallyCoherent: true
            }
        },
        {
            id: "q5",
            passageId: null,
            type: "discrete",
            stem: "A mutation replaces a hydrophobic core residue with a charged residue in a soluble protein. Which outcome is most likely?",
            choices: [
                { id: "A", text: "Increased structural stability due to better packing" },
                { id: "B", text: "No effect because side-chain chemistry rarely matters" },
                { id: "C", text: "Reduced stability from unfavorable core interactions" },
                { id: "D", text: "Guaranteed higher catalytic rate" }
            ],
            correctChoiceId: "C",
            explanation: "Hydrophobic cores generally stabilize folded proteins. Introducing a charged residue can disrupt packing and reduce stability.",
            choiceExplanations: {
                A: "Charged residues in hydrophobic cores usually reduce, not increase, packing stability.",
                B: "Side-chain properties strongly influence folded structure.",
                C: "Correct. Core polarity mismatch can destabilize the fold.",
                D: "Catalytic rate depends on many factors and is not guaranteed by this change."
            },
            testedTopicIds: ["bb_amino_acids_proteins"],
            testedSkillIds: ["sirs_2"],
            estimatedDifficulty: "medium",
            commonMistake: "Assuming any mutation can improve function.",
            requiresExternalKnowledge: true,
            selfCheck: {
                oneCorrectAnswer: true,
                answerDerivableFromPassage: true,
                noOfficialMaterialCopied: true,
                scientificallyCoherent: true
            }
        }
    ]
};
