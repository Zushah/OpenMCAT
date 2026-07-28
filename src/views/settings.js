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

const readFileText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
});

const makeDataGroup = (title, description) => {
    const group = document.createElement("section");
    group.className = "settings-data-group";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const help = document.createElement("p");
    help.className = "tiny";
    help.textContent = description;
    group.append(heading, help);
    return group;
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
    dataHelp.textContent = "OpenMCAT stores no data on any server. All OpenMCAT data is privately located in your own web browser. Use the controls below to backup, restore, combine, or delete OpenMCAT data.";
    dataCard.append(dataHelp);
    const dataActions = document.createElement("div");
    dataActions.className = "settings-data-actions";
    const exportButton = document.createElement("button");
    exportButton.className = "btn btn-secondary";
    exportButton.textContent = "Backup data";
    exportButton.addEventListener("click", () => actions.exportData());
    const restoreGroup = makeDataGroup("Restore data", "Replace the OpenMCAT data in this browser with one backup.");
    const importInput = document.createElement("input");
    importInput.id = "restore-file";
    importInput.className = "settings-file-input";
    importInput.type = "file";
    importInput.accept = ".json,application/json";
    const importPicker = document.createElement("label");
    importPicker.className = "btn btn-secondary settings-file-picker";
    importPicker.htmlFor = importInput.id;
    importPicker.textContent = "Choose file";
    const importButton = document.createElement("button");
    importButton.className = "btn btn-secondary";
    importButton.textContent = "Restore data";
    importButton.disabled = true;
    importInput.addEventListener("change", () => {
        const fileName = importInput.files?.[0]?.name;
        importPicker.textContent = fileName || "Choose file";
        importButton.disabled = !fileName;
    });
    importButton.addEventListener("click", () => {
        const file = importInput.files?.[0];
        if (!file) return;
        const confirmed = confirm("Restore this OpenMCAT data? This will replace the OpenMCAT data currently stored in this browser and may update your settings.");
        if (!confirmed) return;
        importButton.disabled = true;
        readFileText(file).then((text) => actions.importDataFromText(text)).catch((error) => { alert(`Import failed: ${error.message}`); }).finally(() => { importButton.disabled = false; });
    });
    const importRow = document.createElement("div");
    importRow.className = "settings-import-row";
    importRow.append(importInput, importPicker, importButton);
    restoreGroup.append(importRow);
    const combineGroup = makeDataGroup("Combine data", "Safely merge OpenMCAT data from one or more backups without replacing OpenMCAT data already in this browser.");
    const combineInput = document.createElement("input");
    combineInput.id = "combine-files";
    combineInput.className = "settings-file-input";
    combineInput.type = "file";
    combineInput.accept = ".json,application/json";
    combineInput.multiple = true;
    const combinePicker = document.createElement("label");
    combinePicker.className = "btn btn-secondary settings-file-picker";
    combinePicker.htmlFor = combineInput.id;
    combinePicker.textContent = "Choose file";
    const combineButton = document.createElement("button");
    combineButton.className = "btn btn-secondary";
    combineButton.textContent = "Combine data";
    combineButton.disabled = true;
    combineInput.addEventListener("change", () => {
        const files = Array.from(combineInput.files ?? []);
        combinePicker.textContent = files.length === 1 ? files[0].name : files.length ? `${files.length} files selected` : "Choose file";
        combineButton.disabled = !files.length;
    });
    combineButton.addEventListener("click", () => {
        const files = Array.from(combineInput.files ?? []);
        if (!files.length) return;
        combineButton.disabled = true;
        Promise.all(files.map(async (file) => ({ name: file.name, text: await readFileText(file) }))).then((sources) => actions.combineDataFromTexts(sources)).catch((error) => { alert(`Combine failed: ${error.message}`); }).finally(() => { combineButton.disabled = false; });
    });
    const combineRow = document.createElement("div");
    combineRow.className = "settings-import-row";
    combineRow.append(combineInput, combinePicker, combineButton);
    combineGroup.append(combineRow);
    const deleteAll = document.createElement("button");
    deleteAll.className = "btn btn-ghost settings-delete-button";
    deleteAll.textContent = "Delete data";
    deleteAll.addEventListener("click", () => {
        const confirmed = confirm("Are you sure you want to delete all of the OpenMCAT data on your web browser? This cannot be undone.");
        if (confirmed) actions.deleteAllLocalData();
    });
    dataActions.append(exportButton, restoreGroup, combineGroup, deleteAll);
    dataCard.append(dataActions);
    layout.append(appearanceCard, dataCard);
    root.append(layout);
    return root;
};
