#!/bin/zsh
# Full build: narration, recording, app speech, a second recording in sync, then the MP4.
set -e
cd "$(dirname "$0")"
unset -f node npm npx 2>/dev/null || true
NODE=${NODE:-$HOME/.nvm/versions/node/v24.21.0/bin/node}
export PW_CHROMIUM=${PW_CHROMIUM:-$(ls -d ~/Library/Caches/ms-playwright/chromium-1243/chrome-mac*/*.app/Contents/MacOS/* | head -1)}

venv/bin/python tts.py af_heart 1.08 2>&1 | grep -v -i warn | tail -1
$NODE record.mjs                         # 1st pass: saves real API responses, collects what the app says
venv/bin/python assemble.py speech       # render those lines with Samantha
$NODE record.mjs                         # 2nd pass: highlights timed to the real audio lengths
venv/bin/python assemble.py speech
venv/bin/python assemble.py build
ffprobe -v error -show_entries format=duration -of csv=p=0 out/chartvoice-demo.mp4
