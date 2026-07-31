import { readFile } from "node:fs/promises";
import { SAMPLE_SESSION } from "../src/data/samples.js";
import { closeBackupReminderIfVisible, expect, test } from "./fixtures.js";

test("the generated-session workflow reaches review, analytics, and a data backup", async ({ browserName, page }) => {
    if (browserName !== "chromium") {
        await page.addInitScript(() => {
            let clipboardText = "";
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    readText: async () => clipboardText,
                    writeText: async (text) => { clipboardText = String(text); }
                }
            });
        });
    }

    await page.goto("/#/generate");
    await page.getByRole("button", { name: "Generate practice session" }).click();

    const pipeline = page.getByRole("dialog", { name: "Generation pipeline" });
    await expect(pipeline).toBeVisible();
    const shortcuts = pipeline.getByRole("navigation", { name: "Open an AI chat" });
    await expect(shortcuts.getByRole("link")).toHaveCount(3);
    const expectedShortcuts = [
        ["Open ChatGPT in a new tab", "https://chatgpt.com/"],
        ["Open Claude in a new tab", "https://claude.ai/new"],
        ["Open DeepSeek in a new tab", "https://chat.deepseek.com/"]
    ];
    for (const [name, href] of expectedShortcuts) {
        const shortcut = shortcuts.getByRole("link", { name });
        await expect(shortcut).toHaveAttribute("href", href);
        await expect(shortcut).toHaveAttribute("target", "_blank");
        await expect(shortcut).toHaveAttribute("rel", "noopener");
    }
    const shortcutBoxes = await Promise.all(expectedShortcuts.map(([name]) => shortcuts.getByRole("link", { name }).boundingBox()));
    expect(shortcutBoxes.every(Boolean)).toBe(true);
    expect(Math.max(...shortcutBoxes.map((box) => box.y)) - Math.min(...shortcutBoxes.map((box) => box.y))).toBeLessThan(1);
    expect(await shortcuts.locator("img").evaluateAll((icons) => icons.every((icon) => icon.complete && icon.naturalWidth > 0))).toBe(true);
    const headingBox = await pipeline.getByRole("heading", { name: "Generation pipeline" }).boundingBox();
    const shortcutsBox = await shortcuts.boundingBox();
    const instructionsBox = await pipeline.getByText("Copy prompt → Paste into an AI chat → Copy its output → Paste here:").boundingBox();
    expect(headingBox.y).toBeLessThan(shortcutsBox.y);
    expect(shortcutsBox.y).toBeLessThan(instructionsBox.y);
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 360, height: 800 });
    const mobileShortcutBoxes = await Promise.all(expectedShortcuts.map(([name]) => shortcuts.getByRole("link", { name }).boundingBox()));
    expect(Math.max(...mobileShortcutBoxes.map((box) => box.y)) - Math.min(...mobileShortcutBoxes.map((box) => box.y))).toBeLessThan(1);
    expect(await shortcuts.getByRole("link").evaluateAll((links) => links.every((link) => link.scrollWidth <= link.clientWidth))).toBe(true);
    await page.setViewportSize(desktopViewport);
    await pipeline.getByRole("button", { name: "Copy prompt" }).click();
    await expect(pipeline.getByRole("button", { name: "Copied" })).toBeVisible();
    const prompt = await page.evaluate(() => navigator.clipboard.readText());
    expect(prompt).toContain("Generate a practice session with the following settings:");
    expect(prompt).toContain('"schemaVersion": "1.0"');

    const invalidSession = structuredClone(SAMPLE_SESSION);
    delete invalidSession.schemaVersion;
    invalidSession.questions = invalidSession.questions.slice(0, -1);
    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(invalidSession));
    await pipeline.getByRole("button", { name: "Start session" }).click();
    await expect(pipeline.getByPlaceholder("Paste output")).toHaveValue("");
    const error = pipeline.locator(".generation-pipeline-error");
    await expect(error).toContainText("schemaVersion is required.");
    await expect(error).toContainText("Question count mismatch. Expected 5, received 4.");
    await expect(pipeline.getByRole("button", { name: "Start session" })).toHaveClass(/btn-secondary/);
    const repairButton = pipeline.getByRole("button", { name: "Copy repair prompt" });
    await expect(repairButton).toHaveClass(/btn-primary/);
    const startBox = await pipeline.getByRole("button", { name: "Start session" }).boundingBox();
    const errorBox = await error.boundingBox();
    const repairBox = await repairButton.boundingBox();
    expect(startBox.y).toBeLessThan(errorBox.y);
    expect(errorBox.y).toBeLessThan(repairBox.y);
    await repairButton.click();
    await expect(pipeline.getByRole("button", { name: "Copied" })).toBeVisible();
    const repairPrompt = await page.evaluate(() => navigator.clipboard.readText());
    expect(repairPrompt).toContain('Add the top-level field "schemaVersion" with the value "1.0".');
    expect(repairPrompt).toContain("Return exactly 5 questions instead of 4.");
    expect(repairPrompt).toContain("one single-line JSON object");
    expect(repairPrompt.length).toBeLessThan(600);

    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(SAMPLE_SESSION));
    await pipeline.getByRole("button", { name: "Start session" }).click();

    await expect(page).toHaveURL(/#\/session$/);
    await expect(page.getByRole("heading", { level: 2, name: SAMPLE_SESSION.session.title })).toBeVisible();

    for (let index = 0; index < SAMPLE_SESSION.questions.length; index += 1) {
        const question = SAMPLE_SESSION.questions[index];
        const questionCard = page.locator(".question-card");
        await expect(page.getByRole("heading", { level: 3, name: `Question ${index + 1}` })).toBeVisible();
        await questionCard.locator(`.choice-card[data-choice-id="${question.correctChoiceId}"]`).click();
        await questionCard.getByRole("button", { name: "Submit", exact: true }).click();
        await expect(questionCard.getByText("Correct.", { exact: true })).toBeVisible();
        await questionCard.getByRole("button", { name: index + 1 === SAMPLE_SESSION.questions.length ? "Review" : "Next", exact: true }).click();
    }

    const finalReview = page.getByRole("dialog", { name: "Review" });
    await expect(finalReview).toBeVisible();
    const submittedStat = finalReview.locator(".practice-panel-stat").filter({ hasText: "Submitted" });
    await expect(submittedStat.locator("strong")).toHaveText("5");
    await finalReview.getByRole("button", { name: "End session" }).click();

    await expect(page).toHaveURL(/#\/review$/);
    await expect(page.getByRole("heading", { level: 2, name: "Session review" })).toBeVisible();
    await expect(page.locator(".stat-card").filter({ hasText: "Score" })).toContainText("5/5");
    await expect(page.locator(".stat-card").filter({ hasText: "Accuracy" })).toContainText("100%");

    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await closeBackupReminderIfVisible(page);
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.locator(".stat-card").filter({ hasText: "Questions answered" })).toContainText("5");
    await expect(page.locator(".stat-card").filter({ hasText: "Overall accuracy" })).toContainText("100%");

    await page.getByRole("button", { name: "Evaluate dashboard stats with AI" }).click();
    const analyticsPipeline = page.getByRole("dialog", { name: "Evaluate with AI" });
    await expect(analyticsPipeline).toBeVisible();
    await analyticsPipeline.getByRole("button", { name: "Copy prompt" }).click();
    await expect(analyticsPipeline.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("OpenMCAT analytics");
    await analyticsPipeline.getByRole("button", { name: "Close" }).click();

    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Backup data" }).click();
    const backupDialog = page.getByRole("dialog", { name: "Backup data" });
    await expect(backupDialog).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await backupDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^openmcat-data_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const backup = JSON.parse(await readFile(downloadPath, "utf8"));
    expect(backup.sessions).toHaveLength(1);
    expect(backup.attempts).toHaveLength(5);
});
