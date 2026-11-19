import { Satellite, Telemetry } from '../core/types';

const TIER_GLYPH = { bridge: '✦', near: '◈', far: '○' } as const;

export function buildShareText(core: string, dayNumber: number, sats: Satellite[], tel: Telemetry, practice: boolean): string {
  const glyphs = sats.map((s) => TIER_GLYPH[s.tier]).join(' ');
  return [
    `🪐 ÓRBITA ${practice ? '· práctica' : `#${dayNumber}`} · ${core}`,
    `${tel.score.toFixed(1)} / 100 · ${tel.rank.title}`,
    glyphs,
    tel.frictionCount === 0 ? 'Sin colisiones' : `${tel.frictionCount} ${tel.frictionCount === 1 ? 'colisión' : 'colisiones'}`,
  ].join('\n');
}

/** Carta cuadrada sin spoilers: solo geometria, colores y puntaje. */
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

  c.fillStyle = '#040508';
  c.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = 600;
  const R = 380;
  const g = c.createRadialGradient(cx, cy, 20, cx, cy, R * 1.3);
  g.addColorStop(0, `${accent}2e`);
  g.addColorStop(1, 'rgba(4,5,8,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  c.textAlign = 'center';
  c.fillStyle = '#E5A93C';
  c.font = '600 24px monospace';
  c.fillText(`ÓRBITA  ·  DÍA ${dayNumber}`, cx, 120);
  c.fillStyle = '#FAF8F5';
  c.font = '64px Georgia, serif';
  c.fillText(core, cx, 200);

  [0.5, 0.8].forEach((r) => {
    c.strokeStyle = 'rgba(244,240,234,0.12)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, R * r, 0, Math.PI * 2);
    c.stroke();
  });

  const pts = sats.map((s) => ({ s, x: cx + Math.cos(s.angle) * s.radius * R, y: cy + Math.sin(s.angle) * s.radius * R }));
  const map = new Map(pts.map((p) => [p.s.uid, p]));
  tel.edges.forEach((e) => {
    const a = map.get(e.a);
    const b = map.get(e.b);
    if (!a || !b) return;
    c.save();
    c.lineWidth = 3;
    if (e.status === 'friction') {
      c.strokeStyle = 'rgba(244,63,94,0.85)';
      c.setLineDash([12, 9]);
    } else c.strokeStyle = e.status === 'resonance' ? 'rgba(45,212,191,0.7)' : 'rgba(244,240,234,0.25)';
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.restore();
  });

  c.fillStyle = '#07090F';
  c.strokeStyle = accent;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(cx, cy, 46, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  pts.forEach(({ s, x, y }) => {
    c.fillStyle = '#07090F';
    c.strokeStyle = s.color;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(x, y, 20, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = s.color;
    c.font = '700 20px monospace';
    c.textBaseline = 'middle';
    c.fillText(TIER_GLYPH[s.tier], x, y + 1);
  });

  c.textBaseline = 'alphabetic';
  c.fillStyle = '#FAF8F5';
  c.font = '700 110px monospace';
  c.fillText(tel.score.toFixed(1), cx, 1150);
  c.fillStyle = tel.rank.color;
  c.font = '700 32px sans-serif';
  c.fillText(tel.rank.title.toUpperCase(), cx, 1204);
  c.fillStyle = 'rgba(229,169,60,0.6)';
  c.font = '500 20px monospace';
  c.fillText('orbita · pensamiento divergente diario', cx, 1290);

  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png', 0.95));
}
