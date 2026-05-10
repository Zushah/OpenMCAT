export const buildSkillPrompt = (skillObjects) => {
    if (!Array.isArray(skillObjects) || skillObjects.length === 0) return "Use balanced MCAT-relevant reasoning skills.";
    const lines = skillObjects.map((skill) => `- ${skill.name} (${skill.id}): ${skill.description}`);
    return `Target these reasoning skills:\n${lines.join("\n")}`;
};
