import { DEFAULT_CONFIG } from "../src/data/defaults.js";
import { GENERATOR_OPTIONS_KEY } from "../src/storage/generator.js";
import { expect, test } from "./fixtures.js";

const getTopicButton = (page, name) => page.getByRole("group", { name: "Topics" }).getByRole("button", { name: new RegExp(`^${name}\\.`) });

test("generator options are normalized, remembered, restored, and reset", async ({ page }) => {
    await page.goto("/#/generate");

    await page.evaluate(({ key, config }) => localStorage.setItem(key, JSON.stringify({ version: 0, config })), {
        key: GENERATOR_OPTIONS_KEY,
        config: { ...DEFAULT_CONFIG, sectionId: "cp", topicIds: ["cp_force"] }
    });
    await page.reload();
    await expect(page.getByLabel("Section")).toHaveValue(DEFAULT_CONFIG.sectionId);
    await expect(getTopicButton(page, "Amino Acids")).toHaveAttribute("aria-pressed", "true");

    await page.evaluate((key) => localStorage.setItem(key, "{malformed"), GENERATOR_OPTIONS_KEY);
    await page.reload();
    await expect(page.getByLabel("Section")).toHaveValue(DEFAULT_CONFIG.sectionId);
    await expect(page.getByLabel("Question count (1-59)")).toHaveValue(String(DEFAULT_CONFIG.questionCount));

    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
        version: 1,
        config: {
            sectionId: "retired-section",
            topicIds: ["retired-topic"],
            skillIds: "retired-skill",
            difficulty: "impossible",
            questionFormat: "essay",
            questionCount: 999,
            timingMode: "timed",
            secondsPerQuestion: 1,
            reviewMode: "eventually"
        },
        topicIdsBySection: { bb: ["retired-topic"] }
    })), GENERATOR_OPTIONS_KEY);
    await page.reload();
    await expect(page.getByLabel("Section")).toHaveValue("bb");
    await expect(getTopicButton(page, "Amino Acids")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Question count (1-59)")).toHaveValue("59");
    await expect(page.getByRole("group", { name: "Difficulty" }).getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Question format")).toHaveValue("discrete");
    await expect(page.getByRole("group", { name: "Timing mode" }).getByRole("button", { name: "Timed", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Seconds per question")).toHaveValue("30");
    await expect(page.getByRole("group", { name: "Review mode" }).getByRole("button", { name: "Review immediately" })).toHaveAttribute("aria-pressed", "true");

    const header = page.locator(".generator-options-header");
    const restoreButton = header.getByRole("button", { name: "Restore default options" });
    await expect(restoreButton.locator(".material-symbols-outlined")).toHaveText("sync");
    await page.setViewportSize({ width: 360, height: 800 });
    const titleBox = await header.getByRole("heading", { name: "Session generator" }).boundingBox();
    const restoreBox = await restoreButton.boundingBox();
    expect(Math.abs((titleBox.y + titleBox.height / 2) - (restoreBox.y + restoreBox.height / 2))).toBeLessThan(1);
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(restoreBox.x);
    await page.setViewportSize({ width: 1280, height: 720 });

    await restoreButton.click();
    await expect(page.getByText("Generator options restored to defaults.")).toBeVisible();

    await getTopicButton(page, "Protein Structure").click();
    await page.getByRole("group", { name: "Skills" }).getByRole("button").nth(2).click();
    await page.getByRole("group", { name: "Difficulty" }).getByRole("button", { name: "Hard" }).click();
    await page.getByLabel("Question format").selectOption("passage");
    await page.getByLabel("Question count (1-59)").fill("12");
    await page.getByLabel("Question count (1-59)").blur();
    await page.getByRole("group", { name: "Timing mode" }).getByRole("button", { name: "Timed", exact: true }).click();
    await page.getByLabel("Seconds per question").fill("110");
    await page.getByLabel("Seconds per question").blur();
    await page.getByRole("group", { name: "Review mode" }).getByRole("button", { name: "Review later" }).click();

    await page.getByLabel("Section").selectOption("cp");
    await getTopicButton(page, "Force").click();
    await page.getByLabel("Section").selectOption("bb");
    await expect(getTopicButton(page, "Amino Acids")).toHaveAttribute("aria-pressed", "true");
    await expect(getTopicButton(page, "Protein Structure")).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Section").selectOption("cp");
    await expect(getTopicButton(page, "Translational Motion")).toHaveAttribute("aria-pressed", "true");
    await expect(getTopicButton(page, "Force")).toHaveAttribute("aria-pressed", "true");

    const remembered = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), GENERATOR_OPTIONS_KEY);
    expect(remembered.config).toEqual({
        sectionId: "cp",
        topicIds: ["cp_translational_motion", "cp_force"],
        skillIds: ["sirs_1", "sirs_2", "sirs_3"],
        difficulty: "hard",
        questionFormat: "passage",
        questionCount: 12,
        timingMode: "timed",
        secondsPerQuestion: 110,
        reviewMode: "later"
    });
    expect(remembered.topicIdsBySection.bb).toEqual(["bb_amino_acids", "bb_protein_structure"]);

    await page.reload();
    await expect(page.getByLabel("Section")).toHaveValue("cp");
    await expect(getTopicButton(page, "Translational Motion")).toHaveAttribute("aria-pressed", "true");
    await expect(getTopicButton(page, "Force")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Skills" }).getByRole("button").nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Difficulty" }).getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Question format")).toHaveValue("passage");
    await expect(page.getByLabel("Question count (1-59)")).toHaveValue("12");
    await expect(page.getByRole("group", { name: "Timing mode" }).getByRole("button", { name: "Timed", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Seconds per question")).toHaveValue("110");
    await expect(page.getByRole("group", { name: "Review mode" }).getByRole("button", { name: "Review later" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Restore default options" }).click();
    await expect(page.getByLabel("Section")).toHaveValue(DEFAULT_CONFIG.sectionId);
    await expect(getTopicButton(page, "Amino Acids")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Question count (1-59)")).toHaveValue(String(DEFAULT_CONFIG.questionCount));
    const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), GENERATOR_OPTIONS_KEY);
    expect(restored.config).toEqual(DEFAULT_CONFIG);
    expect(restored.topicIdsBySection).toEqual({ bb: ["bb_amino_acids"] });
    await page.getByLabel("Section").selectOption("cp");
    await expect(getTopicButton(page, "Translational Motion")).toHaveAttribute("aria-pressed", "true");
    await expect(getTopicButton(page, "Force")).toHaveAttribute("aria-pressed", "false");
});
