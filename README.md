# ÓRBITA — Laboratorio Diario de Pensamiento Divergente

**ÓRBITA** es un juego web diario de optimización creativa inspirado en el **Divergent Association Task (DAT)** de la Universidad de Harvard (Olson et al., 2021) y la teoría de la **Bisociación** de Arthur Koestler.

El jugador dispone de **8 Impulsos Orbitales** para estabilizar **5 conceptos** alrededor de una **Palabra Núcleo ($w_0$)**, equilibrando afinidad gravitacional real con el centro y máxima distancia conceptual en el hiperplano tangente $\hat{v}_0^\perp$.

---

## Arquitectura del Monorepo (Costo `$0` / Latencia `< 0.1 ms`)

- `pipeline/` — Motor offline determinista en Python (`NumPy` SVD *Isotropic Whitening*, Proyección Residual Ortogonal $\hat{u}_i \in \hat{v}_0^\perp$, Solver *Simulated Annealing* para hallar la Constelación Maestra diaria y compilador binario `ORBT` v1 de `< 50 KB` por puzzle).
- `web/` — Aplicación PWA Mobile-First en **Next.js + TypeScript + Tailwind CSS + Zustand**, renderizador astronómico **HTML5 Canvas 60fps**, sintetizador espacial procedural **Web Audio API 2.0** (Reverb algorítmica + escala Lidia) y generador de **Carta Astral PNG (`1080×1350`)** sin spoilers.
- `docs/` — Especificación matemática y protocolo binario ([MATHEMATICAL_SPEC.md](docs/MATHEMATICAL_SPEC.md)).
- `legacy/` — Respaldo del prototipo HTML inicial y documento conceptual original.

---

## Comandos Rápidos

```bash
# 1. Recompilar paquetes diarios (.bin + .json) y ejecutar suite psicométrica
npm run test:etl

# 2. Instalar dependencias web y levantar servidor de desarrollo
npm install
npm run dev

# 3. Verificar tipos TypeScript y generar exportación estática (web/out/)
npm run typecheck
npm run build
```

## Despliegue Edge Gratuito

El proyecto exporta una aplicación 100% estática en `web/out/`:
- **Vercel:** Detecta automáticamente `vercel.json` en la raíz con cabeceras `immutable` para los vectores binarios.
- **Cloudflare Pages:** Configura `Build command: npm run build` y `Build output directory: web/out` (incluye `web/public/_headers`).
