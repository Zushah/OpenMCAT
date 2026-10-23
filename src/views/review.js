import { createHighlightableText, getQuestionHighlightScopeKey, getQuestionStemHighlightKey } from "../components/highlights.js";
import { appendStimulusContent, createPassageCard, createPassageMetadataById, createStaticChoiceList, getPassageCardTitle } from "../components/questions.js";
import { renderStimulusCharts } from "../components/charts.js";
import { MISTAKE_TYPES, normalizeMistakeTypeIds } from "../data/mistakes.js";
import { formatDurationMs } from "../components/timer.js";
import { icon } from "../components/icons.js";
import { REVIEW_MODES, TIMING_MODES } from "../data/defaults.js";
import { getHashParams } from "../router.js";
import { buildReviewDrillConfig } from "../analytics/drill.js";
import { matchesReviewFilter } from "../storage/progress.js";

const cb = Chalkboard;

const isQuestionBankSession = (activeSession) => activeSession?.providerMeta?.source === "question_bank" || activeSession?.generatedSession?.bank?.source === "question_bank";

const summarize = (activeSession) => {
    const questions = activeSession.generatedSession.questions;
    const states = activeSession.questionStateById;
    const records = questions.map((question) => ({ question, state: states[question.id] }));
    const answered = records.filter((record) => record.state.submitted);
    const correct = answered.filter((record) => record.state.isCorrect).length;
    const elapsedMs = answered.reduce((sum, record) => sum + (record.state.elapsedMs ?? 0), 0);
    return {
        total: questions.length,
        answered: answered.length,
        incomplete: questions.length - answered.length,
        correct,
        accuracy: answered.length ? correct / answered.length : 0,
        elapsedMs,
        avgMs: answered.length ? elapsedMs / answered.length : 0
    };
};

const makeSummaryCard = (label, value, hint = "") => {
    const card = document.createElement("article");
    card.className = "stat-card";
    const title = document.createElement("h3");
    title.textContent = label;
    const text = document.createElement("p");
    text.className = "stat-value";
    text.textContent = value;
    card.append(title, text);
    if (hint) {
        const helper = document.createElement("p");
        helper.className = "stat-hint";
        helper.textContent = hint;
        card.append(helper);
    }
    return card;
};

const makeFilterButton = (label, filterId, currentFilter, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    const selected = filterId === currentFilter;
    if (selected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.addEventListener("click", onClick);
    return button;
};

const makeMistakeTypePanel = (questionId, qState, actions) => {
    const selectedIds = new Set(normalizeMistakeTypeIds(qState.mistakeTypeIds));
    const panel = document.createElement("aside");
    panel.className = "mistake-type-panel";
    const heading = document.createElement("h5");
    heading.textContent = "What went wrong?";
    const note = document.createElement("p");
    note.className = "tiny";
    note.textContent = "Optional. Select all that apply.";
    const chipList = document.createElement("div");
    chipList.className = "mistake-type-chip-list";
    MISTAKE_TYPES.forEach((mistakeType) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mistake-type-chip";
        button.textContent = mistakeType.label;
        const selected = selectedIds.has(mistakeType.id);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        if (selected) button.classList.add("is-selected");
        button.addEventListener("click", () => actions.toggleMistakeTypeForQuestion(questionId, mistakeType.id));
        chipList.append(button);
    });
    panel.append(heading, note, chipList);
    return panel;
};

const getIncorrectReviewRows = (root) => {
    const rows = Array.from(root?.querySelectorAll?.(".review-question-row.is-incorrect") ?? []);
    if (root?.matches?.(".review-question-row.is-incorrect")) rows.unshift(root);
    return rows;
};

const syncMistakeTypePanelHeights = (root) => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    window.requestAnimationFrame(() => {
        const shouldSync = typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 1025px)").matches;
        getIncorrectReviewRows(root).forEach((row) => {
            const questionCard = row.querySelector(".review-question");
            const mistakePanel = row.querySelector(".mistake-type-panel");
            if (!questionCard || !mistakePanel) return;
            mistakePanel.style.height = "";
            if (!shouldSync) return;
            const questionHeight = Math.ceil(questionCard.getBoundingClientRect().height);
            if (questionHeight > 0) mistakePanel.style.height = `${questionHeight}px`;
        });
    });
};

const createReviewPassageDropdown = (passage, passageMetadata = {}, highlightRangesByTargetKey = {}) => {
    const details = document.createElement("details");
    details.className = "review-passage-dropdown";
    const summary = document.createElement("summary");
    summary.className = "review-passage-summary";
    const label = document.createElement("span");
    const passageTitle = getPassageCardTitle(passage, passageMetadata);
    label.textContent = `Show ${passageTitle}`;
    const expandIcon = document.createElement("span");
    expandIcon.className = "review-passage-icon";
    expandIcon.append(icon("chevron-down", { size: 14 }));
    summary.append(label, expandIcon);
    details.append(summary, createPassageCard(passage, { className: "passage-card review-passage-card", ...passageMetadata, highlightRangesByTargetKey, deferCharts: true }));
    details.addEventListener("toggle", () => {
        label.textContent = details.open ? `Hide ${passageTitle}` : `Show ${passageTitle}`;
        expandIcon.replaceChildren(icon(details.open ? "chevron-up" : "chevron-down", { size: 14 }));
        if (details.open) renderStimulusCharts(details);
        syncMistakeTypePanelHeights(details.closest(".review-question-row") ?? details);
    });
    return details;
};

const appendReviewExplanation = (card, question, state) => {
    const explanation = document.createElement("section");
    const verdictClass = state.submitted ? state.isCorrect ? "is-correct" : "is-incorrect" : "is-unanswered";
    explanation.className = `explanation-panel ${verdictClass}`;
    explanation.setAttribute("aria-label", "Explanation");
    const text = document.createElement("p");
    text.className = "explanation-text";
    text.textContent = question.explanation;
    explanation.append(text);
    const choiceNotes = document.createElement("ul");
    choiceNotes.className = "choice-explanations";
    ["A", "B", "C", "D"].forEach((choiceId) => {
        const li = document.createElement("li");
        const letter = document.createElement("strong");
        letter.textContent = choiceId;
        const note = document.createElement("span");
        note.textContent = question.choiceExplanations?.[choiceId] ?? "";
        li.append(letter, note);
        choiceNotes.append(li);
    });
    explanation.append(choiceNotes);
    card.append(explanation);
};

const makeQuestionReviewBlock = (record, index, isFocused, passagesById, passageMetadataById, highlightRangesByTargetKey, actions) => {
    const { question, state } = record;
    const card = document.createElement("article");
    const resultClass = state.submitted ? state.isCorrect ? "is-correct" : "is-incorrect" : "is-unanswered";
    card.className = `review-question ${resultClass}`;
    card.dataset.reviewIndex = String(index);
    if (isFocused) card.classList.add("is-focused");
    const selected = state.submitted ? state.submittedChoiceId ?? state.selectedChoiceId ?? "Unsubmitted" : "Unsubmitted";
    const verdict = state.submitted ? state.isCorrect ? "Correct" : "Incorrect" : "Unsubmitted";
    const meta = document.createElement("p");
    meta.className = "tiny review-question-meta";
    const verdictText = document.createElement("strong");
    verdictText.className = "review-verdict";
    verdictText.textContent = verdict;
    meta.append(`Selected: ${selected} | Correct: ${question.correctChoiceId} | `, verdictText, ` | ${formatDurationMs(state.elapsedMs ?? 0)}`);
    card.append(meta);
    const heading = document.createElement("h4");
    const number = document.createElement("span");
    number.className = "review-question-number";
    number.textContent = `Q${index + 1}. `;
    heading.append(number);
    const questionHighlightKey = getQuestionStemHighlightKey(question.id);
    heading.append(createHighlightableText({
        tagName: "span",
        className: "review-question-stem",
        text: question.stem,
        targetKey: questionHighlightKey,
        scopeKey: getQuestionHighlightScopeKey(question.id),
        ranges: highlightRangesByTargetKey[questionHighlightKey] ?? []
    }));
    card.append(heading);
    appendStimulusContent(card, question, {
        surface: "question",
        ownerId: question.id,
        scopeKey: getQuestionHighlightScopeKey(question.id),
        highlightRangesByTargetKey
    });
    card.append(createStaticChoiceList(question, { selectedId: state.submitted ? state.submittedChoiceId ?? state.selectedChoiceId : null, submitted: true }));
    appendReviewExplanation(card, question, state);
    if (state.flagged) {
        const flagged = document.createElement("p");
        flagged.className = "warning-note";
        flagged.textContent = "Flagged for review during the session.";
        card.append(flagged);
    }
    const passage = question.passageId ? passagesById.get(question.passageId) : null;
    if (passage) card.append(createReviewPassageDropdown(passage, passageMetadataById.get(passage.id) ?? {}, highlightRangesByTargetKey));
    if (!state.submitted || state.isCorrect) return card;
    const row = document.createElement("div");
    row.className = "review-question-row is-incorrect";
    if (isFocused) row.classList.add("is-focused");
    row.append(card, makeMistakeTypePanel(question.id, state, actions));
    return row;
};

const formatModeLabel = (list, id, fallback) => list.find((item) => item.id === id)?.label ?? fallback;

export const renderReviewView = (state, actions) => {
    const root = document.createElement("section");
    root.className = "review-page";
    const activeSession = state.activeSession;
    if (!activeSession) {
        const empty = document.createElement("section");
        empty.className = "empty-state review-empty-state";
        const heading = document.createElement("h2");
        heading.textContent = "No session to review";
        const text = document.createElement("p");
        text.textContent = getHashParams(location.hash).has("session") ? "That session was not found." : "Complete a practice session first, then return here for full review.";
        const button = document.createElement("button");
        button.className = "btn btn-primary";
        button.textContent = "Go to generator";
        button.addEventListener("click", () => actions.navigate("generator"));
        empty.append(heading, text, button);
        root.append(empty);
        return root;
    }
    const summary = summarize(activeSession);
    const accuracyText = `${cb.numb.roundTo(summary.accuracy * 100, 0.1)}%`;
    const headingWrap = document.createElement("header");
    headingWrap.className = "review-header";
    const heading = document.createElement("h2");
    heading.textContent = "Session review";
    const sub = document.createElement("p");
    sub.className = "review-session-title";
    sub.textContent = activeSession.generatedSession.session.title;
    const scoreLine = document.createElement("p");
    scoreLine.className = "review-score-line";
    const correct = document.createElement("strong");
    correct.textContent = String(summary.correct);
    const accuracy = document.createElement("strong");
    accuracy.textContent = accuracyText;
    scoreLine.append(correct, ` of ${summary.answered} correct · `, accuracy);
    const when = activeSession.completedAt ?? activeSession.createdAt;
    const metaLine = document.createElement("p");
    metaLine.className = "review-meta-line";
    metaLine.textContent = [when ? new Date(when).toLocaleDateString() : null, formatModeLabel(TIMING_MODES, activeSession.config?.timingMode, null), formatModeLabel(REVIEW_MODES, activeSession.config?.reviewMode, null)].filter(Boolean).join(" · ");
    const note = document.createElement("p");
    note.className = "muted-note";
    note.textContent = "AI-generated. Use for drilling and review. Verify uncertain explanations.";
    headingWrap.append(heading, sub, scoreLine);
    if (metaLine.textContent) headingWrap.append(metaLine);
    headingWrap.append(note);
    root.append(headingWrap);
    const summaryGrid = document.createElement("section");
    summaryGrid.className = "summary-grid review-summary";
    summaryGrid.setAttribute("aria-label", "Session summary");
    summaryGrid.append(
        makeSummaryCard("Score", `${summary.correct}/${summary.answered}`, summary.incomplete ? `${summary.incomplete} unsubmitted` : "All submitted"),
        makeSummaryCard("Accuracy", accuracyText),
        makeSummaryCard("Total Time", formatDurationMs(summary.elapsedMs)),
        makeSummaryCard("Avg / Question", formatDurationMs(summary.avgMs))
    );
    root.append(summaryGrid);
    const controls = document.createElement("div");
    controls.className = "review-controls";
    const filters = document.createElement("div");
    filters.className = "segment";
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Review filter");
    filters.append(
        makeFilterButton("All", "all", activeSession.reviewFilter, () => actions.setReviewFilter("all")),
        makeFilterButton("Incorrect only", "incorrect", activeSession.reviewFilter, () => actions.setReviewFilter("incorrect")),
        makeFilterButton("Flagged only", "flagged", activeSession.reviewFilter, () => actions.setReviewFilter("flagged"))
    );
    const navHint = document.createElement("p");
    navHint.className = "tiny";
    navHint.textContent = "Review shortcuts: Left/Right arrows move focus.";
    controls.append(filters, navHint);
    root.append(controls);
    const passagesById = new Map((activeSession.generatedSession.passages ?? []).map((passage) => [passage.id, passage]));
    const passageMetadataById = createPassageMetadataById(activeSession.generatedSession.passages ?? [], activeSession.generatedSession.questions);
    const highlightRangesByTargetKey = activeSession.highlightRangesByTargetKey ?? {};
    const records = activeSession.generatedSession.questions.map((question, index) => ({ question, state: activeSession.questionStateById[question.id], index })).filter((record) => matchesReviewFilter(record.state, activeSession.reviewFilter));
    const reviewList = document.createElement("section");
    reviewList.className = "review-list";
    reviewList.setAttribute("aria-label", "Questions");
    if (!records.length) {
        const empty = document.createElement("p");
        empty.className = "review-empty";
        empty.textContent = "No questions match this filter.";
        reviewList.append(empty);
    } else {
        const focusedIndex = state.activeSession.viewQuestionIndex ?? 0;
        records.forEach((record) => { reviewList.append(makeQuestionReviewBlock(record, record.index, record.index === focusedIndex, passagesById, passageMetadataById, highlightRangesByTargetKey, actions)); });
    };
    root.append(reviewList);
    const actionRow = document.createElement("div");
    actionRow.className = "question-actions review-actions";
    const drillMissed = document.createElement("button");
    drillMissed.className = "btn btn-secondary";
    drillMissed.textContent = "Drill missed topics";
    drillMissed.addEventListener("click", () => {
        const config = buildReviewDrillConfig(activeSession);
        if (!config) { actions.navigate("generator"); return; }
        actions.applyDashboardDrill(config, { message: "Generator prefilled from this session's missed questions." });
    });
    actionRow.append(drillMissed);
    const dashboard = document.createElement("button");
    dashboard.className = "btn btn-primary";
    dashboard.textContent = "Back to dashboard";
    dashboard.addEventListener("click", () => actions.navigate("dashboard"));
    actionRow.append(dashboard);
    const newSession = document.createElement("button");
    newSession.className = "btn btn-ghost";
    newSession.textContent = "New session";
    newSession.addEventListener("click", () => actions.resetToNewSession());
    actionRow.append(newSession);
    if (isQuestionBankSession(activeSession)) {
        const bank = document.createElement("button");
        bank.className = "btn btn-ghost";
        bank.textContent = "Back to question bank";
        bank.addEventListener("click", () => actions.navigate("bank"));
        actionRow.append(bank);
    }
    root.append(actionRow);
    syncMistakeTypePanelHeights(root);
    return root;
};
