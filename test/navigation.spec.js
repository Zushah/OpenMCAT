import { expect, test } from "./fixtures.js";

test("primary views load and settings persist across a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Train on MCAT topics and skills with targeted drills." })).toBeVisible();

    await page.getByRole("link", { name: "Practice" }).click();
    await expect(page).toHaveURL(/#\/generate$/);
    await expect(page.getByRole("heading", { level: 1, name: "Practice" })).toBeVisible();

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Analytics dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "No data yet" })).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    await page.getByLabel("Theme").selectOption("light");
    await page.getByLabel("Data backup reminder when snoozed").selectOption("weekly");
    await page.getByLabel("Data backup reminder when completed").selectOption("monthly");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.getByLabel("Theme")).toHaveValue("light");
    await expect(page.getByLabel("Data backup reminder when snoozed")).toHaveValue("weekly");
    await expect(page.getByLabel("Data backup reminder when completed")).toHaveValue("monthly");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/#\/about$/);
    await expect(page.getByRole("heading", { level: 1, name: "About OpenMCAT" })).toBeVisible();

    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("heading", { level: 2, name: "How it works" })).toBeVisible();
});
