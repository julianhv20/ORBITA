"""
Suite de Verificación Matemática, Binaria y Psicométrica de ÓRBITA (Iteración 1).
Ejecutable con librería estándar: python -m unittest discover -s pipeline/tests -v
"""

from __future__ import annotations
import json
import struct
import sys
import unittest
from pathlib import Path
import numpy as np

# Añadir directorio pipeline/ al path para importación limpia
PIPELINE_DIR = Path(__file__).resolve().parent.parent
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from src.text_norm import normalize_word, is_morphological_derivative
from src.orbital_math import (
    compute_tangent_residuals,
    quantize_unit_vectors_int8,
    compute_int8_distance_matrix,
    score_constellation,
)
from build_season import build_all


class TestOrbitaPsychometrics(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.out_dir = PIPELINE_DIR.parent / "web" / "public" / "daily"
        cls.manifest = build_all(cls.out_dir, backend="manifold")
        cls.lexicon_words = set(
            (cls.out_dir / "lexicon_es.txt").read_text(encoding="utf-8").splitlines()
        )
        cls.reloj_json = json.loads(
            (cls.out_dir / "daily_001_reloj.json").read_text(encoding="utf-8")
        )
        cls.reloj_bin = (cls.out_dir / "daily_001_reloj.bin").read_bytes()

    def test_01_tangent_orthogonality_eliminates_core_bias(self) -> None:
        """Verifica que u_i ⊥ v0 con precisión de máquina (< 1e-9)."""
        rng = np.random.default_rng(7)
        v0 = rng.standard_normal(128)
        V = rng.standard_normal((50, 128))
        _, U = compute_tangent_residuals(v0, V)
        v0_unit = v0 / np.linalg.norm(v0)
        dots = np.abs(U @ v0_unit)
        self.assertLess(float(np.max(dots)), 1e-9)

    def test_02_binary_orbt_format_and_size_budget(self) -> None:
        """Valida cabecera ORBT v1, alineación exacta de bytes y presupuesto < 550 KB."""
        magic, ver, dim, m_count, tau_min, s_max = struct.unpack(
            "<4sBBHff", self.reloj_bin[:16]
        )
        self.assertEqual(magic, b"ORBT")
        self.assertEqual(ver, 1)
        self.assertEqual(dim, 128)
        self.assertEqual(m_count, len(self.reloj_json["candidates"]))
        self.assertAlmostEqual(tau_min, 0.32, places=3)
        self.assertGreaterEqual(s_max, 88.0)

        expected_bytes = 16 + (8 * m_count) + (dim * m_count)
        self.assertEqual(len(self.reloj_bin), expected_bytes)

        for p in self.manifest["puzzles"]:
            total_bytes = p["binBytes"] + p["jsonBytes"]
            self.assertLess(total_bytes, 550 * 1024)
            self.assertGreaterEqual(p["sMax"], 88.0)
            self.assertGreaterEqual(p["candidateCount"], 55)

    def test_03_roche_limit_vs_bisociation_dali_rule(self) -> None:
        """
        Verifica el 'Problema Dalí': derivados y unidades obvias caen en Roche,
        mientras que 'dalí', 'cuco', 'circadiano', 'cesio' y 'arena' entran en órbita.
        """
        roche_set = set(self.reloj_json["rocheWords"])
        cand_norms = {c[0] for c in self.reloj_json["candidates"]}

        for obvious in ("hora", "minuto", "segundo", "relojes", "relojero", "aguja", "tiempo"):
            norm = normalize_word(obvious)
            is_roche = norm in roche_set or is_morphological_derivative("RELOJ", norm)
            self.assertTrue(is_roche, f"'{obvious}' debería caer en el Límite de Roche")
            self.assertNotIn(norm, cand_norms)

        for creative in ("dali", "cuco", "circadiano", "cesio", "arena", "ajedrez", "pendulo"):
            self.assertIn(creative, cand_norms, f"'{creative}' debe ser candidato orbital válido")
            self.assertNotIn(creative, roche_set)

    def test_04_outer_void_vs_gibberish_validation(self) -> None:
        """
        Palabras reales inconexas existen en el léxico (van al Vacío Exterior),
        mientras que cadenas sin sentido ('asdfghqw') no existen (0 impulsos).
        """
        cand_norms = {c[0] for c in self.reloj_json["candidates"]}
        forms_map = self.reloj_json["formsMap"]

        for unrelated in ("hipopotamo", "rinoceronte", "tostadora", "lechuga", "calcetin", "paraguas"):
            self.assertIn(unrelated, self.lexicon_words, f"'{unrelated}' debe estar en lexicon_es.txt")
            self.assertNotIn(unrelated, cand_norms)
            self.assertNotIn(unrelated, forms_map)

        for gibberish in ("asdfghjk", "qwertzui", "zxvbnmqw"):
            self.assertNotIn(gibberish, self.lexicon_words)

    def test_05_linear_vs_divergent_score_discrimination(self) -> None:
        """
        Comprueba que una constelación lineal puntúa bajo con fricciones rojas,
        y una constelación bisociativa supera 85/100 con 0 fricciones y simetría total.
        """
        m_count = len(self.reloj_json["candidates"])
        vec_offset = 16 + 8 * m_count
        q_vecs = np.frombuffer(self.reloj_bin[vec_offset:], dtype=np.int8).reshape((m_count, 128))
        dist_mat = compute_int8_distance_matrix(q_vecs)

        # Simetría exacta (corrige el fallo de orden de los LLMs)
        self.assertTrue(np.allclose(dist_mat, dist_mat.T, atol=1e-12))

        norm_to_idx = {c[0]: idx for idx, c in enumerate(self.reloj_json["candidates"])}

        # Constelación lineal / redundante (mismos clústeres de indumentaria y arte)
        linear_words = ["muñeca", "pulsera", "correa", "dali", "surrealismo"]
        linear_idx = [norm_to_idx[normalize_word(w)] for w in linear_words]
        linear_eval = score_constellation(linear_idx, dist_mat)
        self.assertLess(linear_eval["score"], 65.0)
        self.assertGreaterEqual(linear_eval["red_pairs"], 2)

        # Constelación altamente divergente (5 dominios ortogonales)
        divergent_words = ["arena", "dali", "circadiano", "cesio", "ajedrez"]
        div_idx = [norm_to_idx[normalize_word(w)] for w in divergent_words]
        div_eval = score_constellation(div_idx, dist_mat)
        self.assertGreaterEqual(div_eval["score"], 85.0)
        self.assertEqual(div_eval["red_pairs"], 0)

        # Invariancia por permutación de orden de lanzamiento
        div_eval_reversed = score_constellation(list(reversed(div_idx)), dist_mat)
        self.assertEqual(div_eval["score"], div_eval_reversed["score"])


if __name__ == "__main__":
    unittest.main()
