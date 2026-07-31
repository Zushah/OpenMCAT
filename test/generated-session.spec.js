import { readFile } from "node:fs/promises";
import { SAMPLE_SESSION } from "../src/data/samples.js";
import { GENERATOR_OPTIONS_KEY } from "../src/storage/generator.js";
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
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 360, height: 640 });
    const skillButtons = page.getByRole("group", { name: "Skills" }).getByRole("button");
    const skillBoxes = await skillButtons.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()));
    expect(skillBoxes).toHaveLength(4);
    expect(Math.max(...skillBoxes.map((box) => box.width)) - Math.min(...skillBoxes.map((box) => box.width))).toBeLessThan(1);
    await page.setViewportSize(desktopViewport);
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
    await page.setViewportSize({ width: 360, height: 800 });
    const pipelineBox = await pipeline.boundingBox();
    const closeBox = await pipeline.getByRole("button", { name: "Close generation pipeline" }).boundingBox();
    const mobileHeadingBox = await pipeline.getByRole("heading", { name: "Generation pipeline" }).boundingBox();
    expect(Math.abs(pipelineBox.x - (360 - pipelineBox.x - pipelineBox.width))).toBeLessThan(1);
    expect(closeBox.width).toBeCloseTo(40, 0);
    expect(closeBox.height).toBeCloseTo(40, 0);
    expect(closeBox.x).toBeGreaterThanOrEqual(mobileHeadingBox.x + mobileHeadingBox.width);
    const mobileShortcutBoxes = await Promise.all(expectedShortcuts.map(([name]) => shortcuts.getByRole("link", { name }).boundingBox()));
    expect(Math.max(...mobileShortcutBoxes.map((box) => box.y)) - Math.min(...mobileShortcutBoxes.map((box) => box.y))).toBeLessThan(1);
    expect(await shortcuts.getByRole("link").evaluateAll((links) => links.every((link) => link.scrollWidth <= link.clientWidth))).toBe(true);
    const copyPromptBox = await pipeline.getByRole("button", { name: "Copy prompt" }).boundingBox();
    expect(mobileShortcutBoxes.every((box) => box.width < copyPromptBox.width)).toBe(true);
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

    const responsiveSession = structuredClone(SAMPLE_SESSION);
    responsiveSession.session.topicIds.push("bb_metabolism_principles");
    responsiveSession.questions[3].testedTopicIds.push("bb_metabolism_principles");
    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(responsiveSession));
    await pipeline.getByRole("button", { name: "Start session" }).click();

    await expect(page).toHaveURL(/#\/session$/);
    await expect(page.getByRole("heading", { level: 2, name: SAMPLE_SESSION.session.title })).toBeVisible();

    await page.setViewportSize({ width: 360, height: 640 });
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    const navigationPanel = page.getByRole("dialog", { name: "Navigation" });
    const navigationBox = await navigationPanel.boundingBox();
    expect(navigationBox.x).toBeGreaterThanOrEqual(0);
    expect(navigationBox.y).toBeGreaterThanOrEqual(0);
    expect(navigationBox.x + navigationBox.width).toBeLessThanOrEqual(360);
    expect(navigationBox.y + navigationBox.height).toBeLessThanOrEqual(640);
    const lastNavigationItem = navigationPanel.getByRole("button", { name: /Question 5/ });
    await lastNavigationItem.scrollIntoViewIfNeeded();
    await expect(lastNavigationItem).toBeInViewport();
    await navigationPanel.getByRole("button", { name: "Close navigation" }).click();

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
    const lastReviewItem = finalReview.getByRole("button", { name: /Question 5/ });
    await lastReviewItem.scrollIntoViewIfNeeded();
    await expect(lastReviewItem).toBeInViewport();
    const continuePractice = finalReview.getByRole("button", { name: "Continue practice" });
    const endSession = finalReview.getByRole("button", { name: "End session" });
    await expect(continuePractice).toBeInViewport();
    await expect(endSession).toBeInViewport();
    await endSession.click();

    await expect(page).toHaveURL(/#\/review$/);
    await expect(page.getByRole("heading", { level: 2, name: "Session review" })).toBeVisible();
    await expect(page.locator(".stat-card").filter({ hasText: "Score" })).toContainText("5/5");
    await expect(page.locator(".stat-card").filter({ hasText: "Accuracy" })).toContainText("100%");

    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await closeBackupReminderIfVisible(page);
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.locator(".stat-card").filter({ hasText: "Questions answered" })).toContainText("5");
    await expect(page.locator(".stat-card").filter({ hasText: "Overall accuracy" })).toContainText("100%");

    const summaryCards = page.locator(".dashboard-summary-grid .stat-card");
    await expect(summaryCards).toHaveCount(12);
    const phoneSummaryBoxes = await summaryCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().toJSON()));
    expect(new Set(phoneSummaryBoxes.map((box) => Math.round(box.x))).size).toBe(2);
    expect(Math.max(...phoneSummaryBoxes.map((box) => box.width)) - Math.min(...phoneSummaryBoxes.map((box) => box.width))).toBeLessThan(1);
    expect(Math.max(...phoneSummaryBoxes.map((box) => box.height)) - Math.min(...phoneSummaryBoxes.map((box) => box.height))).toBeLessThan(1);

    const filterFields = page.locator(".dashboard-filter-field");
    await expect(filterFields).toHaveCount(5);
    const phoneFilterBoxes = await filterFields.evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().toJSON()));
    expect(new Set(phoneFilterBoxes.map((box) => Math.round(box.x))).size).toBe(2);
    expect(Math.max(...phoneFilterBoxes.map((box) => box.width)) - Math.min(...phoneFilterBoxes.map((box) => box.width))).toBeLessThan(1);
    expect(await page.locator(".dashboard-filters").evaluate((panel) => panel.scrollWidth <= panel.clientWidth)).toBe(true);

    const topicWeaknessCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "Topic weakness priority" }) });
    await expect(topicWeaknessCard.locator(".dashboard-page-range")).toHaveText("1-3 of 4");
    await expect(topicWeaknessCard.locator("tbody tr")).toHaveCount(3);
    const skillPerformanceCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "Skill performance" }) });
    await expect(skillPerformanceCard.locator(".dashboard-page-range")).toHaveText("1-2 of 4");
    await expect(skillPerformanceCard.locator("tbody tr")).toHaveCount(2);

    const chartDataDetails = page.locator(".chart-data-details");
    for (let index = 0; index < await chartDataDetails.count(); index += 1) {
        const details = chartDataDetails.nth(index);
        await details.locator("summary").click();
        const tableWrap = details.locator(".chart-data-table");
        await expect(tableWrap).toBeVisible();
        expect(await tableWrap.evaluate((element) => getComputedStyle(element).overflowX)).toMatch(/auto|scroll/);
        expect(await tableWrap.locator("th, td").evaluateAll((cells) => cells.every((cell) => getComputedStyle(cell).whiteSpace === "nowrap"))).toBe(true);
    }

    const weakPairsWrap = page.locator(".weak-pairs-table").locator("..");
    await expect(weakPairsWrap).toBeVisible();
    expect(await weakPairsWrap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await weakPairsWrap.evaluate((element) => getComputedStyle(element).overflowX)).toMatch(/auto|scroll/);

    const heatmapHeaders = page.locator(".heatmap-skill-header");
    expect(await heatmapHeaders.count()).toBeGreaterThan(0);
    expect(await heatmapHeaders.evaluateAll((headers) => headers.every((header) => {
        const headerBox = header.getBoundingClientRect();
        const lines = Array.from(header.querySelectorAll("span"));
        return lines.length === 2 && lines.every((line) => {
            const lineBox = line.getBoundingClientRect();
            return lineBox.left >= headerBox.left && lineBox.right <= headerBox.right;
        });
    }))).toBe(true);
    expect(await heatmapHeaders.evaluateAll((headers) => headers.every((header) => getComputedStyle(header).textAlign === "center"))).toBe(true);

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(skillPerformanceCard.locator(".dashboard-card-pagination")).toHaveCount(0);
    await expect(skillPerformanceCard.locator("tbody tr")).toHaveCount(4);
    const tabletSummaryBoxes = await summaryCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().toJSON()));
    expect(new Set(tabletSummaryBoxes.map((box) => Math.round(box.x))).size).toBe(3);
    const tabletFilterBoxes = await filterFields.evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().toJSON()));
    expect(new Set(tabletFilterBoxes.map((box) => Math.round(box.x))).size).toBe(3);
    expect(await page.locator(".dashboard-filters").evaluate((panel) => panel.scrollWidth <= panel.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 1200, height: 900 });
    const desktopSummaryBoxes = await summaryCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().toJSON()));
    expect(new Set(desktopSummaryBoxes.map((box) => Math.round(box.x))).size).toBe(4);
    await expect(topicWeaknessCard.locator(".dashboard-card-pagination")).toHaveCount(0);
    await expect(topicWeaknessCard.locator("tbody tr")).toHaveCount(4);
    await page.setViewportSize({ width: 360, height: 640 });
    await expect(skillPerformanceCard.locator(".dashboard-page-range")).toHaveText("1-2 of 4");

    const modelUsageDetails = page.locator(".model-usage-data-details");
    await modelUsageDetails.locator("summary").click();
    const modelTableWrap = modelUsageDetails.locator(".chart-data-table");
    await expect(modelTableWrap).toBeVisible();
    expect(await modelTableWrap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    await page.evaluate((key) => {
        const stored = JSON.parse(localStorage.getItem(key));
        stored.topicIdsBySection = {
            bb: stored.config.sectionId === "bb" ? stored.config.topicIds : ["bb_amino_acids"],
            cp: ["cp_force"],
            ps: ["ps_vision"]
        };
        localStorage.setItem(key, JSON.stringify(stored));
    }, GENERATOR_OPTIONS_KEY);
    await page.locator(".dashboard-recommendation").getByRole("button", { name: "Load this drill" }).click();
    await expect(page).toHaveURL(/#\/generate$/);
    const recommendationOptions = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), GENERATOR_OPTIONS_KEY);
    expect(Object.keys(recommendationOptions.topicIdsBySection)).toEqual([recommendationOptions.config.sectionId]);
    await expect(page.getByLabel("Section")).toHaveValue(recommendationOptions.config.sectionId);
    await expect(page.getByLabel("Question format")).toHaveValue(recommendationOptions.config.questionFormat);
    await expect(page.getByLabel("Question count (1-59)")).toHaveValue(String(recommendationOptions.config.questionCount));
    await page.reload();
    await expect(page.getByLabel("Section")).toHaveValue(recommendationOptions.config.sectionId);
    await expect(page.getByLabel("Question count (1-59)")).toHaveValue(String(recommendationOptions.config.questionCount));
    await page.getByRole("link", { name: "Dashboard" }).click();
    await closeBackupReminderIfVisible(page);
    await expect(page).toHaveURL(/#\/dashboard$/);

    await page.getByRole("button", { name: "Evaluate dashboard stats with AI" }).click();
    const analyticsPipeline = page.getByRole("dialog", { name: "Evaluate with AI" });
    await expect(analyticsPipeline).toBeVisible();
    const analyticsPipelineBox = await analyticsPipeline.boundingBox();
    const analyticsCloseBox = await analyticsPipeline.getByRole("button", { name: "Close" }).boundingBox();
    const analyticsHeadingBox = await analyticsPipeline.getByRole("heading", { name: "Evaluate with AI" }).boundingBox();
    expect(Math.abs(analyticsPipelineBox.x - (360 - analyticsPipelineBox.x - analyticsPipelineBox.width))).toBeLessThan(1);
    expect(analyticsCloseBox.width).toBeCloseTo(40, 0);
    expect(analyticsCloseBox.x).toBeGreaterThanOrEqual(analyticsHeadingBox.x + analyticsHeadingBox.width);
    await analyticsPipeline.getByRole("button", { name: "Copy prompt" }).click();
    await expect(analyticsPipeline.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("OpenMCAT analytics");
    await analyticsPipeline.getByRole("button", { name: "Close" }).click();

    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Backup data" }).click();
    const backupDialog = page.getByRole("dialog", { name: "Backup data" });
    await expect(backupDialog).toBeVisible();
    const backupDialogBox = await backupDialog.boundingBox();
    expect(backupDialogBox.y + backupDialogBox.height).toBeLessThanOrEqual(640);
    const metadataBoxes = await backupDialog.locator(".settings-data-confirmation-metadata > div").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
    expect(metadataBoxes.length).toBeGreaterThan(1);
    expect(Math.max(...metadataBoxes.map((box) => box.y)) - Math.min(...metadataBoxes.map((box) => box.y))).toBeLessThan(1);
    const confirmationActionBoxes = await Promise.all(["Confirm", "Deny"].map((name) => backupDialog.getByRole("button", { name, exact: true }).boundingBox()));
    expect(Math.abs(confirmationActionBoxes[0].y - confirmationActionBoxes[1].y)).toBeLessThan(1);
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
