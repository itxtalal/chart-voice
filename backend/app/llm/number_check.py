"""Find numbers in AI-written text that are not supported by the chart data.

This is ChartVoice's guard against hallucinated numbers: every number the
model writes must match (within 0.5%) a value from the table or the facts.
"""

import re

_NUMBER = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
TOLERANCE = 0.005
ALWAYS_ALLOWED = set(range(0, 13))  # counting words: "3 months", "2 lines"


def _collect(obj, out: set) -> None:
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        out.add(float(obj))
    elif isinstance(obj, str):
        for m in _NUMBER.findall(obj):
            try:
                out.add(float(m.replace(",", "")))
            except ValueError:
                pass
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _collect(v, out)


def allowed_numbers(table: dict, facts: dict, title: str | None = None) -> set:
    found: set = set()
    _collect(table.get("rows", []), found)
    _collect(table.get("columns", []), found)
    _collect(facts, found)
    _collect(title or "", found)
    allowed = set()
    for x in found:
        for v in (x, abs(x)):
            allowed.update({v, round(v), round(v, 1), round(v, 2)})
    return allowed


def _supported(x: float, allowed: set) -> bool:
    if x in ALWAYS_ALLOWED or abs(x) in ALWAYS_ALLOWED:
        return True
    return any(abs(x - a) <= TOLERANCE * max(abs(a), 1e-9) for a in allowed)


_UP = r"rose|rises|risen|rising|increased|increases|grew|grows|climbed|climbs|jumped|jumps|surged|surges|went up|goes up"
_DOWN = r"fell|falls|fallen|dropped|drops|decreased|decreases|declined|declines|dipped|dips|went down|goes down|sank"
_MOVE = re.compile(
    rf"\b(?P<word>{_UP}|{_DOWN})\s+(?:back\s+)?to\s+(?:a\s+(?:new\s+)?(?:high|low|peak)\s+of\s+)?"
    r"(?:(?:about|around|approximately|roughly|nearly|almost|just\s+(?:over|under|above|below))\s+)?\$?"
    r"(?P<num>-?\d[\d,]*(?:\.\d+)?)\s+(?:in|at|for|on|by)\s+(?P<label>[^\s,.;]+(?:\s\d{4})?)",
    re.I,
)


def check_directions(text: str, table: dict) -> list[str]:
    """Find phrases like 'rose to 2000 in Mar' that contradict the data (Feb 3000 -> Mar 2000 is a fall).

    Checks each 'went up/down to VALUE in LABEL' against the previous label in the
    series holding that value. Returns the wrong phrases.
    """
    rows = table.get("rows", [])
    index = {str(r[0]).strip().lower(): i for i, r in enumerate(rows)}
    wrong = []
    for m in _MOVE.finditer(text):
        i = index.get(m.group("label").strip().lower())
        if not i:  # unknown label, or the first label (no previous value to compare)
            continue
        value = float(m.group("num").replace(",", ""))
        up = re.fullmatch(_UP, m.group("word"), re.I) is not None
        for c in range(1, len(rows[i])):
            cur, prev = rows[i][c], rows[i - 1][c] if c < len(rows[i - 1]) else None
            if not isinstance(cur, (int, float)) or not isinstance(prev, (int, float)):
                continue
            if abs(cur - value) <= TOLERANCE * max(abs(cur), 1e-9):
                if (up and cur < prev) or (not up and cur > prev):
                    wrong.append(m.group(0))
                break
    return wrong


def check_numbers(text: str, table: dict, facts: dict, title: str | None = None) -> list[str]:
    allowed = allowed_numbers(table, facts, title)
    bad = []
    for raw in _NUMBER.findall(text):
        cleaned = raw.replace(",", "").rstrip(".")
        try:
            value = float(cleaned)
        except ValueError:
            continue
        if not _supported(value, allowed):
            bad.append(raw)
    return bad
