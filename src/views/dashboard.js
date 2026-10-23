import { DIFFICULTIES, SCIENCE_SKILLS, SECTIONS, TOPICS } from "../data/taxonomy.js";
import { DEFAULT_SECONDS_PER_QUESTION } from "../data/defaults.js";
import { chartAxis, createAccessibleDataTable, createBarValueLabelsPlugin, createChartDataDetails, createChartLegend, createChartShell, createDoughnutTotalPlugin, createPolarRankLabelsPlugin, createRadarValueLabelsPlugin, destroyCharts, getChartTheme, getDefaultChartOptions, hasChartRuntime, insertChartLegend, legendItemsFromDatasets, queueChartRender, toggleChartSeries } from "../components/charts.js";
import { icon } from "../components/icons.js";
import { createStatCard } from "../components/stats.js";
import { formatDurationMs } from "../components/timer.js";
import { applyMistakeTypeToDrillConfig } from "../analytics/recommendations.js";
import { getEffectiveSessionAiModel, getRecordedSessionAiModel } from "../analytics/metrics.js";
import { compileAnalyticsPrompt } from "../prompts/analytics.js";
import { getResumableInfo, isReviewableSession } from "../storage/progress.js";
import { AI_MODEL_CATALOG, AI_MODEL_CATALOG_VALUES, CUSTOM_AI_MODEL_VALUE, MAX_AI_MODEL_NAME_LENGTH } from "../data/models.js";

const cb = Chalkboard;
const DEFAULT_PAGE_SIZE = 10;
const COMPACT_PAGE_SIZE = 5;
const MODEL_USAGE_LEGEND_PAGE_SIZE = 5;
const PHONE_VIEWPORT_QUERY = "(max-width: 640px)";

const isPhoneViewport = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_VIEWPORT_QUERY).matches;

const safeNumber = (value, fallback = 0) => { const number = Number(value); return Number.isFinite(number) ? number : fallback; };

const sectionsById = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
const skillsById = Object.fromEntries(SCIENCE_SKILLS.map((skill) => [skill.id, skill]));
const sectionOrder = Object.fromEntries(SECTIONS.map((section, index) => [section.id, index]));
const skillOrder = Object.fromEntries(SCIENCE_SKILLS.map((skill, index) => [skill.id, index]));

const pct = (value) => `${cb.numb.roundTo((value || 0) * 100, 0.1)}%`;

const pctPoints = (value) => value === null || value === undefined ? "n/a" : `${value >= 0 ? "+" : ""}${cb.numb.roundTo(value * 100, 0.1)} pts`;

const score = (value) => Number.isFinite(value) ? `${cb.numb.roundTo(value, 0.1)}` : "n/a";

const seconds = (ms) => Number.isFinite(ms) && ms > 0 ? `${cb.numb.roundTo(ms / 1000, 0.1)}s` : "n/a";

const attemptCount = (value) => Number.isInteger(value) ? `${value}` : `${cb.numb.roundTo(value || 0, 0.01)}`;

const pluralText = (count, singular, pluralLabel = `${singular}s`) => `${count} ${count === 1 ? singular : pluralLabel}`;

const getRecentTrend = (attempts = []) => {
    const sortedAttempts = (attempts ?? []).slice().sort((a, b) => safeNumber(a.answeredAtMs, 0) - safeNumber(b.answeredAtMs, 0));
    if (sortedAttempts.length < 20) {
        const remaining = 20 - sortedAttempts.length;
        return { value: "n/a", last: `${remaining} more submitted ${remaining === 1 ? "attempt" : "attempts"} needed`, prev: `` };
    }
    const recentWindow = sortedAttempts.slice(-10);
    const previousWindow = sortedAttempts.slice(-20, -10);
    const recentAccuracy = recentWindow.filter((attempt) => attempt.isCorrect).length / recentWindow.length;
    const previousAccuracy = previousWindow.filter((attempt) => attempt.isCorrect).length / previousWindow.length;
    return { value: pctPoints(recentAccuracy - previousAccuracy), last: `Last 10: ${pct(recentAccuracy)}`, prev: `Prev 10: ${pct(previousAccuracy)}` };
};

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

const chartColorWithAlpha = (color, alpha = 0.24) => {
    const raw = String(color ?? "").trim();
    const constrainedAlpha = cb.numb.constrain(safeNumber(alpha, 0.24), [0, 1]);
    const hex = raw.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
        const value = hex[1].length === 3 ? hex[1].split("").map((character) => `${character}${character}`).join("") : hex[1];
        const red = parseInt(value.slice(0, 2), 16);
        const green = parseInt(value.slice(2, 4), 16);
        const blue = parseInt(value.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${constrainedAlpha})`;
    }
    const rgb = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${constrainedAlpha})`;
    return raw;
};

const hasAttempts = (row) => safeNumber(row?.attempts, 0) > 0;

const metricValue = (row, value) => hasAttempts(row) && Number.isFinite(value) ? value : null;

const accuracyLabel = (row) => hasAttempts(row) ? pct(row.accuracy) : "n/a";

const masteryLabel = (row) => Number.isFinite(metricValue(row, row.mastery)) ? `${score(metricValue(row, row.mastery))}/100` : "n/a";

const makeCompleteRows = (categories, rows, createEmptyRow) => {
    const rowsById = new Map((rows ?? []).map((row) => [row.id, row]));
    return categories.map((category) => rowsById.get(typeof category === "string" ? category : category.id) ?? createEmptyRow(category));
};

const makeEmptySectionRow = (section) => ({ id: section.id, sectionId: section.id, attempts: 0, correct: 0, accuracy: null, mastery: null, coveredTopicCount: 0, totalTopicCount: TOPICS.filter((topic) => topic.sectionId === section.id).length });

const makeEmptySkillRow = (skill) => ({ id: skill.id, sectionId: null, attempts: 0, correct: 0, accuracy: null, mastery: null });

const makeEmptyDifficultyRow = (difficulty) => ({ id: difficulty.id, attempts: 0, correct: 0, accuracy: null, averageElapsedMs: null });

const getSkillChartCategories = () => SCIENCE_SKILLS;

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

const topicLabelWithSection = (topicId, sectionId = null) => `${rowNameFromId("section", sectionId ?? topicSectionId(topicId))}: ${rowNameFromId("topic", topicId)}`;

const getQuestionFormat = () => "mixed";

const targetSecondsForSection = () => DEFAULT_SECONDS_PER_QUESTION;

const createElement = (tag, className = "", text = "") => { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; };

const appendText = (parent, tag, className, text) => { const element = createElement(tag, className, text); parent.append(element); return element; };

const copyTextToClipboard = async (text) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) try { await navigator.clipboard.writeText(text); return; } catch { }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    try { const copied = document.execCommand("copy"); if (!copied) throw new Error("Copy failed"); }
    finally { textarea.remove(); }
};

const getPaginatedRows = (rows, pages, key, pageSize = DEFAULT_PAGE_SIZE) => {
    const allRows = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Math.floor(Number(pageSize) || DEFAULT_PAGE_SIZE));
    const totalItems = allRows.length;
    const pageCount = Math.max(1, Math.ceil(totalItems / size));
    const requestedPage = Math.floor(Number(pages?.[key]) || 0);
    const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
    const start = page * size;
    const end = Math.min(start + size, totalItems);
    return { rows: allRows.slice(start, end), totalItems, page, pageCount, start, end, pageSize: size };
};

const createPaginationButton = (iconName, label, disabled, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dashboard-page-button";
    button.disabled = disabled;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.append(icon(iconName, { size: 14 }));
    button.addEventListener("click", onClick);
    return button;
};

const createPaginationControls = ({ key, pageInfo, actions }) => {
    if (!pageInfo || pageInfo.totalItems <= pageInfo.pageSize) return null;
    const controls = createElement("div", "dashboard-card-pagination");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Pagination");
    const range = createElement("span", "dashboard-page-range", `${pageInfo.start + 1}-${pageInfo.end} of ${pageInfo.totalItems}`);
    const previous = createPaginationButton("chevron-left", "Previous page", pageInfo.page <= 0, () => actions.setDashboardPage(key, pageInfo.page - 1, pageInfo.pageCount));
    const next = createPaginationButton("chevron-right", "Next page", pageInfo.page >= pageInfo.pageCount - 1, () => actions.setDashboardPage(key, pageInfo.page + 1, pageInfo.pageCount));
    controls.append(range, previous, next);
    return controls;
};

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
    const source = session.config && typeof session.config === "object" ? session.config : null;
    if (source) {
        const sectionId = source.sectionId ?? (session.sectionId && session.sectionId !== "unknown" ? session.sectionId : topicSectionId(session.missedTopicIds?.[0]));
        const timingMode = source.timingMode ?? session.timingMode ?? "untimed";
        return {
            sectionId,
            topicIds: Array.isArray(source.topicIds) ? source.topicIds.slice() : [],
            skillIds: Array.isArray(source.skillIds) ? source.skillIds.slice() : [],
            difficulty: source.difficulty ?? "medium",
            questionFormat: source.questionFormat ?? getQuestionFormat(sectionId),
            questionCount: source.questionCount ?? session.generatedQuestionCount ?? session.attempts ?? (timingMode === "timed" ? 8 : 6),
            timingMode,
            secondsPerQuestion: timingMode === "timed" ? source.secondsPerQuestion ?? targetSecondsForSection(sectionId) : null,
            reviewMode: source.reviewMode ?? (timingMode === "timed" ? "later" : "immediate")
        };
    }
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

const getMistakeBreakdownSectionId = (row, metrics) => {
    if (row?.sectionId) return row.sectionId;
    const filteredSectionId = metrics?.filters?.sectionId;
    if (filteredSectionId && filteredSectionId !== "all") return filteredSectionId;
    const sectionFromBreakdown = row?.sectionBreakdown?.[0]?.sectionId;
    if (sectionFromBreakdown) return sectionFromBreakdown;
    if (row?.topicId) return topicSectionId(row.topicId);
    return "bb";
};

const createMistakeBreakdownDrillConfig = ({ row, type, metrics }) => {
    const actionableMistakeTypeId = row?.actionableMistakeTypeId ?? row?.dominantMistakeTypeId ?? null;
    const sectionId = getMistakeBreakdownSectionId(row, metrics);
    const timed = actionableMistakeTypeId === "time_pressure" || safeNumber(row?.averageTimeRatio, 0) > 1.12;
    const config = createDrillConfig({
        sectionId,
        topicId: type === "skill" ? null : row?.topicId ?? row?.id ?? null,
        skillId: type === "topic" ? null : row?.skillId ?? row?.id ?? null,
        timed,
        count: timed ? 8 : 6
    });
    return applyMistakeTypeToDrillConfig(config, actionableMistakeTypeId);
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
    const panel = createElement("section", "dashboard-filters");
    panel.setAttribute("aria-labelledby", "dashboard-filters-heading");
    const inner = createElement("div", "dashboard-filters-inner frame");
    const title = createElement("h2", "dashboard-filters-title", "Filters");
    title.id = "dashboard-filters-heading";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-ghost dashboard-filters-reset";
    reset.textContent = "Reset";
    reset.addEventListener("click", () => actions.resetDashboardFilters());
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
    inner.append(title, controls, reset);
    panel.append(inner);
    return panel;
};

const renderDashboardHero = (metrics, actions) => {
    const header = createElement("section", "hero hero-with-actions dashboard-hero frame");
    const copy = createElement("div", "hero-copy dashboard-hero-copy");
    appendText(copy, "h1", "", "Analytics dashboard");
    appendText(copy, "p", "", "Use your practice history to identify content gaps, skill vulnerabilities, timing pressure, confidence calibration, and more. Then get recommendations for the next drill to run.");
    const actionsWrap = createElement("div", "hero-actions dashboard-hero-actions");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary dashboard-ai-button";
    button.append(icon("plus", { size: 14 }), createElement("span", "", "Evaluate with AI"));
    const answeredCount = safeNumber(metrics?.totals?.totalQuestionsAnswered, 0);
    const storedCount = safeNumber(metrics?.totals?.totalAttemptsStored, 0);
    button.disabled = answeredCount <= 0;
    button.title = answeredCount > 0 ? "Copy an AI-ready analysis prompt for this dashboard view." : storedCount > 0 ? "No answered questions match the active filters." : "Complete a practice session first.";
    button.setAttribute("aria-label", "Evaluate dashboard stats with AI");
    button.addEventListener("click", () => actions.openDashboardAiAnalysis());
    actionsWrap.append(button);
    header.append(copy, actionsWrap);
    return header;
};

const createDialogClose = (label, onClick) => {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-icon generation-pipeline-close";
    close.setAttribute("aria-label", label);
    close.append(icon("close"));
    close.addEventListener("click", onClick);
    return close;
};

const renderAiAnalysisModal = (state, actions) => {
    if (!state.dashboard?.aiAnalysisOpen) return null;
    const metrics = state.analytics?.metrics;
    if (!metrics?.totals?.totalQuestionsAnswered) return null;
    const promptText = compileAnalyticsPrompt({
        metrics,
        recommendation: state.analytics?.recommendation
    });
    const overlay = createElement("section", "generation-pipeline-overlay analytics-prompt-overlay");
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeDashboardAiAnalysis(); });
    const panel = createElement("section", "generation-pipeline-panel dialog-centered analytics-prompt-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "analytics-prompt-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const top = createElement("div", "generation-pipeline-top");
    const heading = createElement("h2", "", "Evaluate with AI");
    heading.id = "analytics-prompt-heading";
    top.append(heading, createDialogClose("Close", () => actions.closeDashboardAiAnalysis()));
    const instructions = createElement("p", "generation-pipeline-instructions analytics-prompt-instructions", "Copy prompt → Paste into your AI's chat:");
    const note = createElement("p", "tiny analytics-prompt-note", `The prompt is ${promptText.length.toLocaleString()} characters long and only includes aggregate analytics with no details about individual sessions or questions.`);
    const controls = createElement("div", "analytics-prompt-row");
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "btn btn-primary";
    copyButton.textContent = "Copy prompt";
    copyButton.addEventListener("click", async () => {
        copyButton.disabled = true;
        try { await copyTextToClipboard(promptText); copyButton.textContent = "Copied"; }
        catch { copyButton.textContent = "Copy failed"; }
        finally { setTimeout(() => { copyButton.disabled = false; copyButton.textContent = "Copy prompt"; }, 1400); }
    });
    controls.append(copyButton);
    panel.append(top, instructions, controls, note);
    overlay.append(panel);
    return overlay;
};

const renderModelCorrectionModal = (state, actions) => {
    const activeModel = state.dashboard?.modelCorrection?.model;
    if (!activeModel) return null;
    const sessions = (state.analytics?.sessions ?? []).filter((session) => getEffectiveSessionAiModel(session) === activeModel).sort((a, b) => new Date(b.completedAt ?? b.createdAt ?? 0) - new Date(a.completedAt ?? a.createdAt ?? 0));
    if (!sessions.length) return null;
    const overlay = createElement("section", "generation-pipeline-overlay model-correction-overlay");
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeDashboardModelCorrection(); });
    const panel = createElement("section", "generation-pipeline-panel model-correction-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "model-correction-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const top = createElement("div", "generation-pipeline-top");
    const heading = createElement("h2", "", "Edit AI model name");
    heading.id = "model-correction-heading";
    top.append(heading, createDialogClose("Close AI model correction", () => actions.closeDashboardModelCorrection()));
    const description = createElement("p", "model-correction-description", "Choose the correct model and the sessions it applies to. Original model names stay in your data.");
    const form = createElement("form", "model-correction-form");
    const modelGrid = createElement("div", "model-correction-model-grid");
    const currentField = createElement("div", "field model-correction-field");
    const currentLabel = document.createElement("label");
    currentLabel.htmlFor = "model-correction-current";
    currentLabel.textContent = "Current model";
    const currentInput = document.createElement("input");
    currentInput.id = "model-correction-current";
    currentInput.type = "text";
    currentInput.value = activeModel;
    currentInput.readOnly = true;
    currentField.append(currentLabel, currentInput);
    const modelField = createElement("div", "field model-correction-field");
    const modelLabel = document.createElement("label");
    modelLabel.htmlFor = "model-correction-select";
    modelLabel.textContent = "Correct model";
    const select = document.createElement("select");
    select.id = "model-correction-select";
    select.setAttribute("aria-label", "Correct model");
    const unknown = document.createElement("option");
    unknown.value = "unknown";
    unknown.textContent = "Unknown";
    select.append(unknown);
    AI_MODEL_CATALOG.forEach((group) => {
        group.models.forEach((model) => {
            const option = document.createElement("option");
            option.value = model;
            option.textContent = model;
            select.append(option);
        });
    });
    const customOption = document.createElement("option");
    customOption.value = CUSTOM_AI_MODEL_VALUE;
    customOption.textContent = "Enter another model...";
    select.append(customOption);
    const currentIsCatalogued = AI_MODEL_CATALOG_VALUES.has(activeModel);
    select.value = currentIsCatalogued ? activeModel : CUSTOM_AI_MODEL_VALUE;
    modelField.append(modelLabel, select);
    modelGrid.append(currentField, modelField);
    const customField = createElement("div", "field model-correction-field model-correction-custom-field");
    const customInput = document.createElement("input");
    customInput.id = "model-correction-custom";
    customInput.type = "text";
    customInput.setAttribute("aria-label", "Custom model name");
    customInput.maxLength = MAX_AI_MODEL_NAME_LENGTH;
    customInput.autocomplete = "off";
    customInput.placeholder = "provider/model";
    customInput.value = currentIsCatalogued ? "" : activeModel;
    customField.append(customInput);
    const syncCustomField = () => {
        const custom = select.value === CUSTOM_AI_MODEL_VALUE;
        customField.hidden = !custom;
        customInput.required = custom;
        if (custom) customInput.focus();
    };
    select.addEventListener("change", syncCustomField);
    customField.hidden = currentIsCatalogued;
    customInput.required = !currentIsCatalogued;
    const sessionSection = createElement("fieldset", "model-correction-sessions");
    const legend = createElement("legend", "", "Sessions generated by model");
    const selectAllLabel = createElement("label", "model-correction-select-all");
    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.checked = true;
    selectAllLabel.append(selectAll, document.createTextNode("Select all"));
    const list = createElement("div", "model-correction-session-list");
    sessions.forEach((session) => {
        const label = createElement("label", "model-correction-session");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "model-correction-session";
        checkbox.value = session.id;
        checkbox.checked = true;
        const copy = createElement("span", "model-correction-session-copy");
        const title = session.generatedSession?.session?.title ?? "Practice session";
        const sectionId = session.generatedSession?.session?.sectionId ?? session.config?.sectionId ?? "unknown";
        const when = session.completedAt ?? session.createdAt;
        appendText(copy, "strong", "", title);
        appendText(copy, "span", "tiny", `${when ? new Date(when).toLocaleDateString() : "Unknown date"} · ${rowNameFromId("section", sectionId)}`);
        const recordedModel = getRecordedSessionAiModel(session);
        if (recordedModel !== activeModel) appendText(copy, "span", "tiny model-correction-recorded", `Recorded as ${recordedModel}`);
        label.append(checkbox, copy);
        list.append(label);
    });
    const sessionCheckboxes = () => Array.from(list.querySelectorAll('input[name="model-correction-session"]'));
    selectAll.addEventListener("change", () => sessionCheckboxes().forEach((checkbox) => { checkbox.checked = selectAll.checked; }));
    list.addEventListener("change", () => {
        const checkboxes = sessionCheckboxes();
        selectAll.checked = checkboxes.every((checkbox) => checkbox.checked);
        selectAll.indeterminate = !selectAll.checked && checkboxes.some((checkbox) => checkbox.checked);
    });
    sessionSection.append(legend, selectAllLabel, list);
    const controls = createElement("div", "button-row model-correction-actions");
    const apply = document.createElement("button");
    apply.type = "submit";
    apply.className = "btn btn-primary";
    apply.textContent = "Apply";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-secondary";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => actions.closeDashboardModelCorrection());
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "btn btn-secondary";
    restore.textContent = "Restore";
    restore.disabled = !sessions.some((session) => Boolean(session.aiModelOverride));
    const selectedIds = () => sessionCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
    const setBusy = (busy) => { apply.disabled = busy; cancel.disabled = busy; restore.disabled = busy || !sessions.some((session) => Boolean(session.aiModelOverride)); select.disabled = busy; customInput.disabled = busy; };
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const modelName = select.value === CUSTOM_AI_MODEL_VALUE ? customInput.value : select.value;
        setBusy(true);
        try { await actions.correctDashboardAiModel(selectedIds(), modelName); }
        finally { if (document.body.contains(panel)) setBusy(false); }
    });
    restore.addEventListener("click", async () => {
        setBusy(true);
        try { await actions.restoreDashboardAiModel(selectedIds()); }
        finally { if (document.body.contains(panel)) setBusy(false); }
    });
    controls.append(restore, cancel, apply);
    form.append(modelGrid, customField, sessionSection, controls);
    panel.append(top, description, form);
    overlay.append(panel);
    return overlay;
};

const renderBackupReminderModal = (state, actions) => {
    if (!state.dashboard?.backupReminderOpen) return null;
    if (!state.analytics?.sessions?.length && !state.analytics?.attempts?.length) return null;
    const overlay = createElement("section", "generation-pipeline-overlay backup-reminder-overlay");
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeDashboardBackupReminder(); });
    const panel = createElement("section", "generation-pipeline-panel dialog-centered backup-reminder-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "backup-reminder-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const top = createElement("div", "generation-pipeline-top");
    const heading = createElement("h2", "", "Data backup reminder");
    heading.id = "backup-reminder-heading";
    top.append(heading, createDialogClose("Close data backup reminder", () => actions.closeDashboardBackupReminder()));
    const backupStatus = state.analytics?.backupStatus;
    const size = createElement("p", "backup-reminder-size", backupStatus?.dataSizeMessage ?? "You have no current OpenMCAT data.");
    const status = createElement("p", `backup-status-note ${backupStatus?.hasChanges ? "warning-note" : "note"}`, backupStatus?.message ?? "Backup status unavailable.");
    const description = createElement("p", "backup-reminder-description", "The current OpenMCAT data stays completely private in this web browser. Download or share it regularly so that it can be restored if this browser's data is ever haphazardly cleared or if OpenMCAT is used on another device.");
    const controls = createElement("div", "button-row backup-reminder-actions");
    const backupButton = document.createElement("button");
    backupButton.type = "button";
    backupButton.className = "btn btn-primary";
    backupButton.textContent = "Backup data";
    backupButton.addEventListener("click", async () => {
        backupButton.disabled = true;
        try { await actions.backupDataFromReminder(); }
        catch (error) { alert(`Backup failed: ${error.message}`); }
        finally { if (backupButton.isConnected) backupButton.disabled = false; }
    });
    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "btn btn-secondary";
    shareButton.textContent = "Share data";
    shareButton.addEventListener("click", () => actions.shareDataBackup({ closeReminder: true }));
    const laterButton = document.createElement("button");
    laterButton.type = "button";
    laterButton.className = "btn btn-secondary";
    laterButton.textContent = "Remind me later";
    laterButton.addEventListener("click", () => actions.closeDashboardBackupReminder());
    controls.append(backupButton);
    if (state.backupSharingSupported) controls.append(shareButton);
    controls.append(laterButton);
    panel.append(top, size, status, description, controls);
    overlay.append(panel);
    return overlay;
};

const appendDashboardModals = (root, state, actions) => {
    const aiModal = renderAiAnalysisModal(state, actions);
    const backupModal = renderBackupReminderModal(state, actions);
    const modelCorrectionModal = renderModelCorrectionModal(state, actions);
    if (aiModal) root.append(aiModal);
    if (backupModal) root.append(backupModal);
    if (modelCorrectionModal) root.append(modelCorrectionModal);
};

const renderEmptyState = (actions, filtersActive) => {
    const empty = createElement("section", "empty-state dashboard-empty frame");
    const heading = createElement("h2", "", filtersActive ? "No data matches these filters" : "No data yet");
    const message = createElement("p", "", filtersActive ? "Reset filters or complete more practice to populate this slice of the dashboard." : "Complete a practice session to unlock trends, heatmaps, timing analysis, confidence calibration, and drill recommendations.");
    const row = createElement("div", "button-row dashboard-empty-actions");
    const create = document.createElement("button");
    create.className = "btn btn-primary";
    create.textContent = "Generate practice session";
    create.addEventListener("click", () => actions.navigate("generator"));
    const bank = document.createElement("button");
    bank.className = "btn btn-secondary";
    bank.textContent = "Try question bank";
    bank.addEventListener("click", () => actions.navigate("bank"));
    row.append(create, bank);
    if (filtersActive) {
        const reset = document.createElement("button");
        reset.className = "btn btn-secondary";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => actions.resetDashboardFilters());
        row.append(reset);
    }
    empty.append(heading, message, row);
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
    const recentTrend = getRecentTrend(metrics.filteredAttempts);
    const grid = createElement("section", "dashboard-grid dashboard-summary-grid");
    grid.setAttribute("aria-label", "Summary metrics");
    const primary = createElement("div", "dashboard-metrics-primary");
    const trendCard = createStatCard("Recent trend", recentTrend.value, `${recentTrend.last}\n${recentTrend.prev}`);
    const trendValue = Number.parseFloat(recentTrend.value);
    if (Number.isFinite(trendValue) && trendValue > 0) trendCard.classList.add("is-positive");
    else if (Number.isFinite(trendValue) && trendValue < 0) trendCard.classList.add("is-negative");
    primary.append(
        createStatCard("Questions answered", `${totals.totalQuestionsAnswered}`, `${totals.totalCorrect} correct in the active filter`),
        createStatCard("Overall accuracy", pct(totals.overallAccuracy), `Smoothed: ${pct(totals.smoothedAccuracy)}`),
        createStatCard("Mastery estimate", `${score(totals.mastery)}/100`, "Overall"),
        trendCard
    );
    const secondary = createElement("div", "dashboard-metrics-secondary");
    secondary.append(
        createStatCard("Average time per question", formatDurationMs(totals.averageElapsedMs), `Target: ${seconds(totals.averageTargetTimeMs)}`),
        createStatCard("Completion rate", pct(totals.completionRate), `${totals.totalCompletedSessions} completed sessions stored`),
        createStatCard("Timed vs untimed", typeof totals.timedUntimedGap === "number" ? pctPoints(Math.abs(totals.timedUntimedGap)) : "n/a", gapHint),
        createStatCard("Calibration", calibration, `${metrics.confidence.noConfidenceCount} attempts without confidence`),
        createStatCard("Best section", rowNameFromId("section", bestSection?.id), bestSection ? `${score(bestSection.mastery)}/100 mastery` : "Need section data"),
        createStatCard("Weakest section", rowNameFromId("section", weakSection?.id), weakSection ? `${score(weakSection.priorityScore)} priority score` : "Need section data"),
        createStatCard("Topic coverage", pct(totals.topicCoverageRate), `${coveredTopicCount}/${totalTopicCount} topics attempted`),
        createStatCard("Completed sessions", `${totals.recentSessionsCount}`, "matching current filters")
    );
    grid.append(primary, secondary);
    return grid;
};

const renderEvidenceChips = (evidence = {}) => {
    const chips = createElement("dl", "evidence-chip-list");
    const mistakeFocusLabel = evidence.mistakeFocusLabel ? `${evidence.mistakeFocusLabel}${Number.isFinite(evidence.mistakeFocusTaggedMisses) ? ` (${pluralText(evidence.mistakeFocusTaggedMisses, "tagged miss", "tagged misses")})` : ""}` : null;
    const entries = [
        ["Attempts", evidence.attempts !== undefined ? attemptCount(evidence.attempts) : null],
        ["Raw accuracy", evidence.accuracy !== undefined ? pct(evidence.accuracy) : null],
        ["Smoothed accuracy", evidence.smoothedAccuracy !== undefined ? pct(evidence.smoothedAccuracy) : null],
        ["Mastery", evidence.mastery !== undefined ? `${score(evidence.mastery)}/100` : null],
        ["Average time", evidence.averageElapsedMs !== undefined ? seconds(evidence.averageElapsedMs) : null],
        ["Priority score", evidence.priorityScore !== undefined ? score(evidence.priorityScore) : null],
        ["Mistake focus", mistakeFocusLabel],
        ["Signal", evidence.signalStrength ?? null]
    ].filter(([, value]) => value !== null && value !== undefined);
    entries.forEach(([label, value]) => {
        const chip = createElement("div", "evidence-chip");
        appendText(chip, "dt", "", label);
        appendText(chip, "dd", "", String(value));
        chips.append(chip);
    });
    return chips;
};

const getMistakeFocusLabel = (mistakeFocus = {}) => mistakeFocus.label ?? "Tagged mistake pattern";

const renderMistakeFocusCard = (mistakeFocus) => {
    if (!mistakeFocus?.label) return null;
    const panel = createElement("section", "recommendation-mistake-focus");
    appendText(panel, "p", "label-caps recommendation-mistake-eyebrow", "Mistake focus");
    const heading = createElement("h3", "", mistakeFocus.strategyLabel ? `${getMistakeFocusLabel(mistakeFocus)} · ${mistakeFocus.strategyLabel}` : getMistakeFocusLabel(mistakeFocus));
    const basis = `${pluralText(safeNumber(mistakeFocus.taggedIncorrectAttemptCount, 0), "tagged miss", "tagged misses")} in ${mistakeFocus.scopeLabel ?? "the active filter"}`;
    panel.append(heading);
    appendText(panel, "p", "tiny recommendation-mistake-basis", `Based on ${basis}. Multiple tags can apply to one miss.`);
    if (mistakeFocus.reviewFocus) appendText(panel, "p", "recommendation-review-focus", mistakeFocus.reviewFocus);
    if (mistakeFocus.flawedQuestionSelections) appendText(panel, "p", "tiny recommendation-mistake-caveat", "Flawed-question tags are shown as quality context but do not steer drill settings.");
    else if (!mistakeFocus.isDrillSteering) appendText(panel, "p", "tiny recommendation-mistake-caveat", "This tag is shown as context and does not change drill settings.");
    const rows = Array.isArray(mistakeFocus.rows) ? mistakeFocus.rows : [];
    if (rows.length) {
        const chipList = createElement("div", "recommendation-mistake-chip-list");
        rows.forEach((row) => {
            const chip = createElement("span", `recommendation-mistake-chip${row.id === (mistakeFocus.actionableMistakeTypeId ?? mistakeFocus.dominantMistakeTypeId) && mistakeFocus.isDrillSteering ? " is-actionable" : ""}`);
            chip.textContent = `${row.label}: ${safeNumber(row.count, 0)}`;
            chipList.append(chip);
        });
        panel.append(chipList);
    }
    return panel;
};

const renderRecommendationCard = (recommendation, actions) => {
    const card = createElement("section", "dashboard-recommendation");
    card.setAttribute("aria-labelledby", "dashboard-next-drill-heading");
    const content = createElement("div", "dashboard-recommendation-content");
    appendText(content, "p", "fig-label dashboard-eyebrow", "Recommended");
    const heading = appendText(content, "h2", "", "Next drill");
    heading.id = "dashboard-next-drill-heading";
    appendText(content, "p", "recommendation-body", recommendation?.body ?? "Complete more questions to generate a recommendation.");
    if (recommendation?.evidence) content.append(renderEvidenceChips(recommendation.evidence));
    const mistakeFocus = renderMistakeFocusCard(recommendation?.mistakeFocus);
    if (mistakeFocus) content.append(mistakeFocus);
    if (recommendation?.rationale?.length) {
        const list = createElement("ul", "recommendation-rationale");
        recommendation.rationale.forEach((item) => { const li = document.createElement("li"); li.textContent = item; list.append(li); });
        content.append(list);
    }
    const alternatives = recommendation?.alternatives ?? [];
    if (alternatives.length) {
        const alternativeWrap = createElement("div", "recommendation-alternatives");
        appendText(alternativeWrap, "p", "label-caps", "Other high-priority drills");
        const alternativeList = createElement("div", "recommendation-alternative-list");
        alternatives.forEach((alternative) => {
            const button = createActionButton(alternative.label, alternative.config, actions, "btn btn-link recommendation-chip-button");
            button.replaceChildren(createElement("span", "", alternative.label), icon("arrow-right", { size: 13 }));
            alternativeList.append(button);
        });
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

const renderChartPanel = ({ title, subtitle, canvasLabel, tableColumns, tableRows, config, headerAction = null }) => {
    const table = createAccessibleDataTable(tableColumns, tableRows);
    const { card, canvas } = createChartShell({ title, subtitle, canvasLabel, table });
    if (headerAction) {
        const header = card.querySelector(".chart-card-header");
        header?.classList.add("chart-card-header-with-action");
        header?.append(headerAction);
    }
    const legendOptions = config.options?.plugins?.legend;
    if (legendOptions && legendOptions.display !== false) {
        insertChartLegend(card, canvas, createChartLegend(canvas, legendItemsFromDatasets(config.data.datasets)));
        legendOptions.display = false;
    }
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
                    borderWidth: 2,
                    fill: false,
                    tension: 0.25,
                    pointRadius: (context) => context.dataIndex === accuracyData.length - 1 ? 3.5 : 0,
                    pointHoverRadius: 4,
                    pointBackgroundColor: theme.accent,
                    pointBorderWidth: 0
                }]
            },
            options: getDefaultChartOptions({
                scales: {
                    x: chartAxis(theme, { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 16 } }),
                    y: chartAxis(theme, { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } })
                }
            })
        }
    });
};

const renderSectionMasteryChart = (metrics) => {
    const theme = getChartTheme();
    const rows = makeCompleteRows(SECTIONS, metrics.rows.bySection, makeEmptySectionRow).sort((a, b) => (sectionOrder[a.id] ?? 99) - (sectionOrder[b.id] ?? 99));
    const valueLabels = rows.map((row) => masteryLabel(row));
    const card = renderChartPanel({
        title: "Section mastery",
        subtitle: "Mastery is adjusted for accuracy, volume, timing, and topic coverage for each section.",
        canvasLabel: "Section mastery radar chart",
        tableColumns: ["Section", "Attempts", "Accuracy", "Coverage", "Mastery"],
        tableRows: rows.map((row) => [rowNameFromId("section", row.id), attemptCount(row.attempts), accuracyLabel(row), `${row.coveredTopicCount ?? 0}/${row.totalTopicCount ?? 0}`, masteryLabel(row)]),
        config: {
            type: "radar",
            data: {
                labels: rows.map((row) => rowNameFromId("section", row.id)),
                datasets: [{
                    label: "Mastery",
                    data: rows.map((row) => metricValue(row, row.mastery)),
                    borderColor: theme.accent,
                    backgroundColor: chartColorWithAlpha(theme.accent, 0.16),
                    borderWidth: 1.5,
                    pointRadius: 2.5,
                    pointHoverRadius: 4,
                    pointBackgroundColor: theme.accent,
                    pointBorderColor: theme.accent
                }]
            },
            options: getDefaultChartOptions({
                replaceScales: true,
                layout: { padding: { top: 4, bottom: 4 } },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${Number.isFinite(context.raw) ? `${score(context.raw)}/100` : "n/a"}`
                        }
                    }
                },
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        angleLines: { color: theme.border },
                        grid: { color: theme.border },
                        pointLabels: {
                            color: theme.textPrimary,
                            padding: 6,
                            font: { family: theme.fontSerif, size: 15, weight: "400", lineHeight: 1.2 },
                            callback: (label) => [label, " "]
                        },
                        ticks: { display: false, stepSize: 25 }
                    }
                }
            }),
            plugins: [createRadarValueLabelsPlugin({ values: valueLabels, theme })]
        }
    });
    return card;
};

const getModelColors = (rows, theme) => {
    let modelIndex = 0;
    return rows.map((row) => {
        if (row?.model === "unknown") return theme.palette[10];
        const color = theme.palette[modelIndex % 8];
        modelIndex += 1;
        return color;
    });
};

const renderModelUsageLegend = (pageInfo, colors, actions) => {
    const legend = createElement("div", "model-usage-legend");
    if (!pageInfo?.totalItems) {
        appendText(legend, "p", "tiny", "No AI model metadata is available for the current dashboard slice yet.");
        return legend;
    }
    pageInfo.rows.forEach((row, index) => {
        const colorIndex = pageInfo.start + index;
        const item = createElement("div", "model-usage-legend-item");
        const swatch = createElement("span", "model-usage-swatch");
        swatch.style.backgroundColor = colors[colorIndex] ?? colors[colorIndex % colors.length];
        const body = createElement("div", "model-usage-legend-body");
        appendText(body, "strong", "", row.model);
        appendText(body, "span", "tiny", `${row.generatedQuestionCount} generated questions · ${row.sessionCount} sessions`);
        const correct = document.createElement("button");
        correct.type = "button";
        correct.className = "btn btn-icon model-usage-correct";
        correct.append(icon("pencil", { size: 14 }));
        correct.setAttribute("aria-label", `Edit ${row.model} model name`);
        correct.title = "Edit model name";
        correct.addEventListener("click", () => actions.openDashboardModelCorrection(row.model));
        item.append(swatch, body, correct);
        legend.append(item);
    });
    return legend;
};

const renderModelUsageChart = (metrics, actions, pages) => {
    const theme = getChartTheme();
    const rows = metrics.models?.rows ?? [];
    const pageInfo = getPaginatedRows(rows, pages, "modelUsageLegend", MODEL_USAGE_LEGEND_PAGE_SIZE);
    const pagination = createPaginationControls({ key: "modelUsageLegend", pageInfo, actions });
    const colors = getModelColors(rows, theme);
    const table = createAccessibleDataTable(
        ["Model", "Sessions", "Generated", "Answered", "Accuracy"],
        rows.map((row) => [row.model, `${row.sessionCount}`, `${row.generatedQuestionCount}`, `${row.answeredAttempts}`, row.answeredAttempts ? pct(row.accuracy) : "n/a"])
    );
    const card = createElement("article", "chart-card dashboard-model-card");
    const header = createElement("div", "chart-card-header");
    const titleWrap = createElement("div", "chart-card-title");
    appendText(titleWrap, "h2", "", "AI model mix");
    appendText(titleWrap, "p", "", "Generated questions by recorded or corrected AI model metadata for sessions in the active dashboard slice.");
    header.append(titleWrap);
    const body = createElement("div", "dashboard-model-card-body");
    const canvasWrap = createElement("div", "chart-canvas-wrap dashboard-model-canvas-wrap");
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "AI model mix doughnut chart");
    canvasWrap.append(canvas);
    const side = createElement("div", "dashboard-model-side");
    const legendWrap = createElement("div", "model-usage-legend-wrap");
    const legendHeader = createElement("div", "model-usage-legend-header");
    appendText(legendHeader, "span", "tiny", "Legend");
    if (pagination) legendHeader.append(pagination);
    legendWrap.append(legendHeader, renderModelUsageLegend(pageInfo, colors, actions));
    side.append(legendWrap);
    body.append(canvasWrap, side);
    card.append(header, body);
    if (!hasChartRuntime()) {
        const fallback = document.createElement("p");
        fallback.className = "chart-fallback";
        fallback.textContent = "Chart.js did not load. The data table is still available.";
        card.append(fallback);
    }
    card.append(createChartDataDetails(table, "model-usage-data-details"));
    const total = rows.reduce((sum, row) => sum + safeNumber(row.generatedQuestionCount, 0), 0);
    queueChartRender(canvas, {
        type: "doughnut",
        data: {
            labels: rows.map((row) => row.model),
            datasets: [{
                label: "Generated questions",
                data: rows.map((row) => row.generatedQuestionCount),
                backgroundColor: colors,
                borderColor: theme.page,
                borderWidth: 3,
                hoverOffset: 0,
                hoverBorderColor: theme.page
            }]
        },
        options: getDefaultChartOptions({
            replaceScales: true,
            cutout: "72%",
            interaction: { intersect: true, mode: "nearest" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.raw} generated questions`
                    }
                }
            }
        }),
        plugins: [createDoughnutTotalPlugin({ total, theme })]
    });
    return card;
};

const renderTopicWeaknessChart = (metrics, actions, pages) => {
    const theme = getChartTheme();
    const allRows = metrics.weakness.weakestTopics;
    const pageInfo = getPaginatedRows(allRows, pages, "topicWeakness", isPhoneViewport() ? 3 : COMPACT_PAGE_SIZE);
    const rows = pageInfo.rows;
    const pagination = createPaginationControls({ key: "topicWeakness", pageInfo, actions });
    return renderChartPanel({
        title: "Topic weakness priority",
        subtitle: "Higher priority combines low smoothed accuracy, slower timing, volume, and confidence mismatch.",
        canvasLabel: "Topic weakness priority chart",
        tableColumns: ["Topic", "Attempts", "Accuracy", "Priority"],
        tableRows: rows.map((row) => [rowNameFromId("topic", row.id), attemptCount(row.attempts), pct(row.accuracy), score(row.priorityScore)]),
        headerAction: pagination,
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => chartLabel(rowNameFromId("topic", row.id), 16, 4)),
                datasets: [{ label: "Priority", data: rows.map((row) => row.priorityScore), backgroundColor: theme.warning, borderWidth: 0, maxBarThickness: 56, categoryPercentage: 0.7, barPercentage: 0.9 }]
            },
            options: getDefaultChartOptions({
                layout: { padding: { top: 16 } },
                scales: {
                    x: chartAxis(theme, { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, minRotation: 0 } }),
                    y: chartAxis(theme, { min: 0, max: 100, ticks: { stepSize: 25 } })
                }
            }),
            plugins: [createBarValueLabelsPlugin({ theme, format: (value) => score(value) })]
        }
    });
};

const renderSkillPerformanceChart = (metrics, actions, pages) => {
    const theme = getChartTheme();
    const allRows = makeCompleteRows(getSkillChartCategories(metrics), metrics.rows.bySkill, makeEmptySkillRow).sort((a, b) => (skillOrder[a.id] ?? 99) - (skillOrder[b.id] ?? 99));
    const pageInfo = isPhoneViewport() ? getPaginatedRows(allRows, pages, "skillPerformance", 2) : null;
    const rows = pageInfo?.rows ?? allRows;
    const pagination = createPaginationControls({ key: "skillPerformance", pageInfo, actions });
    return renderChartPanel({
        title: "Skill performance",
        subtitle: "Compare raw accuracy with the mastery estimate for each reasoning skill.",
        canvasLabel: "Skill performance bar chart",
        tableColumns: ["Skill", "Attempts", "Accuracy", "Mastery"],
        tableRows: rows.map((row) => [rowNameFromId("skill", row.id), attemptCount(row.attempts), accuracyLabel(row), masteryLabel(row)]),
        headerAction: pagination,
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => chartLabel(rowNameFromId("skill", row.id), 18, 3)),
                datasets: [
                    { label: "Accuracy", data: rows.map((row) => metricValue(row, cb.numb.roundTo(row.accuracy * 100, 0.1))), backgroundColor: theme.palette[10], borderWidth: 0, maxBarThickness: 40, categoryPercentage: 0.66, barPercentage: 0.88 },
                    { label: "Mastery", data: rows.map((row) => metricValue(row, row.mastery)), backgroundColor: theme.accent, borderWidth: 0, maxBarThickness: 40, categoryPercentage: 0.66, barPercentage: 0.88 }
                ]
            },
            options: getDefaultChartOptions({
                scales: {
                    x: chartAxis(theme, { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, minRotation: 0 } }),
                    y: chartAxis(theme, { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } })
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
                    { label: "Actual accuracy", data: rows.map((row) => row.attempts ? cb.numb.roundTo(row.accuracy * 100, 0.1) : null), borderColor: theme.accent, backgroundColor: theme.accent, borderWidth: 2, tension: 0.2, pointRadius: 3.5, pointHoverRadius: 4.5, pointBorderWidth: 0 },
                    { label: "Reference", data: rows.map((row) => cb.numb.roundTo(row.expectedAccuracy * 100, 0.1)), borderColor: theme.textMuted, backgroundColor: theme.textMuted, borderWidth: 1.25, borderDash: [5, 5], tension: 0, pointRadius: 0, pointHoverRadius: 0 }
                ]
            },
            options: getDefaultChartOptions({
                scales: {
                    x: chartAxis(theme, { grid: { display: false } }),
                    y: chartAxis(theme, { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } })
                }
            })
        }
    });
};

const getMistakeTypeColors = (metrics, theme) => {
    const ids = [];
    const addId = (id) => { if (id && !ids.includes(id)) ids.push(id); };
    (metrics.mistakes?.trend?.activeMistakeTypes ?? []).filter((type) => safeNumber(type.count, 0) > 0).forEach((type) => addId(type.id));
    (metrics.mistakes?.rows ?? []).filter((row) => safeNumber(row.count, 0) > 0).forEach((row) => addId(row.id));
    return new Map(ids.map((id, index) => [id, theme.palette[index % theme.palette.length]]));
};

const renderMistakeTypeChart = (metrics) => {
    const theme = getChartTheme();
    const mistakes = metrics.mistakes ?? {};
    const allRows = Array.isArray(mistakes.rows) ? mistakes.rows : [];
    const rows = allRows.filter((row) => safeNumber(row.count, 0) > 0);
    const incorrectCount = safeNumber(mistakes.incorrectAttemptCount, 0);
    const taggedCount = safeNumber(mistakes.taggedIncorrectAttemptCount, 0);
    const coverageText = incorrectCount ? `${taggedCount}/${incorrectCount} incorrect questions tagged.` : "No incorrect questions in the active filter.";
    const table = createAccessibleDataTable(
        ["Mistake type", "Selections", "% of selected tags", "% of incorrect questions"],
        allRows.map((row) => [row.label, `${safeNumber(row.count, 0)}`, pct(row.selectionRate), pct(row.incorrectQuestionRate)])
    );
    const { card, canvas } = createChartShell({
        title: "Types of mistakes",
        subtitle: `Selected mistake tags on incorrect questions in the active dashboard filter. Multiple tags per question are allowed. ${coverageText}`,
        canvasLabel: "Types of mistakes polar area chart",
        table
    });
    if (!rows.length) {
        const empty = createElement("p", "chart-empty-message", incorrectCount ? "No mistake types have been tagged in the active dashboard slice yet." : "No incorrect questions match the active dashboard filters yet.");
        const wrap = canvas.closest(".chart-canvas-wrap");
        if (wrap) {
            wrap.classList.add("chart-empty-wrap");
            wrap.replaceChildren(empty);
        } else canvas.replaceWith(empty);
        return card;
    }
    const ranks = rows.map((_, index) => index + 1);
    const colorsById = getMistakeTypeColors(metrics, theme);
    const colors = rows.map((row, index) => colorsById.get(row.id) ?? theme.palette[index % theme.palette.length]);
    const wrap = canvas.closest(".chart-canvas-wrap");
    const rankList = createElement("ol", "mistake-rank-list");
    rankList.setAttribute("aria-label", "Mistake types by rank");
    rows.forEach((row, index) => {
        const item = document.createElement("li");
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "mistake-rank-toggle";
        toggle.setAttribute("aria-pressed", "true");
        toggle.title = `Show or hide ${row.label}`;
        appendText(toggle, "span", "rank", String(ranks[index]));
        const swatch = createElement("span", "chart-legend-swatch");
        swatch.style.setProperty("--swatch", colors[index]);
        swatch.setAttribute("aria-hidden", "true");
        toggle.append(swatch);
        appendText(toggle, "span", "", row.label);
        appendText(toggle, "span", "count", attemptCount(safeNumber(row.count, 0)));
        toggle.addEventListener("click", () => toggleChartSeries(canvas, index, "data", toggle));
        item.append(toggle);
        rankList.append(item);
    });
    if (wrap) {
        const body = createElement("div", "mistake-type-chart-body");
        wrap.replaceWith(body);
        body.append(wrap, rankList);
    }
    queueChartRender(canvas, {
        type: "polarArea",
        data: {
            labels: rows.map((row) => chartLabel(row.label, 16, 2)),
            datasets: [{
                label: "Selections",
                data: rows.map((row) => row.count),
                backgroundColor: colors.map((color) => chartColorWithAlpha(color, 0.85)),
                borderColor: theme.page,
                borderWidth: 1.5,
                hoverBorderColor: theme.page
            }]
        },
        options: getDefaultChartOptions({
            replaceScales: true,
            interaction: { intersect: true, mode: "nearest" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const row = rows[context.dataIndex];
                            return `${row.label}: ${context.raw} selections (${pct(row.selectionRate)} of selected tags)`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    ticks: { display: false, precision: 0 },
                    grid: { color: theme.border },
                    angleLines: { display: false }
                }
            }
        }),
        plugins: [createPolarRankLabelsPlugin({ ranks, colors, theme })]
    });
    return card;
};

const renderTimingChart = (metrics) => {
    const theme = getChartTheme();
    const rows = makeCompleteRows(DIFFICULTIES, metrics.rows.byDifficulty, makeEmptyDifficultyRow);
    return renderChartPanel({
        title: "Timing and accuracy by difficulty",
        subtitle: "Average seconds per question compared with accuracy for each difficulty level.",
        canvasLabel: "Timing and accuracy by difficulty chart",
        tableColumns: ["Difficulty", "Attempts", "Correct", "Accuracy", "Average time"],
        tableRows: rows.map((row) => [rowNameFromId("difficulty", row.id), attemptCount(row.attempts), attemptCount(row.correct), accuracyLabel(row), hasAttempts(row) ? seconds(row.averageElapsedMs) : "n/a"]),
        config: {
            type: "bar",
            data: {
                labels: rows.map((row) => rowNameFromId("difficulty", row.id)),
                datasets: [
                    { label: "Average seconds", data: rows.map((row) => metricValue(row, cb.numb.roundTo(row.averageElapsedMs / 1000, 0.1))), backgroundColor: theme.accentTwo, borderWidth: 0, maxBarThickness: 40, categoryPercentage: 0.6, barPercentage: 0.88, yAxisID: "seconds" },
                    { label: "Accuracy", data: rows.map((row) => metricValue(row, cb.numb.roundTo(row.accuracy * 100, 0.1))), backgroundColor: theme.accent, borderWidth: 0, maxBarThickness: 40, categoryPercentage: 0.6, barPercentage: 0.88, yAxisID: "accuracy" }
                ]
            },
            options: getDefaultChartOptions({
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => context.dataset.label === "Accuracy" ? `${context.dataset.label}: ${score(context.raw)}%` : `${context.dataset.label}: ${score(context.raw)}s`
                        }
                    }
                },
                scales: {
                    seconds: chartAxis(theme, { type: "linear", position: "left", min: 0, ticks: { callback: (value) => `${value}s` } }),
                    accuracy: chartAxis(theme, { type: "linear", position: "right", min: 0, max: 100, ticks: { callback: (value) => `${value}%` }, grid: { drawOnChartArea: false } }),
                    x: chartAxis(theme, { grid: { display: false } }),
                    y: { display: false, grid: { display: false } }
                }
            })
        }
    });
};

const renderMistakeTypeTrendChart = (metrics) => {
    const theme = getChartTheme();
    const mistakes = metrics.mistakes ?? {};
    const trend = mistakes.trend ?? {};
    const rows = Array.isArray(trend.rows) ? trend.rows : [];
    const activeMistakeTypes = (Array.isArray(trend.activeMistakeTypes) ? trend.activeMistakeTypes : []).filter((type) => safeNumber(type.count, 0) > 0);
    const incorrectCount = safeNumber(mistakes.incorrectAttemptCount, 0);
    const totalSelections = safeNumber(trend.totalSelections, safeNumber(mistakes.totalSelections, 0));
    const table = createAccessibleDataTable(
        ["Date", "Tagged misses", "Total selections", ...activeMistakeTypes.map((type) => type.label)],
        rows.map((row) => [
            row.label ?? row.date,
            attemptCount(row.taggedIncorrectAttemptCount),
            attemptCount(row.totalSelections),
            ...activeMistakeTypes.map((type) => attemptCount(row.countsByType?.[type.id] ?? 0))
        ])
    );
    table.classList.add("mistake-trend-data-table");
    table.querySelector("table")?.style.setProperty("min-width", `${Math.max(780, 340 + activeMistakeTypes.length * 132)}px`);
    const { card, canvas } = createChartShell({
        title: "Mistake types trend",
        subtitle: "Selected mistake tags over time for incorrect questions in the active dashboard filter. Multiple tags on one question are stacked separately.",
        canvasLabel: "Mistake types trend stacked area chart",
        table
    });
    if (!rows.length || !activeMistakeTypes.length || !totalSelections) {
        const empty = createElement("p", "chart-empty-message", incorrectCount ? "No mistake types have been tagged in the active dashboard slice yet." : "No incorrect questions match the active dashboard filters yet.");
        const wrap = canvas.closest(".chart-canvas-wrap");
        if (wrap) {
            wrap.classList.add("chart-empty-wrap");
            wrap.replaceChildren(empty);
        } else canvas.replaceWith(empty);
        return card;
    }
    const colorsById = getMistakeTypeColors(metrics, theme);
    const colors = activeMistakeTypes.map((type, index) => colorsById.get(type.id) ?? theme.palette[index % theme.palette.length]);
    const labels = rows.map((row) => row.label ?? row.date);
    insertChartLegend(card, canvas, createChartLegend(canvas, activeMistakeTypes.map((type, index) => ({ label: type.label, color: colors[index] }))));
    queueChartRender(canvas, {
        type: "line",
        data: {
            labels,
            datasets: activeMistakeTypes.map((type, index) => {
                const color = colors[index % colors.length];
                return {
                    label: type.label,
                    data: rows.map((row) => safeNumber(row.countsByType?.[type.id], 0)),
                    borderColor: theme.page,
                    backgroundColor: chartColorWithAlpha(color, 0.85),
                    fill: index === 0 ? "origin" : "-1",
                    tension: 0.28,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: color,
                    borderWidth: 1,
                    stack: "mistake-types"
                };
            })
        },
        options: getDefaultChartOptions({
            interaction: { intersect: false, mode: "index" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${attemptCount(context.raw)} selection${safeNumber(context.raw, 0) === 1 ? "" : "s"}`,
                        footer: (items) => {
                            const index = items?.[0]?.dataIndex ?? -1;
                            const row = rows[index];
                            return row ? `Total: ${attemptCount(row.totalSelections)} selected tag${safeNumber(row.totalSelections, 0) === 1 ? "" : "s"}` : "";
                        }
                    }
                }
            },
            scales: {
                x: chartAxis(theme, { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, autoSkipPadding: 16 } }),
                y: chartAxis(theme, { stacked: true, min: 0, title: { display: true, text: "Selected mistake tags", color: theme.textSecondary, font: { family: theme.fontSans, size: 11 } }, ticks: { precision: 0 } })
            }
        })
    });
    return card;
};

const renderChartGrid = (metrics, actions, pages) => {
    const grid = createElement("section", "dashboard-chart-grid");
    grid.append(
        renderTrendChart(metrics),
        renderSectionMasteryChart(metrics),
        renderTopicWeaknessChart(metrics, actions, pages),
        renderSkillPerformanceChart(metrics, actions, pages),
        renderConfidenceChart(metrics),
        renderTimingChart(metrics),
        renderMistakeTypeChart(metrics),
        renderMistakeTypeTrendChart(metrics)
    );
    return grid;
};

const getMatrixSections = (metrics) => {
    const matrix = metrics.weakness.topicSkillMatrix;
    if (Array.isArray(matrix)) return matrix;
    return [{
        sectionId: metrics.filters.sectionId,
        skills: SCIENCE_SKILLS.filter((skill) => (matrix?.skillIds ?? []).includes(skill.id)),
        rows: matrix?.rows ?? []
    }];
};

const getMatrixSkills = (metrics) => {
    const filterSection = metrics.filters.sectionId;
    if (["cp", "bb", "ps"].includes(filterSection)) return SCIENCE_SKILLS;
    const usedIds = new Set(getMatrixSections(metrics).flatMap((matrix) => (matrix.skills ?? []).map((skill) => typeof skill === "string" ? skill : skill.id)));
    return SCIENCE_SKILLS.filter((skill) => usedIds.has(skill.id));
};

const createTableHeader = ({ title, subtitle = "", pagination = null }) => {
    const header = createElement("div", "dashboard-section-header");
    const titleWrap = createElement("div", "dashboard-table-title");
    appendText(titleWrap, "h2", "", title);
    if (subtitle) appendText(titleWrap, "p", "", subtitle);
    header.append(titleWrap);
    if (pagination) header.append(pagination);
    return header;
};

const appendCell = (row, text, className = "") => appendText(row, "td", className, text);

const appendHeaderCells = (row, columns) => {
    columns.forEach(([label, className = ""]) => {
        const th = createElement("th", className);
        th.scope = "col";
        if (className.includes("table-action")) appendText(th, "span", "visually-hidden", label);
        else th.textContent = label;
        row.append(th);
    });
};

const sectionAbbreviation = (sectionId) => createElement("span", "table-section-abbr", rowNameFromId("section", sectionId));

const renderHeatmap = (metrics, actions, pages) => {
    const matrixSections = getMatrixSections(metrics);
    const skills = getMatrixSkills(metrics);
    const allRows = matrixSections.filter((matrix) => metrics.filters.sectionId === "all" || matrix.sectionId === metrics.filters.sectionId).flatMap((matrix) => (matrix.rows ?? []).map((row) => ({ ...row, matrixSkills: matrix.skills ?? [] })));
    const pageInfo = getPaginatedRows(allRows, pages, "heatmap", COMPACT_PAGE_SIZE);
    const rows = pageInfo.rows;
    const card = createElement("section", "dashboard-heatmap-card");
    const pagination = createPaginationControls({ key: "heatmap", pageInfo, actions });
    card.append(createTableHeader({ title: "Topic-skill heatmap", subtitle: "Each cell is a drillable topic-skill pair. Darker cells have higher weakness priority. Low sample cells are marked as early signal.", pagination }));
    if (!rows.length || !skills.length) { appendText(card, "p", "tiny", "No topic-skill pairs match the active filters yet."); return card; }
    const priorities = allRows.flatMap((row) => (row.cells ?? []).filter(Boolean).map((cell) => safeNumber(cell.priorityScore, 0)));
    const minPriority = priorities.length ? Math.min(...priorities) : 0;
    const maxPriority = priorities.length ? Math.max(...priorities) : 0;
    const normalize = (value) => maxPriority > minPriority ? (safeNumber(value, 0) - minPriority) / (maxPriority - minPriority) : 0.5;
    const wrap = createElement("div", "table-wrap heatmap-wrap");
    const table = document.createElement("table");
    table.className = "heatmap-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    appendText(headerRow, "th", "", "Topic").scope = "col";
    skills.forEach((skill) => {
        const th = createElement("th", "heatmap-skill-header");
        th.scope = "col";
        appendWrappedLabel(th, skill.shortName, 28);
        headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
        const tr = document.createElement("tr");
        const topicCell = document.createElement("th");
        topicCell.scope = "row";
        topicCell.append(sectionAbbreviation(row.sectionId ?? topicSectionId(row.topicId)), document.createTextNode(rowNameFromId("topic", row.topicId)));
        tr.append(topicCell);
        skills.forEach((skill) => {
            const td = document.createElement("td");
            const cell = row.cells.find((item) => item?.skillId === skill.id) ?? null;
            if (!cell) {
                const empty = createElement("span", "heatmap-empty", "No attempts");
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
                const intensity = cb.numb.constrain(normalize(cell.priorityScore), [0, 1]);
                button.style.setProperty("--heat-alpha", String(cb.numb.roundTo(0.1 + 0.78 * intensity, 0.01)));
                if (intensity > 0.6) button.classList.add("is-strong");
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

const renderWeakPairTable = (metrics, actions, pages) => {
    const card = createElement("section", "dashboard-table-card");
    const allPairs = metrics.weakness.topicSkillPairs;
    const pageInfo = getPaginatedRows(allPairs, pages, "weakPairs");
    const pagination = createPaginationControls({ key: "weakPairs", pageInfo, actions });
    card.append(createTableHeader({ title: "Weakest topic-skill pairs", subtitle: "Ranked by priority score. Use Drill to turn a weakness into a prefilled practice generation.", pagination }));
    const pairs = pageInfo.rows;
    if (!allPairs.length) { appendText(card, "p", "tiny", "Not enough paired topic-skill data yet."); return card; }
    const wrap = createElement("div", "table-wrap");
    const table = document.createElement("table");
    table.className = "weak-pairs-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    appendHeaderCells(headerRow, [["Section"], ["Topic"], ["Skill"], ["Attempts", "table-num"], ["Accuracy", "table-num"], ["Mastery", "table-num"], ["Time", "table-num"], ["Signal"], ["Action", "table-action"]]);
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    pairs.forEach((pair) => {
        const row = document.createElement("tr");
        const sectionId = pair.sectionId ?? topicSectionId(pair.topicId);
        const timed = pair.timeRatio > 1.12;
        appendCell(row, rowNameFromId("section", sectionId));
        appendCell(row, rowNameFromId("topic", pair.topicId), "table-name");
        appendCell(row, rowNameFromId("skill", pair.skillId), "table-meta");
        appendCell(row, attemptCount(pair.attempts), "table-num");
        appendCell(row, pct(pair.accuracy), "table-num");
        appendCell(row, `${score(pair.mastery)}/100`, "table-num");
        appendCell(row, seconds(pair.averageElapsedMs), "table-num");
        appendCell(row, pair.signalStrength, "table-meta");
        const action = createElement("td", "table-action");
        action.append(createActionButton("Drill", createDrillConfig({ sectionId, topicId: pair.topicId, skillId: pair.skillId, timed }), actions));
        row.append(action);
        tbody.append(row);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const renderRecentMisses = (metrics, actions, pages) => {
    const card = createElement("section", "dashboard-table-card");
    const allMisses = metrics.recent.misses;
    const pageInfo = getPaginatedRows(allMisses, pages, "recentMisses");
    const pagination = createPaginationControls({ key: "recentMisses", pageInfo, actions });
    card.append(createTableHeader({ title: "Recent missed questions", pagination }));
    const misses = pageInfo.rows;
    if (!allMisses.length) { appendText(card, "p", "tiny", "No missed questions match the active filters."); return card; }
    const wrap = createElement("div", "table-wrap recent-misses-wrap");
    const table = document.createElement("table");
    table.className = "recent-misses-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    appendHeaderCells(headerRow, [["When"], ["Section"], ["Topic"], ["Skill"], ["Confidence", "table-num"], ["Time", "table-num"], ["Action", "table-action"]]);
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    misses.forEach((attempt) => {
        const row = document.createElement("tr");
        const firstTopic = attempt.topicIds?.[0];
        const firstSkill = attempt.skillIds?.[0];
        const sectionId = attempt.sectionId ?? topicSectionId(firstTopic);
        const timed = attempt.timeRatio > 1.12 || attempt.timingMode === "timed";
        appendCell(row, attempt.answeredAt ? new Date(attempt.answeredAt).toLocaleDateString() : "n/a", "table-meta");
        appendCell(row, rowNameFromId("section", sectionId));
        appendCell(row, rowNameFromId("topic", firstTopic), "table-name");
        appendCell(row, rowNameFromId("skill", firstSkill), "table-meta");
        appendCell(row, typeof attempt.confidence === "number" ? `${attempt.confidence}/5` : "n/a", "table-num");
        appendCell(row, formatDurationMs(attempt.elapsedMs), "table-num");
        const action = createElement("td", "table-action");
        action.append(createActionButton("Drill", createDrillConfig({ sectionId, topicId: firstTopic, skillId: firstSkill, timed }), actions));
        row.append(action);
        tbody.append(row);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const renderRecentSessions = (metrics, actions, pages, resumableSessionId = null, reviewableSessionIds = new Set()) => {
    const card = createElement("section", "dashboard-table-card dashboard-recent-sessions-card");
    const allSessions = metrics.recent.sessions;
    const pageInfo = getPaginatedRows(allSessions, pages, "recentSessions");
    const pagination = createPaginationControls({ key: "recentSessions", pageInfo, actions });
    card.append(createTableHeader({ title: "Recent sessions", pagination }));
    const sessions = pageInfo.rows;
    if (!allSessions.length) { appendText(card, "p", "tiny", "No completed or attempted sessions match the active filters."); return card; }
    const wrap = createElement("div", "table-wrap recent-sessions-wrap");
    const table = document.createElement("table");
    table.className = "recent-sessions-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    appendHeaderCells(headerRow, [["When"], ["Section"], ["Mode"], ["Answered", "table-num"], ["Accuracy", "table-num"], ["Avg time", "table-num"], ["Action", "table-action"]]);
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    sessions.forEach((session) => {
        const row = document.createElement("tr");
        appendCell(row, session.completedAt || session.createdAt ? new Date(session.completedAt ?? session.createdAt).toLocaleDateString() : "n/a", "table-meta");
        appendCell(row, rowNameFromId("section", session.sectionId));
        appendCell(row, session.timingMode, "table-meta");
        appendCell(row, `${session.attempts}/${session.generatedQuestionCount || session.attempts}`, "table-num");
        appendCell(row, pct(session.accuracy), "table-num");
        appendCell(row, formatDurationMs(session.averageElapsedMs), "table-num");
        const action = createElement("td", "table-action");
        action.append(createActionButton("Drill", createSessionDrillConfig(session), actions));
        if (reviewableSessionIds.has(session.id)) { const review = createElement("button", "btn btn-secondary btn-compact", "Review"); review.type = "button"; review.addEventListener("click", () => actions.openSessionReview(session.id)); action.append(review); }
        if (session.id === resumableSessionId) { const resume = createElement("button", "btn btn-secondary btn-compact", "Resume"); resume.type = "button"; resume.addEventListener("click", () => actions.resumeSession()); action.append(resume); }
        row.append(action);
        tbody.append(row);
    });
    table.append(tbody);
    wrap.append(table);
    card.append(wrap);
    return card;
};

const createMistakeMix = (rows = []) => {
    const list = createElement("div", "mistake-breakdown-chip-list");
    const activeRows = (Array.isArray(rows) ? rows : []).filter((row) => safeNumber(row.count, 0) > 0).slice(0, 3);
    if (!activeRows.length) { appendText(list, "span", "tiny", "No tagged mix yet"); return list; }
    activeRows.forEach((row) => { const chip = createElement("span", "mistake-breakdown-chip", `${row.label ?? row.id} ${attemptCount(row.count)}`); list.append(chip); });
    return list;
};

const renderMistakeBreakdownTable = ({ rows, type, metrics, actions }) => {
    const wrap = createElement("div", "table-wrap mistake-breakdown-table-wrap");
    const table = document.createElement("table");
    table.className = "mistake-breakdown-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    [type === "topic" ? "Topic" : "Skill", "Tagged / missed", "Dominant mistake", "Top mistake mix", "Action"].forEach((label, index) => {
        if (index === 4) { const th = createElement("th", "table-action"); th.scope = "col"; appendText(th, "span", "visually-hidden", label); headerRow.append(th); return; }
        if (index !== 1) { const th = appendText(headerRow, "th", "", label); th.scope = "col"; return; }
        const countHeader = createElement("th", "mistake-breakdown-count-header table-num");
        countHeader.scope = "col";
        appendText(countHeader, "span", "", "Tagged /");
        appendText(countHeader, "span", "", "Missed");
        headerRow.append(countHeader);
    });
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
        const tr = document.createElement("tr");
        const label = type === "topic" ? topicLabelWithSection(row.topicId ?? row.id, row.sectionId) : rowNameFromId("skill", row.skillId ?? row.id);
        appendText(tr, "th", "", label).scope = "row";
        appendText(tr, "td", "table-num", `${attemptCount(row.taggedIncorrectAttemptCount)} / ${attemptCount(row.incorrectAttemptCount)}`);
        const dominant = row.dominantMistakeTypeLabel ? `${row.dominantMistakeTypeLabel} · ${pct(row.dominantMistakeRate)}` : "n/a";
        appendText(tr, "td", "", dominant);
        const mixCell = document.createElement("td");
        mixCell.append(createMistakeMix(row.rows));
        tr.append(mixCell);
        const action = createElement("td", "table-action");
        action.append(createActionButton("Drill", createMistakeBreakdownDrillConfig({ row, type, metrics }), actions));
        tr.append(action);
        tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    return wrap;
};

const renderMistakeBreakdownPanel = ({ title, rows, pageKey, type, metrics, actions, pages, emptyText }) => {
    const panel = createElement("section", "mistake-breakdown-panel");
    const header = createElement("div", "mistake-breakdown-panel-header");
    appendText(header, "h3", "", title);
    const pageInfo = getPaginatedRows(rows, pages, pageKey, COMPACT_PAGE_SIZE);
    const pagination = createPaginationControls({ key: pageKey, pageInfo, actions });
    if (pagination) header.append(pagination);
    panel.append(header);
    if (!rows.length) { appendText(panel, "p", "tiny mistake-breakdown-empty", emptyText); return panel; }
    panel.append(renderMistakeBreakdownTable({ rows: pageInfo.rows, type, metrics, actions }));
    return panel;
};

const renderMistakeBreakdown = (metrics, actions, pages) => {
    const card = createElement("section", "dashboard-mistake-breakdown-card");
    card.append(createTableHeader({ title: "Mistake patterns by topic and skill", subtitle: "Shows where optional self-reported mistake tags concentrate inside the active dashboard filters. Counts can be fractional when one question tests multiple topics or skills." }));
    const topics = metrics.mistakes?.byTopic ?? [];
    const skills = metrics.mistakes?.bySkill ?? [];
    if (!topics.length && !skills.length) { appendText(card, "p", "tiny mistake-breakdown-empty", "Tag incorrect questions on the Review page to see topic and skill mistake patterns here."); return card; }
    const grid = createElement("div", "mistake-breakdown-grid");
    grid.append(
        renderMistakeBreakdownPanel({
            title: "By topic",
            rows: topics,
            pageKey: "mistakeTopics",
            type: "topic",
            metrics,
            actions,
            pages,
            emptyText: "No tagged topic-level mistakes match this dashboard slice."
        }),
        renderMistakeBreakdownPanel({
            title: "By skill",
            rows: skills,
            pageKey: "mistakeSkills",
            type: "skill",
            metrics,
            actions,
            pages,
            emptyText: "No tagged skill-level mistakes match this dashboard slice."
        })
    );
    card.append(grid);
    return card;
};

const renderTables = (metrics, actions, pages) => [renderWeakPairTable(metrics, actions, pages), renderRecentMisses(metrics, actions, pages)];

const filtersAreActive = (filters) => filters.range !== "all" || filters.sectionId !== "all" || filters.timingMode !== "all" || filters.reviewMode !== "all";

export const renderDashboardView = (state, actions) => {
    destroyCharts();
    const root = document.createElement("section");
    root.className = "dashboard-page is-bleed";
    const analytics = state.analytics;
    const metrics = analytics?.metrics;
    const filters = metrics?.filters ?? state.dashboard.filters;
    const pages = state.dashboard?.pages ?? {};
    root.append(renderDashboardHero(metrics, actions));
    if (!metrics || !metrics.totals.totalAttemptsStored) { root.append(renderEmptyState(actions, false)); appendDashboardModals(root, state, actions); return root; }
    root.append(renderFilterBar(filters, actions));
    if (!metrics.totals.totalQuestionsAnswered) { root.append(renderEmptyState(actions, filtersAreActive(filters))); appendDashboardModals(root, state, actions); return root; }
    const body = createElement("div", "dashboard-body frame");
    const topRow = createElement("div", "dashboard-top-row");
    topRow.append(renderRecommendationCard(analytics.recommendation, actions));
    const bottomRow = createElement("div", "dashboard-bottom-row");
    bottomRow.append(renderRecentSessions(metrics, actions, pages, getResumableInfo(state)?.id ?? null, new Set((analytics.sessions ?? []).filter(isReviewableSession).map((session) => session.id))), renderModelUsageChart(metrics, actions, pages));
    body.append(
        renderSummaryGrid(metrics, analytics.recommendation),
        topRow,
        renderChartGrid(metrics, actions, pages),
        renderHeatmap(metrics, actions, pages),
        renderMistakeBreakdown(metrics, actions, pages),
        ...renderTables(metrics, actions, pages),
        bottomRow
    );
    root.append(body);
    appendDashboardModals(root, state, actions);
    return root;
};
