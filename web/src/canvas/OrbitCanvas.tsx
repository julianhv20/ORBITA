'use client';

import React, { useEffect, useRef } from 'react';
import { useOrbitaStore } from '../store/useOrbitaStore';
import { Edge, Satellite } from '../core/types';

interface Burst {
  kind: 'roche' | 'capture';
  x: number;
  y: number;
  at: number;
  color: string;
  parts: { vx: number; vy: number; s: number }[];
}

const STARS = Array.from({ length: 75 }, (_, i) => ({
  x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
  y: (Math.sin(i * 78.233) * 12543.1234) % 1,
  s: 0.4 + (i % 4) * 0.35,
  v: 0.003 + (i % 5) * 0.002,
  p: i * 0.9,
}));

/**
 * Dibuja un satélite espacial estilizado (sonda astro-cartográfica con paneles solares,
 * estela orbital curva y núcleo según su tipo de conexión).
 */
function drawSatelliteCraft(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  x: number,
  y: number,
  orbitR: number,
  angle: number,
  sat: Satellite,
  selected: boolean,
  timeSec: number
) {
  // 1. Estela curva orbital detrás del satélite
  c.save();
  const wakeArc = 0.24;
  const wakeGrad = c.createLinearGradient(
    cx + Math.cos(angle - wakeArc) * orbitR,
    cy + Math.sin(angle - wakeArc) * orbitR,
    x,
    y
  );
  wakeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  wakeGrad.addColorStop(1, `${sat.color}66`);
  c.strokeStyle = wakeGrad;
  c.lineWidth = selected ? 2.2 : 1.4;
  c.beginPath();
  c.arc(cx, cy, orbitR, angle - wakeArc, angle);
  c.stroke();
  c.restore();

  // 2. Halo energético del satélite
  const haloR = selected ? 28 : 22;
  const sg = c.createRadialGradient(x, y, 2, x, y, haloR);
  sg.addColorStop(0, `${sat.color}48`);
  sg.addColorStop(0.6, `${sat.color}14`);
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg;
  c.beginPath();
  c.arc(x, y, haloR, 0, Math.PI * 2);
  c.fill();

  // 3. Cuerpo del satélite orientado tangencialmente a su órbita
  c.save();
  c.translate(x, y);
  c.rotate(angle + Math.PI / 2);

  // Retícula giratoria si está seleccionado
  if (selected) {
    c.save();
    c.rotate(timeSec * 0.9);
    c.strokeStyle = sat.color;
    c.lineWidth = 1.1;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.arc(0, 0, 15, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Eje / mástil transversal de los paneles solares
  const wingSpan = sat.tier === 'bridge' ? 15 : sat.tier === 'near' ? 13 : 10.5;
  c.strokeStyle = 'rgba(244, 240, 234, 0.55)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-wingSpan, 0);
  c.lineTo(wingSpan, 0);
  c.stroke();

  // Alas / Paneles Solares Izquierdo y Derecho
  const panelW = sat.tier === 'bridge' ? 6.5 : 5.5;
  const panelH = sat.tier === 'bridge' ? 4.4 : 3.8;
  const innerGap = 5.8;

  [-1, 1].forEach((dir) => {
    const px = dir === -1 ? -innerGap - panelW : innerGap;
    const py = -panelH / 2;
    c.fillStyle = '#090D18';
    c.strokeStyle = sat.color;
    c.lineWidth = 1.15;
    c.beginPath();
    c.roundRect(px, py, panelW, panelH, 1.2);
    c.fill();
    c.stroke();

    // Sub-celda solar interna
    c.strokeStyle = `${sat.color}66`;
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(px + panelW / 2, py);
    c.lineTo(px + panelW / 2, py + panelH);
    c.stroke();
  });

  // Antena frontal apuntando en dirección de vuelo
  c.strokeStyle = 'rgba(244, 240, 234, 0.65)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, -4.5);
  c.lineTo(0, -8.5);
  c.stroke();
  c.fillStyle = sat.color;
  c.beginPath();
  c.arc(0, -8.8, 1.3, 0, Math.PI * 2);
  c.fill();

  // Chasis central (Rombo dorado para Puente ✦, Hexágono/Cápsula para Cercana ◈, Disco para Lejana ○)
  c.fillStyle = '#07090F';
  c.strokeStyle = sat.color;
  c.lineWidth = selected ? 2.2 : 1.7;
  c.shadowColor = sat.color;
  c.shadowBlur = selected ? 12 : 6;

  if (sat.tier === 'bridge') {
    const r = 5.6;
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(r, 0);
    c.lineTo(0, r);
    c.lineTo(-r, 0);
    c.closePath();
    c.fill();
    c.stroke();
  } else {
    c.beginPath();
    c.arc(0, 0, 4.8, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // Núcleo luminoso interior
  c.shadowBlur = 0;
  c.fillStyle = sat.color;
  c.beginPath();
  c.arc(0, 0, sat.tier === 'bridge' ? 2.2 : 1.8, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

export const OrbitCanvas: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const live = useRef({
    core: '',
    accent: '#E5A93C',
    sats: [] as Satellite[],
    edges: [] as Edge[],
    probe: null as ReturnType<typeof useOrbitaStore.getState>['probe'],
    selected: null as string | null,
    resonant: false,
  });
  const bursts = useRef<Burst[]>([]);
  const shakeUntil = useRef(0);
  const anim = useRef(new Map<string, { r: number; a: number }>());
  const hits = useRef<{ uid: string; x: number; y: number }[]>([]);
  const lastFx = useRef(0);

  const ctxGame = useOrbitaStore((s) => s.ctx);
  const sats = useOrbitaStore((s) => s.satellites);
  const telemetry = useOrbitaStore((s) => s.telemetry);
  const probe = useOrbitaStore((s) => s.probe);
  const selected = useOrbitaStore((s) => s.selectedUid);
  const fx = useOrbitaStore((s) => s.fx);
  const setSelected = useOrbitaStore((s) => s.setSelected);

  useEffect(() => {
    live.current = {
      core: ctxGame?.day.core ?? '',
      accent: ctxGame?.day.accent ?? '#E5A93C',
      sats,
      edges: telemetry.edges,
      probe,
      selected,
      resonant: telemetry.isResonant,
    };
  }, [ctxGame, sats, telemetry, probe, selected]);

  useEffect(() => {
    if (!fx || fx.id === lastFx.current || !wrapRef.current) return;
    lastFx.current = fx.id;
    const r = wrapRef.current.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    const maxR = Math.min(r.width, r.height) * 0.44;
    const mk = (n: number, sp: number) =>
      Array.from({ length: n }, () => {
        const a = Math.random() * Math.PI * 2;
        const v = sp * (0.4 + Math.random());
        return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 1 + Math.random() * 2 };
      });
    if (fx.kind === 'roche') {
      shakeUntil.current = performance.now() + 260;
      bursts.current.push({ kind: 'roche', x: cx, y: cy, at: performance.now(), color: '#F43F5E', parts: mk(22, 90) });
    } else if (fx.kind === 'capture') {
      const s = useOrbitaStore.getState().satellites.slice(-1)[0];
      if (s) {
        bursts.current.push({
          kind: 'capture',
          x: cx + Math.cos(s.angle) * s.radius * maxR,
          y: cy + Math.sin(s.angle) * s.radius * maxR,
          at: performance.now(),
          color: s.color,
          parts: mk(14, 48),
        });
      }
    }
  }, [fx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    let w = 1;
    let h = 1;
    let raf = 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = reduce ? 0 : now / 1000;
      const L = live.current;
      c.clearRect(0, 0, w, h);

      c.save();
      if (now < shakeUntil.current) {
        const k = ((shakeUntil.current - now) / 260) * 3;
        c.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
      }

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.44;
      const rocheR = maxR * 0.24;
      const outerR = maxR * 0.86;

      // 1. Estrellas con deriva lenta
      for (const s of STARS) {
        const px = (((s.x + t * s.v) % 1) + 1) % 1;
        const py = (((s.y + t * s.v * 0.4) % 1) + 1) % 1;
        c.fillStyle = `rgba(244,240,234,${0.1 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.8 + s.p))})`;
        c.beginPath();
        c.arc(px * w, py * h, s.s, 0, Math.PI * 2);
        c.fill();
      }

      // 2. Halo ambiental
      const halo = c.createRadialGradient(cx, cy, 10, cx, cy, maxR * 1.05);
      halo.addColorStop(0, L.resonant ? 'rgba(229,169,60,0.14)' : 'rgba(229,169,60,0.07)');
      halo.addColorStop(0.55, 'rgba(45,212,191,0.03)');
      halo.addColorStop(1, 'rgba(4,5,8,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, cy, maxR * 1.05, 0, Math.PI * 2);
      c.fill();

      // 3. Astrolabio graduado y anillos orbitales
      c.save();
      c.strokeStyle = 'rgba(229, 169, 60, 0.16)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx, cy, outerR, 0, Math.PI * 2);
      c.stroke();

      for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg * Math.PI) / 180;
        const isMajor = deg % 30 === 0;
        const len = isMajor ? 6 : 3;
        c.strokeStyle = isMajor ? 'rgba(229, 169, 60, 0.35)' : 'rgba(244, 240, 234, 0.1)';
        c.beginPath();
        c.moveTo(cx + Math.cos(rad) * (outerR - len), cy + Math.sin(rad) * (outerR - len));
        c.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
        c.stroke();
      }

      [0.46, 0.66].forEach((rr) => {
        c.strokeStyle = 'rgba(244,240,234,0.065)';
        c.setLineDash([3, 7]);
        c.beginPath();
        c.arc(cx, cy, maxR * rr, 0, Math.PI * 2);
        c.stroke();
      });

      // Anillo Interior: Límite de Roche
      c.setLineDash([4, 5]);
      c.strokeStyle = 'rgba(244,63,94,0.38)';
      c.lineDashOffset = -t * 6;
      c.beginPath();
      c.arc(cx, cy, rocheR, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);

      if (maxR > 125) {
        c.fillStyle = 'rgba(251, 113, 133, 0.5)';
        c.font = '500 8.5px "JetBrains Mono", monospace';
        c.textAlign = 'center';
        c.fillText('LÍMITE DE ROCHE', cx, cy + rocheR + 11);
      }
      c.restore();

      // 4. Barrido suave de radar
      if (!reduce) {
        const sw = c.createConicGradient(t * 0.32, cx, cy);
        sw.addColorStop(0, 'rgba(45,212,191,0.05)');
        sw.addColorStop(0.11, 'rgba(45,212,191,0)');
        sw.addColorStop(1, 'rgba(45,212,191,0)');
        c.fillStyle = sw;
        c.beginPath();
        c.arc(cx, cy, outerR, 0, Math.PI * 2);
        c.fill();
      }

      // 5. Posiciones animadas de satélites
      const alive = new Set(L.sats.map((s) => s.uid));
      anim.current.forEach((_, k) => !alive.has(k) && anim.current.delete(k));
      const pos = L.sats.map((s, i) => {
        let a = anim.current.get(s.uid);
        if (!a) {
          a = { r: 0.22, a: s.angle };
          anim.current.set(s.uid, a);
        }
        let d = s.angle - a.a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        a.a += d * Math.min(1, dt * 6);
        a.r += (s.radius - a.r) * Math.min(1, dt * 5);
        const ang = a.a + Math.sin(t * 0.45 + i * 1.7) * 0.04;
        const rr = a.r * maxR + Math.sin(t * 0.85 + i * 2.1) * 2.5;
        return { s, x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr, rr, ang };
      });
      const byUid = new Map(pos.map((p) => [p.s.uid, p]));

      // 6. Hilos gravitacionales al centro
      pos.forEach(({ x, y }) => {
        c.strokeStyle = 'rgba(244,240,234,0.075)';
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(x, y);
        c.stroke();
      });

      // 7. Aristas de Tensión / Resonancia + Etiquetas d=0.XX
      L.edges.forEach((e) => {
        const A = byUid.get(e.a);
        const B = byUid.get(e.b);
        if (!A || !B) return;
        const born = Math.max(A.s.addedAt, B.s.addedAt);
        const p = Math.min(1, Math.max(0, (now - born) / 260));
        if (p <= 0) return;
        const sel = L.selected && (e.a === L.selected || e.b === L.selected);
        c.save();
        if (e.status === 'friction') {
          c.strokeStyle = `rgba(244,63,94,${0.55 + 0.35 * Math.sin(t * 5)})`;
          c.lineWidth = 2.0;
          c.setLineDash([5, 4]);
          c.lineDashOffset = -t * 18;
        } else if (e.status === 'resonance') {
          c.strokeStyle = sel ? 'rgba(229,169,60,0.92)' : 'rgba(16,185,129,0.48)';
          c.lineWidth = sel ? 2.1 : 1.4;
        } else {
          c.strokeStyle = sel ? 'rgba(244,240,234,0.75)' : 'rgba(244,240,234,0.18)';
          c.lineWidth = sel ? 1.8 : 1.1;
        }
        c.beginPath();
        c.moveTo(A.x, A.y);
        c.lineTo(A.x + (B.x - A.x) * p, A.y + (B.y - A.y) * p);
        c.stroke();
        c.restore();

        // Píldora de distancia coseno d en colisiones o nodo seleccionado
        if (p >= 1 && (e.status === 'friction' || sel)) {
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2;
          c.save();
          c.fillStyle = 'rgba(7, 9, 15, 0.92)';
          c.strokeStyle =
            e.status === 'friction' ? 'rgba(244, 63, 94, 0.75)' : 'rgba(45, 212, 191, 0.65)';
          c.lineWidth = 1;
          c.beginPath();
          c.roundRect(mx - 20, my - 8, 40, 16, 5);
          c.fill();
          c.stroke();
          c.fillStyle = e.status === 'friction' ? '#FDA4AF' : '#A7F3D0';
          c.font = '600 8.5px "JetBrains Mono", monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(`d:${e.dNorm.toFixed(2)}`, mx, my + 0.5);
          c.restore();
        }
      });

      // 8. Sonda en vuelo
      if (L.probe) {
        const k = Math.min(1, (now - L.probe.startedAt) / L.probe.durationMs);
        const ease = 1 - Math.pow(1 - k, 2.2);
        const ex = cx + Math.cos(L.probe.angle) * L.probe.radius * maxR;
        const ey = cy + Math.sin(L.probe.angle) * L.probe.radius * maxR;
        const sx = cx;
        const sy = h - 4;
        const qx = cx + Math.cos(L.probe.angle - 0.9) * maxR * 0.5;
        const qy = cy + Math.sin(L.probe.angle - 0.9) * maxR * 0.5;
        const at = (e: number) => {
          const v = 1 - e;
          return [v * v * sx + 2 * v * e * qx + e * e * ex, v * v * sy + 2 * v * e * qy + e * e * ey];
        };
        const [px, py] = at(ease);
        const [tx, ty] = at(Math.max(0, ease - 0.15));
        const g = c.createLinearGradient(tx, ty, px, py);
        g.addColorStop(0, 'rgba(229,169,60,0)');
        g.addColorStop(1, 'rgba(250,248,245,0.92)');
        c.strokeStyle = g;
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(px, py);
        c.stroke();
        c.fillStyle = '#FAF8F5';
        c.beginPath();
        c.arc(px, py, 4, 0, Math.PI * 2);
        c.fill();
      }

      // 9. Ráfagas de partículas
      bursts.current = bursts.current.filter((b) => now - b.at < 900);
      bursts.current.forEach((b) => {
        const k = (now - b.at) / 900;
        const sec = (now - b.at) / 1000;
        c.save();
        c.globalAlpha = 1 - k;
        if (b.kind === 'capture') {
          c.strokeStyle = b.color;
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(b.x, b.y, 10 + k * 32, 0, Math.PI * 2);
          c.stroke();
        } else {
          c.strokeStyle = '#F43F5E';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(cx, cy, rocheR * (1 - k * 0.3), 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = b.color;
        b.parts.forEach((p) => {
          c.beginPath();
          c.arc(b.x + p.vx * sec, b.y + p.vy * sec, p.s * (1 - k), 0, Math.PI * 2);
          c.fill();
        });
        c.restore();
      });

      // 10. Astro Central (Palabra Núcleo w0) con anillo de cardán giratorio
      const pulse = 1 + 0.03 * Math.sin(t * 2);
      const cr = Math.max(26, Math.min(38, maxR * 0.165));
      const cg = c.createRadialGradient(cx, cy, 2, cx, cy, cr * 2.4 * pulse);
      cg.addColorStop(0, `${L.accent}55`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = cg;
      c.beginPath();
      c.arc(cx, cy, cr * 2.4 * pulse, 0, Math.PI * 2);
      c.fill();

      c.save();
      c.translate(cx, cy);
      c.rotate(t * 0.15);
      c.strokeStyle = `${L.accent}66`;
      c.lineWidth = 1;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.arc(0, 0, cr + 5, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      c.fillStyle = '#07090F';
      c.strokeStyle = L.accent;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cy, cr, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#FAF8F5';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const fs = Math.max(9, Math.min(12.5, ((cr * 1.7) / Math.max(4, L.core.length)) * 1.7));
      c.font = `700 ${fs}px "JetBrains Mono", monospace`;
      c.fillText(L.core, cx, cy + 0.5);

      // 11. Satélites Espaciales + Cápsula de Nombre y Dominio
      const ht: { uid: string; x: number; y: number }[] = [];
      pos.forEach(({ s, x, y, rr, ang }) => {
        const sel = L.selected === s.uid;
        ht.push({ uid: s.uid, x, y });

        drawSatelliteCraft(c, cx, cy, x, y, rr, ang, s, sel, t);

        // Etiqueta tipo cápsula debajo de la sonda
        c.save();
        c.font = '600 10.5px "JetBrains Mono", monospace';
        const prefix = s.tier === 'bridge' ? '✦ ' : s.tier === 'near' ? '◈ ' : '○ ';
        const label = prefix + s.word;
        const tw = c.measureText(label).width;
        const padX = 7;
        const boxW = tw + padX * 2;
        const boxH = 19;
        const bx = Math.max(4, Math.min(w - boxW - 4, x - boxW / 2));
        const by = y > cy + maxR * 0.55 ? y - 16 - boxH : y + 15;

        c.fillStyle = sel ? 'rgba(13, 17, 28, 0.96)' : 'rgba(7, 9, 15, 0.88)';
        c.strokeStyle = sel ? s.color : 'rgba(244, 240, 234, 0.22)';
        c.lineWidth = sel ? 1.4 : 1;
        c.beginPath();
        c.roundRect(bx, by, boxW, boxH, 6);
        c.fill();
        c.stroke();

        c.fillStyle = '#F4F0EA';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(label, bx + boxW / 2, by + boxH / 2 + 0.5);
        c.restore();
      });
      hits.current = ht;

      c.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = hits.current.find((p) => Math.hypot(p.x - x, p.y - y) < 28);
    setSelected(hit && hit.uid !== selected ? hit.uid : null);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 select-none">
      <canvas ref={canvasRef} onPointerDown={onPointer} className="block h-full w-full cursor-pointer touch-manipulation" />
    </div>
  );
};
