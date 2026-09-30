const TOAST_LIFETIME_MS = 3600;
const TOAST_EXIT_MS = 120;

export const showToast = (message, type = "info") => {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const toast = document.createElement("div");
    toast.className = `toast is-${type === "error" || type === "success" ? type : "info"}`;
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("is-leaving");
        setTimeout(() => { toast.remove(); }, TOAST_EXIT_MS);
    }, TOAST_LIFETIME_MS - TOAST_EXIT_MS);
};
