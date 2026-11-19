# ÓRBITA v2 — Especificación del motor

## Vocabulario y vectores
- ~24k palabras (frecuencia en español, filtradas) embebidas **offline** con `minishlab/potion-multilingual-128M` (modelo estático, local, sin costo ni GPU).
- Centrado → debias de frecuencia (3 direcciones) → remoción de 6 PCs dominantes → PCA 64D → L2 → int8.
- Un solo archivo `vocab.bin` (`ORBV`, ~1.5 MB) + `vocab_words.txt` sirve a todos los días.

## Un día = un JSON diminuto (`day_NNN.json`)
`coreIdx`, `roche` (derivados + 8 vecinos inmediatos), `bridges` (puentes ocultos), `tauNear`, `anchors`, `master`, `basis`/`center2` (plano del radar) y `edge` (umbrales de fricción).

## Gravedad blanda (nada se rechaza por "lejanía")
Toda palabra real entra. Solo se descarta lo **obvio** (Roche) o lo que no existe en el diccionario, sin costo.

| Conexión | Condición | Valor |
|---|---|---|
| ✦ puente | en la lista de puentes del día (curada / LLM opcional) | 1.00 |
| ◈ cercana | gravedad `g = v̂·v̂₀ ≥ tauNear` (top 400 del universo verificado) | 0.70 |
| ○ lejana | resto | 0.25 |

## Puntaje
Con `u = v̂ − (v̂·v̂₀)v̂₀` normalizado (componente tangente al núcleo) y `d(i,j) = 1 − u_i·u_j`:

```
raw        = 0.90·mean(d) + 0.10·min(d)          (10 pares)
divergence = anchorMap(raw)                      p01→35, p10→55, p50→70, p90→85, óptimo→97
connection = mean(valor de conexión) / (1 si hay puentes, 0.70 si no)
score      = 0.70·divergence + 30·connection
```
Las anclas se calculan por día con 4000 jugadas aleatorias del universo + un óptimo (hill-climb), de modo que **70 ≈ jugada al azar y 85+ ≈ muy superior**, comparable entre días.

## Ranking
`POST /api/leaderboard` recibe los 5 índices de palabras y **recalcula el puntaje en el servidor** con este mismo motor; el puntaje del cliente se ignora. Una entrada por jugador y día (`ZADD NX`).
