const HIGHLIGHT_TARGET_SELECTOR = "[data-highlight-target-key]";

const toOffset = (value) => { const number = Number(value); return Number.isFinite(number) ? Math.floor(number) : null; };

const clampOffset = (value, max) => Math.min(max, Math.max(0, value));

const getKeyPart = (value) => String(value ?? "");

export const getPassageHighlightScopeKey = (passageId) => `passage:${getKeyPart(passageId)}`;

export const getPassageTitleHighlightKey = (passageId) => `passage:${getKeyPart(passageId)}:title`;

export const getPassageTextHighlightKey = (passageId) => `passage:${getKeyPart(passageId)}:text`;

export const getPassageTableCaptionHighlightKey = (passageId, tableId) => `passage:${getKeyPart(passageId)}:table:${getKeyPart(tableId)}:caption`;

export const getPassageTableColumnHighlightKey = (passageId, tableId, columnIndex) => `passage:${getKeyPart(passageId)}:table:${getKeyPart(tableId)}:column:${getKeyPart(columnIndex)}`;

export const getPassageTableCellHighlightKey = (passageId, tableId, rowIndex, columnIndex) => `passage:${getKeyPart(passageId)}:table:${getKeyPart(tableId)}:cell:${getKeyPart(rowIndex)}:${getKeyPart(columnIndex)}`;

export const getPassageChartCaptionHighlightKey = (passageId, chartId) => `passage:${getKeyPart(passageId)}:chart:${getKeyPart(chartId)}:caption`;

export const getPassageFigureCaptionHighlightKey = (passageId, figureId) => `passage:${getKeyPart(passageId)}:figure:${getKeyPart(figureId)}:caption`;

export const getPassageFigureDescriptionHighlightKey = (passageId, figureId) => `passage:${getKeyPart(passageId)}:figure:${getKeyPart(figureId)}:description`;

export const getQuestionHighlightScopeKey = (questionId) => `question:${getKeyPart(questionId)}`;

export const getQuestionStemHighlightKey = (questionId) => `question:${getKeyPart(questionId)}:stem`;

export const getQuestionTableCaptionHighlightKey = (questionId, tableId) => `question:${getKeyPart(questionId)}:table:${getKeyPart(tableId)}:caption`;

export const getQuestionTableColumnHighlightKey = (questionId, tableId, columnIndex) => `question:${getKeyPart(questionId)}:table:${getKeyPart(tableId)}:column:${getKeyPart(columnIndex)}`;

export const getQuestionTableCellHighlightKey = (questionId, tableId, rowIndex, columnIndex) => `question:${getKeyPart(questionId)}:table:${getKeyPart(tableId)}:cell:${getKeyPart(rowIndex)}:${getKeyPart(columnIndex)}`;

export const getQuestionChartCaptionHighlightKey = (questionId, chartId) => `question:${getKeyPart(questionId)}:chart:${getKeyPart(chartId)}:caption`;

export const getQuestionFigureCaptionHighlightKey = (questionId, figureId) => `question:${getKeyPart(questionId)}:figure:${getKeyPart(figureId)}:caption`;

export const getQuestionFigureDescriptionHighlightKey = (questionId, figureId) => `question:${getKeyPart(questionId)}:figure:${getKeyPart(figureId)}:description`;

export const getQuestionChoiceHighlightKey = (questionId, choiceId) => `question:${getKeyPart(questionId)}:choice:${getKeyPart(choiceId)}`;

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

const appendTextSegment = (element, text, highlighted = false, struck = false) => {
    if (!text) return;
    let node = document.createTextNode(text);
    if (struck) { const strike = document.createElement("s"); strike.className = "strikethrough-mark"; strike.append(node); node = strike; }
    if (highlighted) { const mark = document.createElement("mark"); mark.className = "highlight-mark"; mark.append(node); node = mark; }
    element.append(node);
};

const isOffsetInRanges = (ranges, offset) => ranges.some((range) => range.start <= offset && offset < range.end);

export const isTextFullyCovered = (ranges = [], text = "") => {
    const sourceText = String(text ?? "");
    const normalizedRanges = normalizeHighlightRanges(ranges, sourceText.length);
    if (!normalizedRanges.length || !/\S/.test(sourceText)) return false;
    for (let index = 0; index < sourceText.length; index += 1) if (!/\s/.test(sourceText[index]) && !isOffsetInRanges(normalizedRanges, index)) return false;
    return true;
};

export const createHighlightableText = ({ tagName = "p", className = "", text = "", targetKey = "", scopeKey = "", ranges = [], strikethroughRanges = [] } = {}) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (targetKey) { element.dataset.highlightTargetKey = targetKey; element.dataset.highlightScopeKey = scopeKey || targetKey; }
    const sourceText = String(text ?? "");
    const highlightRanges = normalizeHighlightRanges(ranges, sourceText.length);
    const strikeRanges = normalizeHighlightRanges(strikethroughRanges, sourceText.length);
    if (!highlightRanges.length && !strikeRanges.length) { element.textContent = sourceText; return element; }
    const boundaries = Array.from(new Set([0, sourceText.length, ...[...highlightRanges, ...strikeRanges].flatMap((range) => [range.start, range.end])])).sort((a, b) => a - b);
    let segment = null;
    const flush = () => { if (segment) appendTextSegment(element, sourceText.slice(segment.start, segment.end), segment.highlighted, segment.struck); };
    boundaries.slice(0, -1).forEach((start, index) => {
        const end = boundaries[index + 1];
        const highlighted = isOffsetInRanges(highlightRanges, start), struck = isOffsetInRanges(strikeRanges, start);
        if (segment && segment.highlighted === highlighted && segment.struck === struck) { segment.end = end; return; }
        flush();
        segment = { start, end, highlighted, struck };
    });
    flush();
    return element;
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

const getHighlightScopeKey = (target) => target?.dataset.highlightScopeKey || target?.dataset.highlightTargetKey || "";

const targetIntersectsRange = (range, target) => { try { return range.intersectsNode(target); } catch (error) { return false; } };

const getSelectedTargetRange = (range, target) => {
    const targetKey = target.dataset.highlightTargetKey;
    if (!targetKey) return null;
    const text = target.textContent ?? "";
    let start = 0;
    let end = text.length;
    if (target.contains(range.startContainer)) { const offset = getOffsetWithinTarget(target, range.startContainer, range.startOffset); if (offset === null) return null; start = offset; }
    if (target.contains(range.endContainer)) { const offset = getOffsetWithinTarget(target, range.endContainer, range.endOffset); if (offset === null) return null; end = offset; }
    const selectedRange = trimWhitespace(text, { start: Math.min(start, end), end: Math.max(start, end) });
    if (selectedRange.end <= selectedRange.start) return null;
    return { targetKey, ...selectedRange };
};

export const getSelectionHighlightRanges = () => {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return [];
    const range = selection.getRangeAt(0);
    const selected = Array.from(document.querySelectorAll(HIGHLIGHT_TARGET_SELECTOR)).filter((target) => targetIntersectsRange(range, target)).map((target) => ({ target, selectedRange: getSelectedTargetRange(range, target) })).filter((item) => item.selectedRange);
    const scopeKey = getHighlightScopeKey(selected[0]?.target);
    if (!scopeKey || selected.some((item) => getHighlightScopeKey(item.target) !== scopeKey)) return [];
    return selected.map((item) => item.selectedRange);
};

export const getSelectionHighlightRange = () => getSelectionHighlightRanges()[0] ?? null;

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
