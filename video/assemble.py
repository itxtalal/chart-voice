"""Builds the audio track and the final MP4 from out/events.json.

venv/bin/python assemble.py speech   render what the app says (Samantha, like on this Mac) -> audio/app/
venv/bin/python assemble.py build    frames + narration + app speech + tones -> out/chartvoice-demo.mp4
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
OUT = HERE / "out"
APP = HERE / "audio" / "app"
NARR = HERE / "audio" / "narr"
SR = 48000
APP.mkdir(parents=True, exist_ok=True)

log = json.loads((OUT / "events.json").read_text())
events, frames = log["events"], log["frames"]
t0 = next(e["t"] for e in events if e["type"] == "start")
t_end = next(e["t"] for e in events if e["type"] == "end")


def app_wav(text):
    return APP / (hashlib.sha1(text.encode()).hexdigest()[:16] + ".wav")


def speech():
    durs = json.loads((APP / "durations.json").read_text()) if (APP / "durations.json").exists() else {}
    for text in sorted({e["text"] for e in events if e["type"] in ("speech", "sr")}):
        wav = app_wav(text)
        if not wav.exists():
            subprocess.run(["say", "-v", "Samantha", "--data-format=LEI16@48000", "-o", str(wav), text], check=True)
        durs[text] = round(sf.info(wav).duration, 3)
    (APP / "durations.json").write_text(json.dumps(durs, indent=1))
    print(f"{len(durs)} app utterances rendered")


def load48(path):
    a, sr = sf.read(path, dtype="float32", always_2d=True)
    a = a.mean(axis=1)
    if sr != SR:
        x = np.arange(int(len(a) * SR / sr)) * sr / SR
        a = np.interp(x, np.arange(len(a)), a).astype("float32")
    return a


def tone(freq, dur):
    # Same shape as useTones.ts: triangle wave, 20 ms exponential attack to 0.3, exponential decay to dur
    n = int((dur + 0.05) * SR)
    t = np.arange(n) / SR
    tri = 2 * np.abs(2 * ((t * freq) % 1) - 1) - 1
    env = np.where(
        t < 0.02,
        0.0001 * (0.3 / 0.0001) ** (t / 0.02),
        0.3 * (0.0001 / 0.3) ** (np.clip((t - 0.02) / max(dur - 0.02, 1e-3), 0, 1)),
    )
    return (tri * env).astype("float32")


def build():
    total = (t_end - t0) / 1000
    mix = np.zeros(int((total + 1) * SR), dtype="float32")

    def place(a, at, gain=1.0, until=None):
        i = int(max(0, at) * SR)
        if until is not None:
            a = a[: max(0, int((until - at) * SR))]
        a = a[: len(mix) - i]
        mix[i : i + len(a)] += a * gain

    cancels = [(e["t"] - t0) / 1000 for e in events if e["type"] == "speech_cancel"]
    stops = {e["id"]: e for e in events if e["type"] == "tone_stop"}
    for e in events:
        at = (e["t"] - t0) / 1000
        if e["type"] == "narr":
            place(load48(NARR / f"{e['id']}.wav"), at, 1.0)
        elif e["type"] == "speech":
            cut = next((c for c in cancels if c > at), None)
            place(load48(app_wav(e["text"])), at + 0.05, 0.85, until=cut)
        elif e["type"] == "sr":
            place(load48(app_wav(e["text"])), at + 0.05, 0.85)
        elif e["type"] == "tone":
            stop = stops.get(e["id"])
            dur = (stop["delay"] - 0.05 - e["delay"]) if stop else 0.22
            place(tone(e["freq"], max(dur, 0.05)), at + e["delay"], 0.55)

    mix = mix[: int(total * SR)]
    sf.write(OUT / "audio.wav", mix / max(1e-6, np.abs(mix).max()) * 0.9, SR)

    # Variable frame rate list from screencast timestamps, trimmed to [start, end]
    lines = ["ffconcat version 1.0"]
    times = [(t - t0) / 1000 for t in frames]
    first = max([i for i, t in enumerate(times) if t <= 0] or [0])
    for i in range(first, len(frames)):
        start = max(times[i], 0)
        end = times[i + 1] if i + 1 < len(frames) else total
        if start >= total:
            break
        end = min(end, total)
        if end > start:
            lines += [f"file frames/{i:06d}.jpg", f"duration {end - start:.4f}"]
    lines.append(lines[-2])  # concat demuxer needs the last file repeated
    (OUT / "frames.txt").write_text("\n".join(lines) + "\n")

    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(OUT / "frames.txt"),
         "-i", str(OUT / "audio.wav"),
         "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
         "-t", f"{total:.3f}", "-movflags", "+faststart", str(OUT / "chartvoice-demo.mp4")],
        check=True,
    )
    print(f"out/chartvoice-demo.mp4: {total:.1f} s")


{"speech": speech, "build": build}[sys.argv[1]]()
