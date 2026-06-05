const HIGHLIGHT_TARGET_SELECTOR = "[data-highlight-target-key]";

const toOffset = (value) => { const number = Number(value); return Number.isFinite(number) ? Math.floor(number) : null; };

const clampOffset = (value, max) => Math.min(max, Math.max(0, value));

export const getPassageTextHighlightKey = (passageId) => `passage:${String(passageId ?? "")}:text`;

export const getQuestionStemHighlightKey = (questionId) => `question:${String(questionId ?? "")}:stem`;

export const normalizeHighlightRanges = (ranges = [], textLength = Infinity) => {
    const max = Number.isFinite(textLength) ? Math.max(0, Math.floor(textLength)) : Infinity;
    const normalized = (Array.isArray(ranges) ? ranges : []).map((range) => {
        const rawStart = toOffset(range?.start), rawEnd = toOffset(range?.end);
        if (rawStart === null || rawEnd === null) return null;
        const start = clampOffset(Math.min(rawStart, rawEnd), max), end = clampOffset(Math.max(rawStart, rawEnd), max);
        return end > start ? { start, end } : null;
    }).filter(Boolean).sort((a, b) => a.start - b.start || a.end - b.end);
    return normalized.reduce((merged, range) => {
        const previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
        else merged.push({ ...range });
        return merged;
    }, []);
};

const appendTextSegment = (element, text, highlighted = false) => {
    if (!text) return;
    if (!highlighted) { element.append(document.createTextNode(text)); return; }
    const mark = document.createElement("mark");
    mark.className = "highlight-mark";
    mark.append(document.createTextNode(text));
    element.append(mark);
};

export const createHighlightableText = ({ tagName = "p", className = "", text = "", targetKey = "", ranges = [] } = {}) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (targetKey) element.dataset.highlightTargetKey = targetKey;
    const sourceText = String(text ?? "");
    const normalizedRanges = normalizeHighlightRanges(ranges, sourceText.length);
    if (!normalizedRanges.length) { element.textContent = sourceText; return element; }
    let cursor = 0;
    normalizedRanges.forEach((range) => {
        appendTextSegment(element, sourceText.slice(cursor, range.start), false);
        appendTextSegment(element, sourceText.slice(range.start, range.end), true);
        cursor = range.end;
    });
    appendTextSegment(element, sourceText.slice(cursor), false);
    return element;
};

const getHighlightTarget = (node) => {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest?.(HIGHLIGHT_TARGET_SELECTOR) ?? null;
};

const getOffsetWithinTarget = (target, container, offset) => {
    const offsetRange = document.createRange();
    try { offsetRange.selectNodeContents(target); offsetRange.setEnd(container, offset); return offsetRange.toString().length; }
    catch (error) { return null; }
    finally { offsetRange.detach?.(); }
};

const trimWhitespace = (text, range) => {
    let start = range.start, end = range.end;
    while (start < end && /\s/.test(text[start])) start += 1;
    while (end > start && /\s/.test(text[end - 1])) end -= 1;
    return { start, end };
};

export const getSelectionHighlightRange = () => {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const startTarget = getHighlightTarget(range.startContainer), endTarget = getHighlightTarget(range.endContainer);
    if (!startTarget || !endTarget || startTarget !== endTarget) return null;
    const targetKey = startTarget.dataset.highlightTargetKey;
    if (!targetKey) return null;
    const rawStart = getOffsetWithinTarget(startTarget, range.startContainer, range.startOffset), rawEnd = getOffsetWithinTarget(startTarget, range.endContainer, range.endOffset);
    if (rawStart === null || rawEnd === null) return null;
    const text = startTarget.textContent ?? "";
    const selectedRange = trimWhitespace(text, { start: Math.min(rawStart, rawEnd), end: Math.max(rawStart, rawEnd) });
    if (selectedRange.end <= selectedRange.start) return null;
    return { targetKey, ...selectedRange };
};

export const toggleHighlightRange = (ranges = [], selectedRange = {}) => {
    const selection = normalizeHighlightRanges([selectedRange])[0];
    const existingRanges = normalizeHighlightRanges(ranges);
    if (!selection) return existingRanges;
    const hasOverlap = existingRanges.some((range) => range.start < selection.end && selection.start < range.end);
    if (!hasOverlap) return normalizeHighlightRanges([...existingRanges, selection]);
    const nextRanges = [];
    existingRanges.forEach((range) => {
        if (range.end <= selection.start || selection.end <= range.start) { nextRanges.push(range); return; }
        if (range.start < selection.start) nextRanges.push({ start: range.start, end: Math.min(selection.start, range.end) });
        if (selection.end < range.end) nextRanges.push({ start: Math.max(selection.end, range.start), end: range.end });
    });
    return normalizeHighlightRanges(nextRanges);
};
