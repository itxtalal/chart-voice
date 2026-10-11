# ChartVoice demo video

Builds the hackathon demo video (under 3 minutes) from the real app. Everything is scripted, so a change to the narration or the app means one re-run, not a re-edit.

Output: `out/chartvoice-demo.mp4` (1920x1080, H.264, AAC).

## How it works

1. `narration.json` holds the narrator's lines. `tts.py` speaks them with Kokoro-82M (open source, Apache-2.0) into `audio/narr/`.
2. `record.mjs` drives the real ChartVoice app in Chromium with Playwright and captures frames through the Chrome DevTools screencast. Slides (`slides/slides.html`) are shown as overlays, so the app keeps its state. It logs the time of every narration line, every sentence the app reads aloud, every explorer announcement and every tone.
3. Headless Chromium plays no sound, so `assemble.py` rebuilds the app's audio from that log: read-aloud and announcements with the macOS Samantha voice (the voice the app picks on this Mac), and tones as triangle waves at the same pitches as `useTones.ts`. Then it mixes everything and encodes the MP4.

The first recording against the real backend saves the API responses to `data/`. Later runs replay those same real responses, with the latency that was measured, so every take shows the same numbers.

## Run

```bash
# terminal 1: backend (Inam's), with GROQ_API_KEY set, on :8000
# terminal 2: frontend against the real backend
cd ../Chart-Voice/frontend && VITE_USE_MOCK=false npm run dev

# terminal 3
./build.sh            # record, render app speech, re-record in sync, assemble
```

Delete `data/` to read the chart live again.

## Your own voice instead of Kokoro

Record each line in `narration.json` as `audio/narr/<id>.wav` (any sample rate, mono or stereo), then run `venv/bin/python -c "import json,soundfile as sf;json.dump({l['id']:sf.info(f'audio/narr/{l[\"id\"]}.wav').duration for l in json.load(open('narration.json'))},open('audio/narr/durations.json','w'))"` and `./build.sh`. The video re-times itself to your recordings.

## Credits for the README

Video voiceover: Kokoro-82M (hexgrad, Apache-2.0). Recorded with Playwright and FFmpeg.
