import { icon } from "../components/icons.js";

const FEATURES = [
    { numeral: "i.", title: "Guided AI generation", body: "Prompts are produced based on your options. Just click a few buttons, copy-paste, and go." },
    { numeral: "ii.", title: "Analytics with a purpose", body: "Track dozens of stats on your performance. Get personalized recommendations for improvement." },
    { numeral: "iii.", title: "Free and open for all", body: "No payments. No data collection. No hidden lines of code. No foot-in-the-door games. No door-in-the-face gimmicks." }
];

const STEPS = [
    { title: "Configure", body: "Pick section, topics, skills, difficulty, and format, all based on the real MCAT." },
    { title: "Generate", body: "Use an AI chat of your choice to copy the prompt and paste the output." },
    { title: "Practice", body: "Answer the questions and review the explanations." },
    { title: "Repeat", body: "Use analytics-based recommendations to plan your next study session." }
];

const makeButton = (className, text, onClick, iconName = null) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    const label = document.createElement("span");
    label.textContent = text;
    button.append(label);
    if (iconName) button.append(icon(iconName, { size: 14 }));
    button.addEventListener("click", onClick);
    return button;
};

export const renderLandingView = (actions) => {
    const root = document.createElement("section");
    root.className = "landing-page";
    const hero = document.createElement("section");
    hero.className = "landing-hero";
    hero.setAttribute("data-reveal", "");
    const main = document.createElement("div");
    main.className = "landing-hero-main";
    const title = document.createElement("h1");
    title.textContent = "Train on MCAT topics and skills with targeted drills.";
    const sub = document.createElement("p");
    sub.className = "landing-sub";
    sub.textContent = "OpenMCAT compiles structured prompts, validates AI output, renders practice sessions and reviews, and provides actionable insights. No payment required.";
    const ctaRow = document.createElement("div");
    ctaRow.className = "button-row landing-actions";
    const start = makeButton("btn btn-primary", "Start Practice", () => actions.navigate("generator"), "arrow-right");
    const bank = makeButton("btn btn-secondary", "Try Question Bank", () => actions.navigate("bank"));
    const dashboard = makeButton("btn btn-secondary", "View Dashboard", () => actions.navigate("dashboard"));
    const github = document.createElement("a");
    github.className = "btn btn-ghost";
    github.href = "https://github.com/Zushah/OpenMCAT";
    github.target = "_blank";
    github.rel = "noreferrer noopener";
    const githubLabel = document.createElement("span");
    githubLabel.textContent = "Source Code";
    github.append(githubLabel, icon("external", { size: 12 }));
    ctaRow.append(start, bank, dashboard, github);
    const disclaimer = document.createElement("p");
    disclaimer.className = "landing-disclaimer";
    disclaimer.textContent = "Independent study tool. Not affiliated with the AAMC. AI-generated content may contain errors.";
    main.append(title, sub, ctaRow, disclaimer);
    const features = document.createElement("aside");
    features.className = "landing-features";
    features.setAttribute("aria-label", "Features");
    FEATURES.forEach((feature) => {
        const item = document.createElement("article");
        item.className = "landing-feature";
        const numeral = document.createElement("span");
        numeral.className = "landing-feature-num";
        numeral.setAttribute("aria-hidden", "true");
        numeral.textContent = feature.numeral;
        const heading = document.createElement("h2");
        heading.textContent = feature.title;
        const body = document.createElement("p");
        body.textContent = feature.body;
        item.append(numeral, heading, body);
        features.append(item);
    });
    hero.append(main, features);
    root.append(hero);
    const how = document.createElement("section");
    how.className = "landing-how";
    how.setAttribute("data-reveal", "");
    const heading = document.createElement("div");
    heading.className = "section-heading";
    const howTitle = document.createElement("h2");
    howTitle.textContent = "How it works";
    heading.append(howTitle);
    const list = document.createElement("ol");
    list.className = "landing-steps";
    STEPS.forEach((step, index) => {
        const item = document.createElement("li");
        const number = document.createElement("span");
        number.className = "landing-step-num";
        number.setAttribute("aria-hidden", "true");
        number.textContent = String(index + 1);
        const stepTitle = document.createElement("h3");
        stepTitle.textContent = step.title;
        const body = document.createElement("p");
        body.textContent = step.body;
        item.append(number, stepTitle, body);
        list.append(item);
    });
    how.append(heading, list);
    root.append(how);
    return root;
};
