let activeDialog = null;

export const closeModal = () => {
    if (activeDialog) {
        activeDialog.close();
        activeDialog.remove();
        activeDialog = null;
    }
};

export const openTextModal = ({ title, content }) => {
    closeModal();
    const root = document.getElementById("modal-root");
    if (!root) return;
    const dialog = document.createElement("dialog");
    dialog.className = "generation-pipeline-panel text-modal";
    const form = document.createElement("form");
    form.method = "dialog";
    const top = document.createElement("div");
    top.className = "generation-pipeline-top";
    const heading = document.createElement("h2");
    heading.textContent = title;
    top.append(heading);
    const output = document.createElement("textarea");
    output.readOnly = true;
    output.rows = 16;
    output.value = content;
    const row = document.createElement("div");
    row.className = "dialog-actions";
    const closeButton = document.createElement("button");
    closeButton.className = "btn btn-secondary";
    closeButton.value = "cancel";
    closeButton.textContent = "Close";
    row.append(closeButton);
    form.append(top, output, row);
    dialog.append(form);
    root.append(dialog);
    dialog.addEventListener("close", closeModal, { once: true });
    dialog.showModal();
    activeDialog = dialog;
};
