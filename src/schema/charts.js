const SUPPORTED_CHART_TYPES = new Set(["line", "bar", "scatter"]);
const SUPPORTED_X_SCALE_TYPES = new Set(["category", "linear", "logarithmic"]);
const SUPPORTED_Y_SCALE_TYPES = new Set(["linear", "logarithmic"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const isText = (value) => typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const rejectUnsupportedKeys = (errors, value, allowedKeys, path) => { Object.keys(value).forEach((key) => { if (!allowedKeys.has(key)) errors.push(`${path} contains unsupported property "${key}".`); }); };

const validateScaleTitle = (errors, title, path) => {
    if (!isObject(title)) { errors.push(`${path} must be an object.`); return; }
    rejectUnsupportedKeys(errors, title, new Set(["display", "text"]), path);
    if (Object.hasOwn(title, "display") && typeof title.display !== "boolean") errors.push(`${path}.display must be a boolean.`);
    if (Object.hasOwn(title, "text") && typeof title.text !== "string") errors.push(`${path}.text must be a string.`);
};

const validateScale = (errors, scale, axis, path) => {
    if (!isObject(scale)) { errors.push(`${path} must be an object.`); return null; }
    rejectUnsupportedKeys(errors, scale, new Set(["type", "title", "min", "max", "beginAtZero"]), path);
    const supportedTypes = axis === "x" ? SUPPORTED_X_SCALE_TYPES : SUPPORTED_Y_SCALE_TYPES;
    if (Object.hasOwn(scale, "type") && !supportedTypes.has(scale.type)) errors.push(`${path}.type must be one of ${Array.from(supportedTypes).join("/")}.`);
    if (Object.hasOwn(scale, "title")) validateScaleTitle(errors, scale.title, `${path}.title`);
    ["min", "max"].forEach((field) => { if (Object.hasOwn(scale, field) && !isFiniteNumber(scale[field])) errors.push(`${path}.${field} must be a finite number.`); });
    if (Object.hasOwn(scale, "beginAtZero") && typeof scale.beginAtZero !== "boolean") errors.push(`${path}.beginAtZero must be a boolean.`);
    if (isFiniteNumber(scale.min) && isFiniteNumber(scale.max) && scale.min >= scale.max) errors.push(`${path}.min must be less than ${path}.max.`);
    if (scale.type === "logarithmic") {
        if (isFiniteNumber(scale.min) && scale.min <= 0) errors.push(`${path}.min must be greater than zero for a logarithmic axis.`);
        if (isFiniteNumber(scale.max) && scale.max <= 0) errors.push(`${path}.max must be greater than zero for a logarithmic axis.`);
        if (scale.beginAtZero === true) errors.push(`${path}.beginAtZero cannot be true for a logarithmic axis.`);
    }
    return supportedTypes.has(scale.type) ? scale.type : null;
};

const validateDataset = (errors, dataset, path, defaultType) => {
    if (!isObject(dataset)) { errors.push(`${path} must be an object.`); return { form: null, type: defaultType, values: [] }; }
    rejectUnsupportedKeys(errors, dataset, new Set(["label", "type", "data"]), path);
    if (Object.hasOwn(dataset, "label") && typeof dataset.label !== "string") errors.push(`${path}.label must be a string if provided.`);
    let type = defaultType;
    if (Object.hasOwn(dataset, "type")) {
        if (!SUPPORTED_CHART_TYPES.has(dataset.type)) errors.push(`${path}.type must be one of line/bar/scatter.`);
        else type = dataset.type;
    }
    if (!Array.isArray(dataset.data)) { errors.push(`${path}.data must be an array.`); return { form: null, type, values: [] }; }
    if (dataset.data.length === 0) errors.push(`${path}.data must be a non-empty array.`);
    let form = null;
    dataset.data.forEach((value, index) => {
        const valuePath = `${path}.data[${index}]`;
        let currentForm = null;
        if (isFiniteNumber(value)) currentForm = "numeric";
        else if (isObject(value)) {
            rejectUnsupportedKeys(errors, value, new Set(["x", "y"]), valuePath);
            if (!isFiniteNumber(value.x)) errors.push(`${valuePath}.x must be a finite number.`);
            if (!isFiniteNumber(value.y)) errors.push(`${valuePath}.y must be a finite number.`);
            if (isFiniteNumber(value.x) && isFiniteNumber(value.y) && Object.keys(value).every((key) => key === "x" || key === "y")) currentForm = "point";
        } else errors.push(`${valuePath} must be a finite number or an object with finite numeric x and y values.`);
        if (currentForm && form && currentForm !== form) errors.push(`${path}.data must use one consistent data form.`);
        if (currentForm && !form) form = currentForm;
    });
    if (type === "scatter" && form === "numeric") errors.push(`${path}.data must use {x, y} points for a scatter dataset.`);
    return { form, type, values: dataset.data };
};

const validateChart = (errors, chart, path) => {
    if (!isObject(chart)) { errors.push(`${path} must be an object.`); return; }
    rejectUnsupportedKeys(errors, chart, new Set(["id", "caption", "config"]), path);
    if (!isText(chart.id)) errors.push(`${path}.id must be a non-empty string.`);
    if (!isText(chart.caption)) errors.push(`${path}.caption must be a non-empty string.`);
    if (!isObject(chart.config)) { errors.push(`${path}.config must be an object.`); return; }
    const configPath = `${path}.config`;
    rejectUnsupportedKeys(errors, chart.config, new Set(["type", "data", "options"]), configPath);
    const chartType = chart.config.type;
    if (!SUPPORTED_CHART_TYPES.has(chartType)) errors.push(`${configPath}.type must be one of line/bar/scatter.`);
    let labels = null;
    const datasetResults = [];
    if (!isObject(chart.config.data)) errors.push(`${configPath}.data must be an object.`);
    else {
        const dataPath = `${configPath}.data`;
        rejectUnsupportedKeys(errors, chart.config.data, new Set(["labels", "datasets"]), dataPath);
        if (Object.hasOwn(chart.config.data, "labels")) {
            if (!Array.isArray(chart.config.data.labels)) errors.push(`${dataPath}.labels must be an array if provided.`);
            else {
                labels = chart.config.data.labels;
                labels.forEach((label, index) => { if (typeof label !== "string") errors.push(`${dataPath}.labels[${index}] must be a string.`); });
            }
        }
        if (!Array.isArray(chart.config.data.datasets) || chart.config.data.datasets.length === 0) errors.push(`${dataPath}.datasets must be a non-empty array.`);
        else chart.config.data.datasets.forEach((dataset, index) => { datasetResults.push(validateDataset(errors, dataset, `${dataPath}.datasets[${index}]`, chartType)); });
    }
    let xScaleType = null;
    let yScaleType = null;
    if (Object.hasOwn(chart.config, "options")) {
        if (!isObject(chart.config.options)) errors.push(`${configPath}.options must be an object if provided.`);
        else {
            const optionsPath = `${configPath}.options`;
            rejectUnsupportedKeys(errors, chart.config.options, new Set(["scales"]), optionsPath);
            if (Object.hasOwn(chart.config.options, "scales")) {
                if (!isObject(chart.config.options.scales)) errors.push(`${optionsPath}.scales must be an object.`);
                else {
                    const scalesPath = `${optionsPath}.scales`;
                    rejectUnsupportedKeys(errors, chart.config.options.scales, new Set(["x", "y"]), scalesPath);
                    if (Object.hasOwn(chart.config.options.scales, "x")) xScaleType = validateScale(errors, chart.config.options.scales.x, "x", `${scalesPath}.x`);
                    if (Object.hasOwn(chart.config.options.scales, "y")) yScaleType = validateScale(errors, chart.config.options.scales.y, "y", `${scalesPath}.y`);
                }
            }
        }
    }
    const forms = new Set(datasetResults.map(({ form }) => form).filter(Boolean));
    if (forms.size > 1) errors.push(`${configPath}.data.datasets must use one consistent data form across the chart.`);
    const usesPoints = forms.has("point");
    const usesNumeric = forms.has("numeric");
    if (usesNumeric && !labels) errors.push(`${configPath}.data.labels is required for numeric dataset arrays.`);
    if (labels) datasetResults.forEach(({ form, values }, index) => { if (form !== "point" && values.length !== labels.length) errors.push(`${configPath}.data.datasets[${index}].data length must match ${configPath}.data.labels length.`); });
    if (usesPoints && labels) errors.push(`${configPath}.data.labels is not supported with {x, y} point data.`);
    if (usesPoints && xScaleType === "category") errors.push(`${configPath}.options.scales.x.type must be linear or logarithmic for {x, y} point data.`);
    if (usesPoints && chartType !== "scatter" && !["linear", "logarithmic"].includes(xScaleType)) errors.push(`${configPath}.options.scales.x.type must be linear or logarithmic for {x, y} point data on a ${chartType} chart.`);
    if (usesNumeric && ["linear", "logarithmic"].includes(xScaleType)) errors.push(`${configPath}.data.datasets must use {x, y} point data with a numeric x-axis.`);
    if (xScaleType === "logarithmic") datasetResults.forEach(({ form, values }, datasetIndex) => {
        if (form === "point") values.forEach((point, pointIndex) => {
            if (isFiniteNumber(point?.x) && point.x <= 0) errors.push(`${configPath}.data.datasets[${datasetIndex}].data[${pointIndex}].x must be greater than zero for a logarithmic x-axis.`);
        });
    });
    if (yScaleType === "logarithmic") datasetResults.forEach(({ form, values }, datasetIndex) => {
        values.forEach((value, pointIndex) => {
            const y = form === "point" ? value?.y : value;
            if (isFiniteNumber(y) && y <= 0) errors.push(`${configPath}.data.datasets[${datasetIndex}].data[${pointIndex}]${form === "point" ? ".y" : ""} must be greater than zero for a logarithmic y-axis.`);
        });
    });
};

export const validateCharts = (errors, container, path) => {
    if (!Object.hasOwn(container, "charts")) return;
    if (!Array.isArray(container.charts)) { errors.push(`${path}.charts must be an array if provided.`); return; }
    const chartIds = new Set();
    container.charts.forEach((chart, index) => {
        const chartPath = `${path}.charts[${index}]`;
        if (isText(chart?.id)) {
            if (chartIds.has(chart.id)) errors.push(`${chartPath}.id duplicates chart id "${chart.id}" within ${path}.charts.`);
            chartIds.add(chart.id);
        }
        validateChart(errors, chart, chartPath);
    });
};
