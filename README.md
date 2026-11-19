# ÓRBITA — Juego diario de pensamiento divergente

Escribe 5 palabras conectadas con una palabra núcleo, cada una desde un mundo distinto. Basado en el Divergent Association Task (Harvard, 2021).

```
pipeline/   ETL offline (Python + model2vec): vocabulario, vectores, 60 días aleatorios
web/        Next.js estático (Canvas + Web Audio), motor de puntaje en el cliente
api/        Función Vercel del ranking (Upstash Redis, puntaje verificado en servidor)
docs/       Especificación del motor
```

## Comandos
```bash
pip install numpy model2vec         # una vez
npm install
npm run etl                         # regenera web/public/v2 (vocab + 60 días)
npm run test:sim                    # simulación de jugabilidad con el motor real
npm run dev                         # desarrollo
npm run build                       # export estático en web/out
```

## Ranking global
Requiere una base Upstash Redis (plan gratuito). Variables: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (o `KV_REST_API_URL` / `KV_REST_API_TOKEN`, que crea la integración de Vercel). Sin ellas el juego funciona y el historial local sigue activo.

## Puentes ocultos con LLM (opcional)
`pipeline/data/bridges_extra.json` y `pipeline/src/puzzles_part*.py` aportan puentes curados. Para días automáticos sin puentes se puede generar una lista por núcleo con cualquier LLM (≈ \$0.002/día) y añadirla a ese JSON antes de `npm run etl`.
