import { createHighlightableText, getPassageFigureCaptionHighlightKey, getPassageFigureDescriptionHighlightKey, getPassageHighlightScopeKey, getPassageTableCaptionHighlightKey, getPassageTableCellHighlightKey, getPassageTableColumnHighlightKey, getPassageTextHighlightKey, getPassageTitleHighlightKey, getQuestionFigureCaptionHighlightKey, getQuestionFigureDescriptionHighlightKey, getQuestionHighlightScopeKey, getQuestionTableCaptionHighlightKey, getQuestionTableCellHighlightKey, getQuestionTableColumnHighlightKey } from "./highlights.js";
import { createStimulusChart } from "./charts.js";

export const createChoiceCard = (choice, { selectedId, submitted, correctId }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card";
    button.dataset.choiceId = choice.id;
    button.setAttribute("aria-pressed", selectedId === choice.id ? "true" : "false");
    if (selectedId === choice.id) button.classList.add("is-selected");
    if (submitted) {
        if (choice.id === correctId) {
            button.classList.add("is-correct");
            button.setAttribute("aria-label", `${choice.id}. ${choice.text}. Correct answer.`);
        } else if (selectedId === choice.id && selectedId !== correctId) {
            button.classList.add("is-incorrect");
            button.setAttribute("aria-label", `${choice.id}. ${choice.text}. Your selected answer, incorrect.`);
        } else button.setAttribute("aria-label", `${choice.id}. ${choice.text}.`);
    } else button.setAttribute("aria-label", `${choice.id}. ${choice.text}`);
    const label = document.createElement("span");
    label.className = "choice-label";
    label.textContent = `${choice.id}.`;
    const text = document.createElement("span");
    text.textContent = choice.text;
    button.append(label, text);
    return button;
}

const getStableContentId = (item, index, fallbackPrefix) => String(item?.id || `${fallbackPrefix}${index + 1}`);

const getHighlightRanges = (highlightRangesByTargetKey = {}, targetKey) => highlightRangesByTargetKey[targetKey] ?? [];

const getStimulusHighlightKeys = (surface) => surface === "question" ? {
    getScopeKey: getQuestionHighlightScopeKey,
    getTableCaptionKey: getQuestionTableCaptionHighlightKey,
    getTableColumnKey: getQuestionTableColumnHighlightKey,
    getTableCellKey: getQuestionTableCellHighlightKey,
    getFigureCaptionKey: getQuestionFigureCaptionHighlightKey,
    getFigureDescriptionKey: getQuestionFigureDescriptionHighlightKey
} : {
    getScopeKey: getPassageHighlightScopeKey,
    getTableCaptionKey: getPassageTableCaptionHighlightKey,
    getTableColumnKey: getPassageTableColumnHighlightKey,
    getTableCellKey: getPassageTableCellHighlightKey,
    getFigureCaptionKey: getPassageFigureCaptionHighlightKey,
    getFigureDescriptionKey: getPassageFigureDescriptionHighlightKey
};

export const createStimulusTable = (tableData, options = {}) => {
    const highlightRangesByTargetKey = options.highlightRangesByTargetKey ?? {};
    const ownerId = options.ownerId ?? "";
    const highlightKeys = getStimulusHighlightKeys(options.surface);
    const scopeKey = options.scopeKey ?? highlightKeys.getScopeKey(ownerId);
    const tableId = getStableContentId(tableData, options.tableIndex ?? 0, "table");
    const wrap = document.createElement("div");
    const surfaceClass = options.surface === "question" ? "question" : "passage";
    wrap.className = `table-wrap stimulus-table stimulus-table--${surfaceClass}`;
    const captionKey = highlightKeys.getTableCaptionKey(ownerId, tableId);
    const title = createHighlightableText({
        tagName: "p",
        className: "tiny",
        text: tableData.caption,
        targetKey: captionKey,
        scopeKey,
        ranges: getHighlightRanges(highlightRangesByTargetKey, captionKey)
    });
    wrap.append(title);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    (tableData.columns ?? []).forEach((column, columnIndex) => {
        const columnKey = highlightKeys.getTableColumnKey(ownerId, tableId, columnIndex);
        const th = createHighlightableText({
            tagName: "th",
            text: column,
            targetKey: columnKey,
            scopeKey,
            ranges: getHighlightRanges(highlightRangesByTargetKey, columnKey)
        });
        headRow.append(th);
    });
    thead.append(headRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    (tableData.rows ?? []).forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        row.forEach((value, columnIndex) => {
            const cellKey = highlightKeys.getTableCellKey(ownerId, tableId, rowIndex, columnIndex);
            const td = createHighlightableText({
                tagName: "td",
                text: value,
                targetKey: cellKey,
                scopeKey,
                ranges: getHighlightRanges(highlightRangesByTargetKey, cellKey)
            });
            tr.append(td);
        });
        tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    return wrap;
};

export const createPassageTable = (tableData, options = {}) => createStimulusTable(tableData, {
    ...options,
    ownerId: options.passageId ?? options.ownerId,
    surface: "passage"
});

export const createStimulusFigureDescription = (figure, options = {}) => {
    const highlightRangesByTargetKey = options.highlightRangesByTargetKey ?? {};
    const ownerId = options.ownerId ?? "";
    const highlightKeys = getStimulusHighlightKeys(options.surface);
    const scopeKey = options.scopeKey ?? highlightKeys.getScopeKey(ownerId);
    const figureId = getStableContentId(figure, options.figureIndex ?? 0, "figure");
    const figureCard = document.createElement("div");
    const surfaceClass = options.surface === "question" ? "question" : "passage";
    figureCard.className = `card card-pad stimulus-figure-description stimulus-figure-description--${surfaceClass}`;
    const captionKey = highlightKeys.getFigureCaptionKey(ownerId, figureId);
    const figureHeading = createHighlightableText({
        tagName: "p",
        className: "tiny",
        text: figure.caption,
        targetKey: captionKey,
        scopeKey,
        ranges: getHighlightRanges(highlightRangesByTargetKey, captionKey)
    });
    const descriptionKey = highlightKeys.getFigureDescriptionKey(ownerId, figureId);
    const figureText = createHighlightableText({
        tagName: "p",
        text: figure.description,
        targetKey: descriptionKey,
        scopeKey,
        ranges: getHighlightRanges(highlightRangesByTargetKey, descriptionKey)
    });
    figureCard.append(figureHeading, figureText);
    return figureCard;
};

export const appendStimulusContent = (parent, stimulus, options = {}) => {
    const surface = options.surface === "question" ? "question" : "passage";
    const ownerId = options.ownerId ?? stimulus.id;
    (stimulus.tables ?? []).forEach((tableData, tableIndex) => {
        parent.append(createStimulusTable(tableData, { ...options, surface, ownerId, tableIndex }));
    });
    (stimulus.charts ?? []).forEach((chart) => {
        parent.append(createStimulusChart(chart, surface === "question" ? { surface: "question", defer: options.deferCharts === true } : { defer: options.deferCharts === true }));
    });
    (stimulus.figureDescriptions ?? []).forEach((figure, figureIndex) => {
        parent.append(createStimulusFigureDescription(figure, { ...options, surface, ownerId, figureIndex }));
    });
    return parent;
};

const formatQuestionNumberRanges = (questionNumbers = []) => {
    const source = Array.isArray(questionNumbers) ? questionNumbers : [];
    const numbers = Array.from(new Set(source.map(Number).filter(Number.isFinite))).sort((a, b) => a - b);
    if (!numbers.length) return "";
    const ranges = [];
    let start = numbers[0];
    let end = numbers[0];
    numbers.slice(1).forEach((number) => {
        if (number === end + 1) {
            end = number;
            return;
        }
        ranges.push(start === end ? String(start) : `${start} - ${end}`);
        start = number;
        end = number;
    });
    ranges.push(start === end ? String(start) : `${start} - ${end}`);
    const prefix = numbers.length === 1 ? "Question" : "Questions";
    return `${prefix} ${ranges.join(", ")}`;
};

export const createPassageMetadataById = (passages = [], questions = []) => {
    const passageIds = [];
    const addPassageId = (passageId) => {
        if (!passageId || passageIds.includes(passageId)) return;
        passageIds.push(passageId);
    };
    questions.forEach((question) => { addPassageId(question?.passageId); });
    passages.forEach((passage) => { addPassageId(passage?.id); });
    const metadataById = new Map(passageIds.map((passageId, index) => [passageId, {
        passageNumber: index + 1,
        questionNumbers: []
    }]));
    questions.forEach((question, index) => {
        if (!question?.passageId || !metadataById.has(question.passageId)) return;
        metadataById.get(question.passageId).questionNumbers.push(index + 1);
    });
    return metadataById;
};

export const getPassageCardTitle = (passage, options = {}) => {
    const hasNumberedTitle = options.passageNumber || Array.isArray(options.questionNumbers);
    if (!hasNumberedTitle) return passage.title ?? "Passage";
    const questionLabel = formatQuestionNumberRanges(options.questionNumbers);
    const passageLabel = options.passageNumber ? `Passage ${options.passageNumber}` : "Passage";
    return questionLabel ? `${passageLabel} (${questionLabel})` : passageLabel;
};

export const createPassageCard = (passage, options = {}) => {
    const highlightRangesByTargetKey = options.highlightRangesByTargetKey ?? {};
    const card = document.createElement("article");
    card.className = options.className ?? "card card-pad passage-card";
    const title = getPassageCardTitle(passage, options);
    const passageScopeKey = getPassageHighlightScopeKey(passage.id);
    const titleHighlightKey = getPassageTitleHighlightKey(passage.id);
    const hasNumberedTitle = options.passageNumber || Array.isArray(options.questionNumbers);
    if (hasNumberedTitle || !passage.title) {
        const passageTitle = document.createElement("h3");
        passageTitle.textContent = title;
        card.append(passageTitle);
    } else {
        card.append(createHighlightableText({
            tagName: "h3",
            text: title,
            targetKey: titleHighlightKey,
            scopeKey: passageScopeKey,
            ranges: getHighlightRanges(highlightRangesByTargetKey, titleHighlightKey)
        }));
    }
    if (hasNumberedTitle && passage.title) {
        const originalTitle = createHighlightableText({
            tagName: "p",
            className: "tiny passage-original-title",
            text: passage.title,
            targetKey: titleHighlightKey,
            scopeKey: passageScopeKey,
            ranges: getHighlightRanges(highlightRangesByTargetKey, titleHighlightKey)
        });
        card.append(originalTitle);
    }
    const passageHighlightKey = getPassageTextHighlightKey(passage.id);
    const passageText = createHighlightableText({
        tagName: "p",
        className: "passage-text",
        text: passage.text ?? "",
        targetKey: passageHighlightKey,
        scopeKey: passageScopeKey,
        ranges: getHighlightRanges(highlightRangesByTargetKey, passageHighlightKey)
    });
    card.append(passageText);
    appendStimulusContent(card, passage, {
        surface: "passage",
        ownerId: passage.id,
        scopeKey: passageScopeKey,
        highlightRangesByTargetKey,
        deferCharts: options.deferCharts === true
    });
    return card;
};
