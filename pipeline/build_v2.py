"""
ÓRBITA v2.5 — Motor vectorial real (model2vec) + Clasificador de 20 Dominios Semánticos
+ Bitácora con Insights + Constelación Maestra Explicada.
"""

from __future__ import annotations
import argparse
import json
import re
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.text_norm import normalize_word, is_morphological_derivative  # noqa: E402
from src.lexicon_builder import _SPANISH_ROOT_VOCAB, build_spanish_lexicon  # noqa: E402
from src.puzzles_part1 import PUZZLES_PART_1  # noqa: E402
from src.puzzles_part2 import PUZZLES_PART_2  # noqa: E402

ROOT = Path(__file__).resolve().parent
DIM = 64
VOCAB_TARGET = 24000
NEAR_RANK = 400
ROCHE_NEIGHBORS = 8
POOL_SIZE = 1500
SEASON_DAYS = 60
EPOCH_DATE = "2026-11-18"
TZ_OFFSET_MIN = -300  # America/Bogota

W_MEAN, W_MIN = 0.90, 0.10

# 20 Dominios Semánticos con palabras ancla para clasificar las 24,311 palabras del vocabulario
DOMAIN_SPECS: list[tuple[str, list[str]]] = [
    ("Cronometría y Tiempo", ["tiempo", "calendario", "siglo", "epoca", "ciclo", "instante", "eternidad"]),
    ("Física y Cuántica", ["atomo", "energia", "cuantico", "onda", "particula", "laser", "gravedad", "optica"]),
    ("Astronomía y Cosmos", ["estrella", "galaxia", "planeta", "orbita", "eclipse", "cometa", "cosmos", "luna"]),
    ("Biología y Flora", ["celula", "evolucion", "especie", "bosque", "semilla", "arbol", "raiz", "planta"]),
    ("Fauna y Etología", ["animal", "ave", "lobo", "ballena", "insecto", "hormiga", "delfin", "vuelo"]),
    ("Cuerpo y Medicina", ["corazon", "cerebro", "sangre", "neurona", "hueso", "medico", "piel", "oido"]),
    ("Arte y Estética", ["pintura", "escultura", "lienzo", "museo", "surrealismo", "color", "retrato", "arte"]),
    ("Literatura y Mito", ["poesia", "novela", "mito", "leyenda", "dios", "heroe", "fabula", "libro"]),
    ("Música y Acústica", ["musica", "acorde", "melodia", "guitarra", "piano", "tambor", "canto", "sonido"]),
    ("Arquitectura y Ciudad", ["edificio", "torre", "puente", "catedral", "columna", "castillo", "muro", "arco"]),
    ("Ingeniería y Mecánica", ["motor", "engranaje", "acero", "turbina", "rueda", "maquina", "forja", "cable"]),
    ("Cómputo y Redes", ["algoritmo", "codigo", "red", "internet", "silicio", "servidor", "datos", "chip"]),
    ("Geología y Materia", ["cuarzo", "mineral", "volcan", "arena", "roca", "cristal", "oro", "plata"]),
    ("Océano e Hidrología", ["oceano", "marea", "rio", "lluvia", "barco", "ola", "lago", "agua"]),
    ("Termodinámica y Fuego", ["fuego", "llama", "calor", "ceniza", "brasa", "horno", "vela", "humo"]),
    ("Mente y Psicología", ["sueño", "memoria", "emocion", "deseo", "inconsciente", "miedo", "alma", "ego"]),
    ("Filosofía y Sociedad", ["verdad", "etica", "muerte", "ley", "tratado", "historia", "imperio", "paz"]),
    ("Gastronomía y Cultivo", ["cocina", "pan", "vino", "sal", "miel", "cafe", "fruto", "alimento"]),
    ("Juegos y Estrategia", ["ajedrez", "tablero", "azar", "deporte", "combate", "laberinto", "torneo", "juego"]),
    ("Oficios y Objetos", ["casa", "mesa", "llave", "espejo", "lampara", "joya", "tela", "vasija"]),
]

STOP = set("""
para como pero porque cuando donde desde entre hasta sobre tambien aunque mientras segun sino
este esta esto estos estas ese esa eso esos esas aquel aquella nada algo todo toda todos todas
cada otro otra otros otras mismo misma mas menos muy tan tanto bien mal aqui alli ahora luego
antes despues siempre nunca quiza tal vez entonces ademas todavia apenas casi solo solamente
cual cuales quien quienes cuyo cuya donde adonde cuanto cuanta que con sin por ante bajo tras
mio mia tuyo tuya suyo suya nuestro nuestra vuestro vuestra ellos ellas nosotros vosotros usted
ustedes dijo dice digo hace hizo hago esta estan estoy estas esta eres soy somos fue fui era
""".split())

VERB_END = ("ar", "er", "ir", "ado", "ido", "ando", "iendo", "mente", "aba", "ian", "ara", "ase", "aste", "aron", "ieron")

BRIDGE_INSIGHTS_EXTRA: dict[str, dict[str, tuple[str, str]]] = {
    "LUNA": {
        "marea": ("Oceanografía / Gravedad", "Su atracción gravitacional gobierna el ascenso y reflujo de los océanos."),
        "lobo": ("Folclore / Etología", "Arquetipo nocturno asociado al plenilunio en la mitología europea."),
        "eclipse": ("Mecánica Celeste", "Alineación astronómica donde su disco oculta la corona solar."),
        "plata": ("Alquimia / Metalurgia", "Los alquimistas asignaron la plata al astro nocturno por su brillo frío."),
        "calendario": ("Cronometría Antigua", "Las fases sinódicas de 29.5 días estructuraron los primeros meses."),
        "verne": ("Literatura Científica", "Julio Verne imaginó el disparo balístico hacia su superficie en 1865."),
        "crater": ("Geología Planetaria", "Cicatrices de impactos meteoríticos preservadas por la falta de atmósfera."),
    },
    "PAPEL": {
        "origami": ("Geometría / Arte Japonés", "Plegado geométrico que transforma un plano sin cortes ni pegamento."),
        "billete": ("Economía / Fiduciario", "Valor simbólico impreso sobre fibra de algodón desde la dinastía Song."),
        "celulosa": ("Bioquímica Vegetal", "Polímero estructural de las paredes vegetales que entrelaza cada hoja."),
        "papiro": ("Historia / Egipto", "Tiras prensadas del junco del Nilo que precedieron al pergamino."),
        "tijera": ("Teoría de Juegos", "Tríada cíclica de decisión donde el corte vence a la lámina."),
    },
    "SAL": {
        "salario": ("Etimología / Economía", "Del latín 'salarium': pago a los legionarios para conservar alimentos."),
        "sodio": ("Química Inorgánica", "Red cristalina cúbica de cloruro de sodio esencial para el impulso nervioso."),
        "lagrima": ("Fisiología Humana", "Secreción ocular salina que protege la córnea y expresa emoción."),
        "desierto": ("Geomorfología / Salares", "Cuencas endorreicas evaporadas como Uyuni que forman espejos minerales."),
    },
}


def looks_spanish(n: str) -> bool:
    if re.search(r"[kw]|th|sh|ck|gh|ou|oo|ee|tt|ss|ff|pp|ng$", n):
        return False
    return n[-1] in "aeiounslrdzjxy"


def load_vocab(extra_words: list[str], clean: set[str]) -> tuple[list[str], dict[str, int]]:
    path = ROOT / "data" / "es_50k.txt"
    entries: list[str] = []
    seen: set[str] = set()
    ranks: dict[str, int] = {}
    for rank, line in enumerate(path.read_text(encoding="utf-8").splitlines()):
        parts = line.split()
        if not parts:
            continue
        raw = parts[0].lower()
        if not re.fullmatch(r"[a-záéíóúüñ]+", raw):
            continue
        norm = normalize_word(raw)
        if len(norm) < 3 or len(norm) > 16 or norm in STOP or norm in seen:
            continue
        if norm not in clean and not looks_spanish(norm):
            continue
        seen.add(norm)
        ranks[norm] = rank
        entries.append(raw)
        if len(entries) >= VOCAB_TARGET:
            break
    for w in extra_words:
        norm = normalize_word(w)
        if len(norm) >= 3 and norm not in seen:
            seen.add(norm)
            ranks[norm] = 60000
            entries.append(w.lower())
    return entries, ranks


def whiten_to_int8(raw: np.ndarray, logfreq: np.ndarray) -> np.ndarray:
    x = raw.astype(np.float64)
    x -= x.mean(axis=0, keepdims=True)
    for _ in range(3):
        w = x.T @ logfreq
        w /= np.linalg.norm(w)
        x -= np.outer(x @ w, w)
    step = max(1, len(x) // 12000)
    _, _, vt = np.linalg.svd(x[::step], full_matrices=False)
    top = vt[:6]
    x -= (x @ top.T) @ top
    _, s, vt = np.linalg.svd(x[::step], full_matrices=False)
    x = (x @ vt[:DIM].T) / np.power(s[:DIM] + 1e-6, 0.60)
    x /= np.maximum(np.linalg.norm(x, axis=1, keepdims=True), 1e-9)
    scale = 127.0 / np.percentile(np.abs(x), 99.8)
    return np.clip(np.rint(x * scale), -127, 127).astype(np.int8)


def unit(q: np.ndarray) -> np.ndarray:
    f = q.astype(np.float64)
    return f / np.maximum(np.linalg.norm(f, axis=-1, keepdims=True), 1e-9)


def tangent(vhat: np.ndarray, v0: np.ndarray) -> np.ndarray:
    g = vhat @ v0
    u = vhat - np.outer(g, v0) if vhat.ndim == 2 else vhat - g * v0
    return u / np.maximum(np.linalg.norm(u, axis=-1, keepdims=True), 1e-9)


def raw_stat(d_mean: float, d_min: float) -> float:
    return W_MEAN * d_mean + W_MIN * d_min


def raw_stat_of(idx: list[int], dist: np.ndarray) -> float:
    ds = [dist[idx[a], idx[b]] for a in range(5) for b in range(a + 1, 5)]
    return raw_stat(float(np.mean(ds)), float(np.min(ds)))


def best_constellation(
    dist: np.ndarray,
    domains: np.ndarray,
    rng: np.random.Generator,
    restarts: int = 24,
) -> tuple[list[int], float]:
    """Hill-climb vectorizado priorizando 5 dominios semánticos distintos."""
    m = dist.shape[0]
    best_idx: list[int] = []
    best_val = -1.0
    for _ in range(restarts):
        cur = list(rng.choice(m, size=5, replace=False))
        improved = True
        while improved:
            improved = False
            for slot in range(5):
                fixed = [cur[i] for i in range(5) if i != slot]
                used_doms = {int(domains[i]) for i in fixed}
                fd = [dist[a, b] for ai, a in enumerate(fixed) for b in fixed[ai + 1:]]
                fsum, fmin = float(np.sum(fd)), float(np.min(fd))
                rows = dist[:, fixed]
                means = (fsum + rows.sum(axis=1)) / 10.0
                mins = np.minimum(fmin, rows.min(axis=1))
                vals = W_MEAN * means + W_MIN * mins
                # Pequeño bono por diversidad de dominio para que la constelación ideal cubra 5 mundos
                dom_penalty = np.array([0.04 if int(domains[k]) in used_doms else 0.0 for k in range(m)])
                vals = vals - dom_penalty
                vals[fixed] = -1.0
                j = int(np.argmax(vals))
                cur_val = raw_stat_of(cur, dist)
                if vals[j] > cur_val + 1e-9:
                    cur[slot] = j
                    improved = True
        v = raw_stat_of(cur, dist)
        if v > best_val:
            best_val, best_idx = v, list(cur)
    return best_idx, best_val


def classify_vocab_domains(vhat: np.ndarray, norm_to_idx: dict[str, int]) -> np.ndarray:
    """Asigna a cada palabra (N,) el índice 0..19 del dominio semántico más cercano."""
    centroids = []
    for _label, anchors in DOMAIN_SPECS:
        idxs = [norm_to_idx[normalize_word(a)] for a in anchors if normalize_word(a) in norm_to_idx]
        c = vhat[idxs].mean(axis=0)
        c /= max(np.linalg.norm(c), 1e-9)
        centroids.append(c)
    c_mat = np.vstack(centroids)  # (20, DIM)
    sims = vhat @ c_mat.T  # (N, 20)
    return np.argmax(sims, axis=1).astype(np.uint8)


def build(out_dir: Path, model_name: str) -> None:
    from model2vec import StaticModel

    out_dir.mkdir(parents=True, exist_ok=True)
    extra_bridges = json.loads((ROOT / "data" / "bridges_extra.json").read_text(encoding="utf-8"))

    curated: dict[str, dict] = {}
    for p in PUZZLES_PART_1 + PUZZLES_PART_2:
        words = []
        notes_by_norm: dict[str, tuple[str, str]] = {}
        for s in p["satellites"]:
            main_w, dom_label, _ck, _weights, _tg, aliases, insight = s
            words.append(main_w)
            notes_by_norm[normalize_word(main_w)] = (dom_label, insight.strip())
            for al in aliases:
                words.append(al)
                notes_by_norm.setdefault(normalize_word(al), (dom_label, insight.strip()))
        curated[p["core"]] = {
            "bridges": words,
            "roche": p["roche"],
            "notes": notes_by_norm,
            "subtitle": p.get("subtitle", ""),
            "hint": p.get("hint", ""),
        }

    for core, words in extra_bridges.items():
        notes_extra = {
            normalize_word(k): v for k, v in BRIDGE_INSIGHTS_EXTRA.get(core, {}).items()
        }
        curated[core] = {"bridges": words, "roche": [], "notes": notes_extra, "subtitle": "", "hint": ""}

    extra_words = [c.lower() for c in curated] + [w for v in curated.values() for w in v["bridges"]]
    for _dname, anchors in DOMAIN_SPECS:
        extra_words.extend(anchors)

    clean = set(build_spanish_lexicon({normalize_word(w) for w in extra_words}))
    vocab, ranks = load_vocab(extra_words, clean)
    norms = [normalize_word(w) for w in vocab]
    norm_to_idx = {n: i for i, n in enumerate(norms)}
    clean_mask = np.array([n in clean for n in norms])
    print(f"vocabulario: {len(vocab)} palabras ({int(clean_mask.sum())} verificadas)")

    cache_f = ROOT / "cache" / "raw.npy"
    cache_f.parent.mkdir(exist_ok=True)
    raw = np.load(cache_f) if cache_f.exists() and len(np.load(cache_f)) == len(vocab) else None
    if raw is None:
        print(f"embebiendo con {model_name} ...")
        model = StaticModel.from_pretrained(model_name)
        raw = np.asarray(model.encode(vocab), dtype=np.float32)
        np.save(cache_f, raw)

    logf = np.log1p(np.array([ranks.get(n, 60000) for n in norms], dtype=np.float64))
    logf = (logf - logf.mean()) / logf.std()
    q = whiten_to_int8(raw, logf)
    vhat = unit(q)
    domain_ids = classify_vocab_domains(vhat, norm_to_idx)

    # vocab.bin: cabecera ORBV v2 (10 bytes) + int8[N*DIM] + uint8[N] (domain_ids)
    (out_dir / "vocab.bin").write_bytes(
        struct.pack("<4sBBI", b"ORBV", 2, DIM, len(vocab))
        + q.tobytes(order="C")
        + domain_ids.tobytes(order="C")
    )
    (out_dir / "vocab_words.txt").write_bytes("\n".join(vocab).encode("utf-8"))

    core_pool = []
    curated_norms = {normalize_word(c) for c in curated}
    for w in (ROOT / "data" / "cores_auto.txt").read_text(encoding="utf-8").split():
        n = normalize_word(w)
        if n in norm_to_idx and n not in curated_norms and n not in core_pool:
            core_pool.append(n)
    rng = np.random.default_rng(2026)
    rng.shuffle(core_pool)

    def analyze(core_norm: str):
        ci = norm_to_idx[core_norm]
        v0 = vhat[ci]
        g = vhat @ v0
        g[ci] = -9
        order = np.argsort(-g)
        top20 = float(np.mean(g[order[:20]]))
        return ci, v0, g, order, top20

    hand = list(curated.keys())
    auto: list[str] = []
    for n in core_pool:
        if len(hand) + len(auto) >= SEASON_DAYS:
            break
        if analyze(n)[4] >= 0.34:
            auto.append(n)
    cores = [(c, True) for c in hand] + [(a.upper(), False) for a in auto]
    rng2 = np.random.default_rng(7)
    perm = rng2.permutation(len(cores))
    cores = [cores[i] for i in perm]

    palette = ["#E5A93C", "#2DD4BF", "#A78BFA", "#38BDF8", "#F472B6", "#FB923C", "#34D399", "#F87171"]
    domain_names = [d[0] for d in DOMAIN_SPECS]
    manifest_puzzles = []

    for day, (core_label, _is_curated) in enumerate(cores, start=1):
        core_norm = normalize_word(core_label)
        ci, v0, g, order, _top20 = analyze(core_norm)
        c_info = curated.get(core_label, {})

        roche_idx = {int(i) for i in order[:ROCHE_NEIGHBORS]}
        morph = [i for i in np.argsort(-g)[:400] if is_morphological_derivative(core_norm, norms[int(i)])]
        roche_idx.update(int(i) for i in morph)
        manual_roche = [normalize_word(w) for w in c_info.get("roche", [])]
        for w in manual_roche:
            if w in norm_to_idx:
                roche_idx.add(norm_to_idx[w])
        roche_norms = sorted({norms[i] for i in roche_idx} | set(manual_roche))

        bridges = []
        notes_out: dict[str, list[str]] = {}
        raw_notes: dict[str, tuple[str, str]] = c_info.get("notes", {})
        for w in c_info.get("bridges", []):
            n = normalize_word(w)
            if n in norm_to_idx and norm_to_idx[n] not in roche_idx and norm_to_idx[n] != ci:
                idx_b = norm_to_idx[n]
                bridges.append(idx_b)
                if n in raw_notes:
                    notes_out[str(idx_b)] = [raw_notes[n][0], raw_notes[n][1]]
        bridges = sorted(set(bridges))

        near_order = [int(i) for i in order if clean_mask[int(i)] and int(i) not in roche_idx][:POOL_SIZE]
        tau_near = float(g[near_order[NEAR_RANK - 1]])
        pool = sorted(set(near_order[:POOL_SIZE]) | set(bridges))
        pool_arr = np.array(pool)
        u = tangent(vhat[pool_arr], v0)
        dist = 1.0 - (u @ u.T)
        np.fill_diagonal(dist, 0.0)

        uc = u - u.mean(axis=0, keepdims=True)
        _, _, vt2 = np.linalg.svd(uc, full_matrices=False)
        basis = vt2[:2]
        center2 = u.mean(axis=0) @ basis.T
        tri = np.triu_indices(len(pool), 1)
        pair_d = dist[tri]
        edge = [float(np.percentile(pair_d, 12)), float(np.percentile(pair_d, 65))]

        mc = np.random.default_rng(100 + day)
        samples = np.array([raw_stat_of(list(mc.choice(len(pool), size=5, replace=False)), dist) for _ in range(1800)])

        # Para la constelación maestra priorizamos puentes curados o sustantivos limpios (no verbos/plurales raros)
        bridge_set = set(bridges)
        if len(bridges) >= 12:
            elig = [k for k, i in enumerate(pool) if i in bridge_set]
        else:
            elig = [
                k for k, i in enumerate(pool)
                if (i in bridge_set or g[i] >= tau_near)
                and not norms[i].endswith(VERB_END)
                and not norms[i].endswith("s")
                and ranks.get(norms[i], 99999) <= 22000
            ]
            if len(elig) < 25:
                elig = [k for k, i in enumerate(pool) if i in bridge_set or g[i] >= tau_near]

        sub = dist[np.ix_(elig, elig)]
        elig_doms = np.array([domain_ids[pool[k]] for k in elig])
        best_sub, best_val = best_constellation(sub, elig_doms, mc, restarts=24)
        best_local = [elig[i] for i in best_sub]
        master_global = [pool[i] for i in best_local]

        # Asegurar nota explicativa para las 5 palabras de la constelación maestra
        core_disp = vocab[ci].upper()
        for m_idx in master_global:
            key = str(m_idx)
            if key not in notes_out:
                d_label = domain_names[int(domain_ids[m_idx])]
                w_disp = vocab[m_idx].upper()
                notes_out[key] = [
                    d_label,
                    f"Conecta con {core_disp} desde el campo de {d_label.lower()}, abriendo un eje ortogonal al resto.",
                ]

        anchors = {
            "p01": float(np.percentile(samples, 1)),
            "p10": float(np.percentile(samples, 10)),
            "p50": float(np.percentile(samples, 50)),
            "p90": float(np.percentile(samples, 90)),
            "best": float(max(best_val, np.percentile(samples, 99.5))),
        }
        pid = f"{day:03d}"
        file = f"day_{pid}.json"
        data = {
            "v": 2,
            "id": pid,
            "core": core_disp,
            "coreIdx": ci,
            "accent": palette[day % len(palette)],
            "tauNear": round(tau_near, 5),
            "roche": roche_norms,
            "bridges": bridges,
            "hasBridges": bool(bridges),
            "notes": notes_out,
            "anchors": {k: round(v, 5) for k, v in anchors.items()},
            "master": master_global,
            "basis": [[round(float(x), 4) for x in row] for row in basis],
            "center2": [round(float(x), 4) for x in center2],
            "edge": [round(e, 4) for e in edge],
        }
        (out_dir / file).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest_puzzles.append({"id": pid, "core": data["core"], "file": file, "hasBridges": data["hasBridges"]})

    manifest = {
        "v": 2,
        "epochDate": EPOCH_DATE,
        "tzOffsetMinutes": TZ_OFFSET_MIN,
        "domains": domain_names,
        "scoring": {
            "wMean": W_MEAN,
            "wMin": W_MIN,
            "wDiv": 0.70,
            "wConn": 30,
            "conn": {"bridge": 1.0, "near": 0.70, "far": 0.25},
        },
        "vocab": {"bin": "vocab.bin", "words": "vocab_words.txt", "dim": DIM, "count": len(vocab)},
        "puzzles": manifest_puzzles,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"listo: {len(manifest_puzzles)} dias -> {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT.parent / "web" / "public" / "v2"))
    ap.add_argument("--model", default="minishlab/potion-multilingual-128M")
    args = ap.parse_args()
    build(Path(args.out), args.model)
