export const createStatCard = (label, value, hint = "") => {
    const card = document.createElement("article");
    card.className = "stat-card";
    const title = document.createElement("h3");
    title.textContent = label;
    const val = document.createElement("p");
    val.className = "stat-value";
    val.textContent = value;
    card.append(title, val);
    if (hint) {
        const helper = document.createElement("p");
        helper.className = "stat-hint";
        helper.textContent = hint;
        card.append(helper);
    }
    return card;
}
