# ChartVoice frontend

React + Vite + TypeScript. Built for screen reader and low-vision users first.

```bash
npm install
npm run dev        # http://localhost:5173
```

`.env` has `VITE_USE_MOCK=true` so the UI runs on sample data with no backend. Set it to `false` to call the FastAPI backend (proxied from `/api` to http://localhost:8000).

Accessibility check: `npx playwright install chromium` once, then `npm run build && npm run preview` and `npm run test:a11y`.

## Credits

React, Vite, TypeScript, Chart.js (MIT). Atkinson Hyperlegible font by the Braille Institute (SIL Open Font License), via Fontsource. axe-core and Playwright for testing.
