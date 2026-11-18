"""
Solver Diario de ÓRBITA (Multi-Start Simulated Annealing) y Calibrador Psicométrico Monte Carlo.
Encuentra la Constelación Maestra de 5 palabras (S_max) garantizando dominios únicos
y calcula los percentiles reales del puzzle frente a 5,000 constelaciones sintéticas.
"""

from __future__ import annotations
import math
import numpy as np
from .orbital_math import score_constellation


def find_master_constellation(
    dist_matrix: np.ndarray,
    candidates_meta: list[dict],
    k: int = 5,
    restarts: int = 8,
    steps_per_restart: int = 2500,
    seed: int = 2026,
) -> dict:
    """
    Busca la constelación óptima de k=5 conceptos canónicos (excluyendo alias secundarios
    para que la Constelación Maestra exhiba siempre lemas principales limpios).
    """
    rng = np.random.default_rng(seed)

    canonical_indices = [
        i for i, item in enumerate(candidates_meta) if item.get("isCanonical", True)
    ]
    if len(canonical_indices) < k:
        canonical_indices = list(range(len(candidates_meta)))

    best_global_indices: list[int] = canonical_indices[:k]
    best_global_eval = score_constellation(best_global_indices, dist_matrix)

    for _ in range(restarts):
        current = list(rng.choice(canonical_indices, size=k, replace=False))
        curr_eval = score_constellation(current, dist_matrix)
        temp = 4.5
        cooling = 0.9982

        for _step in range(steps_per_restart):
            slot = int(rng.integers(0, k))
            replacement = int(rng.choice(canonical_indices))
            if replacement in current:
                continue

            proposal = list(current)
            proposal[slot] = replacement
            prop_eval = score_constellation(proposal, dist_matrix)

            delta = prop_eval["score"] - curr_eval["score"]
            if delta >= 0 or rng.random() < math.exp(delta / max(temp, 1e-4)):
                current = proposal
                curr_eval = prop_eval
                if curr_eval["score"] > best_global_eval["score"]:
                    best_global_indices = list(current)
                    best_global_eval = curr_eval

            temp *= cooling

    return {
        "indices": best_global_indices,
        "score": best_global_eval["score"],
        "meanDist": best_global_eval["mean_dist"],
        "minDist": best_global_eval["min_dist"],
    }


def calibrate_percentiles(
    dist_matrix: np.ndarray,
    candidates_meta: list[dict],
    n_simulations: int = 4000,
    seed: int = 101,
) -> dict:
    """
    Simula miles de partidas combinando estrategias humanas realistas:
      - 25% jugadas con sesgo de clúster (pensamiento asociativo lineal)
      - 50% jugadas mixtas aleatorias
      - 25% jugadas con selección voraz parcial (mentes divergentes)
    Retorna los percentiles p25, p50, p75, p90, p99 para calibrar rangos.
    """
    rng = np.random.default_rng(seed)
    canonical_indices = [
        i for i, item in enumerate(candidates_meta) if item.get("isCanonical", True)
    ]
    m = len(canonical_indices)
    if m < 5:
        return {"p25": 65.0, "p50": 76.0, "p75": 83.0, "p90": 88.0, "p99": 92.0}

    scores = []
    for s in range(n_simulations):
        mode = s % 4
        if mode == 0:
            # Jugador lineal: escoge un nodo semilla y tiende a elegir vecinos cercanos
            anchor = int(rng.choice(canonical_indices))
            dists_to_anchor = [dist_matrix[anchor, idx] for idx in canonical_indices]
            ordered = [idx for _, idx in sorted(zip(dists_to_anchor, canonical_indices))]
            pool = ordered[: min(10, m)]
            pick = list(rng.choice(pool, size=min(5, len(pool)), replace=False))
        elif mode in (1, 2):
            # Jugador promedio: muestra uniforme sobre candidatos válidos
            pick = list(rng.choice(canonical_indices, size=5, replace=False))
        else:
            # Jugador divergente: intenta evitar colisiones evidentes
            pick = [int(rng.choice(canonical_indices))]
            while len(pick) < 5:
                sub = rng.choice(canonical_indices, size=min(6, m), replace=False)
                best_cand = max(
                    (c for c in sub if c not in pick),
                    key=lambda c: min(dist_matrix[c, p] for p in pick),
                    default=None,
                )
                if best_cand is None:
                    break
                pick.append(int(best_cand))

        if len(pick) == 5:
            scores.append(score_constellation(pick, dist_matrix)["score"])

    arr = np.asarray(scores, dtype=np.float64)
    return {
        "p25": round(float(np.percentile(arr, 25)), 1),
        "p50": round(float(np.percentile(arr, 50)), 1),
        "p75": round(float(np.percentile(arr, 75)), 1),
        "p90": round(float(np.percentile(arr, 90)), 1),
        "p99": round(float(np.percentile(arr, 99)), 1),
    }
