import { icon } from "./icons.js";

const chartInstances = new Set();
const pendingChartRenders = new Map();
const stimulusChartStates = new WeakMap();
const PALETTE_FALLBACK = ["#3AA06B", "#C4861C", "#5C88E0", "#C8573F", "#1E9FA3", "#A07CD6", "#8E9A2A", "#D06E9E", "#C0B8A6", "#928B7C", "#6F6A5E"];
let chartAnimationEnabled = true;

const readCssValue = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const setChartAnimationEnabled = (enabled) => { chartAnimationEnabled = Boolean(enabled); };

export const getChartAnimation = () => chartAnimationEnabled && !prefersReducedMotion() ? { duration: 300 } : false;

export const destroyCharts = () => {
    pendingChartRenders.forEach((frameId) => cancelAnimationFrame(frameId));
    pendingChartRenders.clear();
    chartInstances.forEach((chart) => { try { chart.destroy(); } catch (error) { console.warn("OpenMCAT: failed to destroy chart", error); } });
    chartInstances.clear();
};

export const hasChartRuntime = () => typeof window !== "undefined" && typeof window.Chart === "function";

export const getChartTheme = () => ({
    accent: readCssValue("--accent", "#9DC9A9"),
    accentTwo: readCssValue("--accent-2", "#C0B8A6"),
    textPrimary: readCssValue("--text-primary", "#EEE7D6"),
    textSecondary: readCssValue("--text-secondary", "#C0B8A6"),
    textMuted: readCssValue("--text-muted", "#928B7C"),
    border: readCssValue("--border", "#2E2C25"),
    borderStrong: readCssValue("--border-strong", "#4B483E"),
    grid: readCssValue("--chart-grid", "#26241E"),
    page: readCssValue("--page", "#14130F"),
    danger: readCssValue("--danger", "#E39A7E"),
    warning: readCssValue("--warning", "#D9B45A"),
    success: readCssValue("--success", "#9DC9A9"),
    tooltipBackground: readCssValue("--chart-tooltip-background", "#1B1914"),
    palette: PALETTE_FALLBACK.map((fallback, index) => readCssValue(`--chart-${index + 1}`, fallback)),
    fontSans: readCssValue("--font-sans", "'Alegreya Sans', sans-serif"),
    fontSerif: readCssValue("--font-serif", "'Alegreya', serif")
});

export const chartColorWithAlpha = (color, alpha = 0.24) => {
    const raw = String(color ?? "").trim();
    const constrained = Math.min(1, Math.max(0, Number.isFinite(Number(alpha)) ? Number(alpha) : 0.24));
    const hex = raw.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
        const value = hex[1].length === 3 ? hex[1].split("").map((character) => `${character}${character}`).join("") : hex[1];
        return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${constrained})`;
    }
    const rgb = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${constrained})`;
    return raw;
};

const normalizeTooltipTitle = (label) => Array.isArray(label) ? label.flat(Infinity).filter(Boolean).join(" ") : String(label ?? "");

const tickFont = (theme) => ({ family: theme.fontSans, size: 11 });

const basePlugins = (theme) => ({
    legend: {
        display: true,
        position: "top",
        align: "start",
        labels: {
            color: theme.textSecondary,
            boxWidth: 10,
            boxHeight: 10,
            padding: 16,
            usePointStyle: false,
            font: { family: theme.fontSans, size: 12 }
        }
    },
    tooltip: {
        backgroundColor: theme.tooltipBackground,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        footerColor: theme.textMuted,
        borderColor: theme.borderStrong,
        borderWidth: 1,
        cornerRadius: 0,
        padding: 10,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
        titleFont: { family: theme.fontSans, size: 12, weight: "700" },
        bodyFont: { family: theme.fontSans, size: 12 },
        footerFont: { family: theme.fontSans, size: 11, weight: "400" },
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

export const chartAxis = (theme, overrides = {}) => {
    const { grid = {}, ticks = {}, border = {}, ...rest } = overrides;
    return {
        grid: { color: theme.grid, drawTicks: false, ...grid },
        border: { color: theme.borderStrong, ...border },
        ticks: { color: theme.textMuted, font: tickFont(theme), padding: 8, ...ticks },
        ...rest
    };
};

const baseScales = (theme) => ({
    x: chartAxis(theme, { grid: { display: false } }),
    y: chartAxis(theme)
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
        animation: getChartAnimation(),
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

const applyChartDefaults = () => {
    const theme = getChartTheme();
    window.Chart.defaults.font.family = theme.fontSans;
    window.Chart.defaults.color = theme.textMuted;
    window.Chart.defaults.borderColor = theme.grid;
};

const registerChart = (chart) => {
    const destroy = chart.destroy.bind(chart);
    chart.destroy = (...args) => { chartInstances.delete(chart); return destroy(...args); };
    chartInstances.add(chart);
    return chart;
};

const redrawWhenFontsLoad = (chart) => {
    if (!document.fonts || document.fonts.status === "loaded") return;
    document.fonts.ready.then(() => { if (chartInstances.has(chart) && chart.canvas?.isConnected) chart.update("none"); }).catch(() => { });
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
        applyChartDefaults();
        const chart = new window.Chart(context, config);
        redrawWhenFontsLoad(chart);
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

const relativeLuminance = (color) => {
    const hex = String(color ?? "").trim().match(/^#([\da-f]{6})$/i);
    if (!hex) return null;
    const channels = [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const readableTextOn = (color, { dark = "#14130F", light = "#FBF7EC" } = {}) => {
    const luminance = relativeLuminance(color);
    if (luminance === null) return light;
    const contrastWithDark = (luminance + 0.05) / ((relativeLuminance(dark) ?? 0) + 0.05);
    const contrastWithLight = ((relativeLuminance(light) ?? 1) + 0.05) / (luminance + 0.05);
    return contrastWithDark >= contrastWithLight ? dark : light;
};

export const createPolarRankLabelsPlugin = ({ ranks, colors, theme }) => ({
    id: "openmcatPolarRankLabels",
    afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const { ctx } = chart;
        ctx.save();
        ctx.font = `700 11px ${theme.fontSans}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        meta.data.forEach((arc, index) => {
            if (!arc || !chart.getDataVisibility(index)) return;
            const { x, y, startAngle, endAngle, outerRadius } = arc.getProps(["x", "y", "startAngle", "endAngle", "outerRadius"], true);
            if (endAngle - startAngle < Math.PI / 18 || outerRadius < 16) return;
            const middle = (startAngle + endAngle) / 2;
            const radius = outerRadius * 0.7;
            ctx.fillStyle = readableTextOn(colors[index]);
            ctx.fillText(String(ranks[index] ?? index + 1), x + Math.cos(middle) * radius, y + Math.sin(middle) * radius);
        });
        ctx.restore();
    }
});

export const createBarValueLabelsPlugin = ({ theme, format = (value) => String(value) }) => ({
    id: "openmcatBarValueLabels",
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = `400 11px ${theme.fontSans}`;
        ctx.fillStyle = theme.textSecondary;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (meta.hidden) return;
            meta.data.forEach((bar, index) => {
                const value = dataset.data[index];
                if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
                const { x, y } = bar.getProps(["x", "y"], true);
                ctx.fillText(format(value), x, y - 5);
            });
        });
        ctx.restore();
    }
});

export const createRadarValueLabelsPlugin = ({ values, theme }) => ({
    id: "openmcatRadarValueLabels",
    afterDraw(chart) {
        const scale = chart.scales.r;
        if (!scale || typeof scale.getPointLabelPosition !== "function") return;
        const lineHeight = 15 * 1.2;
        const { ctx } = chart;
        ctx.save();
        ctx.font = `400 11px ${theme.fontSans}`;
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        values.forEach((value, index) => {
            const box = scale.getPointLabelPosition(index);
            if (!box) return;
            ctx.fillText(value, (box.left + box.right) / 2, box.top + lineHeight * 1.5);
        });
        ctx.restore();
    }
});

export const createDoughnutTotalPlugin = ({ total, theme }) => ({
    id: "openmcatDoughnutTotal",
    afterDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const arc = meta?.data?.[0];
        if (!arc) return;
        const { x, y } = arc.getProps(["x", "y"], true);
        const { ctx } = chart;
        ctx.save();
        ctx.font = `400 30px ${theme.fontSerif}`;
        ctx.fillStyle = theme.textPrimary;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(total), x, y + 1);
        ctx.restore();
    }
});

const copyScale = (scale, theme) => {
    if (!scale) return undefined;
    const trustedScale = {
        grid: { color: theme.grid, drawTicks: false },
        border: { color: theme.borderStrong },
        ticks: { color: theme.textMuted, font: { family: theme.fontSans, size: 11 }, padding: 6 }
    };
    if (scale.type !== undefined) trustedScale.type = scale.type;
    if (scale.min !== undefined) trustedScale.min = scale.min;
    if (scale.max !== undefined) trustedScale.max = scale.max;
    if (scale.beginAtZero !== undefined) trustedScale.beginAtZero = scale.beginAtZero;
    if (scale.title) trustedScale.title = { display: scale.title.display, text: scale.title.text, color: theme.textSecondary, font: { family: theme.fontSans, size: 12, weight: "700" } };
    return trustedScale;
};

const copyDatasetData = (data = []) => data.map((value) => {
    if (typeof value === "number") return value;
    return { x: value.x, y: value.y };
});

export const createStimulusChartConfig = (chartSpec) => {
    const theme = getChartTheme();
    const colors = theme.palette.slice(0, 8);
    const datasets = chartSpec.config.data.datasets.map((dataset, index) => {
        const color = colors[index % colors.length];
        const type = dataset.type ?? chartSpec.config.type;
        const trustedDataset = {
            data: copyDatasetData(dataset.data),
            borderColor: color,
            backgroundColor: color,
            borderWidth: type === "bar" ? 0 : 2
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
        if (type === "bar") trustedDataset.maxBarThickness = 44;
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
                    align: "start",
                    labels: {
                        color: theme.textSecondary,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 14,
                        usePointStyle: false,
                        font: { family: theme.fontSans, size: 12 }
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

export const createChartDataDetails = (table, className = "") => {
    const details = document.createElement("details");
    details.className = ["chart-data-details", className].filter(Boolean).join(" ");
    const summary = document.createElement("summary");
    const label = document.createElement("span");
    label.textContent = "View chart data";
    summary.append(label, icon("chevron-down", { size: 12 }));
    details.append(summary, table);
    return details;
};

export const createChartLegend = (canvas, items, { mode = "dataset" } = {}) => {
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", "Chart legend");
    items.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chart-legend-item";
        button.setAttribute("aria-pressed", "true");
        button.title = `Show or hide ${item.label}`;
        const swatch = document.createElement("span");
        swatch.className = item.dashed ? "chart-legend-swatch is-dashed" : "chart-legend-swatch";
        swatch.style.setProperty("--swatch", item.color);
        swatch.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = item.label;
        button.append(swatch, label);
        button.addEventListener("click", () => toggleChartSeries(canvas, index, mode, button));
        legend.append(button);
    });
    return legend;
};

export const toggleChartSeries = (canvas, index, mode, control) => {
    const chart = hasChartRuntime() && typeof window.Chart.getChart === "function" ? window.Chart.getChart(canvas) : null;
    if (!chart) return;
    const visible = mode === "data" ? chart.getDataVisibility(index) : chart.isDatasetVisible(index);
    if (mode === "data") chart.toggleDataVisibility(index);
    else chart.setDatasetVisibility(index, !visible);
    chart.update();
    control?.setAttribute("aria-pressed", visible ? "false" : "true");
};

export const legendItemsFromDatasets = (datasets = []) => datasets.map((dataset) => {
    const background = typeof dataset.backgroundColor === "string" ? dataset.backgroundColor : null;
    const border = typeof dataset.borderColor === "string" ? dataset.borderColor : null;
    const translucent = /^rgba\([^)]*,\s*0?\.[0-4]\d*\)$/.test(String(background ?? ""));
    const isLine = dataset.type === "line" || dataset.fill === false || Array.isArray(dataset.borderDash) || translucent;
    return { label: dataset.label, color: (isLine ? border : background) ?? border ?? background ?? "currentColor", dashed: Array.isArray(dataset.borderDash) && dataset.borderDash.length > 0 };
});

export const insertChartLegend = (card, canvas, legend) => {
    const wrap = canvas.closest(".chart-canvas-wrap");
    if (wrap) wrap.before(legend);
    else card.append(legend);
};

export const createChartShell = ({ title, subtitle = "", canvasLabel = "Dashboard chart", table = null, headerControls = null }) => {
    const card = document.createElement("article");
    card.className = "chart-card";
    const header = document.createElement("div");
    header.className = "chart-card-header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "chart-card-title";
    const heading = document.createElement("h2");
    heading.textContent = title;
    titleWrap.append(heading);
    if (subtitle) {
        const note = document.createElement("p");
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
        fallback.className = "chart-fallback";
        fallback.textContent = "Chart.js did not load. The data table below is still available.";
        card.append(fallback);
    }
    if (table) card.append(createChartDataDetails(table));
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
        th.scope = "col";
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
