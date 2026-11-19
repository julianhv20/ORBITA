'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useOrbitaStore } from '../store/useOrbitaStore';

export const HelpSheet: React.FC = () => {
  const open = useOrbitaStore((s) => s.showHelp);
  const setOpen = useOrbitaStore((s) => s.setShowHelp);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ivory-100/15 bg-obsidian-800/95 p-5 text-ivory-100 shadow-2xl sm:p-6 animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ivory-100/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪐</span>
            <h3 className="text-base font-bold text-ivory-50 sm:text-lg">
              La Ciencia detrás de ÓRBITA
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-ivory-400 transition hover:bg-ivory-100/10 hover:text-ivory-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 py-4 text-xs leading-relaxed text-ivory-200 sm:text-sm">
          <p>
            Basado en el{' '}
            <strong className="text-spectral-400">Divergent Association Task (DAT)</strong> de la
            Universidad de Harvard (Olson et al., 2021) y la teoría de la{' '}
            <strong className="text-astrolabe-300">Bisociación</strong> de Arthur Koestler: las
            mentes más creativas logran conectar un concepto central con dominios radicalmente
            distantes entre sí.
          </p>

          <div className="space-y-2.5 rounded-xl border border-ivory-100/10 bg-obsidian-950/90 p-3.5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ivory-400">
              Reglas en 10 Segundos
            </div>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <span className="font-bold text-spectral-400">1.</span>
                <span>
                  Lanza <strong>5 palabras</strong> que tengan una relación real (funcional,
                  metafórica, científica o cultural) con la <strong>Palabra Núcleo</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-roche-400">2.</span>
                <span>
                  <strong>Evita el Límite de Roche:</strong> si pones sinónimos directos o derivados
                  (ej. <em>relojes</em>, <em>hora</em> para RELOJ), caerán al centro y serán
                  rechazados.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-astrolabe-300">3.</span>
                <span>
                  <strong>Maximiza la repulsión:</strong> tus 5 palabras deben pertenecer a mundos
                  distintos. Si pones <em>minuto</em> y <em>segundo</em>, aparecerá una línea roja
                  de fricción que bajará tu puntaje.
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-1.5 rounded-xl border border-ivory-100/10 bg-obsidian-900/70 p-3.5 text-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-astrolabe-300">
              ¿Qué mide tu Índice Divergente (0 a 100)?
            </div>
            <p className="text-ivory-200">
              Calcula la distancia semántica promedio entre los <strong>10 pares</strong> que forman
              tus 5 satélites (70%) más la fuerza de su vínculo con el núcleo (30%):
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="rounded-lg border border-ivory-100/10 bg-obsidian-950 p-2 text-center">
                <div className="font-bold text-roche-400">&lt; 65 pts</div>
                <div className="text-[10px] text-ivory-400">Lineal</div>
              </div>
              <div className="rounded-lg border border-ivory-100/10 bg-obsidian-950 p-2 text-center">
                <div className="font-bold text-spectral-400">75 – 82 pts</div>
                <div className="text-[10px] text-ivory-400">Media Harvard</div>
              </div>
              <div className="rounded-lg border border-astrolabe-400/30 bg-obsidian-950 p-2 text-center">
                <div className="font-bold text-astrolabe-300">85+ pts</div>
                <div className="text-[10px] text-ivory-400">Arquitecto (Top)</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-spectral-400/30 bg-spectral-500/10 p-3 text-xs">
            <span className="mb-1 block font-mono font-semibold text-spectral-400">
              Ejemplo para Núcleo: RELOJ
            </span>
            <span className="text-ivory-400">❌ Lineal (62 pts):</span>{' '}
            <span className="text-ivory-200">tiempo, hora, aguja, pulsera, alarma</span>
            <br />
            <span className="text-spectral-400">✅ Divergente (88 pts):</span>{' '}
            <span className="font-medium text-ivory-50">
              arena, surrealismo, biología, cuco, cuarzo
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-xl bg-astrolabe-400 px-5 py-2.5 text-xs font-semibold text-obsidian-950 transition hover:bg-astrolabe-300 sm:w-auto sm:text-sm"
          >
            Entendido, volver al Radar
          </button>
        </div>
      </div>
    </div>
  );
};
