import { expect, test } from "./fixtures.js";
import { SAMPLE_SESSION } from "../src/data/samples.js";

const REVIEW_URL = /#\/review\?session=(?!session_)[\w-]+$/;

const readSessions = (page) => page.evaluate(async () => { const db = await import("/src/storage/db.js"); return db.getSessions(); });

const readAttempts = (page) => page.evaluate(async () => { const db = await import("/src/storage/db.js"); return db.getAttempts(); });

const startSampleSession = async (page) => {
    await page.goto("/#/generate");
    await page.getByRole("button", { name: "Generate practice session" }).click();
    const pipeline = page.getByRole("dialog", { name: "Generation pipeline" });
    const session = structuredClone(SAMPLE_SESSION);
    session.session.topicIds.push("bb_metabolism_principles");
    session.questions[3].testedTopicIds.push("bb_metabolism_principles");
    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(session));
    await pipeline.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(/#\/session$/);
    await expect(page.getByRole("heading", { level: 2, name: SAMPLE_SESSION.session.title })).toBeVisible();
};

const submitChoice = async (page, choiceId) => {
    const card = page.locator(".question-card");
    await card.locator(`.choice-card[data-choice-id="${choiceId}"]`).click();
    await card.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(card.getByText(/^(Correct\.|Incorrect\. Correct answer: [A-D]\.)$/)).toBeVisible();
};

const finishSampleSession = async (page) => {
    await startSampleSession(page);
    const [first, second] = SAMPLE_SESSION.questions;
    await submitChoice(page, first.correctChoiceId);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await submitChoice(page, ["A", "B", "C", "D"].find((choiceId) => choiceId !== second.correctChoiceId));
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("button", { name: /Question 5/ }).click();
    await page.locator(".session-top-actions").getByRole("button", { name: "Review", exact: true }).click();
    await page.getByRole("dialog", { name: "Review" }).getByRole("button", { name: "End session" }).click();
    await expect(page).toHaveURL(REVIEW_URL);
    await expect(page.getByRole("heading", { level: 2, name: "Session review" })).toBeVisible();
};

const goToDashboard = async (page) => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    const laterButton = page.getByRole("button", { name: "Remind me later" });
    if (await laterButton.isVisible()) await laterButton.click();
    await expect(page.locator("body")).toHaveAttribute("data-route", "dashboard");
};

const expectSampleReview = async (page) => {
    await expect(page.getByRole("heading", { level: 2, name: "Session review" })).toBeVisible();
    await expect(page.locator(".review-session-title")).toHaveText(SAMPLE_SESSION.session.title);
    await expect(page.locator(".stat-card").filter({ hasText: "Score" })).toContainText("1/2");
};

test("a finished session can be reopened from the dashboard", async ({ page }) => {
    await finishSampleSession(page);
    await goToDashboard(page);
    await page.locator(".recent-sessions-table").getByRole("button", { name: "Review" }).click();
    await expect(page).toHaveURL(REVIEW_URL);
    await expectSampleReview(page);

    await page.goBack();
    await expect(page.locator("body")).toHaveAttribute("data-route", "dashboard");
    await page.goForward();
    await expect(page).toHaveURL(REVIEW_URL);
    await expectSampleReview(page);
});

test("a reopened review survives a reload", async ({ page }) => {
    await finishSampleSession(page);
    await goToDashboard(page);
    await page.locator(".recent-sessions-table").getByRole("button", { name: "Review" }).click();
    await expect(page).toHaveURL(REVIEW_URL);
    await page.reload();
    await expect(page).toHaveURL(REVIEW_URL);
    await expectSampleReview(page);
});

test("mistake types can be tagged on a reopened review and persist", async ({ page }) => {
    await finishSampleSession(page);
    await goToDashboard(page);
    await page.locator(".recent-sessions-table").getByRole("button", { name: "Review" }).click();
    const chip = page.locator(".review-question-row.is-incorrect .mistake-type-chip").first();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await readAttempts(page)).filter((attempt) => attempt.mistakeTypeIds?.length === 1).length).toBe(1);

    await page.reload();
    await expect(page.locator(".review-question-row.is-incorrect .mistake-type-chip").first()).toHaveAttribute("aria-pressed", "true");
    const [record] = await readSessions(page);
    expect(Object.values(record.questionStateById).filter((questionState) => questionState.mistakeTypeIds.length === 1)).toHaveLength(1);
});

test("the review right after ending a session is deep-linked and survives a reload", async ({ page }) => {
    await finishSampleSession(page);
    await expect(page).toHaveURL(REVIEW_URL);
    await page.reload();
    await expect(page).toHaveURL(REVIEW_URL);
    await expectSampleReview(page);
});

test("an unknown review token shows a not-found message", async ({ page }) => {
    await page.goto("/#/review?session=nope");
    await expect(page.getByRole("heading", { level: 2, name: "No session to review" })).toBeVisible();
    await expect(page.getByText("That session was not found.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "No session to review" })).toBeVisible();
});

test("completed sessions without review data get no Review button", async ({ page }) => {
    await finishSampleSession(page);
    await page.evaluate(async () => {
        const { saveSession } = await import("/src/storage/db.js");
        await saveSession({
            id: "session_legacy_record",
            createdAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:10:00.000Z",
            config: { sectionId: "bb" },
            generatedSession: { session: { sectionId: "bb", title: "Legacy session" }, questions: [{ id: "q1", stem: "s" }] }
        });
        await saveSession({ id: "no_questions", completedAt: "2026-01-01T00:10:00.000Z" });
    });
    await page.goto("/#/dashboard");
    await page.reload();
    const laterButton = page.getByRole("button", { name: "Remind me later" });
    if (await laterButton.isVisible()) await laterButton.click();
    const table = page.locator(".recent-sessions-table");
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table.getByRole("button", { name: "Review" })).toHaveCount(1);
    await expect(table.getByRole("button", { name: "Drill" })).toHaveCount(2);
});

test("opening a past review never loses the live session", async ({ page }) => {
    await finishSampleSession(page);
    await page.goto("/#/bank");
    const bankCard = page.locator(".question-bank-card").filter({ has: page.getByRole("heading", { level: 2, name: "B/B Core Bank" }) });
    await bankCard.getByLabel("Session size").selectOption("5");
    await bankCard.getByRole("button", { name: "Start next 5" }).click();
    await expect(page.getByText("Question 1 of 5 | 0 submitted | 5 incomplete | 0 flagged")).toBeVisible();
    await page.locator(".choice-card").first().click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Question 1 of 5 | 1 submitted | 4 incomplete | 0 flagged")).toBeVisible();

    await goToDashboard(page);
    await page.locator(".recent-sessions-table").getByRole("button", { name: "Review" }).click();
    await expectSampleReview(page);

    await page.getByRole("link", { name: "Practice" }).click();
    const card = page.locator(".resume-card");
    await expect(card).toContainText("1 of 5 submitted");
    await card.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("Question 1 of 5 | 1 submitted | 4 incomplete | 0 flagged")).toBeVisible();
    expect(await readAttempts(page)).toHaveLength(3);
});

test("a completed session never renders the practice page", async ({ page }) => {
    await finishSampleSession(page);
    await page.evaluate(() => { location.hash = "#/session"; });
    await expect(page.getByRole("heading", { level: 2, name: "No active session" })).toBeVisible();
    await expect(page.locator(".question-card")).toHaveCount(0);
    await page.keyboard.press("a");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "No active session" })).toBeVisible();
    expect(await readAttempts(page)).toHaveLength(2);
});
