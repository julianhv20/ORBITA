'use client';

import React from 'react';
import { useOrbitaStore } from '../store/useOrbitaStore';

export const Leaderboard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const lb = useOrbitaStore((s) => s.leaderboard);
  const player = useOrbitaStore((s) => s.player);

  if (!lb) return <div className="py-4 text-center text-xs text-ivory-400">Cargando ranking…</div>;
  if (!lb.available) {
    return <div className="py-4 text-center text-xs text-ivory-400">El ranking global se activará pronto.</div>;
  }
  if (lb.top.length === 0) return <div className="py-4 text-center text-xs text-ivory-400">Sé la primera persona en el ranking de hoy.</div>;

  const rows = compact ? lb.top.slice(0, 5) : lb.top;
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-ivory-400">
        <span>Ranking de hoy</span>
        <span>{lb.total} jugadores</span>
      </div>
      <ol className="divide-y divide-ivory-100/5">
        {rows.map((r, i) => {
          const mine = r.name === player.name && lb.me?.score === r.score;
          return (
            <li key={`${r.name}-${i}`} className={`flex items-center gap-3 py-1.5 text-sm ${mine ? 'text-astrolabe-300' : 'text-ivory-100'}`}>
              <span className="w-6 font-mono text-xs text-ivory-400">{i + 1}</span>
              <span className="flex-1 truncate">{r.name}</span>
              <span className="font-mono tabular-nums">{r.score.toFixed(1)}</span>
            </li>
          );
        })}
      </ol>
      {lb.me && lb.me.rank > rows.length && (
        <div className="mt-1 flex items-center gap-3 border-t border-ivory-100/10 pt-2 text-sm text-astrolabe-300">
          <span className="w-6 font-mono text-xs">{lb.me.rank}</span>
          <span className="flex-1">Tú</span>
          <span className="font-mono tabular-nums">{lb.me.score.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
};
