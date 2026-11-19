export interface ManifestPuzzle {
  id: string;
  core: string;
  file: string;
  hasBridges: boolean;
}

export interface Scoring {
  wMean: number;
  wMin: number;
  wDiv: number;
  wConn: number;
  conn: Record<ConnectionTier, number>;
}

export interface Manifest {
  v: number;
  epochDate: string;
  tzOffsetMinutes: number;
  scoring: Scoring;
  vocab: { bin: string; words: string; dim: number; count: number };
  puzzles: ManifestPuzzle[];
}

export interface Anchors {
  p01: number;
  p10: number;
  p50: number;
  p90: number;
  best: number;
}

export interface DayData {
  v: number;
  id: string;
  core: string;
  coreIdx: number;
  accent: string;
  tauNear: number;
  roche: string[];
  bridges: number[];
  hasBridges: boolean;
  anchors: Anchors;
  master: number[];
  basis: number[][];
  center2: number[];
  edge: [number, number];
}

export interface Vocab {
  dim: number;
  count: number;
  words: string[];
  /** vectores unitarios (count * dim) */
  unit: Float32Array;
  normToIdx: Map<string, number>;
}

export interface GameContext {
  vocab: Vocab;
  day: DayData;
  scoring: Scoring;
  core: Float32Array;
  bridgeSet: Set<number>;
  rocheSet: Set<string>;
  rocheIdx: Set<number>;
}

export type ConnectionTier = 'bridge' | 'near' | 'far';

export interface Satellite {
  uid: string;
  idx: number;
  word: string;
  tier: ConnectionTier;
  gravity: number;
  angle: number;
  radius: number;
  color: string;
  addedAt: number;
}

export type LaunchOutcome =
  | { kind: 'CAPTURE'; sat: Omit<Satellite, 'uid' | 'addedAt' | 'color'> }
  | { kind: 'ROCHE'; word: string }
  | { kind: 'UNKNOWN'; word: string }
  | { kind: 'DUPLICATE'; word: string }
  | { kind: 'SELF'; word: string }
  | { kind: 'INVALID'; word: string };

export interface Edge {
  a: string;
  b: string;
  wordA: string;
  wordB: string;
  d: number;
  status: 'friction' | 'stable' | 'resonance';
}

export interface Rank {
  title: string;
  tier: 'supernova' | 'architect' | 'navigator' | 'explorer' | 'linear';
  color: string;
}

export interface Telemetry {
  count: number;
  score: number;
  divergence: number;
  connection: number;
  frictionCount: number;
  closest: Edge | null;
  edges: Edge[];
  rank: Rank;
  isResonant: boolean;
}

export interface HistoryEntry {
  dayKey: string; // YYYY-MM-DD
  puzzleId: string;
  core: string;
  score: number;
  tier: Rank['tier'];
  words: string[];
}

export interface DayProgress {
  dayKey: string;
  puzzleId: string;
  satellites: Satellite[];
  swapsLeft: number;
  misses: number;
  sealed: boolean;
}

export interface LeaderboardRow {
  name: string;
  score: number;
  tier?: string;
}

export interface LeaderboardData {
  available: boolean;
  total: number;
  top: LeaderboardRow[];
  me?: { rank: number; score: number } | null;
}
