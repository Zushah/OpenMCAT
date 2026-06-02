const SMART_DOUBLE_QUOTES = new Set(["\u201c", "\u201d", "\u201e", "\u201f"]);

const isSmartDoubleQuote = (char) => SMART_DOUBLE_QUOTES.has(char);

const getPreviousNonWhitespaceChar = (text, index) => { for (let i = index - 1; i >= 0; i -= 1) if (!/\s/.test(text[i])) return text[i]; return ""; };

const getNextNonWhitespaceChar = (text, index) => { for (let i = index + 1; i < text.length; i += 1) if (!/\s/.test(text[i])) return text[i]; return ""; };

const isJsonStringStartContext = (char) => char === "" || char === "{" || char === "[" || char === "," || char === ":";

const isJsonStringEndContext = (char) => char === "" || char === "}" || char === "]" || char === "," || char === ":";

const normalizeJsonSmartDoubleQuotes = (jsonText) => {
    let normalized = "", inString = false, stringQuote = "", escaped = false;
    for (let i = 0; i < jsonText.length; i += 1) {
        const char = jsonText[i];
        if (inString) {
            if (escaped) { normalized += char; escaped = false; continue; }
            if (char === "\\") { normalized += char; escaped = true; continue; }
            if (stringQuote === "\"") { if (char === "\"") { normalized += char; inString = false; stringQuote = ""; continue; } normalized += char; continue; }
            if ((isSmartDoubleQuote(char) || char === "\"") && isJsonStringEndContext(getNextNonWhitespaceChar(jsonText, i))) {
                normalized += "\"";
                inString = false;
                stringQuote = "";
                continue;
            }
            if (char === "\"") { normalized += "\\\""; continue; }
            normalized += char;
            continue;
        }
        if (char === "\"") { normalized += char; inString = true; stringQuote = char; escaped = false; continue; }
        if (isSmartDoubleQuote(char) && isJsonStringStartContext(getPreviousNonWhitespaceChar(jsonText, i))) {
            normalized += "\"";
            inString = true;
            stringQuote = char;
            escaped = false;
            continue;
        }
        normalized += char;
    }
    return normalized;
};

const parseJsonCandidate = (candidate) => { try { return { parsed: JSON.parse(candidate), error: null, cleaned: candidate }; } catch (error) { return { parsed: null, error, cleaned: candidate }; } };

export const extractJsonObject = (rawText) => {
    if (typeof rawText !== "string") return { parsed: null, error: "AI output was not text.", cleaned: "" };
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
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) return { parsed: null, error: "Could not locate JSON in the AI output.", cleaned };
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    const initialParse = parseJsonCandidate(candidate);
    if (initialParse.parsed) return initialParse;
    const normalizedCandidate = normalizeJsonSmartDoubleQuotes(candidate);
    if (normalizedCandidate !== candidate) {
        const normalizedParse = parseJsonCandidate(normalizedCandidate);
        if (normalizedParse.parsed) return normalizedParse;
        return { parsed: null, error: `Invalid AI output: ${initialParse.error.message}. Repair also failed: ${normalizedParse.error.message}`, cleaned: normalizedCandidate };
    }
    return { parsed: null, error: `Invalid AI output: ${initialParse.error.message}`, cleaned: candidate };
}
