'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Flame,
  HelpCircle,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  MAX_IMPULSES,
  TARGET_SATELLITES,
  useOrbitaStore,
} from '../store/useOrbitaStore';
import { AstrolabeCanvas } from '../canvas/AstrolabeCanvas';
import { OnboardingModal } from './OnboardingModal';
import { ResultModal } from './ResultModal';
import { LabArchiveDrawer } from './LabArchiveDrawer';
import { synth } from '../audio/synthEngine';

export const OrbitaStage: React.FC = () => {
  const isBooting = useOrbitaStore((s) => s.isBooting);
  const bootError = useOrbitaStore((s) => s.bootError);
  const initializeApp = useOrbitaStore((s) => s.initializeApp);

  const mode = useOrbitaStore((s) => s.mode);
  const activePack = useOrbitaStore((s) => s.activePack);
  const satellites = useOrbitaStore((s) => s.satellites);
  const telemetry = useOrbitaStore((s) => s.telemetry);
  const impulsesLeft = useOrbitaStore((s) => s.impulsesLeft);
  const impulseLog = useOrbitaStore((s) => s.impulseLog);
  const isSealed = useOrbitaStore((s) => s.isSealed);
  const inFlightProbe = useOrbitaStore((s) => s.inFlightProbe);
  const inputShakeNonce = useOrbitaStore((s) => s.inputShakeNonce);
  const banner = useOrbitaStore((s) => s.banner);
  const selectedUid = useOrbitaStore((s) => s.selectedSatelliteUid);
  const soundEnabled = useOrbitaStore((s) => s.soundEnabled);
  const stats = useOrbitaStore((s) => s.stats);

  const submitWord = useOrbitaStore((s) => s.submitWord);
  const ejectSatellite = useOrbitaStore((s) => s.ejectSatellite);
  const sealConstellation = useOrbitaStore((s) => s.sealConstellation);
  const resetLabSession = useOrbitaStore((s) => s.resetLabSession);
  const setSelectedSatellite = useOrbitaStore((s) => s.setSelectedSatellite);
  const setShowOnboarding = useOrbitaStore((s) => s.setShowOnboarding);
  const setShowResultModal = useOrbitaStore((s) => s.setShowResultModal);
  const setShowLabSelector = useOrbitaStore((s) => s.setShowLabSelector);
  const toggleSound = useOrbitaStore((s) => s.toggleSound);

  const [inputValue, setInputValue] = useState('');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Adaptación exacta a visualViewport para que el teclado móvil en iOS/Android jamás oculte el radar
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateHeight = () => setViewportHeight(Math.round(vv.height));
    updateHeight();
    vv.addEventListener('resize', updateHeight);
    return () => vv.removeEventListener('resize', updateHeight);
  }, []);

  // Shake corto en la consola cuando hay palabra fuera del léxico (0 impulsos)
  useEffect(() => {
    if (inputShakeNonce === 0) return;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 360);
    return () => clearTimeout(t);
  }, [inputShakeNonce]);

  // Contador elástico suave para el Índice Divergente en tiempo real
  useEffect(() => {
    let raf = 0;
    const from = animatedScore;
    const to = telemetry.score;
    if (Math.abs(to - from) < 0.05) {
      setAnimatedScore(to);
      return;
    }
    const start = performance.now();
    const duration = 380;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setAnimatedScore(Number((from + (to - from) * ease).toFixed(1)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.score]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || inFlightProbe || isSealed) return;
    synth.ensureGraph();
    submitWord(trimmed);
    setInputValue('');
  };

  const selectedSatellite = satellites.find((s) => s.uid === selectedUid) ?? null;

  if (isBooting) {
    return (
      <div className="h-[100dvh] w-full bg-obsidian-950 flex flex-col items-center justify-center text-ivory-100 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-astrolabe-400/30 border-t-astrolabe-400 animate-spin" />
        <p className="font-mono text-xs tracking-widest uppercase text-ivory-400">
          Calibrando Astrolabio Semántico...
        </p>
      </div>
    );
  }

  if (bootError || !activePack) {
    return (
      <div className="h-[100dvh] w-full bg-obsidian-950 flex flex-col items-center justify-center text-ivory-100 p-6 text-center">
        <p className="font-serif text-2xl text-roche-400 mb-2">Interrupción de Telemetría</p>
        <p className="font-mono text-xs text-ivory-400 max-w-md">{bootError}</p>
      </div>
    );
  }

  const canSealEarly = satellites.length === TARGET_SATELLITES && !isSealed && !inFlightProbe;

  return (
    <div
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
      className="h-[100dvh] w-full bg-obsidian-950 text-ivory-100 flex flex-col overflow-hidden relative"
    >
      {/* =================================================================== */}
      {/* 1. CABECERA ASTRO-CARTOGRÁFICA MINIMALISTA                          */}
      {/* =================================================================== */}
      <header className="shrink-0 border-b border-ivory-100/10 bg-obsidian-900/80 backdrop-blur-md px-3 sm:px-5 py-2.5 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setShowLabSelector(true)}
              className="group flex items-center gap-2.5 text-left"
              title="Cambiar entre Ritual Diario y Modo Laboratorio"
            >
              <div className="w-8 h-8 rounded-full border border-astrolabe-400/50 bg-astrolabe-400/10 flex items-center justify-center shrink-0 group-hover:border-astrolabe-300 transition-colors">
                <span className="text-astrolabe-400 text-sm">🪐</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-xl sm:text-2xl tracking-wide text-ivory-50 leading-none">
                    ÓRBITA
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      mode === 'daily'
                        ? 'bg-astrolabe-400/15 text-astrolabe-300 border-astrolabe-400/35'
                        : 'bg-spectral-400/15 text-spectral-400 border-spectral-400/35'
                    }`}
                  >
                    {mode === 'daily' ? `#${activePack.meta.id}` : `LAB · #${activePack.meta.id}`}
                  </span>
                </div>
                <p className="text-[11px] text-ivory-400 truncate hidden sm:block mt-0.5">
                  {activePack.meta.subtitle}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {stats.currentStreak > 0 && (
              <div
                className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-obsidian-800 border border-astrolabe-400/25 font-mono text-xs text-astrolabe-300"
                title="Racha Solar diaria"
              >
                <Flame className="w-3.5 h-3.5 text-astrolabe-400" />
                <span>{stats.currentStreak}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowLabSelector(true)}
              className="px-2.5 py-1.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-ivory-100/12 text-ivory-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-astrolabe-400" />
              <span className="hidden md:inline">Astros</span>
            </button>

            {mode === 'lab' && (
              <button
                type="button"
                onClick={resetLabSession}
                title="Reiniciar práctica de laboratorio"
                className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-ivory-100/12 text-ivory-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {isSealed && (
              <button
                type="button"
                onClick={() => setShowResultModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-astrolabe-400/20 hover:bg-astrolabe-400/30 border border-astrolabe-400/45 text-astrolabe-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Carta Astral</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleSound}
              title={soundEnabled ? 'Silenciar sintetizador espacial' : 'Activar sintetizador espacial'}
              className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-ivory-100/12 text-ivory-200 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-astrolabe-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-ivory-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              title="Guía rápida de ÓRBITA"
              className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-ivory-100/12 text-ivory-200 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-ivory-200" />
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. BARRA SUPERIOR DE TELEMETRÍA VIVA (SCORE, RANURAS E IMPULSOS)    */}
      {/* =================================================================== */}
      <div className="shrink-0 bg-obsidian-900/55 border-b border-ivory-100/8 px-3 sm:px-5 py-2 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          {/* Índice Divergente */}
          <div className="flex items-center gap-3">
            <div>
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-ivory-400 block">
                Índice Divergente
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-ivory-50 tabular-nums leading-none">
                  {satellites.length >= 2 ? animatedScore.toFixed(1) : '--'}
                </span>
                <span className="font-mono text-[10px] text-ivory-400">
                  {satellites.length >= 2 ? telemetry.rank.title : 'lanza 2+ nodos'}
                </span>
              </div>
            </div>

            {/* Indicador de 5 Satélites */}
            <div className="pl-3 border-l border-ivory-100/10">
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-ivory-400 block mb-1">
                Órbita {satellites.length}/{TARGET_SATELLITES}
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: TARGET_SATELLITES }, (_, idx) => {
                  const sat = satellites[idx];
                  return (
                    <span
                      key={idx}
                      className="w-2.5 h-2.5 rounded-full transition-all"
                      style={{
                        backgroundColor: sat ? sat.color.hex : 'rgba(244, 240, 234, 0.12)',
                        boxShadow: sat ? `0 0 8px ${sat.color.hex}` : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Celdas de Combustible / 8 Impulsos + Botón Sellar */}
          <div className="flex items-center gap-3 ml-auto">
            <div>
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-ivory-400 block text-right mb-1">
                Impulsos {impulsesLeft}/{MAX_IMPULSES}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: MAX_IMPULSES }, (_, idx) => {
                  const usedCount = MAX_IMPULSES - impulsesLeft;
                  const isRemaining = idx >= usedCount;
                  const logItem = impulseLog[idx];

                  let bg = 'bg-astrolabe-400 shadow-[0_0_6px_rgba(229,169,60,0.5)]';
                  if (!isRemaining) {
                    if (logItem?.outcome === 'ROCHE_LIMIT') bg = 'bg-roche-500/45';
                    else if (logItem?.outcome === 'OUTER_VOID') bg = 'bg-ivory-400/25';
                    else bg = 'bg-spectral-400/35';
                  }

                  return <span key={idx} className={`w-3.5 h-1.5 rounded-sm transition-all ${bg}`} />;
                })}
              </div>
            </div>

            {canSealEarly && (
              <button
                type="button"
                onClick={sealConstellation}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-astrolabe-400 to-astrolabe-300 hover:brightness-110 text-obsidian-950 font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-astrolabe-400/20 animate-pulse"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sellar Constelación</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. ESCENARIO CENTRAL DEL ASTROLABIO (ESCALADO DINÁMICO 100DVH)      */}
      {/* =================================================================== */}
      <main className="relative flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col lg:flex-row">
        {/* Lienzo Astronómico */}
        <div className="relative flex-1 min-h-0 w-full h-full">
          <AstrolabeCanvas />

          {/* Banner Contextual Sutil Superior */}
          {banner && (
            <div
              key={banner.id}
              className={`pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-md w-[92%] sm:w-auto px-3.5 py-2 rounded-xl border backdrop-blur-md text-xs text-center shadow-xl transition-all ${
                banner.tone === 'crimson'
                  ? 'bg-roche-500/15 border-roche-500/45 text-roche-400'
                  : banner.tone === 'gold'
                    ? 'bg-astrolabe-400/15 border-astrolabe-400/45 text-astrolabe-300'
                    : banner.tone === 'emerald'
                      ? 'bg-spectral-500/15 border-spectral-400/45 text-spectral-400'
                      : 'bg-obsidian-800/90 border-ivory-100/20 text-ivory-200'
              }`}
            >
              {banner.text}
            </div>
          )}

          {/* Inspector Táctil del Satélite Seleccionado + Botón de Eyección */}
          {selectedSatellite && (
            <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-20 rounded-2xl bg-obsidian-800/95 border border-ivory-100/20 backdrop-blur-md p-3 shadow-2xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedSatellite.color.hex }}
                    />
                    <span className="font-mono font-bold text-sm text-ivory-50">
                      {selectedSatellite.word}
                    </span>
                    <span className="font-mono text-[10px] text-astrolabe-300 truncate">
                      · {selectedSatellite.domain}
                    </span>
                  </div>
                  <p className="text-[11px] text-ivory-200 mt-1 leading-snug">
                    {selectedSatellite.insight}
                  </p>
                  <div className="font-mono text-[10px] text-ivory-400 mt-1.5">
                    Gravedad con {activePack.meta.coreWord}:{' '}
                    {(selectedSatellite.gravity * 100).toFixed(0)}%
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSatellite(null)}
                  className="text-ivory-400 hover:text-ivory-50 p-0.5"
                  aria-label="Cerrar inspector"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {!isSealed && impulsesLeft > 0 && (
                <div className="mt-2.5 pt-2 border-t border-ivory-100/10 flex items-center justify-between">
                  <span className="text-[10px] text-ivory-400">
                    ¿Colisiona con otro nodo?
                  </span>
                  <button
                    type="button"
                    onClick={() => ejectSatellite(selectedSatellite.uid)}
                    className="px-2.5 py-1 rounded-lg bg-roche-500/15 hover:bg-roche-500/25 border border-roche-500/40 text-roche-400 font-mono text-[11px] font-semibold transition-colors"
                  >
                    Eyectar Satélite ↺
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel Lateral Derecho (Visible solo en pantallas anchas Desktop como Bitácora) */}
        <aside className="hidden lg:flex lg:w-80 shrink-0 border-l border-ivory-100/10 bg-obsidian-900/45 p-4 flex-col justify-between gap-4 overflow-y-auto">
          <div className="space-y-3">
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-astrolabe-400 mb-1">
                 Astro Central · w₀
              </h2>
              <div className="font-serif text-3xl text-ivory-50">{activePack.meta.coreWord}</div>
              <p className="text-xs text-ivory-400 mt-1 leading-relaxed">{activePack.meta.hint}</p>
            </div>

            {/* Diagnóstico de Tensión Más Cercana */}
            <div className="rounded-xl bg-obsidian-900/90 border border-ivory-100/10 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ivory-400">
                  Par más cercano
                </span>
                {telemetry.closestPair && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                      telemetry.closestPair.status === 'friction'
                        ? 'bg-roche-500/20 text-roche-400'
                        : 'bg-spectral-500/20 text-spectral-400'
                    }`}
                  >
                    d={(telemetry.closestPair.distance * 100).toFixed(0)}
                  </span>
                )}
              </div>
              {telemetry.closestPair ? (
                <p className="text-[11px] text-ivory-200 leading-relaxed">
                  <strong>{telemetry.closestPair.wordA}</strong> ↔{' '}
                  <strong>{telemetry.closestPair.wordB}</strong>{' '}
                  {telemetry.closestPair.status === 'friction'
                    ? 'comparten cercanía semántica. Eyecta uno si te quedan impulsos.'
                    : 'mantienen excelente separación conceptual.'}
                </p>
              ) : (
                <p className="text-[11px] text-ivory-400">
                  Coloca al menos 2 satélites para medir la divergencia en el plano tangente.
                </p>
              )}
            </div>

            {/* Lista de Satélites Activos */}
            <div className="space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ivory-400">
                Satélites Estabilizados ({satellites.length}/5)
              </div>
              {satellites.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ivory-100/12 p-4 text-center text-xs text-ivory-400">
                  Órbita despejada. Lanza tu primer concepto abajo.
                </div>
              ) : (
                satellites.map((sat) => (
                  <button
                    key={sat.uid}
                    type="button"
                    onClick={() =>
                      setSelectedSatellite(selectedUid === sat.uid ? null : sat.uid)
                    }
                    className={`w-full text-left rounded-xl p-2.5 border transition-all ${
                      selectedUid === sat.uid
                        ? 'bg-obsidian-800 border-astrolabe-400/50'
                        : 'bg-obsidian-900/70 border-ivory-100/10 hover:border-ivory-100/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sat.color.hex }}
                        />
                        <span className="font-mono text-xs font-bold text-ivory-50 truncate">
                          {sat.word}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-ivory-400 truncate">
                        {sat.domain}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="text-[10px] font-mono text-ivory-400/70 border-t border-ivory-100/10 pt-2.5 flex justify-between">
            <span>Motor ORBT v1 · 128D Int8</span>
            <span>Óptimo hoy: {activePack.sMax.toFixed(1)}</span>
          </div>
        </aside>
      </main>

      {/* =================================================================== */}
      {/* 4. CONSOLA INFERIOR DE LANZAMIENTO (MOBILE-FIRST & SHAKE FEEDBACK)  */}
      {/* =================================================================== */}
      <footer className="shrink-0 border-t border-ivory-100/12 bg-obsidian-900/95 backdrop-blur-md px-3 sm:px-5 py-2.5 z-20">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Tira compacta de chips en móvil para inspeccionar/eyectar rápido */}
          {satellites.length > 0 && (
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {satellites.map((sat) => (
                <button
                  key={sat.uid}
                  type="button"
                  onClick={() => setSelectedSatellite(selectedUid === sat.uid ? null : sat.uid)}
                  className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[11px] border flex items-center gap-1.5 transition-colors ${
                    selectedUid === sat.uid
                      ? 'bg-obsidian-800 border-astrolabe-400 text-ivory-50'
                      : 'bg-obsidian-950/90 border-ivory-100/15 text-ivory-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: sat.color.hex }}
                  />
                  <span>{sat.word}</span>
                </button>
              ))}
            </div>
          )}

          {isSealed ? (
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="text-xs sm:text-sm text-ivory-200">
                Constelación sellada con{' '}
                <strong className="font-mono text-astrolabe-300">
                  {telemetry.score.toFixed(1)} pts
                </strong>{' '}
                ({telemetry.rank.title}).
              </div>
              <button
                type="button"
                onClick={() => setShowResultModal(true)}
                className="px-4 py-2.5 rounded-xl bg-astrolabe-400 hover:bg-astrolabe-300 text-obsidian-950 font-semibold text-xs sm:text-sm shrink-0 transition-colors"
              >
                Ver Carta Astral y Óptimo
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleFormSubmit}
              className={`flex items-center gap-2 ${shaking ? 'animate-shake' : ''}`}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={Boolean(inFlightProbe)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={28}
                placeholder={
                  satellites.length >= TARGET_SATELLITES
                    ? 'Órbita 5/5: sella arriba o toca un nodo para eyectarlo...'
                    : `Lanza un concepto conectado a ${activePack.meta.coreWord}...`
                }
                className="flex-1 bg-obsidian-950 border border-ivory-100/18 focus:border-astrolabe-400/80 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm sm:text-base text-ivory-50 placeholder:text-ivory-400/60 outline-none transition-colors font-sans"
              />
              <button
                type="submit"
                disabled={Boolean(inFlightProbe) || !inputValue.trim()}
                className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-astrolabe-400 hover:bg-astrolabe-300 disabled:bg-obsidian-800 disabled:text-ivory-400/40 text-obsidian-950 font-semibold text-sm flex items-center gap-2 shrink-0 transition-all"
              >
                <span>{inFlightProbe ? 'Vuelo...' : 'Lanzar'}</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </footer>

      {/* Modales del Observatorio */}
      <OnboardingModal />
      <ResultModal />
      <LabArchiveDrawer />
    </div>
  );
};
