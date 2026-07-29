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

const DATA_ACTION_TITLES = { backup: "Backup data", share: "Share data", restore: "Restore data", merge: "Merge data", delete: "Delete data" };

const formatConfirmationCount = (value, change) => change && value > 0 ? `+${value}` : String(value);

const makeConfirmationMetric = (label, value, change) => {
    const metric = document.createElement("span");
    metric.className = "settings-data-confirmation-metric";
    const count = document.createElement("strong");
    count.textContent = formatConfirmationCount(value, change);
    if (change) count.classList.add(value > 0 ? "is-addition" : value < 0 ? "is-deletion" : "is-unchanged");
    const name = document.createElement("span");
    name.textContent = label;
    metric.append(count, name);
    return metric;
};

const renderDataConfirmationModal = (state, actions) => {
    const confirmation = state.settingsDataConfirmation;
    if (!confirmation) return null;
    const overlay = document.createElement("section");
    overlay.className = "generation-pipeline-overlay settings-data-confirmation-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", (event) => { if (event.target === overlay) actions.closeSettingsDataConfirmation(); });
    const panel = document.createElement("section");
    panel.className = "card card-pad generation-pipeline-panel settings-data-confirmation-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "settings-data-confirmation-heading");
    panel.setAttribute("aria-describedby", "settings-data-confirmation-description");
    panel.addEventListener("click", (event) => event.stopPropagation());
    const top = document.createElement("div");
    top.className = "generation-pipeline-top";
    const heading = document.createElement("h2");
    heading.id = "settings-data-confirmation-heading";
    heading.textContent = DATA_ACTION_TITLES[confirmation.action] ?? "Change data";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-ghost generation-pipeline-close";
    close.setAttribute("aria-label", "Deny data action and close confirmation");
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
    close.addEventListener("click", () => actions.closeSettingsDataConfirmation());
    top.append(heading, close);
    const description = document.createElement("p");
    description.id = "settings-data-confirmation-description";
    description.className = "muted-note settings-data-confirmation-description";
    description.textContent = confirmation.description;
    const metadata = document.createElement("dl");
    metadata.className = "settings-data-confirmation-metadata";
    confirmation.metadata.forEach((entry) => {
        const item = document.createElement("div");
        const term = document.createElement("dt");
        term.textContent = entry.label;
        const value = document.createElement("dd");
        value.textContent = entry.value;
        item.append(term, value);
        metadata.append(item);
    });
    const comparison = document.createElement("div");
    comparison.className = "settings-data-confirmation-comparison";
    confirmation.stats.forEach((stat) => {
        const item = document.createElement("section");
        item.className = `settings-data-confirmation-stat${stat.change ? " is-change" : ""}`;
        const label = document.createElement("h3");
        label.textContent = stat.label;
        item.append(label);
        if (stat.empty) {
            const empty = document.createElement("span");
            empty.className = "settings-data-confirmation-empty";
            empty.textContent = stat.empty;
            item.append(empty);
        } else {
            const metrics = document.createElement("div");
            metrics.append(
                makeConfirmationMetric(stat.sessions === 1 || stat.sessions === -1 ? "session" : "sessions", stat.sessions, stat.change),
                makeConfirmationMetric(stat.attempts === 1 || stat.attempts === -1 ? "attempt" : "attempts", stat.attempts, stat.change)
            );
            item.append(metrics);
        }
        comparison.append(item);
    });
    const controls = document.createElement("div");
    controls.className = "button-row settings-data-confirmation-actions";
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "btn btn-secondary";
    confirmButton.textContent = "Confirm";
    confirmButton.addEventListener("click", () => actions.confirmSettingsDataAction());
    const denyButton = document.createElement("button");
    denyButton.type = "button";
    denyButton.className = "btn btn-secondary";
    denyButton.textContent = "Deny";
    denyButton.addEventListener("click", () => actions.closeSettingsDataConfirmation());
    controls.append(confirmButton, denyButton);
    panel.append(top, description);
    if (confirmation.metadata.length) panel.append(metadata);
    panel.append(comparison, controls);
    overlay.append(panel);
    return overlay;
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
    const persistence = state.storagePersistence ?? {};
    const persistenceSelect = createSelect("settings-persistent-storage", [
        { value: "enabled", label: "Enabled" },
        { value: "disabled", label: "Disabled" }
    ], persistence.persisted ? "enabled" : "disabled");
    persistenceSelect.disabled = persistence.persisted || !persistence.canRequest;
    const persistenceField = makeField("Persistent browser storage", persistenceSelect);
    const persistenceHelp = document.createElement("p");
    persistenceHelp.className = "tiny settings-preference-help";
    if (persistence.persisted) persistenceHelp.textContent = "Your web browser protects the current OpenMCAT data from automated deletions. Websites (including OpenMCAT) cannot revoke this protection after it is granted. OpenMCAT data backups are still recommended.";
    else if (persistence.canRequest) persistenceHelp.textContent = "When enabled, your web browser is asked to protect the current OpenMCAT data from automated deletions. Your web browser ultimately decides whether to grant the request. OpenMCAT data backups are still recommended.";
    else persistenceHelp.textContent = "Your web browser cannot protect the current OpenMCAT data from automated deletions. The current OpenMCAT data will continue to work normally. OpenMCAT data backups are still recommended.";
    persistenceField.append(persistenceHelp);
    appearanceCard.append(makeField("Data backup reminder when snoozed", snoozedTimingSelect), makeField("Data backup reminder when completed", completedTimingSelect), persistenceField);
    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-primary";
    saveButton.textContent = "Save settings";
    saveButton.addEventListener("click", () => {
        actions.saveAppSettings(
            {
                ...state.settings,
                theme: themeSelect.value,
                backupReminderSnoozedTiming: snoozedTimingSelect.value,
                backupReminderCompletedTiming: completedTimingSelect.value
            },
            {
                enablePersistentStorage: persistenceSelect.value === "enabled"
            }
        );
    });
    appearanceCard.append(saveButton);
    const dataCard = document.createElement("section");
    dataCard.className = "card card-pad settings-data-card";
    const dataHelp = document.createElement("p");
    dataHelp.className = "muted-note";
    dataHelp.textContent = "OpenMCAT stores no data on any server. All of the current OpenMCAT data is privately located in your own web browser. Use the controls below to backup, share, restore, merge, or delete the current OpenMCAT data.";
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
    exportButton.addEventListener("click", () => actions.openSettingsDataConfirmation("backup"));
    const shareButton = document.createElement("button");
    shareButton.className = "btn btn-secondary";
    shareButton.textContent = "Share data";
    shareButton.addEventListener("click", () => actions.openSettingsDataConfirmation("share"));
    const restoreGroup = makeDataGroup("Restore data", "Replace the current OpenMCAT data with one backup from your device.");
    const importInput = document.createElement("input");
    importInput.id = "restore-file";
    importInput.className = "settings-file-input";
    importInput.type = "file";
    importInput.accept = ".json,.txt,application/json,text/plain";
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
        importButton.disabled = true;
        readFileText(file).then((text) => actions.prepareDataRestore({ name: file.name, size: file.size, text })).catch((error) => { alert(`Import failed: ${error.message}`); }).finally(() => { importButton.disabled = false; });
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
    combineInput.accept = ".json,.txt,application/json,text/plain";
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
        combinePicker.textContent = files.length ? `${files.length} ${files.length === 1 ? "file" : "files"} selected` : "Choose file";
        combineButton.disabled = !files.length;
    });
    combineButton.addEventListener("click", () => {
        const files = Array.from(combineInput.files ?? []);
        if (!files.length) return;
        combineButton.disabled = true;
        Promise.all(files.map(async (file) => ({ name: file.name, size: file.size, text: await readFileText(file) }))).then((sources) => actions.prepareDataMerge(sources)).catch((error) => { alert(`Merge failed: ${error.message}`); }).finally(() => { combineButton.disabled = false; });
    });
    const combineRow = document.createElement("div");
    combineRow.className = "settings-import-row";
    combineRow.append(combineInput, combinePicker, combineButton);
    combineGroup.append(combineRow);
    const deleteGroup = makeDataGroup("Delete data", "Delete the current OpenMCAT data. This action cannot be undone, unless you have a backup on your device.");
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-ghost settings-delete-button";
    deleteButton.textContent = "Delete data";
    deleteButton.addEventListener("click", () => actions.openSettingsDataConfirmation("delete"));
    deleteGroup.append(deleteButton);
    dataActions.append(exportButton);
    if (state.backupSharingSupported) dataActions.append(shareButton);
    dataActions.append(restoreGroup, combineGroup, deleteGroup);
    dataCard.append(dataActions);
    layout.append(appearanceCard, dataCard);
    root.append(layout);
    const confirmationModal = renderDataConfirmationModal(state, actions);
    if (confirmationModal) root.append(confirmationModal);
    return root;
};
