'use client';

import React from 'react';
import { X, Sparkles, FlaskConical } from 'lucide-react';
import { useOrbitaStore } from '../store/useOrbitaStore';

export const LabArchiveDrawer: React.FC = () => {
  const show = useOrbitaStore((s) => s.showLabSelector);
  const setShow = useOrbitaStore((s) => s.setShowLabSelector);
  const manifest = useOrbitaStore((s) => s.manifest);
  const dailyPuzzleId = useOrbitaStore((s) => s.dailyPuzzleId);
  const activePuzzleId = useOrbitaStore((s) => s.activePuzzleId);
  const mode = useOrbitaStore((s) => s.mode);
  const selectPuzzle = useOrbitaStore((s) => s.selectPuzzle);

  if (!show || !manifest) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => setShow(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-obsidian-800/95 border border-ivory-100/15 shadow-2xl p-5 text-ivory-100 max-h-[88dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-ivory-100/10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-astrolabe-400 block">
              Catálogo Estelar · Temporada {manifest.season}
            </span>
            <h2 className="font-serif text-2xl text-ivory-50">
              Ritual Diario y Modo Laboratorio
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="p-1.5 rounded-lg text-ivory-400 hover:text-ivory-50 hover:bg-ivory-100/10 transition-colors"
            aria-label="Cerrar selector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-ivory-400 py-2.5">
          El <strong>Ritual Diario</strong> guarda tu racha oficial de hoy. En el{' '}
          <strong>Modo Laboratorio</strong> puedes practicar libremente con cualquiera de los 10
          astros de la temporada.
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {manifest.puzzles.map((p) => {
            const isTodayOfficial = p.id === dailyPuzzleId;
            const isActive = p.id === activePuzzleId;

            return (
              <div
                key={p.id}
                className={`rounded-xl p-3 border transition-all flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-obsidian-900 border-astrolabe-400/60'
                    : 'bg-obsidian-900/60 border-ivory-100/10 hover:border-ivory-100/25'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.accent }}
                    />
                    <span className="font-mono text-xs text-ivory-400">#{p.id}</span>
                    <span className="font-serif text-lg text-ivory-50 tracking-wide">
                      {p.coreWord}
                    </span>
                    {isTodayOfficial && (
                      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-astrolabe-400/20 text-astrolabe-300 border border-astrolabe-400/40">
                        Hoy
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ivory-400 truncate mt-0.5">{p.subtitle}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isTodayOfficial && (
                    <button
                      type="button"
                      onClick={() => selectPuzzle(p.id, 'daily')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        isActive && mode === 'daily'
                          ? 'bg-astrolabe-400 text-obsidian-950'
                          : 'bg-astrolabe-400/15 hover:bg-astrolabe-400/25 text-astrolabe-300 border border-astrolabe-400/35'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Diario</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => selectPuzzle(p.id, 'lab')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1 transition-colors ${
                      isActive && mode === 'lab'
                        ? 'bg-spectral-400 text-obsidian-950 font-semibold'
                        : 'bg-ivory-100/8 hover:bg-ivory-100/15 text-ivory-200 border border-ivory-100/15'
                    }`}
                  >
                    <FlaskConical className="w-3 h-3" />
                    <span>Lab</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
