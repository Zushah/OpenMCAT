import { DEFAULT_CONFIG } from "./data/defaults.js";
import { loadSettings } from "./storage/settings.js";

export const state = {
    route: "landing",
    theme: "system",
    settings: loadSettings(),
    currentConfig: structuredClone(DEFAULT_CONFIG),
    generation: {
        status: "idle", // idle | compiling | waiting | manual | validating | ready | error
        rawText: "",
        parsedSession: null,
        error: null,
        warnings: [],
        compiledPrompt: null,
        showRawResponse: false,
        configSnapshot: null,
        providerMeta: null
    },
    activeSession: null,
    activeAttempt: null,
    analytics: null
};

export const patchState = (patch) => { Object.assign(state, patch); };

export const patchGeneration = (patch) => { state.generation = { ...state.generation, ...patch }; };

export const resetGenerationState = () => {
    state.generation = {
        status: "idle",
        rawText: "",
        parsedSession: null,
        error: null,
        warnings: [],
        compiledPrompt: null,
        showRawResponse: false,
        configSnapshot: null,
        providerMeta: null
    };
};
