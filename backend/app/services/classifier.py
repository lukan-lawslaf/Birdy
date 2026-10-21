"""The bird classifier, wrapped for request use.

A quantized Swin transformer, exported to ONNX, 98.0% top-1 on the dataset's own
validation split. int8 so it runs on CPU in ~33 ms without a GPU.

The session is built once at startup (see main.py) rather than per request —
loading a 30 MB graph takes far longer than the inference itself.

Preprocessing follows the standard ImageNet recipe: resize the shorter side to
256, centre-crop 224, scale to [0,1], normalise per channel. The model's input
is [N, 3, 224, 224] float32 and it emits 526 raw logits, one per class.
"""

import io
import json
import time

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

from app.config import settings

RESIZE_TO = 256
CROP = 224
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_session: ort.InferenceSession | None = None
_labels: dict[int, str] = {}
_model_path: str = ""


def load() -> None:
    """Build the session and read the labels. Idempotent."""
    global _session, _labels, _model_path
    if _session is not None:
        return
    path = settings.resolve_path(settings.classifier_model)
    label_path = settings.resolve_path(settings.classifier_labels)
    options = ort.SessionOptions()
    if settings.classifier_threads > 0:
        options.intra_op_num_threads = settings.classifier_threads
        options.inter_op_num_threads = 1
    if settings.classifier_low_memory:
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
    _session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
    raw = json.loads(label_path.read_text(encoding="utf-8"))
    # The file is {"0": "ABBOTTS BABBLER", ...}; be tolerant of a plain list.
    if isinstance(raw, dict):
        _labels = {int(k): v for k, v in raw.items()}
    else:
        _labels = {i: v for i, v in enumerate(raw)}
    _model_path = str(path)


def is_loaded() -> bool:
    return _session is not None


def model_name() -> str:
    return _model_path


def label_for(index: int) -> str | None:
    return _labels.get(index)


def all_labels() -> list[tuple[int, str]]:
    return sorted(_labels.items())


def preprocess(data: bytes) -> tuple[np.ndarray, tuple[int, int]]:
    """Bytes of any common image format -> a [1, 3, 224, 224] float32 batch."""
    image = Image.open(io.BytesIO(data))
    image = ImageOps.exif_transpose(image).convert("RGB")
    original = image.size

    width, height = image.size
    scale = RESIZE_TO / min(width, height)
    if scale < 1 or (width, height) != (CROP, CROP):
        image = image.resize(
            (max(CROP, round(width * scale)), max(CROP, round(height * scale))),
            Image.BILINEAR,
        )
    left = (image.width - CROP) // 2
    top = (image.height - CROP) // 2
    image = image.crop((left, top, left + CROP, top + CROP))

    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - MEAN) / STD
    array = np.transpose(array, (2, 0, 1))[None, ...]
    return np.ascontiguousarray(array, dtype=np.float32), original


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max()
    exponents = np.exp(shifted)
    return exponents / exponents.sum()


def predict(data: bytes, top_k: int = 5) -> tuple[list[tuple[int, float]], float, tuple[int, int]]:
    """Classify raw image bytes.

    Returns ([(label_index, confidence), ...], milliseconds, (width, height)).
    """
    if _session is None:
        load()
    assert _session is not None

    batch, original = preprocess(data)
    started = time.perf_counter()
    logits = _session.run(None, {_session.get_inputs()[0].name: batch})[0][0]
    elapsed_ms = (time.perf_counter() - started) * 1000

    probabilities = _softmax(logits.astype(np.float32))
    top_k = max(1, min(top_k, len(probabilities)))
    best = np.argpartition(-probabilities, top_k - 1)[:top_k]
    best = best[np.argsort(-probabilities[best])]
    return [(int(i), float(probabilities[i])) for i in best], elapsed_ms, original
