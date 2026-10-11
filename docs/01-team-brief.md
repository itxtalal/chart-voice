# ChartVoice team brief

Source: `originals/chartvoice-team-brief.pdf` (Oct 9, 2026). Where this differs from the build plan, **the build plan wins** (see the end of this file).

## The idea

ChartVoice turns a chart image into an accurate data table, a plain-language summary and sound, so blind, low-vision and chart-averse readers get the actual numbers.

One-line pitch: "ChartVoice lets anyone hear, read and check the real numbers inside a chart image."

Built at Banana Hacks 2026 (Oct 10, 5 AM to Oct 12, 9 AM, Pakistan time). Team target: submit by Sunday evening.

## The problem and who it's for

Charts carry the key numbers in textbooks, papers, news and financial reports, but they are images. A screen reader usually says only "image" or reads a vague alt text, so the data is lost.

| User group | What goes wrong today | What ChartVoice gives them |
|---|---|---|
| Blind users (screen readers) | The chart is silent or described vaguely | A navigable data table, spoken summary and sound |
| Low-vision users | Small labels, thin lines and low contrast are hard to read | A large, high-contrast redrawn chart and large-text table |
| People who find charts hard to read (low data literacy, dyslexia, unfamiliar chart types) | They misread scales or miss the main trend | A plain-language summary: highest, lowest, trend, biggest change |

Scope: bar, line and pie charts only.

## Features (original brief)

| # | Feature | What the user gets | Priority |
|---|---|---|---|
| F1 | Chart input | Upload a screenshot, paste from clipboard, take a phone photo, or pick a sample chart | Must |
| F2 | Data extraction | The chart's data table, read from the image by the DePlot model | Must |
| F3 | Facts engine | Highest, lowest, trend, biggest change, share of total (pie), computed in Python, not guessed | Must |
| F4 | Plain-language summary | 3 to 5 short sentences built from F3's facts | Must |
| F5 | Read aloud | The summary spoken with the browser's speech engine | Must |
| F6 | Accessible data table | A real HTML table a screen reader can navigate cell by cell | Must |
| F7 | Sonification | Chart played as tones: higher value = higher pitch, left to right | Should |
| F8 | Keyboard explorer | Arrow keys move point by point; each value is announced, e.g. "April, 40" | Should |
| F9 | Verification view | Extracted data redrawn as a large, high-contrast chart next to the original | Should |
| F10 | Trust warnings | Flags when extraction looks wrong, e.g. pie shares not summing to about 100% | Should |
| F11 | Comparison mode | A generic AI description of the same chart next to ChartVoice's output | Nice to have |

## How it works

Chart image (React upload) → DePlot extraction (pretrained, loaded once) → parse table (raw text to clean numbers, flags failures) → facts and checks (max, min, trend, changes, warnings) → accessible outputs (summary + voice, data table, sound + keys, verify view).

Only DePlot is an AI model in the original design; parsing, facts, checks and every output are the team's own code. A request takes a few seconds on a laptop CPU, with no training. DePlot: `google/deplot`, Apache-2.0.

## Why not just ChatGPT

A chatbot can describe a chart, but it can get numbers wrong, and a blind user cannot see the chart to catch the mistake. ChartVoice gives output that can be checked: a table, a redrawn chart, sound and warnings.

| | Generic AI description | ChartVoice |
|---|---|---|
| Output | A paragraph of text | Table, summary, sound, keyboard exploration, redrawn chart |
| Numbers | Written by the language model | Extracted from the image, then computed in code |
| Checkable by a helper | Hard | Yes: original beside redrawn chart |
| Flags its own errors | Rarely | Sanity-check warnings |

Note: the brief also claimed "free, runs locally, image never sent to a third party". That stopped being true once Groq was added (see build plan). Don't use that claim in the video or write-up.

## Evaluation plan

1. Test set: 30 bar, line and pie charts with known data tables (ChartQA images and source tables; check and credit the license). Pick them before tuning anything.
2. Metric 1, value accuracy: share of extracted values within 5% of the true value.
3. Metric 2, summary correctness: is the reported highest, lowest and trend right? Yes or no per chart.
4. Baseline: an open AI model asked to describe the same charts; score its numbers the same way.
5. Metric 3, latency: median seconds per chart on a laptop CPU.
6. Failure log: 3 to 5 examples where ChartVoice was wrong, shown honestly.

Result line once measured: "ChartVoice extracted chart values within 5% on X% of 30 test charts vs Y% for a generic AI description."

## 3-minute video plan (aim for 2:50)

| Time | Show | Say |
|---|---|---|
| 0:00 to 0:20 | A screen reader reading a news chart as just "image" | The problem: charts lock data away from blind, low-vision and chart-averse readers |
| 0:20 to 1:30 | Live demo: upload chart, table appears, summary read aloud, play the sound, arrow through points | What ChartVoice does |
| 1:30 to 2:00 | Pipeline diagram | How it works |
| 2:00 to 2:35 | Generic AI vs ChartVoice; evaluation table; one failure case | Why it's trustworthy, with measured numbers |
| 2:35 to 2:50 | Verify view and warnings | Future work: PDFs, more chart types, a browser extension |

## Risks and fallback

| Risk | Plan |
|---|---|
| DePlot is poor on our charts | Saturday gate: switch to the backup idea (ClearPath, same stack) |
| DePlot is slow on CPU | Resize images first; demo-mode saved results for the video; Colab T4 for evaluation |
| Parsing DePlot output breaks | Robust parser tested on 10 real outputs; show a clear warning instead of crashing |
| Complex charts (stacked, multi-axis) | Out of scope; say so in the UI and README |
| Wrong numbers mislead users | Trust warnings, verification view, limitations note |
| Running out of time | Cut comparison first, then verify view; never cut core features, the evaluation or the video |
| Rules breach | No code before Oct 10, 5 AM Pakistan time; no code from older projects |

## What changed in the build plan

- Groq LLM added for summary, explanation, follow-up questions and the comparison description.
- Sonification and keyboard explorer were marked "Cut" in the plan. **They are now built in the frontend** (see `06-frontend.md`).
- Team is three people, not four roles. See `02-build-plan.md`.
