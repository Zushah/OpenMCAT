import { DIFFICULTIES, QUESTION_FORMATS, SECTIONS, getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";
import { PROVIDER_OPTIONS, REVIEW_MODES, TIMING_MODES } from "../data/defaults.js";

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

const classifyJsonToken = (token) => {
    if (/^[{}[\],:]$/.test(token)) return "punctuation";
    if (/^"/.test(token) && /:$/.test(token)) return "key";
    if (/^"/.test(token)) return "string";
    if (/^(true|false)$/.test(token)) return "boolean";
    if (/^null$/.test(token)) return "null";
    return "number";
};

const createHighlightedCodeBlock = (rawText) => {
    const block = document.createElement("div");
    block.className = "raw-response-wrap";
    const pre = document.createElement("pre");
    pre.className = "codeblock";
    const code = document.createElement("code");
    code.className = "codeblock-code";
    let displayText = rawText;
    try { displayText = JSON.stringify(JSON.parse(rawText), null, 2); } catch { };
    const tokenRegex = /"(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?=\s*:)?|"(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|[{}\[\],:]/g;
    let cursor = 0;
    let match = tokenRegex.exec(displayText);
    while (match) {
        const token = match[0];
        const start = match.index;
        if (start > cursor) code.append(document.createTextNode(displayText.slice(cursor, start)));
        const span = document.createElement("span");
        span.className = `json-token ${classifyJsonToken(token)}`;
        span.textContent = token;
        code.append(span);
        cursor = start + token.length;
        match = tokenRegex.exec(displayText);
    }
    if (cursor < displayText.length) code.append(document.createTextNode(displayText.slice(cursor)));
    pre.append(code);
    block.append(pre);
    return block;
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
        button.textContent =
        showBeta && option.beta ? `${option.shortName} (Beta)` : option.shortName;
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

const makeProviderSelect = (config, settings, actions) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.htmlFor = "provider-select";
    label.textContent = "Provider";
    const select = document.createElement("select");
    select.id = "provider-select";
    PROVIDER_OPTIONS.forEach((provider) => {
        const option = document.createElement("option");
        option.value = provider.id;
        option.textContent = provider.name;
        if (config.providerId === provider.id) option.selected = true;
        select.append(option);
    });
    select.addEventListener("change", () => {
        const nextProviderId = select.value;
        let nextModel = config.model;
        if (nextProviderId === "mock") nextModel = "mock-mcat-v1"; else if (nextProviderId === "manual_json") nextModel = settings.provider.selectedModel || config.model;
        actions.updateConfig({ providerId: nextProviderId, model: nextModel });
    });
    wrap.append(label, select);
    return wrap;
};

const makeGenerationStatus = (state, actions) => {
    const card = document.createElement("section");
    card.className = "card card-pad";
    card.append(makeCardTitle("Generation pipeline"));
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const statusMap = {
        idle: "Ready. Choose settings and generate a session.",
        compiling: "Compiling constrained prompt.",
        waiting: "Request sent. Waiting for provider response.",
        manual: "Manual mode active. Paste model JSON below.",
        validating: "Validating JSON and schema constraints.",
        ready: "Session validated successfully.",
        error: "Generation failed. Review error details."
    };
    status.textContent = statusMap[state.generation.status] ?? "Idle";
    if (state.generation.status === "error") status.classList.add("error");
    if (state.generation.status === "ready") status.classList.add("success");
    card.append(status);
    const hint = document.createElement("p");
    hint.className = "tiny";
    hint.textContent = "Flow: Compile prompt -> Generate output -> Validate JSON.";
    card.append(hint);
    if (state.generation.error) {
        const error = document.createElement("p");
        error.className = "danger-note";
        error.textContent = state.generation.error;
        card.append(error);
    }
    if (state.generation.warnings?.length) {
        const warningList = document.createElement("ul");
        warningList.className = "help";
        state.generation.warnings.forEach((warning) => {
            const item = document.createElement("li");
            item.textContent = `- ${warning}`;
            warningList.append(item);
        });
        card.append(warningList);
    }
    const buttonRow = document.createElement("div");
    buttonRow.className = "button-row";
    if (state.generation.status === "ready") {
        const startSession = document.createElement("button");
        startSession.type = "button";
        startSession.className = "btn btn-primary";
        startSession.textContent = "Start session";
        startSession.addEventListener("click", () => actions.startSessionFromGeneration());
        buttonRow.append(startSession);
    }
    if (state.generation.status === "error" || state.generation.status === "ready") {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "btn btn-secondary";
        retry.textContent =
        state.generation.status === "ready" ? "Generate again" : "Retry generation";
        retry.addEventListener("click", () => actions.generateSession());
        buttonRow.append(retry);
    }
    if (state.generation.rawText) {
        const viewRaw = document.createElement("button");
        viewRaw.type = "button";
        viewRaw.className = "btn btn-ghost";
        viewRaw.textContent = state.generation.showRawResponse
        ? "Hide raw response"
        : "Show raw response";
        viewRaw.addEventListener("click", () => actions.toggleRawResponse());
        buttonRow.append(viewRaw);
    }
    if (state.generation.compiledPrompt) {
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "btn btn-ghost";
        copy.textContent = "Copy prompt";
        copy.addEventListener("click", async () => {
            const text = `${state.generation.compiledPrompt.system}\n\n${state.generation.compiledPrompt.user}`;
            try {
                await navigator.clipboard.writeText(text);
                copy.textContent = "Copied";
                setTimeout(() => {
                        copy.textContent = "Copy prompt";
                }, 1500);
            } catch { };
        });
        buttonRow.append(copy);
        const switchManual = document.createElement("button");
        switchManual.type = "button";
        switchManual.className = "btn btn-ghost";
        switchManual.textContent = "Use manual JSON";
        switchManual.addEventListener("click", () => {
            actions.updateConfig({ providerId: "manual_json" });
            actions.generateSession();
        });
        buttonRow.append(switchManual);
    }
    card.append(buttonRow);
    if (state.generation.rawText && state.generation.showRawResponse) card.append(createHighlightedCodeBlock(state.generation.rawText));
    return card;
};

const makeManualPanel = (state, actions) => {
    if (state.generation.status !== "manual" || !state.generation.compiledPrompt) return null;
    const card = document.createElement("section");
    card.className = "card card-pad";
    card.append(makeCardTitle("Manual JSON paste workflow"));
    const instructions = document.createElement("p");
    instructions.textContent = "Copy the compiled prompt into any AI model, then paste the returned JSON below.";
    card.append(instructions);
    const promptField = document.createElement("div");
    promptField.className = "field";
    const promptLabel = document.createElement("label");
    promptLabel.htmlFor = "manual-compiled-prompt";
    promptLabel.textContent = "Compiled prompt";
    const promptArea = document.createElement("textarea");
    promptArea.id = "manual-compiled-prompt";
    promptArea.rows = 14;
    promptArea.readOnly = true;
    promptArea.value = `${state.generation.compiledPrompt.system}\n\n${state.generation.compiledPrompt.user}`;
    promptField.append(promptLabel, promptArea);
    card.append(promptField);
    const responseField = document.createElement("div");
    responseField.className = "field";
    const responseLabel = document.createElement("label");
    responseLabel.htmlFor = "manual-json-response";
    responseLabel.textContent = "Pasted model response";
    const responseArea = document.createElement("textarea");
    responseArea.id = "manual-json-response";
    responseArea.rows = 12;
    responseArea.placeholder = "Paste full JSON object here";
    responseField.append(responseLabel, responseArea);
    card.append(responseField);
    const buttonRow = document.createElement("div");
    buttonRow.className = "button-row";
    const copyPrompt = document.createElement("button");
    copyPrompt.type = "button";
    copyPrompt.className = "btn btn-secondary";
    copyPrompt.textContent = "Copy prompt";
    copyPrompt.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(promptArea.value);
            copyPrompt.textContent = "Copied";
            setTimeout(() => {
                    copyPrompt.textContent = "Copy prompt";
                }, 1500);
        } catch {
            promptArea.select();
            document.execCommand("copy");
        };
    });
    buttonRow.append(copyPrompt);
    const validate = document.createElement("button");
    validate.type = "button";
    validate.className = "btn btn-primary";
    validate.textContent = "Validate and start session";
    validate.addEventListener("click", () => actions.submitManualJson(responseArea.value));
    buttonRow.append(validate);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => actions.resetManualGeneration());
    buttonRow.append(cancel);
    card.append(buttonRow);
    return card;
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
    primary.append(
        makeChipSelector({
            title: "Topics",
            subtitle:
            "Select one or more topics. If none are selected, OpenMCAT falls back to section-wide mix.",
            selectedIds: state.currentConfig.topicIds,
            options: sectionTopics,
            onToggle: (topicId) => actions.toggleMultiValue("topicIds", topicId),
            showBeta: true
        })
    );
    primary.append(
        makeChipSelector({
            title: "Skills",
            subtitle: "Select one or more reasoning skills for this session.",
            selectedIds: state.currentConfig.skillIds,
            options: sectionSkills,
            onToggle: (skillId) => actions.toggleMultiValue("skillIds", skillId),
            showBeta: true
        })
    );
    primary.append(
        makeSegmentControl({
            title: "Difficulty",
            options: DIFFICULTIES.map((difficulty) => ({
                        id: difficulty.id,
                        label: difficulty.name})),
            selectedId: state.currentConfig.difficulty,
            onChange: (difficulty) => actions.updateConfig({ difficulty })
        })
    );
    primary.append(makeFormatSelect(state.currentConfig, actions));
    primary.append(
        makeNumberField({
            id: "question-count",
            labelText: "Question count (1-50)",
            value: state.currentConfig.questionCount,
            min: 1,
            max: 50,
            onChange: (questionCount) => actions.updateConfig({ questionCount })
        })
    );
    primary.append(
        makeSegmentControl({
            title: "Timing mode",
            options: TIMING_MODES,
            selectedId: state.currentConfig.timingMode,
            onChange: (timingMode) => actions.updateConfig({ timingMode })
        })
    );
    if (state.currentConfig.timingMode === "timed") {
        primary.append(
            makeNumberField({
                id: "seconds-per-question",
                labelText: "Seconds per question",
                value: state.currentConfig.secondsPerQuestion ?? 95,
                min: 30,
                max: 240,
                onChange: (secondsPerQuestion) => actions.updateConfig({ secondsPerQuestion })
            })
        );
    }
    primary.append(
        makeSegmentControl({
            title: "Review mode",
            options: REVIEW_MODES,
            selectedId: state.currentConfig.reviewMode,
            onChange: (reviewMode) => actions.updateConfig({ reviewMode })
        })
    );
    const advanced = document.createElement("details");
    advanced.className = "advanced-panel";
    const advancedSummary = document.createElement("summary");
    advancedSummary.textContent = "Advanced options";
    advanced.append(advancedSummary);
    const advancedWrap = document.createElement("div");
    advancedWrap.style.marginTop = "0.75rem";
    advancedWrap.append(makeProviderSelect(state.currentConfig, state.settings, actions));
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
    advancedWrap.append(
        makeNumberField({
            id: "batch-size",
            labelText: "Max generation batch size",
            value: state.currentConfig.batchSize,
            min: 1,
            max: 10,
            onChange: (batchSize) => actions.updateConfig({ batchSize })
        })
    );
    advanced.append(advancedWrap);
    primary.append(advanced);
    if (!state.currentConfig.topicIds.length) {
        const warning = document.createElement("p");
        warning.className = "warning-note";
        warning.textContent =
        "No topics selected. OpenMCAT will use all topics in this section, but targeted practice is recommended.";
        primary.append(warning);
    }
    if (state.currentConfig.sectionId === "cars") {
        const carsWarning = document.createElement("p");
        carsWarning.className = "warning-note";
        carsWarning.textContent =
        "CARS generation is experimental. Passage reasoning is harder to validate than science content drills.";
        primary.append(carsWarning);
    }
    const generateRow = document.createElement("div");
    generateRow.className = "question-actions";
    const generateButton = document.createElement("button");
    generateButton.type = "button";
    generateButton.className = "btn btn-primary";
    generateButton.textContent = "Generate practice session";
    generateButton.disabled =
    state.generation.status === "compiling" ||
    state.generation.status === "waiting" ||
    state.generation.status === "validating";
    generateButton.addEventListener("click", () => actions.generateSession());
    generateRow.append(generateButton);
    primary.append(generateRow);
    const secondary = document.createElement("aside");
    secondary.style.display = "grid";
    secondary.style.gap = "1rem";
    secondary.append(makeGenerationStatus(state, actions));
    const providerStatus = document.createElement("section");
    providerStatus.className = "card card-pad";
    providerStatus.append(makeCardTitle("Provider status"));
    const providerOption = PROVIDER_OPTIONS.find((provider) => provider.id === state.currentConfig.providerId);
    const providerName = document.createElement("p");
    const providerLabel = document.createElement("strong");
    providerLabel.textContent = "Active provider: ";
    const providerValue = document.createElement("span");
    providerValue.textContent = providerOption?.name ?? state.currentConfig.providerId;
    providerName.append(providerLabel, providerValue);
    providerStatus.append(providerName);
    const providerWarning = document.createElement("p");
    providerWarning.className = "muted-note";
    providerWarning.textContent = "Your prompts are sent only to the provider mode you select. Use manual JSON for any external model.";
    providerStatus.append(providerWarning);
    secondary.append(providerStatus);
    const disclaimer = document.createElement("section");
    disclaimer.className = "card card-pad";
    disclaimer.append(makeCardTitle("AI practice note"));
    const disclaimerText = document.createElement("p");
    disclaimerText.textContent = "AI-generated practice can contain errors. Use OpenMCAT for drilling and review, not official score prediction.";
    disclaimer.append(disclaimerText);
    secondary.append(disclaimer);
    layout.append(primary, secondary);
    root.append(layout);
    const manualPanel = makeManualPanel(state, actions);
    if (manualPanel) {
        manualPanel.style.marginTop = "1rem";
        root.append(manualPanel);
    }
    return root;
};
