export const renderLandingView = (actions) => {
    const root = document.createElement("section");
    root.className = "landing-page";
    const hero = document.createElement("section");
    hero.className = "landing-hero glass-panel";
    hero.setAttribute("data-reveal", "");
    const title = document.createElement("h1");
    title.textContent = "Train on MCAT topics and skills with targeted drills.";
    const sub = document.createElement("p");
    sub.className = "landing-sub";
    sub.textContent = "OpenMCAT compiles structured prompts, validates AI output, renders practice sessions and reviews, and provides actionable insights. No payment required.";
    const ctaRow = document.createElement("div");
    ctaRow.className = "button-row";
    const start = document.createElement("button");
    start.className = "btn btn-primary";
    start.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span> Start Practice';
    start.addEventListener("click", () => actions.navigate("generator"));
    const dashboard = document.createElement("button");
    dashboard.className = "btn btn-secondary";
    dashboard.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">insights</span> View Dashboard';
    dashboard.addEventListener("click", () => actions.navigate("dashboard"));
    const github = document.createElement("a");
    github.className = "btn btn-ghost";
    github.href = "https://github.com/Zushah/OpenMCAT";
    github.target = "_blank";
    github.rel = "noreferrer noopener";
    github.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">code</span> Source Code';
    ctaRow.append(start, dashboard, github);
    const disclaimer = document.createElement("p");
    disclaimer.className = "landing-disclaimer";
    disclaimer.textContent = "Independent study tool. Not affiliated with the AAMC. AI-generated content may contain errors.";
    hero.append(title, sub, ctaRow, disclaimer);
    root.append(hero);
    const strip = document.createElement("section");
    strip.className = "landing-strip";
    strip.setAttribute("data-reveal", "");
    strip.innerHTML = `
        <div><span class="material-symbols-outlined" aria-hidden="true">schema</span><strong>Guided AI generation</strong><p>Prompts are produced based on your options. Just click a few buttons, copy-paste, and go.</p></div>
        <div><span class="material-symbols-outlined" aria-hidden="true">analytics</span><strong>Analytics with a purpose</strong><p>Track dozens of stats on your performance. Get personalized recommendations for improvement.</p></div>
        <div><span class="material-symbols-outlined" aria-hidden="true">privacy_tip</span><strong>Free and open for all</strong><p>No payments. No data collection. No hidden lines of code.</p></div>
    `;
    root.append(strip);
    const how = document.createElement("section");
    how.className = "landing-how";
    how.setAttribute("data-reveal", "");
    const howTitle = document.createElement("h2");
    howTitle.textContent = "How it works";
    const list = document.createElement("div");
    list.className = "landing-steps";
    list.innerHTML = `
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">tune</span><h3>1. Configure</h3><p>Pick section, topics, skills, difficulty, and format, all based on the real MCAT.</p></article>
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span><h3>2. Generate</h3><p>Use an AI model of your choice to copy the prompt and paste the output.</p></article>
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">checklist_rtl</span><h3>3. Practice</h3><p>Answer the questions and review the explanations.</p></article>
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">monitoring</span><h3>4. Repeat</h3><p>Use analytics-based recommendations to plan your next study session.</p></article>
    `;
    how.append(howTitle, list);
    root.append(how);
    return root;
};
