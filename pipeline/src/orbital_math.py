"""
Motor Matemático de ÓRBITA:
1. All-but-the-Top Isotropic SVD Whitening (Mu & Viswanath, 2018)
2. Proyección Residual Ortogonal en el Hiperplano Tangente al Núcleo (v0^⊥)
3. Extracción de Ángulos Semánticos 2D por SVD en el Plano Tangente
4. Cuantización Int8 [-127, 127] y Métrica DAT Tangencial con Penalización de Eslabón Débil
"""

from __future__ import annotations
import numpy as np


def l2_normalize(mat: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    """Normaliza filas (si 2D) o un vector (si 1D) a norma unitaria L2."""
    if mat.ndim == 1:
        norm = float(np.linalg.norm(mat))
        return mat / max(norm, eps)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    return mat / np.maximum(norms, eps)


def isotropic_whitening(
    embeddings: np.ndarray,
    remove_top_k: int = 1,
    target_dim: int = 128,
    seed: int = 42,
) -> np.ndarray:
    """
    Aplica centrado de media global, remueve las componentes principales anisótropas
    (cono estrecho de frecuencia/longitud) y proyecta a `target_dim` dimensiones isotrópicas.
    Si la dimensión de entrada es menor que `target_dim`, expande primero mediante una
    matriz ortogonal determinista (isometría de Haar) que preserva exactamente productos punto.
    """
    X = np.asarray(embeddings, dtype=np.float64)
    n_samples, in_dim = X.shape

    # 1. Centrado respecto a la media global del vocabulario
    mean_vec = np.mean(X, axis=0, keepdims=True)
    X_centered = X - mean_vec

    # 2. Eliminación de las primeras `remove_top_k` direcciones de anisotropía común
    if remove_top_k > 0 and min(n_samples, in_dim) > remove_top_k + 4:
        _, _, vt_full = np.linalg.svd(X_centered, full_matrices=False)
        top_dirs = vt_full[:remove_top_k]  # (k, in_dim)
        X_centered = X_centered - (X_centered @ top_dirs.T) @ top_dirs

    # 3. Suavizado espectral (Regularized PCA Whitening) para ecualizar varianza sin amplificar ruido
    u, s, vt = np.linalg.svd(X_centered, full_matrices=False)
    # Exponente 0.35 balancea isotropía geométrica preservando jerarquía semántica
    s_reg = np.power(s + 1e-3, -0.35)
    X_iso = (X_centered @ vt.T) * s_reg  # (n_samples, rank)

    curr_dim = X_iso.shape[1]
    if curr_dim > target_dim:
        X_out = X_iso[:, :target_dim]
    elif curr_dim < target_dim:
        # Inmersión isométrica ortogonal en R^{target_dim} (preserva ángulos exactamente)
        rng = np.random.default_rng(seed)
        rand_mat = rng.standard_normal((target_dim, target_dim))
        q_ortho, _ = np.linalg.qr(rand_mat)
        pad = np.zeros((n_samples, target_dim), dtype=np.float64)
        pad[:, :curr_dim] = X_iso
        X_out = pad @ q_ortho.T
    else:
        X_out = X_iso

    return l2_normalize(X_out)


def compute_tangent_residuals(core_vec: np.ndarray, candidate_vecs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Dado el vector unitario del núcleo v0 (D,) y los candidatos unitarios V (M, D):
      g_i = v0 · v_i
      r_i = v_i - g_i * v0
      u_i = r_i / ||r_i||_2
    Garantiza matemáticamente que u_i ⊥ v0 (elimina la afinidad compartida con el núcleo).
    Retorna (gravities: (M,), U_tangent: (M, D)).
    """
    v0 = l2_normalize(np.asarray(core_vec, dtype=np.float64))
    V = l2_normalize(np.asarray(candidate_vecs, dtype=np.float64))

    gravities = V @ v0  # (M,)
    residuals = V - np.outer(gravities, v0)  # (M, D)
    # Centrar la nube residual dentro del hiperplano v0^⊥ y re-proyectar ortogonalmente a v0
    res_centered = residuals - np.mean(residuals, axis=0, keepdims=True)
    res_ortho = res_centered - np.outer(res_centered @ v0, v0)
    u_tangent = l2_normalize(res_ortho)
    return gravities, u_tangent


def compute_semantic_angles_2d(u_tangent: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Extrae el plano principal 2D (e1, e2) dentro del subespacio tangente v0^⊥ mediante SVD
    y calcula el ángulo polar θ_i ∈ [-π, π] de cada candidato orbital.
    Conceptos del mismo dominio caen en el mismo sector angular del radar;
    conceptos bisociativos caen en cuadrantes distintos.
    """
    U = np.asarray(u_tangent, dtype=np.float64)
    if U.shape[0] < 3:
        angles = np.linspace(-np.pi, np.pi, U.shape[0], endpoint=False)
        return angles, np.eye(2, U.shape[1])

    U_centered = U - np.mean(U, axis=0, keepdims=True)
    _, _, vt = np.linalg.svd(U_centered, full_matrices=False)
    basis_2d = vt[:2]  # (2, D)
    coords_2d = U @ basis_2d.T  # (M, 2)
    angles = np.arctan2(coords_2d[:, 1], coords_2d[:, 0])
    return angles.astype(np.float32), basis_2d


def quantize_unit_vectors_int8(u_tangent: np.ndarray) -> np.ndarray:
    """
    Cuantiza vectores unitarios float64 (M, D) a int8 [-127, 127] escalando por el máximo
    absoluto de cada fila para aprovechar los 8 bits completos sin saturación.
    """
    U = np.asarray(u_tangent, dtype=np.float64)
    max_abs = np.max(np.abs(U), axis=1, keepdims=True)
    max_abs = np.maximum(max_abs, 1e-9)
    scaled = np.rint((U / max_abs) * 127.0)
    return np.clip(scaled, -127, 127).astype(np.int8)


def tangential_distance_from_cos(cos_sim: np.ndarray | float) -> np.ndarray | float:
    """
    Transforma la similitud coseno en el plano tangente cos(u_i, u_j) ∈ [-1, 1]
    a la escala psicométrica DAT de ÓRBITA ∈ [0.08, 0.97]:
      - Mismo subdominio (cos >= 0.40)   -> d_⊥ < 0.52 (Fricción Roja)
      - Dominios cercanos (0.12..0.35)   -> d_⊥ ∈ [0.58, 0.74] (Estable)
      - Ortogonales (cos ≈ 0.0)          -> d_⊥ ≈ 0.85 (Alta Divergencia)
      - Simplex centrado (cos <= -0.12)  -> d_⊥ ∈ [0.91, 0.97] (Resonancia / Supernova)
    IMPORTANTE: Esta función es 100% idéntica en Python (ETL) y TypeScript (Cliente).
    """
    c = np.clip(cos_sim, -1.0, 1.0)
    pos_part = np.maximum(0.0, c)
    neg_part = np.minimum(0.0, c)  # <= 0
    dist = 0.85 - 0.75 * np.power(pos_part, 0.80) + 0.45 * np.power(-neg_part, 0.85)
    return np.clip(dist, 0.08, 0.97)


def compute_int8_distance_matrix(q_vecs: np.ndarray) -> np.ndarray:
    """
    Calcula la matriz simétrica exacta M×M de distancias tangenciales a partir de Int8Array,
    replicando exactamente la aritmética entera/flotante que ejecuta el navegador.
    """
    Q = np.asarray(q_vecs, dtype=np.float64)
    norms = np.linalg.norm(Q, axis=1, keepdims=True)
    Q_unit = Q / np.maximum(norms, 1e-9)
    cos_mat = Q_unit @ Q_unit.T
    dist_mat = tangential_distance_from_cos(cos_mat)
    np.fill_diagonal(dist_mat, 0.0)
    return dist_mat


def score_constellation(indices: list[int] | np.ndarray, dist_matrix: np.ndarray) -> dict:
    """
    Evalúa una constelación de k satélites (estándar k=5 -> 10 pares):
      Score = (0.78 * mean(d_ij) + 0.22 * min(d_ij)) * 100
    """
    idx = list(indices)
    k = len(idx)
    if k < 2:
        return {"score": 0.0, "mean_dist": 0.0, "min_dist": 0.0, "red_pairs": 0, "pairs": []}

    pair_dists = []
    for a in range(k):
        for b in range(a + 1, k):
            d = float(dist_matrix[idx[a], idx[b]])
            pair_dists.append((idx[a], idx[b], d))

    vals = [p[2] for p in pair_dists]
    mean_d = float(sum(vals) / len(vals))
    min_d = float(min(vals))
    red_pairs = sum(1 for v in vals if v < 0.58)
    raw_score = (0.78 * mean_d + 0.22 * min_d) * 100.0

    return {
        "score": round(raw_score, 1),
        "mean_dist": round(mean_d, 4),
        "min_dist": round(min_d, 4),
        "red_pairs": red_pairs,
        "pairs": pair_dists,
    }
