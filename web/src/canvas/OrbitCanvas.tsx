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

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
  y: (Math.sin(i * 78.233) * 12543.1234) % 1,
  s: 0.4 + (i % 4) * 0.35,
  v: 0.004 + (i % 5) * 0.0025,
  p: i * 0.9,
}));

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

  // efectos puntuales (rechazo / captura)
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
          parts: mk(12, 46),
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

      // estrellas con deriva lenta
      for (const s of STARS) {
        const px = (((s.x + t * s.v) % 1) + 1) % 1;
        const py = (((s.y + t * s.v * 0.4) % 1) + 1) % 1;
        c.fillStyle = `rgba(244,240,234,${0.1 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.8 + s.p))})`;
        c.beginPath();
        c.arc(px * w, py * h, s.s, 0, Math.PI * 2);
        c.fill();
      }

      // halo
      const halo = c.createRadialGradient(cx, cy, 10, cx, cy, maxR * 1.05);
      halo.addColorStop(0, L.resonant ? 'rgba(229,169,60,0.13)' : 'rgba(229,169,60,0.07)');
      halo.addColorStop(1, 'rgba(4,5,8,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, cy, maxR * 1.05, 0, Math.PI * 2);
      c.fill();

      // anillos sobrios
      c.lineWidth = 1;
      [0.5, 0.8].forEach((rr, i) => {
        c.strokeStyle = `rgba(244,240,234,${i ? 0.09 : 0.06})`;
        c.setLineDash(i ? [] : [3, 7]);
        c.beginPath();
        c.arc(cx, cy, maxR * rr, 0, Math.PI * 2);
        c.stroke();
      });
      c.setLineDash([4, 6]);
      c.strokeStyle = 'rgba(244,63,94,0.28)';
      c.lineDashOffset = -t * 6;
      c.beginPath();
      c.arc(cx, cy, maxR * 0.22, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);

      // barrido suave
      if (!reduce) {
        const sw = c.createConicGradient(t * 0.35, cx, cy);
        sw.addColorStop(0, 'rgba(244,240,234,0.05)');
        sw.addColorStop(0.1, 'rgba(244,240,234,0)');
        sw.addColorStop(1, 'rgba(244,240,234,0)');
        c.fillStyle = sw;
        c.beginPath();
        c.arc(cx, cy, maxR * 0.8, 0, Math.PI * 2);
        c.fill();
      }

      // posiciones animadas con respiracion
      const alive = new Set(L.sats.map((s) => s.uid));
      anim.current.forEach((_, k) => !alive.has(k) && anim.current.delete(k));
      const pos = L.sats.map((s, i) => {
        let a = anim.current.get(s.uid);
        if (!a) {
          a = { r: 0.2, a: s.angle };
          anim.current.set(s.uid, a);
        }
        let d = s.angle - a.a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        a.a += d * Math.min(1, dt * 6);
        a.r += (s.radius - a.r) * Math.min(1, dt * 5);
        const ang = a.a + Math.sin(t * 0.5 + i * 1.7) * 0.05;
        const rr = a.r * maxR + Math.sin(t * 0.9 + i * 2.1) * 3;
        return { s, x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr };
      });
      const byUid = new Map(pos.map((p) => [p.s.uid, p]));

      // hilos al centro
      pos.forEach(({ x, y }) => {
        c.strokeStyle = 'rgba(244,240,234,0.07)';
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(x, y);
        c.stroke();
      });

      // aristas
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
          c.lineWidth = 1.8;
          c.setLineDash([5, 4]);
          c.lineDashOffset = -t * 18;
        } else if (e.status === 'resonance') {
          c.strokeStyle = sel ? 'rgba(229,169,60,0.9)' : 'rgba(45,212,191,0.4)';
          c.lineWidth = sel ? 2 : 1.3;
        } else {
          c.strokeStyle = sel ? 'rgba(244,240,234,0.7)' : 'rgba(244,240,234,0.16)';
          c.lineWidth = sel ? 1.8 : 1;
        }
        c.beginPath();
        c.moveTo(A.x, A.y);
        c.lineTo(A.x + (B.x - A.x) * p, A.y + (B.y - A.y) * p);
        c.stroke();
        c.restore();
      });

      // sonda en vuelo
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
        g.addColorStop(1, 'rgba(250,248,245,0.9)');
        c.strokeStyle = g;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(px, py);
        c.stroke();
        c.fillStyle = '#FAF8F5';
        c.beginPath();
        c.arc(px, py, 3.6, 0, Math.PI * 2);
        c.fill();
      }

      // rafagas
      bursts.current = bursts.current.filter((b) => now - b.at < 900);
      bursts.current.forEach((b) => {
        const k = (now - b.at) / 900;
        const sec = (now - b.at) / 1000;
        c.save();
        c.globalAlpha = 1 - k;
        if (b.kind === 'capture') {
          c.strokeStyle = b.color;
          c.lineWidth = 1.4;
          c.beginPath();
          c.arc(b.x, b.y, 8 + k * 30, 0, Math.PI * 2);
          c.stroke();
        } else {
          c.strokeStyle = '#F43F5E';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(cx, cy, maxR * 0.22 * (1 - k * 0.3), 0, Math.PI * 2);
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

      // nucleo
      const pulse = 1 + 0.03 * Math.sin(t * 2);
      const cr = Math.max(26, Math.min(40, maxR * 0.17));
      const cg = c.createRadialGradient(cx, cy, 2, cx, cy, cr * 2.4 * pulse);
      cg.addColorStop(0, `${L.accent}55`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = cg;
      c.beginPath();
      c.arc(cx, cy, cr * 2.4 * pulse, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#07090F';
      c.strokeStyle = L.accent;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(cx, cy, cr, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#FAF8F5';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const fs = Math.max(9, Math.min(13, (cr * 1.7) / Math.max(4, L.core.length) * 1.7));
      c.font = `600 ${fs}px "JetBrains Mono", monospace`;
      c.fillText(L.core, cx, cy + 0.5);

      // satelites
      const ht: { uid: string; x: number; y: number }[] = [];
      pos.forEach(({ s, x, y }) => {
        const sel = L.selected === s.uid;
        const rn = sel ? 8.5 : 7;
        ht.push({ uid: s.uid, x, y });
        const sg = c.createRadialGradient(x, y, 1, x, y, rn * 3);
        sg.addColorStop(0, `${s.color}40`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = sg;
        c.beginPath();
        c.arc(x, y, rn * 3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#07090F';
        c.strokeStyle = s.color;
        c.lineWidth = s.tier === 'far' ? 1.2 : 2;
        c.setLineDash(s.tier === 'far' ? [2, 3] : []);
        c.beginPath();
        c.arc(x, y, rn, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = s.color;
        c.beginPath();
        c.arc(x, y, s.tier === 'bridge' ? 3.4 : 2.4, 0, Math.PI * 2);
        c.fill();

        c.font = '600 11px "JetBrains Mono", monospace';
        const label = (s.tier === 'bridge' ? '✦ ' : '') + s.word;
        const tw = c.measureText(label).width;
        const lx = Math.max(4, Math.min(w - tw - 4, x - tw / 2));
        const ly = y > cy + maxR * 0.55 ? y - rn - 9 : y + rn + 13;
        c.fillStyle = 'rgba(4,5,8,0.7)';
        c.fillRect(lx - 3, ly - 10, tw + 6, 14);
        c.fillStyle = '#F4F0EA';
        c.textAlign = 'left';
        c.fillText(label, lx, ly);
        c.textAlign = 'center';
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
    const hit = hits.current.find((p) => Math.hypot(p.x - x, p.y - y) < 26);
    setSelected(hit && hit.uid !== selected ? hit.uid : null);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 select-none">
      <canvas ref={canvasRef} onPointerDown={onPointer} className="block h-full w-full touch-manipulation" />
    </div>
  );
};
