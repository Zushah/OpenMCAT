import { formatDurationMs } from "../components/timer.js";

const cb = Chalkboard;

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
        correct,
        accuracy: answered.length ? correct / answered.length : 0,
        elapsedMs,
        avgMs: answered.length ? elapsedMs / answered.length : 0
    };
};

const makeSummaryCard = (label, value, hint = "") => {
    const card = document.createElement("article");
    card.className = "card card-pad stat-card";
    const title = document.createElement("h3");
    title.textContent = label;
    const text = document.createElement("p");
    text.textContent = value;
    card.append(title, text);
    if (hint) {
        const helper = document.createElement("p");
        helper.className = "tiny";
        helper.textContent = hint;
        card.append(helper);
    }
    return card;
};

const makeFilterButton = (label, filterId, currentFilter, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost";
    button.textContent = label;
    if (filterId === currentFilter) {
        button.classList.remove("btn-ghost");
        button.classList.add("btn-secondary");
    }
    button.addEventListener("click", onClick);
    return button;
};

const makeQuestionReviewBlock = (record, index, isFocused) => {
    const { question, state } = record;
    const card = document.createElement("article");
    const resultClass = state.submitted ? state.isCorrect ? "is-correct" : "is-incorrect" : "is-unanswered";
    card.className = `card card-pad review-question ${resultClass}`;
    card.dataset.reviewIndex = String(index);
    if (isFocused) card.classList.add("is-focused");
    const heading = document.createElement("h4");
    heading.textContent = `Q${index + 1}. ${question.stem}`;
    card.append(heading);
    const meta = document.createElement("p");
    meta.className = "tiny";
    const selected = state.selectedChoiceId ?? "Unanswered";
    const verdict = state.submitted ? state.isCorrect ? "Correct" : "Incorrect" : "Unanswered";
    meta.textContent = `Selected: ${selected} | Correct: ${question.correctChoiceId} | ${verdict} | ${formatDurationMs(state.elapsedMs ?? 0)}`;
    card.append(meta);
    const explanation = document.createElement("p");
    explanation.textContent = question.explanation;
    card.append(explanation);
    const choiceNotes = document.createElement("ul");
    choiceNotes.style.display = "grid";
    choiceNotes.style.gap = "4px";
    ["A", "B", "C", "D"].forEach((choiceId) => {
        const li = document.createElement("li");
        li.textContent = `${choiceId}: ${question.choiceExplanations?.[choiceId] ?? ""}`;
        choiceNotes.append(li);
    });
    card.append(choiceNotes);
    if (state.flagged) {
        const flagged = document.createElement("p");
        flagged.className = "warning-note";
        flagged.textContent = `Flagged: ${state.flagReason ?? "no reason provided"}`;
        card.append(flagged);
    }
    return card;
};

export const renderReviewView = (state, actions) => {
    const root = document.createElement("section");
    const activeSession = state.activeSession;
    if (!activeSession) {
        const empty = document.createElement("section");
        empty.className = "card card-pad";
        const heading = document.createElement("h2");
        heading.textContent = "No session to review";
        const text = document.createElement("p");
        text.textContent = "Complete a practice session first, then return here for full review.";
        const button = document.createElement("button");
        button.className = "btn btn-primary";
        button.textContent = "Go to generator";
        button.addEventListener("click", () => actions.navigate("generator"));
        empty.append(heading, text, button);
        root.append(empty);
        return root;
    }
    const summary = summarize(activeSession);
    const headingWrap = document.createElement("section");
    headingWrap.className = "card card-pad";
    const heading = document.createElement("h2");
    heading.textContent = "Session review";
    const sub = document.createElement("p");
    sub.textContent = activeSession.generatedSession.session.title;
    const note = document.createElement("p");
    note.className = "muted-note";
    note.textContent = "AI-generated. Use for drilling and review. Verify uncertain explanations.";
    headingWrap.append(heading, sub, note);
    root.append(headingWrap);
    const summaryGrid = document.createElement("section");
    summaryGrid.className = "summary-grid";
    summaryGrid.append(
        makeSummaryCard("Score", `${summary.correct}/${summary.total}`),
        makeSummaryCard("Accuracy", `${round(summary.accuracy * 100, 0.1)}%`),
        makeSummaryCard("Total Time", formatDurationMs(summary.elapsedMs)),
        makeSummaryCard("Avg / Question", formatDurationMs(summary.avgMs))
    );
    root.append(summaryGrid);
    const controls = document.createElement("div");
    controls.className = "button-row review-controls";
    controls.append(
        makeFilterButton("All", "all", activeSession.reviewFilter, () => actions.setReviewFilter("all")),
        makeFilterButton("Incorrect only", "incorrect", activeSession.reviewFilter, () => actions.setReviewFilter("incorrect")),
        makeFilterButton("Flagged only", "flagged", activeSession.reviewFilter, () => actions.setReviewFilter("flagged"))
    );
    const navHint = document.createElement("p");
    navHint.className = "tiny";
    navHint.textContent = "Review shortcuts: Left/Right arrows move focus.";
    controls.append(navHint);
    root.append(controls);
    const records = activeSession.generatedSession.questions.map((question, index) => ({ question, state: activeSession.questionStateById[question.id], index })).filter((record) => {
        if (activeSession.reviewFilter === "incorrect") return record.state.submitted && !record.state.isCorrect;
        if (activeSession.reviewFilter === "flagged") return Boolean(record.state.flagged);
        return true;
    });
    const reviewList = document.createElement("section");
    reviewList.className = "review-list";
    if (!records.length) {
        const empty = document.createElement("article");
        empty.className = "card card-pad";
        const text = document.createElement("p");
        text.textContent = "No questions match this filter.";
        empty.append(text);
        reviewList.append(empty);
    } else {
        const focusedIndex = state.activeSession.viewQuestionIndex ?? 0;
        records.forEach((record) => { reviewList.append(makeQuestionReviewBlock(record, record.index, record.index === focusedIndex)); });
    };
    root.append(reviewList);
    const actionRow = document.createElement("div");
    actionRow.className = "question-actions";
    const drillMissed = document.createElement("button");
    drillMissed.className = "btn btn-secondary";
    drillMissed.textContent = "Drill missed topics";
    drillMissed.addEventListener("click", () => {
        const missed = records.filter((record) => !record.state.isCorrect);
        if (!missed.length) { actions.navigate("generator"); return; }
        const topicCounts = new Map();
        const skillCounts = new Map();
        missed.forEach((record) => {
            (record.question.testedTopicIds ?? []).forEach((topicId) => { topicCounts.set(topicId, (topicCounts.get(topicId) ?? 0) + 1); });
            (record.question.testedSkillIds ?? []).forEach((skillId) => { skillCounts.set(skillId, (skillCounts.get(skillId) ?? 0) + 1); });
        });
        const topTopic = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topSkill = Array.from(skillCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        const patch = {};
        if (topTopic) patch.topicIds = [topTopic];
        if (topSkill) patch.skillIds = [topSkill];
        patch.questionCount = 8;
        patch.reviewMode = "later";
        patch.timingMode = "timed";
        actions.updateConfig(patch);
        actions.navigate("generator");
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
    root.append(actionRow);
    return root;
};
