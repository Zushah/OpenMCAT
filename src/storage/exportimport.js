import { getAllData, mergeData, replaceData } from "./db.js";
import { loadSettings, saveSettings } from "./settings.js";

const SUPPORTED_EXPORT_VERSIONS = new Set(["1.0"]);

const validateRecords = (records, label) => records.forEach((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record) || typeof record.id !== "string" || !record.id) throw new Error(`${label} record ${index + 1} must be an object with a non-empty string id.`);
});

const validateImportPayload = (payload, sourceName = "Imported file") => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`${sourceName} must contain a JSON object.`);
    if (payload.app !== undefined && payload.app !== "OpenMCAT") throw new Error(`${sourceName} is not an OpenMCAT backup.`);
    if (payload.exportVersion !== undefined && !SUPPORTED_EXPORT_VERSIONS.has(payload.exportVersion)) throw new Error(`${sourceName} uses an unsupported OpenMCAT export version.`);
    if (payload.exportedAt !== undefined && (typeof payload.exportedAt !== "string" || !Number.isFinite(Date.parse(payload.exportedAt)))) throw new Error(`${sourceName} has an invalid export date.`);
    if (!Array.isArray(payload.sessions) || !Array.isArray(payload.attempts)) throw new Error(`${sourceName} must include sessions and attempts arrays.`);
    validateRecords(payload.sessions, `${sourceName} session`);
    validateRecords(payload.attempts, `${sourceName} attempt`);
    return payload;
};

const validateUniqueIds = (records, label) => {
    const ids = new Set();
    records.forEach((record) => {
        if (ids.has(record.id)) throw new Error(`${label} contains more than one record with id "${record.id}".`);
        ids.add(record.id);
    });
};

export const createExportPayload = ({ settings = {}, sessions = [], attempts = [] }, now = new Date()) => ({
    exportVersion: "1.0",
    exportedAt: now.toISOString(),
    app: "OpenMCAT",
    settings: structuredClone(settings),
    sessions: structuredClone(sessions),
    attempts: structuredClone(attempts)
});

export const buildExportPayload = async () => {
    const settings = loadSettings();
    const data = await getAllData();
    return createExportPayload({ settings, ...data });
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

export const parseImportText = (text, sourceName = "Imported file") => {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { throw new Error(`${sourceName} is not valid JSON.`, { cause: error }); }
    return validateImportPayload(parsed, sourceName);
}

export const importPayload = async (payload) => {
    const validated = validateImportPayload(payload);
    await replaceData(validated);
    if (validated.settings && typeof validated.settings === "object") {
        const local = loadSettings();
        const merged = deepMerge(local, validated.settings);
        saveSettings(merged);
    }
}

export const prepareBackupCombination = (backups) => {
    if (!Array.isArray(backups) || !backups.length) throw new Error("Choose at least one OpenMCAT backup to combine.");
    const normalized = backups.map((backup, index) => {
        const sourceName = backup?.name || `Backup ${index + 1}`;
        const payload = validateImportPayload(backup?.payload, sourceName);
        validateUniqueIds(payload.sessions, `${sourceName} sessions`);
        validateUniqueIds(payload.attempts, `${sourceName} attempts`);
        return {
            index,
            exportedAtMs: payload.exportedAt === undefined ? Number.NEGATIVE_INFINITY : Date.parse(payload.exportedAt),
            payload
        };
    }).sort((a, b) => a.exportedAtMs - b.exportedAtMs || a.index - b.index);
    const sessionsById = new Map();
    const attemptsById = new Map();
    let sourceSessions = 0;
    let sourceAttempts = 0;
    normalized.forEach(({ payload }) => {
        sourceSessions += payload.sessions.length;
        sourceAttempts += payload.attempts.length;
        payload.sessions.forEach((session) => sessionsById.set(session.id, structuredClone(session)));
        payload.attempts.forEach((attempt) => attemptsById.set(attempt.id, structuredClone(attempt)));
    });
    return {
        data: {
            sessions: Array.from(sessionsById.values()),
            attempts: Array.from(attemptsById.values())
        },
        backupCount: backups.length,
        sourceSessions,
        sourceAttempts
    };
};

export const previewBackupCombination = async (backups) => {
    const prepared = prepareBackupCombination(backups);
    const current = await getAllData();
    const currentSessionIds = new Set(current.sessions.map((session) => session.id));
    const currentAttemptIds = new Set(current.attempts.map((attempt) => attempt.id));
    const addedSessions = prepared.data.sessions.filter((session) => !currentSessionIds.has(session.id)).length;
    const addedAttempts = prepared.data.attempts.filter((attempt) => !currentAttemptIds.has(attempt.id)).length;
    return {
        backupCount: prepared.backupCount,
        sourceSessions: prepared.sourceSessions,
        sourceAttempts: prepared.sourceAttempts,
        addedSessions,
        addedAttempts,
        duplicateSessions: prepared.sourceSessions - addedSessions,
        duplicateAttempts: prepared.sourceAttempts - addedAttempts
    };
};

export const combineBackupPayloads = async (backups) => {
    const prepared = prepareBackupCombination(backups);
    const result = await mergeData(prepared.data);
    return {
        backupCount: prepared.backupCount,
        sourceSessions: prepared.sourceSessions,
        sourceAttempts: prepared.sourceAttempts,
        addedSessions: result.addedSessions,
        addedAttempts: result.addedAttempts,
        duplicateSessions: prepared.sourceSessions - result.addedSessions,
        duplicateAttempts: prepared.sourceAttempts - result.addedAttempts
    };
};

const deepMerge = (base, patch) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(base);
    const merged = structuredClone(base);
    Object.entries(patch).forEach(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value) && merged[key] && typeof merged[key] === "object" && !Array.isArray(merged[key])) merged[key] = deepMerge(merged[key], value);
        else merged[key] = value;
    });
    return merged;
}
