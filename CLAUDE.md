# ChartVoice (Banana Hacks 2026)

ChartVoice turns a chart image into a data table, a plain-language summary, speech and sound, for blind, low-vision and chart-averse readers. Built during Banana Hacks 2026 (online, generative and image AI theme). Hard deadline: Monday Oct 12, 8:59 AM PKT. Deadlines and the submission checklist are in `docs/04-hackathon.md`.

## Layout

```
backend/    FastAPI app on :8000 (all paths start with /api)
  app/main.py          endpoints, extractor choice, in-memory cache
  app/extraction/      deplot.py (offline reader), parse.py (table text to clean rows)
  app/analysis/        facts.py, checks.py (warnings), crosscheck.py, template_summary.py
  app/llm/             Groq client, prompts, vision reading, number_check.py
  tests/               pytest
  samples/             sample charts and example JSON responses
frontend/   React 19 + Vite + TypeScript, plain CSS, Chart.js; dev server on :5173
eval/       charts with known data, ground_truth/ CSVs, scoring and speed scripts, results.md
video/      scripts that build the demo video from the real app (see video/README.md)
docs/       team brief, build plan, API contract, hackathon rules, review notes, frontend guide
```

## How a chart is read

1. `POST /api/analyze` gets the image. Same image again returns from the cache.
2. Reader, picked by `EXTRACTOR`: `auto` tries the Groq vision model first and falls back to DePlot; `vision` or `deplot` forces one. `CROSS_CHECK=1` runs both and warns where they disagree.
3. `parse.py` cleans the table, `facts.py` computes max, min, trend, changes and shares in code, `checks.py` adds warnings.
4. The Groq text model writes the summary. `number_check.py` rejects any number not in the table or facts, and `template_summary.py` takes over.
5. `/api/ask` answers questions from the table; `/api/compare` gets a generic vision-model description for side-by-side comparison.

Models: `qwen/qwen3.8-27b` (vision) and `openai/gpt-oss-120b` (text) on Groq, `google/deplot` locally. Override with `GROQ_VISION_MODEL` and `GROQ_TEXT_MODEL`.

## Read these first

- `README.md` what it does, setup, evaluation numbers, limitations, credits
- `docs/README.md` index of all docs
- `docs/03-api-contract.md` endpoints and JSON shapes (frontend types in `frontend/src/api/types.ts`)
- `docs/06-frontend.md` frontend structure, accessibility rules, what's left
- `docs/05-review-notes.md` open gaps and ideas

## Commands

Backend (in `backend/`, virtual env active, `.env` copied from `.env.example` with `GROQ_API_KEY`):

- `pip install torch --index-url https://download.pytorch.org/whl/cpu` then `pip install -r requirements.txt`
- `uvicorn app.main:app --port 8000` run the API (DePlot takes 10 to 60 s to load)
- `pytest` run the tests

Frontend (in `frontend/`):

- `npm run dev` dev server on http://localhost:5173 (proxies `/api` to :8000)
- `npm run build` type-check and build
- `npm run preview` then `npm run test:a11y` axe + keyboard checks in all themes and phone widths
- `frontend/.env`: `VITE_USE_MOCK=true` uses built-in sample data; `false` calls the real backend

Evaluation (from `backend/`, virtual env active):

- `python ../eval/run_eval.py` DePlot accuracy, writes `eval/results.md`
- `python ../eval/run_eval_vision.py` Groq vision accuracy (needs `GROQ_API_KEY`)
- `python ../eval/speed_test.py` DePlot speed settings

Video: `video/build.sh` (needs the backend and the frontend running; details in `video/README.md`).

On this Mac the shell's nvm wrapper breaks `node` and `npm`. Run `unset -f node npm npx` and put `~/.nvm/versions/node/v24.21.0/bin` first on `PATH`.

## Rules for any change

- The API contract in `docs/03-api-contract.md`, `backend/app/schemas.py` and `frontend/src/api/types.ts` must match. Change all three together.
- Numbers shown to users come from extraction and code, never from the language model. Keep the number check strict.
- Accessibility comes first: follow the rules in `docs/06-frontend.md` (heading order, live announcements, focus moves, `aria-disabled` instead of `disabled`, visible labels, 44 px targets, no color-only meaning). Run `npm run test:a11y` after UI changes.
- All three themes (light, dark, high contrast) and the A++ text size must keep working. Use the CSS variables, never hard-coded colors.
- TypeScript strict, no new UI frameworks. Keep components small and in their folders.
- Backend errors return `{"detail": "..."}` in plain words; the frontend shows it to the user.
- Run `pytest` after backend changes. Don't change measured numbers in `eval/results.md` or the README by hand; rerun the scripts.
- Hackathon rules: every dependency and model credited in the README, credits in the README Team section kept accurate, no secrets in Git (`.env` is ignored).
- Writing style for UI text and docs: plain, direct, human. No em dashes.
