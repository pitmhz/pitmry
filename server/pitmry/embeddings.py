"""Explicit local-only embedding support for PITMRY projections."""

from __future__ import annotations

import os
from pathlib import Path


class EmbeddingUnavailable(RuntimeError):
    """Raised when the configured local model cannot produce an embedding."""


class LocalEmbedder:
    """Load one explicitly configured ONNX model without network access."""

    model_name = "Xenova/all-MiniLM-L6-v2"
    dimensions = 384

    def __init__(self, model_path=None, tokenizer_path=None):
        default_model = Path.home() / ".cavemem" / "models" / "Xenova" / "all-MiniLM-L6-v2" / "onnx" / "model_quantized.onnx"
        default_tokenizer = Path.home() / ".cavemem" / "models" / "Xenova" / "all-MiniLM-L6-v2" / "tokenizer.json"
        self.model_path = Path(model_path or os.environ.get("PITMRY_ONNX_MODEL") or default_model)
        self.tokenizer_path = Path(tokenizer_path or os.environ.get("PITMRY_TOKENIZER") or default_tokenizer)
        self._session = None
        self._tokenizer = None

    def _load(self):
        if self._session is not None:
            return
        if not str(self.model_path) or not str(self.tokenizer_path):
            raise EmbeddingUnavailable("set PITMRY_ONNX_MODEL and PITMRY_TOKENIZER to local files")
        if not self.model_path.is_file() or not self.tokenizer_path.is_file():
            raise EmbeddingUnavailable("configured local embedding model files are missing")
        try:
            import onnxruntime as ort
            from tokenizers import Tokenizer
            options = ort.SessionOptions()
            options.log_severity_level = 3
            self._session = ort.InferenceSession(str(self.model_path), sess_options=options)
            self._tokenizer = Tokenizer.from_file(str(self.tokenizer_path))
            self._tokenizer.enable_truncation(max_length=256)
        except Exception as exc:
            self._session = None
            self._tokenizer = None
            raise EmbeddingUnavailable(f"local embedding model failed to load: {exc}") from exc

    def embed(self, text):
        try:
            import numpy as np
            self._load()
            encoded = self._tokenizer.encode(text)
            names = {item.name for item in self._session.get_inputs()}
            feed = {"input_ids": np.asarray([encoded.ids], dtype=np.int64),
                    "attention_mask": np.asarray([encoded.attention_mask], dtype=np.int64)}
            if "token_type_ids" in names:
                feed["token_type_ids"] = np.asarray([encoded.type_ids], dtype=np.int64)
            output = self._session.run(None, feed)[0]
            mask = np.asarray([encoded.attention_mask], dtype=np.float32)[..., None]
            vector = (output * mask).sum(axis=1) / np.maximum(mask.sum(axis=1), 1e-9)
            vector = vector[0].astype(np.float32)
            norm = float(np.linalg.norm(vector))
            if vector.ndim != 1 or len(vector) != self.dimensions or not np.isfinite(vector).all() or norm == 0:
                raise ValueError("model returned an invalid vector")
            return (vector / norm).tolist()
        except EmbeddingUnavailable:
            raise
        except Exception as exc:
            raise EmbeddingUnavailable(f"local embedding failed: {exc}") from exc
