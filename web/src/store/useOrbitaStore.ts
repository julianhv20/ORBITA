import { create } from 'zustand';
import {
  DayData,
  GameContext,
  HistoryEntry,
  LeaderboardData,
  Manifest,
  ManifestPuzzle,
  RejectionEntry,
  Satellite,
  Telemetry,
  Vocab,
} from '../core/types';
import {
  MAX_SWAPS,
  SAT_COLORS,
  TARGET,
  buildContext,
  dayIndex,
  dayKey as computeDayKey,
  evaluateConstellation,
  evaluateLaunch,
  loadVocab,
  relaxAngles,
} from '../core/orbitalEngine';
import { synth } from '../audio/synthEngine';

const BASE = '/v2';
const K_PLAYER = 'orbita2:player';
const K_HISTORY = 'orbita2:history';
const K_PROGRESS = 'orbita2:progress';
const K_SEEN = 'orbita2:seen-help';

export interface Probe {
  id: string;
  word: string;
  angle: number;
  radius: number;
  startedAt: number;
  durationMs: number;
}

export interface FxEvent {
  id: number;
  kind: 'roche' | 'capture' | 'soft';
  word: string;
}

export interface Feedback {
  id: number;
  text: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
}

export interface Player {
  id: string;
  name: string;
}

interface Store {
  phase: 'boot' | 'ready' | 'error';
  error: string | null;
  manifest: Manifest | null;
  vocab: Vocab | null;
  ctx: GameContext | null;
  entry: ManifestPuzzle | null;
  dayNumber: number;
  todayKey: string;
  mode: 'daily' | 'practice';

  satellites: Satellite[];
  rejections: RejectionEntry[];
  telemetry: Telemetry;
  swapsLeft: number;
  misses: number;
  sealed: boolean;
  probe: Probe | null;
  fx: FxEvent | null;
  feedback: Feedback | null;
  shakeNonce: number;
  selectedUid: string | null;

  player: Player;
  history: HistoryEntry[];
  leaderboard: LeaderboardData | null;
  published: boolean;
  publishing: boolean;

  showHelp: boolean;
  showResult: boolean;
  showStats: boolean;
  soundOn: boolean;

  init: () => Promise<void>;
  loadDay: (puzzleId: string, mode: 'daily' | 'practice') => Promise<void>;
  submitWord: (raw: string) => void;
  removeSatellite: (uid: string) => void;
  seal: () => void;
  setName: (name: string) => void;
  publish: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  setSelected: (uid: string | null) => void;
  setShowHelp: (v: boolean) => void;
  setShowResult: (v: boolean) => void;
  setShowStats: (v: boolean) => void;
  toggleSound: () => void;
}

const EMPTY_TELEMETRY = evaluateConstellation(null, []);

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* cuota */
  }
}

function newPlayer(): Player {
  const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random())
    .replace(/-/g, '')
    .slice(0, 20);
  return { id, name: `Viajero${Math.floor(1000 + Math.random() * 9000)}` };
}

let fxCounter = 0;
let fbCounter = 0;
const fb = (text: string, tone: Feedback['tone']): Feedback => ({ id: ++fbCounter, text, tone });

export const useOrbitaStore = create<Store>((set, get) => ({
  phase: 'boot',
  error: null,
  manifest: null,
  vocab: null,
  ctx: null,
  entry: null,
  dayNumber: 1,
  todayKey: '',
  mode: 'daily',

  satellites: [],
  rejections: [],
  telemetry: EMPTY_TELEMETRY,
  swapsLeft: MAX_SWAPS,
  misses: 0,
  sealed: false,
  probe: null,
  fx: null,
  feedback: null,
  shakeNonce: 0,
  selectedUid: null,

  player: { id: '', name: '' },
  history: [],
  leaderboard: null,
  published: false,
  publishing: false,

  showHelp: false,
  showResult: false,
  showStats: false,
  soundOn: true,

  init: async () => {
    try {
      const manifest = (await (await fetch(`${BASE}/manifest.json`)).json()) as Manifest;
      const vocab = await loadVocab(BASE, manifest);
      let player = read<Player | null>(K_PLAYER, null);
      if (!player || !player.id) {
        player = newPlayer();
        write(K_PLAYER, player);
      }
      const history = read<HistoryEntry[]>(K_HISTORY, []);
      const idx = dayIndex(manifest) % manifest.puzzles.length;
      const seen = typeof window !== 'undefined' && window.localStorage.getItem(K_SEEN) === '1';
      set({
        manifest,
        vocab,
        player,
        history,
        todayKey: computeDayKey(manifest),
        dayNumber: dayIndex(manifest) + 1,
        showHelp: !seen,
      });
      await get().loadDay(manifest.puzzles[idx].id, 'daily');
      set({ phase: 'ready' });
    } catch (e) {
      set({ phase: 'error', error: e instanceof Error ? e.message : 'Error al iniciar.' });
    }
  },

  loadDay: async (puzzleId, mode) => {
    const { manifest, vocab, todayKey } = get();
    if (!manifest || !vocab) return;
    const entry = manifest.puzzles.find((p) => p.id === puzzleId) ?? manifest.puzzles[0];
    const day = (await (await fetch(`${BASE}/${entry.file}`)).json()) as DayData;
    const ctx = buildContext(vocab, day, manifest.scoring);

    let satellites: Satellite[] = [];
    let rejections: RejectionEntry[] = [];
    let swapsLeft = MAX_SWAPS;
    let misses = 0;
    let sealed = false;
    if (mode === 'daily') {
      const saved = read<{
        dayKey: string;
        puzzleId: string;
        satellites: Satellite[];
        rejections?: RejectionEntry[];
        swapsLeft: number;
        misses: number;
        sealed: boolean;
      } | null>(K_PROGRESS, null);
      if (saved && saved.dayKey === todayKey && saved.puzzleId === entry.id) {
        satellites = saved.satellites;
        rejections = saved.rejections ?? [];
        swapsLeft = saved.swapsLeft;
        misses = saved.misses;
        sealed = saved.sealed;
      }
    }
    const published = mode === 'daily' && read<string | null>('orbita2:published', null) === `${todayKey}:${entry.id}`;
    set({
      ctx,
      entry,
      mode,
      satellites,
      rejections,
      swapsLeft,
      misses,
      sealed,
      published,
      telemetry: evaluateConstellation(ctx, satellites),
      probe: null,
      feedback: null,
      selectedUid: null,
      showResult: sealed,
      showStats: false,
      leaderboard: null,
    });
    if (sealed) get().refreshLeaderboard();
  },

  submitWord: (raw) => {
    const s = get();
    if (!s.ctx || s.sealed || s.probe) return;
    if (s.satellites.length >= TARGET) {
      set({ feedback: fb('Órbita completa. Toca una palabra para cambiarla o pulsa Terminar.', 'warn'), shakeNonce: s.shakeNonce + 1 });
      return;
    }
    const out = evaluateLaunch(raw, s.ctx, s.satellites);
    const core = s.ctx.day.core;

    if (out.kind !== 'CAPTURE') {
      synth.playInvalidShake();
      const msg: Record<string, string> = {
        INVALID: 'Escribe una palabra de al menos 2 letras.',
        SELF: `${core} es el centro. Prueba algo conectado a él.`,
        DUPLICATE: `${out.word} ya está en tu órbita.`,
        UNKNOWN: `No encuentro “${out.word.toLowerCase()}” en el diccionario. Prueba otra forma.`,
        ROCHE: `${out.word} es demasiado obvia para ${core}. Busca otro camino.`,
      };
      if (out.kind === 'ROCHE') {
        synth.playRocheBurn();
        const rej: RejectionEntry = {
          id: `r${Date.now()}`,
          word: out.word,
          kind: 'roche',
          reason: out.reason,
        };
        const nextRejections = [...s.rejections, rej];
        set({
          fx: { id: ++fxCounter, kind: 'roche', word: out.word },
          misses: s.misses + 1,
          rejections: nextRejections,
        });
        persistProgress(get());
      }
      set({ feedback: fb(msg[out.kind], out.kind === 'ROCHE' ? 'bad' : 'warn'), shakeNonce: s.shakeNonce + 1 });
      return;
    }

    const duration = 420;
    set({
      probe: { id: `p${Date.now()}`, word: out.sat.word, angle: out.sat.angle, radius: out.sat.radius, startedAt: performance.now(), durationMs: duration },
    });
    synth.playProbeLaunch();

    window.setTimeout(() => {
      const cur = get();
      if (!cur.ctx || !cur.probe) return;
      const uid = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
      const color = SAT_COLORS.find((c) => !cur.satellites.some((x) => x.color === c)) ?? SAT_COLORS[0];
      const sat: Satellite = { ...out.sat, uid, color, addedAt: performance.now() };
      const colorless = relaxAngles([...cur.satellites, sat]);
      const tel = evaluateConstellation(cur.ctx, colorless);
      synth.playOrbitCapture(colorless.length - 1);
      tel.edges
        .filter((e) => e.a === uid || e.b === uid)
        .forEach((e, i) => window.setTimeout(() => synth.playEdgeSnap(Math.min(1.2, Math.max(0.5, e.d)), i), 110 + i * 100));

      const tierText = sat.tier === 'bridge' ? '✦ Puente oculto' : sat.tier === 'near' ? '◈ Conexión cercana' : '○ Conexión lejana';
      const newEdges = tel.edges.filter((e) => e.a === uid || e.b === uid);
      const friction = newEdges.find((e) => e.status === 'friction');
      const text = friction
        ? `${sat.word} se parece a ${friction.a === uid ? friction.wordB : friction.wordA}. Cámbiala para subir el puntaje.`
        : colorless.length === TARGET
          ? `${sat.word} · ${tierText}. ¡Órbita completa! Termina o cambia alguna.`
          : `${sat.word} · ${tierText}`;
      set({
        probe: null,
        satellites: colorless,
        telemetry: tel,
        selectedUid: null,
        fx: { id: ++fxCounter, kind: 'capture', word: sat.word },
        feedback: fb(text, friction ? 'warn' : 'good'),
      });
      persistProgress(get());
    }, duration);
  },

  removeSatellite: (uid) => {
    const s = get();
    if (!s.ctx || s.sealed || s.probe) return;
    if (s.swapsLeft <= 0) {
      set({ feedback: fb('Ya no te quedan cambios. Termina tu constelación.', 'warn') });
      return;
    }
    const target = s.satellites.find((x) => x.uid === uid);
    if (!target) return;
    const rest = relaxAngles(s.satellites.filter((x) => x.uid !== uid));
    synth.playEject();
    set({
      satellites: rest,
      telemetry: evaluateConstellation(s.ctx, rest),
      swapsLeft: s.swapsLeft - 1,
      selectedUid: null,
      feedback: fb(`${target.word} salió de órbita. Prueba un campo distinto.`, 'neutral'),
    });
    persistProgress(get());
  },

  seal: () => {
    const s = get();
    if (!s.ctx || !s.entry || s.sealed || s.satellites.length < TARGET) return;
    const tel = evaluateConstellation(s.ctx, s.satellites);
    synth.playConstellationSealed(tel.isResonant);
    let history = s.history;
    if (s.mode === 'daily' && !history.some((h) => h.dayKey === s.todayKey)) {
      history = [
        ...history,
        { dayKey: s.todayKey, puzzleId: s.entry.id, core: s.ctx.day.core, score: tel.score, tier: tel.rank.tier, words: s.satellites.map((x) => x.word) },
      ].slice(-400);
      write(K_HISTORY, history);
    }
    set({ sealed: true, telemetry: tel, history, showResult: true });
    persistProgress(get());
    if (s.mode === 'daily') get().refreshLeaderboard();
  },

  setName: (name) => {
    const clean = name.replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16);
    const player = { ...get().player, name: clean };
    set({ player });
    write(K_PLAYER, player);
  },

  publish: async () => {
    const s = get();
    if (!s.ctx || !s.entry || !s.sealed || s.mode !== 'daily' || s.publishing) return;
    set({ publishing: true });
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: s.todayKey,
          puzzleId: s.entry.id,
          playerId: s.player.id,
          name: s.player.name.trim() || 'Viajero',
          words: s.satellites.map((x) => x.idx),
          score: s.telemetry.score,
        }),
      });
      if (res.ok) {
        write('orbita2:published', `${s.todayKey}:${s.entry.id}`);
        set({ published: true });
      } else if (res.status === 503) {
        set({ feedback: fb('El ranking global aún no está activo.', 'warn') });
      }
    } catch {
      /* sin red */
    }
    set({ publishing: false });
    await get().refreshLeaderboard();
  },

  refreshLeaderboard: async () => {
    const s = get();
    if (!s.todayKey) return;
    try {
      const res = await fetch(`/api/leaderboard?day=${s.todayKey}&playerId=${s.player.id}`);
      if (!res.ok) throw new Error('x');
      const data = (await res.json()) as LeaderboardData;
      set({ leaderboard: { ...data, available: true } });
    } catch {
      set({ leaderboard: { available: false, total: 0, top: [], me: null } });
    }
  },

  setSelected: (uid) => set({ selectedUid: uid }),
  setShowHelp: (v) => {
    if (!v && typeof window !== 'undefined') window.localStorage.setItem(K_SEEN, '1');
    set({ showHelp: v });
  },
  setShowResult: (v) => set({ showResult: v }),
  setShowStats: (v) => {
    set({ showStats: v });
    if (v && !get().leaderboard) get().refreshLeaderboard();
  },
  toggleSound: () => set({ soundOn: synth.toggle() }),
}));

function persistProgress(s: Store) {
  if (s.mode !== 'daily' || !s.entry) return;
  write(K_PROGRESS, {
    dayKey: s.todayKey,
    puzzleId: s.entry.id,
    satellites: s.satellites,
    rejections: s.rejections,
    swapsLeft: s.swapsLeft,
    misses: s.misses,
    sealed: s.sealed,
  });
}

export { SAT_COLORS };
