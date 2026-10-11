"""DePlot raw text -> clean title, columns and rows.

DePlot writes a table as one line of text: rows are separated by the token
"<0x0A>" (a newline) and cells by "|". The first row may be "TITLE | ...".
"""

import re
from dataclasses import dataclass, field
from typing import Optional, Union

Cell = Union[str, float, None]

_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")


@dataclass
class ParsedTable:
    title: Optional[str]
    columns: list[str]
    rows: list[list[Cell]]
    ok: bool
    non_numeric: bool = False
    notes: list[str] = field(default_factory=list)


def tidy(x: float) -> Union[int, float]:
    """20.0 -> 20 so text and speech say "20", not "20.0"."""
    return int(x) if float(x).is_integer() else x


def to_number(cell: str) -> Optional[Union[int, float]]:
    """'1,234.5%' -> 1234.5 ; '$20' -> 20 ; 'n/a' -> None."""
    cleaned = cell.replace(",", "").replace("$", "").replace("%", "").replace(" ", "")
    match = _NUMBER.search(cleaned)
    return tidy(float(match.group())) if match else None


def parse_table(raw: str) -> ParsedTable:
    lines = [line.strip() for line in raw.replace("<0x0A>", "\n").split("\n")]
    lines = [line for line in lines if line]

    title = None
    if lines and lines[0].upper().startswith("TITLE"):
        title = lines[0].split("|", 1)[1].strip() if "|" in lines[0] else ""
        title = title or None
        lines = lines[1:]

    if len(lines) < 2:
        return ParsedTable(title, [], [], ok=False, notes=["fewer than 2 lines after the title"])

    columns = [c.strip() for c in lines[0].split("|")]
    if len(columns) < 2:
        return ParsedTable(title, columns, [], ok=False, notes=["fewer than 2 columns"])

    notes: list[str] = []
    data_lines = lines[1:]
    # DePlot sometimes skips the header (common on pie charts): the "header"
    # is then really a data row such as "Apple | 30%".
    header_values = [c for c in columns[1:] if c]
    if header_values and all(to_number(c) is not None for c in header_values):
        if title is None:
            # e.g. "TITLE |  <0x0A> Household budget (%) | 40%": the first row is the title.
            title = columns[0] or None
            notes.append("first row used as title")
        else:
            data_lines = lines
            notes.append("no header row; first row kept as data")
        columns = ["Label"] + ["Value" if len(columns) == 2 else f"Value {i}" for i in range(1, len(columns))]

    rows: list[list[Cell]] = []
    seen: set[str] = set()
    non_numeric = False
    for line in data_lines:
        cells = [c.strip() for c in line.split("|")]
        if not cells[0] or cells[0] in seen:  # DePlot can repeat rows at the end
            continue
        seen.add(cells[0])
        cells = (cells + [""] * len(columns))[: len(columns)]
        row: list[Cell] = [cells[0]]
        for cell in cells[1:]:
            value = to_number(cell)
            if value is None and cell:
                non_numeric = True
            row.append(value)
        rows.append(row)

    return ParsedTable(title, columns, rows, ok=bool(rows), non_numeric=non_numeric, notes=notes)
