import {
  DayData,
  Edge,
  GameContext,
  LaunchOutcome,
  Manifest,
  Rank,
  Satellite,
  Scoring,
  Telemetry,
  Vocab,
  ConnectionTier,
} from './types';

export const TARGET = 5;
export const MAX_SWAPS = 3;

export const SAT_COLORS = ['#E5A93C', '#2DD4BF', '#A78BFA', '#38BDF8', '#F472B6'];

/* ---------------------------------------------------------------- texto */

export function normalizeSpanishWord(raw: string): string {
  if (!raw) return '';
  const s = raw.trim().toLowerCase().replace(/ñ/g, '\u0001');
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/[^a-zñ]/g, '');
}

const SUFFIXES = [
  'amientos', 'imientos', 'aciones', 'iciones', 'adoras', 'adores', 'amiento', 'imiento', 'mente',
  'idades', 'anzas', 'acion', 'icion', 'adora', 'ador', 'erias', 'eros', 'eras', 'ismos', 'istas',
  'ables', 'ibles', 'antes', 'ientes', 'illos', 'illas', 'itos', 'itas', 'otes', 'otas', 'azos',
  'azas', 'eria', 'ero', 'era', 'ismo', 'ista', 'able', 'ible', 'idad', 'anza', 'ante', 'iente',
  'illo', 'illa', 'ito', 'ita', 'ote', 'ota', 'azo', 'aza', 'oso', 'osa', 'osos', 'osas', 'ales',
  'ando', 'iendo', 'ado', 'ada', 'ados', 'adas', 'ido', 'ida', 'idos', 'idas', 'ces', 'es', 's',
  'a', 'o', 'e',
];

export function spanishStem(w: string): string {
  if (w.length <= 3) return w;
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) {
      const stem = w.slice(0, -suf.length);
      return suf === 'ces' ? stem + 'z' : stem;
    }
  }
  return w;
}

export function isMorphologicalDerivative(core: string, cand: string): boolean {
  const c = normalizeSpanishWord(core);
  const w = normalizeSpanishWord(cand);
  if (!c || !w) return false;
  if (c === w) return true;
  const cs = spanishStem(c);
  if (cs.length >= 4 && cs === spanishStem(w)) return true;
  const p = c.length >= 5 ? 5 : c.length;
  return p >= 4 && w.startsWith(c.slice(0, p)) && w.length <= c.length + 6;
}

/* ---------------------------------------------------------------- carga */

export async function loadVocab(base: string, manifest: Manifest): Promise<Vocab> {
  const [binRes, wordsRes] = await Promise.all([
    fetch(`${base}/${manifest.vocab.bin}`),
    fetch(`${base}/${manifest.vocab.words}`),
  ]);
  if (!binRes.ok || !wordsRes.ok) throw new Error('No se pudo cargar el vocabulario.');
  const buf = await binRes.arrayBuffer();
  const view = new DataView(buf);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'ORBV') throw new Error('Vocabulario inválido.');
  const dim = view.getUint8(5);
  const count = view.getUint32(6, true);
  const q = new Int8Array(buf, 10, count * dim);
  const unit = new Float32Array(count * dim);
  for (let i = 0; i < count; i++) {
    let s = 0;
    const o = i * dim;
    for (let k = 0; k < dim; k++) s += q[o + k] * q[o + k];
    const inv = 1 / Math.sqrt(Math.max(s, 1e-9));
    for (let k = 0; k < dim; k++) unit[o + k] = q[o + k] * inv;
  }
  const words = (await wordsRes.text()).split(/\r?\n/);
  const normToIdx = new Map<string, number>();
  words.forEach((w, i) => {
    const n = normalizeSpanishWord(w);
    if (n && !normToIdx.has(n)) normToIdx.set(n, i);
  });
  return { dim, count, words, unit, normToIdx };
}

export function buildContext(vocab: Vocab, day: DayData, scoring: Scoring): GameContext {
  const core = vocab.unit.slice(day.coreIdx * vocab.dim, (day.coreIdx + 1) * vocab.dim);
  const rocheIdx = new Set<number>();
  day.roche.forEach((n) => {
    const i = vocab.normToIdx.get(n);
    if (i !== undefined) rocheIdx.add(i);
  });
  return {
    vocab,
    day,
    scoring,
    core,
    bridgeSet: new Set(day.bridges),
    rocheSet: new Set(day.roche),
    rocheIdx,
  };
}

/** Indice del dia (zona horaria fija del juego) */
export function dayIndex(manifest: Manifest, now = new Date()): number {
  const epoch = Date.parse(`${manifest.epochDate}T00:00:00Z`);
  const shifted = now.getTime() + manifest.tzOffsetMinutes * 60000;
  return Math.max(0, Math.floor((shifted - epoch) / 86400000));
}

export function dayKey(manifest: Manifest, now = new Date()): string {
  const shifted = new Date(now.getTime() + manifest.tzOffsetMinutes * 60000);
  return shifted.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- matematica */

function gravityOf(ctx: GameContext, idx: number): number {
  const d = ctx.vocab.dim;
  const o = idx * d;
  let s = 0;
  for (let k = 0; k < d; k++) s += ctx.vocab.unit[o + k] * ctx.core[k];
  return s;
}

/** u = v - (v.v0) v0, normalizado (identico a pipeline/build_v2.py::tangent) */
function tangentOf(ctx: GameContext, idx: number): Float64Array {
  const d = ctx.vocab.dim;
  const o = idx * d;
  const g = gravityOf(ctx, idx);
  const u = new Float64Array(d);
  let n = 0;
  for (let k = 0; k < d; k++) {
    const x = ctx.vocab.unit[o + k] - g * ctx.core[k];
    u[k] = x;
    n += x * x;
  }
  const inv = 1 / Math.sqrt(Math.max(n, 1e-12));
  for (let k = 0; k < d; k++) u[k] *= inv;
  return u;
}

function angleOf(ctx: GameContext, u: Float64Array): number {
  const [b1, b2] = ctx.day.basis;
  let x = 0;
  let y = 0;
  for (let k = 0; k < u.length; k++) {
    x += u[k] * b1[k];
    y += u[k] * b2[k];
  }
  return Math.atan2(y - ctx.day.center2[1], x - ctx.day.center2[0]);
}

export function tierOf(ctx: GameContext, idx: number, g: number): ConnectionTier {
  if (ctx.bridgeSet.has(idx)) return 'bridge';
  return g >= ctx.day.tauNear ? 'near' : 'far';
}

export function radiusOf(ctx: GameContext, tier: ConnectionTier, g: number): number {
  const t = Math.max(0, Math.min(1, g / (ctx.day.tauNear + 0.22)));
  const base = 0.8 - 0.4 * t;
  return tier === 'bridge' ? Math.min(base, 0.62) : base;
}

export function resolveWord(input: string, vocab: Vocab): number | undefined {
  const n = normalizeSpanishWord(input);
  if (n.length < 2) return undefined;
  const direct = vocab.normToIdx.get(n);
  if (direct !== undefined) return direct;
  const cands: string[] = [];
  if (n.endsWith('ces')) cands.push(n.slice(0, -3) + 'z');
  if (n.endsWith('es')) cands.push(n.slice(0, -2));
  if (n.endsWith('s')) cands.push(n.slice(0, -1));
  for (const c of cands) {
    const i = vocab.normToIdx.get(c);
    if (i !== undefined) return i;
  }
  return undefined;
}

export function evaluateLaunch(input: string, ctx: GameContext, sats: Satellite[]): LaunchOutcome {
  const display = input.trim().toUpperCase();
  const n = normalizeSpanishWord(input);
  if (n.length < 2) return { kind: 'INVALID', word: display };
  const coreNorm = normalizeSpanishWord(ctx.day.core);
  if (n === coreNorm) return { kind: 'SELF', word: display };

  const idx = resolveWord(input, ctx.vocab);
  if (sats.some((s) => s.idx === idx || normalizeSpanishWord(s.word) === n)) {
    return { kind: 'DUPLICATE', word: display };
  }
  if (
    ctx.rocheSet.has(n) ||
    (idx !== undefined && ctx.rocheIdx.has(idx)) ||
    isMorphologicalDerivative(ctx.day.core, n)
  ) {
    return { kind: 'ROCHE', word: display };
  }
  if (idx === undefined) return { kind: 'UNKNOWN', word: display };

  const g = gravityOf(ctx, idx);
  const tier = tierOf(ctx, idx, g);
  const u = tangentOf(ctx, idx);
  return {
    kind: 'CAPTURE',
    sat: {
      idx,
      word: ctx.vocab.words[idx].toUpperCase(),
      tier,
      gravity: g,
      angle: angleOf(ctx, u),
      radius: radiusOf(ctx, tier, g),
    },
  };
}

/** Separa angulos cercanos para que las etiquetas no se solapen, sin perder el cuadrante semantico. */
export function relaxAngles(sats: Satellite[]): Satellite[] {
  const n = sats.length;
  if (n < 2) return sats;
  const a = sats.map((s) => s.angle);
  const minSep = 0.42;
  for (let it = 0; it < 24; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let diff = a[i] - a[j];
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const ad = Math.abs(diff);
        if (ad < minSep) {
          const push = (minSep - ad) * 0.5;
          const sg = diff >= 0 ? 1 : -1;
          a[i] += sg * push;
          a[j] -= sg * push;
        }
      }
    }
  }
  return sats.map((s, i) => ({ ...s, angle: a[i] }));
}

/* ---------------------------------------------------------------- puntaje */

export function anchorMap(raw: number, an: DayData['anchors']): number {
  const pts: [number, number][] = [
    [an.p01, 35],
    [an.p10, 55],
    [an.p50, 70],
    [an.p90, 85],
    [an.best, 97],
  ];
  if (raw <= pts[0][0]) {
    const slope = (pts[1][1] - pts[0][1]) / Math.max(1e-6, pts[1][0] - pts[0][0]);
    return Math.max(8, pts[0][1] - (pts[0][0] - raw) * slope);
  }
  for (let i = 1; i < pts.length; i++) {
    if (raw <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((raw - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0);
    }
  }
  return Math.min(100, 97 + (raw - an.best) * 30);
}

export function rankOf(score: number): Rank {
  if (score >= 90) return { title: 'Singularidad', tier: 'supernova', color: '#E5A93C' };
  if (score >= 80) return { title: 'Arquitecto', tier: 'architect', color: '#10B981' };
  if (score >= 70) return { title: 'Navegante', tier: 'navigator', color: '#2DD4BF' };
  if (score >= 58) return { title: 'Explorador', tier: 'explorer', color: '#38BDF8' };
  return { title: 'Órbita lineal', tier: 'linear', color: '#FB7185' };
}

export function pairDistance(ctx: GameContext, a: Satellite, b: Satellite): number {
  const ua = tangentOf(ctx, a.idx);
  const ub = tangentOf(ctx, b.idx);
  let dot = 0;
  for (let k = 0; k < ua.length; k++) dot += ua[k] * ub[k];
  return 1 - dot;
}

export function evaluateConstellation(ctx: GameContext | null, sats: Satellite[]): Telemetry {
  const empty: Telemetry = {
    count: sats.length,
    score: 0,
    divergence: 0,
    connection: 0,
    frictionCount: 0,
    closest: null,
    edges: [],
    rank: rankOf(0),
    isResonant: false,
  };
  if (!ctx || sats.length < 2) return empty;

  const [fr, re] = ctx.day.edge;
  const edges: Edge[] = [];
  let sum = 0;
  let min = 9;
  let closest: Edge | null = null;
  for (let i = 0; i < sats.length; i++) {
    for (let j = i + 1; j < sats.length; j++) {
      const d = pairDistance(ctx, sats[i], sats[j]);
      const status: Edge['status'] = d <= fr ? 'friction' : d >= re ? 'resonance' : 'stable';
      const e: Edge = { a: sats[i].uid, b: sats[j].uid, wordA: sats[i].word, wordB: sats[j].word, d, status };
      edges.push(e);
      sum += d;
      if (d < min) {
        min = d;
        closest = e;
      }
    }
  }
  const raw = ctx.scoring.wMean * (sum / edges.length) + ctx.scoring.wMin * min;
  const divergence = anchorMap(raw, ctx.day.anchors);
  const norm = ctx.day.hasBridges ? 1 : ctx.scoring.conn.near; // dias sin puentes: lo "cercano" ya es el maximo
  const connection = Math.min(1, sats.reduce((a, s) => a + ctx.scoring.conn[s.tier], 0) / sats.length / norm);
  const score = Math.min(100, ctx.scoring.wDiv * divergence + ctx.scoring.wConn * connection);
  const frictionCount = edges.filter((e) => e.status === 'friction').length;
  return {
    count: sats.length,
    score: Number(score.toFixed(1)),
    divergence: Number(divergence.toFixed(1)),
    connection: Number(connection.toFixed(2)),
    frictionCount,
    closest,
    edges,
    rank: rankOf(score),
    isResonant: sats.length === TARGET && frictionCount === 0 && edges.every((e) => e.status !== 'stable' || e.d > (fr + re) / 2),
  };
}

export function masterConstellation(ctx: GameContext) {
  return ctx.day.master.map((i) => ctx.vocab.words[i].toUpperCase());
}
