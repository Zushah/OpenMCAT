export const buildSkillPrompt = (skillObjects) => {
    const skills = (skillObjects ?? []).filter(Boolean);
    if (!skills.length) return "Use balanced MCAT-relevant reasoning skills.";
    const lines = skills.map((skill) => `- ${skill.name} (${skill.id}): ${skill.description}`);
    return `Target these Scientific Inquiry and Reasoning Skills. The selected skill should shape the cognitive task in the stem, answer choices, explanation, and testedSkillIds metadata rather than appearing only as a label. Mix selected skills across the session when multiple skills are chosen, and avoid adding unselected skill IDs unless a question genuinely requires them.\n${lines.join("\n")}`;
};
