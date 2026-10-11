"""Narration with Kokoro-82M (Apache-2.0). Writes audio/narr/<id>.wav and audio/narr/durations.json.

Usage: venv/bin/python tts.py [voice] [speed]   (default af_heart 1.0)
Only re-renders lines whose text, voice or speed changed.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
OUT = HERE / "audio" / "narr"
OUT.mkdir(parents=True, exist_ok=True)
voice = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

lines = json.loads((HERE / "narration.json").read_text())
cache_file = OUT / "cache.json"
cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
durations = {}
pipeline = None

for line in lines:
    key = hashlib.sha1(f"{voice}|{speed}|{line['text']}".encode()).hexdigest()
    wav = OUT / f"{line['id']}.wav"
    if cache.get(line["id"]) != key or not wav.exists():
        if pipeline is None:
            from kokoro import KPipeline

            pipeline = KPipeline(lang_code=voice[0])
        chunks = [a for _, _, a in pipeline(line["text"], voice=voice, speed=speed)]
        audio = np.concatenate([np.asarray(c) for c in chunks])
        sf.write(wav, audio, 24000)
        cache[line["id"]] = key
        print("rendered", line["id"])
    durations[line["id"]] = round(sf.info(wav).duration, 3)

cache_file.write_text(json.dumps(cache, indent=1))
(OUT / "durations.json").write_text(json.dumps(durations, indent=1))
print(json.dumps(durations, indent=1))
print("total narration: %.1f s" % sum(durations.values()))
