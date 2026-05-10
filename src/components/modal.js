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
    dialog.className = "card card-pad";
    dialog.style.maxWidth = "860px";
    dialog.style.width = "95vw";
    dialog.style.borderColor = "var(--border)";
    dialog.style.background = "var(--bg-card-solid)";
    const form = document.createElement("form");
    form.method = "dialog";
    form.style.display = "grid";
    form.style.gap = "12px";
    const heading = document.createElement("h2");
    heading.style.margin = "0";
    heading.textContent = title;
    const output = document.createElement("textarea");
    output.readOnly = true;
    output.rows = 16;
    output.style.width = "100%";
    output.style.whiteSpace = "pre";
    output.style.fontFamily = "ui-monospace, monospace";
    output.value = content;
    const row = document.createElement("div");
    row.className = "button-row";
    const closeButton = document.createElement("button");
    closeButton.className = "btn btn-secondary";
    closeButton.value = "cancel";
    closeButton.textContent = "Close";
    row.append(closeButton);
    form.append(heading, output, row);
    dialog.append(form);
    root.append(dialog);
    dialog.addEventListener("close", closeModal, { once: true });
    dialog.showModal();
    activeDialog = dialog;
};
