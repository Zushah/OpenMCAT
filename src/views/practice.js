import { createProgressBar } from "../components/progress.js";
import { createChoiceCard, createPassageTable } from "../components/questions.js";
import { formatDurationMs } from "../components/timer.js";

const cb = Chalkboard;

const computeTimerText = (mode, submitted, elapsedMs, maxMs) => {
    if (mode === "timed") {
        const remainingMs = maxMs - elapsedMs;
        if (remainingMs <= 0 && !submitted) return { text: `Time expired (${formatDurationMs(elapsedMs)} elapsed)`, expired: true };
        return { text: `Time left ${formatDurationMs(cb.stat.max([0, remainingMs]))}`, expired: false };
    }
    return { text: `Elapsed ${formatDurationMs(elapsedMs)}`, expired: false };
};

export const updatePracticeTimerElement = (timerElement, nowMs = Date.now()) => {
    if (!timerElement) return;
    const mode = timerElement.dataset.timingMode || "untimed";
    const submitted = timerElement.dataset.submitted === "true";
    const startedAtMs = Number(timerElement.dataset.startedAtMs || nowMs);
    const storedElapsedMs = Number(timerElement.dataset.elapsedMs || 0);
    const maxMs = Number(timerElement.dataset.maxMs || 0);
    const elapsedMs = submitted ? storedElapsedMs : cb.stat.max([0, nowMs - startedAtMs]);
    const timerInfo = computeTimerText(mode, submitted, elapsedMs, maxMs);
    timerElement.textContent = timerInfo.text;
    timerElement.className = timerInfo.expired ? "danger-note" : "tiny";
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
        text.textContent = "Generate or paste a validated session to start practicing.";
        const button = document.createElement("button");
        button.className = "btn btn-primary";
        button.textContent = "Go to generator";
        button.addEventListener("click", () => actions.navigate("generator"));
        empty.append(heading, text, button);
        root.append(empty);
        return root;
    }
    const questions = activeSession.generatedSession.questions;
    const index = activeSession.currentQuestionIndex;
    const question = questions[index];
    const questionState = activeSession.questionStateById[question.id];
    const passage = question.passageId ? activeSession.generatedSession.passages.find((item) => item.id === question.passageId) : null;
    const top = document.createElement("section");
    top.className = "session-top card card-pad";
    const title = document.createElement("h2");
    title.textContent = activeSession.generatedSession.session.title;
    const progressText = document.createElement("p");
    progressText.className = "tiny";
    progressText.textContent = `Question ${index + 1} of ${questions.length}`;
    const progress = createProgressBar(index + 1, questions.length, "Session progress");
    const timer = document.createElement("p");
    timer.id = "practice-live-timer";
    timer.dataset.timingMode = activeSession.config.timingMode;
    timer.dataset.submitted = questionState.submitted ? "true" : "false";
    timer.dataset.startedAtMs = String(new Date(questionState.startedAt || Date.now()).getTime());
    timer.dataset.elapsedMs = String(questionState.elapsedMs ?? 0);
    timer.dataset.maxMs = String((activeSession.config.secondsPerQuestion ?? (activeSession.config.sectionId === "cars" ? 110 : 95)) * 1000);
    updatePracticeTimerElement(timer, nowMs);
    const actionRow = document.createElement("div");
    actionRow.className = "button-row";
    const flagButton = document.createElement("button");
    flagButton.type = "button";
    flagButton.className = "btn btn-ghost";
    flagButton.textContent = questionState.flagged ? "Unflag question" : "Flag issue (F)";
    flagButton.addEventListener("click", () => actions.flagCurrentQuestion());
    actionRow.append(flagButton);
    top.append(title, progressText, progress, timer, actionRow);
    root.append(top);
    const grid = document.createElement("section");
    grid.className = "session-grid";
    if (!passage) grid.classList.add("is-single");
    if (passage) {
        const passageCard = document.createElement("article");
        passageCard.className = "card card-pad passage-card";
        const passageTitle = document.createElement("h3");
        passageTitle.textContent = passage.title;
        const passageText = document.createElement("p");
        passageText.className = "passage-text";
        passageText.textContent = passage.text;
        passageCard.append(passageTitle, passageText);
        (passage.tables ?? []).forEach((tableData) => { passageCard.append(createPassageTable(tableData)); });
        (passage.figureDescriptions ?? []).forEach((figure) => {
            const figureCard = document.createElement("div");
            figureCard.className = "card card-pad";
            figureCard.style.marginTop = "0.5rem";
            const figureHeading = document.createElement("p");
            figureHeading.className = "tiny";
            figureHeading.textContent = figure.caption;
            const figureText = document.createElement("p");
            figureText.textContent = figure.description;
            figureCard.append(figureHeading, figureText);
            passageCard.append(figureCard);
        });
        grid.append(passageCard);
    }
    const questionCard = document.createElement("article");
    questionCard.className = "card card-pad question-card";
    const questionHeading = document.createElement("h3");
    questionHeading.textContent = `Question ${index + 1}`;
    const stem = document.createElement("p");
    stem.textContent = question.stem;
    questionCard.append(questionHeading, stem);
    const choiceList = document.createElement("div");
    choiceList.className = "choice-list";
    question.choices.forEach((choice) => {
        const choiceElement = createChoiceCard(choice, {
            selectedId: questionState.selectedChoiceId,
            submitted: questionState.submitted,
            correctId: question.correctChoiceId
        });
        choiceElement.disabled = questionState.submitted;
        choiceElement.addEventListener("click", () => actions.selectChoice(choice.id));
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
        button.addEventListener("click", () => actions.setConfidence(value));
        confidenceSegment.append(button);
    }
    confidence.append(confidenceLegend, confidenceSegment);
    questionCard.append(confidence);
    const controls = document.createElement("div");
    controls.className = "question-actions";
    if (!questionState.submitted) {
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "btn btn-primary";
        submit.textContent = activeSession.config.reviewMode === "later" ? "Submit and continue (Enter)" : "Submit answer (Enter)";
        submit.addEventListener("click", () => actions.submitAnswer());
        controls.append(submit);
    } else {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "btn btn-primary";
        next.textContent =
        index + 1 === questions.length ? "Finish session" : "Next question (Enter)";
        next.addEventListener("click", () => actions.nextQuestion());
        controls.append(next);
    }
    questionCard.append(controls);
    const shortcutHint = document.createElement("p");
    shortcutHint.className = "tiny practice-shortcuts";
    shortcutHint.textContent = "Shortcuts: A/B/C/D select, Enter submit/next, F flag.";
    questionCard.append(shortcutHint);
    if (questionState.submitted && activeSession.config.reviewMode === "immediate") {
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
    disclaimer.textContent = "AI-generated. Use for drilling and review; verify uncertain explanations.";
    questionCard.append(disclaimer);
    grid.append(questionCard);
    root.append(grid);
    return root;
};
