const getShareNavigator = () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
    if (typeof File !== "function") return null;
    return navigator;
};

const createBackupFiles = (payload, now = new Date()) => {
    const content = JSON.stringify(payload, null, 2);
    const stamp = now.toISOString().slice(0, 10);
    return [
        new File([content], `openmcat-export-${stamp}.json`, { type: "application/json" }),
        new File([content], `openmcat-export-${stamp}.txt`, { type: "text/plain" })
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
