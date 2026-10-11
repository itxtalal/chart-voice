"""Chart image -> raw data table text, using Google's pretrained DePlot model.

DePlot (google/deplot, Apache-2.0) is a Pix2Struct model trained to read a
chart and write its underlying data table. We never train it: the weights
are downloaded once (cached by Hugging Face) and loaded once at server
start; each request only runs inference.
"""

import os

import torch
from PIL import Image
from transformers import Pix2StructForConditionalGeneration, Pix2StructProcessor

MODEL_ID = "google/deplot"
PROMPT = "Generate underlying data table of the figure below:"
MAX_NEW_TOKENS = 512

# Speed settings (override in .env). Fewer patches = smaller input = faster;
# int8 quantization makes CPU matrix maths faster. Measured in eval/speed_test.py.
MAX_PATCHES = int(os.getenv("DEPLOT_MAX_PATCHES", "2048"))
QUANTIZE = os.getenv("DEPLOT_QUANTIZE", "0") == "1"
# Stop writing the table after this many seconds, so a complex chart can never
# block the server for minutes. The table is then partial and the API warns.
MAX_SECONDS = float(os.getenv("DEPLOT_MAX_SECONDS", "90"))


class DePlotModel:
    def __init__(self, max_patches: int = MAX_PATCHES, quantize: bool = QUANTIZE) -> None:
        self.max_patches = max_patches
        self.processor = Pix2StructProcessor.from_pretrained(MODEL_ID)
        self.model = Pix2StructForConditionalGeneration.from_pretrained(MODEL_ID)
        self.model.eval()
        if quantize and not torch.cuda.is_available():
            self.model = torch.ao.quantization.quantize_dynamic(self.model, {torch.nn.Linear}, dtype=torch.qint8)
        if torch.cuda.is_available():  # e.g. Colab T4: about 1-3 s per chart
            self.model = self.model.to("cuda")

    def extract(self, image: Image.Image) -> str:
        """Return DePlot's raw output, e.g. 'TITLE | Sales <0x0A> Month | Sales <0x0A> Jan | 20'."""
        inputs = self.processor(
            images=image.convert("RGB"), text=PROMPT, return_tensors="pt", max_patches=self.max_patches
        ).to(self.model.device)
        with torch.inference_mode():
            output = self.model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS, max_length=None, max_time=MAX_SECONDS)
        return self.processor.decode(output[0], skip_special_tokens=True)
