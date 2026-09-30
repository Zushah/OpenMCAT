const createExternalLink = (href, text) => {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = text;
    return link;
};

const createSection = (title) => {
    const section = document.createElement("section");
    section.className = "about-section";
    const heading = document.createElement("h2");
    heading.textContent = title;
    section.append(heading);
    return section;
};

const createList = (lines, className = "about-list") => {
    const list = document.createElement("ul");
    list.className = className;
    lines.forEach((line) => { const li = document.createElement("li"); li.textContent = line; list.append(li); });
    return list;
};

const createLogo = () => {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("class", "about-logo");
    svg.setAttribute("viewBox", "0 0 132 132");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    [
        { tag: "circle", attributes: { class: "seal", cx: 66, cy: 66, r: 63, "stroke-width": 1.2 } },
        { tag: "circle", attributes: { class: "seal", cx: 66, cy: 66, r: 58, "stroke-width": 0.8 } },
        { tag: "circle", attributes: { class: "ring", cx: 66, cy: 66, r: 44, transform: "rotate(-20 66 66)" } },
        { tag: "circle", attributes: { class: "dot", cx: 66, cy: 66, r: 12 } }
    ].forEach(({ tag, attributes }) => {
        const element = document.createElementNS(namespace, tag);
        Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
        svg.append(element);
    });
    return svg;
};

export const renderAboutView = () => {
    const root = document.createElement("section");
    root.className = "about-page";
    const hero = document.createElement("section");
    hero.className = "hero about-hero";
    const copy = document.createElement("div");
    copy.className = "hero-copy";
    const title = document.createElement("h1");
    title.textContent = "About OpenMCAT";
    const sub = document.createElement("p");
    sub.textContent = "OpenMCAT is a free MCAT study tool focused on efficient studying and helpful analytics.";
    copy.append(title, sub);
    hero.append(copy, createLogo());
    root.append(hero);
    const whatItIs = createSection("What OpenMCAT is");
    whatItIs.append(createList([
        "A free and independent study tool for targeted MCAT practice.",
        "A privacy-first website with no account system and no data collection.",
        "A configurable workflow that supports any AI chat of your choice.",
        "A way to drill topics and skills and seriously review your weak areas."
    ]));
    const whatItIsNot = createSection("What OpenMCAT is not");
    whatItIsNot.append(createList([
        "Not affiliated with the AAMC.",
        "Not official MCAT practice material.",
        "Not an MCAT score predictor.",
        "Not a medical advice or treatment system."
    ], "about-list is-negative"));
    const disclaimer = createSection("Disclaimer");
    const disclaimerText = document.createElement("p");
    disclaimerText.textContent = "OpenMCAT is an independent free-and-open-source study tool. It is not affiliated with, endorsed by, or sponsored by the Association of American Medical Colleges (AAMC). MCAT is a registered trademark of the AAMC. OpenMCAT generates AI-powered practice sessions for drilling topics and skills. It is not intended to be used as a substitute for official AAMC practice materials and it does not guarantee any particular MCAT score.";
    const aiNote = document.createElement("p");
    aiNote.append("OpenMCAT uses generative AI for its practice questions. Use them for drilling and review but verify uncertain explanations. Use ", createExternalLink("https://store.aamc.org/online-only-official-mcat-prep-bundle.html", "official AAMC materials"), " for representative MCAT practice.");
    const privacy = document.createElement("p");
    privacy.textContent = "OpenMCAT highly values your privacy. Therefore, it only stores your data in your own web browser. No account is required. You can export and import your data via JSON files using the controls on the settings page.";
    const github = document.createElement("p");
    github.append("OpenMCAT has its source code openly available on a ", createExternalLink("https://github.com/Zushah/OpenMCAT", "GitHub repository"), " under the ", createExternalLink("https://github.com/Zushah/OpenMCAT/blob/main/LICENSE.md", "GNU Affero General Public License v3.0"), ".");
    disclaimer.append(disclaimerText, aiNote, privacy, github);
    const linksHeading = document.createElement("h3");
    linksHeading.textContent = "AAMC official reference links";
    const links = document.createElement("ul");
    links.className = "about-list";
    [
        { label: "AAMC MCAT topics overview", href: "https://students-residents.aamc.org/prepare-mcat-exam/whats-mcat-exam-pdf-outline" },
        { label: "AAMC MCAT skills overview", href: "https://students-residents.aamc.org/whats-mcat-exam/scientific-inquiry-reasoning-skills-overview" }
    ].forEach((reference) => {
        const item = document.createElement("li");
        item.append(createExternalLink(reference.href, reference.label));
        links.append(item);
    });
    disclaimer.append(linksHeading, links);
    root.append(whatItIs, whatItIsNot, disclaimer);
    return root;
};
