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

export const createPassageTable = (tableData) => {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const title = document.createElement("p");
    title.className = "tiny";
    title.textContent = tableData.caption;
    wrap.append(title);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    tableData.columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column;
        headRow.append(th);
    });
    thead.append(headRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    tableData.rows.forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((value) => {
            const td = document.createElement("td");
            td.textContent = value;
            tr.append(td);
        });
        tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    return wrap;
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
    const card = document.createElement("article");
    card.className = options.className ?? "card card-pad passage-card";
    const passageTitle = document.createElement("h3");
    const title = getPassageCardTitle(passage, options);
    passageTitle.textContent = title;
    card.append(passageTitle);
    if ((options.passageNumber || Array.isArray(options.questionNumbers)) && passage.title) {
        const originalTitle = document.createElement("p");
        originalTitle.className = "tiny passage-original-title";
        originalTitle.textContent = passage.title;
        card.append(originalTitle);
    }
    const passageText = document.createElement("p");
    passageText.className = "passage-text";
    passageText.textContent = passage.text ?? "";
    card.append(passageText);
    (passage.tables ?? []).forEach((tableData) => { card.append(createPassageTable(tableData)); });
    (passage.figureDescriptions ?? []).forEach((figure) => {
        const figureCard = document.createElement("div");
        figureCard.className = "card card-pad";
        figureCard.style.marginTop = "0.5rem";
        const figureHeading = document.createElement("p");
        figureHeading.className = "tiny";
        figureHeading.textContent = figure.caption;
        const figureText = document.createElement("p");
        figureText.textContent = figure.description;
        figureCard.append(figureHeading, figureText);
        card.append(figureCard);
    });
    return card;
};
