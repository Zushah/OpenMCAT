import { createProgressBar } from "../components/progress.js";
import { createHighlightableText, getQuestionHighlightScopeKey, getQuestionStemHighlightKey } from "../components/highlights.js";
import { createChoiceCard, createPassageCard, createPassageMetadataById } from "../components/questions.js";
import { formatDurationMs } from "../components/timer.js";

const cb = Chalkboard;

const computeTimerText = (mode, submitted, elapsedMs, maxMs) => {
    if (mode === "timed") {
        const remainingMs = maxMs - elapsedMs;
        if (remainingMs <= 0 && !submitted) return { text: `Time expired (${formatDurationMs(elapsedMs)} elapsed)`, expired: true };
        return { text: `Time left ${formatDurationMs(cb.stat.max([0, remainingMs]))}`, expired: false };
    }
    return { text: `Time elapsed ${formatDurationMs(elapsedMs)}`, expired: false };
};

const safeElapsedMs = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? cb.stat.max([0, number]) : 0;
};

export const updatePracticeTimerElement = (timerElement, nowMs = Date.now()) => {
    if (!timerElement) return;
    const mode = timerElement.dataset.timingMode || "untimed";
    const submitted = timerElement.dataset.submitted === "true";
    const startedAtMs = Number(timerElement.dataset.startedAtMs || nowMs);
    const storedElapsedMs = safeElapsedMs(timerElement.dataset.elapsedMs);
    const maxMs = Number(timerElement.dataset.maxMs || 0);
    const elapsedMs = submitted ? storedElapsedMs : storedElapsedMs + cb.stat.max([0, nowMs - startedAtMs]);
    const timerInfo = computeTimerText(mode, submitted, elapsedMs, maxMs);
    timerElement.textContent = timerInfo.text;
    timerElement.className = timerInfo.expired ? "danger-note session-timer-text" : "tiny session-timer-text";
};

export const updatePracticeTotalTimerElement = (timerElement, nowMs = Date.now()) => {
    if (!timerElement) return;
    const storedElapsedMs = safeElapsedMs(timerElement.dataset.elapsedMs);
    const currentQuestionSubmitted = timerElement.dataset.currentQuestionSubmitted === "true";
    const startedAtMs = Number(timerElement.dataset.startedAtMs || nowMs);
    const elapsedMs = currentQuestionSubmitted ? storedElapsedMs : storedElapsedMs + cb.stat.max([0, nowMs - startedAtMs]);
    timerElement.textContent = `Total time elapsed ${formatDurationMs(elapsedMs)}`;
    timerElement.className = "tiny session-timer-text";
};

const getStoredSessionElapsedMs = (activeSession) => Object.values(activeSession.questionStateById).reduce((sum, item) => sum + safeElapsedMs(item.elapsedMs), 0);

const getSubmittedChoiceId = (questionState) => questionState?.submittedChoiceId ?? (questionState?.submitted ? questionState.selectedChoiceId : null);

const hasPendingSubmission = (questionState) => {
    if (!questionState?.selectedChoiceId) return false;
    if (!questionState.submitted) return true;
    return questionState.selectedChoiceId !== getSubmittedChoiceId(questionState) || (questionState.confidence ?? null) !== (questionState.submittedConfidence ?? null);
};

const getPracticeRecords = (activeSession) => activeSession.generatedSession.questions.map((question, index) => ({
    question,
    index,
    state: activeSession.questionStateById[question.id]
}));

const getPracticeCounts = (activeSession) => {
    const records = getPracticeRecords(activeSession);
    const submitted = records.filter((record) => record.state?.submitted).length;
    const flagged = records.filter((record) => record.state?.flagged).length;
    const pending = records.filter((record) => hasPendingSubmission(record.state)).length;
    return {
        total: records.length,
        submitted,
        incomplete: records.length - submitted,
        flagged,
        pending
    };
};

const getQuestionStatusText = (questionState) => {
    if (questionState?.submitted) {
        const submittedChoiceId = getSubmittedChoiceId(questionState);
        if (questionState.selectedChoiceId && questionState.selectedChoiceId !== submittedChoiceId) return `Submitted ${submittedChoiceId}; draft ${questionState.selectedChoiceId}`;
        if ((questionState.confidence ?? null) !== (questionState.submittedConfidence ?? null)) return `Submitted ${submittedChoiceId}; confidence changed`;
        return `Submitted ${submittedChoiceId}`;
    }
    if (questionState?.selectedChoiceId) return `Draft ${questionState.selectedChoiceId}`;
    return "Incomplete";
};

const getQuestionStatusClass = (questionState) => {
    if (questionState?.submitted) return "is-submitted";
    if (questionState?.selectedChoiceId) return "is-draft";
    return "is-incomplete";
};

const makePill = (text, className = "") => {
    const pill = document.createElement("span");
    pill.className = `practice-status-pill ${className}`.trim();
    pill.textContent = text;
    return pill;
};

const makePanelTop = ({ title, headingId, closeLabel, onClose }) => {
    const top = document.createElement("div");
    top.className = "generation-pipeline-top";
    const heading = document.createElement("h2");
    heading.id = headingId;
    heading.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-ghost generation-pipeline-close";
    close.setAttribute("aria-label", closeLabel);
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
    close.addEventListener("click", onClose);
    top.append(heading, close);
    return top;
};

const makeNavigationFilterButton = (label, filterId, currentFilter, actions) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = filterId === currentFilter ? "btn btn-secondary" : "btn btn-ghost";
    button.textContent = label;
    button.addEventListener("click", () => actions.setNavigationFilter(filterId));
    return button;
};

const makeQuestionNavItem = (record, activeSession, actions) => {
    const { index, state } = record;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "practice-question-nav-item";
    if (index === activeSession.currentQuestionIndex) item.classList.add("is-current");
    if (state?.submitted) item.classList.add("is-submitted");
    else item.classList.add("is-incomplete");
    if (state?.flagged) item.classList.add("is-flagged");
    item.addEventListener("click", () => actions.goToQuestion(index));
    const top = document.createElement("span");
    top.className = "practice-question-nav-top";
    const number = document.createElement("strong");
    number.className = "practice-question-nav-number";
    number.textContent = `Question ${index + 1}`;
    const statuses = document.createElement("span");
    statuses.className = "practice-question-nav-statuses";
    statuses.append(makePill(getQuestionStatusText(state), getQuestionStatusClass(state)));
    if (state?.flagged) statuses.append(makePill("Flagged", "is-flagged"));
    top.append(number, statuses);
    item.append(top);
    return item;
};

const makeQuestionNavList = (activeSession, actions, { filter = "all" } = {}) => {
    const list = document.createElement("div");
    list.className = "practice-question-nav-list";
    const records = getPracticeRecords(activeSession).filter((record) => {
        if (filter === "incomplete") return !record.state?.submitted;
        if (filter === "flagged") return Boolean(record.state?.flagged);
        return true;
    });
    if (!records.length) {
        const empty = document.createElement("p");
        empty.className = "muted-note practice-panel-empty";
        empty.textContent = "No questions match this view.";
        list.append(empty);
        return list;
    }
    records.forEach((record) => list.append(makeQuestionNavItem(record, activeSession, actions)));
    return list;
};

const makePracticePanelStats = (counts) => {
    const stats = document.createElement("div");
    stats.className = "practice-panel-stats";
    [
        ["Total", counts.total],
        ["Submitted", counts.submitted],
        ["Incomplete", counts.incomplete],
        ["Flagged", counts.flagged]
    ].forEach(([label, value]) => {
        const item = document.createElement("article");
        item.className = "practice-panel-stat";
        const title = document.createElement("span");
        title.textContent = label;
        const text = document.createElement("strong");
        text.textContent = String(value);
        item.append(title, text);
        stats.append(item);
    });
    return stats;
};

const makeNavigationPanel = (activeSession, actions) => {
    if (!activeSession.navigationOpen) return null;
    const counts = getPracticeCounts(activeSession);
    const filter = activeSession.navigationFilter ?? "all";
    const overlay = document.createElement("section");
    overlay.className = "generation-pipeline-overlay practice-panel-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closePracticePanel(); });
    const panel = document.createElement("section");
    panel.className = "card card-pad generation-pipeline-panel practice-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "practice-navigation-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const instructions = document.createElement("p");
    instructions.className = "generation-pipeline-instructions practice-panel-instructions";
    instructions.textContent = "Jump to any question, review incomplete questions, or return to flagged questions.";
    const filters = document.createElement("div");
    filters.className = "button-row practice-panel-filters";
    filters.append(
        makeNavigationFilterButton("All", "all", filter, actions),
        makeNavigationFilterButton("Incomplete", "incomplete", filter, actions),
        makeNavigationFilterButton("Flagged", "flagged", filter, actions)
    );
    panel.append(
        makePanelTop({ title: "Navigation", headingId: "practice-navigation-heading", closeLabel: "Close navigation", onClose: () => actions.closePracticePanel() }),
        instructions,
        makePracticePanelStats(counts),
        filters,
        makeQuestionNavList(activeSession, actions, { filter })
    );
    overlay.append(panel);
    return overlay;
};

const makeFinalReviewPanel = (activeSession, actions) => {
    if (!activeSession.finalReviewOpen) return null;
    const counts = getPracticeCounts(activeSession);
    const overlay = document.createElement("section");
    overlay.className = "generation-pipeline-overlay practice-panel-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closePracticePanel(); });
    const panel = document.createElement("section");
    panel.className = "card card-pad generation-pipeline-panel practice-panel practice-review-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "practice-final-review-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const instructions = document.createElement("p");
    instructions.className = "generation-pipeline-instructions practice-panel-instructions";
    instructions.textContent = "Review your submitted, incomplete, and flagged questions before ending this session.";
    const note = document.createElement("p");
    note.className = counts.incomplete || counts.pending ? "warning-note practice-panel-note" : "muted-note practice-panel-note";
    if (counts.incomplete && counts.pending) note.textContent = "Incomplete questions and unsubmitted changes will not be saved as attempts or counted in analytics.";
    else if (counts.incomplete) note.textContent = "Incomplete questions will not be saved as attempts or counted in analytics.";
    else if (counts.pending) note.textContent = "Unsubmitted changes will not replace the last submitted answers.";
    else note.textContent = "All questions have submitted answers. You can still return to any flagged question before ending.";
    const row = document.createElement("div");
    row.className = "button-row practice-review-actions";
    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "btn btn-secondary";
    continueButton.textContent = "Continue practice";
    continueButton.addEventListener("click", () => actions.closePracticePanel());
    const endButton = document.createElement("button");
    endButton.type = "button";
    endButton.className = "btn btn-primary";
    endButton.textContent = "End session";
    endButton.addEventListener("click", () => actions.finishSession());
    row.append(continueButton, endButton);
    panel.append(
        makePanelTop({ title: "Review", headingId: "practice-final-review-heading", closeLabel: "Close review", onClose: () => actions.closePracticePanel() }),
        instructions,
        makePracticePanelStats(counts),
        note,
        makeQuestionNavList(activeSession, actions),
        row
    );
    overlay.append(panel);
    return overlay;
};

const appendChoiceExplanations = (panel, question) => {
    if (!question.choiceExplanations || typeof question.choiceExplanations !== "object") return;
    const list = document.createElement("ul");
    list.style.display = "grid";
    list.style.gap = "0.4rem";
    ["A", "B", "C", "D"].forEach((id) => {
        const item = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = `${id}: `;
        const text = document.createElement("span");
        text.textContent = question.choiceExplanations[id] ?? "";
        item.append(label, text);
        list.append(item);
    });
    panel.append(list);
};

export const renderPracticeView = (state, actions, nowMs) => {
    const root = document.createElement("section");
    const activeSession = state.activeSession;
    if (!activeSession) {
        const empty = document.createElement("section");
        empty.className = "card card-pad";
        const heading = document.createElement("h2");
        heading.textContent = "No active session";
        const text = document.createElement("p");
        text.textContent = "Generate a validated session or start from the question bank to begin practicing.";
        const row = document.createElement("div");
        row.className = "button-row";
        const button = document.createElement("button");
        button.className = "btn btn-primary";
        button.textContent = "Go to generator";
        button.addEventListener("click", () => actions.navigate("generator"));
        const bank = document.createElement("button");
        bank.className = "btn btn-secondary";
        bank.textContent = "Go to question bank";
        bank.addEventListener("click", () => actions.navigate("bank"));
        row.append(button, bank);
        empty.append(heading, text, row);
        root.append(empty);
        return root;
    }
    const questions = activeSession.generatedSession.questions;
    const counts = getPracticeCounts(activeSession);
    const index = activeSession.currentQuestionIndex;
    const question = questions[index];
    const questionState = activeSession.questionStateById[question.id];
    const hasReachedReviewPoint = activeSession.hasReachedFinalQuestion === true || (questions.length > 0 && index + 1 >= questions.length);
    const showFeedback = questionState.submitted && activeSession.config.reviewMode === "immediate";
    const passage = question.passageId ? activeSession.generatedSession.passages.find((item) => item.id === question.passageId) : null;
    const passageMetadataById = createPassageMetadataById(activeSession.generatedSession.passages ?? [], questions);
    const passageMetadata = passage ? passageMetadataById.get(passage.id) : null;
    const highlightRangesByTargetKey = activeSession.highlightRangesByTargetKey ?? {};
    const top = document.createElement("section");
    top.className = "session-top card card-pad";
    const title = document.createElement("h2");
    title.textContent = activeSession.generatedSession.session.title;
    const progressText = document.createElement("p");
    progressText.className = "tiny session-progress-text";
    progressText.textContent = `Question ${index + 1} of ${questions.length} | ${counts.submitted} submitted | ${counts.incomplete} incomplete | ${counts.flagged} flagged`;
    const progress = createProgressBar(index + 1, questions.length, "Session progress");
    const startedAtMs = new Date(questionState.startedAt || Date.now()).getTime();
    const timingPaused = questionState.submitted || activeSession.navigationOpen || activeSession.finalReviewOpen;
    const totalTimer = document.createElement("p");
    totalTimer.id = "practice-total-timer";
    totalTimer.dataset.elapsedMs = String(getStoredSessionElapsedMs(activeSession));
    totalTimer.dataset.currentQuestionSubmitted = timingPaused ? "true" : "false";
    totalTimer.dataset.startedAtMs = String(startedAtMs);
    updatePracticeTotalTimerElement(totalTimer, nowMs);
    const timer = document.createElement("p");
    timer.id = "practice-live-timer";
    timer.dataset.timingMode = activeSession.config.timingMode;
    timer.dataset.submitted = timingPaused ? "true" : "false";
    timer.dataset.startedAtMs = String(startedAtMs);
    timer.dataset.elapsedMs = String(questionState.elapsedMs ?? 0);
    timer.dataset.maxMs = String((activeSession.config.secondsPerQuestion ?? 95) * 1000);
    updatePracticeTimerElement(timer, nowMs);
    const actionRow = document.createElement("div");
    actionRow.className = "button-row session-top-actions";
    const flagButton = document.createElement("button");
    flagButton.type = "button";
    flagButton.className = questionState.flagged ? "btn btn-secondary" : "btn btn-ghost";
    flagButton.textContent = questionState.flagged ? "Unflag" : "Flag";
    flagButton.addEventListener("click", () => actions.flagCurrentQuestion());
    const highlightButton = document.createElement("button");
    highlightButton.type = "button";
    highlightButton.className = "btn btn-secondary";
    highlightButton.textContent = "Highlight";
    highlightButton.title = "Highlight selected passage or question text (H)";
    highlightButton.addEventListener("pointerdown", (event) => event.preventDefault());
    highlightButton.addEventListener("mousedown", (event) => event.preventDefault());
    highlightButton.addEventListener("click", () => actions.toggleHighlightFromSelection());
    const navigationButton = document.createElement("button");
    navigationButton.type = "button";
    navigationButton.className = "btn btn-secondary";
    navigationButton.textContent = "Navigation";
    navigationButton.addEventListener("click", () => actions.openNavigationPanel());
    const reviewButton = document.createElement("button");
    reviewButton.type = "button";
    reviewButton.className = "btn btn-primary";
    reviewButton.textContent = "Review";
    reviewButton.title = "Open final review before ending.";
    reviewButton.addEventListener("click", () => actions.openFinalReviewPanel());
    if (hasReachedReviewPoint) actionRow.append(flagButton, highlightButton, reviewButton);
    else actionRow.append(flagButton, highlightButton, navigationButton);
    const timerRow = document.createElement("div");
    timerRow.className = "session-timer-row";
    timerRow.append(totalTimer, timer);
    top.append(title, progressText, progress, timerRow, actionRow);
    root.append(top);
    const grid = document.createElement("section");
    grid.className = "session-grid";
    if (!passage) grid.classList.add("is-single");
    if (passage) grid.append(createPassageCard(passage, { ...(passageMetadata ?? {}), highlightRangesByTargetKey }));
    const questionCard = document.createElement("article");
    questionCard.className = "card card-pad question-card";
    const questionHeading = document.createElement("h3");
    questionHeading.textContent = `Question ${index + 1}`;
    const statusRow = document.createElement("div");
    statusRow.className = "practice-status-row";
    statusRow.append(makePill(getQuestionStatusText(questionState), getQuestionStatusClass(questionState)));
    if (questionState.flagged) statusRow.append(makePill("Flagged", "is-flagged"));
    const questionHighlightKey = getQuestionStemHighlightKey(question.id);
    const stem = createHighlightableText({
        tagName: "p",
        className: "question-stem",
        text: question.stem,
        targetKey: questionHighlightKey,
        scopeKey: getQuestionHighlightScopeKey(question.id),
        ranges: highlightRangesByTargetKey[questionHighlightKey]
    });
    questionCard.append(questionHeading, statusRow, stem);
    const choiceList = document.createElement("div");
    choiceList.className = "choice-list";
    const controlsLocked = questionState.submitted && activeSession.config.reviewMode === "immediate";
    question.choices.forEach((choice) => {
        const choiceElement = createChoiceCard(choice, {
            selectedId: questionState.selectedChoiceId,
            submitted: showFeedback,
            correctId: question.correctChoiceId
        });
        choiceElement.disabled = controlsLocked;
        if (!controlsLocked) choiceElement.addEventListener("click", () => actions.selectChoice(choice.id));
        choiceList.append(choiceElement);
    });
    questionCard.append(choiceList);
    const confidence = document.createElement("fieldset");
    confidence.className = "field practice-confidence";
    const confidenceLegend = document.createElement("legend");
    confidenceLegend.textContent = "Confidence (optional)";
    const confidenceSegment = document.createElement("div");
    confidenceSegment.className = "segment";
    for (let value = 1; value <= 5; value += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(value);
        if (questionState.confidence === value) button.classList.add("is-selected");
        button.disabled = controlsLocked;
        if (!controlsLocked) button.addEventListener("click", () => actions.setConfidence(value));
        confidenceSegment.append(button);
    }
    confidence.append(confidenceLegend, confidenceSegment);
    questionCard.append(confidence);
    const controls = document.createElement("div");
    controls.className = "question-actions practice-navigation-actions";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "btn btn-ghost";
    previous.textContent = "Previous";
    previous.disabled = index === 0;
    previous.addEventListener("click", () => actions.previousQuestion());
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-secondary";
    const canSubmit = !controlsLocked && hasPendingSubmission(questionState);
    submit.textContent = questionState.submitted ? canSubmit ? "Update submission" : "Submitted" : "Submit";
    submit.disabled = !canSubmit;
    submit.addEventListener("click", () => actions.submitAnswer());
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-primary";
    next.textContent = index + 1 === questions.length ? "Review" : "Next";
    next.title = index + 1 === questions.length ? "Open final review before ending." : "Next question";
    next.addEventListener("click", () => actions.nextQuestion());
    controls.append(previous, submit, next);
    questionCard.append(controls);
    const shortcutHint = document.createElement("p");
    shortcutHint.className = "tiny practice-shortcuts";
    shortcutHint.textContent = hasReachedReviewPoint ? "Shortcuts: A/B/C/D select, Enter submit, Left/Right navigate, R review, F flag, H highlight." : "Shortcuts: A/B/C/D select, Enter submit, Left/Right navigate, N navigation, F flag, H highlight.";
    questionCard.append(shortcutHint);
    if (showFeedback) {
        const explanation = document.createElement("div");
        explanation.className = "explanation-panel";
        const verdict = document.createElement("p");
        verdict.className = questionState.isCorrect ? "status success" : "status error";
        verdict.textContent = questionState.isCorrect ? "Correct." : `Incorrect. Correct answer: ${question.correctChoiceId}.`;
        const explanationText = document.createElement("p");
        explanationText.textContent = question.explanation;
        explanation.append(verdict, explanationText);
        appendChoiceExplanations(explanation, question);
        questionCard.append(explanation);
    }
    const disclaimer = document.createElement("p");
    disclaimer.className = "muted-note practice-ai-note";
    disclaimer.textContent = "AI-generated. Use for drilling and review. Verify uncertain explanations.";
    questionCard.append(disclaimer);
    grid.append(questionCard);
    root.append(grid);
    const navigationPanel = makeNavigationPanel(activeSession, actions);
    if (navigationPanel) root.append(navigationPanel);
    const finalReviewPanel = makeFinalReviewPanel(activeSession, actions);
    if (finalReviewPanel) root.append(finalReviewPanel);
    return root;
};
