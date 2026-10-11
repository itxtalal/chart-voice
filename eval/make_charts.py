"""Draw test charts from known data, saving each image with its true values.

    python eval/make_charts.py

Writes eval/charts/<name>.png and eval/ground_truth/<name>.csv. Because we
choose the data, we know the exact answer for every chart, which is what the
evaluation compares DePlot's output against.
"""

import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parent
CHARTS = ROOT / "charts"
TRUTH = ROOT / "ground_truth"

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
YEARS = ["2018", "2019", "2020", "2021", "2022", "2023"]

# name, kind, title, label column, labels, {series name: values}, show value labels
SPECS = [
    ("bar_01", "bar", "Monthly sales 2025", "Month", MONTHS[:5], {"Sales": [20, 25, 40, 38, 55]}, True),
    ("bar_02", "bar", "Students per class", "Class", ["A", "B", "C", "D"], {"Students": [32, 28, 35, 30]}, False),
    ("bar_03", "bar", "Rainfall by city (mm)", "City", ["Lahore", "Karachi", "Islamabad", "Quetta", "Peshawar"], {"Rainfall": [629, 220, 1142, 260, 403]}, True),
    ("bar_04", "bar", "App downloads (thousands)", "Year", YEARS, {"Downloads": [12, 18, 31, 45, 52, 61]}, False),
    ("bar_05", "bar", "Revenue vs cost", "Quarter", ["Q1", "Q2", "Q3", "Q4"], {"Revenue": [50, 62, 58, 75], "Cost": [40, 45, 47, 52]}, False),
    ("line_01", "line", "Average temperature (C)", "Month", MONTHS, {"Temperature": [12, 15, 21, 27, 33, 35]}, False),
    ("line_02", "line", "Website visitors", "Year", YEARS, {"Visitors": [1200, 1500, 900, 1800, 2400, 2600]}, True),
    ("line_03", "line", "Unemployment rate (%)", "Year", YEARS, {"Rate": [5.2, 4.8, 7.9, 6.1, 5.0, 4.6]}, False),
    ("line_04", "line", "Product prices", "Month", MONTHS, {"Product A": [10, 12, 11, 14, 15, 17], "Product B": [8, 9, 12, 12, 13, 12]}, False),
    ("pie_01", "pie", "Phone market share (%)", "Brand", ["Samsung", "Apple", "Xiaomi", "Other"], {"Share": [35, 30, 15, 20]}, True),
    ("pie_02", "pie", "Household budget (%)", "Category", ["Rent", "Food", "Transport", "Savings", "Other"], {"Share": [40, 25, 10, 15, 10]}, True),
]


def draw(name, kind, title, label_col, labels, series, value_labels):
    fig, ax = plt.subplots(figsize=(6.4, 4.2), dpi=100)
    names = list(series)
    if kind == "bar":
        width = 0.8 / len(names)
        for i, s in enumerate(names):
            xs = [x + i * width - 0.4 + width / 2 for x in range(len(labels))]
            bars = ax.bar(xs, series[s], width=width, label=s)
            if value_labels:
                ax.bar_label(bars)
        ax.set_xticks(range(len(labels)), labels)
        ax.set_xlabel(label_col)
    elif kind == "line":
        for s in names:
            ax.plot(labels, series[s], marker="o", label=s)
            if value_labels:
                for x, y in zip(labels, series[s]):
                    ax.annotate(str(y), (x, y), textcoords="offset points", xytext=(0, 6), ha="center")
        ax.set_xlabel(label_col)
    else:
        ax.pie(series[names[0]], labels=labels, autopct="%1.0f%%" if value_labels else None)
        ax.axis("equal")
    if kind != "pie" and len(names) > 1:
        ax.legend()
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(CHARTS / f"{name}.png")
    plt.close(fig)

    with open(TRUTH / f"{name}.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([label_col, *names])
        for i, label in enumerate(labels):
            writer.writerow([label, *(series[s][i] for s in names)])


def main():
    CHARTS.mkdir(exist_ok=True)
    TRUTH.mkdir(exist_ok=True)
    for spec in SPECS:
        draw(*spec)
    print(f"Wrote {len(SPECS)} charts to {CHARTS} and ground truth to {TRUTH}")


if __name__ == "__main__":
    main()
