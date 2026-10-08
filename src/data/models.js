export const CUSTOM_AI_MODEL_VALUE = "__custom__";
export const MAX_AI_MODEL_NAME_LENGTH = 120;

export const AI_MODEL_CATALOG = [
    {
        provider: "Anthropic",
        models: [
            "anthropic/claude-opus-5.5",
            "anthropic/claude-sonnet-5.5",
            "anthropic/claude-haiku-5.5",
            "anthropic/claude-fable-5.1",
            "anthropic/claude-fable-5",
            "anthropic/claude-opus-5",
            "anthropic/claude-sonnet-5",
        ]
    },
    {
        provider: "DeepSeek",
        models: [
            "deepseek/deepseek-v4.1-flash",
            "deepseek/deepseek-v4-pro-0813",
            "deepseek/deepseek-v4-flash-0731",
            "deepseek/deepseek-v4-pro",
            "deepseek/deepseek-v4-flash"
        ]
    },
    {
        provider: "Google",
        models: [
            "google/gemini-3.8-flash",
            "google/gemini-3.7-flash",
            "google/gemini-3.6-flash",
            "google/gemini-3.5-flash-lite",
            "google/gemini-3.1-pro"
        ]
    },
    {
        provider: "OpenAI",
        models: [
            "openai/gpt-6.1-sol",
            "openai/gpt-6-astra",
            "openai/gpt-6-sol",
            "openai/gpt-6-luna",
            "openai/gpt-5.6-sol",
            "openai/gpt-5.6-terra",
            "openai/gpt-5.6-luna"
        ]
    }
];

export const AI_MODEL_CATALOG_VALUES = new Set(["unknown", ...AI_MODEL_CATALOG.flatMap((group) => group.models)]);
