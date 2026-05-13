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
    heading.textContent = "Generate precise drills for your next MCAT study block.";
    const sub = document.createElement("p");
    sub.textContent =
    "Generate targeted drills by section, topic, skill, and difficulty. Track accuracy, timing, and weak areas locally without paywalls.";
    hero.append(heading, sub);
    return hero;
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
        option.textContent = section.beta ? `${section.shortName} - ${section.name} (Beta)` : `${section.shortName} - ${section.name}`;
        if (config.sectionId === section.id) option.selected = true;
        select.append(option);
    });
    select.addEventListener("change", () => actions.applySection(select.value));
    wrap.append(label, select);
    return wrap;
};

const makeChipSelector = ({ title, subtitle, selectedIds, options, onToggle, showBeta = false }) => {
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
        const label = showBeta && option.beta ? `${option.shortName} (Beta)` : option.shortName;
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
    QUESTION_FORMATS.filter((format) => config.sectionId === "cars" ? true : format.id !== "cars_beta").forEach((format) => {
        const option = document.createElement("option");
        option.value = format.id;
        option.textContent = format.beta ? `${format.name} (Beta)` : format.name;
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
    instructions.textContent = "Copy prompt → Paste into an AI model chatbox of your choice → Paste its output below:";
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
    root.append(makeHero());
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
        onToggle: (topicId) => actions.toggleMultiValue("topicIds", topicId),
        showBeta: true
    }));
    if (!state.currentConfig.topicIds.length) {
        const warning = document.createElement("p");
        warning.className = "warning-note";
        warning.textContent = "No topics selected, so all will be used, but targeted practice is recommended.";
        primary.append(warning);
    }
    if (state.currentConfig.sectionId === "cars") {
        const carsWarning = document.createElement("p");
        carsWarning.className = "warning-note";
        carsWarning.textContent = "CARS generation is experimental. Passage reasoning is harder to validate than science content drills.";
        primary.append(carsWarning);
    }
    const sessionGrid = document.createElement("div");
    sessionGrid.className = "generator-session-grid";
    const leftColumn = document.createElement("div");
    leftColumn.className = "generator-session-column";
    const rightColumn = document.createElement("div");
    rightColumn.className = "generator-session-column";
    leftColumn.append(makeChipSelector({
        title: "Skills",
        subtitle: "Select one or more reasoning skills for this session.",
        selectedIds: state.currentConfig.skillIds,
        options: sectionSkills,
        onToggle: (skillId) => actions.toggleMultiValue("skillIds", skillId),
        showBeta: true
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
        labelText: "Question count (1-50)",
        value: state.currentConfig.questionCount,
        min: 1,
        max: 50,
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
    const advanced = document.createElement("details");
    advanced.className = "advanced-panel";
    const advancedSummary = document.createElement("summary");
    advancedSummary.textContent = "Advanced options";
    advanced.append(advancedSummary);
    const advancedWrap = document.createElement("div");
    advancedWrap.style.marginTop = "0.75rem";
    const modelField = document.createElement("div");
    modelField.className = "field";
    const modelLabel = document.createElement("label");
    modelLabel.htmlFor = "model-name";
    modelLabel.textContent = "Model";
    const modelInput = document.createElement("input");
    modelInput.id = "model-name";
    modelInput.value = state.currentConfig.model;
    modelInput.placeholder = "Model id";
    modelInput.addEventListener("change", () => actions.updateConfig({ model: modelInput.value.trim() }));
    modelField.append(modelLabel, modelInput);
    advancedWrap.append(modelField);
    const strictnessField = document.createElement("div");
    strictnessField.className = "field";
    const strictLabel = document.createElement("label");
    strictLabel.htmlFor = "prompt-strictness";
    strictLabel.textContent = "Prompt strictness";
    const strictSelect = document.createElement("select");
    strictSelect.id = "prompt-strictness";
    ["strict", "balanced"].forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode;
        if ((state.currentConfig.promptStrictness ?? "strict") === mode) option.selected = true;
        strictSelect.append(option);
    });
    strictSelect.addEventListener("change", () => actions.updateConfig({ promptStrictness: strictSelect.value }));
    strictnessField.append(strictLabel, strictSelect);
    advancedWrap.append(strictnessField);
    const depthField = document.createElement("div");
    depthField.className = "field";
    const depthLabel = document.createElement("label");
    depthLabel.htmlFor = "explanation-depth";
    depthLabel.textContent = "Explanation depth";
    const depthSelect = document.createElement("select");
    depthSelect.id = "explanation-depth";
    ["concise", "standard", "deep"].forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode;
        if (state.currentConfig.explanationDepth === mode) option.selected = true;
        depthSelect.append(option);
    });
    depthSelect.addEventListener("change", () => actions.updateConfig({ explanationDepth: depthSelect.value }));
    depthField.append(depthLabel, depthSelect);
    advancedWrap.append(depthField);
    advancedWrap.append(makeNumberField({
        id: "batch-size",
        labelText: "Max generation batch size",
        value: state.currentConfig.batchSize,
        min: 1,
        max: 10,
        onChange: (batchSize) => actions.updateConfig({ batchSize })
    }));
    advanced.append(advancedWrap);
    rightColumn.append(advanced);
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
