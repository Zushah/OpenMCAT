import { getAllData, replaceData } from "./db.js";
import { loadSettings, saveSettings } from "./settings.js";

export const buildExportPayload = async () => {
    const settings = loadSettings();
    const data = await getAllData();
    return {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        app: "OpenMCAT",
        settings: structuredClone(settings),
        sessions: data.sessions,
        attempts: data.attempts,
        flags: data.flags
    };
};

export const downloadExport = (payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `openmcat-export-${stamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

export const parseImportText = (text) => {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") throw new Error("Imported file must be a JSON object.");
    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.attempts) || !Array.isArray(parsed.flags)) throw new Error("Import file must include sessions, attempts, and flags arrays.");
    return parsed;
}

export const importPayload = async (payload) => {
    await replaceData(payload);
    if (payload.settings && typeof payload.settings === "object") {
        const local = loadSettings();
        const merged = deepMerge(local, payload.settings);
        saveSettings(merged);
    }
}

const deepMerge = (base, patch) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(base);
    const merged = structuredClone(base);
    Object.entries(patch).forEach(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value) && merged[key] && typeof merged[key] === "object" && !Array.isArray(merged[key])) merged[key] = deepMerge(merged[key], value);
        else merged[key] = value;
    });
    return merged;
}
