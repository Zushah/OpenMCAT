export const copyTextToClipboard = async (text) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) try { await navigator.clipboard.writeText(text); return; } catch { }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    try { const copied = document.execCommand("copy"); if (!copied) throw new Error("Copy failed"); }
    finally { textarea.remove(); }
};
