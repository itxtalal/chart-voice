"""ChartVoice API.

Run from backend/:  uvicorn app.main:app --reload --port 8000
Interactive docs:   http://localhost:8000/docs

Pipeline for POST /api/analyze:
  image -> read the chart into a table
             online:  Groq vision model (about 2-5 s), optional DePlot cross-check
             offline: DePlot on this computer (about 30-90 s on a CPU)
        -> parse -> facts -> checks + reading warnings
        -> Groq summary + number check (online) or template summary (offline)
"""

import copy
import hashlib
import io
import os
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from app.analysis.checks import crosscheck_warning, reading_warnings, run_checks
from app.analysis.crosscheck import compare_tables
from app.analysis.facts import compute_facts
from app.analysis.template_summary import labels_are_ordered, template_summary
from app.extraction.parse import ParsedTable, parse_table
from app.llm import service as llm
from app.schemas import AnalyzeResponse, AskRequest, AskResponse, CompareResponse, HealthResponse

load_dotenv()

MAX_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp"}

# auto = vision model when online, DePlot when offline; or force "deplot" / "vision".
EXTRACTOR = os.getenv("EXTRACTOR", "auto")
# 1 = also read with DePlot and compare (slower on a CPU, but catches misreadings).
CROSS_CHECK = os.getenv("CROSS_CHECK", "0") == "1"
DEPLOT_MAX_SECONDS = float(os.getenv("DEPLOT_MAX_SECONDS", "90"))
CACHE_SIZE = 32
LLM_WARNINGS = {
    "unavailable": {"code": "llm_unavailable", "message": "AI explanation unavailable (offline mode); showing a basic summary."},
    "numbers_unverified": {"code": "llm_numbers_unverified", "message": "The AI text contained numbers not found in the chart, so a basic summary is shown instead."},
}

state: dict = {"model": None, "load_error": None}

# DePlot uses every CPU core, so two runs at once make both crawl: allow one at a time.
deplot_lock = threading.Lock()
# Same image + same chart type -> same answer: keep recent results (instant repeats in a demo).
cache: "OrderedDict[str, dict]" = OrderedDict()


class Busy(Exception):
    pass


def run_deplot(img: Image.Image) -> tuple[str, float]:
    """Run DePlot if no other chart is being read; returns (raw text, seconds)."""
    if not deplot_lock.acquire(timeout=2):
        raise Busy()
    try:
        t0 = time.perf_counter()
        return state["model"].extract(img), time.perf_counter() - t0
    finally:
        deplot_lock.release()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load DePlot once at startup; every request reuses it from memory.
    try:
        from app.extraction.deplot import DePlotModel

        state["model"] = await run_in_threadpool(DePlotModel)
    except Exception as exc:  # keep the server up so /api/health can report the problem
        state["load_error"] = str(exc)
    yield


app = FastAPI(title="ChartVoice API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def read_image(upload: UploadFile) -> tuple[bytes, Image.Image]:
    if upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Please upload a PNG, JPG or WEBP image.")
    data = await upload.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "The image is larger than 10 MB.")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "This file could not be read as an image.")
    return data, image.convert("RGB")


def guess_chart_type(rows: list[list]) -> str:
    """Pick bar, line or pie when the user chose Auto, so the frontend can always redraw it.

    One series of non-negative values summing to about 100 -> pie (parts of a whole);
    labels that are years or months -> line (change over time); otherwise -> bar.
    """
    labels = [str(r[0]) for r in rows]
    if rows and all(len(r) == 2 for r in rows):
        values = [r[1] for r in rows if isinstance(r[1], (int, float))]
        if values and all(v >= 0 for v in values) and 95 <= sum(values) <= 105:
            return "pie"
    return "line" if labels_are_ordered(labels) else "bar"


@app.get("/api/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "model_loaded": state["model"] is not None,
        "extractor": EXTRACTOR,
        "online": bool(os.getenv("GROQ_API_KEY")),
    }


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    image: UploadFile = File(...),
    chart_type: Literal["auto", "bar", "line", "pie"] = Form("auto"),
):
    start = time.perf_counter()
    data, img = await read_image(image)

    key = hashlib.sha256(data).hexdigest() + chart_type
    if key in cache:
        cache.move_to_end(key)
        result = copy.deepcopy(cache[key])
        result["timing_ms"] = {"extract": 0, "llm": 0, "total": int((time.perf_counter() - start) * 1000)}
        return result

    # 1. Read the chart into a table.
    parsed, extractor, vision_type, axes, context = None, None, None, None, None
    right_axis, printed_values, truncated, extra_warnings = [], None, False, []

    if EXTRACTOR in ("auto", "vision"):
        try:
            v = await run_in_threadpool(llm.extract_table_vision, data)
            parsed = ParsedTable(v["title"], v["columns"], v["rows"], ok=bool(v["rows"]) and len(v["columns"]) >= 2)
            extractor, vision_type = "vision", v["chart_type"]
            right_axis, printed_values, axes = v["right_axis"], v["printed_values"], v.get("axes")
            context = v.get("context")
            if not parsed.ok and EXTRACTOR == "auto":
                parsed = None  # unusable reading: fall back to DePlot below
        except llm.LLMError as exc:
            if EXTRACTOR == "vision":
                raise HTTPException(503, f"The online chart reader is unavailable. ({exc})")

    if parsed is None or CROSS_CHECK:
        if state["model"] is None:
            if parsed is None:
                raise HTTPException(503, f"The chart model is not loaded yet. {state['load_error'] or 'Try again in a moment.'}")
        else:
            try:
                raw, seconds = await run_in_threadpool(run_deplot, img)
            except Busy:
                if parsed is None:
                    raise HTTPException(503, "Another chart is being read right now. Please try again in a moment.")
                raw = None
            if raw is not None:
                deplot = parse_table(raw)
                if parsed is None:
                    parsed, extractor = deplot, "deplot"
                    truncated = seconds >= DEPLOT_MAX_SECONDS * 0.95
                elif deplot.ok:
                    check = compare_tables({"columns": parsed.columns, "rows": parsed.rows}, {"columns": deplot.columns, "rows": deplot.rows})
                    w = crosscheck_warning(check)
                    if w:
                        extra_warnings.append(w)
    extract_ms = int((time.perf_counter() - start) * 1000)

    # 2. Facts and warnings.
    ctype = chart_type if chart_type != "auto" else (vision_type or guess_chart_type(parsed.rows))
    table = {"columns": parsed.columns, "rows": parsed.rows}
    facts = compute_facts(parsed.columns, parsed.rows, ctype) if parsed.ok else {"series": []}
    warnings = run_checks(parsed, ctype)
    if parsed.ok:
        warnings += reading_warnings(parsed, right_axis, printed_values, truncated) + extra_warnings
    labels = [str(r[0]) for r in parsed.rows]

    llm_start = time.perf_counter()
    result = {"status": "unavailable"}
    if parsed.ok and facts["series"]:
        result = await run_in_threadpool(llm.explain, parsed.title, ctype, table, facts, printed_values is False, axes, context)
    llm_ms = int((time.perf_counter() - llm_start) * 1000)

    if result["status"] == "ok":
        summary, explanation, source = result["summary"], result["explanation"], "llm"
    else:
        text = template_summary(parsed.title, ctype, facts, labels)
        summary, explanation, source = text["summary"], text["explanation"], "template"
        if parsed.ok:
            warnings.append(LLM_WARNINGS[result["status"]])

    response = {
        "chart_type": ctype,
        "title": parsed.title,
        "table": table,
        "facts": facts,
        "summary": summary,
        "explanation": explanation,
        "text_source": source,
        "extractor": extractor,
        "warnings": warnings,
        "timing_ms": {"extract": extract_ms, "llm": llm_ms, "total": int((time.perf_counter() - start) * 1000)},
    }
    if parsed.ok:
        cache[key] = copy.deepcopy(response)
        if len(cache) > CACHE_SIZE:
            cache.popitem(last=False)
    return response


@app.post("/api/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    return await run_in_threadpool(
        llm.answer_question,
        req.question,
        req.title,
        req.chart_type,
        req.table.model_dump(),
        req.facts.model_dump(by_alias=True),
        [m.model_dump() for m in req.history],
    )


@app.post("/api/compare", response_model=CompareResponse)
async def compare(image: UploadFile = File(...)):
    data, _ = await read_image(image)
    start = time.perf_counter()
    try:
        result = await run_in_threadpool(llm.describe_image_generic, data)
    except llm.LLMError as exc:
        raise HTTPException(503, f"Comparison needs an internet connection and a Groq key. ({exc})")
    return {**result, "timing_ms": int((time.perf_counter() - start) * 1000)}
