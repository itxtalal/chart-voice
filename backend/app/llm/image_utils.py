"""Shrink and encode an image so it fits the vision model's request limits."""

import base64
import io

from PIL import Image

MAX_SIDE = 1600
MIN_SIDE = 1200  # small charts are enlarged so thin lines and gridlines stay visible to the model
MAX_BYTES = 3 * 1024 * 1024  # base64 adds a third; Groq's limit is 4 MB


def to_data_url(image_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    longest = max(img.size)
    if longest < MIN_SIDE:
        scale = MIN_SIDE / longest
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    for quality in (85, 70, 55):
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality)
        data = buffer.getvalue()
        if len(data) <= MAX_BYTES:
            break
    return "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")
