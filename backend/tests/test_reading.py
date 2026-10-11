"""Tests for the problems found while testing real charts (child-mortality and dual-axis charts)."""

import io
import json

from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.analysis.checks import crosscheck_warning, reading_warnings
from app.analysis.crosscheck import compare_tables
from app.extraction.parse import ParsedTable, parse_table
from app.llm import service


def png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (60, 40), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def test_crosscheck_finds_the_mixed_up_value():
    vision = {"columns": ["Year", "Global"], "rows": [["1950", 23], ["2025", 1.8]]}
    deplot = {"columns": ["Year", "Global"], "rows": [["1950", 23], ["2025", 3.5]]}
    result = compare_tables(vision, deplot)
    assert result["compared"] == 2
    assert result["disagreements"] == [{"label": "2025", "series": "Global", "a": 1.8, "b": 3.5}]
    assert "Global at 2025: 1.8 vs 3.5" in crosscheck_warning(result)["message"]


def test_crosscheck_agreement_and_no_overlap():
    a = {"columns": ["M", "S"], "rows": [["Jan", 20], ["Feb", 25]]}
    assert crosscheck_warning(compare_tables(a, {"columns": ["M", "S"], "rows": [["Jan", 21], ["Feb", 25]]})) is None
    sideways = {"columns": ["Label", "Value 1"], "rows": [["Africa", 33]]}
    assert crosscheck_warning(compare_tables(a, sideways))["code"] == "readings_disagree"


def test_sideways_reading_is_flagged():
    # Real DePlot output shape for the 7-line child-mortality chart: no header, regions as rows.
    p = parse_table("TITLE | Child mortality <0x0A> Africa | 33 | 27 | 22 <0x0A> Asia | 25 | 20 | 15")
    codes = [w["code"] for w in reading_warnings(p, [], None, False)]
    assert "low_confidence" in codes


def test_reading_warnings_for_dual_axis_estimates_and_complexity():
    p = ParsedTable("t", ["Month"] + [f"S{i}" for i in range(7)], [["Jan"] + [1] * 7], ok=True)
    codes = [w["code"] for w in reading_warnings(p, ["Total Transaction"], False, True)]
    assert codes == ["complex_chart", "extraction_truncated", "dual_axis", "values_estimated"]


def test_no_double_negative():
    assert service._no_double_negative("the biggest drop was a decline of -14.5") == "the biggest drop was a decline of 14.5"
    assert service._no_double_negative("it fell by -2 units") == "it fell by 2 units"
    assert service._no_double_negative("temperature of -3 degrees") == "temperature of -3 degrees"


def test_categories_do_not_get_rises_sent_to_the_llm():
    facts = {"series": [{"name": "Rain", "max": {"label": "Islamabad", "value": 1142}, "biggest_rise": {"from": "a", "to": "b", "change": 1}, "trend": "mixed"}]}
    cities = json.loads(service._chart_message("Rain", "bar", {"columns": ["City", "Rain"], "rows": [["Lahore", 629], ["Karachi", 220]]}, facts)["content"])
    assert cities["labels_in_time_order"] is False
    assert "biggest_rise" not in cities["facts"]["series"][0] and "trend" not in cities["facts"]["series"][0]
    months = json.loads(service._chart_message("Sales", "bar", {"columns": ["M", "S"], "rows": [["Jan", 1], ["Feb", 2]]}, facts)["content"])
    assert months["labels_in_time_order"] is True and "biggest_rise" in months["facts"]["series"][0]


def test_analyze_uses_vision_reader_and_caches(monkeypatch):
    calls = {"vision": 0}

    def fake_vision(_):
        calls["vision"] += 1
        return {"title": "My sales", "chart_type": "bar", "columns": ["Month", "Units Sold", "Total Transaction"],
                "rows": [["Jan", 50, 1500], ["Feb", 100, 3000]], "right_axis": ["Total Transaction"], "printed_values": False}

    monkeypatch.setattr(main, "EXTRACTOR", "auto")
    monkeypatch.setattr(main, "CROSS_CHECK", False)
    monkeypatch.setattr(main.llm, "extract_table_vision", fake_vision)
    monkeypatch.setattr(main.llm, "explain", lambda *a: {"status": "unavailable"})
    main.cache.clear()

    client = TestClient(main.app)  # no "with": startup (DePlot loading) is skipped
    files = {"image": ("c.png", png(), "image/png")}
    first = client.post("/api/analyze", files=files).json()
    assert first["extractor"] == "vision" and first["chart_type"] == "bar"
    codes = [w["code"] for w in first["warnings"]]
    assert "dual_axis" in codes and "values_estimated" in codes and "llm_unavailable" in codes

    second = client.post("/api/analyze", files=files).json()
    assert calls["vision"] == 1 and second["timing_ms"]["extract"] == 0 and second["table"] == first["table"]
