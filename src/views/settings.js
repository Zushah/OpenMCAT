import { PROVIDER_OPTIONS } from "../data/defaults.js";

const makeField = (labelText, input) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    if (input.id) label.htmlFor = input.id;
    wrap.append(label, input);
    return wrap;
};

const createInput = (id, value = "", type = "text") => {
    const input = document.createElement("input");
    input.id = id;
    input.type = type;
    input.value = value;
    return input;
};

const createSelect = (id, options, selected) => {
    const select = document.createElement("select");
    select.id = id;
    options.forEach((option) => {
        const op = document.createElement("option");
        op.value = option.value;
        op.textContent = option.label;
        if (option.value === selected) op.selected = true;
        select.append(op);
    });
    return select;
};

export const renderSettingsView = (state, actions) => {
    const root = document.createElement("section");
    const header = document.createElement("section");
    header.className = "hero";
    const heading = document.createElement("h1");
    heading.textContent = "Settings";
    const sub = document.createElement("p");
    sub.textContent = "Configure provider defaults, appearance, and local data management.";
    header.append(heading, sub);
    root.append(header);
    const layout = document.createElement("div");
    layout.className = "settings-grid";
    const providerCard = document.createElement("section");
    providerCard.className = "card card-pad";
    const providerHeading = document.createElement("h2");
    providerHeading.textContent = "Provider configuration";
    providerCard.append(providerHeading);
    const providerOptions = PROVIDER_OPTIONS.map((provider) => ({ value: provider.id, label: provider.name }));
    const providerSelect = createSelect("settings-provider-id", providerOptions, state.settings.provider.selectedProviderId ?? state.currentConfig.providerId);
    providerCard.append(makeField("Default provider", providerSelect));
    const modelInput = createInput("settings-model", state.settings.provider.selectedModel || state.currentConfig.model);
    providerCard.append(makeField("Default model", modelInput));
    const divider = document.createElement("hr");
    divider.className = "divider";
    providerCard.append(divider);
    const themeSelect = createSelect("settings-theme", [{ value: "system", label: "System" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }], state.settings.theme);
    providerCard.append(makeField("Theme", themeSelect));
    const motionSelect = createSelect("settings-motion", [{ value: "system", label: "System" }, { value: "on", label: "Reduced motion on" }, { value: "off", label: "Reduced motion off" }], state.settings.reducedMotion ?? "system");
    providerCard.append(makeField("Reduced motion", motionSelect));
    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-primary";
    saveButton.textContent = "Save settings";
    saveButton.addEventListener("click", () => {
        const updatedSettings = structuredClone(state.settings);
        updatedSettings.theme = themeSelect.value;
        updatedSettings.reducedMotion = motionSelect.value;
        updatedSettings.provider.selectedProviderId = providerSelect.value;
        updatedSettings.provider.selectedModel = modelInput.value.trim();
        actions.updateConfig({ providerId: providerSelect.value, model: modelInput.value.trim() || state.currentConfig.model });
        actions.saveAppSettings(updatedSettings);
    });
    providerCard.append(saveButton);
    const dataCard = document.createElement("section");
    dataCard.className = "card card-pad";
    const dataHeading = document.createElement("h2");
    dataHeading.textContent = "Local data controls";
    dataCard.append(dataHeading);
    const dataHelp = document.createElement("p");
    dataHelp.className = "muted-note";
    dataHelp.textContent = "OpenMCAT stores no data server-side.";
    dataCard.append(dataHelp);
    const exportButton = document.createElement("button");
    exportButton.className = "btn btn-secondary";
    exportButton.textContent = "Export local data";
    exportButton.addEventListener("click", () => actions.exportData());
    dataCard.append(exportButton);
    const importField = document.createElement("div");
    importField.className = "field";
    const importLabel = document.createElement("label");
    importLabel.htmlFor = "import-file";
    importLabel.textContent = "Import JSON file";
    const importInput = document.createElement("input");
    importInput.id = "import-file";
    importInput.type = "file";
    importInput.accept = ".json,application/json";
    importField.append(importLabel, importInput);
    dataCard.append(importField);
    const importButton = document.createElement("button");
    importButton.className = "btn btn-secondary";
    importButton.textContent = "Import selected file";
    importButton.addEventListener("click", () => {
        const file = importInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            Promise.resolve(actions.importDataFromText(String(reader.result))).catch((error) => {
                alert(`Import failed: ${error.message}`);
            });
        };
        reader.readAsText(file);
    });
    dataCard.append(importButton);
    const deleteAll = document.createElement("button");
    deleteAll.className = "btn btn-ghost";
    deleteAll.textContent = "Delete all local study data";
    deleteAll.addEventListener("click", () => {
        const confirmed = confirm("Delete all local sessions, attempts, and flags? This cannot be undone.");
        if (confirmed) actions.deleteAllLocalData();
    });
    dataCard.append(deleteAll);
    layout.append(providerCard, dataCard);
    root.append(layout);
    return root;
};
