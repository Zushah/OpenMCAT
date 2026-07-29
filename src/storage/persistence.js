const getStorageManager = () => {
    if (typeof navigator === "undefined" || !navigator.storage) return null;
    return navigator.storage;
};

const createStatus = (status, canRequest = false) => ({
    status,
    persisted: status === "persisted",
    canRequest
});

export const checkPersistentStorage = async () => {
    const storage = getStorageManager();
    if (!storage) return createStatus("unsupported");
    const canRequest = typeof storage.persist === "function";
    if (typeof storage.persisted !== "function") return createStatus(canRequest ? "unknown" : "unsupported", canRequest);
    try {
        const persisted = await storage.persisted();
        return createStatus(persisted === true ? "persisted" : "not-persisted", canRequest);
    } catch (error) {
        console.warn("OpenMCAT: failed checking persistent browser storage.", error);
        return createStatus("error", canRequest);
    }
};

export const requestPersistentStorage = async () => {
    const storage = getStorageManager();
    if (!storage || typeof storage.persist !== "function") return { ...createStatus("unsupported"), outcome: "unsupported" };
    try {
        const persisted = await storage.persist();
        return {
            ...createStatus(persisted === true ? "persisted" : "not-persisted", true),
            outcome: persisted === true ? "granted" : "denied"
        };
    } catch (error) {
        console.warn("OpenMCAT: failed requesting persistent browser storage.", error);
        return { ...createStatus("error", true), outcome: "error" };
    }
};
