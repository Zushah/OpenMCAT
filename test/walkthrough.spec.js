import { expect, test } from "./fixtures.js";
import { SAMPLE_SESSION } from "../src/data/samples.js";
import { AI_AGENT_TOOLS } from "../src/data/chats.js";

const REVIEW_URL = /#\/review\?session=(?!session_)[\w-]+$/;

const [Q1, Q2] = SAMPLE_SESSION.questions;

const submitChoice = async (page, choiceId) => {
    const card = page.locator(".question-card");
    await card.locator(`.choice-card[data-choice-id="${choiceId}"]`).click();
    await card.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(card.getByText(/^(Correct\.|Incorrect\. Correct answer: [A-D]\.)$/)).toBeVisible();
};

const finishSampleSession = async (page) => {
    await page.goto("/#/generate");
    await page.getByRole("button", { name: "Generate practice session" }).click();
    const pipeline = page.getByRole("dialog", { name: "Generation pipeline" });
    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(SAMPLE_SESSION));
    await pipeline.getByRole("button", { name: "Start session" }).click();
    await submitChoice(page, Q1.correctChoiceId);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await submitChoice(page, ["A", "B", "C", "D"].find((choiceId) => choiceId !== Q2.correctChoiceId));
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("button", { name: /Question 5/ }).click();
    await page.locator(".session-top-actions").getByRole("button", { name: "Review", exact: true }).click();
    await page.getByRole("dialog", { name: "Review" }).getByRole("button", { name: "End session" }).click();
    await expect(page).toHaveURL(REVIEW_URL);
};

const openWalkthrough = async (page) => {
    await page.getByRole("button", { name: "Walkthrough with AI" }).click();
    const dialog = page.getByRole("dialog", { name: "Walkthrough with AI" });
    await expect(dialog).toBeVisible();
    return dialog;
};

test("the walkthrough modal opens with chat links and scope controls", async ({ page }) => {
    await finishSampleSession(page);
    const dialog = await openWalkthrough(page);
    const links = dialog.getByRole("navigation", { name: "Open an AI chat" }).getByRole("link");
    expect(await links.evaluateAll((items) => items.map((link) => link.getAttribute("href")))).toEqual(["https://chatgpt.com/", "https://claude.ai/new", "https://chat.deepseek.com/"]);
    const scope = dialog.getByRole("group", { name: "Questions to include" });
    await expect(scope.getByRole("button", { name: "All (5)" })).toHaveAttribute("aria-pressed", "true");
    const note = dialog.locator(".walkthrough-note");
    await expect(note).toContainText("5 questions");
    const allNote = await note.textContent();
    await scope.getByRole("button", { name: "Incorrect only (1)" }).click();
    await expect(note).toContainText("1 question plus");
    expect(await note.textContent()).not.toBe(allNote);
    await scope.getByRole("button", { name: "Select individually" }).click();
    await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(5);
    await dialog.getByRole("button", { name: "Clear" }).click();
    await expect(dialog.getByRole("button", { name: "Copy prompt" })).toBeDisabled();
    await expect(dialog.getByText("Select at least one question to include.")).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Q3 · Unsubmitted · Passage 1" }).check();
    await expect(dialog.getByRole("button", { name: "Copy prompt" })).toBeEnabled();
});

test("the copied walkthrough prompt contains only the included questions", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are only granted in Chromium.");
    await finishSampleSession(page);
    const dialog = await openWalkthrough(page);
    await dialog.getByRole("button", { name: "Incorrect only (1)" }).click();
    await dialog.getByRole("button", { name: "Copy prompt" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(SAMPLE_SESSION.session.title);
    expect(copied).toContain(Q2.stem);
    expect(copied).toContain('"payloadVersion": "1.0"');
    expect(copied).not.toContain(Q1.stem);
});

test("walkthrough payloads keep session numbering and leave out private fields", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async (sample) => {
        const { buildWalkthroughPayload } = await import("/src/prompts/walkthrough.js");
        const { createPassageMetadataById } = await import("/src/components/questions.js");
        const session = {
            config: { sectionId: "bb" },
            generatedSession: sample,
            questionStateById: {
                q1: { submitted: true, isCorrect: true, submittedChoiceId: "B", attemptId: "a1" },
                q2: { submitted: true, isCorrect: false, submittedChoiceId: "C", confidence: 2, mistakeTypeIds: ["content_gap"] },
                q3: { submitted: false, selectedChoiceId: "D", confidence: 3 },
                q4: { submitted: true, isCorrect: false, submittedChoiceId: "B" }
            },
            highlightRangesByTargetKey: { "question:q1:stem": [{ start: 0, end: 3 }] }
        };
        const bankSession = { ...session, providerMeta: { source: "question_bank" }, generatedSession: { ...sample, questions: sample.questions.map((question) => ({ ...question, bankId: "bb-core" })) } };
        const legacy = { generatedSession: { questions: [{ id: "x1", passageId: "missing", stem: "?" }] }, questionStateById: {} };
        return {
            incorrect: buildWalkthroughPayload(session, { scope: "incorrect", aiModel: "override-model" }),
            all: buildWalkthroughPayload(session, { aiModel: "override-model" }),
            bank: buildWalkthroughPayload(bankSession, { aiModel: "override-model" }),
            legacy: buildWalkthroughPayload(legacy),
            reviewNumber: createPassageMetadataById(sample.passages, sample.questions).get("p1").passageNumber
        };
    }, SAMPLE_SESSION);
    expect(result.incorrect.questions.map((question) => question.number)).toEqual([2, 4]);
    expect(result.incorrect.passages.map((passage) => [passage.label, passage.includedQuestionNumbers])).toEqual([[`Passage ${result.reviewNumber}`, [4]]]);
    expect(result.incorrect.questions[0]).toMatchObject({ result: "incorrect", studentChoiceId: "C", confidence: 2, mistakeTypes: ["Content gap"] });
    expect(result.all.questions[2]).toMatchObject({ result: "unsubmitted", studentChoiceId: null, confidence: null, passageLabel: "Passage 1" });
    expect(result.all.session.aiModel).toBe("override-model");
    expect(result.bank.session).not.toHaveProperty("aiModel");
    for (const key of ["highlight", "attemptId", "selfCheck", "bankId"]) for (const payload of [result.all, result.bank]) expect(JSON.stringify(payload)).not.toContain(`"${key}`);
    expect(result.legacy.questions[0]).toMatchObject({ passageLabel: null, result: "unsubmitted" });
});

test("the walkthrough modal closes, blocks review arrows, and resets between reviews", async ({ page }) => {
    await finishSampleSession(page);
    const focusedIndex = () => page.locator(".review-question.is-focused").getAttribute("data-review-index");
    let dialog = await openWalkthrough(page);
    await page.keyboard.press("ArrowRight");
    expect(await focusedIndex()).toBe("0");
    await dialog.getByRole("button", { name: "Close Walkthrough with AI" }).click();
    await expect(dialog).toHaveCount(0);
    dialog = await openWalkthrough(page);
    await page.locator(".walkthrough-overlay").click({ position: { x: 4, y: 4 } });
    await expect(dialog).toHaveCount(0);
    dialog = await openWalkthrough(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    dialog = await openWalkthrough(page);
    await dialog.getByRole("button", { name: "Select individually" }).click();
    await page.evaluate(() => { location.hash = "#/dashboard"; });
    await expect(page.locator("body")).toHaveAttribute("data-route", "dashboard");
    await page.goBack();
    await expect(page.locator(".review-session-title")).toHaveText(SAMPLE_SESSION.session.title);
    await expect(dialog).toHaveCount(0);
    dialog = await openWalkthrough(page);
    await expect(dialog.getByRole("button", { name: "All (5)" })).toHaveAttribute("aria-pressed", "true");

    await page.evaluate(async (sample) => {
        const db = await import("/src/storage/db.js");
        const [record] = await db.getSessions();
        await db.saveSession({ ...record, id: "session_other", generatedSession: { ...sample, session: { ...sample.session, title: "Other session" } } });
        location.hash = "#/review?session=other";
    }, SAMPLE_SESSION);
    await expect(page.locator(".review-session-title")).toHaveText("Other session");
    await expect(dialog).toHaveCount(0);
});

test("video walkthroughs add requirements, a long-session warning, and Check your AI", async ({ page }) => {
    await finishSampleSession(page);
    let dialog = await openWalkthrough(page);
    const format = dialog.getByRole("group", { name: "Format" });
    await expect(format.getByRole("button", { name: "Text walkthrough" })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", { name: "Check your AI" })).toHaveCount(0);
    await format.getByRole("button", { name: "Video walkthrough" }).click();
    for (const tool of AI_AGENT_TOOLS) await expect(dialog.locator(".walkthrough-video-note")).toContainText(tool);
    await expect(dialog.getByRole("button", { name: "Check your AI" })).toBeEnabled();
    await page.keyboard.press("Escape");
    dialog = await openWalkthrough(page);
    await expect(dialog.getByRole("button", { name: "Text walkthrough" })).toHaveAttribute("aria-pressed", "true");

    await page.evaluate(async () => {
        const db = await import("/src/storage/db.js");
        const [record] = await db.getSessions();
        const questions = Array.from({ length: 16 }, (_, index) => ({ ...record.generatedSession.questions[index % 5], id: `long_${index}` }));
        const questionStateById = Object.fromEntries(questions.map((question) => [question.id, { submitted: true, isCorrect: true, submittedChoiceId: question.correctChoiceId, elapsedMs: 30000 }]));
        await db.saveSession({ ...record, id: "session_long", generatedSession: { ...record.generatedSession, questions }, questionStateById });
        location.hash = "#/review?session=long";
    });
    await expect(page.locator(".review-question")).toHaveCount(16);
    dialog = await openWalkthrough(page);
    await expect(dialog.locator(".warning-note")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Video walkthrough" }).click();
    await expect(dialog.locator(".warning-note")).toContainText("16 questions");
    await expect(dialog.getByRole("button", { name: "Copy prompt" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Select individually" }).click();
    await dialog.getByRole("checkbox").first().uncheck();
    await expect(dialog.locator(".warning-note")).toHaveCount(0);
});

test("video and Check your AI prompts copy the right content", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are only granted in Chromium.");
    await finishSampleSession(page);
    const dialog = await openWalkthrough(page);
    await dialog.getByRole("button", { name: "Video walkthrough" }).click();
    const readClipboard = () => page.evaluate(() => navigator.clipboard.readText());
    await dialog.getByRole("button", { name: "Copy prompt" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    const video = await readClipboard();
    for (const text of ["Preflight", "Final self-check", "Fallback package", '"payloadVersion": "1.0"']) expect(video).toContain(text);
    await dialog.getByRole("button", { name: "Check your AI" }).click();
    await expect(dialog.locator(".walkthrough-row .btn-secondary")).toHaveText("Copied");
    const check = await readClipboard();
    for (const text of ["openmcat-check.mp4", ...AI_AGENT_TOOLS]) expect(check).toContain(text);
    for (const text of [SAMPLE_SESSION.session.title, ...SAMPLE_SESSION.questions.map((question) => question.stem)]) expect(check).not.toContain(text);
});
