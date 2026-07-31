const withoutFinalPeriod = (text) => text.trim().replace(/\.$/, "");

const instructionForError = (error) => {
    const message = error.trim();
    let match;
    if (message === "Could not locate JSON in the AI output.") return "Repeat the response as a complete JSON object with both its opening and closing braces.";
    if (message.startsWith("Invalid AI output:")) return `Repair the JSON syntax so it parses successfully; the parser reported: ${withoutFinalPeriod(message.slice("Invalid AI output:".length))}.`;
    if (message === "Top-level JSON must be an object.") return "Make the top-level JSON value an object, not an array, string, number, boolean, or null.";
    if (message === "schemaVersion is required.") return "Add the top-level field \"schemaVersion\" with the value \"1.0\".";
    if (message === "session object is required.") return "Add the required top-level \"session\" object and populate all of its required fields.";
    if (message === "questions must be an array.") return "Set the top-level \"questions\" field to an array of question objects.";
    if ((match = message.match(/^Question count mismatch\. Expected (\d+), received (\d+)\.$/))) return `Return exactly ${match[1]} questions instead of ${match[2]}.`;
    if ((match = message.match(/^Duplicate question id: (.+)$/))) return `Give every question a unique id; replace the duplicate id \"${match[1]}\".`;
    if ((match = message.match(/^(.+) must be a non-empty string\.$/))) return `Set ${match[1]} to a non-empty string.`;
    if ((match = message.match(/^(.+) must be an array(?: if provided)?\.$/))) return `Set ${match[1]} to an array.`;
    if ((match = message.match(/^(.+)\.choices must contain exactly 4 choices\.$/))) return `Give ${match[1]} exactly four choices with ids A, B, C, and D.`;
    if ((match = message.match(/^(.+) has duplicate choice id "(.+)"\.$/))) return `Replace the duplicate choice id \"${match[2]}\" in ${match[1]} so its choice ids are uniquely A, B, C, and D.`;
    if ((match = message.match(/^(.+) choices must include "([A-D])"\.$/))) return `Add the missing choice id ${match[2]} to ${match[1]}.`;
    if ((match = message.match(/^(.+)\.correctChoiceId must be one of A\/B\/C\/D\.$/))) return `Set ${match[1]}.correctChoiceId to the id of its one correct choice: A, B, C, or D.`;
    if ((match = message.match(/^(.+)\.testedTopicIds must include at least one topic\.$/))) return `Give ${match[1]}.testedTopicIds at least one valid topic id from the original prompt.`;
    if ((match = message.match(/^(.+)\.testedSkillIds must include at least one skill\.$/))) return `Give ${match[1]}.testedSkillIds at least one valid skill id from the original prompt.`;
    if ((match = message.match(/^(.+)\.passageId references missing passage "(.+)"\.$/))) return `Either add passage \"${match[2]}\" or correct ${match[1]}.passageId to reference an existing passage.`;
    if ((match = message.match(/^(.+)\.selfCheck\.(.+) must be true\.$/))) return `Set ${match[1]}.selfCheck.${match[2]} to true after correcting the question so that assertion is accurate.`;
    if ((match = message.match(/^questions must keep passage-based questions for passageId "(.+)" consecutive\.$/))) return `Reorder the questions so every question using passageId \"${match[1]}\" is in one consecutive block.`;
    return `Correct this exact validation issue: ${withoutFinalPeriod(message)}.`;
};

export const buildRepairPrompt = (errors) => {
    const uniqueErrors = Array.from(new Set((errors ?? []).filter((error) => typeof error === "string" && error.trim())));
    if (!uniqueErrors.length) return null;
    const instructions = uniqueErrors.map(instructionForError);
    const corrections = instructions.length === 1 ? instructions[0] : instructions.map((instruction, index) => `${index + 1}) ${instruction}`).join(" ");
    return `Revise your previous output without changing unrelated content. ${corrections} Return the complete corrected response as exactly one single-line JSON object with no surrounding text.`;
};
