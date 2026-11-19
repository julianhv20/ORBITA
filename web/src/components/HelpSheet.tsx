'use client';

import React from 'react';
import { Sheet } from './Sheet';
import { useOrbitaStore } from '../store/useOrbitaStore';

export const HelpSheet: React.FC = () => {
  const open = useOrbitaStore((s) => s.showHelp);
  const setOpen = useOrbitaStore((s) => s.setShowHelp);
  const core = useOrbitaStore((s) => s.ctx?.day.core ?? 'RELOJ');

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Cómo se juega" eyebrow="ÓRBITA · 30 segundos">
      <ol className="space-y-3 text-sm text-ivory-200">
        <li className="flex gap-3">
          <span className="font-mono text-astrolabe-400">1</span>
          <span>
            Escribe <b>5 palabras</b> que se conecten con <b>{core}</b>, cada una desde un mundo distinto.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-astrolabe-400">2</span>
          <span>
            Si dos palabras se parecen, aparece una <b className="text-roche-400">línea roja</b>. Cambia una de ellas.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-astrolabe-400">3</span>
          <span>
            Lo demasiado obvio (como <i>hora</i> para reloj) se descarta sin costo. Los <b>✦ puentes ocultos</b> suman más.
          </span>
        </li>
      </ol>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-5 w-full rounded-2xl bg-astrolabe-400 py-3 text-sm font-semibold text-obsidian-950 transition hover:bg-astrolabe-300"
      >
        Empezar
      </button>
    </Sheet>
  );
};
