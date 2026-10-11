"""Compare two independent readings of the same chart (vision model vs DePlot).

If two different models agree on a value, it is much more likely to be right;
where they disagree, we tell the user exactly which values to double-check.
"""

TOLERANCE = 0.10  # values within 10% of each other count as agreeing


def _norm(text) -> str:
    return " ".join(str(text).lower().replace("%", "").split())


def _agree(a: float, b: float) -> bool:
    return abs(a - b) <= TOLERANCE * max(abs(a), abs(b), 1e-9)


def compare_tables(primary: dict, other: dict) -> dict:
    """Returns {"compared": n, "disagreements": [{"label", "series", "a", "b"}, ...]}."""
    other_rows = {_norm(r[0]): r for r in other.get("rows", [])}
    other_names = [_norm(c) for c in other.get("columns", [])[1:]]
    names = primary.get("columns", [])[1:]

    compared, disagreements = 0, []
    for row in primary.get("rows", []):
        match = other_rows.get(_norm(row[0]))
        if not match:
            continue
        for i, name in enumerate(names, start=1):
            # Match series by name when possible, otherwise by position.
            j = other_names.index(_norm(name)) + 1 if _norm(name) in other_names else i
            a = row[i] if i < len(row) else None
            b = match[j] if j < len(match) else None
            if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
                continue
            compared += 1
            if not _agree(a, b):
                disagreements.append({"label": str(row[0]), "series": name, "a": a, "b": b})
    return {"compared": compared, "disagreements": disagreements}
