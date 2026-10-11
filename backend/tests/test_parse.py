from app.extraction.parse import parse_table, to_number


def test_basic_table_with_title():
    p = parse_table("TITLE | Monthly sales <0x0A> Month | Sales <0x0A> Jan | 20 <0x0A> Feb | 25")
    assert p.ok and p.title == "Monthly sales"
    assert p.columns == ["Month", "Sales"]
    assert p.rows == [["Jan", 20.0], ["Feb", 25.0]]


def test_no_title_and_two_series():
    p = parse_table("Year | A | B <0x0A> 2020 | 1.5 | 3 <0x0A> 2021 | 2 | 4")
    assert p.title is None
    assert p.rows == [["2020", 1.5, 3.0], ["2021", 2.0, 4.0]]


def test_numbers_with_symbols():
    assert to_number("1,234.5%") == 1234.5
    assert to_number("$20") == 20.0
    assert to_number("-3.2") == -3.2
    assert to_number("n/a") is None


def test_short_rows_are_padded_and_text_flagged():
    p = parse_table("TITLE | x <0x0A> Label | V | W <0x0A> a | 1 <0x0A> b | n/a | 2")
    assert p.rows == [["a", 1.0, None], ["b", None, 2.0]]
    assert p.non_numeric


def test_missing_header_keeps_first_row():
    # Real DePlot output for eval/charts/pie_01.png
    p = parse_table("TITLE | Phone market share (%) <0x0A> Apple | 30% <0x0A> Xiaomi | 15% <0x0A> Other | 20% <0x0A> Samsung | 35%")
    assert p.columns == ["Label", "Value"]
    assert p.rows[0] == ["Apple", 30.0] and len(p.rows) == 4


def test_empty_title_row_becomes_title_and_repeats_dropped():
    # Real DePlot output for eval/charts/pie_02.png (shortened)
    p = parse_table("TITLE |  <0x0A> Household budget (%) | 40% <0x0A> Rent | 40% <0x0A> Food | 25% <0x0A> Rent | 40%")
    assert p.title == "Household budget (%)"
    assert p.rows == [["Rent", 40.0], ["Food", 25.0]]


def test_garbage_fails_cleanly():
    assert not parse_table("").ok
    assert not parse_table("TITLE | only a title").ok
    assert not parse_table("TITLE | t <0x0A> one column <0x0A> a").ok
