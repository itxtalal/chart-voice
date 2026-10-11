"""Table -> facts (max, min, trend, biggest changes, shares), computed in code.

The language model never calculates these: we compute them exactly here and
hand them to the model, so the key numbers cannot be hallucinated.
"""

from typing import Optional

FLAT_THRESHOLD = 0.05  # change within 5% of the largest value counts as flat


def _round(x: float):
    """Round to 2 decimals; whole numbers become int (20, not 20.0)."""
    x = round(x, 2)
    return int(x) if float(x).is_integer() else x


def _series(columns: list[str], rows: list[list]) -> list[tuple[str, list[tuple[str, float]]]]:
    """One (name, [(label, value), ...]) per numeric column, skipping missing values."""
    out = []
    for c in range(1, len(columns)):
        points = [(str(r[0]), float(r[c])) for r in rows if c < len(r) and isinstance(r[c], (int, float))]
        if points:
            out.append((columns[c], points))
    return out


def _trend(points: list[tuple[str, float]]) -> str:
    values = [v for _, v in points]
    if len(values) < 2:
        return "flat"
    change = values[-1] - values[0]
    scale = max(abs(v) for v in values) or 1.0
    if abs(change) <= FLAT_THRESHOLD * scale:
        return "flat"
    steps = [b - a for a, b in zip(values, values[1:])]
    ups = sum(1 for s in steps if s > 0)
    downs = sum(1 for s in steps if s < 0)
    if change > 0 and ups >= downs:
        return "increasing"
    if change < 0 and downs >= ups:
        return "decreasing"
    return "mixed"


def _shares(points: list[tuple[str, float]]) -> list[dict]:
    total = sum(v for _, v in points)
    return [{"label": label, "percent": round(v / total * 100, 1)} for label, v in points]


def wants_shares(chart_type: str, series_count: int, points: list[tuple[str, float]]) -> bool:
    if chart_type == "pie":
        return True
    if chart_type in ("bar", "line") or series_count != 1:
        return False
    values = [v for _, v in points]
    return all(v >= 0 for v in values) and 95 <= sum(values) <= 105


def compute_facts(columns: list[str], rows: list[list], chart_type: str) -> dict:
    all_series = _series(columns, rows)
    result = []
    for name, points in all_series:
        values = [v for _, v in points]
        hi = max(points, key=lambda p: p[1])
        lo = min(points, key=lambda p: p[1])
        first, last = points[0], points[-1]
        steps = [(a[0], b[0], b[1] - a[1]) for a, b in zip(points, points[1:])]
        rises = [s for s in steps if s[2] > 0]
        drops = [s for s in steps if s[2] < 0]
        rise: Optional[tuple] = max(rises, key=lambda s: s[2]) if rises else None
        drop: Optional[tuple] = min(drops, key=lambda s: s[2]) if drops else None
        change = last[1] - first[1]

        result.append({
            "name": name,
            "max": {"label": hi[0], "value": _round(hi[1])},
            "min": {"label": lo[0], "value": _round(lo[1])},
            "first": {"label": first[0], "value": _round(first[1])},
            "last": {"label": last[0], "value": _round(last[1])},
            "change_abs": _round(change),
            "change_pct": _round(change / first[1] * 100) if first[1] else None,
            "trend": _trend(points),
            "biggest_rise": {"from": rise[0], "to": rise[1], "change": _round(rise[2])} if rise else None,
            "biggest_drop": {"from": drop[0], "to": drop[1], "change": _round(drop[2])} if drop else None,
            "total": _round(sum(values)),
            "shares": _shares(points) if wants_shares(chart_type, len(all_series), points) else None,
        })
    return {"series": result}
