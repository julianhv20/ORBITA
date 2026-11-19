'use client';

import React, { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { Leaderboard } from './Leaderboard';
import { useOrbitaStore } from '../store/useOrbitaStore';
import { HistoryEntry } from '../core/types';

type Tab = 'ranking' | 'history' | 'archive';

function streakOf(history: HistoryEntry[], todayKey: string): { current: number; bestStreak: number } {
  const days = new Set(history.map((h) => h.dayKey));
  const prev = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  let cur = 0;
  let k = days.has(todayKey) ? todayKey : prev(todayKey);
  while (days.has(k)) {
    cur++;
    k = prev(k);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let last = '';
  for (const d of sorted) {
    run = last && prev(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return { current: cur, bestStreak: best };
}

const Spark: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return <div className="py-6 text-center text-xs text-ivory-400">Juega unos días para ver tu evolución.</div>;
  const w = 300;
  const h = 64;
  const lo = Math.min(...values, 50);
  const hi = Math.max(...values, 95);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - lo) / (hi - lo)) * (h - 8) - 4}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
      <polyline points={pts} fill="none" stroke="#E5A93C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={(i / (values.length - 1)) * w} cy={h - ((v - lo) / (hi - lo)) * (h - 8) - 4} r="2.5" fill="#FAF8F5" />
      ))}
    </svg>
  );
};

export const StatsSheet: React.FC = () => {
  const open = useOrbitaStore((s) => s.showStats);
  const setOpen = useOrbitaStore((s) => s.setShowStats);
  const history = useOrbitaStore((s) => s.history);
  const manifest = useOrbitaStore((s) => s.manifest);
  const todayKey = useOrbitaStore((s) => s.todayKey);
  const dayNumber = useOrbitaStore((s) => s.dayNumber);
  const loadDay = useOrbitaStore((s) => s.loadDay);
  const [tab, setTab] = useState<Tab>('ranking');

  const st = useMemo(() => {
    const scores = history.map((h) => h.score);
    return {
      played: history.length,
      avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      best: scores.length ? Math.max(...scores) : 0,
      ...streakOf(history, todayKey),
      recent: history.slice(-14),
    };
  }, [history, todayKey]);

  const past = useMemo(() => {
    if (!manifest) return [];
    const n = manifest.puzzles.length;
    return Array.from({ length: Math.min(10, dayNumber - 1) }, (_, i) => {
      const d = dayNumber - 2 - i;
      return { day: d + 1, entry: manifest.puzzles[d % n] };
    });
  }, [manifest, dayNumber]);

  const tabs: [Tab, string][] = [['ranking', 'Ranking'], ['history', 'Historial'], ['archive', 'Días']];

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Tu órbita" eyebrow="Ranking e historial">
      <div className="mb-4 flex gap-1 rounded-full bg-obsidian-900 p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${tab === k ? 'bg-ivory-100/10 text-ivory-50' : 'text-ivory-400 hover:text-ivory-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ranking' && <Leaderboard />}

      {tab === 'history' && (
        <div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['Racha', st.current],
              ['Mejor racha', st.bestStreak],
              ['Promedio', st.avg ? st.avg.toFixed(1) : '–'],
              ['Récord', st.best ? Math.max(...history.map((h) => h.score)).toFixed(1) : '–'],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-2xl bg-obsidian-900/70 py-2.5">
                <div className="font-mono text-lg font-semibold tabular-nums text-ivory-50">{v}</div>
                <div className="text-[9px] uppercase tracking-wider text-ivory-400">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Spark values={st.recent.map((h) => h.score)} />
          </div>
          <ul className="mt-2 divide-y divide-ivory-100/5">
            {[...history].reverse().slice(0, 10).map((h) => (
              <li key={h.dayKey} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ivory-100">
                  {h.core} <span className="ml-1 font-mono text-[10px] text-ivory-400">{h.dayKey.slice(5)}</span>
                </span>
                <span className="font-mono tabular-nums text-astrolabe-300">{h.score.toFixed(1)}</span>
              </li>
            ))}
            {history.length === 0 && <li className="py-6 text-center text-xs text-ivory-400">Aún no hay partidas. ¡Juega la de hoy!</li>}
          </ul>
        </div>
      )}

      {tab === 'archive' && (
        <div>
          <p className="mb-2 text-xs text-ivory-400">Practica días anteriores (no cuentan para tu racha ni el ranking).</p>
          <ul className="divide-y divide-ivory-100/5">
            {past.length === 0 && <li className="py-6 text-center text-xs text-ivory-400">Todavía no hay días anteriores.</li>}
            {past.map(({ day, entry }) => (
              <li key={entry.id + day} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-ivory-100">
                  <span className="mr-2 font-mono text-xs text-ivory-400">#{day}</span>
                  {entry.core}
                </span>
                <button
                  type="button"
                  onClick={() => loadDay(entry.id, 'practice')}
                  className="rounded-full border border-ivory-100/15 px-3 py-1 text-xs text-ivory-100 transition hover:bg-ivory-100/10"
                >
                  Practicar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
};
