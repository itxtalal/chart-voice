"""Compare DePlot speed/accuracy settings on a few charts.

    cd backend && venv\\Scripts\\activate && python ../eval/speed_test.py
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))
sys.path.insert(0, str(ROOT))

from PIL import Image  # noqa: E402

from app.extraction.deplot import DePlotModel  # noqa: E402
from app.extraction.parse import parse_table  # noqa: E402
from run_eval import load_truth, score  # noqa: E402

CHARTS = ["bar_01", "line_04", "pie_01"]
SETTINGS = [(2048, False), (1024, False), (1024, True), (768, True)]

for patches, quantize in SETTINGS:
    model = DePlotModel(max_patches=patches, quantize=quantize)
    correct = total = 0
    times = []
    for name in CHARTS:
        _, truth = load_truth(ROOT / "ground_truth" / f"{name}.csv")
        t0 = time.perf_counter()
        parsed = parse_table(model.extract(Image.open(ROOT / "charts" / f"{name}.png")))
        times.append(time.perf_counter() - t0)
        c, t, _ = score(parsed, truth)
        correct, total = correct + c, total + t
    print(f"patches={patches:<5} int8={str(quantize):<5}  values {correct}/{total}  avg {sum(times) / len(times):5.1f} s  ({', '.join(f'{x:.0f}' for x in times)})", flush=True)
