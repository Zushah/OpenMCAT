export const manualJsonProvider = {
    id: "manual_json",
    name: "Manual JSON paste",
    description: "Copy prompt manually and paste JSON output.",
    requiresApiKey: false,
    supportsBrowserDirect: true,
    supportsCustomBaseUrl: false,
    async generatePracticeSession({ systemPrompt, userPrompt }) {
        return {
            rawText: "",
            parsedJson: null,
            error: null,
            meta: {
                providerId: "manual_json",
                manual: true,
                compiledPrompt: `${systemPrompt}\n\n${userPrompt}`
            }
        };
    }
};
