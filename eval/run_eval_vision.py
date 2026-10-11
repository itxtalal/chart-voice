"""Same accuracy test as run_eval.py, but for the Groq vision extractor (online).

    cd backend && venv\\Scripts\\activate && python ../eval/run_eval_vision.py
"""

import statistics
import sys
import time
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))
sys.path.insert(0, str(ROOT))

from app.llm.service import LLMError, extract_table_vision  # noqa: E402
from run_eval import load_truth, score  # noqa: E402


def main() -> None:
    charts = sorted(p for p in (ROOT / "charts").glob("*.png") if (ROOT / "ground_truth" / f"{p.stem}.csv").exists())
    all_correct = all_total = max_hits = 0
    seconds = []
    for path in charts:
        _, truth = load_truth(ROOT / "ground_truth" / f"{path.stem}.csv")
        t0 = time.perf_counter()
        try:
            table = extract_table_vision(path.read_bytes())
        except LLMError as exc:
            print(f"{path.stem:10s} ERROR {exc}")
            continue
        seconds.append(time.perf_counter() - t0)
        correct, total, max_ok = score(SimpleNamespace(rows=table["rows"]), truth)
        all_correct, all_total, max_hits = all_correct + correct, all_total + total, max_hits + max_ok
        print(f"{path.stem:10s} {correct:2d}/{total:<2d} values  max {'ok ' if max_ok else 'MISS'}  {seconds[-1]:4.1f} s  type={table['chart_type']}", flush=True)
    print(f"\nVision: {all_correct}/{all_total} values within 5% ({all_correct / all_total * 100:.0f}%), "
          f"highest {max_hits}/{len(charts)}, median {statistics.median(seconds):.1f} s")


if __name__ == "__main__":
    main()
