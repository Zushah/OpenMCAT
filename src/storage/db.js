const DB_KEYS = {
    sessions: "openmcat_sessions_v1",
    attempts: "openmcat_attempts_v1",
    flags: "openmcat_flags_v1"
};

const readArray = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn(`OpenMCAT: failed reading ${key}`, error);
        return [];
    };
};

const writeArray = (key, rows) => { localStorage.setItem(key, JSON.stringify(rows)); };

export const getSessions = async () => readArray(DB_KEYS.sessions);

export const saveSession = async (sessionRecord) => {
    const rows = readArray(DB_KEYS.sessions);
    rows.push(sessionRecord);
    writeArray(DB_KEYS.sessions, rows);
    return sessionRecord;
};

export const updateSession = async (sessionId, patch) => {
    const rows = readArray(DB_KEYS.sessions);
    const updated = rows.map((row) => row.id === sessionId ? { ...row, ...patch } : row);
    writeArray(DB_KEYS.sessions, updated);
};

export const getAttempts = async () => readArray(DB_KEYS.attempts);

export const saveAttempt = async (attemptRecord) => {
    const rows = readArray(DB_KEYS.attempts);
    rows.push(attemptRecord);
    writeArray(DB_KEYS.attempts, rows);
    return attemptRecord;
};

export const updateAttempt = async (attemptId, patch) => {
    const rows = readArray(DB_KEYS.attempts);
    const updated = rows.map((row) => row.id === attemptId ? { ...row, ...patch } : row);
    writeArray(DB_KEYS.attempts, updated);
};

export const getFlags = async () => readArray(DB_KEYS.flags);

export const saveFlag = async (flagRecord) => {
    const rows = readArray(DB_KEYS.flags);
    rows.push(flagRecord);
    writeArray(DB_KEYS.flags, rows);
    return flagRecord;
};

export const clearAllData = async () => { Object.values(DB_KEYS).forEach((key) => localStorage.removeItem(key)); };

export const replaceData = async (data) => {
    writeArray(DB_KEYS.sessions, data.sessions ?? []);
    writeArray(DB_KEYS.attempts, data.attempts ?? []);
    writeArray(DB_KEYS.flags, data.flags ?? []);
};

export const getAllData = async () => {
    return {
        sessions: readArray(DB_KEYS.sessions),
        attempts: readArray(DB_KEYS.attempts),
        flags: readArray(DB_KEYS.flags)
    };
};
