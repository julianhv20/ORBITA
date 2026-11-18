"""
Adaptador de Motores de Embeddings para ÓRBITA:
  - 'manifold' (por defecto, cero descargas pesadas, determinista en < 2s sobre NumPy puro)
  - 'transformer' (para ejecución nocturna en GitHub Actions con sentence-transformers)
"""

from __future__ import annotations
import numpy as np
from .concept_ontology import compose_semantic_vector, deterministic_micro_signature
from .orbital_math import isotropic_whitening


class EmbeddingEngine:
    def __init__(self, backend: str = "manifold", model_name: str = "intfloat/multilingual-e5-base"):
        self.backend = backend
        self.model_name = model_name
        self._st_model = None

        if backend == "transformer":
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._st_model = SentenceTransformer(model_name)

    def encode_puzzle_space(
        self,
        core_word: str,
        core_weights: dict[str, float],
        expanded_candidates: list[dict],
        target_dim: int = 128,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Retorna (core_vec_128d, candidate_vecs_128d) ya blanqueados isotrópicamente (Whitening).
        """
        if self.backend == "transformer" and self._st_model is not None:
            texts = [f"query: {core_word.lower()}"] + [
                f"passage: {item['display'].lower()}" for item in expanded_candidates
            ]
            raw = np.asarray(self._st_model.encode(texts, normalize_embeddings=True), dtype=np.float64)
            whitened = isotropic_whitening(raw, remove_top_k=2, target_dim=target_dim)
            return whitened[0], whitened[1:]

        # Backend determinista ontológico + SVD Isotropic Whitening en R^128
        core_base = compose_semantic_vector(core_weights, f"core::{core_word.lower()}")
        raw_rows = [core_base]

        for item in expanded_candidates:
            # Mezcla controlada entre el vector de dominio puro y una fracción gravitacional al núcleo
            g_target = float(item["targetGravity"])
            # Mapea targetGravity [0.42..0.80] -> mezcla suave con core_base para preservar orden radial
            mix = max(0.18, min(0.62, (g_target - 0.25) * 0.78))
            base_vec = compose_semantic_vector(
                item["weights"],
                item["clusterKey"],
                core_affinity_vec=core_base,
                gravity_boost=mix,
            )
            if not item["isCanonical"]:
                # Micro-desplazamiento sutil para distinguir alias del lema manteniendo colisión alta
                jitter = deterministic_micro_signature(f"alias::{item['norm']}", dim=base_vec.shape[0], scale=0.025)
                base_vec = base_vec + jitter
                base_vec /= max(np.linalg.norm(base_vec), 1e-9)
            raw_rows.append(base_vec)

        raw_mat = np.vstack(raw_rows)
        # Inmersión isotrópica ortogonal en R^128 preservando productos punto exactos
        whitened = isotropic_whitening(raw_mat, remove_top_k=0, target_dim=target_dim, seed=2026)
        return whitened[0], whitened[1:]
