# OpenMCAT

Open-source and local-first MCAT practice and analytics powered by your AI model.

## Status

Early draft. Not intended for public use yet. Feedback welcome.

## Workflow

1. Configure section, topics, skills, difficulty, format, review mode, timing, provider, and model.
2. Generate a session with the selected provider.
3. Session JSON is validated before practice starts.
4. Complete questions in immediate or later review mode.
5. Review explanations and see local analytics in the dashboard.

## Providers

### Mock provider

Use "Mock provider" for instant local generation and UI testing. No API key required.

### Manual JSON paste provider

Use "Manual JSON paste" when direct provider integration is unavailable:

1. Choose "Manual JSON paste."
2. Click "Generate practice session."
3. Copy compiled prompt into any model.
4. Paste returned JSON into OpenMCAT.
5. Validate and start.

Direct provider integrations (OpenAI/Anthropic/Google/Ollama/etc) are intentionally deferred until a later robust integration phase.

## Privacy

No accounts, no telemetry, no server-side storage, all study data is local in the browser, and prompts are only sent to the AI provider you choose.

## Disclaimer

OpenMCAT is an independent free-and-open-source study tool. It is not affiliated with, endorsed by, or sponsored by the Association of American Medical Colleges (AAMC). MCAT is a registered trademark of the AAMC. OpenMCAT generates AI-powered practice for content drilling and reasoning practice. It is not intended to be used as a substitute for official AAMC practice materials and it does not predict MCAT scores.

## License

OpenMCAT is available under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.github.com/Zushah/OpenMCAT/blob/main/LICENSE.md).
