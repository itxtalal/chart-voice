"""Offline summary: fixed sentences filled with computed facts.

Used when the language model is unavailable (no key, no internet) or when its
text fails the number check. It can never invent a number.
"""

import re
from typing import Optional

_MONTHS = {"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"}


def fmt(x: float) -> str:
    return f"{x:,.0f}" if float(x).is_integer() else f"{x:,.2f}".rstrip("0").rstrip(".")


def labels_are_ordered(labels: list[str]) -> bool:
    """True when labels look like time (years or months), so a trend makes sense."""
    if not labels:
        return False
    years = all(re.fullmatch(r"(19|20)\d{2}", l.strip()) for l in labels)
    months = all(l.strip()[:3].lower() in _MONTHS for l in labels)
    return years or months


def template_summary(title: Optional[str], chart_type: str, facts: dict, labels: list[str]) -> dict:
    series = facts.get("series", [])
    if not series:
        return {
            "summary": "No numbers could be read from this chart.",
            "explanation": "Try uploading a clearer or larger image of the chart.",
        }

    kind = {"bar": "bar chart", "line": "line chart", "pie": "pie chart"}.get(chart_type, "chart")
    intro = f"This {kind} shows {title}." if title else f"This {kind} has {len(labels)} data points."
    sentences = [intro]
    describe_trend = chart_type == "line" or labels_are_ordered(labels)

    for s in series[:3]:
        name = s["name"]
        if s.get("shares"):
            top = max(s["shares"], key=lambda x: x["percent"])
            sentences.append(f"The largest part is {top['label']} at {fmt(top['percent'])}% of the total.")
            continue
        sentences.append(
            f"For {name}, the highest value is {s['max']['label']} ({fmt(s['max']['value'])}) "
            f"and the lowest is {s['min']['label']} ({fmt(s['min']['value'])})."
        )
        if describe_trend and s["trend"] != "flat":
            word = {"increasing": "rose", "decreasing": "fell", "mixed": "went up and down"}[s["trend"]]
            sentences.append(
                f"{name} {word} from {fmt(s['first']['value'])} in {s['first']['label']} "
                f"to {fmt(s['last']['value'])} in {s['last']['label']}."
            )
        if describe_trend and s.get("biggest_rise"):
            r = s["biggest_rise"]
            sentences.append(f"The biggest increase was from {r['from']} to {r['to']} (+{fmt(r['change'])}).")

    summary = " ".join(sentences[:5])
    explanation = (
        "This is a basic summary built directly from the numbers read from the chart. "
        "Check the data table for every value."
    )
    return {"summary": summary, "explanation": explanation}
