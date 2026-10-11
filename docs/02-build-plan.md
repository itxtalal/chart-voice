# Build plan

Source: `originals/build-plan-and-api-contract.docx`.

## Team

| Person  | Owns                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Inam    | Backend API (FastAPI), DePlot extraction and parsing, facts, checks, template summary, evaluation, repo skeleton |
| Hasnain | Groq LLM module (summary, explanation, questions, comparison), sample charts, ground-truth CSVs                  |
| Talal   | **The whole frontend** (`frontend/`)                                                                             |

The original plan had Inam building most of the frontend and Talal only the read-aloud and redrawn chart components. Talal now owns all of `frontend/`. Tell Inam so he doesn't scaffold a second frontend.

## Scope

The user uploads one chart image. ChartVoice returns the data table, a plain-language summary and explanation, answers follow-up questions about that chart, and shows a generic AI description side by side for comparison.

| Feature                                                                                | Status                                           |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Upload chart image (PNG, JPG, WEBP, max 10 MB) and sample charts                       | Build now                                        |
| Extract the data table from the image (DePlot) and parse it                            | Build now                                        |
| Compute facts in code: max, min, first, last, trend, biggest rise and drop, shares     | Build now                                        |
| Sanity-check warnings (parse failed, missing values, pie not about 100%)               | Build now                                        |
| Template summary used when the LLM is unavailable or fails the number check            | Build now                                        |
| Plain-language summary and explanation (Groq LLM)                                      | Build now                                        |
| Number check: every number the LLM writes must exist in the table or facts             | Build now                                        |
| Ask questions about the chart; off-topic questions refused                             | Build now                                        |
| Comparison mode: generic AI description from the image (Groq vision) beside ChartVoice | Build now                                        |
| Read aloud with play, pause, stop and speed                                            | Build now (done)                                 |
| Redrawn chart beside the original (verify view)                                        | Build now (done)                                 |
| Accessible data table, layout, loading and error states                                | Build now (done)                                 |
| FastAPI endpoints joining all parts                                                    | Build now                                        |
| Evaluation on 30 charts                                                                | After the core works                             |
| Sonification, keyboard explorer                                                        | Plan said cut. **Built anyway in the frontend.** |
| Document reader that reads text aloud and explains charts as they appear               | Future work (video and README only)              |

## Rules

- No code from older projects.
- Every member commits their own work (commit timestamps are checked by the organizers).
- The Groq API key never goes into Git.

## Repo layout

```
Chart-Voice/                      (GitHub: inamjadoon/Chart-Voice; on Talal's machine: ~/personal/banana-hacks)
├── README.md                     Inam
├── .gitignore                    Inam
├── docs/                         project docs (this folder); Inam keeps api-contract.md in sync
├── backend/                      Inam + Hasnain
│   ├── requirements.txt
│   ├── .env.example              GROQ_API_KEY=, ALLOWED_ORIGINS=http://localhost:5173
│   ├── samples/                  charts/ (Hasnain) and example JSON responses (Inam)
│   ├── app/
│   │   ├── main.py, schemas.py   Inam
│   │   ├── extraction/           Inam (deplot.py, parse.py)
│   │   ├── analysis/             Inam (facts.py, checks.py, template_summary.py)
│   │   └── llm/                  Hasnain (service.py, groq_client.py, prompts.py, number_check.py, image_utils.py)
│   └── tests/
├── frontend/                     Talal
├── eval/                         Inam (Hasnain adds charts and ground truth)
└── video/                        Talal (scripts that build the demo video)
```

Each person edits only their own folders. Shared files (`requirements.txt`, `frontend/package.json`, the API contract, the root README) change only after asking in the group chat.

## Ports

- Backend: http://localhost:8000 (all paths start with `/api`)
- Frontend: http://localhost:5173 (Vite proxies `/api` to the backend)
