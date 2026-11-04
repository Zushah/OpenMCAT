import { getEffectiveSessionAiModel } from "../analytics/metrics.js";
import { createAiChatShortcuts } from "./chats.js";
import { copyTextToClipboard } from "./clipboard.js";
import { icon } from "./icons.js";
import { buildWalkthroughPayload, compileWalkthroughPrompt, getWalkthroughIncludedQuestionIds, getWalkthroughPassageNumberById, getWalkthroughQuestionStatus } from "../prompts/walkthrough.js";
import { matchesReviewFilter } from "../storage/progress.js";

const STATUS_LABELS = { correct: "Correct", incorrect: "Incorrect", unsubmitted: "Unsubmitted" };

const createElement = (tag, className = "", text = "") => { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; };

const createDialogClose = (label, onClick) => {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-icon generation-pipeline-close";
    close.setAttribute("aria-label", label);
    close.append(icon("close"));
    close.addEventListener("click", onClick);
    return close;
};

const pluralize = (count, singular, plural = `${singular}s`) => `${count.toLocaleString()} ${count === 1 ? singular : plural}`;

const makeScopeButton = (label, scopeId, currentScope, onClick, { disabled = false, title = "" } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.walkthroughFocus = `scope-${scopeId}`;
    const selected = scopeId === currentScope;
    if (selected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    if (disabled) { button.disabled = true; if (title) button.title = title; }
    button.addEventListener("click", onClick);
    return button;
};

const makeCompactButton = (label, focusKey, onClick) => {
    const button = createElement("button", "btn btn-ghost btn-compact", label);
    button.type = "button";
    button.dataset.walkthroughFocus = focusKey;
    button.addEventListener("click", onClick);
    return button;
};

const renderQuestionChecklist = (activeSession, walkthrough, actions) => {
    const questions = activeSession.generatedSession?.questions ?? [];
    const passages = activeSession.generatedSession?.passages ?? [];
    const passageIds = new Set(passages.map((passage) => passage?.id));
    const passageNumberById = getWalkthroughPassageNumberById(passages, questions);
    const selected = new Set(walkthrough.selectedQuestionIds);
    const wrap = createElement("div", "walkthrough-checklist");
    const tools = createElement("div", "walkthrough-checklist-tools");
    tools.append(
        makeCompactButton("Select all", "select-all", () => actions.setWalkthroughSelection("all")),
        makeCompactButton("Clear", "select-none", () => actions.setWalkthroughSelection("none"))
    );
    const list = createElement("div", "walkthrough-question-list");
    list.dataset.scrollKey = "walkthrough-questions";
    questions.forEach((question, index) => {
        const questionState = activeSession.questionStateById?.[question.id];
        const label = createElement("label", "walkthrough-question");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selected.has(question.id);
        checkbox.dataset.walkthroughFocus = `question-${question.id}`;
        checkbox.addEventListener("change", () => actions.toggleWalkthroughQuestion(question.id));
        const parts = [`Q${index + 1}`, STATUS_LABELS[getWalkthroughQuestionStatus(questionState)]];
        if (questionState?.flagged) parts.push("Flagged");
        if (question.passageId && passageIds.has(question.passageId)) parts.push(`Passage ${passageNumberById.get(question.passageId)}`);
        label.append(checkbox, createElement("span", "", parts.join(" · ")));
        list.append(label);
    });
    wrap.append(tools, list);
    return wrap;
};

export const renderWalkthroughModal = (state, actions) => {
    const walkthrough = state.walkthrough;
    const activeSession = state.activeSession;
    if (!walkthrough || !activeSession || walkthrough.sessionId !== activeSession.id) return null;
    const questions = activeSession.generatedSession?.questions ?? [];
    const incorrectCount = questions.filter((question) => matchesReviewFilter(activeSession.questionStateById?.[question.id], "incorrect")).length;
    const includedIds = getWalkthroughIncludedQuestionIds(activeSession, walkthrough);
    const promptText = includedIds.length ? compileWalkthroughPrompt(buildWalkthroughPayload(activeSession, { scope: walkthrough.scope, selectedQuestionIds: walkthrough.selectedQuestionIds, aiModel: getEffectiveSessionAiModel(activeSession) })) : "";
    const overlay = createElement("section", "generation-pipeline-overlay walkthrough-overlay");
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeWalkthrough(); });
    const panel = createElement("section", "generation-pipeline-panel dialog-centered walkthrough-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "walkthrough-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const top = createElement("div", "generation-pipeline-top");
    const heading = createElement("h2", "", "Walkthrough with AI");
    heading.id = "walkthrough-heading";
    heading.tabIndex = -1;
    top.append(heading, createDialogClose("Close Walkthrough with AI", () => actions.closeWalkthrough()));
    const scopeSection = createElement("div", "walkthrough-section");
    const scopeLabel = createElement("p", "walkthrough-label", "Questions to include");
    const scopeGroup = createElement("div", "segment walkthrough-segment");
    scopeGroup.setAttribute("role", "group");
    scopeGroup.setAttribute("aria-label", "Questions to include");
    scopeGroup.append(
        makeScopeButton(`All (${questions.length})`, "all", walkthrough.scope, () => actions.setWalkthroughScope("all")),
        makeScopeButton(`Incorrect only (${incorrectCount})`, "incorrect", walkthrough.scope, () => actions.setWalkthroughScope("incorrect"), { disabled: incorrectCount === 0, title: "No incorrect answers in this session." }),
        makeScopeButton("Select individually", "selected", walkthrough.scope, () => actions.setWalkthroughScope("selected"))
    );
    scopeSection.append(scopeLabel, scopeGroup);
    if (walkthrough.scope === "selected") scopeSection.append(renderQuestionChecklist(activeSession, walkthrough, actions));
    const instructions = createElement("p", "generation-pipeline-instructions analytics-prompt-instructions walkthrough-instructions", "Copy prompt → Paste into your AI's chat:");
    const controls = createElement("div", "analytics-prompt-row walkthrough-row");
    const copyButton = createElement("button", "btn btn-primary", "Copy prompt");
    copyButton.type = "button";
    copyButton.disabled = !includedIds.length;
    copyButton.addEventListener("click", async () => {
        if (!promptText) return;
        copyButton.disabled = true;
        try { await copyTextToClipboard(promptText); copyButton.textContent = "Copied"; }
        catch { copyButton.textContent = "Copy failed"; }
        finally { setTimeout(() => { copyButton.disabled = false; copyButton.textContent = "Copy prompt"; }, 1400); }
    });
    controls.append(copyButton);
    panel.append(top, createAiChatShortcuts(), scopeSection, instructions, controls);
    if (!includedIds.length) panel.append(createElement("p", "note walkthrough-empty-note", "Select at least one question to include."));
    else panel.append(createElement("p", "tiny analytics-prompt-note walkthrough-note", `The prompt is ${promptText.length.toLocaleString()} characters long and includes the full text of ${pluralize(includedIds.length, "question")} plus your answers, confidence ratings, times, flags, and mistake types from this session.`));
    overlay.append(panel);
    return overlay;
};
