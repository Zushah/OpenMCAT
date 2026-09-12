import { expect, test } from "./fixtures.js";
import { SAMPLE_SESSION } from "../src/data/samples.js";
import { compilePracticePrompt } from "../src/prompts/compiler.js";
import { DEFAULT_CONFIG } from "../src/data/defaults.js";
import { buildRepairPrompt } from "../src/prompts/repair.js";
import { PRACTICE_SCHEMA_SUMMARY } from "../src/schema/practice.js";
import { validatePracticeSession } from "../src/schema/validators.js";

const table = (id, caption) => ({
    id,
    caption,
    columns: ["Condition", "Value"],
    rows: [["Control", "8"], ["Treatment", "4"]]
});

const figureDescription = (id, caption) => ({
    id,
    caption,
    description: "A membrane receptor activates a kinase, which then activates a transcription factor."
});

const chart = (id, caption) => ({
    id,
    caption,
    config: {
        type: "bar",
        data: { labels: ["Control", "Treatment"], datasets: [{ label: "Response", data: [8, 4] }] }
    }
});

const createStimulusSession = () => {
    const session = structuredClone(SAMPLE_SESSION);
    session.schemaVersion = "1.2";
    session.questions[0].tables = [table("qt1", "Question-specific measurements")];
    session.questions[0].charts = [chart("qc1", "Question-specific response")];
    session.questions[0].figureDescriptions = [figureDescription("qf1", "Question-specific pathway")];
    session.questions[2].tables = [table("qt2", "Passage-question measurements")];
    session.questions[2].figureDescriptions = [figureDescription("qf2", "Passage-question apparatus")];
    session.passages[0].charts = [chart("pc1", "Passage response")];
    session.passages[0].figureDescriptions = [figureDescription("pf1", "Passage pathway")];
    return session;
};

test("schema v1.2 validates symmetric question stimuli and keeps older versions compatible", () => {
    const valid = createStimulusSession();
    expect(validatePracticeSession(valid).valid).toBe(true);
    expect(PRACTICE_SCHEMA_SUMMARY.match(/"tables": \[/g)).toHaveLength(2);
    expect(PRACTICE_SCHEMA_SUMMARY.match(/"figureDescriptions": \[/g)).toHaveLength(2);

    for (const version of ["1.0", "1.1"]) {
        const old = structuredClone(SAMPLE_SESSION);
        old.schemaVersion = version;
        expect(validatePracticeSession(old).valid).toBe(true);
        old.questions[0].tables = [];
        old.questions[0].figureDescriptions = [];
        expect(validatePracticeSession(old).valid).toBe(true);
        old.questions[0].tables = [table("old-table", "Older-version table")];
        old.questions[0].figureDescriptions = [figureDescription("old-figure", "Older-version figure")];
        const errors = validatePracticeSession(old).errors;
        expect(errors).toContain(`questions[0].tables requires schemaVersion "1.2"; declared "${version}".`);
        expect(errors).toContain(`questions[0].figureDescriptions requires schemaVersion "1.2"; declared "${version}".`);
    }

    const chartInV11 = structuredClone(SAMPLE_SESSION);
    chartInV11.schemaVersion = "1.1";
    chartInV11.questions[0].charts = [chart("legacy-compatible-chart", "Compatible chart")];
    expect(validatePracticeSession(chartInV11).valid).toBe(true);

    const passageStimuliInV10 = structuredClone(SAMPLE_SESSION);
    passageStimuliInV10.passages[0].figureDescriptions = [figureDescription("legacy-passage-figure", "Legacy passage figure")];
    expect(validatePracticeSession(passageStimuliInV10).valid).toBe(true);
});

test("question table and figure validation retains precise paths and targeted repairs", () => {
    const malformed = createStimulusSession();
    malformed.questions[0].tables = {
        id: "not-an-array"
    };
    malformed.questions[2].tables[0].columns = "Condition, Value";
    malformed.questions[2].tables[0].rows[1] = "Treatment, 4";
    malformed.questions[0].figureDescriptions = "not-an-array";
    malformed.questions[2].figureDescriptions[0].description = "";
    const errors = validatePracticeSession(malformed).errors;
    expect(errors).toContain("questions[0].tables must be an array if provided.");
    expect(errors).toContain("questions[2].tables[0].columns must be an array.");
    expect(errors).toContain("questions[2].tables[0].rows[1] must be an array.");
    expect(errors).toContain("questions[0].figureDescriptions must be an array if provided.");
    expect(errors).toContain("questions[2].figureDescriptions[0].description must be a non-empty string.");
    const repair = buildRepairPrompt(errors);
    expect(repair).toContain("questions[0].tables to an array of valid table objects");
    expect(repair).toContain("questions[2].tables[0].columns to an array matching the table schema");
    expect(repair).toContain("questions[2].tables[0].rows[1] to an array of non-empty string cell values");
    expect(repair).toContain("questions[0].figureDescriptions to an array of valid figure-description objects");
    expect(repair).toContain("questions[2].figureDescriptions[0].description to a non-empty string");

    const versionRepair = buildRepairPrompt([
        'questions[0].tables requires schemaVersion "1.2"; declared "1.1".',
        'questions[0].figureDescriptions requires schemaVersion "1.2"; declared "1.1".'
    ]);
    expect(versionRepair).toContain('Set schemaVersion to "1.2" because questions[0].tables contains question-level stimulus content.');
    expect(versionRepair).toContain('Set schemaVersion to "1.2" because questions[0].figureDescriptions contains question-level stimulus content.');
});

test("present falsy stimulus fields fail validation and schema repairs consistently target v1.2", () => {
    for (const field of ["tables", "figureDescriptions"]) {
        for (const value of ["", false, 0, null]) {
            const malformedQuestion = structuredClone(SAMPLE_SESSION);
            malformedQuestion.questions[0][field] = value;
            expect(validatePracticeSession(malformedQuestion).errors).toContain("questions[0]." + field + " must be an array if provided.");

            const malformedPassage = structuredClone(SAMPLE_SESSION);
            malformedPassage.passages[0][field] = value;
            expect(validatePracticeSession(malformedPassage).errors).toContain("passages[0]." + field + " must be an array if provided.");
        }
    }

    const conflictingBeforeRepair = createStimulusSession();
    conflictingBeforeRepair.schemaVersion = "1.0";
    const errors = validatePracticeSession(conflictingBeforeRepair).errors;
    expect(errors).toContain('questions[0].charts requires schemaVersion "1.1"; declared "1.0".');
    expect(errors).toContain('questions[0].tables requires schemaVersion "1.2"; declared "1.0".');
    const repair = buildRepairPrompt(errors);
    expect(repair).toContain('Set schemaVersion to "1.2" because questions[0].charts contains charts.');
    expect(repair).toContain('Set schemaVersion to "1.2" because questions[0].tables contains question-level stimulus content.');
    expect(repair).not.toContain('Set schemaVersion to "1.1"');
});

test("generation guidance permits question stimuli selectively across every format", () => {
    for (const questionFormat of ["discrete", "passage", "mixed"]) {
        const prompt = compilePracticePrompt({ ...DEFAULT_CONFIG, questionFormat });
        expect(prompt.user).toContain('"schemaVersion": "1.2"');
        expect(prompt.system).toContain("Use tables when exact tabular values");
        expect(prompt.system).toContain("Use charts for quantitative or categorical plots");
        expect(prompt.system).toContain("Use figureDescriptions only for non-renderable non-chart visuals");
        expect(prompt.system).toContain("Do not add any stimulus merely because the schema permits it.");
        expect(prompt.system).toContain("question-level tables, charts, or figureDescriptions");
    }
    const discrete = compilePracticePrompt({ ...DEFAULT_CONFIG, questionFormat: "discrete" });
    expect(discrete.system).toContain("question stem, any question-level tables, charts, or figure descriptions");
    expect(discrete.system).toContain("scientificallyCoherent means the prose, tables, charts, figure descriptions");
});

const openGeneratedSession = async (page, session) => {
    await page.goto("/#/generate");
    await page.getByRole("button", { name: "Generate practice session" }).click();
    const pipeline = page.getByRole("dialog", { name: "Generation pipeline" });
    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(session));
    await pipeline.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(/#\/session$/);
};

const directChildOrder = (locator) => locator.evaluate((element) => Array.from(element.children).map((child) => {
    if (child.matches(".question-stem, h4")) return "stem";
    if (child.matches(".table-wrap")) return "table";
    if (child.matches(".stimulus-chart")) return "chart";
    if (child.matches(".choice-list")) return "choices";
    if (child.matches(".card") && child.querySelector('[data-highlight-target-key*=":figure:"]')) return "figure";
    if (child.matches("p.tiny") && child.textContent.startsWith("Selected:")) return "meta";
    return "other";
}));

const selectTargetAndHighlight = async (page, targetKey) => {
    await page.locator(`[data-highlight-target-key="${targetKey}"]`).evaluate((target) => {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await page.locator(".session-top-actions").getByRole("button", { name: "Highlight" }).click();
    await expect(page.locator(`[data-highlight-target-key="${targetKey}"] mark`)).toHaveCount(1);
};

test("practice and review order, highlight, store, export, and import question stimuli", async ({ page }) => {
    test.setTimeout(60_000);
    const session = createStimulusSession();
    await openGeneratedSession(page, session);

    const questionCard = page.locator(".question-card");
    const practiceOrder = await directChildOrder(questionCard);
    expect(practiceOrder.indexOf("stem")).toBeLessThan(practiceOrder.indexOf("table"));
    expect(practiceOrder.indexOf("table")).toBeLessThan(practiceOrder.indexOf("chart"));
    expect(practiceOrder.indexOf("chart")).toBeLessThan(practiceOrder.indexOf("figure"));
    expect(practiceOrder.indexOf("figure")).toBeLessThan(practiceOrder.indexOf("choices"));
    await expect(questionCard.locator("canvas[data-highlight-target-key]")).toHaveCount(0);

    const questionKeys = [
        "question:q1:table:qt1:caption",
        "question:q1:table:qt1:column:0",
        "question:q1:table:qt1:cell:0:0",
        "question:q1:figure:qf1:caption",
        "question:q1:figure:qf1:description"
    ];
    for (const key of questionKeys) {
        await expect(questionCard.locator(`[data-highlight-target-key="${key}"]`)).toHaveAttribute("data-highlight-scope-key", "question:q1");
        await selectTargetAndHighlight(page, key);
    }

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    for (const key of questionKeys) await expect(page.locator(`[data-highlight-target-key="${key}"] mark`)).toHaveCount(1);

    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("button", { name: /Question 3/ }).click();
    const passageCard = page.locator(".passage-card");
    const passageOrder = await directChildOrder(passageCard);
    expect(passageOrder.indexOf("table")).toBeLessThan(passageOrder.indexOf("chart"));
    expect(passageOrder.indexOf("chart")).toBeLessThan(passageOrder.indexOf("figure"));
    await selectTargetAndHighlight(page, "passage:p1:table:t1:cell:0:0");
    await selectTargetAndHighlight(page, "passage:p1:figure:pf1:description");

    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("button", { name: /Question 5/ }).click();
    await page.locator(".session-top-actions").getByRole("button", { name: "Review", exact: true }).click();
    await page.getByRole("dialog", { name: "Review" }).getByRole("button", { name: "End session" }).click();
    await expect(page).toHaveURL(/#\/review$/);

    const firstReview = page.locator(".review-question").first();
    const reviewOrder = await directChildOrder(firstReview);
    expect(reviewOrder.indexOf("stem")).toBeLessThan(reviewOrder.indexOf("table"));
    expect(reviewOrder.indexOf("table")).toBeLessThan(reviewOrder.indexOf("chart"));
    expect(reviewOrder.indexOf("chart")).toBeLessThan(reviewOrder.indexOf("figure"));
    expect(reviewOrder.indexOf("figure")).toBeLessThan(reviewOrder.indexOf("meta"));
    for (const key of questionKeys) await expect(firstReview.locator(`[data-highlight-target-key="${key}"] mark`)).toHaveCount(1);

    const roundTrip = await page.evaluate(async () => {
        const { buildExportPayload, createBackupArtifact, importPayload, parseImportFile } = await import("/src/storage/exportimport.js");
        const { getAllData } = await import("/src/storage/db.js");
        const payload = await buildExportPayload();
        const artifact = await createBackupArtifact(payload, new Date("2026-09-13T12:00:00.000Z"));
        const parsed = await parseImportFile(new File([artifact.blob], artifact.fileName, { type: artifact.blob.type }));
        await importPayload(parsed);
        const restored = await getAllData();
        const generated = restored.sessions[0].generatedSession;
        return {
            schemaVersion: generated.schemaVersion,
            questionTable: generated.questions[0].tables[0],
            questionFigure: generated.questions[0].figureDescriptions[0],
            passageTable: generated.passages[0].tables[0],
            passageFigure: generated.passages[0].figureDescriptions[0]
        };
    });
    expect(roundTrip).toEqual({
        schemaVersion: "1.2",
        questionTable: session.questions[0].tables[0],
        questionFigure: session.questions[0].figureDescriptions[0],
        passageTable: session.passages[0].tables[0],
        passageFigure: session.passages[0].figureDescriptions[0]
    });
});
