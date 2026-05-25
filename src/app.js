import { DEFAULT_CONFIG } from "./data/defaults.js";
import { DEFAULT_QUESTION_BANK_COUNT, QUESTION_BANKS } from "./data/bank/catalog.js";
import { loadSettings } from "./storage/settings.js";

export const DEFAULT_DASHBOARD_FILTERS = { range: "all", sectionId: "all", timingMode: "all", reviewMode: "all", minAttempts: 3 };
export const DEFAULT_DASHBOARD_PAGES = { topicWeakness: 0, heatmap: 0, weakPairs: 0, recentMisses: 0, recentSessions: 0, modelUsageLegend: 0 };
export const DEFAULT_QUESTION_BANK_COUNTS = Object.fromEntries(QUESTION_BANKS.map((bank) => [bank.sectionId, bank.defaultQuestionCount ?? DEFAULT_QUESTION_BANK_COUNT]));

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
    dashboard: {
        filters: { ...DEFAULT_DASHBOARD_FILTERS },
        pages: { ...DEFAULT_DASHBOARD_PAGES },
        aiAnalysisOpen: false
    },
    questionBank: {
        loading: false,
        entries: {},
        selectedCounts: { ...DEFAULT_QUESTION_BANK_COUNTS },
        error: null
    }
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
