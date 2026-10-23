import { expect, test } from "./fixtures.js";

test("all migrated question banks validate and retain schema, versions, and stimuli during preparation", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
        const { buildQuestionBankSession, clearQuestionBankCache, loadQuestionBank } = await import("/src/data/bank/loader.js");
        const { QUESTION_BANKS } = await import("/src/data/bank/catalog.js");
        clearQuestionBankCache();

        const loaded = {};
        for (const catalog of QUESTION_BANKS) {
            const entry = await loadQuestionBank(catalog.sectionId, [], { forceReload: true });
            loaded[catalog.sectionId] = {
                status: entry.status,
                schemaVersion: entry.bank?.schemaVersion,
                embeddedVersion: entry.bank?.bank?.version,
                catalogVersion: entry.catalog.version,
                questionCount: entry.bank?.questions?.length
            };
        }

        const cp = await buildQuestionBankSession({ sectionId: "cp", questionCount: 10 });
        const bb = await buildQuestionBankSession({ sectionId: "bb", questionCount: 20 });
        const psAttempts = Array.from({ length: 55 }, (_, index) => ({
            bankId: "ps_core",
            bankQuestionId: `q${index + 1}`,
            answeredAt: new Date(index + 1).toISOString(),
            isCorrect: false
        }));
        const ps = await buildQuestionBankSession({ sectionId: "ps", attempts: psAttempts, questionCount: 5 });

        const summarizePrepared = ({ prepared, providerMeta }) => ({
            schemaVersion: prepared.schemaVersion,
            embeddedVersion: prepared.bank.version,
            providerVersion: providerMeta.bankVersion,
            passageIds: prepared.passages.map((passage) => passage.id),
            questionIds: prepared.questions.map((question) => question.id),
            passageChartIds: prepared.passages.flatMap((passage) => (passage.charts ?? []).map((chart) => `${passage.id}:${chart.id}`)),
            questionTableIds: prepared.questions.flatMap((question) => (question.tables ?? []).map((table) => `${question.id}:${table.id}`)),
            questionChartIds: prepared.questions.flatMap((question) => (question.charts ?? []).map((chart) => `${question.id}:${chart.id}`)),
            questionFigureIds: prepared.questions.flatMap((question) => (question.figureDescriptions ?? []).map((figure) => `${question.id}:${figure.id}`))
        });

        return {
            loaded,
            prepared: {
                cp: summarizePrepared(cp),
                bb: summarizePrepared(bb),
                ps: summarizePrepared(ps)
            }
        };
    });

    for (const sectionId of ["cp", "bb", "ps"]) {
        expect(result.loaded[sectionId]).toEqual({
            status: "ready",
            schemaVersion: "1.2",
            embeddedVersion: "0.2.0",
            catalogVersion: "0.2.0",
            questionCount: 100
        });
        expect(result.prepared[sectionId].schemaVersion).toBe("1.2");
        expect(result.prepared[sectionId].embeddedVersion).toBe("0.2.0");
        expect(result.prepared[sectionId].providerVersion).toBe("0.2.0");
    }

    expect(result.prepared.cp.passageIds).toContain("p1");
    expect(result.prepared.cp.passageChartIds).toContain("p1:c1");
    expect(result.prepared.cp.questionFigureIds).toContain("q1:f1");

    expect(result.prepared.bb.passageIds).toContain("p2");
    expect(result.prepared.bb.passageChartIds).toContain("p2:c1");
    expect(result.prepared.bb.questionTableIds).toContain("q3:t1");
    expect(result.prepared.bb.questionFigureIds).toContain("q11:f1");

    expect(result.prepared.ps.passageIds).toEqual(["p6"]);
    expect(result.prepared.ps.questionIds).toEqual(["q56", "q57", "q58", "q59", "q60"]);
    expect(result.prepared.ps.passageChartIds).toContain("p6:c1");
    expect(result.prepared.ps.questionTableIds).toContain("q58:t2");
    expect(result.prepared.ps.questionChartIds).not.toContain("q58:c2");
});

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

test("the question bank page derives its counts and options from the catalog", async ({ page }) => {
    await page.goto("/#/generate");
    await expect(page.locator(".generator-bank-cta")).toContainText("pregenerated bank of 300 questions");
    await page.goto("/#/bank");
    await expect(page.locator(".question-bank-hero")).toContainText("300 pregenerated questions");
    const cards = page.locator(".question-bank-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.first().locator(".question-bank-card-header p")).toHaveText(/^100 pregenerated /);
    for (let index = 0; index < 3; index += 1) {
        await expect(cards.nth(index).getByLabel("Session size").locator("option")).toHaveText(["5 questions", "10 questions", "20 questions", "25 questions", "50 questions"]);
    }
});

test("fresh question-bank sessions match the selected size for every section and size", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
        const { buildQuestionBankSession } = await import("/src/data/bank/loader.js");
        const { QUESTION_BANK_COUNT_OPTIONS } = await import("/src/data/bank/catalog.js");
        const rows = [];
        for (const sectionId of ["cp", "bb", "ps"]) {
            for (const size of QUESTION_BANK_COUNT_OPTIONS) {
                const { prepared, providerMeta } = await buildQuestionBankSession({ sectionId, questionCount: size });
                rows.push({ sectionId, size, count: prepared.questions.length, selected: providerMeta.selectedQuestionCount });
            }
        }
        return rows;
    });
    expect(result).toHaveLength(15);
    for (const row of result) expect(row, `${row.sectionId} ${row.size}`).toEqual({ sectionId: row.sectionId, size: row.size, count: row.size, selected: row.size });
});

test("a session never exceeds its size after an earlier session ended early", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
        const { buildQuestionBankSession } = await import("/src/data/bank/loader.js");
        const ids = (count) => Array.from({ length: count }, (_, index) => `q${index + 1}`);
        const summarize = ({ prepared }) => ({ questionIds: prepared.questions.map((question) => question.id), passageIds: prepared.passages.map((passage) => passage.id) });
        const attemptsOf = (questionIds) => questionIds.map((bankQuestionId, index) => ({ bankId: "bb_core", bankQuestionId, answeredAt: new Date(index + 1).toISOString(), isCorrect: false }));
        const early = summarize(await buildQuestionBankSession({ sectionId: "bb", attempts: attemptsOf(ids(2)), questionCount: 5 }));
        const next = summarize(await buildQuestionBankSession({ sectionId: "bb", attempts: attemptsOf([...ids(2), ...early.questionIds]), questionCount: 5 }));
        return { early, next };
    });
    expect(result.early).toEqual({ questionIds: ["q3", "q4", "q5", "q11", "q12"], passageIds: [] });
    expect(result.next).toEqual({ questionIds: ["q6", "q7", "q8", "q9", "q10"], passageIds: ["p1"] });
});

test("a passage larger than the session size is partially taken so the session never exceeds its size", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async (answeredIds) => {
        const { buildQuestionBankSession } = await import("/src/data/bank/loader.js");
        const attemptsOf = (questionIds) => questionIds.map((bankQuestionId, index) => ({ bankId: "ps_core", bankQuestionId, answeredAt: new Date(index + 1).toISOString(), isCorrect: false }));
        const summarize = ({ prepared, providerMeta }) => ({ questionIds: prepared.questions.map((question) => question.id), passageIds: prepared.passages.map((passage) => passage.id), selected: providerMeta.selectedQuestionCount });
        const onlyPassageLeft = summarize(await buildQuestionBankSession({ sectionId: "ps", attempts: attemptsOf(answeredIds.filter((id) => !["q56", "q57", "q58", "q59", "q60"].includes(id))), questionCount: 3 }));
        const skipsAhead = summarize(await buildQuestionBankSession({ sectionId: "ps", attempts: attemptsOf(answeredIds.slice(0, 55)), questionCount: 3 }));
        return { onlyPassageLeft, skipsAhead };
    }, Array.from({ length: 100 }, (_, index) => `q${index + 1}`));
    expect(result.onlyPassageLeft).toEqual({ questionIds: ["q56", "q57", "q58"], passageIds: ["p6"], selected: 3 });
    expect(result.skipsAhead).toEqual({ questionIds: ["q61", "q62", "q63"], passageIds: [], selected: 3 });
});

test("the start button never promises more questions than remain", async ({ page }) => {
    await page.goto("/#/bank");
    await page.evaluate(async () => {
        const { saveAttempt } = await import("/src/storage/db.js");
        for (let index = 1; index <= 97; index += 1) {
            const answeredAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
            await saveAttempt({
                id: `attempt_seed_${index}`,
                sessionId: "session_seed",
                questionId: `q${index}`,
                sectionId: "bb",
                topicIds: ["bb_amino_acids"],
                skillIds: ["sirs_1"],
                difficulty: "medium",
                selectedChoiceId: "A",
                correctChoiceId: index % 2 ? "A" : "B",
                isCorrect: index % 2 === 1,
                confidence: null,
                startedAt: answeredAt,
                answeredAt,
                elapsedMs: 60000,
                mistakeTypeIds: [],
                reviewMode: "immediate",
                timingMode: "untimed",
                bankId: "bb_core",
                bankSectionId: "bb",
                bankQuestionId: `q${index}`,
                bankVersion: "0.2.0"
            });
        }
    });
    await page.reload();
    const bankCard = page.locator(".question-bank-card").filter({ has: page.getByRole("heading", { level: 2, name: "B/B Core Bank" }) });
    await expect(bankCard.getByText("97 of 100 answered")).toBeVisible();
    await expect(bankCard.getByLabel("Session size")).toHaveValue("10");
    await expect(bankCard.getByRole("button", { name: "Start next 3" })).toBeVisible();
    await bankCard.getByRole("button", { name: "Start next 3" }).click();
    await expect(page.getByText(/^Question 1 of 3 \|/)).toBeVisible();
});
