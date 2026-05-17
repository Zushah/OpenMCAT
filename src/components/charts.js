const dashboardCharts = new Set();

const readCssValue = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const getReducedMotion = () => document.documentElement?.dataset?.reduceMotion === "true";

export const destroyDashboardCharts = () => { dashboardCharts.forEach((chart) => { try { chart.destroy(); } catch (error) { console.warn("OpenMCAT: failed to destroy chart", error); } }); dashboardCharts.clear(); };

export const hasChartRuntime = () => typeof window !== "undefined" && typeof window.Chart === "function";

export const getChartTheme = () => ({
    accent: readCssValue("--accent", "#8ff8bc"),
    accentTwo: readCssValue("--accent-2", "#7dd3fc"),
    textPrimary: readCssValue("--text-primary", "#ecfff8"),
    textSecondary: readCssValue("--text-secondary", "#b8cbc5"),
    textMuted: readCssValue("--text-muted", "#8ea39c"),
    border: readCssValue("--border", "rgba(236, 255, 248, 0.14)"),
    danger: readCssValue("--danger", "#ff8fa3"),
    warning: readCssValue("--warning", "#ffd166"),
    success: readCssValue("--success", "#8ff8bc"),
    reducedMotion: getReducedMotion()
});

const basePlugins = (theme) => ({
    legend: {
        display: true,
        labels: {
            color: theme.textSecondary,
            boxWidth: 11,
            boxHeight: 11,
            usePointStyle: true
        }
    },
    tooltip: {
        backgroundColor: "rgba(12, 18, 17, 0.95)",
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.border,
        borderWidth: 1,
        displayColors: true
    }
});

const baseScales = (theme) => ({
    x: {
        grid: { color: theme.border },
        ticks: { color: theme.textMuted }
    },
    y: {
        grid: { color: theme.border },
        ticks: { color: theme.textMuted }
    }
});

export const getDefaultChartOptions = (overrides = {}) => {
    const theme = getChartTheme();
    const { replaceScales = false, ...optionOverrides } = overrides;
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: theme.reducedMotion ? false : { duration: 450 },
        interaction: {
            intersect: false,
            mode: "index"
        },
        ...optionOverrides,
        plugins: {
            ...basePlugins(theme),
            ...(optionOverrides.plugins ?? {})
        },
        scales: replaceScales ? (optionOverrides.scales ?? {}) : {
            ...baseScales(theme),
            ...(optionOverrides.scales ?? {})
        }
    };
};

export const renderChart = (canvas, config) => {
    if (!canvas || !hasChartRuntime()) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const chart = new window.Chart(context, config);
    dashboardCharts.add(chart);
    return chart;
};

export const queueChartRender = (canvas, config) => {
    if (!hasChartRuntime()) return null;
    requestAnimationFrame(() => {
        if (!document.body.contains(canvas)) return;
        renderChart(canvas, config);
    });
    return true;
};

export const createChartShell = ({ title, subtitle = "", canvasLabel = "Dashboard chart", table = null, headerControls = null }) => {
    const card = document.createElement("article");
    card.className = "card card-pad chart-card";
    const header = document.createElement("div");
    header.className = "chart-card-header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "chart-card-title";
    const heading = document.createElement("h2");
    heading.textContent = title;
    titleWrap.append(heading);
    if (subtitle) {
        const note = document.createElement("p");
        note.className = "tiny";
        note.textContent = subtitle;
        titleWrap.append(note);
    }
    header.append(titleWrap);
    if (headerControls) header.append(headerControls);
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "chart-canvas-wrap";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", canvasLabel);
    canvasWrap.append(canvas);
    card.append(header, canvasWrap);
    if (!hasChartRuntime()) {
        const fallback = document.createElement("p");
        fallback.className = "chart-fallback tiny";
        fallback.textContent = "Chart.js did not load. The data table below is still available.";
        card.append(fallback);
    }
    if (table) {
        const details = document.createElement("details");
        details.className = "chart-data-details";
        const summary = document.createElement("summary");
        summary.textContent = "View chart data";
        details.append(summary, table);
        card.append(details);
    }
    return { card, canvas };
};

export const createAccessibleDataTable = (columns, rows) => {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap chart-table-wrap chart-data-table";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column;
        headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
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
