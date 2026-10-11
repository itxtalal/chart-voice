"""Sanity checks: warn the user when the extracted data looks wrong."""

from app.extraction.parse import ParsedTable

MESSAGES = {
    "parse_failed": "We could not read a data table from this image. Try a clearer or larger chart.",
    "missing_values": "Some values could not be read and are shown as blank.",
    "non_numeric": "Some cells did not contain numbers and were left blank.",
    "single_point": "Only one data point was found, so trends cannot be described.",
    "shares_not_100": "The pie chart's percentages do not add up to about 100%, so some values may be misread.",
}


MESSAGES.update({
    "complex_chart": "This chart has many series or data points. The extracted values may be incomplete or wrong; check the table against the original.",
    "low_confidence": "The chart's column names could not be read, so the table may be arranged incorrectly; check it against the original.",
    "extraction_truncated": "This chart took too long to read completely, so the table may be missing values.",
    "values_estimated": "Exact numbers are not printed on this chart, so values were read from the axes and are approximate.",
})

COMPLEX_SERIES = 4
COMPLEX_ROWS = 20


def warning(code: str, message: str | None = None) -> dict:
    return {"code": code, "message": message or MESSAGES[code]}


def reading_warnings(parsed: ParsedTable, right_axis: list[str], printed_values: bool | None, truncated: bool) -> list[dict]:
    """Warnings about how trustworthy the reading is, rather than the data itself."""
    warnings = []
    series_count = max(len(parsed.columns) - 1, 0)
    if series_count > COMPLEX_SERIES or len(parsed.rows) > COMPLEX_ROWS:
        warnings.append(warning("complex_chart"))
    # Missing header with several value columns: DePlot likely read the chart sideways
    # (it did this on a 7-line chart). With one value column (e.g. a pie) it is harmless.
    if series_count > 1 and any("no header" in n for n in parsed.notes):
        warnings.append(warning("low_confidence"))
    if truncated:
        warnings.append(warning("extraction_truncated"))
    if right_axis:
        names = ", ".join(right_axis)
        warnings.append(warning("dual_axis", f"This chart has two scales: {names} is measured on the right-hand axis, the rest on the left."))
    if printed_values is False:
        warnings.append(warning("values_estimated"))
    return warnings


def crosscheck_warning(result: dict) -> dict | None:
    if result["compared"] == 0:
        return warning("readings_disagree", "A second, independent reading of this chart could not be matched to the first, so the values could not be confirmed. Check the table against the original.")
    bad = result["disagreements"]
    if not bad:
        return None
    examples = "; ".join(f"{d['series']} at {d['label']}: {d['a']} vs {d['b']}" for d in bad[:3])
    return warning(
        "readings_disagree",
        f"Two independent readings disagree on {len(bad)} of {result['compared']} values ({examples}). Check these against the original chart.",
    )


def run_checks(parsed: ParsedTable, chart_type: str) -> list[dict]:
    if not parsed.ok:
        return [warning("parse_failed")]

    warnings = []
    numeric = [row[1:] for row in parsed.rows]
    if any(v is None for row in numeric for v in row):
        warnings.append(warning("missing_values"))
    if parsed.non_numeric:
        warnings.append(warning("non_numeric"))
    if len(parsed.rows) < 2:
        warnings.append(warning("single_point"))

    if chart_type == "pie":
        values = [row[0] for row in numeric if row and isinstance(row[0], (int, float))]
        looks_like_percentages = values and all(0 <= v <= 100 for v in values)
        if looks_like_percentages and not 95 <= sum(values) <= 105:
            warnings.append(warning("shares_not_100"))
    return warnings
