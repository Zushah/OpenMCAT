export const CUSTOM_AI_MODEL_VALUE = "__custom__";
export const MAX_AI_MODEL_NAME_LENGTH = 120;

export const AI_MODEL_CATALOG = [
    {
        provider: "Anthropic",
        models: [
            "anthropic/claude-opus-5",
            "anthropic/claude-sonnet-5",
            "anthropic/claude-fable-5",
            "anthropic/claude-opus-4.8",
            "anthropic/claude-opus-4.7",
            "anthropic/claude-opus-4.6",
            "anthropic/claude-sonnet-4.6"
        ]
    },
    {
        provider: "DeepSeek",
        models: [
            "deepseek/deepseek-v4-pro",
            "deepseek/deepseek-v4-flash",
            "deepseek/deepseek-v3-pro",
            "deepseek/deepseek-v3-flash"
        ]
    },
    {
        provider: "Google",
        models: [
            "google/gemini-3.7-flash",
            "google/gemini-3.6-flash",
            "google/gemini-3.5-flash",
            "google/gemini-3.5-flash-lite",
            "google/gemini-3.1-flash-lite",
            "google/gemini-3.1-pro",
            "google/gemini-3.0-pro",
            "google/gemini-3.0-flash"
        ]
    },
    {
        provider: "OpenAI",
        models: [
            "openai/gpt-5.6-sol",
            "openai/gpt-5.6-terra",
            "openai/gpt-5.6-luna",
            "openai/gpt-5.5",
            "openai/gpt-5.5-pro",
            "openai/gpt-5.4",
            "openai/gpt-5.4-mini",
            "openai/gpt-5.4-nano",
            "openai/gpt-5.4-pro"
        ]
    }
];

export const AI_MODEL_CATALOG_VALUES = new Set(["unknown", ...AI_MODEL_CATALOG.flatMap((group) => group.models)]);
