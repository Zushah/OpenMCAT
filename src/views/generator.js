import { DIFFICULTIES, QUESTION_FORMATS, SECTIONS, getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";
import { REVIEW_MODES, TIMING_MODES } from "../data/defaults.js";

const makeCardTitle = (text) => {
    const title = document.createElement("h2");
    title.textContent = text;
    title.style.marginBottom = "0.75rem";
    return title;
};

const makeHero = () => {
    const hero = document.createElement("section");
    hero.className = "hero";
    const heading = document.createElement("h1");
    heading.textContent = "Practice";
    const sub = document.createElement("p");
    sub.textContent = "Generate targeted drills by section, topic, skill, difficulty, and format, or start immediately from the pregenerated question bank.";
    hero.append(heading, sub);
    return hero;
};

const makeQuestionBankCta = (actions) => {
    const panel = document.createElement("section");
    panel.className = "card card-pad generator-bank-cta";
    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Question bank";
    const text = document.createElement("p");
    text.textContent = "Use the pregenerated bank of 300 questions to start a session with zero setup friction.";
    copy.append(title, text);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary";
    button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">fact_check</span> Start session';
    button.addEventListener("click", () => actions.navigate("bank"));
    panel.append(copy, button);
    return panel;
};

const makeSectionSelect = (config, actions) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.htmlFor = "section-select";
    label.textContent = "Section";
    const select = document.createElement("select");
    select.id = "section-select";
    SECTIONS.forEach((section) => {
        const option = document.createElement("option");
        option.value = section.id;
        option.textContent = `${section.shortName} - ${section.name}`;
        if (config.sectionId === section.id) option.selected = true;
        select.append(option);
    });
    select.addEventListener("change", () => actions.applySection(select.value));
    wrap.append(label, select);
    return wrap;
};

const makeChipSelector = ({ title, subtitle, selectedIds, options, onToggle }) => {
    const wrap = document.createElement("fieldset");
    wrap.className = "field";
    const legend = document.createElement("legend");
    legend.textContent = title;
    const help = document.createElement("p");
    help.className = "help";
    help.textContent = subtitle;
    const list = document.createElement("div");
    list.className = "chip-list";
    options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip";
        if (selectedIds.includes(option.id)) {
            button.classList.add("is-selected");
            button.setAttribute("aria-pressed", "true");
        } else button.setAttribute("aria-pressed", "false");
        const label = option.shortName;
        button.textContent = label;
        if (option.description) {
            button.title = option.description;
            button.setAttribute("aria-label", `${label}. ${option.description}`);
        }
        button.addEventListener("click", () => onToggle(option.id));
        list.append(button);
    });
    wrap.append(legend, help, list);
    return wrap;
};

const makeSegmentControl = ({ title, options, selectedId, onChange }) => {
    const wrap = document.createElement("fieldset");
    wrap.className = "field";
    const legend = document.createElement("legend");
    legend.textContent = title;
    const segment = document.createElement("div");
    segment.className = "segment";
    options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option.label ?? option.name;
        if (option.id === selectedId) {
            button.classList.add("is-selected");
            button.setAttribute("aria-pressed", "true");
        }
        button.addEventListener("click", () => onChange(option.id));
        segment.append(button);
    });
    wrap.append(legend, segment);
    return wrap;
};

const makeNumberField = ({ id, labelText, value, min, max, onChange }) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = "number";
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

const makeGenerationPipelineModal = (state, actions) => {
    if (!state.generation.pipelineOpen || !state.generation.compiledPrompt) return null;
    const overlay = document.createElement("section");
    overlay.className = "generation-pipeline-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeGenerationPipeline(); });
    const panel = document.createElement("section");
    panel.className = "card card-pad generation-pipeline-panel";
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
    close.className = "btn btn-ghost generation-pipeline-close";
    close.setAttribute("aria-label", "Close generation pipeline");
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
    close.addEventListener("click", () => actions.closeGenerationPipeline());
    top.append(heading, close);
    panel.append(top);
    const instructions = document.createElement("p");
    instructions.className = "generation-pipeline-instructions";
    instructions.textContent = "Copy prompt → Paste into your AI's chat → Copy its output → Paste here:";
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
            setTimeout(() => { copyButton.textContent = "Copy prompt"; }, 1200);
        } catch { };
    });
    const outputInput = document.createElement("textarea");
    outputInput.className = "generation-pipeline-output";
    outputInput.placeholder = "Paste output";
    outputInput.rows = 6;
    outputInput.value = state.generation.manualInput ?? "";
    controls.append(copyButton, outputInput);
    panel.append(controls);
    const startRow = document.createElement("div");
    startRow.className = "generation-pipeline-start-row";
    const start = document.createElement("button");
    start.type = "button";
    start.className = "btn btn-primary";
    start.textContent = "Start session";
    start.disabled = state.generation.status === "validating";
    start.addEventListener("click", () => actions.submitManualJson(outputInput.value));
    startRow.append(start);
    panel.append(startRow);
    if (state.generation.error) {
        const error = document.createElement("p");
        error.className = "danger-note generation-pipeline-error";
        error.textContent = state.generation.error;
        panel.append(error);
    }
    overlay.append(panel);
    return overlay;
};

export const renderGeneratorView = (state, actions) => {
    const root = document.createElement("section");
    root.append(makeHero(), makeQuestionBankCta(actions));
    const layout = document.createElement("div");
    layout.className = "generator-layout";
    const primary = document.createElement("section");
    primary.className = "card card-pad";
    primary.append(makeCardTitle("Session generator"));
    const sectionTopics = getTopicsBySection(state.currentConfig.sectionId);
    const sectionSkills = getSkillsForSection(state.currentConfig.sectionId);
    primary.append(makeSectionSelect(state.currentConfig, actions));
    primary.append(makeChipSelector({
        title: "Topics",
        subtitle: "Select one or more topics. If none are selected, then all will be used.",
        selectedIds: state.currentConfig.topicIds,
        options: sectionTopics,
        onToggle: (topicId) => actions.toggleMultiValue("topicIds", topicId)
    }));
    if (!state.currentConfig.topicIds.length) {
        const warning = document.createElement("p");
        warning.className = "warning-note";
        warning.textContent = "No topics selected, so all will be used, but targeted practice is recommended.";
        primary.append(warning);
    }
    const sessionGrid = document.createElement("div");
    sessionGrid.className = "generator-session-grid";
    const leftColumn = document.createElement("div");
    leftColumn.className = "generator-session-column";
    const rightColumn = document.createElement("div");
    rightColumn.className = "generator-session-column";
    leftColumn.append(makeChipSelector({
        title: "Skills",
        subtitle: "Select one or more skills for this session.",
        selectedIds: state.currentConfig.skillIds,
        options: sectionSkills,
        onToggle: (skillId) => actions.toggleMultiValue("skillIds", skillId)
    }));
    leftColumn.append(makeSegmentControl({
        title: "Difficulty",
        options: DIFFICULTIES.map((difficulty) => ({
            id: difficulty.id,
            label: difficulty.name
        })),
        selectedId: state.currentConfig.difficulty,
        onChange: (difficulty) => actions.updateConfig({ difficulty })
    }));
    const formatCountRow = document.createElement("div");
    formatCountRow.className = "generator-compact-row";
    formatCountRow.append(makeFormatSelect(state.currentConfig, actions));
    formatCountRow.append(makeNumberField({
        id: "question-count",
        labelText: "Question count (1-59)",
        value: state.currentConfig.questionCount,
        min: 1,
        max: 59,
        onChange: (questionCount) => actions.updateConfig({ questionCount })
    }));
    rightColumn.append(formatCountRow);
    rightColumn.append(makeSegmentControl({
        title: "Timing mode",
        options: TIMING_MODES,
        selectedId: state.currentConfig.timingMode,
        onChange: (timingMode) => actions.updateConfig({ timingMode })
    }));
    if (state.currentConfig.timingMode === "timed") {
        rightColumn.append(makeNumberField({
            id: "seconds-per-question",
            labelText: "Seconds per question",
            value: state.currentConfig.secondsPerQuestion ?? 95,
            min: 30,
            max: 240,
            onChange: (secondsPerQuestion) => actions.updateConfig({ secondsPerQuestion })
        }));
    }
    rightColumn.append(makeSegmentControl({
        title: "Review mode",
        options: REVIEW_MODES,
        selectedId: state.currentConfig.reviewMode,
        onChange: (reviewMode) => actions.updateConfig({ reviewMode })
    }));
    sessionGrid.append(leftColumn, rightColumn);
    primary.append(sessionGrid);
    layout.append(primary);
    root.append(layout);
    const generatePanel = document.createElement("section");
    generatePanel.className = "card card-pad generator-submit-panel";
    const generateRow = document.createElement("div");
    generateRow.className = "question-actions generator-submit-row";
    const generateButton = document.createElement("button");
    generateButton.type = "button";
    generateButton.className = "btn btn-primary";
    generateButton.textContent = "Generate practice session";
    generateButton.disabled =
    state.generation.status === "compiling" ||
    state.generation.status === "validating";
    generateButton.addEventListener("click", () => actions.generateSession());
    generateRow.append(generateButton);
    generatePanel.append(generateRow);
    root.append(generatePanel);
    const modal = makeGenerationPipelineModal(state, actions);
    if (modal) root.append(modal);
    return root;
};
