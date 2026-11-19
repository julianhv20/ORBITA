'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, HelpCircle, Send, Volume2, VolumeX, X, RotateCcw } from 'lucide-react';
import { TARGET, MAX_SWAPS } from '../core/orbitalEngine';
import { useOrbitaStore } from '../store/useOrbitaStore';
import { OrbitCanvas } from '../canvas/OrbitCanvas';
import { HelpSheet } from './HelpSheet';
import { ResultSheet } from './ResultSheet';
import { StatsSheet } from './StatsSheet';
import { synth } from '../audio/synthEngine';

const TONE = {
  neutral: 'text-ivory-400',
  good: 'text-spectral-400',
  warn: 'text-astrolabe-300',
  bad: 'text-roche-400',
} as const;

export const OrbitaStage: React.FC = () => {
  const s = useOrbitaStore();
  const [value, setValue] = useState('');
  const [vh, setVh] = useState<number | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    s.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const f = () => setVh(Math.round(vv.height));
    f();
    vv.addEventListener('resize', f);
    return () => vv.removeEventListener('resize', f);
  }, []);

  useEffect(() => {
    if (!s.shakeNonce) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 320);
    return () => clearTimeout(t);
  }, [s.shakeNonce]);

  if (s.phase === 'boot') {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-obsidian-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-astrolabe-400/25 border-t-astrolabe-400" />
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ivory-400">Preparando el cielo de hoy</p>
      </div>
    );
  }
  if (s.phase === 'error' || !s.ctx) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 bg-obsidian-950 p-6 text-center">
        <p className="font-serif text-2xl text-roche-400">No se pudo cargar el juego</p>
        <p className="max-w-sm font-mono text-xs text-ivory-400">{s.error}</p>
        <button type="button" onClick={() => location.reload()} className="mt-3 rounded-full border border-ivory-100/20 px-4 py-2 text-sm text-ivory-100">
          Reintentar
        </button>
      </div>
    );
  }

  const full = s.satellites.length >= TARGET;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || s.probe || s.sealed) return;
    synth.ensureGraph();
    s.submitWord(v);
    setValue('');
  };

  return (
    <div style={vh ? { height: vh } : undefined} className="relative mx-auto flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-obsidian-950 text-ivory-100">
      {/* barra superior */}
      <header className="flex items-center justify-between px-4 pb-1 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl tracking-wide text-ivory-50">ÓRBITA</span>
          <span className="font-mono text-[11px] text-ivory-400">{s.mode === 'practice' ? 'práctica' : `día ${s.dayNumber}`}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {s.mode === 'practice' && (
            <button type="button" aria-label="Volver a hoy" onClick={() => s.manifest && s.loadDay(s.manifest.puzzles[(s.dayNumber - 1) % s.manifest.puzzles.length].id, 'daily')} className="rounded-full p-2 text-astrolabe-300 hover:bg-ivory-100/10">
              <RotateCcw className="h-[18px] w-[18px]" />
            </button>
          )}
          <button type="button" aria-label="Ranking e historial" onClick={() => s.setShowStats(true)} className="rounded-full p-2 text-ivory-200 hover:bg-ivory-100/10">
            <BarChart3 className="h-[18px] w-[18px]" />
          </button>
          <button type="button" aria-label="Sonido" onClick={s.toggleSound} className="rounded-full p-2 text-ivory-200 hover:bg-ivory-100/10">
            {s.soundOn ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px] text-ivory-400" />}
          </button>
          <button type="button" aria-label="Ayuda" onClick={() => s.setShowHelp(true)} className="rounded-full p-2 text-ivory-200 hover:bg-ivory-100/10">
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* radar */}
      <main className="relative min-h-0 flex-1">
        <OrbitCanvas />
        {s.satellites.length >= 2 && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-center">
            <div className="font-mono text-3xl font-semibold tabular-nums text-ivory-50">{s.telemetry.score.toFixed(0)}</div>
            <div className="text-[11px] tracking-wide" style={{ color: s.telemetry.rank.color }}>
              {s.telemetry.rank.title}
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {Array.from({ length: TARGET }, (_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full transition-colors" style={{ background: s.satellites[i]?.color ?? 'rgba(244,240,234,0.15)' }} />
          ))}
        </div>
      </main>

      {/* panel inferior */}
      <footer className="px-4 pb-4 pt-2">
        <p key={s.feedback?.id ?? 0} className={`mb-2 min-h-[2.5rem] text-center text-[13px] leading-snug animate-fade ${s.feedback ? TONE[s.feedback.tone] : 'text-ivory-400'}`}>
          {s.feedback?.text ??
            (s.satellites.length === 0
              ? `Escribe una palabra conectada con ${s.ctx.day.core}, pero lejos de las demás.`
              : 'Cada palabra nueva debe venir de un mundo distinto.')}
        </p>

        {s.satellites.length > 0 && (
          <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {s.satellites.map((sat) => (
              <button
                key={sat.uid}
                type="button"
                disabled={s.sealed}
                onClick={() => s.removeSatellite(sat.uid)}
                title={s.swapsLeft > 0 ? 'Toca para cambiarla' : 'Sin cambios disponibles'}
                className="group flex shrink-0 items-center gap-1.5 rounded-full border border-ivory-100/12 bg-obsidian-900 py-1 pl-2.5 pr-2 font-mono text-[11px] text-ivory-100 transition hover:border-ivory-100/30 disabled:opacity-70"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: sat.color }} />
                {sat.word}
                {!s.sealed && <X className="h-3 w-3 text-ivory-400 group-hover:text-roche-400" />}
              </button>
            ))}
            {!s.sealed && (
              <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-ivory-400" title="Cambios disponibles">
                ↺ {s.swapsLeft}/{MAX_SWAPS}
              </span>
            )}
          </div>
        )}

        {s.sealed ? (
          <button type="button" onClick={() => s.setShowResult(true)} className="w-full rounded-2xl bg-astrolabe-400 py-3.5 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300">
            Ver resultado · {s.telemetry.score.toFixed(1)}
          </button>
        ) : full ? (
          <button type="button" onClick={s.seal} className="w-full animate-pulse rounded-2xl bg-astrolabe-400 py-3.5 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300">
            Terminar constelación
          </button>
        ) : (
          <form onSubmit={submit} className={`flex gap-2 ${shake ? 'animate-shake' : ''}`}>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={Boolean(s.probe)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={24}
              enterKeyHint="send"
              placeholder={`Palabra ${s.satellites.length + 1} de ${TARGET}`}
              className="min-w-0 flex-1 rounded-2xl border border-ivory-100/12 bg-obsidian-900 px-4 py-3 text-base text-ivory-50 outline-none transition placeholder:text-ivory-400/60 focus:border-astrolabe-400/70"
            />
            <button
              type="submit"
              aria-label="Lanzar"
              disabled={Boolean(s.probe) || !value.trim()}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-astrolabe-400 text-obsidian-950 transition hover:bg-astrolabe-300 disabled:bg-obsidian-800 disabled:text-ivory-400/40"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        )}
      </footer>

      <HelpSheet />
      <ResultSheet />
      <StatsSheet />
    </div>
  );
};
