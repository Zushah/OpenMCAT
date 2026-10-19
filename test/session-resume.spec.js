import { expect, test } from "./fixtures.js";

const readSessions = (page) => page.evaluate(async () => { const db = await import("/src/storage/db.js"); return db.getSessions(); });

const readAttempts = (page) => page.evaluate(async () => { const db = await import("/src/storage/db.js"); return db.getAttempts(); });

const bankCard = (page) => page.locator(".question-bank-card").filter({ has: page.getByRole("heading", { level: 2, name: "B/B Core Bank" }) });

const startBankSession = async (page) => {
    await page.goto("/#/bank");
    const card = bankCard(page);
    await card.getByLabel("Session size").selectOption("5");
    await card.getByRole("button", { name: "Start next 5" }).click();
    await expect(page.getByText("Question 1 of 5 | 0 submitted | 5 incomplete | 0 flagged")).toBeVisible();
};

const startInterruptedSession = async (page) => {
    await startBankSession(page);
    await page.locator(".choice-card").first().click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Question 2" })).toBeVisible();
    await expect.poll(async () => (await readSessions(page))[0]?.progress?.currentQuestionIndex).toBe(1);
};

test("resuming an interrupted session restores progress without duplicating attempts", async ({ page }) => {
    await startBankSession(page);
    await page.getByRole("button", { name: "Flag" }).click();
    await page.locator(".choice-card").first().click();
    await page.getByRole("group", { name: "Confidence (optional)" }).getByRole("button", { name: "4" }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Question 1 of 5 | 1 submitted | 4 incomplete | 1 flagged")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Question 2" })).toBeVisible();
    await page.locator(".choice-card").nth(1).click();
    await expect.poll(async () => {
        const [record] = await readSessions(page);
        const questionId = record?.generatedSession?.questions?.[1]?.id;
        return [record?.progress?.currentQuestionIndex, record?.questionStateById?.[questionId]?.selectedChoiceId];
    }).toEqual([1, "B"]);
    const [attemptBeforeReload] = await readAttempts(page);

    await page.reload();
    const card = page.locator(".resume-card");
    await expect(card.getByRole("heading", { level: 2, name: "Unfinished session" })).toBeVisible();
    await expect(card).toContainText("1 of 5 submitted");
    await card.getByRole("button", { name: "Resume" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Question 2" })).toBeVisible();
    await expect(page.locator(".choice-card").nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Question 2 of 5 | 1 submitted | 4 incomplete | 1 flagged")).toBeVisible();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByRole("button", { name: "Unflag" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Confidence (optional)" }).getByRole("button", { name: "4" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Question 2 of 5 | 2 submitted | 3 incomplete | 1 flagged")).toBeVisible();

    const attempts = await readAttempts(page);
    expect(attempts).toHaveLength(2);
    expect(attempts.find((attempt) => attempt.id === attemptBeforeReload.id)).toMatchObject({ questionId: attemptBeforeReload.questionId, answeredAt: attemptBeforeReload.answeredAt });
});

test("starting a new session ends the previous interrupted session", async ({ page }) => {
    await startInterruptedSession(page);
    await page.reload();
    await expect(page.locator(".resume-card")).toBeVisible();
    const [interrupted] = await readSessions(page);
    expect(interrupted.completedAt).toBeNull();

    await page.goto("/#/bank");
    await bankCard(page).getByLabel("Session size").selectOption("5");
    await bankCard(page).getByRole("button", { name: "Start next 5" }).click();
    await expect(page.getByText("Ended your previous interrupted session.")).toBeVisible();
    await expect(page.getByText("Question 1 of 5 | 0 submitted | 5 incomplete | 0 flagged")).toBeVisible();

    const ended = (await readSessions(page)).find((record) => record.id === interrupted.id);
    expect(ended.completedAt).toBe(ended.progress.savedAt);
    expect(ended.summary).toMatchObject({ total: 5 });
    await page.goto("/#/generate");
    await expect(page.locator(".resume-card .resume-card-body.tiny")).toContainText("in progress");
    expect((await readSessions(page)).filter((record) => !record.completedAt)).toHaveLength(1);
});

test("ending an interrupted session from its card opens the review", async ({ page }) => {
    await startInterruptedSession(page);
    await page.reload();
    await page.locator(".resume-card").getByRole("button", { name: "End session" }).click();

    await expect(page).toHaveURL(/#\/review\?session=[\w-]+$/);
    await expect(page.getByRole("heading", { level: 2, name: "Session review" })).toBeVisible();
    await expect(page.locator(".resume-card")).toHaveCount(0);
    const [record] = await readSessions(page);
    expect(record.completedAt).toBe(record.progress.savedAt);
    expect(record.summary).toMatchObject({ submitted: 0, total: 5 });
});

test("malformed stored sessions never offer to resume or break the app", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
        const { saveSession } = await import("/src/storage/db.js");
        await saveSession({ id: "x", generatedSession: { questions: [{ stem: "s" }] } });
        await saveSession({ id: "y", progress: {}, completedAt: null });
        await saveSession({ id: "z", progress: { savedAt: new Date().toISOString() }, config: {}, generatedSession: { questions: [{ id: "q1" }] }, questionStateById: { q1: {} } });
    });
    for (const route of ["generate", "bank", "dashboard", "session"]) {
        await page.goto("/");
        await page.goto(`/#/${route}`);
        await page.reload();
        await expect(page.locator("#main-content")).not.toBeEmpty();
        await expect(page.locator(".resume-card")).toHaveCount(0);
    }
});

test("time away from the app is not counted when a session resumes", async ({ page }) => {
    await startInterruptedSession(page);
    const questionId = await page.evaluate(async () => { const { state } = await import("/src/app.js"); return state.activeSession.generatedSession.questions[1].id; });
    await page.locator(".choice-card").first().click();
    await expect.poll(async () => (await readSessions(page))[0]?.questionStateById?.[questionId]?.selectedChoiceId).toBe("A");
    const savedElapsedMs = (await readSessions(page))[0].questionStateById[questionId].elapsedMs;
    expect(savedElapsedMs).toBeGreaterThanOrEqual(0);

    await page.reload();
    await expect(page.locator(".resume-card")).toBeVisible();
    const reloadedAt = Date.now();
    await page.waitForTimeout(1500);
    await page.locator(".resume-card").getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Question 2" })).toBeVisible();

    const resumed = await page.evaluate(async (id) => { const { state } = await import("/src/app.js"); return { ...state.activeSession.questionStateById[id] }; }, questionId);
    expect(resumed.elapsedMs).toBe(savedElapsedMs);
    expect(Date.parse(resumed.startedAt) - reloadedAt).toBeGreaterThanOrEqual(1400);
});

for (const via of ["navigation", "hash"]) {
    test(`leaving the practice page pauses the session timer (${via})`, async ({ page }) => {
        await startBankSession(page);
        const readQuestion = () => page.evaluate(async () => { const { state } = await import("/src/app.js"); const active = state.activeSession; return { ...active.questionStateById[active.generatedSession.questions[active.currentQuestionIndex].id] }; });
        const before = await readQuestion();
        expect(before.startedAt).not.toBeNull();

        if (via === "navigation") await page.getByRole("link", { name: "Dashboard" }).click();
        else await page.evaluate(() => { location.hash = "#/dashboard"; });
        await expect(page.locator("body")).toHaveAttribute("data-route", "dashboard");
        const leftAt = Date.now();
        const away = await readQuestion();
        expect(away.startedAt).toBeNull();
        await page.waitForTimeout(1500);
        expect((await readQuestion()).elapsedMs).toBe(away.elapsedMs);

        if (via === "navigation") {
            await page.getByRole("link", { name: "Practice" }).click();
            await page.locator(".resume-card").getByRole("button", { name: "Resume" }).click();
        } else await page.evaluate(() => { location.hash = "#/session"; });
        await expect(page.getByText(/^Question 1 of 5 \|/)).toBeVisible();
        const back = await readQuestion();
        expect(back.elapsedMs).toBe(away.elapsedMs);
        expect(Date.parse(back.startedAt) - leftAt).toBeGreaterThanOrEqual(1400);
    });
}
