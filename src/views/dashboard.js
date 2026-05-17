import { CARS_SKILLS, SCIENCE_SKILLS, SECTIONS, TOPICS } from "../data/taxonomy.js";
import { createAccessibleDataTable, createChartShell, destroyDashboardCharts, getChartTheme, getDefaultChartOptions, queueChartRender } from "../components/charts.js";
import { createStatCard } from "../components/stats.js";
import { formatDurationMs } from "../components/timer.js";

const cb = Chalkboard;

const sectionsById = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
const skillsById = Object.fromEntries([...SCIENCE_SKILLS, ...CARS_SKILLS].map((skill) => [skill.id, skill]));
const sectionOrder = Object.fromEntries(SECTIONS.map((section, index) => [section.id, index]));
const skillOrder = Object.fromEntries([...SCIENCE_SKILLS, ...CARS_SKILLS].map((skill, index) => [skill.id, index]));

const pct = (value) => `${cb.numb.roundTo((value || 0) * 100, 1)}%`;

const pctPoints = (value) => value === null || value === undefined ? "n/a" : `${value >= 0 ? "+" : ""}${cb.numb.roundTo(value * 100, 0.1)} pts`;

const score = (value) => Number.isFinite(value) ? `${+(Math.round(value + "e+1") + "e-1")}` : "n/a";

const seconds = (ms) => Number.isFinite(ms) && ms > 0 ? `${cb.numb.roundTo(ms / 1000, 1)}s` : "n/a";

const attemptCount = (value) => Number.isInteger(value) ? `${value}` : `${cb.numb.roundTo(value || 0, 0.1)}`;

const wrapLabel = (label, maxLineLength = 18, maxLines = 3) => {
    const words = String(label ?? "n/a").split(/\s+/).filter(Boolean);
    if (!words.length) return ["n/a"];
    const lines = [];
    words.forEach((word) => {
        const lastIndex = lines.length - 1;
        const last = lines[lastIndex] ?? "";
        if (!last) { lines.push(word); return; }
        if (`${last} ${word}`.length <= maxLineLength || lines.length >= maxLines) lines[lastIndex] = `${last} ${word}`;
        else lines.push(word);
    });
    if (lines.length <= maxLines) return lines;
    return [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(" ")];
};

const chartLabel = (label, maxLineLength = 18, maxLines = 3) => {
    const lines = wrapLabel(label, maxLineLength, maxLines);
    return lines.length === 1 ? lines[0] : lines;
};

const wrapBalancedLabel = (label, maxLineLength = 24) => {
    const words = String(label ?? "n/a").split(/\s+/).filter(Boolean);
    if (words.length <= 1) return words.length ? words : ["n/a"];
    const candidates = words.slice(1).map((_, index) => {
        const splitIndex = index + 1;
        const first = words.slice(0, splitIndex).join(" ");
        const second = words.slice(splitIndex).join(" ");
        const longest = cb.stat.max([first.length, second.length]);
        const imbalance = Math.abs(first.length - second.length);
        const overflow = cb.stat.sum([first, second].map((line) => cb.stat.max([0, line.length - maxLineLength])));
        return { first, second, longest, imbalance, overflow };
    });
    const best = candidates.sort((a, b) => a.overflow - b.overflow || a.longest - b.longest || a.imbalance - b.imbalance)[0];
    return [best.first, best.second];
};

const appendWrappedLabel = (parent, label, maxLineLength = 20) => {
    wrapBalancedLabel(label, maxLineLength).forEach((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        parent.append(span);
    });
};

const rowNameFromId = (type, id) => {
    if (type === "section") return sectionsById[id]?.shortName ?? id ?? "n/a";
    if (type === "topic") return topicsById[id]?.shortName ?? topicsById[id]?.name ?? id ?? "n/a";
    if (type === "skill") return skillsById[id]?.shortName ?? skillsById[id]?.name ?? id ?? "n/a";
    if (type === "difficulty") return String(id ?? "n/a").replace(/^./, (character) => character.toUpperCase());
    return id ?? "n/a";
};

const topicSectionId = (topicId, fallback = "bb") => topicsById[topicId]?.sectionId ?? fallback;

const getQuestionFormat = (sectionId) => sectionId === "cars" ? "cars_beta" : "mixed";

const targetSecondsForSection = (sectionId) => sectionId === "cars" ? 110 : 95;

const createElement = (tag, className = "", text = "") => { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; };

const appendText = (parent, tag, className, text) => { const element = createElement(tag, className, text); parent.append(element); return element; };

const createDrillConfig = ({ sectionId, topicId = null, skillId = null, timed = false, count = null }) => ({
    sectionId,
    topicIds: topicId ? [topicId] : [],
    skillIds: skillId ? [skillId] : [],
    questionFormat: getQuestionFormat(sectionId),
    difficulty: "medium",
    questionCount: count ?? (timed ? 8 : 6),
    timingMode: timed ? "timed" : "untimed",
    secondsPerQuestion: timed ? targetSecondsForSection(sectionId) : null,
    reviewMode: timed ? "later" : "immediate"
});

const createSessionDrillConfig = (session) => {
    const sectionId = session.sectionId && session.sectionId !== "unknown" ? session.sectionId : topicSectionId(session.missedTopicIds?.[0]);
    const timed = session.timingMode === "timed";
    const count = cb.numb.constrain(session.generatedQuestionCount || session.attempts || (timed ? 8 : 6), [4, 12]);
    return createDrillConfig({ sectionId, topicId: session.missedTopicIds?.[0] ?? null, timed, count });
};

const createActionButton = (label, config, actions, className = "btn btn-secondary btn-compact") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", () => actions.applyDashboardDrill(config));
    return button;
};

const createSelectControl = ({ label, value, options, onChange }) => {
    const field = createElement("label", "dashboard-filter-field");
    const span = createElement("span", "tiny", label);
    const select = document.createElement("select");
    options.forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.value = String(option.value);
        optionElement.textContent = option.label;
        if (String(option.value) === String(value)) optionElement.selected = true;
        select.append(optionElement);
    });
    select.addEventListener("change", () => onChange(select.value));
    field.append(span, select);
    return field;
};

const renderFilterBar = (filters, actions) => {
    const panel = createElement("section", "card card-pad dashboard-filters");
    const header = createElement("div", "dashboard-section-header");
    const titleWrap = createElement("div");
    appendText(titleWrap, "h2", "", "Filters");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-ghost btn-compact";
    reset.textContent = "Reset filters";
    reset.addEventListener("click", () => actions.resetDashboardFilters());
    header.append(titleWrap, reset);
    const controls = createElement("div", "dashboard-filter-grid");
    controls.append(
        createSelectControl({
            label: "Range",
            value: filters.range,
            options: [
                { value: "all", label: "All time" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" }
            ],
            onChange: (range) => actions.updateDashboardFilters({ range })
        }),
        createSelectControl({
            label: "Section",
            value: filters.sectionId,
            options: [{ value: "all", label: "All sections" }, ...SECTIONS.map((section) => ({ value: section.id, label: section.shortName }))],
            onChange: (sectionId) => actions.updateDashboardFilters({ sectionId })
        }),
        createSelectControl({
            label: "Mode",
            value: filters.timingMode,
            options: [
                { value: "all", label: "Timed & untimed" },
                { value: "timed", label: "Timed only" },
                { value: "untimed", label: "Untimed only" }
            ],
            onChange: (timingMode) => actions.updateDashboardFilters({ timingMode })
        }),
        createSelectControl({
            label: "Review",
            value: filters.reviewMode,
            options: [
                { value: "all", label: "All review modes" },
                { value: "immediate", label: "Immediate" },
                { value: "later", label: "Later" }
            ],
            onChange: (reviewMode) => actions.updateDashboardFilters({ reviewMode })
        }),
        createSelectControl({
            label: "Stable signal",
            value: filters.minAttempts,
            options: [1, 3, 5, 10].map((value) => ({ value, label: `${value}+ attempts` })),
            onChange: (minAttempts) => actions.updateDashboardFilters({ minAttempts: Number(minAttempts) })
        })
    );
    panel.append(header, controls);
    return panel;
};

const renderEmptyState = (actions, filtersActive) => {
    const empty = createElement("section", "card card-pad empty-state dashboard-empty");
    const icon = createElement("span", "material-symbols-outlined", "insights");
    icon.setAttribute("aria-hidden", "true");
    const heading = createElement("h2", "", filtersActive ? "No attempts match these filters" : "No attempts yet");
    const message = createElement("p", "", filtersActive ? "Reset filters or complete more practice to populate this slice of the dashboard." : "Complete a practice session to unlock trends, heatmaps, timing analysis, confidence calibration, and drill recommendations.");
    const row = createElement("div", "button-row");
    const create = document.createElement("button");
    create.className = "btn btn-primary";
    create.textContent = "Create practice session";
    create.addEventListener("click", () => actions.navigate("generator"));
    row.append(create);
    if (filtersActive) {
        const reset = document.createElement("button");
        reset.className = "btn btn-secondary";
        reset.textContent = "Reset filters";
        reset.addEventListener("click", () => actions.resetDashboardFilters());
        row.append(reset);
    }
    empty.append(icon, heading, message, row);
    return empty;
};

const renderSummaryGrid = (metrics, recommendation) => {
    const totals = metrics.totals;
    const bestSection = [...metrics.rows.bySection].sort((a, b) => b.mastery - a.mastery)[0];
    const weakSection = [...metrics.rows.bySection].sort((a, b) => b.priorityScore - a.priorityScore)[0];
    const calibration = typeof totals.confidenceCalibrationScore === "number" ? `${score(totals.confidenceCalibrationScore)}/100` : "n/a";
    const gapHint = typeof totals.timedUntimedGap === "number" ? totals.timedUntimedGap > 0 ? `Untimed accuracy is ${pctPoints(totals.timedUntimedGap)} higher` : totals.timedUntimedGap < 0 ? `Timed accuracy is ${pctPoints(Math.abs(totals.timedUntimedGap))} higher` : "Timed and untimed accuracy are equal" : "Need both timed and untimed data";
    const coveredTopicCount = totals.coveredTopicCount ?? 0;
    const totalTopicCount = totals.totalTopicCount ?? TOPICS.length;
    const grid = createElement("section", "dashboard-grid dashboard-summary-grid");
    grid.append(
        createStatCard("Questions answered", `${totals.totalQuestionsAnswered}`, `${totals.totalCorrect} correct in the active filter`),
        createStatCard("Overall accuracy", pct(totals.overallAccuracy), `Smoothed: ${pct(totals.smoothedAccuracy)}`),
        createStatCard("Mastery estimate", `${score(totals.mastery)}/100`, "Smoothed accuracy plus volume and timing"),
        createStatCard("Avg time / question", formatDurationMs(totals.averageElapsedMs), `Target: ${seconds(totals.averageTargetTimeMs)}`),
        createStatCard("Completion rate", pct(totals.completionRate), `${totals.totalCompletedSessions} completed sessions stored`),
        createStatCard("Timed vs untimed", gapHint),
        createStatCard("Calibration", calibration, `${metrics.confidence.noConfidenceCount} attempts without confidence`),
        createStatCard("Active flags", `${totals.activeFlagCount}`, `${pct(totals.flaggedRate)} of filtered attempts`),
        createStatCard("Best section", rowNameFromId("section", bestSection?.id), bestSection ? `${score(bestSection.mastery)}/100 mastery` : "Need section data"),
        createStatCard("Weakest section", rowNameFromId("section", weakSection?.id), weakSection ? `${score(weakSection.priorityScore)} priority score` : "Need section data"),
        createStatCard("Topic coverage", pct(totals.topicCoverageRate), `${coveredTopicCount}/${totalTopicCount} topics attempted`),
        createStatCard("Completed sessions", `${totals.recentSessionsCount}`, "matching current filters")
    );
    return grid;
};

const renderEvidenceChips = (evidence = {}) => {
    const chips = createElement("div", "evidence-chip-list");
    const entries = [
        ["Attempts", evidence.attempts !== undefined ? attemptCount(evidence.attempts) : null],
        ["Raw accuracy", evidence.accuracy !== undefined ? pct(evidence.accuracy) : null],
        ["Smoothed", evidence.smoothedAccuracy !== undefined ? pct(evidence.smoothedAccuracy) : null],
        ["Mastery", evidence.mastery !== undefined ? `${score(evidence.mastery)}/100` : null],
        ["Avg time", evidence.averageElapsedMs !== undefined ? seconds(evidence.averageElapsedMs) : null],
        ["Target", evidence.targetTimeMs !== undefined ? seconds(evidence.targetTimeMs) : null],
        ["Priority", evidence.priorityScore !== undefined ? score(evidence.priorityScore) : null],
        ["Signal", evidence.signalStrength ?? null]
    ].filter(([, value]) => value !== null && value !== undefined);
    entries.forEach(([label, value]) => {
        const chip = createElement("span", "evidence-chip");
        chip.textContent = `${label}: ${value}`;
        chips.append(chip);
    });
    return chips;
};

const renderRecommendationCard = (recommendation, actions) => {
    const card = createElement("section", "card card-pad dashboard-recommendation");
    const content = createElement("div", "dashboard-recommendation-content");
    appendText(content, "p", "dashboard-eyebrow", "Recommended");
    appendText(content, "h2", "", "Next drill");
    appendText(content, "p", "", recommendation?.body ?? "Complete more questions to generate a recommendation.");
    if (recommendation?.evidence) content.append(renderEvidenceChips(recommendation.evidence));
    if (recommendation?.rationale?.length) {
        const list = createElement("ul", "recommendation-rationale");
        recommendation.rationale.forEach((item) => { const li = document.createElement("li"); li.textContent = item; list.append(li); });
        content.append(list);
    }
    const alternatives = recommendation?.alternatives ?? [];
    if (alternatives.length) {
        const alternativeWrap = createElement("div", "recommendation-alternatives");
        appendText(alternativeWrap, "p", "tiny", "Other high-priority drills");
        const alternativeList = createElement("div", "recommendation-alternative-list");
        alternatives.forEach((alternative) => { alternativeList.append(createActionButton(alternative.label, alternative.config, actions, "btn btn-ghost btn-compact recommendation-chip-button")); });
        alternativeWrap.append(alternativeList);
        content.append(alternativeWrap);
    }
    const actionsWrap = createElement("div", "button-row recommendation-primary-actions");
    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "btn btn-primary";
    primary.textContent = recommendation?.config ? "Load this drill" : "Create practice session";
    primary.addEventListener("click", () => recommendation?.config ? actions.applyDashboardDrill(recommendation.config) : actions.navigate("generator"));
    actionsWrap.append(primary);
    card.append(content, actionsWrap);
    return card;
};

const renderInsights = (metrics) => {
    const card = createElement("section", "card card-pad dashboard-insights");
    appendText(card, "h2", "", "Insights");
    if (!metrics.insights.length) { appendText(card, "p", "tiny", "No notable patterns yet. Keep practicing to build stronger signal."); return card; }
    const list = createElement("div", "insight-list");
    metrics.insights.forEach((insight) => {
        const item = createElement("article", `insight-item is-${insight.severity ?? "info"}`);
        const body = insight.type === "weak_pair" && insight.topicId && insight.skillId ? `${rowNameFromId("topic", insight.topicId)} with ${rowNameFromId("skill", insight.skillId)} has a ${score(insight.priorityScore)} priority score across ${attemptCount(insight.attempts)} weighted attempts.` : insight.body;
        appendText(item, "h3", "", insight.title);
        appendText(item, "p", "tiny", body);
        list.append(item);
    });
    card.append(list);
    return card;
};

const renderChartPanel = ({ title, subtitle, canvasLabel, tableColumns, tableRows, config }) => {
    const table = createAccessibleDataTable(tableColumns, tableRows);
    const { card, canvas } = createChartShell({ title, subtitle, canvasLabel, table });
    queueChartRender(canvas, config);
    return card;
};

const renderTrendChart = (metrics) => {
    const theme = getChartTheme();
    const rollingRows = metrics.trends.rollingAccuracy;
    const dailyRows = metrics.trends.dailyAccuracy;
    const usingRolling = rollingRows.length >= 3;
    const rows = usingRolling ? rollingRows : dailyRows;
    const labels = rows.map((row) => usingRolling ? row.label : row.date);
    const accuracyData = rows.map((row) => cb.numb.roundTo(row.accuracy * 100, 0.1));
    const tableRows = rows.map((row) => [usingRolling ? `Attempt ${row.label}` : row.date, `${row.attempts}`, pct(row.accuracy)]);
    return renderChartPanel({
        title: "Accuracy trend",
        subtitle: usingRolling ? "Rolling accuracy across recent answered questions." : "Daily accuracy in the active filter.",
        canvasLabel: "Accuracy trend chart",
        tableColumns: [usingRolling ? "Attempt" : "Date", "Attempts in point", "Accuracy"],
        tableRows,
        config: {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: usingRolling ? "Rolling accuracy" : "Daily accuracy",
                    data: accuracyData,
                    borderColor: theme.accent,
                    backgroundColor: theme.accent,
                    tension: 0.28,
                    pointRadius: 3
                }]
            },
            options: getDefaultChartOptions({
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: theme.textMuted, callback: (value) => `${value}%` },
                        grid: { color: theme.border }
                    }
                }
            })
        }
    });
};

const renderSectionMasteryChart = (metrics) => {
    const theme = getChartTheme();
    const rows = metrics.rows.bySection.slice().sort((a, b) => (sectionOrder[a.id] ?? 99) - (sectionOrder[b.id] ?? 99));
    return renderChartPanel({
        title: "Section mastery",
        subtitle: "Mastery is a smoothed 0-100 estimate adjusted for volume and timing.",
        canvasLabel: "Section mastery horizontal bar chart",
        tableColumns: ["Section", "Attempts", "Accuracy", "Mastery"],
        tableRows: rows.map((row) => [rowNameFromId("section", row.id), attemptCount(row.attempts), pct(row.accuracy), `${score(row.mastery)}/100`]),
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => rowNameFromId("section", row.id)),
                datasets: [{ label: "Mastery", data: rows.map((row) => row.mastery), backgroundColor: theme.accent }]
            },
            options: getDefaultChartOptions({
                indexAxis: "y",
                scales: {
                    x: { min: 0, max: 100, ticks: { color: theme.textMuted }, grid: { color: theme.border } },
                    y: { ticks: { color: theme.textMuted, autoSkip: false }, grid: { color: theme.border } }
                }
            })
        }
    });
};

const renderTopicWeaknessChart = (metrics) => {
    const theme = getChartTheme();
    const rows = metrics.weakness.weakestTopics.slice(0, 10).reverse();
    return renderChartPanel({
        title: "Topic weakness priority",
        subtitle: "Higher priority combines low smoothed accuracy, slower timing, flags, volume, and confidence mismatch.",
        canvasLabel: "Topic weakness priority chart",
        tableColumns: ["Topic", "Attempts", "Accuracy", "Priority"],
        tableRows: rows.slice().reverse().map((row) => [rowNameFromId("topic", row.id), attemptCount(row.attempts), pct(row.accuracy), score(row.priorityScore)]),
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => chartLabel(rowNameFromId("topic", row.id), 18, 3)),
                datasets: [{ label: "Priority", data: rows.map((row) => row.priorityScore), backgroundColor: theme.warning }]
            },
            options: getDefaultChartOptions({
                indexAxis: "y",
                scales: {
                    x: { min: 0, max: 100, ticks: { color: theme.textMuted }, grid: { color: theme.border } },
                    y: { ticks: { color: theme.textMuted, autoSkip: false }, grid: { color: theme.border } }
                }
            })
        }
    });
};

const renderSkillPerformanceChart = (metrics) => {
    const theme = getChartTheme();
    const rows = metrics.rows.bySkill.slice().sort((a, b) => (skillOrder[a.id] ?? 99) - (skillOrder[b.id] ?? 99));
    return renderChartPanel({
        title: "Skill performance",
        subtitle: "Compare raw accuracy with the mastery estimate for each reasoning skill.",
        canvasLabel: "Skill performance bar chart",
        tableColumns: ["Skill", "Attempts", "Accuracy", "Mastery"],
        tableRows: rows.map((row) => [rowNameFromId("skill", row.id), attemptCount(row.attempts), pct(row.accuracy), `${score(row.mastery)}/100`]),
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => chartLabel(rowNameFromId("skill", row.id), 18, 3)),
                datasets: [
                    { label: "Accuracy", data: rows.map((row) => cb.numb.roundTo(row.accuracy * 100, 0.1)), backgroundColor: theme.accent },
                    { label: "Mastery", data: rows.map((row) => row.mastery), backgroundColor: theme.accentTwo }
                ]
            },
            options: getDefaultChartOptions({
                scales: {
                    x: { ticks: { color: theme.textMuted, autoSkip: false, maxRotation: 0, minRotation: 0 }, grid: { color: theme.border } },
                    y: { min: 0, max: 100, ticks: { color: theme.textMuted, callback: (value) => `${value}%` }, grid: { color: theme.border } }
                }
            })
        }
    });
};

const renderConfidenceChart = (metrics) => {
    const theme = getChartTheme();
    const rows = metrics.confidence.groups;
    return renderChartPanel({
        title: "Confidence calibration",
        subtitle: "Actual accuracy by self-rated confidence. Use this to catch overconfidence or underconfidence.",
        canvasLabel: "Confidence calibration chart",
        tableColumns: ["Confidence", "Attempts", "Actual accuracy", "Reference"],
        tableRows: rows.map((row) => [row.id, attemptCount(row.attempts), row.attempts ? pct(row.accuracy) : "n/a", pct(row.expectedAccuracy)]),
        config: {
            type: "line",
            data: {
                labels: rows.map((row) => row.id),
                datasets: [
                    { label: "Actual accuracy", data: rows.map((row) => row.attempts ? cb.numb.roundTo(row.accuracy * 100, 0.1) : null), borderColor: theme.accent, backgroundColor: theme.accent, tension: 0.2, pointRadius: 4 },
                    { label: "Reference", data: rows.map((row) => cb.numb.roundTo(row.expectedAccuracy * 100, 1)), borderColor: theme.textMuted, backgroundColor: theme.textMuted, borderDash: [5, 5], tension: 0.2, pointRadius: 2 }
                ]
            },
            options: getDefaultChartOptions({
                scales: {
                    y: { min: 0, max: 100, ticks: { color: theme.textMuted, callback: (value) => `${value}%` }, grid: { color: theme.border } }
                }
            })
        }
    });
};

const renderTimingChart = (metrics) => {
    const theme = getChartTheme();
    const rows = metrics.rows.byDifficulty;
    return renderChartPanel({
        title: "Timing by difficulty",
        subtitle: "Average seconds per question compared with the effective target time.",
        canvasLabel: "Timing by difficulty chart",
        tableColumns: ["Difficulty", "Attempts", "Average time", "Target"],
        tableRows: rows.map((row) => [rowNameFromId("difficulty", row.id), attemptCount(row.attempts), seconds(row.averageElapsedMs), seconds(row.targetTimeMs)]),
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => rowNameFromId("difficulty", row.id)),
                datasets: [
                    { label: "Average seconds", data: rows.map((row) => cb.numb.roundTo(row.averageElapsedMs / 1000, 1)), backgroundColor: theme.accentTwo },
                    { label: "Target seconds", data: rows.map((row) => cb.numb.roundTo(row.targetTimeMs / 1000, 1)), backgroundColor: theme.textMuted }
                ]
            },
            options: getDefaultChartOptions()
        }
    });
};

const renderChartGrid = (metrics) => {
    const grid = createElement("section", "dashboard-chart-grid");
    grid.append(
        renderTrendChart(metrics),
        renderSectionMasteryChart(metrics),
        renderTopicWeaknessChart(metrics),
        renderSkillPerformanceChart(metrics),
        renderConfidenceChart(metrics),
        renderTimingChart(metrics)
    );
    return grid;
};

const getMatrixSections = (metrics) => {
    const matrix = metrics.weakness.topicSkillMatrix;
    if (Array.isArray(matrix)) return matrix;
    return [{
        sectionId: metrics.filters.sectionId,
        skills: [...SCIENCE_SKILLS, ...CARS_SKILLS].filter((skill) => (matrix?.skillIds ?? []).includes(skill.id)),
        rows: matrix?.rows ?? []
    }];
};

const getMatrixSkills = (metrics) => {
    const filterSection = metrics.filters.sectionId;
    if (filterSection === "cars") return CARS_SKILLS;
    if (["cp", "bb", "ps"].includes(filterSection)) return SCIENCE_SKILLS;
    const usedIds = new Set(getMatrixSections(metrics).flatMap((matrix) => (matrix.skills ?? []).map((skill) => typeof skill === "string" ? skill : skill.id)));
    return [...SCIENCE_SKILLS, ...CARS_SKILLS].filter((skill) => usedIds.has(skill.id));
};

const renderHeatmap = (metrics, actions) => {
    const matrixSections = getMatrixSections(metrics);
    const skills = getMatrixSkills(metrics);
    const rows = matrixSections.filter((matrix) => metrics.filters.sectionId === "all" || matrix.sectionId === metrics.filters.sectionId).flatMap((matrix) => (matrix.rows ?? []).map((row) => ({ ...row, matrixSkills: matrix.skills ?? [] }))).slice(0, 14);
    const card = createElement("section", "card card-pad dashboard-heatmap-card");
    const header = createElement("div", "dashboard-section-header");
    const titleWrap = createElement("div");
    appendText(titleWrap, "h2", "", "Topic-skill heatmap");
    appendText(titleWrap, "p", "tiny", "Each cell is a drillable topic-skill pair. Darker cells have higher weakness priority. Low sample cells are marked as early signal.");
    header.append(titleWrap);
    card.append(header);
    if (!rows.length || !skills.length) { appendText(card, "p", "tiny", "No topic-skill pairs match the active filters yet."); return card; }
    const wrap = createElement("div", "table-wrap heatmap-wrap");
    const table = document.createElement("table");
    table.className = "heatmap-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    appendText(headerRow, "th", "", "Topic");
    skills.forEach((skill) => {
        const th = createElement("th", "heatmap-skill-header");
        appendWrappedLabel(th, skill.shortName, 24);
        headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
        const tr = document.createElement("tr");
        const topicCell = document.createElement("th");
        topicCell.scope = "row";
        topicCell.textContent = rowNameFromId("topic", row.topicId);
        tr.append(topicCell);
        skills.forEach((skill) => {
            const td = document.createElement("td");
            const cell = row.cells.find((item) => item?.skillId === skill.id) ?? null;
            if (!cell) {
                const empty = createElement("span", "heatmap-empty", "");
                td.append(empty);
            } else {
                const sectionId = cell.sectionId ?? topicSectionId(row.topicId);
                const timed = cell.timeRatio > 1.12;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "heatmap-cell";
                if (cell.priorityScore >= 62) button.classList.add("is-hot");
                else if (cell.priorityScore >= 42) button.classList.add("is-warm");
                else button.classList.add("is-cool");
                button.setAttribute("aria-label", `Drill ${rowNameFromId("topic", row.topicId)} with ${skill.shortName}`);
                const value = createElement("strong", "", score(cell.priorityScore));
                const meta = createElement("span", "", `${attemptCount(cell.attempts)} attempts · ${pct(cell.accuracy)}`);
                const signal = cell.signalStrength === "early" ? createElement("em", "", "early") : null;
                button.append(value, meta);
                if (signal) button.append(signal);
                button.addEventListener("click", () => actions.applyDashboardDrill(createDrillConfig({
                    sectionId,
                    topicId: row.topicId,
                    skillId: skill.id,
                    timed,
                    count: timed ? 8 : 6
                })));
                td.append(button);
            }
            tr.append(td);
        });
        tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const renderWeakPairTable = (metrics, actions) => {
    const card = createElement("section", "card card-pad dashboard-table-card");
    const header = createElement("div", "dashboard-section-header");
    const titleWrap = createElement("div");
    appendText(titleWrap, "h2", "", "Weakest topic-skill pairs");
    appendText(titleWrap, "p", "tiny", "Ranked by priority score. Use Drill to turn a weakness into a prefilled practice generation.");
    header.append(titleWrap);
    card.append(header);
    const pairs = metrics.weakness.topicSkillPairs.slice(0, 12);
    if (!pairs.length) { appendText(card, "p", "tiny", "Not enough paired topic-skill data yet."); return card; }
    const wrap = createElement("div", "table-wrap");
    const table = document.createElement("table");
    table.className = "weak-pairs-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Section", "Topic", "Skill", "Attempts", "Accuracy", "Mastery", "Time", "Signal", "Action"].forEach((label) => appendText(headerRow, "th", "", label));
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    pairs.forEach((pair) => {
        const row = document.createElement("tr");
        const sectionId = pair.sectionId ?? topicSectionId(pair.topicId);
        const timed = pair.timeRatio > 1.12;
        const values = [
            rowNameFromId("section", sectionId),
            rowNameFromId("topic", pair.topicId),
            rowNameFromId("skill", pair.skillId),
            attemptCount(pair.attempts),
            pct(pair.accuracy),
            `${score(pair.mastery)}/100`,
            seconds(pair.averageElapsedMs),
            pair.signalStrength
        ];
        values.forEach((value) => appendText(row, "td", "", value));
        const action = document.createElement("td");
        action.append(createActionButton("Drill", createDrillConfig({ sectionId, topicId: pair.topicId, skillId: pair.skillId, timed }), actions));
        row.append(action);
        tbody.append(row);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const renderRecentMisses = (metrics, actions) => {
    const card = createElement("section", "card card-pad dashboard-table-card");
    appendText(card, "h2", "", "Recent missed questions");
    const misses = metrics.recent.misses;
    if (!misses.length) { appendText(card, "p", "tiny", "No missed questions match the active filters."); return card; }
    const wrap = createElement("div", "table-wrap recent-misses-wrap");
    const table = document.createElement("table");
    table.className = "recent-misses-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["When", "Section", "Topic", "Skill", "Confidence", "Time", "Action"].forEach((label) => appendText(headerRow, "th", "", label));
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    misses.slice(0, 12).forEach((attempt) => {
        const row = document.createElement("tr");
        const firstTopic = attempt.topicIds?.[0];
        const firstSkill = attempt.skillIds?.[0];
        const sectionId = attempt.sectionId ?? topicSectionId(firstTopic);
        const timed = attempt.timeRatio > 1.12 || attempt.timingMode === "timed";
        const cells = [
            attempt.answeredAt ? new Date(attempt.answeredAt).toLocaleDateString() : "n/a",
            rowNameFromId("section", sectionId),
            rowNameFromId("topic", firstTopic),
            rowNameFromId("skill", firstSkill),
            typeof attempt.confidence === "number" ? `${attempt.confidence}/5` : "n/a",
            formatDurationMs(attempt.elapsedMs)
        ];
        cells.forEach((text) => appendText(row, "td", "", text));
        const action = document.createElement("td");
        action.append(createActionButton("Drill", createDrillConfig({ sectionId, topicId: firstTopic, skillId: firstSkill, timed }), actions));
        row.append(action);
        tbody.append(row);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const renderRecentSessions = (metrics, actions) => {
    const card = createElement("section", "card card-pad dashboard-table-card dashboard-recent-sessions-card");
    appendText(card, "h2", "", "Recent sessions");
    const sessions = metrics.recent.sessions;
    if (!sessions.length) { appendText(card, "p", "tiny", "No completed or attempted sessions match the active filters."); return card; }
    const wrap = createElement("div", "table-wrap recent-sessions-wrap");
    const table = document.createElement("table");
    table.className = "recent-sessions-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["When", "Section", "Mode", "Answered", "Accuracy", "Avg time", "Action"].forEach((label) => appendText(headerRow, "th", "", label));
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    sessions.forEach((session) => {
        const row = document.createElement("tr");
        [
            session.completedAt || session.createdAt ? new Date(session.completedAt ?? session.createdAt).toLocaleDateString() : "n/a",
            rowNameFromId("section", session.sectionId),
            session.timingMode,
            `${session.attempts}/${session.generatedQuestionCount || session.attempts}`,
            pct(session.accuracy),
            formatDurationMs(session.averageElapsedMs)
        ].forEach((value) => appendText(row, "td", "", value));
        const action = document.createElement("td");
        action.append(createActionButton("Drill", createSessionDrillConfig(session), actions));
        row.append(action);
        tbody.append(row);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const renderTables = (metrics, actions) => {
    const grid = createElement("section", "dashboard-detail-grid");
    grid.append(renderWeakPairTable(metrics, actions), renderRecentMisses(metrics, actions), renderRecentSessions(metrics, actions));
    return grid;
};

const filtersAreActive = (filters) => filters.range !== "all" || filters.sectionId !== "all" || filters.timingMode !== "all" || filters.reviewMode !== "all";

export const renderDashboardView = (state, actions) => {
    destroyDashboardCharts();
    const root = document.createElement("section");
    root.className = "dashboard-page";
    const analytics = state.analytics;
    const metrics = analytics?.metrics;
    const filters = metrics?.filters ?? state.dashboard.filters;
    const header = createElement("section", "hero dashboard-hero");
    appendText(header, "h1", "", "Analytics dashboard");
    appendText(header, "p", "", "Use your practice history to identify content gaps, skill vulnerabilities, timing pressure, confidence calibration, and more. Then get recommendations for the next drill to run.");
    root.append(header, renderFilterBar(filters, actions));
    if (!metrics || !metrics.totals.totalQuestionsAnswered) { root.append(renderEmptyState(actions, filtersAreActive(filters))); return root; }
    root.append(
        renderSummaryGrid(metrics, analytics.recommendation),
        renderRecommendationCard(analytics.recommendation, actions),
        renderInsights(metrics),
        renderChartGrid(metrics),
        renderHeatmap(metrics, actions),
        renderTables(metrics, actions)
    );
    return root;
};
