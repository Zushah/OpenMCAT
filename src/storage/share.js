import { getExportFileName } from "./exportimport.js";

const getShareNavigator = () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
    if (typeof File !== "function") return null;
    return navigator;
};

const createBackupFiles = (payload, now = new Date()) => {
    const content = JSON.stringify(payload, null, 2);
    return [
        new File([content], getExportFileName(payload, "json", now), { type: "application/json" }),
        new File([content], getExportFileName(payload, "txt", now), { type: "text/plain" })
    ];
};

const selectShareableFile = (shareNavigator, payload, now) => {
    for (const file of createBackupFiles(payload, now)) {
        try {
            if (shareNavigator.canShare({ files: [file] }) === true) return file;
        } catch (error) {
            console.warn(`OpenMCAT: failed checking whether ${file.name} can be shared.`, error);
        }
    }
    return null;
};

export const getShareableBackupDetails = (payload) => {
    const shareNavigator = getShareNavigator();
    if (!shareNavigator) return null;
    const file = selectShareableFile(shareNavigator, payload, new Date());
    return file ? { fileName: file.name, fileSize: file.size } : null;
};

export const canShareBackup = () => {
    const shareNavigator = getShareNavigator();
    if (!shareNavigator) return false;
    const probe = { app: "OpenMCAT", exportVersion: "1.0", settings: {}, sessions: [], attempts: [] };
    return Boolean(selectShareableFile(shareNavigator, probe, new Date(0)));
};

export const shareBackup = (payload, now = new Date()) => {
    const shareNavigator = getShareNavigator();
    if (!shareNavigator) return Promise.resolve({ outcome: "unsupported" });
    const file = selectShareableFile(shareNavigator, payload, now);
    if (!file) return Promise.resolve({ outcome: "unsupported" });
    let shareResult;
    try {
        shareResult = shareNavigator.share({ files: [file] });
    } catch (error) {
        console.warn("OpenMCAT: failed opening the browser share interface.", error);
        return Promise.resolve({ outcome: "failed" });
    }
    if (!shareResult || typeof shareResult.then !== "function") {
        console.warn("OpenMCAT: the browser share interface did not return a Promise.");
        return Promise.resolve({ outcome: "failed" });
    }
    return shareResult.then(
        () => ({ outcome: "shared", fileName: file.name }),
        (error) => {
            if (error?.name === "AbortError") return { outcome: "canceled" };
            console.warn("OpenMCAT: the browser could not share the data backup.", error);
            return { outcome: "failed" };
        }
    );
};
