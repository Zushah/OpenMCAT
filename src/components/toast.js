const TOAST_LIFETIME_MS = 3600;

export const showToast = (message, type = "info") => {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "error") toast.style.borderColor = "color-mix(in srgb, var(--danger), transparent 45%)";
    if (type === "success") toast.style.borderColor = "color-mix(in srgb, var(--success), transparent 45%)";
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => { toast.remove(); }, TOAST_LIFETIME_MS);
};
