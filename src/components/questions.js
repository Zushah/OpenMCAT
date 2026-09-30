import { createHighlightableText, getPassageFigureCaptionHighlightKey, getPassageFigureDescriptionHighlightKey, getPassageHighlightScopeKey, getPassageTableCaptionHighlightKey, getPassageTableCellHighlightKey, getPassageTableColumnHighlightKey, getPassageTextHighlightKey, getPassageTitleHighlightKey, getQuestionFigureCaptionHighlightKey, getQuestionFigureDescriptionHighlightKey, getQuestionHighlightScopeKey, getQuestionTableCaptionHighlightKey, getQuestionTableCellHighlightKey, getQuestionTableColumnHighlightKey } from "./highlights.js";
import { createStimulusChart } from "./charts.js";

const createChoiceContent = (element, choice, tagText = "") => {
    const label = document.createElement("span");
    label.className = "choice-label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = choice.id;
    const body = document.createElement("span");
    body.className = "choice-body";
    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = choice.text;
    body.append(text);
    if (tagText) {
        const tag = document.createElement("span");
        tag.className = "choice-tag";
        tag.setAttribute("aria-hidden", "true");
        tag.textContent = tagText;
        body.append(tag);
    }
    element.append(label, body);
    return element;
};

const getChoiceFeedback = (choice, { selectedId, submitted, correctId }) => {
    if (!submitted) return { className: selectedId === choice.id ? "is-selected" : "", tag: "", label: `${choice.id}. ${choice.text}` };
    if (choice.id === correctId) return { className: "is-correct", tag: "Correct answer", label: `${choice.id}. ${choice.text}. Correct answer.` };
    if (selectedId === choice.id && selectedId !== correctId) return { className: "is-incorrect", tag: "Your answer · incorrect", label: `${choice.id}. ${choice.text}. Your selected answer, incorrect.` };
    return { className: "", tag: "", label: `${choice.id}. ${choice.text}.` };
};

export const createChoiceCard = (choice, { selectedId, submitted, correctId }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card";
    button.dataset.choiceId = choice.id;
    button.setAttribute("aria-pressed", selectedId === choice.id ? "true" : "false");
    if (selectedId === choice.id) button.classList.add("is-selected");
    const feedback = getChoiceFeedback(choice, { selectedId, submitted, correctId });
    if (feedback.className && feedback.className !== "is-selected") button.classList.add(feedback.className);
    button.setAttribute("aria-label", feedback.label);
    return createChoiceContent(button, choice, feedback.tag);
}

export const createStaticChoiceList = (question, { selectedId = null, submitted = false } = {}) => {
    const list = document.createElement("ol");
    list.className = "choice-list is-static";
    list.setAttribute("aria-label", "Answer choices");
    (question.choices ?? []).forEach((choice) => {
        const item = document.createElement("li");
        item.className = "choice-card";
        item.dataset.choiceId = choice.id;
        const feedback = getChoiceFeedback(choice, { selectedId, submitted, correctId: question.correctChoiceId });
        if (feedback.className && feedback.className !== "is-selected") item.classList.add(feedback.className);
        const hidden = document.createElement("span");
        hidden.className = "visually-hidden";
        hidden.textContent = `${choice.id}. `;
        createChoiceContent(item, choice, feedback.tag);
        item.prepend(hidden);
        if (feedback.tag) {
            const spoken = document.createElement("span");
            spoken.className = "visually-hidden";
            spoken.textContent = ` ${feedback.tag}.`;
            item.append(spoken);
        }
        list.append(item);
    });
    return list;
};

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
    wrap.dataset.scrollKey = `table:${scopeKey}:${tableId}`;
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
    figureCard.className = `stimulus-figure-description stimulus-figure-description--${surfaceClass}`;
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
        ranges.push(start === end ? String(start) : `${start}–${end}`);
        start = number;
        end = number;
    });
    ranges.push(start === end ? String(start) : `${start}–${end}`);
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
    return questionLabel ? `${passageLabel} · ${questionLabel}` : passageLabel;
};

export const createPassageCard = (passage, options = {}) => {
    const highlightRangesByTargetKey = options.highlightRangesByTargetKey ?? {};
    const card = document.createElement("article");
    card.className = options.className ?? "passage-card";
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
            className: "passage-plain-title",
            text: title,
            targetKey: titleHighlightKey,
            scopeKey: passageScopeKey,
            ranges: getHighlightRanges(highlightRangesByTargetKey, titleHighlightKey)
        }));
    }
    if (hasNumberedTitle && passage.title) {
        const originalTitle = createHighlightableText({
            tagName: "p",
            className: "passage-original-title",
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
