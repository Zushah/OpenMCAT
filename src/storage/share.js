import { createBackupArtifact } from "./exportimport.js";

const getShareNavigator = () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
    if (typeof File !== "function") return null;
    return navigator;
};

const createBackupFiles = (artifact) => {
    return [
        new File([artifact.blob], artifact.fileName, { type: "application/gzip" }),
        new File([artifact.blob], artifact.fileName, { type: "application/octet-stream" })
    ];
};

const selectShareableFile = (shareNavigator, artifact) => {
    for (const file of createBackupFiles(artifact)) {
        try {
            if (shareNavigator.canShare({ files: [file] }) === true) return file;
        } catch (error) {
            console.warn(`OpenMCAT: failed checking whether ${file.name} can be shared.`, error);
        }
    }
    return null;
};

export const getShareableBackupDetails = (artifact) => {
    const shareNavigator = getShareNavigator();
    if (!shareNavigator) return null;
    const file = selectShareableFile(shareNavigator, artifact);
    return file ? { fileName: file.name, fileSize: file.size } : null;
};

export const canShareBackup = () => {
    const shareNavigator = getShareNavigator();
    if (!shareNavigator) return false;
    if (typeof CompressionStream !== "function") return false;
    const blob = new Blob([new Uint8Array([0x1f, 0x8b, 0x08, 0x00])], { type: "application/gzip" });
    return Boolean(selectShareableFile(shareNavigator, { blob, fileName: "openmcat-data.json.gz" }));
};

export const shareBackup = async (payload, now = new Date(), preparedArtifact = null) => {
    const shareNavigator = getShareNavigator();
    if (!shareNavigator) return { outcome: "unsupported" };
    const artifact = preparedArtifact ?? await createBackupArtifact(payload, now);
    const file = selectShareableFile(shareNavigator, artifact);
    if (!file) return { outcome: "unsupported" };
    let shareResult;
    try {
        shareResult = shareNavigator.share({ files: [file] });
    } catch (error) {
        console.warn("OpenMCAT: failed opening the browser share interface.", error);
        return { outcome: "failed" };
    }
    if (!shareResult || typeof shareResult.then !== "function") {
        console.warn("OpenMCAT: the browser share interface did not return a Promise.");
        return { outcome: "failed" };
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
