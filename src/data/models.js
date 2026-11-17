export const CUSTOM_AI_MODEL_VALUE = "__custom__";
export const MAX_AI_MODEL_NAME_LENGTH = 120;

export const AI_MODEL_CATALOG = [
    {
        provider: "Anthropic",
        models: [
            "anthropic/claude-opus-5.5",
            "anthropic/claude-sonnet-5.5",
            "anthropic/claude-haiku-5.5",
            "anthropic/claude-fable-5.2"
        ]
    },
    {
        provider: "DeepSeek",
        models: [
            "deepseek/deepseek-v4.1-flash-1017",
            "deepseek/deepseek-v4-pro-0813"
        ]
    },
    {
        provider: "Google",
        models: [
            "google/gemini-4-carbon",
            "google/gemini-4-neon",
            "google/gemini-4-hydrogen"
        ]
    },
    {
        provider: "OpenAI",
        models: [
            "openai/gpt-6.2-astra",
            "openai/gpt-6.2-sol",
            "openai/gpt-6.1-sol",
            "openai/gpt-6.1-terra",
            "openai/gpt-6-astra",
            "openai/gpt-6-sol",
            "openai/gpt-6-luna",
            "openai/gpt-5.6-sol"
        ]
    }
];

export const AI_MODEL_CATALOG_VALUES = new Set(["unknown", ...AI_MODEL_CATALOG.flatMap((group) => group.models)]);
