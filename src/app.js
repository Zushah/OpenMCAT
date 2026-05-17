import { DEFAULT_CONFIG } from "./data/defaults.js";
import { loadSettings } from "./storage/settings.js";

export const DEFAULT_DASHBOARD_FILTERS = { range: "all", sectionId: "all", timingMode: "all", reviewMode: "all", minAttempts: 3 };

export const state = {
    route: "landing",
    theme: "system",
    settings: loadSettings(),
    currentConfig: structuredClone(DEFAULT_CONFIG),
    generation: {
        status: "idle", // idle | compiling | manual | validating | ready | error
        rawText: "",
        parsedSession: null,
        error: null,
        warnings: [],
        compiledPrompt: null,
        showRawResponse: false,
        configSnapshot: null,
        providerMeta: null,
        pipelineOpen: false,
        manualInput: ""
    },
    activeSession: null,
    activeAttempt: null,
    analytics: null,
    dashboard: { filters: { ...DEFAULT_DASHBOARD_FILTERS } }
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
        providerMeta: null,
        pipelineOpen: false,
        manualInput: ""
    };
};
