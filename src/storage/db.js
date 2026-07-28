const DATABASE_NAME = "openmcat";
const DATABASE_VERSION = 1;

const STORE_NAMES = {
    sessions: "sessions",
    attempts: "attempts",
    metadata: "metadata"
};

const LEGACY_DB_KEYS = {
    sessions: "openmcat_sessions_v1",
    attempts: "openmcat_attempts_v1",
    flags: "openmcat_flags_v1"
};

const LOCAL_STORAGE_MIGRATION_KEY = "localStorageMigration";
const LOCAL_STORAGE_MIGRATION_VERSION = 1;
const DATA_CHANGE_CHANNEL_NAME = "openmcat_data_changes_v1";

let databasePromise = null;
let storageInitializationPromise = null;
let dataChangeChannel = null;

const notifyDataChanged = () => {
    try { dataChangeChannel?.postMessage({ type: "data-changed" }); }
    catch (error) { console.warn("OpenMCAT: failed notifying other tabs about a data change.", error); }
};

export const subscribeToDataChanges = (listener) => {
    if (typeof BroadcastChannel === "undefined" || typeof listener !== "function") return () => { };
    if (!dataChangeChannel) dataChangeChannel = new BroadcastChannel(DATA_CHANGE_CHANNEL_NAME);
    const handleMessage = (event) => { if (event.data?.type === "data-changed") listener(); };
    dataChangeChannel.addEventListener("message", handleMessage);
    return () => dataChangeChannel?.removeEventListener("message", handleMessage);
};

const requestResult = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
});

const transactionComplete = (transaction) => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
});

const abortTransaction = (transaction) => {
    try { transaction.abort(); } catch { }
};

const isValidRecord = (record) => record && typeof record === "object" && !Array.isArray(record) && typeof record.id === "string" && Boolean(record.id);

const validateRecords = (records, label) => {
    if (!Array.isArray(records)) throw new TypeError(`${label} must be an array.`);
    records.forEach((record, index) => { if (!isValidRecord(record)) throw new TypeError(`${label} record ${index + 1} must be an object with a non-empty string id.`); });
    return records;
};

const createDatabaseSchema = (request) => {
    const database = request.result;
    const transaction = request.transaction;
    if (!database.objectStoreNames.contains(STORE_NAMES.sessions)) database.createObjectStore(STORE_NAMES.sessions, { keyPath: "id" });
    let attempts;
    if (!database.objectStoreNames.contains(STORE_NAMES.attempts)) attempts = database.createObjectStore(STORE_NAMES.attempts, { keyPath: "id" });
    else attempts = transaction.objectStore(STORE_NAMES.attempts);
    if (!attempts.indexNames.contains("sessionId")) attempts.createIndex("sessionId", "sessionId", { unique: false });
    if (!attempts.indexNames.contains("answeredAt")) attempts.createIndex("answeredAt", "answeredAt", { unique: false });
    if (!database.objectStoreNames.contains(STORE_NAMES.metadata)) database.createObjectStore(STORE_NAMES.metadata, { keyPath: "key" });
};

const openDatabase = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB is not available in this browser.")); return; }
        let settled = false;
        let request;
        try { request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
        catch (error) { reject(error); return; }
        request.onupgradeneeded = () => createDatabaseSchema(request);
        request.onerror = () => {
            if (settled) return;
            settled = true;
            reject(request.error ?? new Error("IndexedDB could not be opened."));
        };
        request.onblocked = () => {
            if (settled) return;
            settled = true;
            reject(new Error("A different OpenMCAT tab is blocking the browser database upgrade. Close other OpenMCAT tabs and try again."));
        };
        request.onsuccess = () => {
            const database = request.result;
            if (settled) { database.close(); return; }
            settled = true;
            database.onversionchange = () => {
                database.close();
                databasePromise = null;
                storageInitializationPromise = null;
            };
            resolve(database);
        };
    }).catch((error) => {
        databasePromise = null;
        throw error;
    });
    return databasePromise;
};

const readMetadata = async (database, key) => {
    const transaction = database.transaction(STORE_NAMES.metadata, "readonly");
    const completed = transactionComplete(transaction);
    try {
        const value = await requestResult(transaction.objectStore(STORE_NAMES.metadata).get(key));
        await completed;
        return value;
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
};

const readLegacyRecords = (key, label) => {
    if (typeof localStorage === "undefined") return [];
    let raw;
    try { raw = localStorage.getItem(key); }
    catch (error) { throw new Error(`OpenMCAT could not read the existing ${label} data from this browser.`, { cause: error }); }
    if (!raw) return [];
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (error) { throw new Error(`The existing OpenMCAT ${label} data is not valid JSON and was left unchanged.`, { cause: error }); }
    try { return validateRecords(parsed, `Legacy ${label}`); }
    catch (error) { throw new Error(`The existing OpenMCAT ${label} data has an invalid record and was left unchanged.`, { cause: error }); }
};

const removeLegacyData = () => {
    if (typeof localStorage === "undefined") return;
    Object.values(LEGACY_DB_KEYS).forEach((key) => {
        try { localStorage.removeItem(key); }
        catch (error) { console.warn(`OpenMCAT: failed removing migrated ${key}`, error); }
    });
};

const migrateLegacyData = async (database) => {
    const completedMigration = await readMetadata(database, LOCAL_STORAGE_MIGRATION_KEY);
    if (completedMigration?.version >= LOCAL_STORAGE_MIGRATION_VERSION) { removeLegacyData(); return; }
    const sessions = readLegacyRecords(LEGACY_DB_KEYS.sessions, "sessions");
    const attempts = readLegacyRecords(LEGACY_DB_KEYS.attempts, "attempts");
    const transaction = database.transaction(Object.values(STORE_NAMES), "readwrite");
    const completed = transactionComplete(transaction);
    try {
        const sessionStore = transaction.objectStore(STORE_NAMES.sessions);
        const attemptStore = transaction.objectStore(STORE_NAMES.attempts);
        sessions.forEach((session) => sessionStore.put(session));
        attempts.forEach((attempt) => attemptStore.put(attempt));
        transaction.objectStore(STORE_NAMES.metadata).put({
            key: LOCAL_STORAGE_MIGRATION_KEY,
            version: LOCAL_STORAGE_MIGRATION_VERSION,
            completedAt: new Date().toISOString(),
            sessionCount: sessions.length,
            attemptCount: attempts.length
        });
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw new Error("OpenMCAT could not prepare the existing browser data for migration. The original data was left unchanged.", { cause: error }); }
    try { await completed; }
    catch (error) { throw new Error("OpenMCAT could not finish moving the existing browser data. The original data was left unchanged.", { cause: error }); }
    removeLegacyData();
};

export const initializeStorage = () => {
    if (storageInitializationPromise) return storageInitializationPromise;
    storageInitializationPromise = (async () => {
        const database = await openDatabase();
        await migrateLegacyData(database);
        return database;
    })().catch((error) => { storageInitializationPromise = null; throw error; });
    return storageInitializationPromise;
};

const getAllFromStore = async (storeName) => {
    const database = await initializeStorage();
    const transaction = database.transaction(storeName, "readonly");
    const completed = transactionComplete(transaction);
    try {
        const rows = await requestResult(transaction.objectStore(storeName).getAll());
        await completed;
        return rows;
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
};

const addRecord = async (storeName, record, label) => {
    validateRecords([record], label);
    const database = await initializeStorage();
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionComplete(transaction);
    try {
        await requestResult(transaction.objectStore(storeName).add(record));
        await completed;
        notifyDataChanged();
        return record;
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
};

const updateRecord = async (storeName, recordId, patch) => {
    if (typeof recordId !== "string" || !recordId) throw new TypeError("Record id must be a non-empty string.");
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("Record patch must be an object.");
    const database = await initializeStorage();
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(storeName);
    try {
        const current = await requestResult(store.get(recordId));
        if (!current) { await completed; return; }
        await requestResult(store.put({ ...current, ...patch, id: recordId }));
        await completed;
        notifyDataChanged();
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
};

export const getSessions = async () => getAllFromStore(STORE_NAMES.sessions);

export const saveSession = async (sessionRecord) => addRecord(STORE_NAMES.sessions, sessionRecord, "Session");

export const updateSession = async (sessionId, patch) => updateRecord(STORE_NAMES.sessions, sessionId, patch);

export const getAttempts = async () => getAllFromStore(STORE_NAMES.attempts);

export const saveAttempt = async (attemptRecord) => addRecord(STORE_NAMES.attempts, attemptRecord, "Attempt");

export const updateAttempt = async (attemptId, patch) => updateRecord(STORE_NAMES.attempts, attemptId, patch);

export const clearAllData = async () => {
    const database = await initializeStorage();
    const transaction = database.transaction([STORE_NAMES.sessions, STORE_NAMES.attempts], "readwrite");
    const completed = transactionComplete(transaction);
    try {
        transaction.objectStore(STORE_NAMES.sessions).clear();
        transaction.objectStore(STORE_NAMES.attempts).clear();
        await completed;
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
    removeLegacyData();
    notifyDataChanged();
};

export const replaceData = async (data) => {
    const sessions = validateRecords(data?.sessions ?? [], "Sessions");
    const attempts = validateRecords(data?.attempts ?? [], "Attempts");
    const database = await initializeStorage();
    const transaction = database.transaction([STORE_NAMES.sessions, STORE_NAMES.attempts], "readwrite");
    const completed = transactionComplete(transaction);
    try {
        const sessionStore = transaction.objectStore(STORE_NAMES.sessions);
        const attemptStore = transaction.objectStore(STORE_NAMES.attempts);
        sessionStore.clear();
        attemptStore.clear();
        sessions.forEach((session) => sessionStore.put(session));
        attempts.forEach((attempt) => attemptStore.put(attempt));
        await completed;
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
    removeLegacyData();
    notifyDataChanged();
};

export const getAllData = async () => {
    const database = await initializeStorage();
    const transaction = database.transaction([STORE_NAMES.sessions, STORE_NAMES.attempts], "readonly");
    const completed = transactionComplete(transaction);
    try {
        const sessionRequest = requestResult(transaction.objectStore(STORE_NAMES.sessions).getAll());
        const attemptRequest = requestResult(transaction.objectStore(STORE_NAMES.attempts).getAll());
        const [sessions, attempts] = await Promise.all([sessionRequest, attemptRequest]);
        await completed;
        return { sessions, attempts };
    } catch (error) { abortTransaction(transaction); await completed.catch(() => { }); throw error; }
};
