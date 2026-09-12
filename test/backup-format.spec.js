import { expect, test } from "./fixtures.js";
import { gzipSync } from "node:zlib";

const createPayload = (suffix, exportedAt = "2026-08-23T12:34:56.789Z") => ({
    exportVersion: "1.0",
    exportedAt,
    app: "OpenMCAT",
    settings: {},
    sessions: [{ id: `session-${suffix}`, title: `Unicode — ${suffix}` }],
    attempts: [{ id: `attempt-${suffix}`, sessionId: `session-${suffix}`, answer: "Curly “quotes”" }]
});

test("the backup codec round-trips gzip and retains legacy JSON support", async ({ page }) => {
    await page.goto("/#/settings");
    const result = await page.evaluate(async (payload) => {
        const codec = await import("/src/storage/exportimport.js");
        const artifact = await codec.createBackupArtifact(payload, new Date("2026-08-23T12:34:56.789Z"));
        const compressedBytes = new Uint8Array(await artifact.blob.arrayBuffer());
        const compressedPayload = await codec.parseImportFile(new File([artifact.blob], artifact.fileName, { type: artifact.blob.type }));
        const legacyText = JSON.stringify(payload, null, 2);
        const legacyPayload = await codec.parseImportFile(new File([legacyText], "legacy.json", { type: "application/json" }));
        return {
            compressedPayload,
            legacyPayload,
            fileName: artifact.fileName,
            fileSize: artifact.fileSize,
            gzipSignature: Array.from(compressedBytes.slice(0, 2)),
            prettySize: new Blob([legacyText]).size
        };
    }, createPayload("round-trip"));

    expect(result.compressedPayload).toEqual(createPayload("round-trip"));
    expect(result.legacyPayload).toEqual(createPayload("round-trip"));
    expect(result.fileName).toMatch(/^openmcat-data_2026-08-(22|23)_\d{2}-34-56\.json\.gz$/);
    expect(result.gzipSignature).toEqual([0x1f, 0x8b]);
    expect(result.fileSize).toBeLessThan(result.prettySize);
});

test("an unused backup reports no current data and skips compression", async ({ page }) => {
    await page.goto("/#/settings");
    await expect(page.getByText("You have no current OpenMCAT data.", { exact: true })).toBeVisible();
    await page.waitForTimeout(100);
    const status = await page.evaluate(async () => {
        const { state } = await import("/src/app.js");
        return state.analytics.backupStatus;
    });
    expect(status.hasData).toBe(false);
    expect(status.dataSizeBytes).toBeGreaterThan(0);
    expect(status.dataSizeBytes).toBe(status.emptyDataSizeBytes);
    expect(status.dataSizeFormat).toBe("json");
});

test("the data-size indicator compresses used data only after it becomes visible", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
        const { saveSession } = await import("/src/storage/db.js");
        await saveSession({ id: "session-size-indicator", generatedSession: { questions: [{ stem: "Stored study data" }] } });
    });
    await page.reload();
    await expect.poll(() => page.evaluate(async () => {
        const { state } = await import("/src/app.js");
        return state.analytics?.backupStatus?.dataSizeFormat;
    })).toBe("json");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByText(/^You have .* of current OpenMCAT data\.$/)).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
        const { state } = await import("/src/app.js");
        return state.analytics?.backupStatus?.dataSizeFormat;
    })).toBe("json.gz");
    await expect(page.getByText("You have <0.01 MB of current OpenMCAT data.", { exact: true })).toBeVisible();
});

test("the backup codec reports corrupt gzip and unsupported payload versions distinctly", async ({ page }) => {
    await page.goto("/#/settings");
    const errors = await page.evaluate(async (payload) => {
        const codec = await import("/src/storage/exportimport.js");
        const messages = [];
        const files = [
            new File([new Uint8Array([0x1f, 0x8b, 0x08, 0xff])], "broken.json.gz", { type: "application/gzip" }),
            new File([JSON.stringify({ ...payload, exportVersion: "99.0" })], "future.json", { type: "application/json" })
        ];
        for (const file of files) {
            try { await codec.parseImportFile(file); }
            catch (error) { messages.push(error.message); }
        }
        return messages;
    }, createPayload("errors"));

    expect(errors[0]).toContain("not a valid gzip-compressed OpenMCAT backup");
    expect(errors[1]).toContain("unsupported OpenMCAT export version");
});

test("sharing sends the same gzip format used by downloads", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "canShare", { configurable: true, value: ({ files }) => files?.[0]?.name.endsWith(".json.gz") === true });
        Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async ({ files }) => {
                const file = files[0];
                window.__openmcatSharedFile = { name: file.name, type: file.type, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) };
            }
        });
    });
    await page.goto("/#/settings");
    await page.getByRole("button", { name: "Share data" }).click();
    const shareDialog = page.getByRole("dialog", { name: "Share data" });
    await expect(shareDialog).toBeVisible();
    await shareDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("Shared OpenMCAT data backup.", { exact: true })).toBeVisible();
    const shared = await page.evaluate(() => window.__openmcatSharedFile);
    expect(shared.name).toMatch(/^openmcat-data_.*\.json\.gz$/);
    expect(shared.type).toBe("application/gzip");
    expect(shared.bytes.slice(0, 2)).toEqual([0x1f, 0x8b]);
});

test("restore and merge accept compressed and legacy backups together", async ({ page }) => {
    const firstPayload = createPayload("compressed", "2026-08-22T12:00:00.000Z");
    const secondPayload = createPayload("legacy", "2026-08-23T12:00:00.000Z");
    const firstJson = JSON.stringify(firstPayload);
    const secondJson = JSON.stringify(secondPayload);

    await page.goto("/#/settings");
    await page.locator("#restore-file").setInputFiles({
        name: "compressed.json.gz",
        mimeType: "application/gzip",
        buffer: gzipSync(Buffer.from(firstJson))
    });
    await page.getByRole("button", { name: "Import data", exact: true }).first().click();
    const restoreDialog = page.getByRole("dialog", { name: "Restore data" });
    await expect(restoreDialog).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await restoreDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("Data imported.", { exact: true })).toBeVisible();

    await page.locator("#combine-files").setInputFiles([
        { name: "duplicate.json.gz", mimeType: "application/gzip", buffer: gzipSync(Buffer.from(firstJson)) },
        { name: "legacy.json", mimeType: "application/json", buffer: Buffer.from(secondJson) }
    ]);
    await page.getByRole("button", { name: "Import data", exact: true }).last().click();
    const mergeDialog = page.getByRole("dialog", { name: "Merge data" });
    await expect(mergeDialog).toBeVisible();
    await expect(mergeDialog).toContainText("+1");
    page.once("dialog", (dialog) => dialog.accept());
    await mergeDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText(/Combined 2 backups and added 2 new records\./)).toBeVisible();

    await page.getByRole("button", { name: "Backup data" }).click();
    const backupDialog = page.getByRole("dialog", { name: "Backup data" });
    const currentCounts = backupDialog.locator(".settings-data-confirmation-stat").first();
    await expect(currentCounts.locator("strong")).toHaveText(["2", "2"]);
    await expect(currentCounts.locator(".settings-data-confirmation-metric > span")).toHaveText(["sessions", "attempts"]);
});
