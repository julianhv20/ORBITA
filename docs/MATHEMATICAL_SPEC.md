# Especificación Matemática y Formato Binario — ÓRBITA v1.0

## 1. Modelo Vectorial en el Subespacio Tangente ($\hat{v}_0^\perp$)

Sea $\hat{v}_0 \in S^{d-1}$ el vector unitario isotrópico (tras *All-but-the-Top SVD Whitening*) de la **Palabra Núcleo** $w_0$, y sea $\hat{v}_i \in S^{d-1}$ el vector unitario de un candidato $w_i$.

### 1.1 Afinidad Gravitacional y Banda de Habitabilidad
Definimos la gravedad escalar $g_i = \hat{v}_0 \cdot \hat{v}_i$. Una palabra $w_i$ alcanza órbita estable si:
1. No pertenece al conjunto de colapso morfológico/funcional $\mathcal{R}(w_0)$ (**Límite de Roche**).
2. Supera el umbral de captura gravitacional: $g_i \ge \tau_{\min}(w_0)$ (de lo contrario escapa al **Vacío Exterior**).

### 1.2 Proyección Residual Ortogonal (Eliminación de Afinidad Compartida)
Todo vector $\hat{v}_i$ admite la descomposición ortogonal exacta:

$$\hat{v}_i = g_i \hat{v}_0 + \sqrt{1 - g_i^2}\,\hat{u}_i, \qquad \hat{u}_i \perp \hat{v}_0, \quad \|\hat{u}_i\|_2 = 1$$

donde la dirección de bisociación pura viene dada por:

$$\vec{r}_i = \hat{v}_i - (\hat{v}_i \cdot \hat{v}_0)\hat{v}_0, \qquad \hat{u}_i = \frac{\vec{r}_i}{\|\vec{r}_i\|_2}$$

La **Distancia Divergente Tangencial** entre cualquier par de satélites $(w_i, w_j)$ se define como una métrica angular normalizada en $[0, 1]$:

$$d_\perp(w_i, w_j) = \text{clamp}_{[0.05,\, 0.99]}\!\left(\frac{1 - (\hat{u}_i \cdot \hat{u}_j)}{1.25}\cdot \alpha + (1 - \alpha)\bigl(1 - \max(0, \hat{u}_i \cdot \hat{u}_j)\bigr)\right)$$

calibrada para que pares del mismo subdominio caigan en $[0.15, 0.52]$ (fricción roja $< 0.58$), dominios moderadamente distintos en $[0.58, 0.76]$, y bisociaciones ortogonales/opuestas alcancen $[0.78, 0.96]$.

### 1.3 Índice Divergente de la Constelación ($N = 5$ satélites, $10$ pares)
Para evitar que un par duplicado se esconda detrás del promedio aritmético, combinamos la media de los 10 pares con el par más cercano (eslabón débil):

$$S_{\text{raw}} = \left( 0.78 \cdot \frac{1}{10}\sum_{1 \le i < j \le 5} d_\perp(w_i, w_j) + 0.22 \cdot \min_{1 \le i < j \le 5} d_\perp(w_i, w_j) \right) \times 100$$

y aplicamos calibración suave respecto al óptimo teórico diario $S_{\max}(w_0)$ hallado por *Simulated Annealing*.

---

## 2. Especificación Binaria `ORBT` v1 (`daily_<slug>.bin`)

Archivo binario *little-endian* diseñado para lectura directa mediante `DataView`, `Float32Array` e `Int8Array` sin parseo JSON de matrices:

| Offset (Bytes) | Tipo | Descripción |
| :--- | :--- | :--- |
| `0..3` | `char[4]` | Magic header ASCII `'ORBT'` (`0x4F 0x52 0x42 0x54`) |
| `4` | `uint8` | Versión de protocolo (`1`) |
| `5` | `uint8` | Dimensión residual `D` (`128`) |
| `6..7` | `uint16` | Total de candidatos orbitales `M` |
| `8..11` | `float32` | Umbral gravitacional $\tau_{\min}$ |
| `12..15` | `float32` | Puntaje Óptimo Diario $S_{\max}$ |
| `16 .. 16 + 8*M - 1` | `float32[2*M]` | Pares intercalados `[gravity_i, angleRad_i]` para $i \in [0, M-1]$ |
| `16 + 8*M .. fin` | `int8[M * D]` | Matriz fila-mayor de vectores residuales $\hat{u}_i$ cuantizados en `[-127, 127]` |
