export const AI_CHAT_SHORTCUTS = [
    { name: "ChatGPT", href: "https://chatgpt.com/", icon: "./assets/images/chatgpt.svg" },
    { name: "Claude", href: "https://claude.ai/new", icon: "./assets/images/claude.svg" },
    { name: "DeepSeek", href: "https://chat.deepseek.com/", icon: "./assets/images/deepseek.svg" }
];

export const AI_AGENT_TOOLS = ["Claude Code", "Claude Cowork", "ChatGPT Codex", "ChatGPT Work"];

export const WALKTHROUGH_VIDEO_WARNING_THRESHOLD = 15;

export const formatList = (items) => items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
