from app.analysis.checks import run_checks
from app.analysis.facts import compute_facts
from app.analysis.template_summary import labels_are_ordered, template_summary
from app.extraction.parse import parse_table

COLUMNS = ["Month", "Sales"]
ROWS = [["Jan", 20], ["Feb", 25], ["Mar", 40], ["Apr", 38], ["May", 55]]


def test_facts_match_contract_example():
    s = compute_facts(COLUMNS, ROWS, "bar")["series"][0]
    assert s["max"] == {"label": "May", "value": 55}
    assert s["min"] == {"label": "Jan", "value": 20}
    assert s["biggest_rise"] == {"from": "Apr", "to": "May", "change": 17}
    assert s["biggest_drop"] == {"from": "Mar", "to": "Apr", "change": -2}
    assert s["total"] == 178 and s["change_pct"] == 175.0
    assert s["trend"] == "increasing" and s["shares"] is None


def test_flat_and_decreasing_trends():
    flat = compute_facts(["x", "v"], [["a", 100], ["b", 102], ["c", 101]], "line")["series"][0]
    down = compute_facts(["x", "v"], [["a", 9], ["b", 7], ["c", 3]], "line")["series"][0]
    assert flat["trend"] == "flat" and down["trend"] == "decreasing"
    assert down["biggest_rise"] is None


def test_missing_values_are_skipped():
    s = compute_facts(["x", "v"], [["a", 1], ["b", None], ["c", 5]], "line")["series"][0]
    assert s["total"] == 6 and s["last"] == {"label": "c", "value": 5}


def test_pie_shares():
    s = compute_facts(["Brand", "Share"], [["A", 50], ["B", 30], ["C", 20]], "pie")["series"][0]
    assert s["shares"] == [{"label": "A", "percent": 50.0}, {"label": "B", "percent": 30.0}, {"label": "C", "percent": 20.0}]


def test_checks():
    assert [w["code"] for w in run_checks(parse_table("garbage"), "bar")] == ["parse_failed"]
    pie = parse_table("Brand | Share <0x0A> A | 40 <0x0A> B | 30")
    assert "shares_not_100" in [w["code"] for w in run_checks(pie, "pie")]


def test_template_summary_uses_only_real_numbers():
    facts = compute_facts(COLUMNS, ROWS, "bar")
    text = template_summary("Monthly sales", "bar", facts, [r[0] for r in ROWS])["summary"]
    assert "May (55)" in text and "Jan (20)" in text and "+17" in text


def test_ordered_labels():
    assert labels_are_ordered(["2019", "2020"]) and labels_are_ordered(["Jan", "Feb"])
    assert not labels_are_ordered(["Lahore", "Karachi"])
