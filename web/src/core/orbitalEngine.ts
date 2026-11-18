import {
  ActiveSatellite,
  ConstellationTelemetry,
  DailyPackMetadata,
  LaunchEvaluation,
  LoadedDailyPack,
  PairEdgeMetric,
  PercentileBands,
  SatelliteColor,
} from './types';

export const SATELLITE_PALETTE: SatelliteColor[] = [
  { hex: '#E5A93C', glow: 'rgba(229, 169, 60, 0.42)', name: 'Ámbar Solar', symbol: '◈' },
  { hex: '#2DD4BF', glow: 'rgba(45, 212, 191, 0.42)', name: 'Turquesa Espectral', symbol: '◇' },
  { hex: '#A78BFA', glow: 'rgba(167, 139, 250, 0.42)', name: 'Violeta Nebular', symbol: '❖' },
  { hex: '#38BDF8', glow: 'rgba(56, 189, 248, 0.42)', name: 'Cian Cenital', symbol: '✦' },
  { hex: '#10B981', glow: 'rgba(16, 185, 129, 0.42)', name: 'Esmeralda Armónica', symbol: '✧' },
];

export function normalizeSpanishWord(raw: string): string {
  if (!raw) return '';
  const preserved = raw.trim().toLowerCase().replace(/ñ/g, '\u0001');
  const stripped = preserved.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return stripped.replace(/\u0001/g, 'ñ').replace(/[^a-zñ]/g, '');
}

export function spanishStem(normWord: string): string {
  const w = normalizeSpanishWord(normWord);
  if (w.length <= 3) return w;
  const suffixes = [
    'amientos', 'imientos', 'aciones', 'iciones', 'adoras', 'adores',
    'amiento', 'imiento', 'antemente', 'mente', 'idades', 'anzas',
    'acion', 'icion', 'adora', 'ador', 'erias', 'eros', 'eras',
    'ismos', 'istas', 'ables', 'ibles', 'antes', 'ientes', 'illos', 'illas',
    'itos', 'itas', 'otes', 'otas', 'azos', 'azas', 'escos', 'escas',
    'eria', 'ero', 'era', 'ismo', 'ista', 'able', 'ible', 'idad', 'anza',
    'ante', 'iente', 'illo', 'illa', 'ito', 'ita', 'ote', 'ota', 'azo', 'aza',
    'esco', 'esca', 'oso', 'osa', 'osos', 'osas', 'al', 'ales', 'ar', 'er', 'ir',
    'ando', 'iendo', 'ado', 'ada', 'ados', 'adas', 'ido', 'ida', 'idos', 'idas',
    'ces', 'es', 's', 'a', 'o', 'e',
  ];
  for (const suf of suffixes) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) {
      let stem = w.slice(0, -suf.length);
      if (suf === 'ces') stem += 'z';
      return stem;
    }
  }
  return w;
}

export function isMorphologicalDerivative(coreWord: string, candidateWord: string): boolean {
  const cNorm = normalizeSpanishWord(coreWord);
  const wNorm = normalizeSpanishWord(candidateWord);
  if (!cNorm || !wNorm) return false;
  if (cNorm === wNorm) return true;

  const cStem = spanishStem(cNorm);
  const wStem = spanishStem(wNorm);
  if (cStem.length >= 4 && cStem === wStem) return true;

  const prefixLen = cNorm.length >= 5 ? 5 : cNorm.length;
  if (prefixLen >= 4 && wNorm.startsWith(cNorm.slice(0, prefixLen))) {
    if (wNorm.length <= cNorm.length + 6) return true;
  }
  return false;
}

export function decodeDailyPack(meta: DailyPackMetadata, buffer: ArrayBuffer): LoadedDailyPack {
  const view = new DataView(buffer);
  const magic =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2)) +
    String.fromCharCode(view.getUint8(3));

  if (magic !== 'ORBT') {
    throw new Error(`Formato binario inválido: cabecera '${magic}' (se esperaba 'ORBT').`);
  }

  const version = view.getUint8(4);
  if (version !== 1) {
    throw new Error(`Versión binaria ORBT no soportada: v${version}`);
  }

  const dim = view.getUint8(5);
  const candidateCount = view.getUint16(6, true);
  const tauMin = view.getFloat32(8, true);
  const sMax = view.getFloat32(12, true);

  const gaByteOffset = 16;
  const gaFloatLength = candidateCount * 2;
  const gravityAndAngles = new Float32Array(buffer, gaByteOffset, gaFloatLength);

  const vecByteOffset = 16 + candidateCount * 8;
  const vectorsInt8 = new Int8Array(buffer, vecByteOffset, candidateCount * dim);

  const vectorNorms = new Float64Array(candidateCount);
  for (let i = 0; i < candidateCount; i++) {
    let sumSq = 0;
    const base = i * dim;
    for (let k = 0; k < dim; k++) {
      const v = vectorsInt8[base + k];
      sumSq += v * v;
    }
    vectorNorms[i] = Math.sqrt(Math.max(sumSq, 1e-9));
  }

  const normToIndex = new Map<string, number>();
  const fallbackNoEnyeToIndex = new Map<string, number>();

  meta.candidates.forEach(([norm], idx) => {
    normToIndex.set(norm, idx);
    if (norm.includes('ñ')) {
      fallbackNoEnyeToIndex.set(norm.replace(/ñ/g, 'n'), idx);
    }
  });

  Object.entries(meta.formsMap).forEach(([inflected, idx]) => {
    if (!normToIndex.has(inflected)) {
      normToIndex.set(inflected, idx);
      if (inflected.includes('ñ')) {
        fallbackNoEnyeToIndex.set(inflected.replace(/ñ/g, 'n'), idx);
      }
    }
  });

  const rocheSet = new Set<string>(meta.rocheWords);

  return {
    meta,
    dim,
    candidateCount,
    tauMin,
    sMax,
    gravityAndAngles,
    vectorsInt8,
    vectorNorms,
    normToIndex,
    fallbackNoEnyeToIndex,
    rocheSet,
  };
}

/**
 * Producto punto exacto sobre vectores residuales Int8 cuantizados en < 0.005 ms.
 * Idéntico bit a bit con `tangential_distance_from_cos` en pipeline/src/orbital_math.py.
 */
export function computeTangentialDistance(
  pack: LoadedDailyPack,
  idxA: number,
  idxB: number
): number {
  if (idxA === idxB) return 0.08;
  const dim = pack.dim;
  const vecs = pack.vectorsInt8;
  const baseA = idxA * dim;
  const baseB = idxB * dim;

  let dot = 0;
  for (let k = 0; k < dim; k++) {
    dot += vecs[baseA + k] * vecs[baseB + k];
  }

  const denom = pack.vectorNorms[idxA] * pack.vectorNorms[idxB];
  const cosSim = Math.max(-1.0, Math.min(1.0, denom > 0 ? dot / denom : 0));

  const posPart = Math.max(0.0, cosSim);
  const negPart = Math.min(0.0, cosSim);
  const dist = 0.85 - 0.75 * Math.pow(posPart, 0.8) + 0.45 * Math.pow(-negPart, 0.85);
  return Math.max(0.08, Math.min(0.97, dist));
}

export function mapGravityToOrbitRatio(gravity: number): number {
  const clamped = Math.max(0.32, Math.min(0.84, gravity));
  // Mayor gravedad -> órbita más cercana al núcleo (sin tocar Roche); menor gravedad -> órbita más lejana/profunda
  const abstractness = 1 - (clamped - 0.32) / (0.84 - 0.32);
  return 0.36 + abstractness * 0.43; // [0.36 .. 0.79] del radio máximo del astrolabio
}

export function evaluateCandidateLaunch(
  rawInput: string,
  pack: LoadedDailyPack,
  lexiconSet: Set<string>,
  activeSatellites: ActiveSatellite[]
): LaunchEvaluation {
  const displayRaw = rawInput.trim().toUpperCase();
  const norm = normalizeSpanishWord(rawInput);
  const coreNorm = normalizeSpanishWord(pack.meta.coreWord);

  if (norm.length < 2) {
    return {
      outcome: 'UNKNOWN_WORD',
      consumesImpulse: false,
      rawInput,
      displayWord: displayRaw,
      normWord: norm,
      message: 'Introduce una palabra de al menos 2 letras.',
    };
  }

  if (norm === coreNorm) {
    return {
      outcome: 'SELF_CORE',
      consumesImpulse: false,
      rawInput,
      displayWord: pack.meta.coreWord,
      normWord: norm,
      message: `"${pack.meta.coreWord}" es el astro central. Lanza conceptos que orbiten a su alrededor.`,
    };
  }

  // Verificar si ya está en órbita (directamente o por lema canónico)
  const resolvedIdx =
    pack.normToIndex.get(norm) ?? pack.fallbackNoEnyeToIndex.get(norm);

  const duplicateSat = activeSatellites.find(
    (s) => s.norm === norm || (resolvedIdx !== undefined && s.candidateIndex === resolvedIdx)
  );
  if (duplicateSat) {
    return {
      outcome: 'DUPLICATE',
      consumesImpulse: false,
      rawInput,
      displayWord: duplicateSat.word,
      normWord: norm,
      message: `"${duplicateSat.word}" ya orbita en tu constelación actual.`,
    };
  }

  // 1. Chequeo de Límite de Roche (Obviedad funcional o derivación morfológica)
  if (pack.rocheSet.has(norm) || isMorphologicalDerivative(pack.meta.coreWord, norm)) {
    return {
      outcome: 'ROCHE_LIMIT',
      consumesImpulse: true,
      rawInput,
      displayWord: displayRaw,
      normWord: norm,
      gravity: 0.94,
      message: `Límite de Roche: "${displayRaw}" es derivada o demasiado obvia respecto a ${pack.meta.coreWord} y se incinera en el núcleo.`,
    };
  }

  // 2. Candidato Orbital Válido en el Subespacio del Día
  if (resolvedIdx !== undefined) {
    const [candNorm, candDisplay, domain, insight] = pack.meta.candidates[resolvedIdx];
    const gravity = pack.gravityAndAngles[resolvedIdx * 2];
    const semanticAngle = pack.gravityAndAngles[resolvedIdx * 2 + 1];

    return {
      outcome: 'ORBIT_CAPTURE',
      consumesImpulse: true,
      rawInput,
      displayWord: candDisplay,
      normWord: candNorm,
      candidateIndex: resolvedIdx,
      domain,
      insight,
      gravity,
      semanticAngle,
      message: `${candDisplay} capturada en órbita · ${domain}`,
    };
  }

  // 3. Validar si existe en el léxico general del español (incluyendo singularización simple)
  const singularGuess = norm.endsWith('ces')
    ? norm.slice(0, -3) + 'z'
    : norm.endsWith('es') && norm.length > 4
      ? norm.slice(0, -2)
      : norm.endsWith('s') && norm.length > 3
        ? norm.slice(0, -1)
        : norm;

  const existsInSpanish =
    lexiconSet.size === 0 || lexiconSet.has(norm) || lexiconSet.has(singularGuess);

  if (!existsInSpanish) {
    return {
      outcome: 'UNKNOWN_WORD',
      consumesImpulse: false,
      rawInput,
      displayWord: displayRaw,
      normWord: norm,
      message: `"${displayRaw}" no figura en la carta léxica (0 impulsos consumidos).`,
    };
  }

  // 4. Palabra real en español pero con afinidad g < tau_min -> Escapa al Vacío Exterior
  // Estimación determinista de baja gravedad [0.07..0.26] para animar la desviación balística exacta
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const lowGravity = 0.08 + ((h >>> 0) % 19) * 0.01;

  return {
    outcome: 'OUTER_VOID',
    consumesImpulse: true,
    rawInput,
    displayWord: displayRaw,
    normWord: norm,
    gravity: Number(lowGravity.toFixed(2)),
    message: `Vacío Exterior: "${displayRaw}" carece de atracción suficiente con ${pack.meta.coreWord} (g=${lowGravity.toFixed(2)} < ${pack.tauMin.toFixed(2)}).`,
  };
}

export function resolveDisplayAngles(satellites: ActiveSatellite[]): ActiveSatellite[] {
  if (satellites.length <= 1) {
    return satellites.map((s) => ({ ...s, displayAngle: s.semanticAngle }));
  }

  // Relajación elástica ligera para evitar solapamiento de etiquetas preservando el cuadrante semántico real
  const angles = satellites.map((s) => s.semanticAngle);
  const minSep = 0.34; // ~19.5 grados mínimos para legibilidad limpia de cápsulas

  for (let iter = 0; iter < 18; iter++) {
    for (let i = 0; i < angles.length; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        let diff = angles[i] - angles[j];
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const absDiff = Math.abs(diff);
        if (absDiff < minSep) {
          const push = (minSep - absDiff) * 0.45;
          const sign = diff >= 0 ? 1 : -1;
          angles[i] += sign * push;
          angles[j] -= sign * push;
        }
      }
      // Ancla elástica hacia su ángulo semántico verdadero
      let anchorDiff = satellites[i].semanticAngle - angles[i];
      while (anchorDiff > Math.PI) anchorDiff -= Math.PI * 2;
      while (anchorDiff < -Math.PI) anchorDiff += Math.PI * 2;
      angles[i] += anchorDiff * 0.22;
    }
  }

  return satellites.map((s, idx) => ({
    ...s,
    displayAngle: angles[idx],
  }));
}

export function computeRankFromPercentiles(
  score: number,
  bands: PercentileBands
): ConstellationTelemetry['rank'] {
  if (score >= Math.max(89.5, bands.p99 - 1.2)) {
    return {
      title: 'Singularidad Creativa',
      tier: 'supernova',
      percentileLabel: 'Top 1% · Bisociación Excepcional',
      badgeColor: '#E5A93C',
    };
  }
  if (score >= Math.max(84.5, bands.p90 - 1.5)) {
    return {
      title: 'Arquitecto Astral',
      tier: 'architect',
      percentileLabel: 'Top 10% · Alta Divergencia',
      badgeColor: '#10B981',
    };
  }
  if (score >= Math.max(77.0, bands.p50)) {
    return {
      title: 'Navegante Bisociativo',
      tier: 'navigator',
      percentileLabel: 'Sobre el promedio humano',
      badgeColor: '#2DD4BF',
    };
  }
  if (score >= Math.max(66.0, bands.p25 - 4)) {
    return {
      title: 'Explorador Orbital',
      tier: 'explorer',
      percentileLabel: 'Órbita parcial · Dominios cercanos',
      badgeColor: '#38BDF8',
    };
  }
  return {
    title: 'Órbita Lineal',
    tier: 'linear',
    percentileLabel: 'Alta colisión semántica',
    badgeColor: '#FB7185',
  };
}

export function evaluateConstellation(
  pack: LoadedDailyPack | null,
  satellites: ActiveSatellite[]
): ConstellationTelemetry {
  const n = satellites.length;
  const defaultBands: PercentileBands = pack?.meta.thresholds.percentiles ?? {
    p25: 68,
    p50: 78,
    p75: 84,
    p90: 88,
    p99: 92,
  };

  if (!pack || n < 2) {
    return {
      satelliteCount: n,
      pairCount: 0,
      score: 0,
      meanDistance: 0,
      minDistance: 0,
      redFrictionCount: 0,
      isHarmonicResonance: false,
      edges: [],
      closestPair: null,
      farthestPair: null,
      rank: computeRankFromPercentiles(0, defaultBands),
    };
  }

  const edges: PairEdgeMetric[] = [];
  let sum = 0;
  let minDist = 2;
  let maxDist = -1;
  let closestPair: PairEdgeMetric | null = null;
  let farthestPair: PairEdgeMetric | null = null;
  let redFrictionCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = satellites[i];
      const b = satellites[j];
      const d = computeTangentialDistance(pack, a.candidateIndex, b.candidateIndex);
      const status: PairEdgeMetric['status'] =
        d >= 0.76 ? 'resonance' : d >= 0.58 ? 'stable' : 'friction';

      if (status === 'friction') redFrictionCount++;

      const edge: PairEdgeMetric = {
        uidA: a.uid,
        uidB: b.uid,
        wordA: a.word,
        wordB: b.word,
        distance: Number(d.toFixed(3)),
        status,
      };
      edges.push(edge);
      sum += d;

      if (d < minDist) {
        minDist = d;
        closestPair = edge;
      }
      if (d > maxDist) {
        maxDist = d;
        farthestPair = edge;
      }
    }
  }

  const meanDistance = sum / edges.length;
  const rawScore = (0.78 * meanDistance + 0.22 * minDist) * 100;
  const score = Number(rawScore.toFixed(1));
  const isHarmonicResonance = n === 5 && redFrictionCount === 0 && minDist >= 0.75;

  return {
    satelliteCount: n,
    pairCount: edges.length,
    score,
    meanDistance: Number(meanDistance.toFixed(4)),
    minDistance: Number(minDist.toFixed(4)),
    redFrictionCount,
    isHarmonicResonance,
    edges,
    closestPair,
    farthestPair,
    rank: computeRankFromPercentiles(score, defaultBands),
  };
}
