const makeField = (labelText, input) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    if (input.id) label.htmlFor = input.id;
    wrap.append(label, input);
    return wrap;
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
    sub.textContent = "Configure appearance and manage your private browser data.";
    header.append(heading, sub);
    root.append(header);
    const layout = document.createElement("div");
    layout.className = "settings-grid";
    const appearanceCard = document.createElement("section");
    appearanceCard.className = "card card-pad";
    const themeSelect = createSelect("settings-theme", [{ value: "system", label: "System" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }], state.settings.theme);
    appearanceCard.append(makeField("Theme", themeSelect));
    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-primary";
    saveButton.textContent = "Save settings";
    saveButton.addEventListener("click", () => {
        actions.saveAppSettings({
            ...state.settings,
            theme: themeSelect.value
        });
    });
    appearanceCard.append(saveButton);
    const dataCard = document.createElement("section");
    dataCard.className = "card card-pad settings-data-card";
    const dataHelp = document.createElement("p");
    dataHelp.className = "muted-note";
    dataHelp.textContent = "OpenMCAT stores no data on any server. All data is privately located in your own web browser. Use the controls below to export, import, or delete this data.";
    dataCard.append(dataHelp);
    const dataActions = document.createElement("div");
    dataActions.className = "settings-data-actions";
    const exportButton = document.createElement("button");
    exportButton.className = "btn btn-secondary";
    exportButton.textContent = "Export data";
    exportButton.addEventListener("click", () => actions.exportData());
    const importInput = document.createElement("input");
    importInput.id = "import-file";
    importInput.className = "settings-file-input";
    importInput.type = "file";
    importInput.accept = ".json,application/json";
    const importPicker = document.createElement("label");
    importPicker.className = "btn btn-secondary settings-file-picker";
    importPicker.htmlFor = importInput.id;
    importPicker.textContent = "Choose file";
    const importButton = document.createElement("button");
    importButton.className = "btn btn-secondary";
    importButton.textContent = "Import data";
    importButton.disabled = true;
    importInput.addEventListener("change", () => {
        const fileName = importInput.files?.[0]?.name;
        importPicker.textContent = fileName || "Choose file";
        importButton.disabled = !fileName;
    });
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
    const importRow = document.createElement("div");
    importRow.className = "settings-import-row";
    importRow.append(importInput, importPicker, importButton);
    const deleteAll = document.createElement("button");
    deleteAll.className = "btn btn-ghost settings-delete-button";
    deleteAll.textContent = "Delete data";
    deleteAll.addEventListener("click", () => {
        const confirmed = confirm("Are you sure you want to delete all of the OpenMCAT data on your web browser? This cannot be undone.");
        if (confirmed) actions.deleteAllLocalData();
    });
    dataActions.append(exportButton, importRow, deleteAll);
    dataCard.append(dataActions);
    layout.append(appearanceCard, dataCard);
    root.append(layout);
    return root;
};
