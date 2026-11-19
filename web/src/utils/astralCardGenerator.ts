import { Satellite, Telemetry } from '../core/types';

const TIER_GLYPH = { bridge: '✦', near: '◈', far: '○' } as const;

export function buildShareText(
  core: string,
  dayNumber: number,
  sats: Satellite[],
  tel: Telemetry,
  practice: boolean
): string {
  const glyphs = sats.map((s) => TIER_GLYPH[s.tier]).join(' ');
  const statusLine =
    tel.frictionCount === 0
      ? '✨ Resonancia Armónica (0 colisiones)'
      : `${tel.frictionCount} ${tel.frictionCount === 1 ? 'fricción' : 'fricciones'}`;
  return [
    `🪐 ÓRBITA ${practice ? '· Lab' : `#${dayNumber}`} — Núcleo: ${core}`,
    `Índice Divergente: ${tel.score.toFixed(1)} / 100 (${tel.rank.title})`,
    `${glyphs} — ${statusLine}`,
  ].join('\n');
}

function drawPosterSatellite(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  x: number,
  y: number,
  orbitR: number,
  angle: number,
  s: Satellite,
  index: number
) {
  // Estela orbital luminosa
  c.save();
  const wake = 0.28;
  const wg = c.createLinearGradient(
    cx + Math.cos(angle - wake) * orbitR,
    cy + Math.sin(angle - wake) * orbitR,
    x,
    y
  );
  wg.addColorStop(0, 'rgba(0,0,0,0)');
  wg.addColorStop(1, `${s.color}88`);
  c.strokeStyle = wg;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(cx, cy, orbitR, angle - wake, angle);
  c.stroke();
  c.restore();

  // Halo
  const halo = c.createRadialGradient(x, y, 4, x, y, 54);
  halo.addColorStop(0, `${s.color}55`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.beginPath();
  c.arc(x, y, 54, 0, Math.PI * 2);
  c.fill();

  // Sonda con paneles solares orientada tangencialmente
  c.save();
  c.translate(x, y);
  c.rotate(angle + Math.PI / 2);

  c.strokeStyle = 'rgba(244, 240, 234, 0.7)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-36, 0);
  c.lineTo(36, 0);
  c.stroke();

  [-1, 1].forEach((dir) => {
    const px = dir === -1 ? -34 : 15;
    c.fillStyle = '#090D18';
    c.strokeStyle = s.color;
    c.lineWidth = 2.6;
    c.beginPath();
    c.roundRect(px, -9, 19, 18, 3);
    c.fill();
    c.stroke();
  });

  c.fillStyle = '#07090F';
  c.strokeStyle = s.color;
  c.lineWidth = 3.5;
  c.shadowColor = s.color;
  c.shadowBlur = 18;
  c.beginPath();
  c.arc(0, 0, 15, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();

  c.fillStyle = '#FAF8F5';
  c.font = '700 16px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`${TIER_GLYPH[s.tier]}${index + 1}`, x, y + 1);
}

/**
 * Renderiza una Carta Astral coleccionable (1080×1350 PNG) con estética de observatorio,
 * sondas espaciales, rosa de astrolabio y barra psicométrica DAT de Harvard (sin revelar palabras).
 */
export async function renderCard(
  core: string,
  dayNumber: number,
  accent: string,
  sats: Satellite[],
  tel: Telemetry
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = 1080;
  const H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return null;

  // 1. Fondo Obsidiana + Doble Nebulosa + Polvo Estelar
  c.fillStyle = '#040508';
  c.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = 575;
  const R = 345;
  const rocheR = R * 0.25;
  const outerR = R * 0.92;

  const neb1 = c.createRadialGradient(cx, cy, 20, cx, cy, R * 1.35);
  neb1.addColorStop(0, `${accent}33`);
  neb1.addColorStop(0.5, 'rgba(45, 212, 191, 0.09)');
  neb1.addColorStop(1, 'rgba(4, 5, 8, 0)');
  c.fillStyle = neb1;
  c.fillRect(0, 0, W, H);

  for (let i = 0; i < 95; i++) {
    const sx = ((Math.sin(i * 19.31) * 43758.5) % 1 + 1) % 1;
    const sy = ((Math.cos(i * 47.17) * 19341.7) % 1 + 1) % 1;
    const sr = 0.8 + (i % 3) * 0.9;
    c.fillStyle = `rgba(244, 240, 234, ${0.12 + (i % 5) * 0.06})`;
    c.beginPath();
    c.arc(sx * W, sy * H, sr, 0, Math.PI * 2);
    c.fill();
  }

  // 2. Marco Astro-Cartográfico Grabado + Cruces de Esquina
  c.strokeStyle = 'rgba(229, 169, 60, 0.34)';
  c.lineWidth = 2;
  c.strokeRect(38, 38, W - 76, H - 76);
  c.strokeStyle = 'rgba(244, 240, 234, 0.1)';
  c.lineWidth = 1;
  c.strokeRect(50, 50, W - 100, H - 100);

  // Coordenadas superiores de observatorio
  c.fillStyle = 'rgba(229, 169, 60, 0.75)';
  c.font = '600 18px "JetBrains Mono", monospace';
  c.textAlign = 'left';
  c.fillText(`OBS. ÓRBITA · DÍA #${String(dayNumber).padStart(3, '0')}`, 76, 88);
  c.textAlign = 'right';
  c.fillText('MODELO DAT HARVARD · SIN SPOILERS', W - 76, 88);

  // Título Central
  c.textAlign = 'center';
  c.fillStyle = '#FAF8F5';
  c.font = '700 68px Georgia, serif';
  c.fillText(core, cx, 168);

  c.fillStyle = 'rgba(226, 221, 213, 0.65)';
  c.font = '500 20px "JetBrains Mono", monospace';
  const uniqueDomains = new Set(sats.map((s) => s.domain)).size;
  c.fillText(
    `${sats.length}/5 SATÉLITES EN ÓRBITA  ·  ${uniqueDomains} DOMINIOS CONECTADOS`,
    cx,
    206
  );

  // 3. Rosa de Astrolabio y Anillos Orbitales
  c.strokeStyle = 'rgba(229, 169, 60, 0.32)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(cx, cy, outerR, 0, Math.PI * 2);
  c.stroke();

  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const isCard = deg % 90 === 0;
    const isMaj = deg % 30 === 0;
    const len = isCard ? 18 : isMaj ? 12 : 6;
    c.strokeStyle = isCard
      ? 'rgba(229, 169, 60, 0.75)'
      : isMaj
        ? 'rgba(244, 240, 234, 0.35)'
        : 'rgba(244, 240, 234, 0.12)';
    c.lineWidth = isCard ? 2 : 1.2;
    c.beginPath();
    c.moveTo(cx + Math.cos(rad) * (outerR - len), cy + Math.sin(rad) * (outerR - len));
    c.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
    c.stroke();
  }

  // Ejes meridianos
  c.strokeStyle = 'rgba(244, 240, 234, 0.08)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx - outerR, cy);
  c.lineTo(cx + outerR, cy);
  c.moveTo(cx, cy - outerR);
  c.lineTo(cx, cy + outerR);
  c.stroke();

  [0.46, 0.68].forEach((r) => {
    c.save();
    c.strokeStyle = 'rgba(244, 240, 234, 0.13)';
    c.setLineDash([5, 10]);
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx, cy, R * r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  });

  // Límite de Roche
  c.save();
  c.strokeStyle = 'rgba(244, 63, 94, 0.52)';
  c.setLineDash([8, 7]);
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(cx, cy, rocheR, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  // 4. Aristas y Sondas Satelitales
  const pts = sats.map((s) => ({
    s,
    orbitR: s.radius * R,
    x: cx + Math.cos(s.angle) * s.radius * R,
    y: cy + Math.sin(s.angle) * s.radius * R,
  }));
  const map = new Map(pts.map((p) => [p.s.uid, p]));

  tel.edges.forEach((e) => {
    const a = map.get(e.a);
    const b = map.get(e.b);
    if (!a || !b) return;
    c.save();
    if (e.status === 'friction') {
      c.strokeStyle = 'rgba(244, 63, 94, 0.86)';
      c.setLineDash([12, 8]);
      c.lineWidth = 3.5;
    } else if (e.status === 'resonance') {
      c.strokeStyle = 'rgba(16, 185, 129, 0.72)';
      c.lineWidth = 3.0;
    } else {
      c.strokeStyle = 'rgba(244, 240, 234, 0.28)';
      c.lineWidth = 2.2;
    }
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.restore();
  });

  // Astro Central
  c.save();
  c.fillStyle = '#07090F';
  c.strokeStyle = accent;
  c.lineWidth = 4;
  c.shadowColor = accent;
  c.shadowBlur = 28;
  c.beginPath();
  c.arc(cx, cy, 44, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();

  c.fillStyle = '#FAF8F5';
  c.font = '700 20px "JetBrains Mono", monospace';
  c.textBaseline = 'middle';
  c.fillText('w₀', cx, cy + 1);

  pts.forEach(({ s, x, y, orbitR }, i) => {
    drawPosterSatellite(c, cx, cy, x, y, orbitR, s.angle, s, i);
  });

  // 5. Panel Inferior de Telemetría Cognitiva (Tarjeta Instrumentada)
  const cardX = 76;
  const cardY = 935;
  const cardW = W - 152;
  const cardH = 315;

  c.save();
  c.fillStyle = 'rgba(13, 17, 28, 0.92)';
  c.strokeStyle = 'rgba(229, 169, 60, 0.35)';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(cardX, cardY, cardW, cardH, 24);
  c.fill();
  c.stroke();
  c.restore();

  // Columna Izquierda: Índice Divergente y Rango
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(226, 221, 213, 0.65)';
  c.font = '600 18px "JetBrains Mono", monospace';
  c.fillText('ÍNDICE DIVERGENTE (DAT)', cardX + 38, cardY + 52);

  c.fillStyle = '#FAF8F5';
  c.font = '700 92px "JetBrains Mono", monospace';
  c.fillText(tel.score.toFixed(1), cardX + 34, cardY + 146);

  c.fillStyle = tel.rank.color;
  c.font = '700 28px sans-serif';
  c.fillText(tel.rank.title.toUpperCase(), cardX + 38, cardY + 188);

  c.fillStyle = 'rgba(226, 221, 213, 0.65)';
  c.font = '500 17px "JetBrains Mono", monospace';
  c.fillText(tel.rank.percentileLabel, cardX + 38, cardY + 218);

  // Barra Psicométrica DAT en la tarjeta
  const barX = cardX + 38;
  const barY = cardY + 258;
  const barW = cardW - 76;
  const barH = 14;

  c.fillStyle = 'rgba(226, 221, 213, 0.55)';
  c.font = '500 15px "JetBrains Mono", monospace';
  c.textAlign = 'left';
  c.fillText('Lineal (50)', barX, barY - 10);
  c.textAlign = 'center';
  c.fillText('Promedio Harvard (78)', barX + barW * 0.78, barY - 10);
  c.textAlign = 'right';
  c.fillStyle = '#2DD4BF';
  c.fillText('Arquitecto (85+)', barX + barW, barY - 10);

  c.fillStyle = '#040508';
  c.beginPath();
  c.roundRect(barX, barY, barW, barH, 7);
  c.fill();

  const fillW = Math.max(18, Math.min(barW, (tel.score / 100) * barW));
  const barGrad = c.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, '#F59E0B');
  barGrad.addColorStop(0.65, '#2DD4BF');
  barGrad.addColorStop(1, '#10B981');
  c.fillStyle = barGrad;
  c.beginPath();
  c.roundRect(barX, barY, fillW, barH, 7);
  c.fill();

  // Marcador vertical de promedio 78%
  c.fillStyle = 'rgba(250, 248, 245, 0.75)';
  c.fillRect(barX + barW * 0.78, barY - 3, 3, barH + 6);

  // Columna Derecha Superior de la Tarjeta: Píldoras de Métricas
  c.textAlign = 'right';
  c.fillStyle = '#E5A93C';
  c.font = '700 28px "JetBrains Mono", monospace';
  const glyphs = sats.map((s) => TIER_GLYPH[s.tier]).join('  ');
  c.fillText(glyphs, cardX + cardW - 38, cardY + 64);

  c.fillStyle = 'rgba(244, 240, 234, 0.85)';
  c.font = '600 19px "JetBrains Mono", monospace';
  c.fillText(
    `Divergencia: ${tel.divergence.toFixed(1)}  ·  Conexión: ${(tel.connection * 100).toFixed(0)}%`,
    cardX + cardW - 38,
    cardY + 112
  );

  const tensionText =
    tel.frictionCount === 0
      ? `✨ 0 colisiones (d mín = ${(tel.closest?.dNorm ?? 0.82).toFixed(2)})`
      : `⚡ ${tel.frictionCount} ${tel.frictionCount === 1 ? 'fricción' : 'fricciones'} (d mín = ${(tel.closest?.dNorm ?? 0.48).toFixed(2)})`;
  c.fillStyle = tel.frictionCount === 0 ? '#34D399' : '#FB7185';
  c.fillText(tensionText, cardX + cardW - 38, cardY + 148);

  // Firma inferior
  c.textAlign = 'center';
  c.fillStyle = 'rgba(229, 169, 60, 0.65)';
  c.font = '600 18px "JetBrains Mono", monospace';
  c.fillText('ÓRBITA  ·  LABORATORIO DIARIO DE PENSAMIENTO DIVERGENTE', cx, 1296);

  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png', 0.95));
}
