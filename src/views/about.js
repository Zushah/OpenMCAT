export const renderAboutView = () => {
    const root = document.createElement("section");
    const hero = document.createElement("section");
    hero.className = "hero";
    const title = document.createElement("h1");
    title.textContent = "About OpenMCAT";
    const sub = document.createElement("p");
    sub.textContent = "OpenMCAT is a free MCAT study tool focused on efficient studying and helpful analytics.";
    hero.append(title, sub);
    root.append(hero);
    const grid = document.createElement("section");
    grid.className = "grid-two";
    const whatItIs = document.createElement("article");
    whatItIs.className = "card card-pad";
    const isTitle = document.createElement("h2");
    isTitle.textContent = "What OpenMCAT is";
    const isList = document.createElement("ul");
    [
        "A free and independent study tool for targeted MCAT practice.",
        "A privacy-first website with no account system and no data collection.",
        "A configurable workflow that supports any AI of your choice.",
        "A way to drill topics and skills and seriously review your weak areas."
    ].forEach((line) => { const li = document.createElement("li"); li.textContent = line; isList.append(li); });
    whatItIs.append(isTitle, isList);
    const whatItIsNot = document.createElement("article");
    whatItIsNot.className = "card card-pad";
    const notTitle = document.createElement("h2");
    notTitle.textContent = "What OpenMCAT is not";
    const notList = document.createElement("ul");
    [
        "Not affiliated with the AAMC.",
        "Not official MCAT practice material.",
        "Not an MCAT score predictor.",
        "Not a medical advice or treatment system."
    ].forEach((line) => { const li = document.createElement("li"); li.textContent = line; notList.append(li); });
    whatItIsNot.append(notTitle, notList);
    grid.append(whatItIs, whatItIsNot);
    root.append(grid);
    const disclaimer = document.createElement("section");
    disclaimer.className = "card card-pad";
    disclaimer.style.marginTop = "1rem";
    const disclaimerTitle = document.createElement("h2");
    disclaimerTitle.textContent = "Disclaimer";
    const disclaimerText = document.createElement("p");
    disclaimerText.textContent = "OpenMCAT is an independent free-and-open-source study tool. It is not affiliated with, endorsed by, or sponsored by the Association of American Medical Colleges (AAMC). MCAT is a registered trademark of the AAMC. OpenMCAT generates AI-powered practice sessions for drilling topics and skills. It is not intended to be used as a substitute for official AAMC practice materials and it does not guarantee any particular MCAT score.";
    const aiNote = document.createElement("p");
    aiNote.textContent = "OpenMCAT uses generative AI for its practice questions. Use them for drilling and review but verify uncertain explanations. Use <a href=\"https://store.aamc.org/online-only-official-mcat-prep-bundle.html\" target=\"_blank\" rel=\"noreferrer noopener\">official AAMC materials</a> for representative MCAT practice.";
    const privacy = document.createElement("p");
    privacy.textContent = "OpenMCAT highly values your privacy. Therefore, it only stores your data in your own web browser. No account is required. You can export and import your data via JSON files using the controls on the settings page.";
    const github = document.createElement("p");
    const githubLink = document.createElement("a");
    githubLink.href = "https://github.com/Zushah/OpenMCAT";
    githubLink.target = "_blank";
    githubLink.rel = "noreferrer noopener";
    githubLink.textContent = "OpenMCAT has its source code openly available on a GitHub repository under the AGPL-3.0 license.";
    github.append(githubLink);
    disclaimer.append(disclaimerTitle, disclaimerText, aiNote, privacy, github);
    const linksHeading = document.createElement("h3");
    linksHeading.textContent = "AAMC official reference links";
    const links = document.createElement("ul");
    const references = [
        {
            label: "AAMC MCAT topics overview",
            href: "https://students-residents.aamc.org/prepare-mcat-exam/whats-mcat-exam-pdf-outline"},
        {
            label: "AAMC MCAT skills overview",
            href: "https://students-residents.aamc.org/whats-mcat-exam/scientific-inquiry-reasoning-skills-overview"},
        {
            label: "AAMC MCAT CARS overview",
            href: "https://students-residents.aamc.org/whats-mcat-exam/critical-analysis-and-reasoning-skills-section-overview"
        }
    ];
    references.forEach((reference) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = reference.href;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.textContent = reference.label;
        item.append(link);
        links.append(item);
    });
    disclaimer.append(linksHeading, links);
    root.append(disclaimer);
    return root;
};
