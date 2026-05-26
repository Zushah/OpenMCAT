export const extractJsonObject = (rawText) => {
    if (typeof rawText !== "string") {
        return {
            parsed: null,
            error: "AI response was not text.",
            cleaned: ""
        };
    }
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
        const lines = cleaned.split("\n");
        if (lines.length >= 3) {
            lines.shift();
            if (lines[lines.length - 1].trim().startsWith("```")) lines.pop();
            cleaned = lines.join("\n").trim();
        }
    }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        return {
            parsed: null,
            error: "Could not locate a JSON object in the AI response.",
            cleaned
        };
    }
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
        const parsed = JSON.parse(candidate);
        return { parsed, error: null, cleaned: candidate };
    } catch (error) {
        return {
            parsed: null,
            error: `Invalid JSON in AI response: ${error.message}`,
            cleaned: candidate
        };
    }
}
