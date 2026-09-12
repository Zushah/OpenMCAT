export const CHART_PROMPT = `Chart guidance:
- The output schema version is 1.2. Optional tables, charts, and figureDescriptions arrays may appear on passage objects and directly on question objects.
- Use question-level tables, charts, or figureDescriptions only when that format is the clearest way to supply information tied specifically to that question. Do not add any stimulus merely because the schema permits it.
- Use tables when exact tabular values are the clearest representation. A passage or question may contain both tables and charts when each is contextually useful.
- Use charts for quantitative or categorical plots when a graphical representation materially improves the stimulus or reasoning task.
- Use figureDescriptions only for non-renderable non-chart visuals OpenMCAT cannot deterministically render, such as pathways, reaction schemes, apparatus, molecular structures, circuits, or conceptual diagrams. Do not generate or reference actual images.
- Charts use a JSON-only subset of the Chart.js library. Supported chart and dataset types are line, bar, and scatter. Multiple datasets and mixed charts using supported dataset-level type overrides are allowed.
- Supply numeric dataset arrays with aligned category labels, or numeric {"x": number, "y": number} points. Keep every chart value internally consistent with its passage or question prose, correct answer, choice rationales, and explanation.
- Supported Cartesian scale types are category, linear, and logarithmic. Use only semantic scale fields shown in the schema: type, title display/text, min, max, and beginAtZero. Every value and bound on a logarithmic dimension must be positive, and beginAtZero must not be true for a logarithmic axis.
- Supply chart semantics and data only. Do not supply colors, fonts, borders, line or point styling, dimensions, animation, events, hover behavior, tooltip settings, callbacks, plugins, external data sources, or any other styling or interactivity configuration.`;
