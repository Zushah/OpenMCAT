const cb = Chalkboard;
const BACKUP_REMINDER_KEY = "openmcat_backup_reminder_v1";
const BACKUP_STATUS_KEY = "openmcat_backup_status_v1";
const NEVER_REMIND_AT = Number.MAX_SAFE_INTEGER;

const REMINDER_DELAYS = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000
};

const getStudyData = (source = {}) => ({
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
    attempts: Array.isArray(source.attempts) ? source.attempts : []
});

const getBackupContent = (source = {}) => {
    const data = getStudyData(source);
    return JSON.stringify({
        settings: source.settings && typeof source.settings === "object" ? source.settings : {},
        sessions: data.sessions,
        attempts: data.attempts
    }, null, 2);
};

const loadNextReminderAt = () => {
    if (typeof localStorage === "undefined") return 0;
    try {
        const value = Number(localStorage.getItem(BACKUP_REMINDER_KEY));
        return Number.isFinite(value) ? value : 0;
    } catch (error) { console.warn("OpenMCAT: failed to load the data backup reminder.", error); return 0; }
};

const saveNextReminderAt = (timestamp) => {
    if (typeof localStorage === "undefined") return;
    try { localStorage.setItem(BACKUP_REMINDER_KEY, String(timestamp)); }
    catch (error) { console.warn("OpenMCAT: failed to save the data backup reminder.", error); }
};

const loadCompletedBackup = () => {
    if (typeof localStorage === "undefined") return null;
    try {
        const raw = localStorage.getItem(BACKUP_STATUS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || typeof parsed.signature !== "string" || !Number.isFinite(Date.parse(parsed.completedAt))) return null;
        return parsed;
    } catch (error) { console.warn("OpenMCAT: failed to load the data backup status.", error); return null; }
};

const saveCompletedBackup = (backup) => {
    if (typeof localStorage === "undefined") return;
    try { localStorage.setItem(BACKUP_STATUS_KEY, JSON.stringify(backup)); }
    catch (error) { console.warn("OpenMCAT: failed to save the data backup status.", error); }
};

const bytesToHex = (bytes) => Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

const createDataSignature = async (source) => {
    const data = getStudyData(source);
    const content = JSON.stringify({
        sessions: data.sessions.slice().sort((a, b) => String(a?.id ?? "").localeCompare(String(b?.id ?? ""))),
        attempts: data.attempts.slice().sort((a, b) => String(a?.id ?? "").localeCompare(String(b?.id ?? "")))
    });
    const encoded = new TextEncoder().encode(content);
    if (globalThis.crypto?.subtle) return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", encoded)));
    let hash = 2166136261;
    encoded.forEach((value) => { hash ^= value; hash = Math.imul(hash, 16777619); });
    return `fallback-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const formatBackupDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const formatBackupStatus = ({ hasData, hasChanges, completedAt, addedSessions, addedAttempts }) => {
    if (!hasData) return "Backup unneeded: Zero current OpenMCAT data.";
    if (!completedAt) return "Backup recommended: No OpenMCAT data backup saved yet.";
    if (!hasChanges) return `Backup completed: ${formatBackupDate(completedAt)}.`;
    const additions = [];
    if (addedSessions > 0) additions.push(`${addedSessions} new ${addedSessions === 1 ? "session" : "sessions"}`);
    if (addedAttempts > 0) additions.push(`${addedAttempts} new ${addedAttempts === 1 ? "attempt" : "attempts"}`);
    const changeDescription = additions.length ? additions.join(" and ") : "The current OpenMCAT data has changed";
    return `Backup recommended: ${changeDescription} since ${formatBackupDate(completedAt)}.`;
};

export const formatBackupDataSize = (bytes) => {
    const megabytes = (bytes / 1024) / 1024;
    return `${megabytes > 0 && megabytes < 0.01 ? "<0.01" : cb.numb.roundTo(megabytes, 0.01)} MB`;
};

export const getBackupStatus = async (source) => {
    const data = getStudyData(source);
    const completedBackup = loadCompletedBackup();
    const signature = await createDataSignature(data);
    const hasData = Boolean(data.sessions.length || data.attempts.length);
    const hasChanges = hasData && completedBackup?.signature !== signature;
    const addedSessions = completedBackup ? Math.max(0, data.sessions.length - Number(completedBackup.sessionCount || 0)) : data.sessions.length;
    const addedAttempts = completedBackup ? Math.max(0, data.attempts.length - Number(completedBackup.attemptCount || 0)) : data.attempts.length;
    const status = {
        hasData,
        hasChanges,
        completedAt: completedBackup?.completedAt ?? null,
        addedSessions,
        addedAttempts,
        dataSizeBytes: new Blob([getBackupContent(source)]).size
    };
    return {
        ...status,
        dataSizeLabel: formatBackupDataSize(status.dataSizeBytes),
        message: formatBackupStatus(status)
    };
};

export const markBackupCompleted = async (source, timing, now = new Date()) => {
    const data = getStudyData(source);
    saveCompletedBackup({
        signature: await createDataSignature(data),
        completedAt: now.toISOString(),
        sessionCount: data.sessions.length,
        attemptCount: data.attempts.length
    });
    scheduleBackupReminder(timing, now);
};

export const isBackupReminderDue = (now = new Date()) => now.getTime() >= loadNextReminderAt();

export const scheduleBackupReminder = (timing, now = new Date()) => {
    const delay = REMINDER_DELAYS[timing];
    saveNextReminderAt(timing === "never" || !Number.isFinite(delay) ? NEVER_REMIND_AT : now.getTime() + delay);
};
