# ChartVoice (Banana Hacks 2026)

ChartVoice turns a chart image into a data table, a plain-language summary, speech and sound, for blind, low-vision and chart-averse readers. Built during Banana Hacks 2026 (online, generative and image AI theme). Team target: submit Sunday Oct 11, 8 PM PKT. Hard deadline: Monday Oct 12, 8:59 AM PKT.

## My role

I'm Talal and I own **only the frontend** (`Chart-Voice/frontend/`). Inam owns the backend, extraction, analysis and evaluation; Hasnain owns the Groq LLM module. **Do not create or edit anything under `Chart-Voice/backend/` or `Chart-Voice/eval/`**, and don't change the API contract without saying it needs team agreement.

## Read these first

- `docs/README.md` index of all docs
- `docs/06-frontend.md` frontend structure, accessibility rules, how to run and test, what's left
- `docs/03-api-contract.md` endpoints and JSON shapes (types in `frontend/src/api/types.ts`)
- `docs/04-hackathon.md` rules, deadlines, submission checklist, judging
- `docs/05-review-notes.md` open gaps and ideas

## Commands (run in `frontend/`)

- `npm run dev` dev server on http://localhost:5173 (proxies `/api` to :8000)
- `npm run build` type-check and build
- `npm run preview` then `npm run test:a11y` axe + keyboard checks in all themes

`frontend/.env`: `VITE_USE_MOCK=true` uses built-in sample data; `false` calls the real backend.

## Rules for any change

- Accessibility comes first: follow the rules in `docs/06-frontend.md` (heading order, live announcements, focus moves, `aria-disabled` instead of `disabled`, visible labels, 44 px targets, no color-only meaning). Run `npm run test:a11y` after UI changes.
- All three themes (light, dark, high contrast) and the A++ text size must keep working. Use the CSS variables, never hard-coded colors.
- TypeScript strict, no new UI frameworks. Keep components small and in their folders.
- Hackathon rules: all code written during the event, every dependency credited in the README, no secrets in Git.
- Writing style for UI text and docs: plain, direct, human. No em dashes.
