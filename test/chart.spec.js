import { expect, test } from "./fixtures.js";
import { SAMPLE_SESSION } from "../src/data/samples.js";
import { DEFAULT_CONFIG } from "../src/data/defaults.js";
import { compilePracticePrompt } from "../src/prompts/compiler.js";
import { buildRepairPrompt } from "../src/prompts/repair.js";
import { PRACTICE_SCHEMA_SUMMARY, PRACTICE_SCHEMA_VERSION, SUPPORTED_PRACTICE_SCHEMA_VERSIONS } from "../src/schema/practice.js";
import { validatePracticeSession } from "../src/schema/validators.js";

const validChartSession = () => {
    const session = structuredClone(SAMPLE_SESSION);
    session.schemaVersion = "1.1";
    session.passages[0].charts = [{
        id: "c1",
        caption: "Reaction velocity by substrate concentration",
        config: {
            type: "line",
            data: {
                labels: ["5", "10", "20"],
                datasets: [
                    { label: "Control", data: [8, 14, 22] },
                    { label: "Treatment", type: "bar", data: [4, 7, 11] }
                ]
            },
            options: {
                scales: {
                    x: { type: "category", title: { display: true, text: "Substrate (µM)" } },
                    y: { type: "linear", title: { display: true, text: "Initial velocity" }, min: 0, max: 25, beginAtZero: true }
                }
            }
        }
    }];
    session.questions[0].charts = [{
        id: "c1",
        caption: "Measured response by dose",
        config: {
            type: "scatter",
            data: { datasets: [{ label: "Response", data: [{ x: 0.5, y: 2.1 }, { x: 1, y: 4.2 }] }] },
            options: { scales: { x: { type: "logarithmic", min: 0.1, max: 10 }, y: { type: "linear" } } }
        }
    }];
    return session;
};

test("practice prompts describe optional schema-v1.1 charts without encouraging overuse", () => {
    const discrete = compilePracticePrompt({ ...DEFAULT_CONFIG, questionFormat: "discrete" });
    expect(discrete.user).toContain('"schemaVersion": "1.1"');
    expect(discrete.system).toContain("Optional charts arrays may appear on passage objects and directly on question objects.");
    expect(discrete.system).toContain("Do not add charts merely because the schema supports them.");
    expect(discrete.system).toContain("line, bar, and scatter");
    expect(discrete.system).toContain("category, linear, and logarithmic");
    expect(discrete.system).toContain("Every value and bound on a logarithmic dimension must be positive");
    expect(discrete.system).toContain("may contain a charts array directly while keeping passageId: null");
    expect(discrete.system).toContain("scientificallyCoherent means the prose, tables, charts, figure descriptions");

    const passage = compilePracticePrompt({ ...DEFAULT_CONFIG, questionFormat: "passage" });
    expect(passage.system).toContain("Use tables for exact tabular data, charts for quantitative or categorical plots");
    expect(passage.system).toContain("Passage tables and charts may coexist when contextually justified.");
});

test("repair prompts give targeted chart and schema corrections", () => {
    const errors = [
        'schemaVersion "2.0" is unsupported; use "1.1".',
        'questions[0].charts[0].config contains unsupported property "plugins".',
        "questions[0].charts[0].config.data.datasets[0].data length must match questions[0].charts[0].config.data.labels length.",
        "questions[0].charts[0].config.data.datasets[0].data[1].y must be greater than zero for a logarithmic y-axis."
    ];
    const prompt = buildRepairPrompt(errors);
    expect(prompt).toContain('Replace unsupported schemaVersion "2.0" with "1.1".');
    expect(prompt).toContain('Remove unsupported property "plugins"');
    expect(prompt).toContain("the same length as config.data.labels");
    expect(prompt).toContain("greater than zero");
    expect(prompt).not.toContain("Correct this exact validation issue");
    expect(prompt).toContain("without changing unrelated content");
    expect(prompt).toContain("complete corrected response as exactly one single-line JSON object");
});

test("practice schema exposes v1.1 while retaining v1.0 support", () => {
    expect(PRACTICE_SCHEMA_VERSION).toBe("1.1");
    expect(SUPPORTED_PRACTICE_SCHEMA_VERSIONS).toEqual(["1.0", "1.1"]);
    expect(PRACTICE_SCHEMA_SUMMARY).toContain('"schemaVersion": "1.1"');
    expect(PRACTICE_SCHEMA_SUMMARY.match(/"charts": \[/g)).toHaveLength(2);
    expect(PRACTICE_SCHEMA_SUMMARY).toContain('{ "x": 0.5, "y": 2.1 }');
    expect(validatePracticeSession(structuredClone(SAMPLE_SESSION)).valid).toBe(true);
    expect(validatePracticeSession(validChartSession()).valid).toBe(true);
});

test("chart validation enforces schema compatibility and the supported subset", () => {
    const oldVersion = validChartSession();
    oldVersion.schemaVersion = "1.0";
    expect(validatePracticeSession(oldVersion).errors).toContain('passages[0].charts requires schemaVersion "1.1"; declared "1.0".');

    const unknownVersion = structuredClone(SAMPLE_SESSION);
    unknownVersion.schemaVersion = "2.0";
    expect(validatePracticeSession(unknownVersion).errors).toContain('schemaVersion "2.0" is unsupported; use "1.1".');

    const unsafe = validChartSession();
    unsafe.questions[0].charts[0].config.data.datasets[0].backgroundColor = "red";
    unsafe.questions[0].charts[0].config.options.plugins = { tooltip: { enabled: true } };
    const unsafeErrors = validatePracticeSession(unsafe).errors;
    expect(unsafeErrors).toContain('questions[0].charts[0].config.data.datasets[0] contains unsupported property "backgroundColor".');
    expect(unsafeErrors).toContain('questions[0].charts[0].config.options contains unsupported property "plugins".');

    const callback = validChartSession();
    callback.questions[0].charts[0].config.options.onClick = () => {};
    expect(validatePracticeSession(callback).errors).toContain('questions[0].charts[0].config.options contains unsupported property "onClick".');
});

test("chart validation rejects malformed data, bounds, and logarithmic values with precise paths", () => {
    const malformed = validChartSession();
    malformed.passages[0].charts[0].config.data.datasets[0].data = [8, { x: 1, y: 2 }, 22];
    malformed.passages[0].charts[0].config.options.scales.y.min = 30;
    malformed.questions[0].charts[0].config.data.datasets[0].data[0].x = 0;
    const errors = validatePracticeSession(malformed).errors;
    expect(errors).toContain("passages[0].charts[0].config.data.datasets[0].data must use one consistent data form.");
    expect(errors).toContain("passages[0].charts[0].config.options.scales.y.min must be less than passages[0].charts[0].config.options.scales.y.max.");
    expect(errors).toContain("questions[0].charts[0].config.data.datasets[0].data[0].x must be greater than zero for a logarithmic x-axis.");

    const mismatched = validChartSession();
    mismatched.passages[0].charts[0].config.data.datasets[1].data.pop();
    expect(validatePracticeSession(mismatched).errors).toContain("passages[0].charts[0].config.data.datasets[1].data length must match passages[0].charts[0].config.data.labels length.");

    const emptyNumericDataset = validChartSession();
    emptyNumericDataset.passages[0].charts[0].config.data.datasets[0].data = [];
    const emptyNumericErrors = validatePracticeSession(emptyNumericDataset).errors;
    expect(emptyNumericErrors).toContain("passages[0].charts[0].config.data.datasets[0].data must be a non-empty array.");
    expect(buildRepairPrompt(emptyNumericErrors)).toContain("Add at least one finite numeric value or finite numeric");

    const emptyPointDataset = validChartSession();
    emptyPointDataset.questions[0].charts[0].config.data.datasets[0].data = [];
    expect(validatePracticeSession(emptyPointDataset).errors).toContain("questions[0].charts[0].config.data.datasets[0].data must be a non-empty array.");
});

const categoryChart = {
    id: "category-chart",
    caption: "Reaction velocity by substrate concentration",
    config: {
        type: "line",
        data: {
            labels: ["1", "10", "100"],
            datasets: [
                { label: "Control", data: [2, 8, 18] },
                { label: "Treatment", type: "bar", data: [1, 4, 9] }
            ]
        },
        options: {
            scales: {
                x: { type: "category", title: { display: true, text: "Substrate (uM)" } },
                y: { type: "logarithmic", title: { display: true, text: "Velocity" }, min: 1, max: 100, beginAtZero: false }
            }
        }
    }
};

const scatterChart = {
    id: "scatter-chart",
    caption: "Dose-response observations",
    config: {
        type: "scatter",
        data: {
            datasets: [{ label: "Observed response", data: [{ x: 0.5, y: 2.1 }, { x: 1, y: 4.2 }] }]
        },
        options: {
            scales: {
                x: { type: "linear", min: 0, max: 2, beginAtZero: true },
                y: { type: "linear", min: 0, max: 5, beginAtZero: true }
            }
        }
    }
};

const barChart = {
    id: "bar-chart",
    caption: "Response by group",
    config: {
        type: "bar",
        data: {
            labels: ["A", "B"],
            datasets: [{ label: "Response", data: [4, 7] }]
        }
    }
};

const createChartSession = () => {
    const session = structuredClone(SAMPLE_SESSION);
    session.schemaVersion = "1.1";
    session.passages[0].charts = [categoryChart];
    session.questions[0].charts = [scatterChart];
    session.questions[1].charts = [barChart];
    return session;
};

const openGeneratedSession = async (page, session) => {
    await page.goto("/#/generate");
    await page.getByRole("button", { name: "Generate practice session" }).click();
    const pipeline = page.getByRole("dialog", { name: "Generation pipeline" });
    await pipeline.getByPlaceholder("Paste output").fill(JSON.stringify(session));
    await pipeline.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(/#\/session$/);
};

test("schema v1.1 validates the supported chart grammar and rejects unsafe structures", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async ({ legacy, valid }) => {
        const { validatePracticeSession } = await import("/src/schema/validators.js");
        const { buildRepairPrompt } = await import("/src/prompts/repair.js");
        const validate = (candidate) => validatePracticeSession(candidate);
        const mutate = (callback) => {
            const candidate = structuredClone(valid);
            callback(candidate);
            const validation = validate(candidate);
            return { valid: validation.valid, errors: validation.errors, repair: buildRepairPrompt(validation.errors) };
        };
        return {
            legacy: validate(legacy),
            noCharts: validate({ ...structuredClone(legacy), schemaVersion: "1.1" }),
            valid: validate(valid),
            legacyCharts: mutate((candidate) => { candidate.schemaVersion = "1.0"; }),
            future: mutate((candidate) => { candidate.schemaVersion = "2.0"; }),
            badType: mutate((candidate) => { candidate.questions[0].charts[0].config.type = "pie"; }),
            unsafeStyle: mutate((candidate) => { candidate.questions[0].charts[0].config.data.datasets[0].backgroundColor = "red"; }),
            unsafeBehavior: mutate((candidate) => { candidate.questions[0].charts[0].config.options.plugins = { tooltip: { enabled: true } }; }),
            unsafeEvents: mutate((candidate) => {
                Object.assign(candidate.questions[0].charts[0].config.options, {
                    animation: true,
                    events: ["click"],
                    hover: { mode: "nearest" },
                    onClick: "callback",
                    responsive: false
                });
            }),
            malformedDataset: mutate((candidate) => { candidate.questions[0].charts[0].config.data.datasets = [{}]; }),
            malformedPoint: mutate((candidate) => { candidate.questions[0].charts[0].config.data.datasets[0].data[0].x = "0.5"; }),
            mismatchedLabels: mutate((candidate) => { candidate.questions[1].charts[0].config.data.datasets[0].data.pop(); }),
            badScale: mutate((candidate) => { candidate.questions[0].charts[0].config.options.scales.x.min = 3; }),
            badLogValue: mutate((candidate) => { candidate.passages[0].charts[0].config.data.datasets[0].data[0] = 0; })
        };
    }, { legacy: SAMPLE_SESSION, valid: createChartSession() });

    expect(result.legacy.valid).toBe(true);
    expect(result.noCharts.valid).toBe(true);
    expect(result.valid.valid).toBe(true);
    for (const key of ["legacyCharts", "future", "badType", "unsafeStyle", "unsafeBehavior", "unsafeEvents", "malformedDataset", "malformedPoint", "mismatchedLabels", "badScale", "badLogValue"]) {
        expect(result[key].valid, key).toBe(false);
        expect(result[key].repair, key).toContain("single-line JSON object");
    }
    expect(result.legacyCharts.repair).toContain('Set schemaVersion to "1.1"');
    expect(result.future.repair).toContain('Replace unsupported schemaVersion "2.0" with "1.1"');
    expect(result.badType.repair).toContain("line, bar, or scatter");
    expect(result.unsafeStyle.repair).toContain('Remove unsupported property "backgroundColor"');
    expect(result.unsafeBehavior.repair).toContain('Remove unsupported property "plugins"');
    for (const key of ["animation", "events", "hover", "onClick", "responsive"]) expect(result.unsafeEvents.errors.join(" ")).toContain(`unsupported property "${key}"`);
    expect(result.malformedDataset.repair).toContain("data");
    expect(result.malformedPoint.repair).toContain("finite numeric");
    expect(result.mismatchedLabels.repair).toContain("same length");
    expect(result.badScale.errors.join(" ")).toContain("min must be less than");
    expect(result.badLogValue.repair).toContain("greater than zero");
});

test("practice and review render static charts with a clean lifecycle and preserve them in storage", async ({ page }) => {
    test.setTimeout(45_000);
    await page.emulateMedia({ colorScheme: "light" });
    const session = createChartSession();
    await openGeneratedSession(page, session);

    const questionFigure = page.locator(".question-card .stimulus-chart");
    await expect(questionFigure).toHaveCount(1);
    await expect(questionFigure).toHaveClass(/stimulus-chart--question/);
    await expect(questionFigure.locator("figcaption")).toHaveText(scatterChart.caption);
    expect(await questionFigure.locator(":scope > *").evaluateAll((children) => children.map((child) => child.tagName))).toEqual(["FIGCAPTION", "DIV"]);
    await expect(questionFigure.locator("canvas")).toHaveAttribute("role", "img");
    await expect(questionFigure.locator("canvas")).toHaveAttribute("aria-label", scatterChart.caption);
    await expect.poll(() => page.evaluate(() => Object.keys(window.Chart?.instances ?? {}).length)).toBe(1);

    const questionFigureLayout = await questionFigure.evaluate((figure) => {
        const style = getComputedStyle(figure);
        return { width: figure.getBoundingClientRect().width, marginTop: style.marginTop, marginBottom: style.marginBottom };
    });
    expect(questionFigureLayout.width).toBeLessThanOrEqual(673);
    expect(questionFigureLayout.marginTop).toBe(questionFigureLayout.marginBottom);

    const firstRuntime = await questionFigure.locator("canvas").evaluate((canvas) => {
        const chart = window.Chart.getChart(canvas);
        return {
            id: chart.id,
            type: chart.config.type,
            events: chart.options.events,
            animation: chart.options.animation,
            tooltipEnabled: chart.options.plugins.tooltip.enabled,
            legendDisplayed: chart.options.plugins.legend.display,
            legendPosition: chart.options.plugins.legend.position,
            color: chart.data.datasets[0].borderColor,
            sourceKeys: Object.keys(chart.data.datasets[0])
        };
    });
    expect(firstRuntime.type).toBe("scatter");
    expect(firstRuntime.events).toEqual([]);
    expect(firstRuntime.animation).toBe(false);
    expect(firstRuntime.tooltipEnabled).toBe(false);
    expect(firstRuntime.legendDisplayed).toBe(false);
    expect(firstRuntime.legendPosition).toBe("top");
    expect(firstRuntime.sourceKeys).not.toContain("plugins");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => questionFigure.locator("canvas").evaluate((canvas) => window.Chart.getChart(canvas)?.id)).not.toBe(firstRuntime.id);
    const darkColor = await questionFigure.locator("canvas").evaluate((canvas) => window.Chart.getChart(canvas).data.datasets[0].borderColor);
    expect(darkColor).not.toBe(firstRuntime.color);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".question-card .stimulus-chart figcaption")).toHaveText(barChart.caption);
    await expect.poll(() => page.evaluate(() => Object.keys(window.Chart.instances).length)).toBe(1);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".passage-card .stimulus-chart figcaption")).toHaveText(categoryChart.caption);
    await expect.poll(() => page.evaluate(() => Object.keys(window.Chart.instances).length)).toBe(1);
    const passageChartState = await page.locator(".passage-card .stimulus-chart").evaluate((figure) => {
        const chart = window.Chart.getChart(figure.querySelector("canvas"));
        return {
            legendDisplayed: chart.options.plugins.legend.display,
            legendPosition: chart.options.plugins.legend.position,
            width: figure.getBoundingClientRect().width,
            parentWidth: figure.parentElement.getBoundingClientRect().width
        };
    });
    expect(passageChartState.legendDisplayed).toBe(true);
    expect(passageChartState.legendPosition).toBe("top");
    expect(passageChartState.width).toBeLessThanOrEqual(577);
    expect(passageChartState.width).toBeLessThan(passageChartState.parentWidth);

    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("button", { name: /Question 5/ }).click();
    await page.locator(".session-top-actions").getByRole("button", { name: "Review", exact: true }).click();
    await page.getByRole("dialog", { name: "Review" }).getByRole("button", { name: "End session" }).click();
    await expect(page).toHaveURL(/#\/review$/);

    await expect(page.locator(".review-list .stimulus-chart").filter({ hasText: scatterChart.caption })).toHaveCount(1);
    await expect(page.locator(".review-list .stimulus-chart").filter({ hasText: scatterChart.caption })).toHaveClass(/stimulus-chart--question/);
    const passageDetails = page.locator(".review-passage-dropdown").first();
    await expect(passageDetails.locator(".stimulus-chart canvas")).toHaveCount(1);
    expect(await passageDetails.locator(".stimulus-chart canvas").evaluate((canvas) => window.Chart.getChart(canvas) === undefined)).toBe(true);
    await passageDetails.locator("summary").click();
    await expect.poll(() => passageDetails.locator(".stimulus-chart canvas").evaluate((canvas) => Boolean(window.Chart.getChart(canvas)))).toBe(true);
    const dimensions = await passageDetails.locator(".stimulus-chart canvas").boundingBox();
    expect(dimensions.width).toBeGreaterThan(100);
    expect(dimensions.height).toBeGreaterThan(100);
    await passageDetails.locator("summary").click();
    await passageDetails.locator("summary").click();
    await expect.poll(() => page.evaluate(() => Object.keys(window.Chart.instances).length)).toBe(3);

    const stored = await page.evaluate(async () => {
        const { getSessions } = await import("/src/storage/db.js");
        const { createExportPayload, parseImportText } = await import("/src/storage/exportimport.js");
        const sessions = await getSessions();
        const payload = createExportPayload({ sessions, attempts: [], settings: {} });
        const restored = parseImportText(JSON.stringify(payload));
        return {
            databaseChart: sessions[0].generatedSession.passages[0].charts[0],
            exportedChart: restored.sessions[0].generatedSession.passages[0].charts[0]
        };
    });
    expect(stored.databaseChart).toEqual(categoryChart);
    expect(stored.exportedChart).toEqual(categoryChart);

    await page.setViewportSize({ width: 360, height: 640 });
    const figureBox = await passageDetails.locator(".stimulus-chart").boundingBox();
    expect(figureBox.x).toBeGreaterThanOrEqual(0);
    expect(figureBox.x + figureBox.width).toBeLessThanOrEqual(360);
    expect(await passageDetails.locator(".stimulus-chart").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(page.getByText("View chart data", { exact: true })).toHaveCount(0);
});
