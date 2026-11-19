'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { useOrbitaStore } from '../store/useOrbitaStore';
import { masterConstellation } from '../core/orbitalEngine';
import { buildShareText, renderCard } from '../utils/astralCardGenerator';
import { Leaderboard } from './Leaderboard';

const GLYPH = { bridge: '✦', near: '◈', far: '○' } as const;

export const ResultSheet: React.FC = () => {
  const open = useOrbitaStore((s) => s.showResult);
  const close = useOrbitaStore((s) => s.setShowResult);
  const ctx = useOrbitaStore((s) => s.ctx);
  const sats = useOrbitaStore((s) => s.satellites);
  const tel = useOrbitaStore((s) => s.telemetry);
  const mode = useOrbitaStore((s) => s.mode);
  const dayNumber = useOrbitaStore((s) => s.dayNumber);
  const player = useOrbitaStore((s) => s.player);
  const setName = useOrbitaStore((s) => s.setName);
  const publish = useOrbitaStore((s) => s.publish);
  const publishing = useOrbitaStore((s) => s.publishing);
  const published = useOrbitaStore((s) => s.published);
  const lb = useOrbitaStore((s) => s.leaderboard);
  const setShowStats = useOrbitaStore((s) => s.setShowStats);

  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showMaster, setShowMaster] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowMaster(false);
    let raf = 0;
    const t0 = performance.now();
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / 700);
      setShown(Number((tel.score * (1 - Math.pow(1 - k, 3))).toFixed(1)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, tel.score]);

  if (!ctx) return null;
  const practice = mode === 'practice';
  const text = buildShareText(ctx.day.core, dayNumber, sats, tel, practice);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareImage = async () => {
    const blob = await renderCard(ctx.day.core, dayNumber, ctx.day.accent, sats, tel);
    if (!blob) return;
    const file = new File([blob], `orbita_${ctx.day.id}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch {
        /* cancelado */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <Sheet open={open} onClose={() => close(false)} title={tel.rank.title} eyebrow={practice ? `Práctica · ${ctx.day.core}` : `Día ${dayNumber} · ${ctx.day.core}`}>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-5xl font-bold tabular-nums text-ivory-50">{shown.toFixed(1)}</div>
          <div className="mt-1 font-mono text-[11px] text-ivory-400">
            divergencia {tel.divergence.toFixed(0)} · conexión {(tel.connection * 100).toFixed(0)}%
          </div>
        </div>
        <div className="flex gap-1.5 pb-1 font-mono text-lg text-astrolabe-300">
          {sats.map((s) => (
            <span key={s.uid} title={s.word}>
              {GLYPH[s.tier]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="flex items-center justify-center gap-2 rounded-2xl bg-astrolabe-400 py-3 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" onClick={shareImage} className="flex items-center justify-center gap-2 rounded-2xl border border-ivory-100/15 py-3 text-sm font-medium text-ivory-100 transition hover:bg-ivory-100/5">
          <Share2 className="h-4 w-4" />
          Imagen
        </button>
      </div>

      {!practice && (
        <div className="mt-5 rounded-2xl border border-ivory-100/10 bg-obsidian-900/60 p-3">
          {published ? (
            <Leaderboard compact />
          ) : (
            <>
              <div className="mb-2 text-xs text-ivory-400">Publica tu puntaje en el ranking de hoy (verificado en el servidor).</div>
              <div className="flex gap-2">
                <input
                  value={player.name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={16}
                  placeholder="Tu nombre"
                  className="min-w-0 flex-1 rounded-xl border border-ivory-100/15 bg-obsidian-950 px-3 py-2 text-sm text-ivory-50 outline-none focus:border-astrolabe-400/70"
                />
                <button
                  type="button"
                  disabled={publishing || !player.name.trim()}
                  onClick={publish}
                  className="rounded-xl bg-ivory-100/10 px-4 text-sm font-medium text-ivory-50 transition hover:bg-ivory-100/20 disabled:opacity-40"
                >
                  {publishing ? '…' : 'Publicar'}
                </button>
              </div>
              {lb && !lb.available && <div className="mt-2 text-[11px] text-ivory-400">El ranking global se activará pronto; tu historial local ya funciona.</div>}
            </>
          )}
          <button type="button" onClick={() => { close(false); setShowStats(true); }} className="mt-2 text-xs text-astrolabe-300 underline-offset-2 hover:underline">
            Ver ranking e historial
          </button>
        </div>
      )}

      <div className="mt-5">
        <button type="button" onClick={() => setShowMaster((v) => !v)} className="text-xs text-ivory-400 underline-offset-2 hover:text-ivory-100 hover:underline">
          {showMaster ? 'Ocultar' : 'Ver la constelación ideal de hoy'}
        </button>
        {showMaster && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {masterConstellation(ctx).map((w) => (
              <span key={w} className="rounded-full border border-ivory-100/15 px-3 py-1 font-mono text-xs text-ivory-100">
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
};
