const ICON_PATHS = {
    close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
    "chevron-left": '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
    "chevron-right": '<path d="M6 3.5L10.5 8 6 12.5"/>',
    "chevron-down": '<path d="M3.5 6L8 10.5 12.5 6"/>',
    "chevron-up": '<path d="M3.5 10L8 5.5l4.5 4.5"/>',
    pencil: '<path d="M10.5 2.5l3 3-8 8h-3v-3z"/><path d="M9 4l3 3"/>',
    restore: '<path d="M3.2 9.5A5 5 0 1 0 4.6 4.3"/><path d="M4.5 1.5v3h3"/>',
    "arrow-right": '<path d="M2 8h11"/><path d="M9.5 4.5L13 8l-3.5 3.5"/>',
    "arrow-left": '<path d="M14 8H3"/><path d="M6.5 4.5L3 8l3.5 3.5"/>',
    external: '<path d="M5.5 3.5h7v7"/><path d="M12.5 3.5l-9 9"/>',
    plus: '<path d="M8 2.5v11M2.5 8h11"/>',
    check: '<path d="M3 8.5l3 3 7-7"/>',
    alert: '<path d="M8 2.2l6.3 11.3H1.7z"/><path d="M8 6.5v3.2"/><path d="M8 11.4v.4"/>',
    info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.2v4.3"/><path d="M8 4.7v.4"/>'
};

const escapeAttribute = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export const iconMarkup = (name, { size = 16, label = "", className = "" } = {}) => {
    const paths = ICON_PATHS[name];
    if (!paths) return "";
    const classes = ["icon", className].filter(Boolean).join(" ");
    const a11y = label ? `role="img" aria-label="${escapeAttribute(label)}"` : 'aria-hidden="true"';
    return `<svg class="${classes}" data-icon="${name}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" focusable="false" ${a11y}>${paths}</svg>`;
};

export const icon = (name, options = {}) => {
    const template = document.createElement("template");
    template.innerHTML = iconMarkup(name, options);
    return template.content.firstElementChild;
};

export const withIcon = (element, text, name, { position = "end", size = 16 } = {}) => {
    const label = document.createElement("span");
    label.textContent = text;
    const glyph = icon(name, { size });
    if (position === "start") element.replaceChildren(glyph, label);
    else element.replaceChildren(label, glyph);
    return element;
};
