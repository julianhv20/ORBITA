"""Exploracion: que blanqueado separa mejor palabras raras entre si (problema de colapso por subpalabras)."""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_v2 as b
from src.text_norm import normalize_word

cache = b.ROOT / "cache"
cache.mkdir(exist_ok=True)
curated_words = ["reloj", "arena", "dalí", "circadiano", "cesio", "ajedrez", "péndulo", "cuco", "surrealismo",
                 "pulsera", "muñeca", "hora", "minuto", "elefante", "tostadora", "zapato", "ventilador", "cuaderno",
                 "playa", "perro", "gato", "madrid", "barcelona", "rojo", "azul", "corazón", "campana", "londres"]
vocab, ranks = b.load_vocab(curated_words)
f = cache / "raw.npy"
raw = np.load(f) if f.exists() and len(np.load(f)) == len(vocab) else None
if raw is None:
    from model2vec import StaticModel
    m = StaticModel.from_pretrained("minishlab/potion-multilingual-128M")
    raw = np.asarray(m.encode(vocab), dtype=np.float32)
    np.save(f, raw)
norm_idx = {normalize_word(w): i for i, w in enumerate(vocab)}
print("vocab", len(vocab), "raw", raw.shape)


logf = np.log1p(np.array([ranks.get(normalize_word(w), 60000) for w in vocab], dtype=np.float64))
logf = (logf - logf.mean()) / logf.std()


def transform(raw, k, exp, dim, freq=0):
    x = raw.astype(np.float64)
    x -= x.mean(0, keepdims=True)
    for _ in range(freq):  # remover direccion(es) de frecuencia/rareza por regresion
        w = x.T @ logf
        w /= np.linalg.norm(w)
        x -= np.outer(x @ w, w)
        logf_res = logf - (x @ w) * 0  # (la direccion ya fue eliminada)
    sub = x[:: max(1, len(x) // 12000)]
    if k:
        _, _, vt = np.linalg.svd(sub, full_matrices=False)
        top = vt[:k]
        x -= (x @ top.T) @ top
        sub = x[:: max(1, len(x) // 12000)]
    _, s, vt = np.linalg.svd(sub, full_matrices=False)
    x = (x @ vt[:dim].T) / np.power(s[:dim] + 1e-6, exp)
    x /= np.maximum(np.linalg.norm(x, axis=1, keepdims=True), 1e-9)
    return x


def tcos(x, core, a, bb):
    v0 = x[norm_idx[core]]

    def t(w):
        v = x[norm_idx[w]]
        u = v - (v @ v0) * v0
        return u / np.linalg.norm(u)

    return float(t(a) @ t(bb))


sets = {
    "creativa": ["arena", "dali", "circadiano", "cesio", "ajedrez"],
    "lineal": ["pulsera", "muñeca", "hora", "minuto", "campana"],
    "comunes": ["elefante", "tostadora", "zapato", "ventilador", "cuaderno"],
}
similar = [("hora", "minuto"), ("perro", "gato"), ("rojo", "azul"), ("madrid", "barcelona"), ("pulsera", "muñeca")]
for k, exp, dim, fr in [(2, 0.30, 64, 0), (2, 0.30, 64, 1), (6, 0.6, 64, 1), (6, 0.6, 64, 3), (10, 0.6, 64, 3), (10, 0.8, 96, 3)]:
    x = transform(raw, k, exp, dim, fr)
    out = []
    for name, ws in sets.items():
        cs = [tcos(x, "reloj", ws[i], ws[j]) for i in range(5) for j in range(i + 1, 5)]
        out.append(f"{name}=mean{np.mean(cs):+.3f}/max{np.max(cs):+.2f}")
    sim = np.mean([tcos(x, "reloj", a, c) for a, c in similar])
    print(f"k={k:2d} exp={exp:.1f} dim={dim} freq={fr}: " + " ".join(out) + f" | similares={sim:+.3f} dali-cesio={tcos(x,'reloj','dali','cesio'):+.2f}")
