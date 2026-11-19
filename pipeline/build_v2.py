"""
ÓRBITA v2 — Motor vectorial real + universo aleatorio diario.

Diseño ("Gravedad Blanda"):
  1. Un único vocabulario global (~24k palabras) embebido con un modelo estático local
     (model2vec potion-multilingual-128M, 0 USD, sin GPU), blanqueado y cuantizado a int8 x 64D.
     Se descarga UNA vez (inmutable en CDN) y sirve para todos los días.
  2. Cada día es un JSON diminuto: índice del núcleo, puentes ocultos, límite de Roche, anclas de
     puntaje y constelación maestra. El cliente calcula todo lo demás en < 5 ms.
  3. Nada se rechaza por "falta de gravedad": toda palabra real entra y la conexión pesa 15% del
     puntaje (puente ✦ 1.0 · cercana ◈ 0.75 · lejana ○ 0.30). Solo el límite de Roche (obvio) rechaza.
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
NEAR_RANK = 400           # las N palabras mas cercanas al nucleo (universo verificado) son "cercanas"
ROCHE_NEIGHBORS = 8       # vecinos inmediatos = demasiado obvios
POOL_SIZE = 1500          # universo para anclas y constelacion maestra
SEASON_DAYS = 60
EPOCH_DATE = "2026-11-18"
TZ_OFFSET_MIN = -300      # America/Bogota

STOP = set("""
para como pero porque cuando donde desde entre hasta sobre tambien aunque mientras segun sino
este esta esto estos estas ese esa eso esos esas aquel aquella nada algo todo toda todos todas
cada otro otra otros otras mismo misma mas menos muy tan tanto bien mal aqui alli ahora luego
antes despues siempre nunca quiza tal vez entonces ademas todavia apenas casi solo solamente
cual cuales quien quienes cuyo cuya donde adonde cuanto cuanta que con sin por ante bajo tras
mio mia tuyo tuya suyo suya nuestro nuestra vuestro vuestra ellos ellas nosotros vosotros usted
ustedes dijo dice digo hace hizo hago esta estan estoy estas esta eres soy somos fue fui era
""".split())

VERB_END = ("ar", "er", "ir", "ado", "ido", "ando", "iendo", "mente", "aba", "ian", "ara", "ase")


def looks_spanish(n: str) -> bool:
    """Ortotactica basica para descartar ingles y ruido de subtitulos en el vocabulario general."""
    if re.search(r"[kw]|th|sh|ck|gh|ou|oo|ee|tt|ss|ff|pp|ng$", n):
        return False
    return n[-1] in "aeiounslrdzjxy"


def load_vocab(extra_words: list[str], clean: set[str]) -> tuple[list[str], dict[str, int]]:
    """Vocabulario global limpio: (display, rank de frecuencia)."""
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
    """Centrado + debias de frecuencia (3 direcciones) + remocion de 6 PCs dominantes + PCA 64D + L2 + int8.

    El debias de frecuencia evita que las palabras raras (cuyo vector es un promedio de subpalabras)
    colapsen en una misma region y parezcan 'parecidas' entre si.
    """
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
    """u = v - (v.v0)v0, normalizado. Identico en el cliente (orbitalEngine.ts)."""
    g = vhat @ v0
    u = vhat - np.outer(g, v0) if vhat.ndim == 2 else vhat - g * v0
    return u / np.maximum(np.linalg.norm(u, axis=-1, keepdims=True), 1e-9)


W_MEAN, W_MIN = 0.90, 0.10   # peso del promedio y del "eslabon debil" en el puntaje


def raw_stat(d_mean: float, d_min: float) -> float:
    return W_MEAN * d_mean + W_MIN * d_min


def best_constellation(dist: np.ndarray, rng: np.random.Generator, restarts: int = 40) -> tuple[list[int], float]:
    """Hill-climb vectorizado: reemplaza un satelite a la vez por el mejor candidato."""
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
                fd = [dist[a, b] for ai, a in enumerate(fixed) for b in fixed[ai + 1:]]
                fsum, fmin = float(np.sum(fd)), float(np.min(fd))
                rows = dist[:, fixed]
                means = (fsum + rows.sum(axis=1)) / 10.0
                mins = np.minimum(fmin, rows.min(axis=1))
                vals = W_MEAN * means + W_MIN * mins
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


def raw_stat_of(idx: list[int], dist: np.ndarray) -> float:
    ds = [dist[idx[a], idx[b]] for a in range(5) for b in range(a + 1, 5)]
    return raw_stat(float(np.mean(ds)), float(np.min(ds)))


def build(out_dir: Path, model_name: str) -> None:
    from model2vec import StaticModel

    out_dir.mkdir(parents=True, exist_ok=True)
    extra_bridges = json.loads((ROOT / "data" / "bridges_extra.json").read_text(encoding="utf-8"))

    # Fuentes de puentes: puzzles curados (satelites + alias) y bridges_extra
    curated: dict[str, dict] = {}
    for p in PUZZLES_PART_1 + PUZZLES_PART_2:
        words = []
        for s in p["satellites"]:
            words.append(s[0])
            words.extend(s[5])
        curated[p["core"]] = {"bridges": words, "roche": p["roche"]}
    for core, words in extra_bridges.items():
        curated[core] = {"bridges": words, "roche": []}

    extra_words = [c.lower() for c in curated] + [w for v in curated.values() for w in v["bridges"]]
    clean = set(build_spanish_lexicon({normalize_word(w) for w in extra_words}))
    vocab, ranks = load_vocab(extra_words, clean)
    norms = [normalize_word(w) for w in vocab]
    norm_to_idx = {n: i for i, n in enumerate(norms)}
    clean_mask = np.array([n in clean for n in norms])
    print(f"vocabulario: {len(vocab)} palabras ({int(clean_mask.sum())} verificadas para el universo de juego)")

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

    (out_dir / "vocab.bin").write_bytes(
        struct.pack("<4sBBI", b"ORBV", 2, DIM, len(vocab)) + q.tobytes(order="C")
    )
    (out_dir / "vocab_words.txt").write_bytes("\n".join(vocab).encode("utf-8"))

    # Pool de nucleos automaticos: lista editorial de sustantivos evocadores + filtro de vecindad
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
    manifest_puzzles = []
    for day, (core_label, is_curated) in enumerate(cores, start=1):
        core_norm = normalize_word(core_label)
        ci, v0, g, order, top20 = analyze(core_norm)

        # Roche: derivados morfologicos + vecinos inmediatos + lista curada
        roche_idx = {int(i) for i in order[:ROCHE_NEIGHBORS]}
        morph = [i for i in np.argsort(-g)[:400] if is_morphological_derivative(core_norm, norms[int(i)])]
        roche_idx.update(int(i) for i in morph)
        manual_roche = [normalize_word(w) for w in curated.get(core_label, {}).get("roche", [])]
        for w in manual_roche:
            if w in norm_to_idx:
                roche_idx.add(norm_to_idx[w])
        roche_norms = sorted({norms[i] for i in roche_idx} | set(manual_roche))

        bridges = []
        for w in curated.get(core_label, {}).get("bridges", []):
            n = normalize_word(w)
            if n in norm_to_idx and norm_to_idx[n] not in roche_idx and norm_to_idx[n] != ci:
                bridges.append(norm_to_idx[n])
        bridges = sorted(set(bridges))

        near_order = [int(i) for i in order if clean_mask[int(i)] and int(i) not in roche_idx][:POOL_SIZE]
        tau_near = float(g[near_order[NEAR_RANK - 1]])
        pool = sorted(set(near_order[:POOL_SIZE]) | set(bridges))
        pool_arr = np.array(pool)
        u = tangent(vhat[pool_arr], v0)
        dist = 1.0 - (u @ u.T)
        np.fill_diagonal(dist, 0.0)

        # Plano 2D del radar: dos ejes principales de la nube tangente del pool
        uc = u - u.mean(axis=0, keepdims=True)
        _, _, vt2 = np.linalg.svd(uc, full_matrices=False)
        basis = vt2[:2]
        center2 = u.mean(axis=0) @ basis.T
        tri = np.triu_indices(len(pool), 1)
        pair_d = dist[tri]
        edge = [float(np.percentile(pair_d, 12)), float(np.percentile(pair_d, 65))]

        # Anclas por Monte Carlo sobre jugadas aleatorias del pool + optimo
        mc = np.random.default_rng(100 + day)
        samples = []
        for _ in range(4000):
            ix = mc.choice(len(pool), size=5, replace=False)
            samples.append(raw_stat_of(list(ix), dist))
        samples = np.array(samples)
        bridge_set = set(bridges)
        elig = [k for k, i in enumerate(pool) if i in bridge_set or g[i] >= tau_near]
        sub = dist[np.ix_(elig, elig)]
        best_sub, best_val = best_constellation(sub, mc)
        best_local = [elig[i] for i in best_sub]
        anchors = {
            "p01": float(np.percentile(samples, 1)), "p10": float(np.percentile(samples, 10)),
            "p50": float(np.percentile(samples, 50)), "p90": float(np.percentile(samples, 90)),
            "best": float(best_val),
        }
        pid = f"{day:03d}"
        file = f"day_{pid}.json"
        data = {
            "v": 2, "id": pid, "core": vocab[ci].upper(),
            "coreIdx": ci, "accent": palette[day % len(palette)], "tauNear": round(tau_near, 5),
            "roche": roche_norms, "bridges": bridges, "hasBridges": bool(bridges),
            "anchors": {k: round(v, 5) for k, v in anchors.items()},
            "master": [pool[i] for i in best_local],
            "basis": [[round(float(x), 4) for x in row] for row in basis],
            "center2": [round(float(x), 4) for x in center2],
            "edge": [round(e, 4) for e in edge],
        }
        (out_dir / file).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest_puzzles.append({"id": pid, "core": data["core"], "file": file, "hasBridges": data["hasBridges"]})
        print(f"  #{pid} {data['core']:<12} puentes={len(bridges):2d} roche={len(roche_norms):3d} "
              f"tau={tau_near:.2f} p50={anchors['p50']:.3f} best={anchors['best']:.3f}")

    manifest = {
        "v": 2, "epochDate": EPOCH_DATE, "tzOffsetMinutes": TZ_OFFSET_MIN,
        "scoring": {"wMean": W_MEAN, "wMin": W_MIN, "wDiv": 0.70, "wConn": 30,
                    "conn": {"bridge": 1.0, "near": 0.70, "far": 0.25}},
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
