'use client';

import React, { useEffect, useRef } from 'react';
import { useOrbitaStore } from '../store/useOrbitaStore';
import { ActiveSatellite, PairEdgeMetric } from '../core/types';

interface ParticleBurst {
  id: string;
  type: 'roche' | 'void' | 'capture';
  word: string;
  x: number;
  y: number;
  angle: number;
  createdAt: number;
  durationMs: number;
  colorHex: string;
  particles: {
    vx: number;
    vy: number;
    size: number;
    alpha: number;
  }[];
}

interface HitTargetNode {
  uid: string;
  x: number;
  y: number;
}

const STAR_COUNT = 68;

export const AstrolabeCanvas: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePack = useOrbitaStore((s) => s.activePack);
  const satellites = useOrbitaStore((s) => s.satellites);
  const telemetry = useOrbitaStore((s) => s.telemetry);
  const inFlightProbe = useOrbitaStore((s) => s.inFlightProbe);
  const isSealed = useOrbitaStore((s) => s.isSealed);
  const selectedUid = useOrbitaStore((s) => s.selectedSatelliteUid);
  const setSelectedSatellite = useOrbitaStore((s) => s.setSelectedSatellite);

  // Referencia mutable sincronizada para que el loop de 60fps nunca recree el canvas
  const liveRef = useRef({
    activePack,
    satellites,
    telemetry,
    inFlightProbe,
    isSealed,
    selectedUid,
  });

  const burstsRef = useRef<ParticleBurst[]>([]);
  const shakeUntilRef = useRef<number>(0);
  const prevProbeIdRef = useRef<string | null>(null);
  const animatedAnglesRef = useRef<Map<string, { r: number; theta: number }>>(new Map());
  const hitNodesRef = useRef<HitTargetNode[]>([]);

  useEffect(() => {
    // Detectar fin de vuelo balístico para disparar explosión de partículas exacta
    const prevProbeId = prevProbeIdRef.current;
    const currProbe = inFlightProbe;

    if (prevProbeId && !currProbe && wrapperRef.current) {
      // El vuelo acaba de resolverse; revisar último evento en el store
      const st = useOrbitaStore.getState();
      const lastLog = st.impulseLog[st.impulseLog.length - 1];
      const rect = wrapperRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const maxR = Math.max(105, Math.min(rect.width, rect.height) * 0.42);

      if (lastLog?.outcome === 'ROCHE_LIMIT') {
        shakeUntilRef.current = performance.now() + 360;
        burstsRef.current.push({
          id: `burst_${Date.now()}`,
          type: 'roche',
          word: lastLog.word,
          x: cx,
          y: cy,
          angle: 0,
          createdAt: performance.now(),
          durationMs: 950,
          colorHex: '#F43F5E',
          particles: Array.from({ length: 28 }, () => {
            const a = Math.random() * Math.PI * 2;
            const sp = 35 + Math.random() * 115;
            return {
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              size: 1.5 + Math.random() * 2.6,
              alpha: 0.7 + Math.random() * 0.3,
            };
          }),
        });
      } else if (lastLog?.outcome === 'OUTER_VOID') {
        const randA = -Math.PI * 0.35 + (Math.random() - 0.5) * 1.2;
        const vxBase = cx + Math.cos(randA) * (maxR * 0.96);
        const vyBase = cy + Math.sin(randA) * (maxR * 0.96);
        burstsRef.current.push({
          id: `burst_${Date.now()}`,
          type: 'void',
          word: lastLog.word,
          x: vxBase,
          y: vyBase,
          angle: randA,
          createdAt: performance.now(),
          durationMs: 1050,
          colorHex: '#94A3B8',
          particles: Array.from({ length: 18 }, () => {
            const spread = randA + (Math.random() - 0.5) * 0.65;
            const sp = 40 + Math.random() * 75;
            return {
              vx: Math.cos(spread) * sp,
              vy: Math.sin(spread) * sp,
              size: 1.2 + Math.random() * 2.0,
              alpha: 0.6 + Math.random() * 0.35,
            };
          }),
        });
      } else if (lastLog?.outcome === 'ORBIT_CAPTURE' && st.satellites.length > 0) {
        const newest = st.satellites[st.satellites.length - 1];
        const sx = cx + Math.cos(newest.displayAngle) * (newest.orbitRadiusRatio * maxR);
        const sy = cy + Math.sin(newest.displayAngle) * (newest.orbitRadiusRatio * maxR);
        burstsRef.current.push({
          id: `burst_${Date.now()}`,
          type: 'capture',
          word: newest.word,
          x: sx,
          y: sy,
          angle: newest.displayAngle,
          createdAt: performance.now(),
          durationMs: 750,
          colorHex: newest.color.hex,
          particles: Array.from({ length: 16 }, () => {
            const a = Math.random() * Math.PI * 2;
            const sp = 20 + Math.random() * 55;
            return {
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              size: 1.2 + Math.random() * 2.0,
              alpha: 0.85,
            };
          }),
        });
      }
    }

    prevProbeIdRef.current = currProbe ? currProbe.id : null;
    liveRef.current = {
      activePack,
      satellites,
      telemetry,
      inFlightProbe,
      isSealed,
      selectedUid,
    };
  }, [activePack, satellites, telemetry, inFlightProbe, isSealed, selectedUid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;

    const stars = Array.from({ length: STAR_COUNT }, (_, idx) => ({
      x: ((idx * 73) % 100) / 100 + (Math.sin(idx) * 0.03 + 0.03),
      y: ((idx * 41) % 100) / 100 + (Math.cos(idx) * 0.03 + 0.03),
      size: 0.5 + (idx % 3) * 0.45,
      phase: idx * 0.7,
      speed: 0.6 + (idx % 4) * 0.35,
    }));

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now * 0.001;

      const {
        activePack: pack,
        satellites: sats,
        telemetry: telem,
        inFlightProbe: probe,
        selectedUid: selUid,
      } = liveRef.current;

      ctx.clearRect(0, 0, width, height);

      // Micro-shake de cámara en colapso de Roche
      ctx.save();
      if (now < shakeUntilRef.current) {
        const intensity = ((shakeUntilRef.current - now) / 360) * 4.0;
        ctx.translate(
          (Math.random() - 0.5) * 2 * intensity,
          (Math.random() - 0.5) * 2 * intensity
        );
      }

      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.max(96, Math.min(width, height) * 0.43);
      const rocheR = maxR * 0.25;
      const outerR = maxR * 0.88;
      const accentHex = pack?.meta.accent ?? '#E5A93C';

      // 1. Polvo estelar respirante
      stars.forEach((st) => {
        const alpha = 0.14 + 0.16 * Math.sin(timeSec * st.speed + st.phase);
        ctx.fillStyle = `rgba(244, 240, 234, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc((st.x % 1) * width, (st.y % 1) * height, st.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Resplandor atmosférico de la Zona Habitable y Aurora de Resonancia Armónica
      const bgGrad = ctx.createRadialGradient(cx, cy, rocheR * 0.6, cx, cy, outerR * 1.08);
      if (telem.isHarmonicResonance) {
        bgGrad.addColorStop(0, 'rgba(229, 169, 60, 0.14)');
        bgGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.09)');
        bgGrad.addColorStop(0.85, 'rgba(45, 212, 191, 0.04)');
        bgGrad.addColorStop(1, 'rgba(4, 5, 8, 0)');
      } else {
        bgGrad.addColorStop(0, 'rgba(244, 63, 94, 0.06)');
        bgGrad.addColorStop(0.32, 'rgba(229, 169, 60, 0.045)');
        bgGrad.addColorStop(0.8, 'rgba(45, 212, 191, 0.025)');
        bgGrad.addColorStop(1, 'rgba(4, 5, 8, 0)');
      }
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR * 1.08, 0, Math.PI * 2);
      ctx.fill();

      // 3. Grabado Astro-Cartográfico: Retícula de Astrolabio con marcas de grado
      ctx.save();
      ctx.strokeStyle = 'rgba(229, 169, 60, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.stroke();

      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const isCardinal = deg % 90 === 0;
        const isMajor = deg % 30 === 0;
        const innerTick = isCardinal ? outerR - 9 : isMajor ? outerR - 6 : outerR - 3;
        ctx.strokeStyle = isCardinal
          ? 'rgba(229, 169, 60, 0.45)'
          : isMajor
            ? 'rgba(244, 240, 234, 0.22)'
            : 'rgba(244, 240, 234, 0.08)';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * innerTick, cy + Math.sin(rad) * innerTick);
        ctx.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
        ctx.stroke();
      }

      // Ejes meridianos sutiles
      ctx.strokeStyle = 'rgba(244, 240, 234, 0.06)';
      ctx.beginPath();
      ctx.moveTo(cx - outerR, cy);
      ctx.lineTo(cx + outerR, cy);
      ctx.moveTo(cx, cy - outerR);
      ctx.lineTo(cx, cy + outerR);
      ctx.stroke();

      // Anillos orbitales de referencia semántica
      [0.44, 0.62, 0.77].forEach((ratio) => {
        ctx.strokeStyle = 'rgba(244, 240, 234, 0.065)';
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Anillo Interior: LÍMITE DE ROCHE
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.48)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(cx, cy, rocheR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (maxR > 130) {
        ctx.fillStyle = 'rgba(251, 113, 133, 0.58)';
        ctx.font = '500 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ROCHE · OBVIO', cx, cy + rocheR + 11);

        ctx.fillStyle = 'rgba(226, 221, 213, 0.36)';
        ctx.fillText('VACÍO EXTERIOR', cx, cy - outerR - 7);
      }
      ctx.restore();

      // 5. Calcular posiciones interpoladas en los cuadrantes semánticos reales
      const currentAnimated = animatedAnglesRef.current;
      const activeIds = new Set(sats.map((s) => s.uid));
      Array.from(currentAnimated.keys()).forEach((k) => {
        if (!activeIds.has(k)) currentAnimated.delete(k);
      });

      // Micro-deriva orbital colectiva lentísima para dar vida sin alterar cuadrantes relativos
      const slowDrift = Math.sin(timeSec * 0.22) * 0.035;

      const nodePositions = sats.map((sat) => {
        let anim = currentAnimated.get(sat.uid);
        if (!anim) {
          anim = { r: 0.27, theta: sat.displayAngle };
          currentAnimated.set(sat.uid, anim);
        }
        // Interpolación suave hacia su ángulo semántico y radio gravitacional
        let dTheta = sat.displayAngle - anim.theta;
        while (dTheta > Math.PI) dTheta -= Math.PI * 2;
        while (dTheta < -Math.PI) dTheta += Math.PI * 2;
        anim.theta += dTheta * Math.min(1, dt * 7.5);
        anim.r += (sat.orbitRadiusRatio - anim.r) * Math.min(1, dt * 6.5);

        const finalAngle = anim.theta + slowDrift;
        const rPx = anim.r * maxR;
        return {
          sat,
          x: cx + Math.cos(finalAngle) * rPx,
          y: cy + Math.sin(finalAngle) * rPx,
        };
      });

      const posByUid = new Map(nodePositions.map((p) => [p.sat.uid, p]));

      // 6. Hilos gravitacionales radiales hacia el núcleo
      nodePositions.forEach(({ sat, x, y }) => {
        const gLine = ctx.createLinearGradient(cx, cy, x, y);
        gLine.addColorStop(0, 'rgba(229, 169, 60, 0.16)');
        gLine.addColorStop(1, 'rgba(244, 240, 234, 0.04)');
        ctx.strokeStyle = gLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        void sat;
      });

      // 7. Cuerdas Geométricas Secuenciales entre Satélites (Resonancia vs Fricción)
      telem.edges.forEach((edge: PairEdgeMetric, edgeIdx: number) => {
        const pA = posByUid.get(edge.uidA);
        const pB = posByUid.get(edge.uidB);
        if (!pA || !pB) return;

        // Trazado progresivo secuencial cuando un nodo acaba de ser capturado
        const newestLaunch = Math.max(pA.sat.launchedAt, pB.sat.launchedAt);
        const elapsedMs = now - newestLaunch - edgeIdx * 65;
        if (elapsedMs <= 0) return;
        const drawProgress = Math.min(1, elapsedMs / 240);

        const curX2 = pA.x + (pB.x - pA.x) * drawProgress;
        const curY2 = pA.y + (pB.y - pA.y) * drawProgress;

        const isConnectedToSelected =
          selUid !== null && (edge.uidA === selUid || edge.uidB === selUid);

        ctx.save();
        if (edge.status === 'resonance') {
          ctx.strokeStyle = isConnectedToSelected
            ? 'rgba(229, 169, 60, 0.88)'
            : 'rgba(16, 185, 129, 0.52)';
          ctx.lineWidth = isConnectedToSelected ? 2.2 : 1.45;
          if (telem.isHarmonicResonance || isConnectedToSelected) {
            ctx.shadowColor = isConnectedToSelected ? '#E5A93C' : '#10B981';
            ctx.shadowBlur = 8;
          }
        } else if (edge.status === 'stable') {
          ctx.strokeStyle = isConnectedToSelected
            ? 'rgba(56, 189, 248, 0.78)'
            : 'rgba(226, 221, 213, 0.24)';
          ctx.lineWidth = isConnectedToSelected ? 2.0 : 1.15;
        } else {
          // Fricción Roja pulsante
          const pulse = 0.55 + 0.45 * Math.sin(timeSec * 6.5);
          ctx.strokeStyle = `rgba(244, 63, 94, ${(0.5 + pulse * 0.45).toFixed(2)})`;
          ctx.lineWidth = isConnectedToSelected ? 2.8 : 2.1;
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -timeSec * 22;
          ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';
          ctx.shadowBlur = 9;
        }

        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(curX2, curY2);
        ctx.stroke();
        ctx.restore();

        // Etiqueta de distancia en aristas con fricción o conectadas al nodo inspeccionado
        if (drawProgress >= 1 && (edge.status === 'friction' || isConnectedToSelected)) {
          const mx = (pA.x + pB.x) / 2;
          const my = (pA.y + pB.y) / 2;
          ctx.save();
          ctx.fillStyle = 'rgba(7, 9, 15, 0.92)';
          ctx.strokeStyle =
            edge.status === 'friction'
              ? 'rgba(244, 63, 94, 0.75)'
              : 'rgba(229, 169, 60, 0.65)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(mx - 19, my - 8.5, 38, 17, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = edge.status === 'friction' ? '#FDA4AF' : '#F4F0EA';
          ctx.font = '600 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${(edge.distance * 100).toFixed(0)}`, mx, my + 0.5);
          ctx.restore();
        }
      });

      // 8. Sonda Balística en Vuelo (~560ms desde la consola inferior)
      if (probe) {
        const t = Math.min(1, (now - probe.startedAt) / probe.durationMs);
        const ease = 1 - Math.pow(1 - t, 2.4);

        const startX = cx;
        const startY = height - 8;

        const destR = probe.targetRadiusRatio * maxR;
        const endX = cx + Math.cos(probe.targetAngle) * destR;
        const endY = cy + Math.sin(probe.targetAngle) * destR;

        // Punto de control curvo por atracción gravitacional hacia el núcleo
        const ctrlX = cx + Math.cos(probe.targetAngle - 0.85) * (maxR * 0.55);
        const ctrlY = cy + Math.sin(probe.targetAngle - 0.85) * (maxR * 0.55);

        const inv = 1 - ease;
        const px = inv * inv * startX + 2 * inv * ease * ctrlX + ease * ease * endX;
        const py = inv * inv * startY + 2 * inv * ease * ctrlY + ease * ease * endY;

        // Estela luminosa de la sonda
        const prevEase = Math.max(0, ease - 0.14);
        const pInv = 1 - prevEase;
        const tx = pInv * pInv * startX + 2 * pInv * prevEase * ctrlX + prevEase * prevEase * endX;
        const ty = pInv * pInv * startY + 2 * pInv * prevEase * ctrlY + prevEase * prevEase * endY;

        ctx.save();
        const trailGrad = ctx.createLinearGradient(tx, ty, px, py);
        trailGrad.addColorStop(0, 'rgba(229, 169, 60, 0)');
        trailGrad.addColorStop(1, 'rgba(244, 240, 234, 0.92)');
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.fillStyle = '#FAF8F5';
        ctx.shadowColor = '#E5A93C';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '600 10px monospace';
        ctx.fillStyle = '#F4F0EA';
        ctx.textAlign = 'center';
        ctx.fillText(probe.word, px, py - 12);
        ctx.restore();
      }

      // 9. Explosiones y Ondas Transitorias (Roche / Vacío / Captura)
      for (let i = burstsRef.current.length - 1; i >= 0; i--) {
        const b = burstsRef.current[i];
        const prog = (now - b.createdAt) / b.durationMs;
        if (prog >= 1) {
          burstsRef.current.splice(i, 1);
          continue;
        }

        const fade = 1 - prog;
        ctx.save();
        if (b.type === 'capture') {
          ctx.strokeStyle = b.colorHex;
          ctx.globalAlpha = fade * 0.7;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 10 + prog * 36, 0, Math.PI * 2);
          ctx.stroke();
        } else if (b.type === 'roche') {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
          ctx.globalAlpha = fade;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(cx, cy, rocheR * (1 - prog * 0.35), 0, Math.PI * 2);
          ctx.stroke();
        }

        const sec = (now - b.createdAt) / 1000;
        b.particles.forEach((pt) => {
          ctx.globalAlpha = fade * pt.alpha;
          ctx.fillStyle = b.colorHex;
          ctx.beginPath();
          ctx.arc(b.x + pt.vx * sec, b.y + pt.vy * sec, pt.size * fade, 0, Math.PI * 2);
          ctx.fill();
        });

        if (b.type !== 'capture') {
          ctx.globalAlpha = fade;
          ctx.fillStyle = b.type === 'roche' ? '#FDA4AF' : '#CBD5E1';
          ctx.font = '600 10.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(b.word, b.x, b.y - 14 - prog * 16);
        }
        ctx.restore();
      }

      // 10. Astro Central: PALABRA NÚCLEO (w0)
      const corePulse = 1 + 0.035 * Math.sin(timeSec * 2.2);
      const coreRadius = Math.max(26, Math.min(34, maxR * 0.16));
      const coreHalo = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreRadius * 2.1 * corePulse);
      coreHalo.addColorStop(0, `${accentHex}66`);
      coreHalo.addColorStop(0.55, `${accentHex}1A`);
      coreHalo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreHalo;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 2.1 * corePulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.fillStyle = '#07090F';
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentHex;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Anillo interior fino de latón
      ctx.strokeStyle = 'rgba(244, 240, 234, 0.22)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const coreText = pack?.meta.coreWord ?? '...';
      ctx.fillStyle = '#FAF8F5';
      ctx.font = `700 ${coreText.length > 7 ? 10 : 11.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(coreText, cx, cy + 0.5);

      // 11. Nodos de Satélites en Órbita + Cápsulas Editoriales
      const hitTargets: HitTargetNode[] = [];

      nodePositions.forEach(({ sat, x, y }: { sat: ActiveSatellite; x: number; y: number }) => {
        const isSelected = selUid === sat.uid;
        const rNode = isSelected ? 10.5 : 8.2;
        hitTargets.push({ uid: sat.uid, x, y });

        // Halo del satélite
        const halo = ctx.createRadialGradient(x, y, 1, x, y, rNode * 2.8);
        halo.addColorStop(0, sat.color.glow);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, rNode * 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = '#07090F';
        ctx.strokeStyle = sat.color.hex;
        ctx.lineWidth = isSelected ? 2.8 : 2.0;
        ctx.shadowColor = sat.color.hex;
        ctx.shadowBlur = isSelected ? 14 : 7;
        ctx.beginPath();
        ctx.arc(x, y, rNode, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = sat.color.hex;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Etiqueta cápsula siempre dentro del lienzo
        ctx.save();
        ctx.font = '600 10.5px monospace';
        const metrics = ctx.measureText(sat.word);
        const boxW = metrics.width + 14;
        const boxH = 19;
        const bx = Math.max(6, Math.min(width - boxW - 6, x - boxW / 2));
        const by = y > cy + maxR * 0.62 ? y - rNode - boxH - 5 : y + rNode + 5;

        ctx.fillStyle = isSelected ? 'rgba(13, 17, 28, 0.96)' : 'rgba(7, 9, 15, 0.88)';
        ctx.strokeStyle = isSelected ? sat.color.hex : 'rgba(244, 240, 234, 0.22)';
        ctx.lineWidth = isSelected ? 1.4 : 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#F4F0EA';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sat.word, bx + boxW / 2, by + boxH / 2 + 0.5);
        ctx.restore();
      });

      hitNodesRef.current = hitTargets;
      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    for (const target of hitNodesRef.current) {
      if (Math.hypot(px - target.x, py - target.y) <= 26) {
        setSelectedSatellite(selectedUid === target.uid ? null : target.uid);
        return;
      }
    }
    setSelectedSatellite(null);
  };

  return (
    <div ref={wrapperRef} className="relative w-full h-full select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="block w-full h-full cursor-pointer touch-manipulation"
      />
    </div>
  );
};
