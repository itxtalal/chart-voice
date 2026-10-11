import os

import pytest

from app.llm import service
from app.llm.number_check import check_directions, check_numbers

TABLE = {"columns": ["Month", "Sales"], "rows": [["Jan", 20], ["Feb", 25], ["May", 55]]}
FACTS = {"series": [{"name": "Sales", "max": {"label": "May", "value": 55}, "change_pct": 175.0, "total": 100}]}


def test_numbers_from_data_pass():
    assert check_numbers("Sales peaked at 55 in May, up 175% and 100 in total.", TABLE, FACTS) == []


def test_invented_numbers_are_caught():
    assert check_numbers("Sales peaked at 60.", TABLE, FACTS) == ["60"]


def test_hallucinated_percentage_is_caught():
    # Case from Muhammad Hasnain's original number-check tests.
    table = {"columns": ["Quarter", "Value"], "rows": [["Q1", 50], ["Q2", 80], ["Q3", 100], ["Q4", 150]]}
    assert check_numbers("The highest value was 150 in Q4.", table, {"series": []}) == []
    assert check_numbers("The projected growth is 500%.", table, {"series": []}) == ["500"]


def test_wrong_direction_words_are_caught():
    # Real AI mistake on the dual-axis sales chart: Feb 3000 -> Mar 2000 described as "rose".
    sales = {"columns": ["Month", "Units", "Total"], "rows": [["Jan", 50, 1500], ["Feb", 100, 3000], ["Mar", 30, 2000], ["Apr", 105, 7000]]}
    assert check_directions("Total doubled to 3000 in Feb, rose to 2000 in Mar, jumped to 7000 in Apr.", sales) == ["rose to 2000 in Mar"]
    assert check_directions("It dropped to 30 in Mar and climbed to 105 in Apr.", sales) == []
    assert check_directions("Units fell to a low of 30 in Mar.", sales) == []
    assert check_directions("It rose to 50 in Jan.", sales) == []  # first label: nothing to compare


def test_wrong_direction_caught_with_about():
    # Real mistake after estimated values started saying "about": 105 in Apr -> 85 in May called "rose".
    sales = {"columns": ["Month", "Units"], "rows": [["Apr", 105], ["May", 85], ["Jun", 150]]}
    assert check_directions("climbed to about 105 in Apr, rose to about 85 in May, and peaked at about 150 in Jun", sales) == [
        "rose to about 85 in May"
    ]
    assert check_directions("fell to about 85 in May, then rose to a peak of about 150 in Jun", sales) == []
    assert check_directions("dropped to roughly $85 in May", sales) == []


def test_numbers_in_title_allowed():
    assert check_numbers("Sales in 2025 peaked at 55.", TABLE, FACTS, title="Monthly sales 2025") == []
    assert check_numbers("Sales in 2025 peaked at 55.", TABLE, FACTS) == ["2025"]


def test_small_counting_numbers_allowed():
    assert check_numbers("Over 3 months sales grew.", TABLE, FACTS) == []


def test_offline_mode(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert service.explain("t", "bar", TABLE, FACTS) == {"status": "unavailable"}
    answer = service.answer_question("What is the highest?", "t", "bar", TABLE, FACTS, [])
    assert answer["on_topic"] is True and "internet" in answer["answer"]
    with pytest.raises(service.LLMError):
        service.describe_image_generic(_png_bytes())


def _png_bytes() -> bytes:
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.skipif(not os.getenv("GROQ_API_KEY"), reason="needs GROQ_API_KEY")
def test_online_explain_and_off_topic():
    result = service.explain("Monthly sales", "bar", TABLE, FACTS)
    assert result["status"] in ("ok", "numbers_unverified")
    off = service.answer_question("What is the weather today?", "Monthly sales", "bar", TABLE, FACTS, [])
    assert off["on_topic"] is False
