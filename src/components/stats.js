export const createStatCard = (label, value, hint = "") => {
    const card = document.createElement("article");
    card.className = "card card-pad stat-card";
    const title = document.createElement("h3");
    title.textContent = label;
    const val = document.createElement("p");
    val.textContent = value;
    card.append(title, val);
    if (hint) {
        const helper = document.createElement("p");
        helper.className = "tiny";
        helper.textContent = hint;
        card.append(helper);
    }
    return card;
}
