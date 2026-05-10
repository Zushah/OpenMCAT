import { CARS_SKILLS, SCIENCE_SKILLS, SECTIONS, TOPICS } from "../data/taxonomy.js";
import { createStatCard } from "../components/stats.js";
import { formatDurationMs } from "../components/timer.js";

const cb = Chalkboard;

const sectionsById = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
const topicsById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
const skillsById = Object.fromEntries([...SCIENCE_SKILLS, ...CARS_SKILLS].map((skill) => [skill.id, skill]));

const pct = (value) => `${cb.numb.roundTo((value || 0) * 100, 1)}%`;

const rowNameFromId = (type, id) => {
    if (type === "section") return sectionsById[id]?.shortName ?? id;
    if (type === "topic") return topicsById[id]?.name ?? id;
    if (type === "skill") return skillsById[id]?.name ?? id;
    return id;
};

const buildBarList = (rows, type) => {
    const wrapper = document.createElement("div");
    wrapper.className = "bar-list";
    rows.slice(0, 8).forEach((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "bar-row";
        const header = document.createElement("div");
        header.className = "bar-row-header";
        const label = document.createElement("span");
        label.textContent = rowNameFromId(type, row.id);
        const values = document.createElement("span");
        values.textContent = `${pct(row.accuracy)} (${row.correct}/${row.attempts})`;
        header.append(label, values);
        const track = document.createElement("div");
        track.className = "bar-track";
        const value = document.createElement("div");
        value.className = "bar-value";
        value.style.width = `${cb.numb.roundTo(row.accuracy * 100, 1)}%`;
        track.append(value);
        rowEl.append(header, track);
        wrapper.append(rowEl);
    });
    return wrapper;
};

export const renderDashboardView = (state, actions) => {
    const root = document.createElement("section");
    const analytics = state.analytics;
    const attempts = analytics?.attempts ?? [];
    const header = document.createElement("section");
    header.className = "hero";
    const heading = document.createElement("h1");
    heading.textContent = "Local analytics dashboard";
    const sub = document.createElement("p");
    sub.textContent =
    "Track your section-level performance, timing, and weakest topic-skill combinations.";
    header.append(heading, sub);
    root.append(header);
    if (!attempts.length) {
        const empty = document.createElement("section");
        empty.className = "card card-pad empty-state";
        const message = document.createElement("p");
        message.textContent =
        "No attempts yet. Complete a practice session to unlock analytics.";
        const button = document.createElement("button");
        button.className = "btn btn-primary";
        button.textContent = "Create first session";
        button.addEventListener("click", () => actions.navigate("generator"));
        empty.append(message, button);
        root.append(empty);
        return root;
    }
    const metrics = analytics.metrics;
    const bestSection = [...metrics.bySection].sort((a, b) => b.smoothedAccuracy - a.smoothedAccuracy)[0];
    const weakSection = [...metrics.bySection].sort((a, b) => a.smoothedAccuracy - b.smoothedAccuracy)[0];
    const recommendation = analytics.recommendation;
    const weakestPair = recommendation.type === "weak_pair" && recommendation.config ? `${topicsById[recommendation.config.topicIds?.[0]]?.shortName ?? recommendation.config.topicIds?.[0] ?? "n/a"} / ${skillsById[recommendation.config.skillIds?.[0]]?.shortName ?? recommendation.config.skillIds?.[0] ?? "n/a"}` : "Not enough data yet";
    const recentSessionsCount = analytics.sessions.filter((session) => Boolean(session.completedAt)).slice(-5).length;
    const grid = document.createElement("section");
    grid.className = "dashboard-grid";
    grid.append(
        createStatCard("Questions answered", `${metrics.totals.totalQuestionsAnswered}`),
        createStatCard("Overall accuracy", pct(metrics.totals.overallAccuracy)),
        createStatCard("Avg time / question", formatDurationMs(metrics.totals.averageElapsedMs)),
        createStatCard("Completion rate", pct(metrics.totals.completionRate)),
        createStatCard("Best section", rowNameFromId("section", bestSection?.id ?? "n/a")),
        createStatCard("Weakest section", rowNameFromId("section", weakSection?.id ?? "n/a")),
        createStatCard("Weakest topic-skill pair", weakestPair),
        createStatCard("Recent sessions", `${recentSessionsCount}`)
    );
    root.append(grid);
    const recommendationCard = document.createElement("section");
    recommendationCard.className = "card card-pad";
    recommendationCard.style.marginTop = "1rem";
    const recommendationTitle = document.createElement("h2");
    recommendationTitle.textContent = recommendation.headline;
    const recommendationText = document.createElement("p");
    recommendationText.textContent = recommendation.body;
    const recommendationAction = document.createElement("button");
    recommendationAction.className = "btn btn-secondary";
    recommendationAction.textContent = "Apply recommendation";
    recommendationAction.addEventListener("click", () => actions.applyRecommendation());
    recommendationCard.append(recommendationTitle, recommendationText, recommendationAction);
    root.append(recommendationCard);
    const panels = document.createElement("section");
    panels.className = "dashboard-panels";
    const sectionPanel = document.createElement("article");
    sectionPanel.className = "card card-pad";
    const sectionTitle = document.createElement("h2");
    sectionTitle.textContent = "Accuracy by section";
    sectionPanel.append(sectionTitle, buildBarList(metrics.bySection, "section"));
    panels.append(sectionPanel);
    const topicPanel = document.createElement("article");
    topicPanel.className = "card card-pad";
    const topicTitle = document.createElement("h2");
    topicTitle.textContent = "Accuracy by topic";
    topicPanel.append(topicTitle, buildBarList([...metrics.byTopic].sort((a, b) => b.attempts - a.attempts), "topic"));
    panels.append(topicPanel);
    const skillPanel = document.createElement("article");
    skillPanel.className = "card card-pad";
    const skillTitle = document.createElement("h2");
    skillTitle.textContent = "Accuracy by skill";
    skillPanel.append(skillTitle, buildBarList(metrics.bySkill, "skill"));
    panels.append(skillPanel);
    const timingPanel = document.createElement("article");
    timingPanel.className = "card card-pad";
    const timingTitle = document.createElement("h2");
    timingTitle.textContent = "Timing by difficulty";
    timingPanel.append(timingTitle);
    const timingRows = document.createElement("div");
    timingRows.className = "bar-list";
    metrics.byDifficulty.forEach((row) => {
        const rowEl = document.createElement("p");
        rowEl.className = "tiny";
        rowEl.textContent = `${row.id}: ${formatDurationMs(row.avgTimeMs)} avg`;
        timingRows.append(rowEl);
    });
    timingPanel.append(timingRows);
    panels.append(timingPanel);
    root.append(panels);
    const tablePanel = document.createElement("section");
    tablePanel.className = "card card-pad";
    tablePanel.style.marginTop = "1rem";
    const tableTitle = document.createElement("h2");
    tableTitle.textContent = "Recent missed questions";
    tablePanel.append(tableTitle);
    const missed = metrics.recentAttempts.filter((attempt) => !attempt.isCorrect);
    if (!missed.length) {
        const empty = document.createElement("p");
        empty.className = "tiny";
        empty.textContent = "No recent misses in the latest attempts.";
        tablePanel.append(empty);
    } else {
        const tableWrap = document.createElement("div");
        tableWrap.className = "table-wrap";
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["When", "Section", "Topic", "Skill", "Time"].forEach((label) => {
            const th = document.createElement("th");
            th.textContent = label;
            headerRow.append(th);
        });
        thead.append(headerRow);
        table.append(thead);
        const tbody = document.createElement("tbody");
        missed.slice(0, 12).forEach((attempt) => {
            const row = document.createElement("tr");
            const firstTopic = attempt.topicIds?.[0];
            const firstSkill = attempt.skillIds?.[0];
            const cells = [
                new Date(attempt.answeredAt).toLocaleDateString(),
                sectionsById[attempt.sectionId]?.shortName ?? attempt.sectionId,
                topicsById[firstTopic]?.shortName ?? firstTopic ?? "n/a",
                skillsById[firstSkill]?.shortName ?? firstSkill ?? "n/a",
                formatDurationMs(attempt.elapsedMs)
            ];
            cells.forEach((text) => {
                const td = document.createElement("td");
                td.textContent = text;
                row.append(td);
            });
            tbody.append(row);
        });
        table.append(tbody);
        tableWrap.append(table);
        tablePanel.append(tableWrap);
    }
    root.append(tablePanel);
    return root;
};
