const chartInstances = new Set();
const pendingChartRenders = new Map();
const stimulusChartStates = new WeakMap();

const readCssValue = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export const destroyCharts = () => {
    pendingChartRenders.forEach((frameId) => cancelAnimationFrame(frameId));
    pendingChartRenders.clear();
    chartInstances.forEach((chart) => { try { chart.destroy(); } catch (error) { console.warn("OpenMCAT: failed to destroy chart", error); } });
    chartInstances.clear();
};

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
    tooltipBackground: readCssValue("--chart-tooltip-background", "rgba(12, 18, 17, 0.95)")
});

const stimulusPalette = (theme) => [theme.accent, theme.accentTwo, theme.warning, theme.danger, theme.success, theme.textMuted];

const normalizeTooltipTitle = (label) => Array.isArray(label) ? label.flat(Infinity).filter(Boolean).join(" ") : String(label ?? "");

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
        backgroundColor: theme.tooltipBackground,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.border,
        borderWidth: 1,
        displayColors: true,
        callbacks: {
            title: (items) => {
                const item = items?.[0];
                const rawLabel = item?.chart?.data?.labels?.[item.dataIndex] ?? item?.label;
                return normalizeTooltipTitle(rawLabel);
            }
        }
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
    const defaultPlugins = basePlugins(theme);
    const pluginOverrides = optionOverrides.plugins ?? {};
    const legendOverrides = pluginOverrides.legend && typeof pluginOverrides.legend === "object" ? pluginOverrides.legend : {};
    const tooltipOverrides = pluginOverrides.tooltip && typeof pluginOverrides.tooltip === "object" ? pluginOverrides.tooltip : {};
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        interaction: {
            intersect: false,
            mode: "index"
        },
        ...optionOverrides,
        plugins: {
            ...defaultPlugins,
            ...pluginOverrides,
            legend: {
                ...defaultPlugins.legend,
                ...legendOverrides,
                labels: {
                    ...defaultPlugins.legend.labels,
                    ...(legendOverrides.labels ?? {})
                }
            },
            tooltip: {
                ...defaultPlugins.tooltip,
                ...tooltipOverrides,
                callbacks: {
                    ...defaultPlugins.tooltip.callbacks,
                    ...(tooltipOverrides.callbacks ?? {})
                }
            }
        },
        scales: replaceScales ? (optionOverrides.scales ?? {}) : {
            ...baseScales(theme),
            ...(optionOverrides.scales ?? {})
        }
    };
};

const registerChart = (chart) => {
    const destroy = chart.destroy.bind(chart);
    chart.destroy = (...args) => { chartInstances.delete(chart); return destroy(...args); };
    chartInstances.add(chart);
    return chart;
};

export const renderChart = (canvas, config) => {
    if (!canvas || !hasChartRuntime()) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    try {
        const existingChart = typeof window.Chart.getChart === "function" ? window.Chart.getChart(canvas) : null;
        if (existingChart) {
            existingChart.destroy();
            chartInstances.delete(existingChart);
        }
        const chart = new window.Chart(context, config);
        return registerChart(chart);
    } catch (error) { console.warn("OpenMCAT: failed to render chart", error); return null; }
};

export const queueChartRender = (canvas, config) => {
    if (!hasChartRuntime()) return null;
    if (pendingChartRenders.has(canvas)) return true;
    const frameId = requestAnimationFrame(() => {
        pendingChartRenders.delete(canvas);
        if (!document.body.contains(canvas)) return;
        renderChart(canvas, config);
    });
    pendingChartRenders.set(canvas, frameId);
    return true;
};

const copyScale = (scale, theme) => {
    if (!scale) return undefined;
    const trustedScale = { grid: { color: theme.border }, ticks: { color: theme.textMuted } };
    if (scale.type !== undefined) trustedScale.type = scale.type;
    if (scale.min !== undefined) trustedScale.min = scale.min;
    if (scale.max !== undefined) trustedScale.max = scale.max;
    if (scale.beginAtZero !== undefined) trustedScale.beginAtZero = scale.beginAtZero;
    if (scale.title) trustedScale.title = { display: scale.title.display, text: scale.title.text, color: theme.textSecondary, font: { weight: "600" } };
    return trustedScale;
};

const copyDatasetData = (data = []) => data.map((value) => {
    if (typeof value === "number") return value;
    return { x: value.x, y: value.y };
});

export const createStimulusChartConfig = (chartSpec) => {
    const theme = getChartTheme();
    const colors = stimulusPalette(theme);
    const datasets = chartSpec.config.data.datasets.map((dataset, index) => {
        const color = colors[index % colors.length];
        const type = dataset.type ?? chartSpec.config.type;
        const trustedDataset = {
            data: copyDatasetData(dataset.data),
            borderColor: color,
            backgroundColor: color,
            borderWidth: type === "bar" ? 1 : 2
        };
        if (dataset.label !== undefined) trustedDataset.label = dataset.label;
        if (dataset.type !== undefined) trustedDataset.type = dataset.type;
        if (type === "line" || type === "scatter") {
            trustedDataset.fill = false;
            trustedDataset.pointBackgroundColor = color;
            trustedDataset.pointBorderColor = color;
            trustedDataset.pointRadius = 3;
            trustedDataset.pointHoverRadius = 3;
            trustedDataset.tension = 0;
        }
        return trustedDataset;
    });
    const data = { datasets };
    if (chartSpec.config.data.labels !== undefined) data.labels = [...chartSpec.config.data.labels];
    const suppliedScales = chartSpec.config.options?.scales ?? {};
    const scales = {};
    scales.x = copyScale(suppliedScales.x ?? {}, theme);
    scales.y = copyScale(suppliedScales.y ?? {}, theme);
    return {
        type: chartSpec.config.type,
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            events: [],
            plugins: {
                legend: {
                    display: datasets.length > 1 && datasets.every((dataset) => Boolean(dataset.label)),
                    position: "top",
                    labels: {
                        color: theme.textSecondary,
                        boxWidth: 11,
                        boxHeight: 11,
                        usePointStyle: true
                    }
                },
                tooltip: { enabled: false }
            },
            scales
        }
    };
};

const queueStimulusChartRender = (figure) => {
    const state = stimulusChartStates.get(figure);
    if (!state || state.rendered || state.queued) return;
    if (!hasChartRuntime()) return;
    state.queued = true;
    const frameId = requestAnimationFrame(() => {
        pendingChartRenders.delete(state.canvas);
        state.queued = false;
        if (!document.body.contains(state.canvas)) return;
        try {
            const chart = renderChart(state.canvas, createStimulusChartConfig(state.chartSpec));
            state.rendered = Boolean(chart);
        } catch (error) {
            state.rendered = false;
            console.warn("OpenMCAT: failed to prepare stimulus chart", error);
        }
    });
    pendingChartRenders.set(state.canvas, frameId);
};

export const createStimulusChart = (chartSpec, { defer = false, surface = "passage" } = {}) => {
    const figure = document.createElement("figure");
    figure.className = `stimulus-chart stimulus-chart--${surface === "question" ? "question" : "passage"}`;
    figure.dataset.chartId = chartSpec.id;
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "stimulus-chart-canvas-wrap";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", chartSpec.caption);
    canvasWrap.append(canvas);
    const caption = document.createElement("figcaption");
    caption.className = "stimulus-chart-caption";
    caption.textContent = chartSpec.caption;
    figure.append(caption, canvasWrap);
    stimulusChartStates.set(figure, { canvas, chartSpec, queued: false, rendered: false });
    if (!defer) queueStimulusChartRender(figure);
    return figure;
};

export const renderStimulusCharts = (root) => {
    if (!root) return;
    const figures = root.matches?.(".stimulus-chart") ? [root] : Array.from(root.querySelectorAll?.(".stimulus-chart") ?? []);
    figures.forEach(queueStimulusChartRender);
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
