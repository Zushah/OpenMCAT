export const renderAboutView = () => {
    const root = document.createElement("section");
    const hero = document.createElement("section");
    hero.className = "hero";
    const title = document.createElement("h1");
    title.textContent = "About OpenMCAT";
    const sub = document.createElement("p");
    sub.textContent = "OpenMCAT is a local-first, open-source MCAT practice generator focused on targeted drilling and helpful analytics.";
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
        "A free-and-open-source study tool for targeted MCAT-style practice.",
        "A local-first app with no account system and no server-side analytics.",
        "A configurable workflow that supports your own AI provider choice.",
        "A way to drill weak content/skill areas and review timing trends."
    ].forEach((line) => { const li = document.createElement("li"); li.textContent = line; isList.append(li); });
    whatItIs.append(isTitle, isList);
    const whatItIsNot = document.createElement("article");
    whatItIsNot.className = "card card-pad";
    const notTitle = document.createElement("h2");
    notTitle.textContent = "What OpenMCAT is not";
    const notList = document.createElement("ul");
    [
        "Not affiliated with the Association of American Medical Colleges (AAMC).",
        "Not official AAMC practice material.",
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
    disclaimerText.textContent = "OpenMCAT is an independent free-and-open-source study tool. It is not affiliated with, endorsed by, or sponsored by the Association of American Medical Colleges (AAMC). MCAT is a registered trademark of the AAMC. OpenMCAT generates AI-powered practice for content drilling and reasoning practice. It is not intended to be used as a substitute for official AAMC practice materials and it does not predict MCAT scores.";
    const aiNote = document.createElement("p");
    aiNote.textContent = "AI-generated practice. Verify explanations when uncertain. Use official AAMC materials for representative exam practice.";
    const privacy = document.createElement("p");
    privacy.textContent = "Privacy: OpenMCAT only stores your data in your own browser. No account or telemetry is required. Prompts only go to the provider you configure.";
    const github = document.createElement("p");
    const githubLink = document.createElement("a");
    githubLink.href = "https://github.com/Zushah/OpenMCAT";
    githubLink.target = "_blank";
    githubLink.rel = "noreferrer noopener";
    githubLink.textContent = "GitHub repository";
    github.append(githubLink);
    disclaimer.append(disclaimerTitle, disclaimerText, aiNote, privacy, github);
    const linksHeading = document.createElement("h3");
    linksHeading.textContent = "Official reference links";
    const links = document.createElement("ul");
    const references = [
        {
            label: "AAMC MCAT content outline overview",
            href: "https://students-residents.aamc.org/prepare-mcat-exam/whats-mcat-exam-pdf-outline"},
        {
            label: "AAMC Scientific Inquiry and Reasoning Skills PDF",
            href: "https://students-residents.aamc.org/media/9061/download"},
        {
            label: "AAMC CARS overview",
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
