'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  HelpCircle,
  Info,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
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
  const [showIndexInfo, setShowIndexInfo] = useState(false);
  const [mobileLogOpen, setMobileLogOpen] = useState(false);

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
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ivory-400">
          Calibrando el observatorio de hoy
        </p>
      </div>
    );
  }
  if (s.phase === 'error' || !s.ctx) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 bg-obsidian-950 p-6 text-center">
        <p className="font-serif text-2xl text-roche-400">No se pudo cargar el juego</p>
        <p className="max-w-sm font-mono text-xs text-ivory-400">{s.error}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-3 rounded-full border border-ivory-100/20 px-4 py-2 text-sm text-ivory-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const full = s.satellites.length >= TARGET;
  const tel = s.telemetry;
  const closest = tel.closest;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || s.probe || s.sealed) return;
    synth.ensureGraph();
    s.submitWord(v);
    setValue('');
  };

  // Estado del monitor de Tensión entre Nodos
  const renderTensionMonitor = () => {
    if (s.satellites.length < 2 || !closest) {
      return (
        <div className="rounded-xl border border-ivory-100/10 bg-obsidian-950/80 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[11px] text-ivory-400">Tensión entre Nodos</span>
            <span className="rounded bg-obsidian-800 px-2 py-0.5 font-mono text-[10px] text-ivory-400">
              En espera
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-ivory-400">
            Lanza al menos 2 satélites para medir la distancia coseno entre tus conceptos.
          </p>
        </div>
      );
    }

    if (closest.status === 'friction') {
      return (
        <div className="rounded-xl border border-roche-500/30 bg-obsidian-950/85 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[11px] text-ivory-400">Tensión entre Nodos</span>
            <span className="rounded border border-roche-500/40 bg-roche-500/20 px-2 py-0.5 font-mono text-[10px] text-roche-400">
              Fricción d={closest.dNorm.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-ivory-200">
            Par más cercano: <strong className="text-roche-400">{closest.wordA}</strong> y{' '}
            <strong className="text-roche-400">{closest.wordB}</strong> comparten cercanía semántica
            (d = {closest.dNorm.toFixed(2)}). Busca dominios más opuestos.
          </p>
        </div>
      );
    }

    if (closest.status === 'stable') {
      return (
        <div className="rounded-xl border border-ivory-100/10 bg-obsidian-950/85 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[11px] text-ivory-400">Tensión entre Nodos</span>
            <span className="rounded border border-sky-400/40 bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] text-sky-300">
              Estable d={closest.dNorm.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-ivory-200">
            Par más cercano: <strong className="text-ivory-50">{closest.wordA}</strong> y{' '}
            <strong className="text-ivory-50">{closest.wordB}</strong> (d ={' '}
            {closest.dNorm.toFixed(2)}). Buena separación conceptual.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-spectral-400/30 bg-obsidian-950/85 p-3 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[11px] text-ivory-400">Tensión entre Nodos</span>
          <span className="rounded border border-spectral-400/40 bg-spectral-500/20 px-2 py-0.5 font-mono text-[10px] text-spectral-400">
            Resonancia d={closest.dNorm.toFixed(2)}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-ivory-200">
          Constelación ortogonal: incluso tu par más cercano (
          <strong className="text-spectral-400">{closest.wordA}</strong> –{' '}
          <strong className="text-spectral-400">{closest.wordB}</strong>) mantiene d ={' '}
          {closest.dNorm.toFixed(2)}.
        </p>
      </div>
    );
  };

  // Contenido reutilizable de la Bitácora Orbital
  const renderBitacoraList = () => {
    if (s.satellites.length === 0 && s.rejections.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-ivory-100/12 px-4 py-6 text-center">
          <p className="mb-1 text-xs font-medium text-ivory-200">Órbita despejada</p>
          <p className="text-[11px] leading-relaxed text-ivory-400">
            Escribe una palabra con vínculo hacia <strong className="text-ivory-100">{s.ctx?.day.core}</strong>, pero evita asociaciones obvias del mismo grupo.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {[...s.satellites].reverse().map((sat) => (
          <div
            key={sat.uid}
            onClick={() => s.setSelected(s.selectedUid === sat.uid ? null : sat.uid)}
            className={`cursor-pointer rounded-xl border p-3 transition animate-fade ${
              s.selectedUid === sat.uid
                ? 'border-astrolabe-400/60 bg-obsidian-900'
                : 'border-ivory-100/10 bg-obsidian-950/90 hover:border-ivory-100/25'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sat.color, boxShadow: `0 0 8px ${sat.color}` }}
                />
                <span className="font-mono text-xs font-bold tracking-wide text-ivory-50 sm:text-sm">
                  {sat.word}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-ivory-100/15 bg-obsidian-800/90 px-2 py-0.5 font-mono text-[10px] text-ivory-200">
                  {sat.domain}
                </span>
                {!s.sealed && s.swapsLeft > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      s.removeSatellite(sat.uid);
                    }}
                    title="Desorbitar y cambiar palabra"
                    className="rounded p-0.5 text-ivory-400 hover:bg-roche-500/20 hover:text-roche-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="pl-4 text-[11px] leading-relaxed text-ivory-400">{sat.insight}</p>
          </div>
        ))}

        {s.rejections.slice(-3).reverse().map((rej) => (
          <div
            key={rej.id}
            className="rounded-xl border border-roche-500/35 bg-roche-500/10 p-2.5 text-[11px] text-roche-400"
          >
            <div className="mb-0.5 flex items-center justify-between font-mono text-[10px]">
              <span>⚠️ LÍMITE DE ROCHE</span>
              <span className="line-through">{rej.word}</span>
            </div>
            <p className="text-[10.5px] text-ivory-200/90">{rej.reason}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={vh ? { height: vh } : undefined}
      className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-obsidian-950 text-ivory-100"
    >
      {/* ================================================================= */}
      {/* BARRA SUPERIOR                                                    */}
      {/* ================================================================= */}
      <header className="shrink-0 border-b border-ivory-100/10 bg-obsidian-900/75 px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-2xl tracking-wide text-ivory-50">ÓRBITA</span>
            <span className="rounded-full border border-astrolabe-400/35 bg-astrolabe-400/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-astrolabe-300">
              {s.mode === 'practice' ? `Práctica · ${s.ctx.day.core}` : `Día ${s.dayNumber}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {s.mode === 'practice' && (
              <button
                type="button"
                aria-label="Volver a hoy"
                title="Volver al reto oficial de hoy"
                onClick={() =>
                  s.manifest &&
                  s.loadDay(
                    s.manifest.puzzles[(s.dayNumber - 1) % s.manifest.puzzles.length].id,
                    'daily'
                  )
                }
                className="rounded-xl border border-ivory-100/12 bg-obsidian-800 px-2.5 py-1.5 text-xs text-astrolabe-300 hover:bg-obsidian-700"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {/* Botón móvil para abrir Bitácora Orbital */}
            <button
              type="button"
              onClick={() => setMobileLogOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-ivory-100/12 bg-obsidian-800 px-2.5 py-1.5 text-xs text-ivory-200 hover:bg-obsidian-700 lg:hidden"
            >
              <BookOpen className="h-3.5 w-3.5 text-astrolabe-400" />
              <span className="font-mono text-[11px]">
                Bitácora ({s.satellites.length})
              </span>
            </button>

            <button
              type="button"
              aria-label="Ranking e historial"
              title="Ranking global e historial"
              onClick={() => s.setShowStats(true)}
              className="flex items-center gap-1.5 rounded-xl border border-ivory-100/12 bg-obsidian-800 px-2.5 py-1.5 text-xs text-ivory-200 hover:bg-obsidian-700"
            >
              <BarChart3 className="h-4 w-4 text-spectral-400" />
              <span className="hidden sm:inline">Ranking</span>
            </button>

            <button
              type="button"
              aria-label="Sonido"
              onClick={s.toggleSound}
              className="rounded-xl border border-ivory-100/12 bg-obsidian-800 p-2 text-ivory-200 hover:bg-obsidian-700"
            >
              {s.soundOn ? (
                <Volume2 className="h-4 w-4 text-astrolabe-400" />
              ) : (
                <VolumeX className="h-4 w-4 text-ivory-400" />
              )}
            </button>

            <button
              type="button"
              aria-label="¿Cómo funciona?"
              onClick={() => s.setShowHelp(true)}
              className="flex items-center gap-1 rounded-xl border border-spectral-400/35 bg-spectral-500/10 px-2.5 py-1.5 text-xs text-spectral-400 hover:bg-spectral-500/20"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden md:inline">¿Cómo funciona?</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* CONTENEDOR PRINCIPAL: RADAR (IZQUIERDA) + TELEMETRÍA Y BITÁCORA   */}
      {/* ================================================================= */}
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 p-2.5 sm:p-4 lg:flex-row">
        {/* COLUMNA IZQUIERDA (65%): RADAR GRAVITACIONAL + CONSOLA */}
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ivory-100/10 bg-obsidian-900/50 shadow-2xl">
          {/* Cinta compacta de Telemetría en Móvil */}
          <div className="border-b border-ivory-100/10 bg-obsidian-950/75 px-3 py-2 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-ivory-400">Órbita</span>
                <span className="font-mono text-sm font-bold text-ivory-50">
                  {s.satellites.length}/{TARGET}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: TARGET }, (_, i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: s.satellites[i]?.color ?? 'rgba(244,240,234,0.15)',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-ivory-400">
                  Índice DAT:
                </span>
                <span className="font-mono text-base font-bold text-spectral-400">
                  {s.satellites.length >= 2 ? tel.score.toFixed(1) : '--'}
                </span>
                {closest && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      closest.status === 'friction'
                        ? 'bg-roche-500/20 text-roche-400'
                        : 'bg-spectral-500/20 text-spectral-400'
                    }`}
                  >
                    d={closest.dNorm.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Lienzo del Radar */}
          <div className="relative min-h-0 flex-1">
            <OrbitCanvas />

            {/* Cajón móvil desplegable de Bitácora y Telemetría */}
            {mobileLogOpen && (
              <div className="absolute inset-0 z-20 flex flex-col gap-3 overflow-y-auto bg-obsidian-950/95 p-3.5 backdrop-blur-md lg:hidden animate-fade">
                <div className="flex items-center justify-between border-b border-ivory-100/10 pb-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-astrolabe-300">
                    Telemetría Cognitiva y Bitácora
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileLogOpen(false)}
                    className="rounded-lg p-1 text-ivory-400 hover:text-ivory-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {renderTensionMonitor()}
                <div className="flex items-center justify-between font-mono text-[11px] text-ivory-400">
                  <span>BITÁCORA ORBITAL</span>
                  <span>
                    {s.rejections.length} {s.rejections.length === 1 ? 'rechazo' : 'rechazos'}
                  </span>
                </div>
                {renderBitacoraList()}
              </div>
            )}
          </div>

          {/* Consola Inferior de Lanzamiento */}
          <footer className="border-t border-ivory-100/10 bg-obsidian-950/90 px-3.5 py-3">
            <p
              key={s.feedback?.id ?? 0}
              className={`mb-2 text-center text-xs leading-snug animate-fade ${
                s.feedback ? TONE[s.feedback.tone] : 'text-ivory-400'
              }`}
            >
              {s.feedback?.text ??
                (s.satellites.length === 0
                  ? `Lanza un concepto conectado a ${s.ctx.day.core} evitando lo obvio.`
                  : 'Busca que cada nuevo satélite pertenezca a un dominio totalmente distinto.')}
            </p>

            {s.satellites.length > 0 && (
              <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {s.satellites.map((sat) => (
                  <button
                    key={sat.uid}
                    type="button"
                    disabled={s.sealed}
                    onClick={() => s.removeSatellite(sat.uid)}
                    title={s.swapsLeft > 0 ? `${sat.domain} · Toca para cambiarla` : sat.domain}
                    className="group flex shrink-0 items-center gap-1.5 rounded-full border border-ivory-100/12 bg-obsidian-900 py-1 pl-2.5 pr-2 font-mono text-[11px] text-ivory-100 transition hover:border-ivory-100/30 disabled:opacity-70"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: sat.color }} />
                    {sat.word}
                    {!s.sealed && (
                      <X className="h-3 w-3 text-ivory-400 group-hover:text-roche-400" />
                    )}
                  </button>
                ))}
                {!s.sealed && (
                  <span
                    className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-ivory-400"
                    title="Cambios tácticos disponibles"
                  >
                    ↺ {s.swapsLeft}/{MAX_SWAPS} cambios
                  </span>
                )}
              </div>
            )}

            {s.sealed ? (
              <button
                type="button"
                onClick={() => s.setShowResult(true)}
                className="w-full rounded-xl bg-astrolabe-400 py-3 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300"
              >
                Ver Carta Astral y Constelación Ideal · {tel.score.toFixed(1)} pts
              </button>
            ) : full ? (
              <button
                type="button"
                onClick={s.seal}
                className="w-full animate-pulse rounded-xl bg-astrolabe-400 py-3 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300"
              >
                Sellar Constelación ({tel.score.toFixed(1)} pts)
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
                  placeholder={`Lanza el satélite ${s.satellites.length + 1}/${TARGET} alrededor de ${s.ctx.day.core}…`}
                  className="min-w-0 flex-1 rounded-xl border border-ivory-100/15 bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory-50 outline-none transition placeholder:text-ivory-400/60 focus:border-astrolabe-400/70 sm:text-base"
                />
                <button
                  type="submit"
                  aria-label="Lanzar"
                  disabled={Boolean(s.probe) || !value.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-astrolabe-400 px-4 py-2.5 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300 disabled:bg-obsidian-800 disabled:text-ivory-400/40"
                >
                  <span>Lanzar</span>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </footer>
        </section>

        {/* COLUMNA DERECHA (35% EN DESKTOP): TELEMETRÍA COGNITIVA + BITÁCORA ORBITAL */}
        <aside className="hidden w-[360px] shrink-0 flex-col gap-3 xl:w-[390px] lg:flex">
          {/* 1. TELEMETRÍA COGNITIVA */}
          <div className="rounded-2xl border border-ivory-100/10 bg-obsidian-900/70 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-wider text-ivory-400">
                Telemetría Cognitiva
              </h2>
              <button
                type="button"
                onClick={() => setShowIndexInfo((v) => !v)}
                className="flex items-center gap-1 font-mono text-[11px] text-astrolabe-300 hover:underline"
              >
                <Info className="h-3.5 w-3.5" />
                <span>Fórmula DAT Harvard</span>
              </button>
            </div>

            {showIndexInfo && (
              <div className="mb-3 rounded-xl border border-astrolabe-400/30 bg-astrolabe-400/10 p-2.5 text-[11px] leading-relaxed text-ivory-100 animate-fade">
                <strong>¿Qué es el Índice Divergente?</strong> Mide de 0 a 100 qué tan alejados
                están tus 5 conceptos entre sí (10 pares posibles) manteniendo vínculo con{' '}
                <strong>{s.ctx.day.core}</strong>. En Harvard, el promedio humano es{' '}
                <strong>78</strong>; superar <strong>83+</strong> te ubica en rango{' '}
                <strong className="text-spectral-400">Arquitecto (Top 10%)</strong>.
              </div>
            )}

            <div className="mb-3.5 grid grid-cols-2 gap-2.5">
              {/* Satélites en Órbita */}
              <div className="rounded-xl border border-ivory-100/10 bg-obsidian-950/85 p-3">
                <div className="mb-1 text-[11px] text-ivory-400">Satélites en Órbita</div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-ivory-50">
                    {s.satellites.length}
                    <span className="text-base text-ivory-400">/{TARGET}</span>
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: TARGET }, (_, i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full transition-all"
                        style={{
                          backgroundColor: s.satellites[i]?.color ?? '#1E293B',
                          boxShadow: s.satellites[i] ? `0 0 6px ${s.satellites[i].color}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Índice Divergente */}
              <div className="rounded-xl border border-ivory-100/10 bg-obsidian-950/85 p-3">
                <div className="mb-1 text-[11px] text-ivory-400">Índice Divergente</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-bold text-spectral-400 tabular-nums">
                    {s.satellites.length >= 2 ? tel.score.toFixed(1) : '--'}
                  </span>
                  <span className="font-mono text-[10px] text-ivory-400">
                    {tel.pairCount} {tel.pairCount === 1 ? 'par' : 'pares'}
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de Referencia Psicométrica */}
            <div className="mb-3.5">
              <div className="mb-1 flex justify-between font-mono text-[10px] text-ivory-400">
                <span>Lineal (50)</span>
                <span>Promedio (78)</span>
                <span className="text-spectral-400">Arquitecto (85+)</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full border border-ivory-100/10 bg-obsidian-950">
                <div
                  className="absolute bottom-0 top-0 z-10 w-0.5 bg-ivory-200/70"
                  style={{ left: '78%' }}
                  title="Promedio humano Harvard: 78"
                />
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-teal-400 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${s.satellites.length >= 2 ? Math.min(100, Math.max(5, tel.score)) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Monitor de Tensión entre Nodos */}
            {renderTensionMonitor()}
          </div>

          {/* 2. BITÁCORA ORBITAL */}
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-ivory-100/10 bg-obsidian-900/70 p-4 shadow-xl">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-wider text-ivory-400">
                Bitácora Orbital
              </h2>
              <span className="font-mono text-[11px] text-ivory-400">
                {s.rejections.length} {s.rejections.length === 1 ? 'rechazo' : 'rechazos'}
              </span>
            </div>

            {renderBitacoraList()}
          </div>
        </aside>
      </div>

      <HelpSheet />
      <ResultSheet />
      <StatsSheet />
    </div>
  );
};
