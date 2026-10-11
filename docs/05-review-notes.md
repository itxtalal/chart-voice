# Review notes

From reviewing the team brief and build plan on Oct 10. Ticked items are done.

## Check first

- [ ] Confirm all three members meet the eligibility rule (students aged 14 to 24, enrolled) and are registered. If unsure, email team@bananahacks.tech.
- [ ] Plan against the earliest deadline (Mon 8:59 AM PKT). Team target stays Sunday 8 PM.
- [ ] Keep the Devpost write-up under 500 words.
- [ ] Credit every model, library and dataset in the README. Name AI tools used.

## Where the brief and the plan disagree

- **LLM.** The brief says no language model and that nothing is sent to a third party. The plan uses Groq for text and sends the image for comparison. Reword the "why not ChatGPT" pitch: numbers come from extraction and code, the LLM only writes words around them, and the number check catches invented numbers.
- **Sonification and keyboard explorer.** Cut in the plan, but they are the most memorable demo moment and the core of the accessibility story. [x] Built in the frontend.
- **Roles.** Nobody in the 3-person plan owns evaluation, the video, the write-up or screen reader testing. Assign them.
- **Schedule.** The brief's Saturday morning gates have passed. Re-plan from now to Sunday 8 PM. Was the DePlot feasibility check done?

## Missing

- [ ] **Chart type auto-detection.** The API accepts `auto` but nobody owns detecting it (the brief's CLIP classifier was dropped). Simplest fix: backend guesses from DePlot output, or the frontend defaults to asking the user.
- [ ] **Hosting.** No deployment plan. DePlot is about 1 GB, so a cold start is slow. [x] Frontend shows a "model warming up" note using `model_loaded`.
- [x] **Demo fallback.** Frontend mock mode with bar, line and pie samples works with no backend. Use it if Groq rate-limits during recording. Better still: save real backend responses for the samples.
- [ ] **Contract gaps.** Units, multi-series rules, 413 and 415 status codes, warning codes for unsupported charts and approximate values.
- [ ] **Number check.** Normalize formats (1,200 / 55.0 / $1.2M / 12%) and allow numbers from labels, the title and computed facts, or it will fail too often and always fall back to the template.
- [ ] **Honest claims.** DePlot estimates values when a chart has no data labels. Say "approximate and checkable", not "the actual numbers".
- [ ] **Evaluation.** Use ChartQA's test split (DePlot likely trained on its training data), add about 10 outside charts, and define how numbers in the baseline's free text get scored.
- [ ] **README.** Quick start, limitations, credits and licenses.

## Worth adding (best value for time first)

1. [x] Sonification and keyboard explorer.
2. [ ] Editable table: user fixes a wrong value and the summary, redraw and sound update. Needs a small backend endpoint that takes a table and returns facts and summary without the image.
3. [x] Paste and drag-drop upload.
4. [x] Download CSV. [ ] Copy table, copy as alt text.
5. [ ] Future work slide in the video: document reader, browser extension, more chart types.
