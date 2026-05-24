import { createProgressBar } from "../components/progress.js";
import { QUESTION_BANKS } from "../data/bank/catalog.js";
import { SCIENCE_SKILLS, TOPICS } from "../data/taxonomy.js";

const cb = Chalkboard;
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
const skillsById = Object.fromEntries(SCIENCE_SKILLS.map((skill) => [skill.id, skill]));

const createElement = (tag, className = "", text = "") => { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; };

const appendText = (parent, tag, className, text) => { const element = createElement(tag, className, text); parent.append(element); return element; };

const safeNumber = (value, fallback = 0) => { const number = Number(value); return Number.isFinite(number) ? number : fallback; };

const round = (num, places = 0.01) => {
    const rounded = cb.numb.roundTo(safeNumber(num), safeNumber(places));
    const str = Math.abs(safeNumber(places)).toString().toLowerCase();
    let decimalPlaces = 0;
    if (str.includes("e-")) {
        const [coefficient, exponent] = str.split("e-");
        const coefficientDecimals = coefficient.split(".")[1]?.length ?? 0;
        decimalPlaces = Number(exponent) + coefficientDecimals;
    } else if (!str.includes("e+")) decimalPlaces = str.split(".")[1]?.length ?? 0;
    return Number(rounded.toFixed(decimalPlaces));
};

const pct = (value) => Number.isFinite(value) ? `${round(value * 100, 0.1)}%` : "n/a";

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : "Never";

const makeMetric = (label, value, hint = "") => {
    const item = createElement("div", "question-bank-metric");
    appendText(item, "span", "tiny", label);
    appendText(item, "strong", "", value);
    if (hint) appendText(item, "em", "", hint);
    return item;
};

const formatTopicPreview = (topicIds = []) => {
    const labels = topicIds.map((topicId) => topicsById[topicId]?.shortName ?? topicsById[topicId]?.name ?? topicId).filter(Boolean);
    if (labels.length <= 5) return labels.join(", ");
    return `${labels.slice(0, 5).join(", ")}, +${labels.length - 5} more.`;
};

const formatSkillPreview = (skillIds = []) => skillIds.map((skillId) => skillsById[skillId]?.shortName ?? skillId).join(", ") + ".";

const makeQuestionCountSelect = ({ catalog, value, disabled, actions }) => {
    const label = createElement("label", "question-bank-count-field");
    appendText(label, "span", "tiny", "Session size");
    const select = document.createElement("select");
    select.disabled = disabled;
    (catalog.questionCountOptions ?? []).forEach((count) => {
        const option = document.createElement("option");
        option.value = String(count);
        option.textContent = `${count} questions`;
        if (Number(value) === count) option.selected = true;
        select.append(option);
    });
    select.addEventListener("change", () => actions.updateQuestionBankCount(catalog.sectionId, Number(select.value)));
    label.append(select);
    return label;
};

const renderBankMessage = (entry) => {
    if (!entry) return createElement("p", "tiny question-bank-message", "Loading should start automatically. Click Refresh if this stays empty.");
    if (entry.status === "error") return createElement("p", "danger-note question-bank-message", entry.error || "This question bank could not be loaded.");
    if (entry.status === "empty") return createElement("p", "warning-note question-bank-message", "This bank data is present but does not contain questions.");
    if (entry.warnings?.length) return createElement("p", "tiny question-bank-message", entry.warnings[0]);
    return null;
};

const renderBankCard = ({ catalog, entry, selectedCount, actions }) => {
    const card = createElement("article", "card card-pad question-bank-card");
    const header = createElement("div", "question-bank-card-header");
    const titleWrap = createElement("div");
    appendText(titleWrap, "h2", "", catalog.title);
    appendText(titleWrap, "p", "", catalog.description);
    header.append(titleWrap);
    card.append(header);
    const progress = entry?.progress ?? {
        targetQuestionCount: catalog.targetQuestionCount,
        loadedQuestionCount: 0,
        answeredCount: 0,
        remainingCount: 0,
        correctCount: 0,
        accuracy: null,
        lastPracticedAt: null
    };
    const progressLabel = createElement("p", "tiny question-bank-progress-label", `${progress.answeredCount} of ${progress.loadedQuestionCount || progress.targetQuestionCount} answered`);
    card.append(progressLabel, createProgressBar(progress.answeredCount, progress.loadedQuestionCount || progress.targetQuestionCount, `${catalog.shortName} question bank progress`));
    const metrics = createElement("div", "question-bank-metrics");
    metrics.append(
        makeMetric("Remaining", `${progress.remainingCount}`),
        makeMetric("Accuracy", pct(progress.accuracy), `${progress.correctCount} correct`),
        makeMetric("Last practiced", formatDate(progress.lastPracticedAt))
    );
    card.append(metrics);
    const scope = createElement("div", "question-bank-scope");
    appendText(scope, "p", "tiny", `Topics: ${formatTopicPreview(catalog.topicIds)}`);
    appendText(scope, "p", "tiny", `Skills: ${formatSkillPreview(catalog.skillIds)}`);
    card.append(scope);
    const message = renderBankMessage(entry);
    if (message) card.append(message);
    const controls = createElement("div", "question-bank-actions");
    const canStart = entry?.status === "ready" && progress.remainingCount > 0;
    controls.append(makeQuestionCountSelect({ catalog, value: selectedCount, disabled: !canStart, actions }));
    const start = document.createElement("button");
    start.type = "button";
    start.className = "btn btn-primary";
    start.textContent = progress.remainingCount > 0 ? `Start next ${selectedCount}` : "All answered";
    start.disabled = !canStart;
    start.addEventListener("click", () => actions.startQuestionBankSession({ sectionId: catalog.sectionId, questionCount: selectedCount }));
    controls.append(start);
    card.append(controls);
    return card;
};

const renderHero = (actions, loading) => {
    const hero = createElement("section", "hero question-bank-hero");
    const copy = createElement("div", "question-bank-hero-copy");
    appendText(copy, "h1", "", "Question bank");
    appendText(copy, "p", "", "Start practicing immediately with 300 pregenerated questions. No payment required.");
    const actionsWrap = createElement("div", "question-bank-hero-actions button-row");
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "btn btn-ghost";
    refresh.disabled = loading;
    refresh.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">sync</span> Refresh';
    refresh.addEventListener("click", () => actions.refreshQuestionBank({ clearCache: true }));
    const generate = document.createElement("button");
    generate.type = "button";
    generate.className = "btn btn-secondary";
    generate.textContent = "Generate your own";
    generate.addEventListener("click", () => actions.navigate("generator"));
    actionsWrap.append(refresh, generate);
    hero.append(copy, actionsWrap);
    return hero;
};

export const renderQuestionBankView = (state, actions) => {
    const root = createElement("section", "question-bank-page");
    const bankState = state.questionBank ?? {};
    root.append(renderHero(actions, Boolean(bankState.loading)));
    if (bankState.error) root.append(createElement("p", "danger-note question-bank-global-error", bankState.error));
    const grid = createElement("section", "question-bank-grid");
    QUESTION_BANKS.forEach((catalog) => {
        const selectedCount = bankState.selectedCounts?.[catalog.sectionId] ?? catalog.defaultQuestionCount;
        const entry = bankState.entries?.[catalog.sectionId] ?? (bankState.loading ? { status: "loading", catalog } : null);
        grid.append(renderBankCard({ catalog, entry, selectedCount, actions }));
    });
    root.append(grid);
    return root;
};
