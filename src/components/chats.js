import { AI_CHAT_SHORTCUTS } from "../data/chats.js";

export const createAiChatShortcuts = () => {
    const shortcuts = document.createElement("nav");
    shortcuts.className = "generation-pipeline-shortcuts";
    shortcuts.setAttribute("aria-label", "Open an AI chat");
    AI_CHAT_SHORTCUTS.forEach((shortcut) => {
        const link = document.createElement("a");
        link.className = "btn btn-secondary generation-pipeline-shortcut";
        link.href = shortcut.href;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("aria-label", `Open ${shortcut.name} in a new tab`);
        const shortcutIcon = document.createElement("img");
        shortcutIcon.className = "generation-pipeline-shortcut-icon";
        shortcutIcon.src = shortcut.icon;
        shortcutIcon.alt = "";
        shortcutIcon.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = shortcut.name;
        link.append(shortcutIcon, label);
        shortcuts.append(link);
    });
    return shortcuts;
};
