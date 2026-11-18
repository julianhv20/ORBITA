'use client';

import React from 'react';
import { X, Compass, Flame, Sparkles } from 'lucide-react';
import { useOrbitaStore } from '../store/useOrbitaStore';

export const OnboardingModal: React.FC = () => {
  const show = useOrbitaStore((s) => s.showOnboarding);
  const setShow = useOrbitaStore((s) => s.setShowOnboarding);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => setShow(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-obsidian-800/95 border border-astrolabe-400/30 shadow-2xl p-5 sm:p-6 text-ivory-100 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-ivory-100/10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-astrolabe-400 block mb-0.5">
              Ritual Diario de Bisociación · Harvard DAT
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl text-ivory-50 tracking-wide">
              Cómo navegar en ÓRBITA
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="p-1.5 rounded-lg text-ivory-400 hover:text-ivory-50 hover:bg-ivory-100/10 transition-colors"
            aria-label="Cerrar guía"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-3.5 text-xs sm:text-sm text-ivory-200 leading-relaxed">
          <p className="text-ivory-400">
            No buscas adivinar una palabra oculta. Tu objetivo es colocar{' '}
            <strong className="text-ivory-50">5 conceptos en órbita</strong> alrededor del Astro
            Central maximizando la distancia mental entre ellos.
          </p>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-obsidian-900/90 border border-ivory-100/10">
              <Compass className="w-4 h-4 text-spectral-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-ivory-50 text-xs uppercase tracking-wider mb-0.5">
                  1. Gravedad Real con el Centro
                </div>
                <p className="text-xs text-ivory-400">
                  Cada palabra debe tener un vínculo cultural, científico, funcional o poético con
                  el núcleo. Sin relación alguna, escapará al <strong>Vacío Exterior</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-obsidian-900/90 border border-roche-500/25">
              <Flame className="w-4 h-4 text-roche-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-roche-400 text-xs uppercase tracking-wider mb-0.5">
                  2. Prohibido lo Obvio (Límite de Roche)
                </div>
                <p className="text-xs text-ivory-400">
                  Derivados y asociaciones automáticas (ej. <em>hora</em> o <em>minuto</em> para{' '}
                  <strong>RELOJ</strong>) caen al anillo rojo interior y se incineran.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-obsidian-900/90 border border-astrolabe-400/25">
              <Sparkles className="w-4 h-4 text-astrolabe-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-astrolabe-300 text-xs uppercase tracking-wider mb-0.5">
                  3. Ocho Impulsos y Eyección Táctica
                </div>
                <p className="text-xs text-ivory-400">
                  Cuentas con <strong>8 impulsos</strong>. Si dos satélites caen en el mismo
                  cuadrante y trazan una línea roja de fricción, toca uno para{' '}
                  <strong>eyectarlo</strong> y reemplazarlo antes de sellar tu constelación.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-astrolabe-400/10 border border-astrolabe-400/30 p-3 text-xs">
            <div className="font-mono text-[10px] uppercase tracking-widest text-astrolabe-300 mb-1">
              Ejemplo · Núcleo: RELOJ
            </div>
            <div className="text-ivory-400">
              <span className="text-roche-400 font-mono">Lineal (54 pts):</span> pulsera · muñeca ·
              dalí · surrealismo · péndulo
            </div>
            <div className="text-ivory-50 mt-0.5">
              <span className="text-spectral-400 font-mono">Divergente (91+ pts):</span> arena ·
              dalí · circadiano · cesio · ajedrez
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShow(false)}
          className="w-full py-3 rounded-xl bg-astrolabe-400 hover:bg-astrolabe-300 text-obsidian-950 font-semibold text-sm tracking-wide transition-colors"
        >
          Entrar al Observatorio
        </button>
      </div>
    </div>
  );
};
