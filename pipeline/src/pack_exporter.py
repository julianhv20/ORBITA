"""
Compilador de Paquetes Diarios ORBT v1 (.bin + .json) para ÓRBITA.
"""

from __future__ import annotations
import json
import struct
from pathlib import Path
import numpy as np

from .text_norm import normalize_word, generate_inflections, is_morphological_derivative
from .embedding_engine import EmbeddingEngine
from .orbital_math import (
    compute_tangent_residuals,
    compute_semantic_angles_2d,
    quantize_unit_vectors_int8,
    compute_int8_distance_matrix,
)
from .daily_solver import find_master_constellation, calibrate_percentiles


def expand_puzzle_candidates(puzzle_def: dict) -> tuple[list[str], list[dict], dict[str, int]]:
    """
    Expande los satélites canónicos y sus alias conceptuales, filtrando colisiones
    con el Límite de Roche y construyendo el mapa de plurales/flexiones -> índice candidato.
    """
    core_word = puzzle_def["core"]
    roche_set: set[str] = set()
    for rw in puzzle_def.get("roche", []):
        nw = normalize_word(rw)
        if nw:
            roche_set.update(generate_inflections(nw))

    # Añadir inflexiones de la palabra núcleo por seguridad
    roche_set.update(generate_inflections(normalize_word(core_word)))

    candidates: list[dict] = []
    seen_norms: set[str] = set()
    forms_to_idx: dict[str, int] = {}

    for entry in puzzle_def["satellites"]:
        display, domain_label, cluster_key, weights, target_grav, aliases, insight = entry
        norm_main = normalize_word(display)
        if not norm_main or norm_main in roche_set or is_morphological_derivative(core_word, norm_main):
            continue
        if norm_main in seen_norms:
            continue

        main_idx = len(candidates)
        seen_norms.add(norm_main)
        candidates.append({
            "norm": norm_main,
            "display": display.strip().upper(),
            "domain": domain_label.strip(),
            "clusterKey": cluster_key,
            "weights": weights,
            "targetGravity": float(target_grav),
            "insight": insight.strip(),
            "isCanonical": True,
        })
        for inf in generate_inflections(norm_main):
            if inf != norm_main and inf not in roche_set and inf not in seen_norms:
                forms_to_idx.setdefault(inf, main_idx)

        # Materializar cada alias conceptual como candidato propio del mismo clúster
        for alias_raw in aliases:
            norm_alias = normalize_word(alias_raw)
            if (
                not norm_alias
                or len(norm_alias) < 2
                or norm_alias in roche_set
                or is_morphological_derivative(core_word, norm_alias)
                or norm_alias in seen_norms
            ):
                continue

            alias_idx = len(candidates)
            seen_norms.add(norm_alias)
            # Formatear display con mayúsculas limpias
            alias_display = alias_raw.strip().upper()
            candidates.append({
                "norm": norm_alias,
                "display": alias_display,
                "domain": domain_label.strip(),
                "clusterKey": cluster_key,
                "weights": weights,
                "targetGravity": round(max(0.38, float(target_grav) - 0.03), 3),
                "insight": insight.strip(),
                "isCanonical": False,
            })
            for inf in generate_inflections(norm_alias):
                if inf != norm_alias and inf not in roche_set and inf not in seen_norms:
                    forms_to_idx.setdefault(inf, alias_idx)

    # Limpiar forms_to_idx de cualquier clave que luego haya entrado como candidato directo
    for k in list(forms_to_idx.keys()):
        if k in seen_norms or k in roche_set:
            del forms_to_idx[k]

    return sorted(roche_set), candidates, forms_to_idx


def compile_daily_pack(
    puzzle_def: dict,
    output_dir: Path,
    engine: EmbeddingEngine,
    dim: int = 128,
) -> dict:
    """
    Ejecuta el pipeline matemático completo para un desafío diario y escribe:
      - daily_<id>_<slug>.bin (cabecera ORBT + Float32Array [g, θ] + Int8Array residuales)
      - daily_<id>_<slug>.json (metadatos, candidatos, Límite de Roche, Constelación Maestra)
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    roche_list, candidates, forms_map = expand_puzzle_candidates(puzzle_def)

    core_vec, cand_vecs = engine.encode_puzzle_space(
        core_word=puzzle_def["core"],
        core_weights=puzzle_def["core_weights"],
        expanded_candidates=candidates,
        target_dim=dim,
    )

    # 1. Proyección Residual Ortogonal en v0^⊥
    raw_gravities, u_tangent = compute_tangent_residuals(core_vec, cand_vecs)

    # Re-escalar suavemente gravedades al intervalo calibrado [0.34, 0.82] preservando ranking exacto
    g_min, g_max = float(np.min(raw_gravities)), float(np.max(raw_gravities))
    if g_max - g_min > 1e-6:
        norm_g = (raw_gravities - g_min) / (g_max - g_min)
    else:
        norm_g = np.full_like(raw_gravities, 0.5)
    target_gs = np.array([c["targetGravity"] for c in candidates], dtype=np.float64)
    calibrated_gravities = (0.45 * (0.36 + 0.44 * norm_g) + 0.55 * target_gs).astype(np.float32)

    # 2. Ángulos Semánticos Reales 2D en el Plano Tangente
    angles_2d, _ = compute_semantic_angles_2d(u_tangent)

    # 3. Cuantización Int8 [-127, 127] y matriz de distancias exacta
    q_int8 = quantize_unit_vectors_int8(u_tangent)
    dist_mat = compute_int8_distance_matrix(q_int8)

    # 4. Solver Simulated Annealing (Constelación Maestra) y Percentiles Monte Carlo
    master = find_master_constellation(dist_mat, candidates, k=5)
    percentiles = calibrate_percentiles(dist_mat, candidates, n_simulations=3000)

    tau_min = 0.32
    s_max = float(master["score"])
    num_candidates = len(candidates)

    # 5. Empaquetado Binario ORBT v1
    pack_basename = f"daily_{puzzle_def['id']}_{puzzle_def['slug']}"
    bin_path = output_dir / f"{pack_basename}.bin"
    json_path = output_dir / f"{pack_basename}.json"

    header_bytes = struct.pack("<4sBBHff", b"ORBT", 1, dim, num_candidates, tau_min, s_max)
    interleaved_ga = np.empty(num_candidates * 2, dtype="<f4")
    interleaved_ga[0::2] = calibrated_gravities
    interleaved_ga[1::2] = angles_2d

    with bin_path.open("wb") as f:
        f.write(header_bytes)
        f.write(interleaved_ga.tobytes())
        f.write(q_int8.tobytes(order="C"))

    # 6. Empaquetado JSON compacto de metadatos
    master_words = []
    for idx in master["indices"]:
        c = candidates[idx]
        master_words.append({
            "word": c["display"],
            "domain": c["domain"],
            "insight": c["insight"],
            "gravity": round(float(calibrated_gravities[idx]), 3),
            "angleRad": round(float(angles_2d[idx]), 4),
        })

    compact_candidates = [
        [c["norm"], c["display"], c["domain"], c["insight"]]
        for c in candidates
    ]

    metadata = {
        "version": 1,
        "id": puzzle_def["id"],
        "slug": puzzle_def["slug"],
        "binFile": f"{pack_basename}.bin",
        "coreWord": puzzle_def["core"],
        "subtitle": puzzle_def["subtitle"],
        "hint": puzzle_def["hint"],
        "accent": puzzle_def["accent"],
        "thresholds": {
            "tauMin": tau_min,
            "tauRoche": 0.85,
            "sMax": s_max,
            "percentiles": percentiles,
        },
        "rocheWords": roche_list,
        "candidates": compact_candidates,
        "formsMap": forms_map,
        "masterConstellation": {
            "score": s_max,
            "meanDist": master["meanDist"],
            "minDist": master["minDist"],
            "satellites": master_words,
        },
    }

    json_path.write_text(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    return {
        "id": puzzle_def["id"],
        "slug": puzzle_def["slug"],
        "coreWord": puzzle_def["core"],
        "subtitle": puzzle_def["subtitle"],
        "accent": puzzle_def["accent"],
        "jsonFile": f"{pack_basename}.json",
        "binFile": f"{pack_basename}.bin",
        "candidateCount": num_candidates,
        "sMax": s_max,
        "percentiles": percentiles,
        "binBytes": bin_path.stat().st_size,
        "jsonBytes": json_path.stat().st_size,
    }
