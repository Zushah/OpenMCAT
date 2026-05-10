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
