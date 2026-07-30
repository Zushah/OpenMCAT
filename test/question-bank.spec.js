import { expect, test } from "./fixtures.js";

test("a question-bank session loads and records an answered question", async ({ page }) => {
    await page.goto("/#/bank");
    await expect(page.getByRole("heading", { level: 1, name: "Question bank" })).toBeVisible();

    const bankCard = page.locator(".question-bank-card").filter({ has: page.getByRole("heading", { level: 2, name: "B/B Core Bank" }) });
    await expect(bankCard.getByText("0 of 100 answered")).toBeVisible();
    await bankCard.getByLabel("Session size").selectOption("5");
    await bankCard.getByRole("button", { name: "Start next 5" }).click();

    await expect(page).toHaveURL(/#\/session$/);
    await expect(page.getByRole("heading", { level: 2, name: "B/B Question Bank Practice" })).toBeVisible();
    await expect(page.getByText("Question 1 of 5 | 0 submitted | 5 incomplete | 0 flagged")).toBeVisible();

    await page.getByRole("button", { name: "Flag" }).click();
    await expect(page.getByRole("button", { name: "Unflag" })).toBeVisible();
    await page.locator(".choice-card").first().click();
    await page.getByRole("group", { name: "Confidence (optional)" }).getByRole("button", { name: "4" }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(page.getByText(/^(Correct\.|Incorrect\. Correct answer: [A-D]\.)$/)).toBeVisible();
    await expect(page.getByText("Question 1 of 5 | 1 submitted | 4 incomplete | 1 flagged")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Question 2" })).toBeVisible();
});
