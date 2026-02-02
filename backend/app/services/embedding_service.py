from __future__ import annotations

from typing import List, Optional


class EmbeddingService:
    """
    Local sentence-transformers embedding service.
    Uses a singleton-ish model per process to avoid repeated loads.
    """

    _model = None
    _model_name: str = "sentence-transformers/all-MiniLM-L6-v2"

    @classmethod
    def _get_model(cls):
        if cls._model is None:
            from sentence_transformers import SentenceTransformer
            cls._model = SentenceTransformer(cls._model_name)
        return cls._model

    @classmethod
    def embed_text(cls, text: Optional[str]) -> Optional[List[float]]:
        if not text:
            return None
        cleaned = text.strip()
        if not cleaned:
            return None

        model = cls._get_model()
        vec = model.encode(cleaned, normalize_embeddings=True)
        # vec is a numpy array
        return vec.tolist()


