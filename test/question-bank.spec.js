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

        const cp = await buildQuestionBankSession({ sectionId: "cp", questionCount: 6 });
        const bb = await buildQuestionBankSession({ sectionId: "bb", questionCount: 16 });
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
