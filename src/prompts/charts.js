export const CHART_PROMPT = `Chart guidance:
- The output schema version is 1.1. Optional charts arrays may appear on passage objects and directly on question objects.
- Add a chart only when a graphical representation materially improves the stimulus or reasoning task. Do not add charts merely because the schema supports them.
- Use tables when exact tabular values are the clearest representation. A passage may contain both tables and charts when each is contextually useful.
- Use figureDescriptions only for non-chart visuals OpenMCAT cannot deterministically render, such as pathways, reaction schemes, apparatus, molecular structures, circuits, or conceptual diagrams. Do not generate or reference actual images.
- Charts use a JSON-only subset of the Chart.js library. Supported chart and dataset types are line, bar, and scatter. Multiple datasets and mixed charts using supported dataset-level type overrides are allowed.
- Supply numeric dataset arrays with aligned category labels, or numeric {"x": number, "y": number} points. Keep every chart value internally consistent with its passage or question prose, correct answer, choice rationales, and explanation.
- Supported Cartesian scale types are category, linear, and logarithmic. Use only semantic scale fields shown in the schema: type, title display/text, min, max, and beginAtZero. Every value and bound on a logarithmic dimension must be positive, and beginAtZero must not be true for a logarithmic axis.
- Supply chart semantics and data only. Do not supply colors, fonts, borders, line or point styling, dimensions, animation, events, hover behavior, tooltip settings, callbacks, plugins, external data sources, or any other styling or interactivity configuration.`;
