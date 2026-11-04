import { getEffectiveSessionAiModel } from "../analytics/metrics.js";
import { createAiChatShortcuts } from "./chats.js";
import { AI_AGENT_TOOLS, WALKTHROUGH_VIDEO_WARNING_THRESHOLD, formatList } from "../data/chats.js";
import { AI_VIDEO_CHECK_PROMPT } from "../prompts/video.js";
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

const makeSegmentButton = (label, focusKey, selected, onClick, { disabled = false, title = "" } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.walkthroughFocus = focusKey;
    if (selected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    if (disabled) { button.disabled = true; if (title) button.title = title; }
    button.addEventListener("click", onClick);
    return button;
};

const makeSegmentGroup = (label, buttons) => {
    const section = createElement("div", "walkthrough-section");
    const group = createElement("div", "segment walkthrough-segment");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    group.append(...buttons);
    section.append(createElement("p", "walkthrough-label", label), group);
    return section;
};

const makeCopyButton = (label, className, text) => {
    const button = createElement("button", className, label);
    button.type = "button";
    button.disabled = !text;
    button.addEventListener("click", async () => {
        if (!text) return;
        button.disabled = true;
        try { await copyTextToClipboard(text); button.textContent = "Copied"; }
        catch { button.textContent = "Copy failed"; }
        finally { setTimeout(() => { button.disabled = false; button.textContent = label; }, 1400); }
    });
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
    const isVideo = walkthrough.format === "video";
    const promptText = includedIds.length ? compileWalkthroughPrompt(buildWalkthroughPayload(activeSession, { scope: walkthrough.scope, selectedQuestionIds: walkthrough.selectedQuestionIds, aiModel: getEffectiveSessionAiModel(activeSession) }), { format: walkthrough.format }) : "";
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
    const formatSection = makeSegmentGroup("Format", [
        makeSegmentButton("Text walkthrough", "format-text", !isVideo, () => actions.setWalkthroughFormat("text")),
        makeSegmentButton("Video walkthrough", "format-video", isVideo, () => actions.setWalkthroughFormat("video"))
    ]);
    const scopeSection = makeSegmentGroup("Questions to include", [
        makeSegmentButton(`All (${questions.length})`, "scope-all", walkthrough.scope === "all", () => actions.setWalkthroughScope("all")),
        makeSegmentButton(`Incorrect only (${incorrectCount})`, "scope-incorrect", walkthrough.scope === "incorrect", () => actions.setWalkthroughScope("incorrect"), { disabled: incorrectCount === 0, title: "No incorrect answers in this session." }),
        makeSegmentButton("Select individually", "scope-selected", walkthrough.scope === "selected", () => actions.setWalkthroughScope("selected"))
    ]);
    if (walkthrough.scope === "selected") scopeSection.append(renderQuestionChecklist(activeSession, walkthrough, actions));
    panel.append(top, createAiChatShortcuts(), formatSection, scopeSection);
    if (isVideo) {
        panel.append(createElement("p", "note walkthrough-video-note", `Video walkthroughs need an AI that can run code for a long time: it has to run Python, install software, download files from the internet, and give you back a video file. Agent tools like ${formatList(AI_AGENT_TOOLS)} are built for this, and some regular AI chats can do it too. Not sure about yours? Use "Check your AI" first. Making a video can take a while.`));
        if (includedIds.length > WALKTHROUGH_VIDEO_WARNING_THRESHOLD) panel.append(createElement("p", "warning-note walkthrough-video-warning", `This video walkthrough covers ${includedIds.length} questions, so it may take a long time to make and to watch. Consider including fewer questions.`));
    }
    const instructions = createElement("p", "generation-pipeline-instructions analytics-prompt-instructions walkthrough-instructions", "Copy prompt → Paste into your AI's chat:");
    const controls = createElement("div", "analytics-prompt-row walkthrough-row");
    controls.append(makeCopyButton("Copy prompt", "btn btn-primary", promptText));
    if (isVideo) controls.append(makeCopyButton("Check your AI", "btn btn-secondary", AI_VIDEO_CHECK_PROMPT));
    panel.append(instructions, controls);
    const checkNote = isVideo ? " The \"Check your AI\" prompt contains no session data." : "";
    if (!includedIds.length) panel.append(createElement("p", "note walkthrough-empty-note", `Select at least one question to include.${checkNote}`));
    else panel.append(createElement("p", "tiny analytics-prompt-note walkthrough-note", `The prompt is ${promptText.length.toLocaleString()} characters long and includes the full text of ${pluralize(includedIds.length, "question")} plus your answers, confidence ratings, times, flags, and mistake types from this session.${checkNote}`));
    overlay.append(panel);
    return overlay;
};
