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

const BACKUP_REMINDER_TIMING_OPTIONS = [
    { value: "hourly", label: "Remind me hourly" },
    { value: "daily", label: "Remind me daily" },
    { value: "weekly", label: "Remind me weekly" },
    { value: "biweekly", label: "Remind me biweekly" },
    { value: "monthly", label: "Remind me monthly" },
    { value: "never", label: "Never remind me" }
];

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
    sub.textContent = "Configure your experience and manage your private data.";
    header.append(heading, sub);
    root.append(header);
    const layout = document.createElement("div");
    layout.className = "settings-grid";
    const appearanceCard = document.createElement("section");
    appearanceCard.className = "card card-pad";
    const themeSelect = createSelect("settings-theme", [{ value: "system", label: "System" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }], state.settings.theme);
    appearanceCard.append(makeField("Theme", themeSelect));
    const snoozedTimingSelect = createSelect("settings-backup-snoozed-timing", BACKUP_REMINDER_TIMING_OPTIONS, state.settings.backupReminderSnoozedTiming);
    const completedTimingSelect = createSelect("settings-backup-completed-timing", BACKUP_REMINDER_TIMING_OPTIONS, state.settings.backupReminderCompletedTiming);
    appearanceCard.append(makeField("Data backup reminder when snoozed", snoozedTimingSelect), makeField("Data backup reminder when completed", completedTimingSelect));
    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-primary";
    saveButton.textContent = "Save settings";
    saveButton.addEventListener("click", () => {
        actions.saveAppSettings({
            ...state.settings,
            theme: themeSelect.value,
            backupReminderSnoozedTiming: snoozedTimingSelect.value,
            backupReminderCompletedTiming: completedTimingSelect.value
        });
    });
    appearanceCard.append(saveButton);
    const dataCard = document.createElement("section");
    dataCard.className = "card card-pad settings-data-card";
    const dataHelp = document.createElement("p");
    dataHelp.className = "muted-note";
    dataHelp.textContent = "OpenMCAT stores no data on any server. All of the current OpenMCAT data is privately located in your own web browser. Use the controls below to backup, restore, merge, or delete the current OpenMCAT data.";
    const backupStatus = state.analytics?.backupStatus;
    const dataSize = document.createElement("p");
    dataSize.className = "settings-data-size";
    dataSize.textContent = `You have ${backupStatus?.dataSizeLabel ?? "0.00 MB"} of current OpenMCAT data.`;
    const status = document.createElement("p");
    status.className = `settings-backup-status backup-status-note ${backupStatus?.hasChanges ? "warning-note" : "muted-note"}`;
    status.textContent = backupStatus?.message ?? "Backup status unavailable.";
    dataCard.append(dataHelp, dataSize, status);
    const dataActions = document.createElement("div");
    dataActions.className = "settings-data-actions";
    const exportButton = document.createElement("button");
    exportButton.className = backupStatus?.hasChanges ? "btn btn-primary" : "btn btn-secondary";
    exportButton.textContent = "Backup data";
    exportButton.addEventListener("click", () => actions.exportData());
    const restoreGroup = makeDataGroup("Restore data", "Replace the current OpenMCAT data with one backup from your device.");
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
        const confirmed = confirm("Restore this OpenMCAT data backup? It will replace the current OpenMCAT data in this browser.");
        if (!confirmed) return;
        importButton.disabled = true;
        readFileText(file).then((text) => actions.importDataFromText(text)).catch((error) => { alert(`Import failed: ${error.message}`); }).finally(() => { importButton.disabled = false; });
    });
    const importRow = document.createElement("div");
    importRow.className = "settings-import-row";
    importRow.append(importInput, importPicker, importButton);
    restoreGroup.append(importRow);
    const combineGroup = makeDataGroup("Merge data", "Merge the current OpenMCAT data with one or more backups from your device.");
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
    combineButton.textContent = "Import data";
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
        Promise.all(files.map(async (file) => ({ name: file.name, text: await readFileText(file) }))).then((sources) => actions.combineDataFromTexts(sources)).catch((error) => { alert(`Merge failed: ${error.message}`); }).finally(() => { combineButton.disabled = false; });
    });
    const combineRow = document.createElement("div");
    combineRow.className = "settings-import-row";
    combineRow.append(combineInput, combinePicker, combineButton);
    combineGroup.append(combineRow);
    const deleteGroup = makeDataGroup("Delete data", "Delete the current OpenMCAT data. This cannot be undone.");
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-ghost settings-delete-button";
    deleteButton.textContent = "Delete data";
    deleteButton.addEventListener("click", () => {
        const confirmed = confirm("Are you sure you want to delete all of the current OpenMCAT data? It will be lost forever! (A long time!)");
        if (confirmed) actions.deleteAllLocalData();
    });
    deleteGroup.append(deleteButton);
    dataActions.append(exportButton, restoreGroup, combineGroup, deleteGroup);
    dataCard.append(dataActions);
    layout.append(appearanceCard, dataCard);
    root.append(layout);
    return root;
};
