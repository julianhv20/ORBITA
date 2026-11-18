"""
Espacio Ontológico de 28 Ejes Semánticos para ÓRBITA y Constructor de Vectores Densos.
Garantiza que:
  1. Dos conceptos del mismo dominio (ej. 'minuto'/'segundo' o 'tren'/'ferrocarril') tengan
     alta similitud en el subespacio tangente -> Fricción Roja (d_⊥ < 0.50).
  2. Dos conceptos de dominios emparentados (ej. 'física cuántica' e 'ingeniería mecánica')
     tengan separación moderada -> Estable (d_⊥ ∈ [0.60, 0.75]).
  3. Dos conceptos de dominios ortogonales (ej. 'arte surrealista' y 'cronobiología')
     alcancen máxima divergencia -> Resonancia Armónica (d_⊥ >= 0.82).
"""

from __future__ import annotations
import hashlib
import numpy as np

# 28 ejes semánticos ortogonales base + 36 micro-ejes de subestructura fina = 64 dims base
DOMAINS = [
    "TIEMPO",        # 0: Cronometría, ciclos, eras, calendario
    "MECANICA",      # 1: Ingeniería mecánica, máquinas, herramientas
    "BIOLOGIA",      # 2: Vida, fisiología, evolución, células
    "ASTRONOMIA",    # 3: Cosmos, astros, gravitación, espacio
    "OPTICA",        # 4: Luz, visión, reflexión, lentes, imagen
    "TERMODINAMICA", # 5: Fuego, calor, combustión, energía térmica
    "HIDROLOGIA",    # 6: Agua, océanos, ríos, fluidos, lluvia
    "GEOLOGIA",      # 7: Minerales, tierra, volcanes, cristales
    "ARTE",          # 8: Pintura, escultura, estética, vanguardias
    "MITOLOGIA",     # 9: Mitos, leyendas, símbolos arquetípicos
    "MUSICA",        # 10: Acústica, sonido, ritmo, instrumentos
    "ARQUITECTURA",  # 11: Construcción, urbanismo, estructuras
    "MENTE",         # 12: Psicología, sueños, percepción, emoción
    "ANATOMIA",      # 13: Cuerpo humano, medicina, sentidos
    "COMPUTACION",   # 14: Redes, silicio, algoritmos, telecom
    "FISICA",        # 15: Cuántica, ondas, electromagnetismo, átomos
    "FILOSOFIA",     # 16: Existencia, mortalidad, ética, metafísica
    "SOCIEDAD",      # 17: Política, diplomacia, ley, ritual colectivo
    "GASTRONOMIA",   # 18: Cocina, alimentos, fermentación, cultivo
    "JUEGOS",        # 19: Ajedrez, deporte, táctica, azar
    "BOTANICA",      # 20: Árboles, bosques, raíces, semillas, flora
    "ZOOLOGIA",      # 21: Fauna, aves, insectos, comportamiento animal
    "NAVEGACION",    # 22: Transporte, mapas, viajes, rutas marítimas/férreas
    "ARTESANIA",     # 23: Joyería, moda, textil, cerámica, forja
    "PENUMBRA",      # 24: Oscuridad, misterio, ocultismo, noche
    "HISTORIA",      # 25: Arqueología, memoria colectiva, imperios, archivos
    "LENGUAJE",      # 26: Lingüística, traducción, voz, literatura
    "MATEMATICA",    # 27: Geometría, álgebra, simetría, topología
]

DOMAIN_IDX = {name: i for i, name in enumerate(DOMAINS)}

# Matriz de afinidad suave entre dominios cercanos (p. ej. BIOLOGIA <-> ANATOMIA, FISICA <-> ASTRONOMIA)
_CROSS_LINKS = [
    ("BIOLOGIA", "ANATOMIA", 0.24),
    ("BIOLOGIA", "BOTANICA", 0.22),
    ("BIOLOGIA", "ZOOLOGIA", 0.22),
    ("MECANICA", "FISICA", 0.20),
    ("MECANICA", "NAVEGACION", 0.16),
    ("FISICA", "ASTRONOMIA", 0.22),
    ("FISICA", "OPTICA", 0.22),
    ("FISICA", "MATEMATICA", 0.20),
    ("ARTE", "LITERATURA" if "LITERATURA" in DOMAIN_IDX else "LENGUAJE", 0.18),
    ("ARTE", "ARQUITECTURA", 0.16),
    ("MITOLOGIA", "FILOSOFIA", 0.18),
    ("MITOLOGIA", "HISTORIA", 0.16),
    ("MENTE", "FILOSOFIA", 0.20),
    ("MENTE", "ANATOMIA", 0.16),
    ("GEOLOGIA", "TERMODINAMICA", 0.16),
    ("HIDROLOGIA", "NAVEGACION", 0.18),
]


def build_domain_coupling_matrix() -> np.ndarray:
    n = len(DOMAINS)
    mat = np.eye(n, dtype=np.float64)
    for d1, d2, weight in _CROSS_LINKS:
        i, j = DOMAIN_IDX[d1], DOMAIN_IDX[d2]
        mat[i, j] = weight
        mat[j, i] = weight
    return mat


COUPLING_MATRIX = build_domain_coupling_matrix()


def deterministic_micro_signature(tag: str, dim: int = 36, scale: float = 0.16) -> np.ndarray:
    """
    Genera una micro-firma determinista de baja amplitud (basada en SHA-256 del sub-clúster)
    para diferenciar levemente conceptos distintos dentro de un mismo dominio sin romper su cercanía.
    """
    digest = hashlib.sha256(tag.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "little")
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(dim)
    v /= max(np.linalg.norm(v), 1e-9)
    return v * scale


def compose_semantic_vector(
    weights: dict[str, float],
    cluster_key: str,
    core_affinity_vec: np.ndarray | None = None,
    gravity_boost: float = 0.0,
) -> np.ndarray:
    """
    Construye un vector semántico de 64 dimensiones (28 ejes ontológicos acoplados + 36 micro-ejes).
    Conceptos que comparten `cluster_key` (ej. 'reloj_pulsera' para 'pulsera' y 'muñeca')
    comparten también la micro-firma, produciendo colisión alta realista (d_⊥ < 0.35).
    """
    dom_vec = np.zeros(len(DOMAINS), dtype=np.float64)
    for dom_name, val in weights.items():
        idx = DOMAIN_IDX[dom_name]
        dom_vec[idx] += float(val)

    # Propagar afinidad ontológica natural entre dominios vecinos
    coupled = COUPLING_MATRIX @ dom_vec
    norm_c = np.linalg.norm(coupled)
    if norm_c > 1e-9:
        coupled = coupled / norm_c

    micro = deterministic_micro_signature(cluster_key, dim=36, scale=0.18)
    full_vec = np.concatenate([coupled, micro])
    full_vec /= max(np.linalg.norm(full_vec), 1e-9)

    if core_affinity_vec is not None and gravity_boost > 0.0:
        full_vec = (1.0 - gravity_boost) * full_vec + gravity_boost * core_affinity_vec
        full_vec /= max(np.linalg.norm(full_vec), 1e-9)

    return full_vec
