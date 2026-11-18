import {
  ActiveSatellite,
  ConstellationTelemetry,
  ImpulseLogEntry,
  LoadedDailyPack,
} from '../core/types';
import { MAX_IMPULSES } from '../store/useOrbitaStore';

export function buildSpoilerFreeShareText(
  pack: LoadedDailyPack,
  satellites: ActiveSatellite[],
  telemetry: ConstellationTelemetry,
  impulseLog: ImpulseLogEntry[],
  mode: 'daily' | 'lab'
): string {
  const header =
    mode === 'daily'
      ? `🪐 ÓRBITA #${pack.meta.id} · ${pack.meta.coreWord}`
      : `🪐 ÓRBITA [Lab] · ${pack.meta.coreWord}`;

  const impulseIcons = Array.from({ length: MAX_IMPULSES }, (_, i) => {
    const entry = impulseLog[i];
    if (!entry) return '·';
    if (entry.outcome === 'ORBIT_CAPTURE') return '◈';
    if (entry.outcome === 'ROCHE_LIMIT') return '🔥';
    if (entry.outcome === 'OUTER_VOID') return '🌌';
    return '↺';
  }).join(' ');

  const collisionLine =
    telemetry.isHarmonicResonance
      ? '✨ Resonancia Armónica (0 colisiones)'
      : telemetry.redFrictionCount === 0
        ? `${satellites.length}/5 satélites · Sin colisiones`
        : `${satellites.length}/5 satélites · ${telemetry.redFrictionCount} ${telemetry.redFrictionCount === 1 ? 'fricción' : 'fricciones'}`;

  return [
    header,
    `Índice Divergente: ${telemetry.score.toFixed(1)} / 100`,
    `Rango: ${telemetry.rank.title}`,
    `${impulseIcons}`,
    collisionLine,
  ].join('\n');
}

/**
 * Renderiza una Carta Astral vertical de alta resolución (1080×1350) sin revelar
 * las palabras de los satélites (solo su geometría semántica exacta, órbitas y enlaces).
 */
export async function renderAstralCardBlob(
  pack: LoadedDailyPack,
  satellites: ActiveSatellite[],
  telemetry: ConstellationTelemetry,
  impulseLog: ImpulseLogEntry[]
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const accent = pack.meta.accent || '#E5A93C';

  // 1. Fondo Obsidiana Profunda + Nebulosa Radial
  ctx.fillStyle = '#040508';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = 640;
  const maxR = 370;
  const rocheR = maxR * 0.25;
  const outerR = maxR * 0.9;

  const neb = ctx.createRadialGradient(cx, cy, 40, cx, cy, outerR * 1.25);
  neb.addColorStop(0, `${accent}26`);
  neb.addColorStop(0.5, 'rgba(16, 185, 129, 0.08)');
  neb.addColorStop(1, 'rgba(4, 5, 8, 0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);

  // Marco doble de latón grabado
  ctx.strokeStyle = 'rgba(229, 169, 60, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, W - 84, H - 84);
  ctx.strokeStyle = 'rgba(244, 240, 234, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(54, 54, W - 108, H - 108);

  // 2. Cabecera Editorial
  ctx.fillStyle = '#E5A93C';
  ctx.font = '600 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`ÓRBITA #${pack.meta.id}  ·  CARTA ASTRAL SIN SPOILERS`, cx, 118);

  ctx.fillStyle = '#FAF8F5';
  ctx.font = '700 68px Georgia, serif';
  ctx.fillText(pack.meta.coreWord, cx, 198);

  ctx.fillStyle = 'rgba(226, 221, 213, 0.65)';
  ctx.font = '400 23px sans-serif';
  ctx.fillText(pack.meta.subtitle, cx, 244);

  // 3. Anillos del Astrolabio
  ctx.strokeStyle = 'rgba(229, 169, 60, 0.28)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();

  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const len = deg % 30 === 0 ? 14 : 6;
    ctx.strokeStyle = deg % 30 === 0 ? 'rgba(229, 169, 60, 0.5)' : 'rgba(244, 240, 234, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * (outerR - len), cy + Math.sin(rad) * (outerR - len));
    ctx.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
    ctx.stroke();
  }

  [0.45, 0.65, 0.8].forEach((r) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 240, 234, 0.1)';
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  ctx.save();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, rocheR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 4. Posiciones y Enlaces de la Constelación (Sin revelar las palabras)
  const pts = satellites.map((s) => ({
    sat: s,
    x: cx + Math.cos(s.displayAngle) * (s.orbitRadiusRatio * maxR),
    y: cy + Math.sin(s.displayAngle) * (s.orbitRadiusRatio * maxR),
  }));
  const mapPts = new Map(pts.map((p) => [p.sat.uid, p]));

  telemetry.edges.forEach((edge) => {
    const a = mapPts.get(edge.uidA);
    const b = mapPts.get(edge.uidB);
    if (!a || !b) return;
    ctx.save();
    if (edge.status === 'resonance') {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.78)';
      ctx.lineWidth = 3.2;
    } else if (edge.status === 'stable') {
      ctx.strokeStyle = 'rgba(226, 221, 213, 0.35)';
      ctx.lineWidth = 2.2;
    } else {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.82)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3.5;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  });

  // Astro central
  ctx.save();
  ctx.fillStyle = '#07090F';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#FAF8F5';
  ctx.font = '700 20px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('w₀', cx, cy + 1);

  // Nodos anónimos (símbolos geométricos)
  pts.forEach(({ sat, x, y }, idx) => {
    ctx.save();
    ctx.fillStyle = '#07090F';
    ctx.strokeStyle = sat.color.hex;
    ctx.lineWidth = 4;
    ctx.shadowColor = sat.color.hex;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = sat.color.hex;
    ctx.font = '700 18px monospace';
    ctx.fillText(`${idx + 1}`, x, y + 1);
  });

  // 5. Bloque Inferior de Telemetría y Puntaje
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(226, 221, 213, 0.6)';
  ctx.font = '600 20px monospace';
  ctx.fillText('ÍNDICE DIVERGENTE', cx, 1068);

  ctx.fillStyle = '#FAF8F5';
  ctx.font = '700 92px monospace';
  ctx.fillText(`${telemetry.score.toFixed(1)}`, cx, 1158);

  ctx.fillStyle = telemetry.rank.badgeColor;
  ctx.font = '700 30px sans-serif';
  ctx.fillText(telemetry.rank.title.toUpperCase(), cx, 1206);

  const track = Array.from({ length: MAX_IMPULSES }, (_, i) => {
    const e = impulseLog[i];
    if (!e) return '○';
    if (e.outcome === 'ORBIT_CAPTURE') return '◈';
    if (e.outcome === 'ROCHE_LIMIT') return '✕';
    if (e.outcome === 'OUTER_VOID') return '◌';
    return '↺';
  }).join('   ');

  ctx.fillStyle = 'rgba(244, 240, 234, 0.72)';
  ctx.font = '600 24px monospace';
  ctx.fillText(track, cx, 1255);

  ctx.fillStyle = 'rgba(229, 169, 60, 0.55)';
  ctx.font = '500 18px monospace';
  ctx.fillText('ÓRBITA · LABORATORIO DIARIO DE PENSAMIENTO DIVERGENTE', cx, 1292);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}
