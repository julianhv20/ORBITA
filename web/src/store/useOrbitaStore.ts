import { create } from 'zustand';
import {
  ActiveSatellite,
  ConstellationTelemetry,
  DailyPackMetadata,
  ImpulseLogEntry,
  LaunchEvaluation,
  LoadedDailyPack,
  PlayerStats,
  PuzzleManifestEntry,
  SeasonManifest,
} from '../core/types';
import {
  decodeDailyPack,
  evaluateCandidateLaunch,
  evaluateConstellation,
  mapGravityToOrbitRatio,
  resolveDisplayAngles,
  SATELLITE_PALETTE,
} from '../core/orbitalEngine';
import { synth } from '../audio/synthEngine';

export const MAX_IMPULSES = 8;
export const TARGET_SATELLITES = 5;

const STATS_STORAGE_KEY = 'orbita_player_stats_v1';
const DAILY_PROGRESS_PREFIX = 'orbita_daily_session_v1_';
const ONBOARDING_SEEN_KEY = 'orbita_onboarding_seen_v1';

export interface InFlightProbe {
  id: string;
  word: string;
  evaluation: LaunchEvaluation;
  targetAngle: number;
  targetRadiusRatio: number;
  startedAt: number;
  durationMs: number;
}

export interface FeedbackBanner {
  id: number;
  text: string;
  tone: 'gold' | 'emerald' | 'crimson' | 'void' | 'neutral';
}

interface OrbitaStoreState {
  isBooting: boolean;
  bootError: string | null;
  manifest: SeasonManifest | null;
  lexiconSet: Set<string>;
  packCache: Map<string, LoadedDailyPack>;

  mode: 'daily' | 'lab';
  dailyPuzzleId: string;
  activePuzzleId: string;
  activePack: LoadedDailyPack | null;

  satellites: ActiveSatellite[];
  telemetry: ConstellationTelemetry;
  impulsesLeft: number;
  impulseLog: ImpulseLogEntry[];
  isSealed: boolean;
  inFlightProbe: InFlightProbe | null;
  inputShakeNonce: number;
  banner: FeedbackBanner | null;

  selectedSatelliteUid: string | null;
  showOnboarding: boolean;
  showResultModal: boolean;
  showLabSelector: boolean;
  soundEnabled: boolean;
  stats: PlayerStats;

  initializeApp: () => Promise<void>;
  selectPuzzle: (puzzleId: string, mode: 'daily' | 'lab') => Promise<void>;
  submitWord: (rawWord: string) => void;
  ejectSatellite: (uid: string) => void;
  sealConstellation: () => void;
  resetLabSession: () => void;
  setSelectedSatellite: (uid: string | null) => void;
  setShowOnboarding: (open: boolean) => void;
  setShowResultModal: (open: boolean) => void;
  setShowLabSelector: (open: boolean) => void;
  toggleSound: () => void;
}

const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastCompletedPuzzleId: null,
  lastCompletedDate: null,
  bestScore: 0,
  averageScore: 0,
  tierCounts: {
    supernova: 0,
    architect: 0,
    navigator: 0,
    explorer: 0,
    linear: 0,
  },
};

function getLocalTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveDailyPuzzleEntry(manifest: SeasonManifest): PuzzleManifestEntry {
  const epoch = new Date(`${manifest.epochDate}T00:00:00`);
  const now = new Date();
  const diffDays = Math.max(
    0,
    Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24))
  );
  const idx = diffDays % manifest.puzzles.length;
  return manifest.puzzles[idx];
}

function loadStoredStats(): PlayerStats {
  if (typeof window === 'undefined') return DEFAULT_STATS;
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return DEFAULT_STATS;
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATS;
  }
}

function saveStoredStats(stats: PlayerStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignorar cuota llena
  }
}

interface PersistedSession {
  puzzleId: string;
  dateISO: string;
  satellites: ActiveSatellite[];
  impulsesLeft: number;
  impulseLog: ImpulseLogEntry[];
  isSealed: boolean;
}

function saveDailySession(session: PersistedSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${DAILY_PROGRESS_PREFIX}${session.puzzleId}_${session.dateISO}`,
      JSON.stringify(session)
    );
  } catch {
    // Ignorar
  }
}

function loadDailySession(puzzleId: string, dateISO: string): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${DAILY_PROGRESS_PREFIX}${puzzleId}_${dateISO}`);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export const useOrbitaStore = create<OrbitaStoreState>((set, get) => ({
  isBooting: true,
  bootError: null,
  manifest: null,
  lexiconSet: new Set<string>(),
  packCache: new Map<string, LoadedDailyPack>(),

  mode: 'daily',
  dailyPuzzleId: '001',
  activePuzzleId: '001',
  activePack: null,

  satellites: [],
  telemetry: evaluateConstellation(null, []),
  impulsesLeft: MAX_IMPULSES,
  impulseLog: [],
  isSealed: false,
  inFlightProbe: null,
  inputShakeNonce: 0,
  banner: null,

  selectedSatelliteUid: null,
  showOnboarding: false,
  showResultModal: false,
  showLabSelector: false,
  soundEnabled: true,
  stats: DEFAULT_STATS,

  initializeApp: async () => {
    try {
      const [manifestRes, lexiconRes] = await Promise.all([
        fetch('/daily/manifest.json'),
        fetch('/daily/lexicon_es.txt'),
      ]);

      if (!manifestRes.ok) {
        throw new Error(`No se pudo cargar el manifiesto orbital (HTTP ${manifestRes.status})`);
      }

      const manifest = (await manifestRes.json()) as SeasonManifest;
      const lexText = lexiconRes.ok ? await lexiconRes.text() : '';
      const lexiconSet = new Set<string>(
        lexText
          .split(/\r?\n/)
          .map((w) => w.trim())
          .filter(Boolean)
      );

      const dailyEntry = resolveDailyPuzzleEntry(manifest);
      const stats = loadStoredStats();
      const seenOnboarding =
        typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';

      set({
        manifest,
        lexiconSet,
        dailyPuzzleId: dailyEntry.id,
        stats,
        showOnboarding: !seenOnboarding,
      });

      await get().selectPuzzle(dailyEntry.id, 'daily');
      set({ isBooting: false });
    } catch (err) {
      set({
        isBooting: false,
        bootError: err instanceof Error ? err.message : 'Error al inicializar el observatorio.',
      });
    }
  },

  selectPuzzle: async (puzzleId: string, mode: 'daily' | 'lab') => {
    const { manifest, packCache } = get();
    if (!manifest) return;

    const entry = manifest.puzzles.find((p) => p.id === puzzleId) ?? manifest.puzzles[0];
    let pack = packCache.get(entry.id);

    if (!pack) {
      const [metaRes, binRes] = await Promise.all([
        fetch(`/daily/${entry.jsonFile}`),
        fetch(`/daily/${entry.binFile}`),
      ]);
      if (!metaRes.ok || !binRes.ok) {
        throw new Error(`No se pudo descargar el paquete diario #${entry.id}`);
      }
      const meta = (await metaRes.json()) as DailyPackMetadata;
      const buffer = await binRes.arrayBuffer();
      pack = decodeDailyPack(meta, buffer);
      packCache.set(entry.id, pack);
    }

    // Restaurar sesión diaria si estamos en el Ritual Diario de hoy
    const todayISO = getLocalTodayISO();
    if (mode === 'daily') {
      const saved = loadDailySession(entry.id, todayISO);
      if (saved) {
        const telemetry = evaluateConstellation(pack, saved.satellites);
        set({
          mode: 'daily',
          activePuzzleId: entry.id,
          activePack: pack,
          satellites: saved.satellites,
          telemetry,
          impulsesLeft: saved.impulsesLeft,
          impulseLog: saved.impulseLog,
          isSealed: saved.isSealed,
          inFlightProbe: null,
          selectedSatelliteUid: null,
          showLabSelector: false,
          showResultModal: saved.isSealed,
          banner: null,
        });
        return;
      }
    }

    set({
      mode,
      activePuzzleId: entry.id,
      activePack: pack,
      satellites: [],
      telemetry: evaluateConstellation(pack, []),
      impulsesLeft: MAX_IMPULSES,
      impulseLog: [],
      isSealed: false,
      inFlightProbe: null,
      selectedSatelliteUid: null,
      showLabSelector: false,
      showResultModal: false,
      banner: null,
    });
  },

  submitWord: (rawWord: string) => {
    const state = get();
    const { activePack, lexiconSet, satellites, impulsesLeft, isSealed, inFlightProbe } = state;

    if (!activePack || isSealed || inFlightProbe || impulsesLeft <= 0) return;

    const evaluation = evaluateCandidateLaunch(rawWord, activePack, lexiconSet, satellites);

    // Errores sin gasto de impulso (fuera de diccionario, duplicado o palabra núcleo)
    if (!evaluation.consumesImpulse) {
      synth.playInvalidShake();
      set({
        inputShakeNonce: state.inputShakeNonce + 1,
        banner: {
          id: Date.now(),
          text: evaluation.message,
          tone: 'neutral',
        },
      });
      return;
    }

    // Si ya tiene 5 satélites en órbita, primero debe eyectar uno para lanzar otro
    if (satellites.length >= TARGET_SATELLITES) {
      synth.playInvalidShake();
      set({
        inputShakeNonce: state.inputShakeNonce + 1,
        banner: {
          id: Date.now(),
          text: 'Órbita llena (5/5). Eyecta un satélite si deseas reemplazarlo o pulsa Sellar Constelación.',
          tone: 'gold',
        },
      });
      return;
    }

    // Calcular destino geométrico para el vuelo balístico de ~560ms
    const targetAngle =
      evaluation.semanticAngle !== undefined
        ? evaluation.semanticAngle
        : (Math.random() * 2 - 1) * Math.PI;

    const targetRadiusRatio =
      evaluation.outcome === 'ROCHE_LIMIT'
        ? 0.08
        : evaluation.outcome === 'OUTER_VOID'
          ? 1.18
          : mapGravityToOrbitRatio(evaluation.gravity ?? 0.6);

    const probe: InFlightProbe = {
      id: `probe_${Date.now()}`,
      word: evaluation.displayWord,
      evaluation,
      targetAngle,
      targetRadiusRatio,
      startedAt: performance.now(),
      durationMs: 560,
    };

    synth.playProbeLaunch();
    set({ inFlightProbe: probe });

    window.setTimeout(() => {
      const curr = get();
      if (!curr.activePack || curr.inFlightProbe?.id !== probe.id) return;

      const nextImpulses = Math.max(0, curr.impulsesLeft - 1);
      const stepNumber = MAX_IMPULSES - nextImpulses;

      if (evaluation.outcome === 'ROCHE_LIMIT') {
        synth.playRocheBurn();
        const nextLog: ImpulseLogEntry[] = [
          ...curr.impulseLog,
          {
            step: stepNumber,
            word: evaluation.displayWord,
            outcome: 'ROCHE_LIMIT',
            detail: 'Incinerada en el Límite de Roche',
            gravity: evaluation.gravity,
          },
        ];

        const autoSeal = nextImpulses === 0;
        set({
          inFlightProbe: null,
          impulsesLeft: nextImpulses,
          impulseLog: nextLog,
          banner: {
            id: Date.now(),
            text: evaluation.message,
            tone: 'crimson',
          },
        });

        if (autoSeal) {
          get().sealConstellation();
        } else if (curr.mode === 'daily') {
          saveDailySession({
            puzzleId: curr.activePuzzleId,
            dateISO: getLocalTodayISO(),
            satellites: curr.satellites,
            impulsesLeft: nextImpulses,
            impulseLog: nextLog,
            isSealed: false,
          });
        }
        return;
      }

      if (evaluation.outcome === 'OUTER_VOID') {
        synth.playVoidEscape();
        const nextLog: ImpulseLogEntry[] = [
          ...curr.impulseLog,
          {
            step: stepNumber,
            word: evaluation.displayWord,
            outcome: 'OUTER_VOID',
            detail: 'Escapó al Vacío Exterior',
            gravity: evaluation.gravity,
          },
        ];

        const autoSeal = nextImpulses === 0;
        set({
          inFlightProbe: null,
          impulsesLeft: nextImpulses,
          impulseLog: nextLog,
          banner: {
            id: Date.now(),
            text: evaluation.message,
            tone: 'void',
          },
        });

        if (autoSeal) {
          get().sealConstellation();
        } else if (curr.mode === 'daily') {
          saveDailySession({
            puzzleId: curr.activePuzzleId,
            dateISO: getLocalTodayISO(),
            satellites: curr.satellites,
            impulsesLeft: nextImpulses,
            impulseLog: nextLog,
            isSealed: false,
          });
        }
        return;
      }

      // Captura Orbital Estable
      const usedHexes = new Set(curr.satellites.map((s) => s.color.hex));
      const chosenColor =
        SATELLITE_PALETTE.find((c) => !usedHexes.has(c.hex)) ??
        SATELLITE_PALETTE[curr.satellites.length % SATELLITE_PALETTE.length];

      const newSat: ActiveSatellite = {
        uid: `sat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        candidateIndex: evaluation.candidateIndex!,
        word: evaluation.displayWord,
        norm: evaluation.normWord,
        domain: evaluation.domain ?? 'Conexión Conceptual',
        insight: evaluation.insight ?? '',
        gravity: evaluation.gravity ?? 0.6,
        semanticAngle: evaluation.semanticAngle ?? 0,
        displayAngle: evaluation.semanticAngle ?? 0,
        orbitRadiusRatio: targetRadiusRatio,
        color: chosenColor,
        launchedAt: performance.now(),
      };

      const relaxedSatellites = resolveDisplayAngles([...curr.satellites, newSat]);
      const nextTelemetry = evaluateConstellation(curr.activePack, relaxedSatellites);

      synth.playOrbitCapture(relaxedSatellites.length - 1);

      // Disparar arpegios secuenciales (115ms por arista nueva)
      const newEdges = nextTelemetry.edges.filter(
        (e) => e.uidA === newSat.uid || e.uidB === newSat.uid
      );
      newEdges.forEach((edge, idx) => {
        window.setTimeout(() => {
          synth.playEdgeSnap(edge.distance, idx);
        }, 120 + idx * 115);
      });

      const hasNewFriction = newEdges.some((e) => e.status === 'friction');
      const nextLog: ImpulseLogEntry[] = [
        ...curr.impulseLog,
        {
          step: stepNumber,
          word: evaluation.displayWord,
          outcome: 'ORBIT_CAPTURE',
          detail: evaluation.domain ?? 'En órbita',
          gravity: evaluation.gravity,
        },
      ];

      const bannerText =
        relaxedSatellites.length === TARGET_SATELLITES && nextImpulses > 0
          ? `5/5 en órbita (${nextTelemetry.score.toFixed(1)} pts). Puedes Sellar Constelación o eyectar un nodo (${nextImpulses} ${nextImpulses === 1 ? 'impulso restante' : 'impulsos restantes'}).`
          : hasNewFriction
            ? `${newSat.word} entró en órbita, pero genera fricción semántica con otro satélite.`
            : `${newSat.word} capturada en órbita · ${newSat.domain}`;

      set({
        inFlightProbe: null,
        satellites: relaxedSatellites,
        telemetry: nextTelemetry,
        impulsesLeft: nextImpulses,
        impulseLog: nextLog,
        selectedSatelliteUid: newSat.uid,
        banner: {
          id: Date.now(),
          text: bannerText,
          tone: hasNewFriction ? 'crimson' : nextTelemetry.isHarmonicResonance ? 'gold' : 'emerald',
        },
      });

      // Si se agotaron los 8 impulsos, sellamos automáticamente la constelación
      if (nextImpulses === 0) {
        window.setTimeout(() => {
          get().sealConstellation();
        }, 550);
      } else if (curr.mode === 'daily') {
        saveDailySession({
          puzzleId: curr.activePuzzleId,
          dateISO: getLocalTodayISO(),
          satellites: relaxedSatellites,
          impulsesLeft: nextImpulses,
          impulseLog: nextLog,
          isSealed: false,
        });
      }
    }, probe.durationMs);
  },

  ejectSatellite: (uid: string) => {
    const curr = get();
    if (!curr.activePack || curr.isSealed || curr.inFlightProbe) return;
    if (curr.impulsesLeft <= 0) {
      set({
        banner: {
          id: Date.now(),
          text: 'Sin impulsos disponibles para reemplazar satélites.',
          tone: 'neutral',
        },
      });
      return;
    }

    const target = curr.satellites.find((s) => s.uid === uid);
    if (!target) return;

    synth.playEject();
    const remaining = resolveDisplayAngles(curr.satellites.filter((s) => s.uid !== uid));
    const nextTelemetry = evaluateConstellation(curr.activePack, remaining);
    const nextLog: ImpulseLogEntry[] = [
      ...curr.impulseLog,
      {
        step: MAX_IMPULSES - curr.impulsesLeft,
        word: target.word,
        outcome: 'EJECTED',
        detail: 'Desacoplado tácticamente',
      },
    ];

    set({
      satellites: remaining,
      telemetry: nextTelemetry,
      impulseLog: nextLog,
      selectedSatelliteUid: remaining.length > 0 ? remaining[remaining.length - 1].uid : null,
      banner: {
        id: Date.now(),
        text: `"${target.word}" desacoplada de la órbita. Lanza un concepto en un cuadrante distinto.`,
        tone: 'gold',
      },
    });

    if (curr.mode === 'daily') {
      saveDailySession({
        puzzleId: curr.activePuzzleId,
        dateISO: getLocalTodayISO(),
        satellites: remaining,
        impulsesLeft: curr.impulsesLeft,
        impulseLog: nextLog,
        isSealed: false,
      });
    }
  },

  sealConstellation: () => {
    const curr = get();
    if (!curr.activePack || curr.isSealed) return;

    const finalScore =
      curr.satellites.length === TARGET_SATELLITES
        ? curr.telemetry.score
        : Number((curr.telemetry.score * (curr.satellites.length / TARGET_SATELLITES)).toFixed(1));

    const finalTelemetry: ConstellationTelemetry =
      curr.satellites.length === TARGET_SATELLITES
        ? curr.telemetry
        : {
            ...curr.telemetry,
            score: finalScore,
          };

    synth.playConstellationSealed(finalTelemetry.isHarmonicResonance);

    let updatedStats = curr.stats;
    const todayISO = getLocalTodayISO();

    if (curr.mode === 'daily') {
      saveDailySession({
        puzzleId: curr.activePuzzleId,
        dateISO: todayISO,
        satellites: curr.satellites,
        impulsesLeft: curr.impulsesLeft,
        impulseLog: curr.impulseLog,
        isSealed: true,
      });

      // Actualizar estadísticas oficiales solo una vez por día
      if (curr.stats.lastCompletedDate !== todayISO) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        const nextStreak =
          curr.stats.lastCompletedDate === yISO ? curr.stats.currentStreak + 1 : 1;
        const nextPlayed = curr.stats.gamesPlayed + 1;
        const nextAvg = Number(
          (
            (curr.stats.averageScore * curr.stats.gamesPlayed + finalTelemetry.score) /
            nextPlayed
          ).toFixed(1)
        );
        const tier = finalTelemetry.rank.tier;

        updatedStats = {
          gamesPlayed: nextPlayed,
          currentStreak: nextStreak,
          maxStreak: Math.max(curr.stats.maxStreak, nextStreak),
          lastCompletedPuzzleId: curr.activePuzzleId,
          lastCompletedDate: todayISO,
          bestScore: Math.max(curr.stats.bestScore, finalTelemetry.score),
          averageScore: nextAvg,
          tierCounts: {
            ...curr.stats.tierCounts,
            [tier]: (curr.stats.tierCounts[tier] ?? 0) + 1,
          },
        };
        saveStoredStats(updatedStats);
      }
    }

    set({
      isSealed: true,
      telemetry: finalTelemetry,
      stats: updatedStats,
      showResultModal: true,
      banner: {
        id: Date.now(),
        text: `Constelación sellada · Índice Divergente: ${finalTelemetry.score.toFixed(1)} / 100`,
        tone: 'gold',
      },
    });
  },

  resetLabSession: () => {
    const curr = get();
    if (!curr.activePack) return;
    synth.playTick();
    set({
      mode: 'lab',
      satellites: [],
      telemetry: evaluateConstellation(curr.activePack, []),
      impulsesLeft: MAX_IMPULSES,
      impulseLog: [],
      isSealed: false,
      inFlightProbe: null,
      selectedSatelliteUid: null,
      showResultModal: false,
      banner: {
        id: Date.now(),
        text: `Modo Laboratorio reiniciado para ${curr.activePack.meta.coreWord}.`,
        tone: 'neutral',
      },
    });
  },

  setSelectedSatellite: (uid) => set({ selectedSatelliteUid: uid }),
  setShowOnboarding: (open) => {
    if (!open && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
      } catch {
        // Ignorar
      }
    }
    set({ showOnboarding: open });
  },
  setShowResultModal: (open) => set({ showResultModal: open }),
  setShowLabSelector: (open) => set({ showLabSelector: open }),
  toggleSound: () => {
    const enabled = synth.toggle();
    set({ soundEnabled: enabled });
  },
}));
