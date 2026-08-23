import { getAllData, mergeData, replaceData } from "./db.js";
import { loadSettings, saveSettings } from "./settings.js";

const SUPPORTED_EXPORT_VERSIONS = new Set(["1.0"]);
const GZIP_MAGIC_BYTES = [0x1f, 0x8b];
const MAX_BACKUP_CONTENT_BYTES = 256 * 1024 * 1024;

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

export const getExportFileName = (payload, extension = "json.gz", now = new Date()) => {
    const payloadDate = typeof payload?.exportedAt === "string" ? new Date(payload.exportedAt) : null;
    const exportedAt = Number.isFinite(payloadDate?.getTime()) ? payloadDate : Number.isFinite(now?.getTime()) ? now : new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const date = `${String(exportedAt.getFullYear()).padStart(4, "0")}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}`;
    const time = `${pad(exportedAt.getHours())}-${pad(exportedAt.getMinutes())}-${pad(exportedAt.getSeconds())}`;
    const normalizedExtension = extension === "txt" ? "txt" : extension === "json" ? "json" : "json.gz";
    return `openmcat-data_${date}_${time}.${normalizedExtension}`;
};

const requireCompressionStream = (StreamConstructor, action) => {
    if (typeof StreamConstructor !== "function") throw new Error(`This web browser cannot ${action} compressed OpenMCAT backups.`);
    return StreamConstructor;
};

const createSizeLimitStream = () => {
    let byteCount = 0;
    return new TransformStream({
        transform(chunk, controller) {
            byteCount += chunk.byteLength;
            if (byteCount > MAX_BACKUP_CONTENT_BYTES) { controller.error(new Error("The OpenMCAT backup expands beyond the supported 256 MB limit.")); return; }
            controller.enqueue(chunk);
        }
    });
};

export const createBackupArtifact = async (payload, now = new Date()) => {
    validateImportPayload(payload, "OpenMCAT backup");
    const content = JSON.stringify(payload);
    const contentBlob = new Blob([content], { type: "application/json" });
    if (contentBlob.size > MAX_BACKUP_CONTENT_BYTES) throw new Error("The OpenMCAT backup exceeds the supported 256 MB limit.");
    const Compression = requireCompressionStream(globalThis.CompressionStream, "create");
    const compressed = await new Response(contentBlob.stream().pipeThrough(new Compression("gzip"))).blob();
    const blob = new Blob([compressed], { type: "application/gzip" });
    return { blob, fileName: getExportFileName(payload, "json.gz", now), fileSize: blob.size, payload };
};

export const downloadExport = async (payload, preparedArtifact = null) => {
    const artifact = preparedArtifact ?? await createBackupArtifact(payload);
    const url = URL.createObjectURL(artifact.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return artifact;
};

export const parseImportText = (text, sourceName = "Imported file") => {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { throw new Error(`${sourceName} is not valid JSON.`, { cause: error }); }
    return validateImportPayload(parsed, sourceName);
}

const hasGzipSignature = async (file) => {
    if (!file || typeof file.slice !== "function" || file.size < GZIP_MAGIC_BYTES.length) return false;
    const signature = new Uint8Array(await file.slice(0, GZIP_MAGIC_BYTES.length).arrayBuffer());
    return signature.every((value, index) => value === GZIP_MAGIC_BYTES[index]);
};

export const parseImportFile = async (file, sourceName = file?.name || "Imported file") => {
    if (!file || typeof file.stream !== "function") throw new TypeError(`${sourceName} could not be read.`);
    const compressed = await hasGzipSignature(file);
    if (!compressed) { if (file.size > MAX_BACKUP_CONTENT_BYTES) throw new Error(`${sourceName} exceeds the supported 256 MB limit.`); return parseImportText(await file.text(), sourceName); }
    const Decompression = requireCompressionStream(globalThis.DecompressionStream, "restore");
    let text;
    try {
        const stream = file.stream().pipeThrough(new Decompression("gzip")).pipeThrough(createSizeLimitStream());
        text = await new Response(stream).text();
    } catch (error) {
        if (error?.message?.includes("256 MB limit")) throw error;
        throw new Error(`${sourceName} is not a valid gzip-compressed OpenMCAT backup.`, { cause: error });
    }
    return parseImportText(text, sourceName);
};

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
        selectedSessions: prepared.data.sessions.length,
        selectedAttempts: prepared.data.attempts.length,
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
