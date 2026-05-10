import { DEFAULT_SETTINGS } from "../data/defaults.js";

const SETTINGS_KEY = "openmcat_settings_v1";

const deepMerge = (base, patch) => {
    if (!patch || typeof patch !== "object") return structuredClone(base);
    const merged = structuredClone(base);
    Object.entries(patch).forEach(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value) && merged[key] && typeof merged[key] === "object" && !Array.isArray(merged[key])) merged[key] = deepMerge(merged[key], value);
        else merged[key] = value;
    });
    return merged;
}

const sanitizeSettings = (settings) => deepMerge(DEFAULT_SETTINGS, settings ?? {});

export const loadSettings = () => {
    if (typeof localStorage === "undefined") return structuredClone(DEFAULT_SETTINGS);
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return structuredClone(DEFAULT_SETTINGS);
        const parsed = JSON.parse(raw);
        return sanitizeSettings(parsed);
    } catch (error) {
        console.warn("OpenMCAT: failed to load settings; using defaults.", error);
        return structuredClone(DEFAULT_SETTINGS);
    };
}

export const saveSettings = (settings) => {
    const sanitized = sanitizeSettings(settings);
    if (typeof localStorage !== "undefined") localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitized));
    return sanitized;
};
