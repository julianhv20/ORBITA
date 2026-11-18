export interface PuzzleManifestEntry {
  id: string;
  slug: string;
  coreWord: string;
  subtitle: string;
  accent: string;
  jsonFile: string;
  binFile: string;
  candidateCount: number;
  sMax: number;
  percentiles: PercentileBands;
  binBytes: number;
  jsonBytes: number;
}

export interface SeasonManifest {
  season: number;
  epochDate: string;
  lexiconFile: string;
  lexiconCount: number;
  puzzles: PuzzleManifestEntry[];
}

export interface PercentileBands {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
}

export interface MasterSatellite {
  word: string;
  domain: string;
  insight: string;
  gravity: number;
  angleRad: number;
}

export interface DailyPackMetadata {
  version: number;
  id: string;
  slug: string;
  binFile: string;
  coreWord: string;
  subtitle: string;
  hint: string;
  accent: string;
  thresholds: {
    tauMin: number;
    tauRoche: number;
    sMax: number;
    percentiles: PercentileBands;
  };
  rocheWords: string[];
  /** [norm, display, domain, insight] */
  candidates: [string, string, string, string][];
  formsMap: Record<string, number>;
  masterConstellation: {
    score: number;
    meanDist: number;
    minDist: number;
    satellites: MasterSatellite[];
  };
}

export interface LoadedDailyPack {
  meta: DailyPackMetadata;
  dim: number;
  candidateCount: number;
  tauMin: number;
  sMax: number;
  /** Interleaved [gravity_i, angleRad_i] of length 2 * M */
  gravityAndAngles: Float32Array;
  /** Row-major Int8Array of length M * dim */
  vectorsInt8: Int8Array;
  /** Precomputed L2 norms of each Int8 row */
  vectorNorms: Float64Array;
  normToIndex: Map<string, number>;
  fallbackNoEnyeToIndex: Map<string, number>;
  rocheSet: Set<string>;
}

export interface SatelliteColor {
  hex: string;
  glow: string;
  name: string;
  symbol: string;
}

export interface ActiveSatellite {
  uid: string;
  candidateIndex: number;
  word: string;
  norm: string;
  domain: string;
  insight: string;
  gravity: number;
  semanticAngle: number;
  displayAngle: number;
  orbitRadiusRatio: number;
  color: SatelliteColor;
  launchedAt: number;
}

export interface PairEdgeMetric {
  uidA: string;
  uidB: string;
  wordA: string;
  wordB: string;
  distance: number;
  status: 'resonance' | 'stable' | 'friction';
}

export interface ConstellationTelemetry {
  satelliteCount: number;
  pairCount: number;
  score: number;
  meanDistance: number;
  minDistance: number;
  redFrictionCount: number;
  isHarmonicResonance: boolean;
  edges: PairEdgeMetric[];
  closestPair: PairEdgeMetric | null;
  farthestPair: PairEdgeMetric | null;
  rank: {
    title: string;
    tier: 'supernova' | 'architect' | 'navigator' | 'explorer' | 'linear';
    percentileLabel: string;
    badgeColor: string;
  };
}

export type LaunchOutcomeType =
  | 'ORBIT_CAPTURE'
  | 'ROCHE_LIMIT'
  | 'OUTER_VOID'
  | 'UNKNOWN_WORD'
  | 'DUPLICATE'
  | 'SELF_CORE';

export interface LaunchEvaluation {
  outcome: LaunchOutcomeType;
  consumesImpulse: boolean;
  rawInput: string;
  displayWord: string;
  normWord: string;
  candidateIndex?: number;
  domain?: string;
  insight?: string;
  gravity?: number;
  semanticAngle?: number;
  message: string;
}

export interface ImpulseLogEntry {
  step: number;
  word: string;
  outcome: 'ORBIT_CAPTURE' | 'ROCHE_LIMIT' | 'OUTER_VOID' | 'EJECTED';
  detail: string;
  gravity?: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  currentStreak: number;
  maxStreak: number;
  lastCompletedPuzzleId: string | null;
  lastCompletedDate: string | null;
  bestScore: number;
  averageScore: number;
  tierCounts: {
    supernova: number;
    architect: number;
    navigator: number;
    explorer: number;
    linear: number;
  };
}
