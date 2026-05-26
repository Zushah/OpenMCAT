import { DEFAULT_SETTINGS } from "../data/defaults.js";

const SETTINGS_KEY = "openmcat_settings_v1";
const THEME_OPTIONS = new Set(["system", "dark", "light"]);

const sanitizeSettings = (settings) => {
    const source = settings && typeof settings === "object" ? settings : {};
    const theme = THEME_OPTIONS.has(source.theme) ? source.theme : DEFAULT_SETTINGS.theme;
    return { theme };
};

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
