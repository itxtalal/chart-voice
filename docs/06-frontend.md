# Frontend

Owner: Talal. Location: `frontend/`. React 19 + Vite + TypeScript, Chart.js for the redrawn chart, Web Speech API for read aloud, Web Audio API for sonification. No UI framework, plain CSS.

## Run

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build
```

## Demo mode vs real backend

`frontend/.env`:

```
VITE_USE_MOCK=true    # built-in sample data, no backend needed
VITE_USE_MOCK=false   # calls /api, proxied by Vite to http://localhost:8000
```

Restart `npm run dev` after changing it. In demo mode, the three sample charts (bar, line, pie) return matching results, so the whole UI can be shown and tested. Uploaded images get the bar chart result.

## Accessibility test

```bash
npx playwright install chromium   # first time only
npm run build && npm run preview  # terminal 1, serves on :4173
npm run test:a11y                 # terminal 2
```

Runs axe-core (WCAG 2.0, 2.1 and 2.2, level A and AA) in light, dark and high contrast (at the largest text size), before and after an analysis, and checks that the keyboard explorer announces points. Last run on Oct 10: all passed. Automated checks catch only part of the problems. Also test by hand with VoiceOver (Cmd + F5 on Mac) or NVDA on Windows.

## File map

```
src/
├── main.tsx                     entry; loads the font and the announcer
├── App.tsx                      page layout, analyze flow, focus handling, results sections
│                                (summary + ask always shown; the rest are collapsible sections)
├── styles.css                   all styles; themes are CSS variables on :root[data-theme]
├── prefs.ts                     theme + text size, saved in localStorage
├── format.ts                    number formatting
├── sampleChart.ts               bar/line/pie samples drawn to PNG in the browser
├── api/
│   ├── types.ts                 the API contract as TypeScript types
│   ├── client.ts                fetch calls; switches to mock when VITE_USE_MOCK=true
│   └── mock.ts                  fake backend that computes facts from the samples
└── components/
    ├── Announcer.tsx            app-wide screen reader live regions (useAnnounce)
    ├── SettingsBar.tsx          text size, colors, reading voice and speed, behind one Settings button
    ├── ChartInput.tsx           upload, drag-drop, paste, samples; analysis starts on choose; chart type under Options
    ├── Section.tsx              results card with an h3 heading; `collapsible` puts a toggle button inside the h3
    ├── SummaryPanel.tsx         summary, three big numbers, explanation, read aloud
    ├── KeyFacts.tsx             highest, lowest, change, trend, total, pie shares
    ├── DataTable.tsx            accessible table + CSV download
    ├── WarningBanner.tsx        trust warnings
    ├── AskChat.tsx              follow-up questions, suggested questions
    ├── ComparePanel.tsx         generic AI vs ChartVoice
    ├── explore/
    │   ├── ChartExplorer.tsx    keyboard explorer + sonification controls
    │   └── useTones.ts          Web Audio tones, value to pitch (220 to 880 Hz)
    ├── voice/
    │   ├── ReadAloud.tsx        play, pause, resume, stop; reports the sentence being read
    │   ├── useSpeech.ts         speaks sentence by sentence (avoids Chrome cutting long text)
    │   ├── narration.ts         rewrites text for the ear: "Jan (20)" -> "January, 20", "(+17)" -> "up 17"
    │   └── voicePrefs.ts        saved voice + speed; ranks voices (Natural/Premium/Enhanced first, novelty voices hidden)
    └── verify/
        └── RedrawnChart.tsx     high-contrast Chart.js redraw, values printed, theme aware
```

## Keep it simple

The results page shows only what most people need: the summary, three big numbers, read aloud and Ask a question. Everything else (explore by sound, table, all facts, check against the original, compare) sits in collapsed sections. Each section's toggle is a button inside its h3, so heading navigation still finds them. Add new features as collapsed sections, not new always-open cards.

## Accessibility rules for this project

Keep these when changing anything:

- **Headings in order.** One h1 (visually hidden), h2 for steps ("Add a chart", "Results"), h3 for each results section, h4 inside sections. Screen reader users jump by heading.
- **Announce, don't surprise.** Use `useAnnounce()` for status changes: chart selected, analyzing, analysis complete, answer received. Use `'assertive'` only for direct responses to key presses (the explorer).
- **Move focus on big changes.** Choosing a chart starts the analysis (no separate Analyze button). After analysis, focus goes to the Results heading. On error, to the error box. After "Read another chart", to the upload box.
- **Don't use `disabled` on buttons.** It hides them from keyboard users and they never learn why. Use `aria-disabled` and explain in the click handler (see Analyze chart).
- **Every control has a visible label.** No placeholder-only inputs.
- **Targets at least 44 px.** Buttons, chips, radio pills all have a min height around 2.75rem.
- **Never color alone.** Values are printed on the redrawn chart; the current explorer point has an outline, not just a color.
- **Canvas is decorative.** The redrawn chart is `aria-hidden`; the same data is in the table, facts and explorer.
- **Themes.** Light, dark and high contrast (black, white, yellow, cyan). Defaults follow the OS (`prefers-color-scheme`, `prefers-contrast`). Also handles Windows forced colors and reduced motion.
- **Text size.** A, A+, A++ scale the whole page via `--scale`. Test at A++.
- **Phones.** Everything below 600 px wide is in one `@media (max-width: 600px)` block at the end of `styles.css`. It uses px for spacing on purpose, so A++ spends the narrow screen on text, not padding. The test script checks 320 and 390 px at A++ for axe issues and sideways scrolling.
- **Font.** Atkinson Hyperlegible (made by the Braille Institute for low-vision readers), bundled locally.

## Read aloud

- The best installed English voice is picked automatically: Edge "Natural" voices, then macOS Premium/Enhanced, then Chrome's Google voices. Joke voices like Albert or Zarvox are never offered.
- Voice and speed are chosen once in Settings and used everywhere (summary and chat answers). Saved per browser.
- The summary is read as a short script: title and chart type, then the summary and explanation, without repeated sentences.
- Text is rewritten for listening only (the screen keeps the original): month and week abbreviations spelled out, "(+17)" read as "up 17", "%" as "percent", brackets become pauses.
- The sentence being read is highlighted on screen.
- Tip for the demo: on a Mac, download a Premium voice (System Settings, Accessibility, Spoken Content, System voice, Manage voices), or use Edge, which has natural online voices.

## Keyboard explorer keys

Focus the explorer box (Tab or click), then:

| Key | Action |
|---|---|
| Left / Right | Previous / next point (announced, plus a tone if enabled) |
| Home / End | First / last point |
| Enter or Space | Play the current point as a tone |
| P | Play the whole chart as sound |
| Esc | Stop sound |
| Up / Down | Switch series (multi-series charts only) |

Announcement example: "Mar, 40. Up 15 from Feb. Point 3 of 5." Highest and lowest points say so. Pie points include the percent of total.

The box uses `role="application"` so screen readers pass arrow keys through. NVDA and JAWS switch to focus mode automatically; with VoiceOver it works with Quick Nav off.

## Known gaps and next steps

- [ ] Test with VoiceOver and NVDA by hand (at least the full flow once).
- [ ] Switch `.env` to the real backend once Inam's `/api/analyze` works; check error messages and warning text look right.
- [ ] Editable table (needs a backend endpoint).
- [ ] Copy table / copy as alt text buttons.
- [ ] Phone camera: on mobile the upload button already offers the camera through the OS picker.
- [ ] Evaluation page for the video (results table, failure examples).
- [ ] Line chart value labels can still crowd when points are close together.
