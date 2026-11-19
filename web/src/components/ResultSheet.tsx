'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Share2, Sparkles } from 'lucide-react';
import { Sheet } from './Sheet';
import { useOrbitaStore } from '../store/useOrbitaStore';
import { masterConstellationDetails } from '../core/orbitalEngine';
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
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!open || !ctx) return;
    setShowMaster(false);
    let raf = 0;
    const t0 = performance.now();
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / 700);
      setShown(Number((tel.score * (1 - Math.pow(1 - k, 3))).toFixed(1)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    let revoked: string | null = null;
    renderCard(ctx.day.core, dayNumber, ctx.day.accent, sats, tel).then((blob) => {
      if (blob) {
        setCardBlob(blob);
        revoked = URL.createObjectURL(blob);
        setCardUrl(revoked);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, ctx, dayNumber, sats, tel]);

  if (!ctx) return null;
  const practice = mode === 'practice';
  const text = buildShareText(ctx.day.core, dayNumber, sats, tel, practice);
  const masterInfo = masterConstellationDetails(ctx);

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
    const blob = cardBlob ?? (await renderCard(ctx.day.core, dayNumber, ctx.day.accent, sats, tel));
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
    const url = cardUrl ?? URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  };

  // Diagnóstico motivacional del Índice Divergente
  const deltaHarvard = Number((tel.score - 78).toFixed(1));
  const nextGoal =
    tel.score < 73
      ? { name: 'Mente Bisociativa (73+)', diff: (73 - tel.score).toFixed(1) }
      : tel.score < 83
        ? { name: 'Arquitecto Divergente (83+)', diff: (83 - tel.score).toFixed(1) }
        : tel.score < 90
          ? { name: 'Singularidad Creativa (90+)', diff: (90 - tel.score).toFixed(1) }
          : null;

  return (
    <Sheet
      open={open}
      onClose={() => close(false)}
      title={tel.rank.title}
      eyebrow={practice ? `Práctica · ${ctx.day.core}` : `Día ${dayNumber} · ${ctx.day.core}`}
    >
      {/* Puntaje y Barra de Referencia DAT */}
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ivory-400">
            Índice Divergente
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-5xl font-bold tabular-nums text-ivory-50">
              {shown.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-ivory-400">/ 100 pts</span>
          </div>
          <div className="mt-1 font-mono text-[11px]" style={{ color: tel.rank.color }}>
            {tel.rank.percentileLabel}
          </div>
        </div>
        <div className="flex gap-1.5 pb-1 font-mono text-lg text-astrolabe-300">
          {sats.map((s) => (
            <span key={s.uid} title={`${s.word} (${s.domain})`}>
              {GLYPH[s.tier]}
            </span>
          ))}
        </div>
      </div>

      {/* Explicación competitiva del Índice Divergente */}
      <div className="mt-3 rounded-xl border border-ivory-100/10 bg-obsidian-950/90 p-3 text-xs leading-relaxed text-ivory-200">
        <div className="mb-1.5 flex justify-between font-mono text-[10px] text-ivory-400">
          <span>Lineal (50)</span>
          <span>Media Harvard (78)</span>
          <span className="text-spectral-400">Arquitecto (85+)</span>
        </div>
        <div className="relative mb-2 h-2 w-full overflow-hidden rounded-full border border-ivory-100/10 bg-obsidian-900">
          <div
            className="absolute bottom-0 top-0 z-10 w-0.5 bg-ivory-50/75"
            style={{ left: '78%' }}
            title="Promedio humano: 78"
          />
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-teal-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(5, tel.score))}%` }}
          />
        </div>
        <p className="text-[11.5px] text-ivory-200">
          {deltaHarvard >= 0 ? (
            <>
              Superaste el promedio humano del estudio de Harvard (78 pts) por{' '}
              <strong className="text-spectral-400">+{deltaHarvard} pts</strong>.
            </>
          ) : (
            <>
              Quedaste a <strong>{Math.abs(deltaHarvard)} pts</strong> de la media humana de Harvard
              (78 pts).
            </>
          )}{' '}
          {tel.closest && (
            <>
              Tu par más cercano fue <strong>{tel.closest.wordA}</strong> ↔{' '}
              <strong>{tel.closest.wordB}</strong> (d={tel.closest.dNorm.toFixed(2)}).
            </>
          )}{' '}
          {nextGoal && (
            <span className="text-astrolabe-300">
              A solo +{nextGoal.diff} pts de <strong>{nextGoal.name}</strong>.
            </span>
          )}
        </p>
      </div>

      {/* Vista previa de la Carta Astral + Botones de Compartir */}
      <div className="mt-4 grid grid-cols-1 items-center gap-3 sm:grid-cols-12">
        {cardUrl && (
          <div className="flex justify-center sm:col-span-5">
            <img
              src={cardUrl}
              alt="Carta Astral de tu constelación"
              className="w-40 max-w-[170px] rounded-xl border border-astrolabe-400/35 shadow-xl sm:w-full"
            />
          </div>
        )}
        <div className={cardUrl ? 'space-y-2 sm:col-span-7' : 'space-y-2 sm:col-span-12'}>
          <pre className="select-all whitespace-pre-wrap rounded-xl border border-ivory-100/10 bg-obsidian-950 p-2.5 font-mono text-[11px] leading-relaxed text-ivory-200">
            {text}
          </pre>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copy}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-astrolabe-400 py-2.5 text-xs font-semibold text-obsidian-950 transition hover:bg-astrolabe-300"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? '¡Copiado!' : 'Copiar Texto'}
            </button>
            <button
              type="button"
              onClick={shareImage}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-astrolabe-400/40 bg-obsidian-900 py-2.5 text-xs font-semibold text-ivory-50 transition hover:bg-obsidian-700"
            >
              <Share2 className="hidden h-3.5 w-3.5 text-astrolabe-400 sm:inline" />
              <Download className="h-3.5 w-3.5 text-astrolabe-400 sm:hidden" />
              Carta PNG
            </button>
          </div>
        </div>
      </div>

      {/* Ranking Global */}
      {!practice && (
        <div className="mt-4 rounded-2xl border border-ivory-100/10 bg-obsidian-900/60 p-3">
          {published ? (
            <Leaderboard compact />
          ) : (
            <>
              <div className="mb-2 text-xs text-ivory-400">
                Publica tu puntaje en el ranking global de hoy (verificado en el servidor).
              </div>
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
            </>
          )}
          <button
            type="button"
            onClick={() => {
              close(false);
              setShowStats(true);
            }}
            className="mt-2 text-xs text-astrolabe-300 underline-offset-2 hover:underline"
          >
            Ver ranking completo e historial
          </button>
        </div>
      )}

      {/* Constelación Ideal Explicada */}
      <div className="mt-4 border-t border-ivory-100/10 pt-3">
        <button
          type="button"
          onClick={() => setShowMaster((v) => !v)}
          className="flex w-full items-center justify-between text-left text-xs font-medium text-astrolabe-300 hover:text-astrolabe-400"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {showMaster
                ? 'Ocultar constelación ideal de hoy'
                : `Ver Constelación Ideal de hoy (${masterInfo.score.toFixed(1)} pts) y por qué`}
            </span>
          </span>
          <span className="font-mono text-[10px] text-ivory-400">{showMaster ? '▲' : '▼'}</span>
        </button>

        {showMaster && (
          <div className="mt-2.5 space-y-2 animate-fade">
            <div className="rounded-xl border border-astrolabe-400/25 bg-astrolabe-400/10 p-2.5 text-[11.5px] leading-relaxed text-ivory-100">
              <strong className="text-astrolabe-300">¿Por qué es ideal?</strong>{' '}
              {masterInfo.whySummary}
            </div>
            <div className="space-y-1.5">
              {masterInfo.items.map((item) => (
                <div
                  key={item.word}
                  className="rounded-xl border border-ivory-100/10 bg-obsidian-950/85 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-ivory-50">
                      {GLYPH[item.tier]} {item.word}
                    </span>
                    <span className="rounded-md border border-ivory-100/15 bg-obsidian-800 px-2 py-0.5 font-mono text-[10px] text-spectral-400">
                      {item.domain}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-ivory-400">{item.insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
