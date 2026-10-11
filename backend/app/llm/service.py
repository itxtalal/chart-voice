"""Public LLM functions used by the API.

Online mode: Groq writes the summary, explanation and answers.
Offline mode (no key, no internet, Groq error): explain() reports
"unavailable" and the API falls back to the template summary.
"""

import json
import re
from typing import Optional

from app.analysis.template_summary import labels_are_ordered
from app.extraction.parse import to_number
from app.llm import prompts
from app.llm.groq_client import VISION_MODEL, LLMError, chat_json, chat_text
from app.llm.image_utils import to_data_url
from app.llm.number_check import check_directions, check_numbers

__all__ = ["LLMError", "explain", "answer_question", "extract_table_vision", "describe_image_generic", "check_numbers"]

MAX_HISTORY = 6
MAX_TOKENS = 2000  # reasoning models spend tokens thinking before they answer
VISION_MAX_TOKENS = 900  # free-tier vision limit is 1,000 output tokens per minute


_SIGNED_DROP = re.compile(r"\b(drop|dropped|decline|declined|fall|fell|decrease|decreased|loss|lost)(\s+(?:of|by))?\s+-(?=\d)", re.I)


_ODD_CHARS = str.maketrans({"‑": "-", "‐": "-", "–": "-", " ": " ", " ": " ", " ": " ", "÷": "/"})


def _no_double_negative(text: str) -> str:
    """Clean AI text for reading aloud: plain hyphens and spaces, and
    'a decline of -2' -> 'a decline of 2' (the AI sometimes copies the sign)."""
    text = text.translate(_ODD_CHARS)
    return _SIGNED_DROP.sub(lambda m: m.group(1) + (m.group(2) or "") + " ", text)


def _chart_message(
    title: Optional[str],
    chart_type: str,
    table: dict,
    facts: dict,
    estimated: bool = False,
    axes: Optional[dict] = None,
    context: Optional[dict] = None,
) -> dict:
    labels = [str(r[0]) for r in table.get("rows", [])]
    ordered = labels_are_ordered(labels)
    if not ordered:
        # Categories (cities, brands...) have no order, so "rises" between them mean nothing.
        keep = {"name", "max", "min", "total", "shares"}
        facts = {"series": [{k: v for k, v in s.items() if k in keep} for s in facts.get("series", [])]}
    payload = {
        "title": title,
        "chart_type": chart_type,
        "labels_in_time_order": ordered,
        "values_estimated": estimated,
        "table": table,
        "facts": facts,
    }
    if axes:
        payload["axes"] = axes
    if context:
        payload["printed_text"] = context
    return {"role": "user", "content": json.dumps(payload)}


def explain(
    title: Optional[str],
    chart_type: str,
    table: dict,
    facts: dict,
    estimated: bool = False,
    axes: Optional[dict] = None,
    context: Optional[dict] = None,
) -> dict:
    """{"status": "ok", "summary", "explanation"} | {"status": "unavailable"} | {"status": "numbers_unverified"}.

    estimated: values were read off the axes (no printed numbers), so the text says "about".
    axes: axis titles, units and ranges from the chart reader, described in the explanation.
    context: printed text from the chart (subtitle, callouts such as "73% average decline",
             inset data, which series are only uncertainty ranges).
    """
    messages = [
        {"role": "system", "content": prompts.SYSTEM_EXPLAIN},
        _chart_message(title, chart_type, table, facts, estimated, axes, context),
    ]
    # Numbers printed on the chart (axis ranges, callouts, inset data) are real data too.
    check_facts = {"facts": facts, "axes": axes or {}, "printed_text": context or {}}
    try:
        for attempt in range(2):
            data = chat_json(messages, max_tokens=MAX_TOKENS)
            summary, explanation = data.get("summary"), data.get("explanation")
            if not isinstance(summary, str) or not isinstance(explanation, str):
                return {"status": "unavailable"}
            text = summary + " " + explanation
            bad = check_numbers(text, table, check_facts, title)
            wrong_way = check_directions(text, table)
            if not bad and not wrong_way:
                return {
                    "status": "ok",
                    "summary": _no_double_negative(summary.strip()),
                    "explanation": _no_double_negative(explanation.strip()),
                }
            problems = []
            if bad:
                problems.append(prompts.RETRY_NUMBERS.format(numbers=", ".join(bad)))
            if wrong_way:
                problems.append(prompts.RETRY_DIRECTIONS.format(phrases="; ".join(f'"{p}"' for p in wrong_way)))
            messages += [
                {"role": "assistant", "content": json.dumps(data)},
                {"role": "user", "content": " ".join(problems)},
            ]
        return {"status": "numbers_unverified"}
    except LLMError:
        return {"status": "unavailable"}


def answer_question(question: str, title: Optional[str], chart_type: str, table: dict, facts: dict, history: list[dict]) -> dict:
    """{"answer": str, "on_topic": bool}. Never raises."""
    question = (question or "").strip()
    if not question or len(question) > 500:
        return {"answer": "Please ask a shorter question about this chart.", "on_topic": True}

    messages = [{"role": "system", "content": prompts.SYSTEM_QA}, _chart_message(title, chart_type, table, facts)]
    messages += [{"role": m["role"], "content": m["content"]} for m in history[-MAX_HISTORY:]]
    messages.append({"role": "user", "content": question})
    try:
        data = chat_json(messages, max_tokens=MAX_TOKENS)
    except LLMError:
        return {
            "answer": "Questions need an internet connection and an AI key. The summary and data table above still work offline.",
            "on_topic": True,
        }
    answer = data.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        return {"answer": "Sorry, I could not answer that. Please try rephrasing.", "on_topic": True}
    return {"answer": _no_double_negative(answer.strip()), "on_topic": bool(data.get("on_topic", True))}


def extract_table_vision(image_bytes: bytes) -> dict:
    """Read the chart with Groq's vision model (online, about 3-6 s).

    Returns {"title", "chart_type", "columns", "rows", "right_axis", "printed_values"}
    in the same table shape as DePlot's parsed output. Raises LLMError.
    """
    content = [
        {"type": "text", "text": prompts.EXTRACT_TABLE},
        {"type": "image_url", "image_url": {"url": to_data_url(image_bytes)}},
    ]
    # Groq's free tier allows 1,000 output tokens per minute for the vision model; ask for less.
    data = chat_json([{"role": "user", "content": content}], model=VISION_MODEL, temperature=0.1, max_tokens=VISION_MAX_TOKENS)
    labels = data.get("labels")
    series = data.get("series")
    if not isinstance(labels, list) or not isinstance(series, list) or not labels or not series:
        raise LLMError("vision model returned no table")

    def number(v):
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return int(v) if float(v).is_integer() else v
        if isinstance(v, str):
            return to_number(v)
        return None

    names, columns_values = [], []
    for i, s in enumerate(series):
        if not isinstance(s, dict) or not isinstance(s.get("values"), list):
            continue
        names.append(str(s.get("name") or f"Series {i + 1}"))
        columns_values.append([number(v) for v in s["values"]])
    if not names:
        raise LLMError("vision model returned no series")

    rows = [[str(label)] + [vals[r] if r < len(vals) else None for vals in columns_values] for r, label in enumerate(labels)]
    chart_type = data.get("chart_type") if data.get("chart_type") in ("bar", "line", "pie") else None
    axes = data.get("axes") if isinstance(data.get("axes"), dict) else None
    if axes:
        axes = {side: a for side, a in axes.items() if side in ("left", "right") and isinstance(a, dict)} or None
    subtitle = data.get("subtitle") if isinstance(data.get("subtitle"), str) else None
    notes = [n for n in data.get("notes", []) if isinstance(n, str) and n.strip()][:4] if isinstance(data.get("notes"), list) else []
    ranges = [str(s.get("name")) for s in series if isinstance(s, dict) and s.get("role") == "range"]
    return {
        "title": data.get("title") or None,
        "chart_type": chart_type,
        "axes": axes,
        # Printed text the plotted data does not contain: the chart's own message and context.
        "context": {"subtitle": subtitle, "notes": notes, "range_series": ranges} if (subtitle or notes or ranges) else None,
        "columns": [str(data.get("label_column") or "Label")] + names,
        "rows": rows,
        "right_axis": [str(s.get("name")) for s in series if isinstance(s, dict) and s.get("axis") == "right"],
        "printed_values": bool(data.get("printed_values")),
    }


def describe_image_generic(image_bytes: bytes) -> dict:
    """{"description": str, "model": str}. Raises LLMError (the API turns it into HTTP 503)."""
    content = [
        {"type": "text", "text": prompts.PROMPT_COMPARE},
        {"type": "image_url", "image_url": {"url": to_data_url(image_bytes)}},
    ]
    text = chat_text([{"role": "user", "content": content}], model=VISION_MODEL)
    if not text:
        raise LLMError("empty description")
    return {"description": text, "model": VISION_MODEL}
