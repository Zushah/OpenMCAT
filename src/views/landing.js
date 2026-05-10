export const renderLandingView = (actions) => {
    const root = document.createElement("section");
    root.className = "landing-page";
    const hero = document.createElement("section");
    hero.className = "landing-hero glass-panel";
    hero.setAttribute("data-reveal", "");
    const title = document.createElement("h1");
    title.textContent = "Train MCAT weaknesses with targeted AI-generated drills.";
    const sub = document.createElement("p");
    sub.className = "landing-sub";
    sub.textContent = "OpenMCAT compiles structured prompts, validates JSON output, and tracks your accuracy and timing locally. No account required.";
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
    github.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">code</span> GitHub';
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
        <div><span class="material-symbols-outlined" aria-hidden="true">schema</span><strong>Structured JSON generation</strong><p>Strict validation before questions render.</p></div>
        <div><span class="material-symbols-outlined" aria-hidden="true">analytics</span><strong>Local analytics</strong><p>Track section, topic, skill, timing, and confidence.</p></div>
        <div><span class="material-symbols-outlined" aria-hidden="true">privacy_tip</span><strong>Privacy-first</strong><p>No telemetry. Data stays in your browser.</p></div>
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
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">tune</span><h3>1. Configure</h3><p>Pick section, topics, reasoning skills, difficulty, format, and timing mode.</p></article>
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span><h3>2. Generate</h3><p>Use mock, manual JSON, OpenAI-compatible, or Ollama providers with constrained prompts.</p></article>
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">checklist_rtl</span><h3>3. Practice + Review</h3><p>Answer in immediate or delayed review mode with confidence and flagging controls.</p></article>
        <article class="glass-panel"><span class="material-symbols-outlined" aria-hidden="true">monitoring</span><h3>4. Iterate</h3><p>Use weakest-area recommendations to plan your next focused drill.</p></article>
    `;
    how.append(howTitle, list);
    root.append(how);
    return root;
};
