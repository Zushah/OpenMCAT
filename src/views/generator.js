import { DIFFICULTIES, QUESTION_FORMATS, SECTIONS, getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";
import { DEFAULT_SECONDS_PER_QUESTION, QUESTION_COUNT_LIMITS, REVIEW_MODES, SECONDS_PER_QUESTION_LIMITS, TIMING_MODES } from "../data/defaults.js";
import { icon } from "../components/icons.js";
import { QUESTION_BANK_TOTAL_QUESTION_COUNT } from "../data/bank/catalog.js";
import { createResumeCard } from "../components/resume.js";
import { getResumableInfo } from "../storage/progress.js";

const AI_CHAT_SHORTCUTS = [
    { name: "ChatGPT", href: "https://chatgpt.com/", icon: "./assets/images/chatgpt.svg" },
    { name: "Claude", href: "https://claude.ai/new", icon: "./assets/images/claude.svg" },
    { name: "DeepSeek", href: "https://chat.deepseek.com/", icon: "./assets/images/deepseek.svg" }
];

const CHECK_GLYPH = '<svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true" focusable="false"><path d="M1 4l3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

const makeLabelledButton = (className, text, iconName, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    const label = document.createElement("span");
    label.textContent = text;
    button.append(label, icon(iconName, { size: 14 }));
    button.addEventListener("click", onClick);
    return button;
};

const makeGeneratorHeader = (actions) => {
    const header = document.createElement("div");
    header.className = "generator-options-header";
    const title = document.createElement("h2");
    title.textContent = "Session generator";
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "btn btn-ghost generator-options-restore";
    const label = document.createElement("span");
    label.textContent = "Restore default options";
    restore.append(icon("restore", { size: 13 }), label);
    restore.addEventListener("click", () => actions.restoreDefaultGeneratorOptions());
    header.append(title, restore);
    return header;
};

const makeHero = (actions) => {
    const hero = document.createElement("section");
    hero.className = "hero generator-hero";
    const copy = document.createElement("div");
    copy.className = "hero-copy";
    const heading = document.createElement("h1");
    heading.textContent = "Practice";
    const sub = document.createElement("p");
    sub.textContent = "Generate targeted drills by section, topic, skill, difficulty, and format, or start immediately from the pregenerated question bank.";
    copy.append(heading, sub);
    hero.append(copy, makeQuestionBankCta(actions));
    return hero;
};

const makeQuestionBankCta = (actions) => {
    const panel = document.createElement("aside");
    panel.className = "generator-bank-cta";
    panel.setAttribute("aria-labelledby", "generator-bank-cta-heading");
    const title = document.createElement("h2");
    title.id = "generator-bank-cta-heading";
    title.textContent = "Question bank";
    const text = document.createElement("p");
    text.textContent = `Use the pregenerated bank of ${QUESTION_BANK_TOTAL_QUESTION_COUNT} questions to start a session with zero setup friction.`;
    const button = makeLabelledButton("btn btn-secondary", "Start session", "arrow-right", () => actions.navigate("bank"));
    panel.append(title, text, button);
    return panel;
};

const makeClause = (number, body, { extraClass = "" } = {}) => {
    const clause = document.createElement("div");
    clause.className = ["clause", extraClass].filter(Boolean).join(" ");
    const numeral = document.createElement("span");
    numeral.className = "clause-num";
    numeral.setAttribute("aria-hidden", "true");
    numeral.textContent = String(number);
    clause.append(numeral, body);
    return clause;
};

const makeClauseFieldset = (title, help = "") => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "clause-body";
    const legend = document.createElement("legend");
    legend.textContent = title;
    fieldset.append(legend);
    if (help) {
        const note = document.createElement("p");
        note.className = "clause-help";
        note.textContent = help;
        fieldset.append(note);
    }
    return fieldset;
};

const makeSectionPicker = (config, actions) => {
    const fieldset = makeClauseFieldset("Section");
    const picker = document.createElement("div");
    picker.className = "section-picker";
    SECTIONS.forEach((section) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "section-option";
        button.dataset.sectionId = section.id;
        const selected = config.sectionId === section.id;
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        const abbreviation = document.createElement("span");
        abbreviation.className = "section-option-abbr";
        abbreviation.textContent = section.shortName;
        const name = document.createElement("span");
        name.className = "section-option-name";
        name.textContent = section.name;
        button.append(abbreviation, name);
        button.addEventListener("click", () => { if (!selected) actions.applySection(section.id); });
        picker.append(button);
    });
    fieldset.append(picker);
    return makeClause(1, fieldset);
};

const makeChecklist = ({ title, subtitle, selectedIds, options, onToggle, number, twoColumn = false, showCount = false }) => {
    const fieldset = makeClauseFieldset(title, subtitle);
    const list = document.createElement("div");
    list.className = twoColumn ? "check-list is-two-column" : "check-list";
    options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "check-item";
        const selected = selectedIds.includes(option.id);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        if (selected) button.classList.add("is-selected");
        const box = document.createElement("span");
        box.className = "check-box";
        box.setAttribute("aria-hidden", "true");
        box.innerHTML = CHECK_GLYPH;
        const label = document.createElement("span");
        label.textContent = option.shortName;
        button.append(box, label);
        if (option.description) {
            button.title = option.description;
            button.setAttribute("aria-label", `${option.shortName}. ${option.description}`);
        }
        button.addEventListener("click", () => onToggle(option.id));
        list.append(button);
    });
    fieldset.append(list);
    const clause = makeClause(number, fieldset);
    if (showCount) {
        const count = document.createElement("p");
        count.className = "clause-count";
        count.textContent = `${selectedIds.filter((id) => options.some((option) => option.id === id)).length} of ${options.length} selected`;
        clause.append(count);
    }
    return { clause, fieldset };
};

const makeSegmentControl = ({ title, options, selectedId, onChange }) => {
    const wrap = document.createElement("fieldset");
    wrap.className = "clause-sub";
    const legend = document.createElement("legend");
    legend.textContent = title;
    const segment = document.createElement("div");
    segment.className = "segment";
    options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option.label ?? option.name;
        const selected = option.id === selectedId;
        if (selected) button.classList.add("is-selected");
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.addEventListener("click", () => onChange(option.id));
        segment.append(button);
    });
    wrap.append(legend, segment);
    return wrap;
};

const makeNumberField = ({ id, labelText, hint = "", value, min, max, onChange, className = "field" }) => {
    const wrap = document.createElement("div");
    wrap.className = className;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.className = "generator-field-label";
    label.append(document.createTextNode(labelText));
    if (hint) {
        label.append(" ");
        const caption = document.createElement("span");
        caption.className = "field-hint";
        caption.textContent = hint;
        label.append(caption);
    }
    const input = document.createElement("input");
    input.id = id;
    input.type = "number";
    input.inputMode = "numeric";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener("change", () => onChange(Number(input.value)));
    wrap.append(label, input);
    return wrap;
};

const makeFormatSelect = (config, actions) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.htmlFor = "format-select";
    label.className = "generator-field-label";
    label.textContent = "Question format";
    const select = document.createElement("select");
    select.id = "format-select";
    QUESTION_FORMATS.forEach((format) => {
        const option = document.createElement("option");
        option.value = format.id;
        option.textContent = format.name;
        if (config.questionFormat === format.id) option.selected = true;
        select.append(option);
    });
    select.addEventListener("change", () => actions.updateConfig({ questionFormat: select.value }));
    wrap.append(label, select);
    return wrap;
};

const findLabel = (list, id, key = "name") => list.find((item) => item.id === id)?.[key] ?? id ?? "n/a";

const makeSessionSummary = (state, actions, sectionTopics, sectionSkills) => {
    const config = state.currentConfig;
    const wrap = document.createElement("aside");
    wrap.className = "generator-summary-wrap";
    wrap.setAttribute("aria-labelledby", "generator-summary-heading");
    const summary = document.createElement("div");
    summary.className = "generator-summary";
    const heading = document.createElement("h2");
    heading.id = "generator-summary-heading";
    heading.className = "label-caps";
    heading.textContent = "This session";
    const topicCount = config.topicIds.filter((id) => sectionTopics.some((topic) => topic.id === id)).length;
    const skillCount = config.skillIds.filter((id) => sectionSkills.some((skill) => skill.id === id)).length;
    const format = findLabel(QUESTION_FORMATS, config.questionFormat);
    const timing = config.timingMode === "timed" ? `Timed · ${config.secondsPerQuestion ?? DEFAULT_SECONDS_PER_QUESTION}s per question` : findLabel(TIMING_MODES, config.timingMode, "label");
    const review = findLabel(REVIEW_MODES, config.reviewMode, "label").replace(/^Review\s+/i, "").replace(/^./, (character) => character.toUpperCase());
    const rows = [
        ["Section", findLabel(SECTIONS, config.sectionId, "shortName")],
        ["Topics", topicCount ? `${topicCount} selected` : "All (none selected)"],
        ["Skills", skillCount ? `${skillCount} selected` : "None selected"],
        ["Difficulty", findLabel(DIFFICULTIES, config.difficulty)],
        ["Format", `${format} · ${config.questionCount} ${config.questionCount === 1 ? "question" : "questions"}`],
        ["Timing", timing],
        ["Review", review]
    ];
    const list = document.createElement("dl");
    list.className = "generator-summary-list";
    rows.forEach(([term, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = value;
        list.append(dt, dd);
    });
    const generateButton = makeLabelledButton("btn btn-primary generator-submit-button", "Generate practice session", "arrow-right", () => actions.generateSession());
    generateButton.disabled = state.generation.status === "compiling" || state.generation.status === "validating";
    summary.append(heading, list, generateButton);
    wrap.append(summary);
    return wrap;
};

const makeGenerationPipelineModal = (state, actions) => {
    if (!state.generation.pipelineOpen || !state.generation.compiledPrompt) return null;
    const overlay = document.createElement("section");
    overlay.className = "generation-pipeline-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeGenerationPipeline(); });
    const panel = document.createElement("section");
    panel.className = "generation-pipeline-panel dialog-centered";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "generation-pipeline-heading");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const top = document.createElement("div");
    top.className = "generation-pipeline-top";
    const heading = document.createElement("h2");
    heading.id = "generation-pipeline-heading";
    heading.textContent = "Generation pipeline";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-icon generation-pipeline-close";
    close.setAttribute("aria-label", "Close generation pipeline");
    close.append(icon("close"));
    close.addEventListener("click", () => actions.closeGenerationPipeline());
    top.append(heading, close);
    panel.append(top);
    const shortcuts = document.createElement("nav");
    shortcuts.className = "generation-pipeline-shortcuts";
    shortcuts.setAttribute("aria-label", "Open an AI chat");
    AI_CHAT_SHORTCUTS.forEach((shortcut) => {
        const link = document.createElement("a");
        link.className = "btn btn-secondary generation-pipeline-shortcut";
        link.href = shortcut.href;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("aria-label", `Open ${shortcut.name} in a new tab`);
        const shortcutIcon = document.createElement("img");
        shortcutIcon.className = "generation-pipeline-shortcut-icon";
        shortcutIcon.src = shortcut.icon;
        shortcutIcon.alt = "";
        shortcutIcon.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = shortcut.name;
        link.append(shortcutIcon, label);
        shortcuts.append(link);
    });
    panel.append(shortcuts);
    const instructions = document.createElement("p");
    instructions.className = "generation-pipeline-instructions";
    instructions.textContent = "Copy prompt → Paste into an AI chat → Copy its output → Paste here:";
    panel.append(instructions);
    const controls = document.createElement("div");
    controls.className = "generation-pipeline-row";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "btn btn-secondary";
    copyButton.textContent = "Copy prompt";
    copyButton.addEventListener("click", async () => {
        const text = `${state.generation.compiledPrompt.system}\n\n${state.generation.compiledPrompt.user}`;
        try {
            await navigator.clipboard.writeText(text);
            copyButton.textContent = "Copied";
        } catch {
            copyButton.textContent = "Copy failed";
        }
        setTimeout(() => { copyButton.textContent = "Copy prompt"; }, 1200);
    });
    const outputInput = document.createElement("textarea");
    outputInput.className = "generation-pipeline-output";
    outputInput.placeholder = "Paste output";
    outputInput.setAttribute("aria-label", "Paste output");
    outputInput.rows = 1;
    outputInput.spellcheck = false;
    outputInput.value = state.generation.manualInput ?? "";
    if (state.generation.error) outputInput.setAttribute("aria-invalid", "true");
    controls.append(copyButton, outputInput);
    panel.append(controls);
    const startRow = document.createElement("div");
    startRow.className = "generation-pipeline-start-row";
    const start = document.createElement("button");
    start.type = "button";
    start.className = `btn ${state.generation.repairPrompt ? "btn-secondary" : "btn-primary"}`;
    const startLabel = document.createElement("span");
    startLabel.textContent = "Start session";
    start.append(startLabel, icon("arrow-right", { size: 14 }));
    start.disabled = state.generation.status === "validating";
    start.addEventListener("click", () => actions.submitManualJson(outputInput.value));
    startRow.append(start);
    panel.append(startRow);
    if (state.generation.error) {
        const error = document.createElement("p");
        error.id = "generation-pipeline-error";
        error.className = "danger-note generation-pipeline-error";
        error.setAttribute("role", "alert");
        error.textContent = state.generation.error;
        outputInput.setAttribute("aria-describedby", error.id);
        panel.append(error);
    }
    if (state.generation.repairPrompt) {
        const repairRow = document.createElement("div");
        repairRow.className = "generation-pipeline-repair-row";
        const repairButton = document.createElement("button");
        repairButton.type = "button";
        repairButton.className = "btn btn-primary";
        repairButton.textContent = "Copy repair prompt";
        repairButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(state.generation.repairPrompt);
                repairButton.textContent = "Copied";
            } catch {
                repairButton.textContent = "Copy failed";
            }
            setTimeout(() => { repairButton.textContent = "Copy repair prompt"; }, 1200);
        });
        repairRow.append(repairButton);
        panel.append(repairRow);
    }
    overlay.append(panel);
    return overlay;
};

export const renderGeneratorView = (state, actions) => {
    const root = document.createElement("section");
    root.className = "generator-page";
    root.append(makeHero(actions));
    const resumableInfo = getResumableInfo(state);
    if (resumableInfo) root.append(createResumeCard(resumableInfo, actions));
    const config = state.currentConfig;
    const sectionTopics = getTopicsBySection(config.sectionId);
    const sectionSkills = getSkillsForSection(config.sectionId);
    const layout = document.createElement("div");
    layout.className = "generator-layout";
    const primary = document.createElement("section");
    primary.className = "generator-main";
    primary.setAttribute("aria-label", "Session generator options");
    primary.append(makeGeneratorHeader(actions), makeSectionPicker(config, actions));
    const topics = makeChecklist({
        title: "Topics",
        subtitle: "Select one or more topics. If none are selected, then all will be used.",
        selectedIds: config.topicIds,
        options: sectionTopics,
        onToggle: (topicId) => actions.toggleMultiValue("topicIds", topicId),
        number: 2,
        showCount: true
    });
    if (!config.topicIds.length) {
        const warning = document.createElement("p");
        warning.className = "warning-note";
        warning.textContent = "No topics selected, so all will be used, but targeted practice is recommended.";
        topics.fieldset.append(warning);
    }
    primary.append(topics.clause);
    const skills = makeChecklist({
        title: "Skills",
        subtitle: "Select one or more skills for this session.",
        selectedIds: config.skillIds,
        options: sectionSkills,
        onToggle: (skillId) => actions.toggleMultiValue("skillIds", skillId),
        number: 3,
        twoColumn: true
    });
    primary.append(skills.clause);
    const difficultySplit = document.createElement("div");
    difficultySplit.className = "clause-split";
    difficultySplit.append(makeSegmentControl({
        title: "Difficulty",
        options: DIFFICULTIES.map((difficulty) => ({ id: difficulty.id, label: difficulty.name })),
        selectedId: config.difficulty,
        onChange: (difficulty) => actions.updateConfig({ difficulty })
    }));
    const formatCountRow = document.createElement("div");
    formatCountRow.className = "generator-compact-row";
    formatCountRow.append(makeFormatSelect(config, actions), makeNumberField({
        id: "question-count",
        labelText: "Question count",
        hint: `(${QUESTION_COUNT_LIMITS.min}-${QUESTION_COUNT_LIMITS.max})`,
        value: config.questionCount,
        min: QUESTION_COUNT_LIMITS.min,
        max: QUESTION_COUNT_LIMITS.max,
        onChange: (questionCount) => actions.updateConfig({ questionCount })
    }));
    difficultySplit.append(formatCountRow);
    primary.append(makeClause(4, difficultySplit));
    const timingSplit = document.createElement("div");
    timingSplit.className = "clause-split";
    const timingColumn = document.createElement("div");
    timingColumn.className = "clause-sub";
    timingColumn.append(makeSegmentControl({
        title: "Timing mode",
        options: TIMING_MODES,
        selectedId: config.timingMode,
        onChange: (timingMode) => actions.updateConfig({ timingMode })
    }));
    if (config.timingMode === "timed") {
        timingColumn.append(makeNumberField({
            id: "seconds-per-question",
            labelText: "Seconds per question",
            value: config.secondsPerQuestion ?? DEFAULT_SECONDS_PER_QUESTION,
            min: SECONDS_PER_QUESTION_LIMITS.min,
            max: SECONDS_PER_QUESTION_LIMITS.max,
            onChange: (secondsPerQuestion) => actions.updateConfig({ secondsPerQuestion }),
            className: "field generator-timing-extra"
        }));
    }
    timingSplit.append(timingColumn, makeSegmentControl({
        title: "Review mode",
        options: REVIEW_MODES,
        selectedId: config.reviewMode,
        onChange: (reviewMode) => actions.updateConfig({ reviewMode })
    }));
    primary.append(makeClause(5, timingSplit));
    layout.append(primary, makeSessionSummary(state, actions, sectionTopics, sectionSkills));
    root.append(layout);
    const modal = makeGenerationPipelineModal(state, actions);
    if (modal) root.append(modal);
    return root;
};
