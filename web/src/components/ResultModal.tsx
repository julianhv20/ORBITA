'use client';

import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Download, Share2, Compass, Sparkles } from 'lucide-react';
import { useOrbitaStore } from '../store/useOrbitaStore';
import {
  buildSpoilerFreeShareText,
  renderAstralCardBlob,
} from '../utils/astralCardGenerator';

export const ResultModal: React.FC = () => {
  const show = useOrbitaStore((s) => s.showResultModal);
  const setShow = useOrbitaStore((s) => s.setShowResultModal);
  const setShowLab = useOrbitaStore((s) => s.setShowLabSelector);
  const activePack = useOrbitaStore((s) => s.activePack);
  const satellites = useOrbitaStore((s) => s.satellites);
  const telemetry = useOrbitaStore((s) => s.telemetry);
  const impulseLog = useOrbitaStore((s) => s.impulseLog);
  const mode = useOrbitaStore((s) => s.mode);
  const stats = useOrbitaStore((s) => s.stats);

  const [copied, setCopied] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!show || !activePack) return;

    // Animación numérica ascendente suave del puntaje final
    let raf = 0;
    const start = performance.now();
    const duration = 680;
    const target = telemetry.score;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Number((target * ease).toFixed(1)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    let revokedUrl: string | null = null;
    renderAstralCardBlob(activePack, satellites, telemetry, impulseLog).then((blob) => {
      if (blob) {
        setCardBlob(blob);
        revokedUrl = URL.createObjectURL(blob);
        setCardUrl(revokedUrl);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [show, activePack, satellites, telemetry, impulseLog]);

  if (!show || !activePack) return null;

  const shareText = buildSpoilerFreeShareText(
    activePack,
    satellites,
    telemetry,
    impulseLog,
    mode
  );

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const area = document.createElement('textarea');
      area.value = shareText;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleShareOrDownloadCard = async () => {
    if (!cardBlob) return;
    const filename = `orbita_${activePack.meta.id}_${activePack.meta.slug}.png`;
    const file = new File([cardBlob], filename, { type: 'image/png' });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `ÓRBITA #${activePack.meta.id} · ${activePack.meta.coreWord}`,
          text: shareText,
          files: [file],
        });
        return;
      } catch {
        // Si el usuario cancela el sheet nativo, continuamos con descarga directa
      }
    }

    if (cardUrl) {
      const a = document.createElement('a');
      a.href = cardUrl;
      a.download = filename;
      a.click();
    }
  };

  const master = activePack.meta.masterConstellation;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
      onClick={() => setShow(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-obsidian-800/95 border border-astrolabe-400/35 shadow-2xl p-5 sm:p-6 text-ivory-100 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-ivory-100/10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-astrolabe-400 block">
              {mode === 'daily'
                ? `ÓRBITA #${activePack.meta.id} · Constelación Sellada`
                : `Modo Laboratorio · ${activePack.meta.coreWord}`}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl text-ivory-50 mt-0.5">
              {telemetry.rank.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="p-1.5 rounded-lg text-ivory-400 hover:text-ivory-50 hover:bg-ivory-100/10 transition-colors"
            aria-label="Cerrar resultados"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Puntaje Principal + Estadísticas de Racha */}
        <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center border-b border-ivory-100/10">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ivory-400">
              Índice Divergente
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono text-5xl font-bold text-ivory-50 tabular-nums">
                {displayScore.toFixed(1)}
              </span>
              <span className="font-mono text-xs text-ivory-400">
                / 100 · Máx hoy {master.score.toFixed(1)}
              </span>
            </div>
            <span
              className="inline-block mt-1.5 font-mono text-[11px] px-2.5 py-0.5 rounded-full border"
              style={{
                color: telemetry.rank.badgeColor,
                borderColor: `${telemetry.rank.badgeColor}55`,
                backgroundColor: `${telemetry.rank.badgeColor}18`,
              }}
            >
              {telemetry.rank.percentileLabel}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-obsidian-900/90 border border-ivory-100/10 p-2.5">
              <div className="font-mono text-lg font-bold text-astrolabe-300 tabular-nums">
                {stats.currentStreak}
              </div>
              <div className="text-[10px] text-ivory-400 uppercase font-mono">Racha</div>
            </div>
            <div className="rounded-xl bg-obsidian-900/90 border border-ivory-100/10 p-2.5">
              <div className="font-mono text-lg font-bold text-ivory-50 tabular-nums">
                {stats.bestScore > 0 ? stats.bestScore.toFixed(1) : telemetry.score.toFixed(1)}
              </div>
              <div className="text-[10px] text-ivory-400 uppercase font-mono">Récord</div>
            </div>
            <div className="rounded-xl bg-obsidian-900/90 border border-ivory-100/10 p-2.5">
              <div className="font-mono text-lg font-bold text-spectral-400 tabular-nums">
                {stats.gamesPlayed}
              </div>
              <div className="text-[10px] text-ivory-400 uppercase font-mono">Órbitas</div>
            </div>
          </div>
        </div>

        {/* Vista Previa de Carta Astral + Botones Virales */}
        <div className="py-4 space-y-3 border-b border-ivory-100/10">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {cardUrl && (
              <div className="sm:col-span-5 flex justify-center">
                <img
                  src={cardUrl}
                  alt="Carta Astral sin spoilers"
                  className="w-40 sm:w-full max-w-[185px] rounded-xl border border-astrolabe-400/30 shadow-lg"
                />
              </div>
            )}
            <div className={cardUrl ? 'sm:col-span-7 space-y-2.5' : 'sm:col-span-12 space-y-2.5'}>
              <pre className="rounded-xl bg-obsidian-950 border border-ivory-100/10 p-3 font-mono text-[11px] text-ivory-200 whitespace-pre-wrap leading-relaxed select-all">
                {shareText}
              </pre>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="py-2.5 px-3 rounded-xl bg-astrolabe-400 hover:bg-astrolabe-300 text-obsidian-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar Resumen'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareOrDownloadCard}
                  className="py-2.5 px-3 rounded-xl bg-obsidian-900 hover:bg-obsidian-700 text-ivory-50 border border-astrolabe-400/40 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-astrolabe-400 hidden sm:inline" />
                  <Download className="w-3.5 h-3.5 text-astrolabe-400 sm:hidden" />
                  <span>Carta PNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Revelación Post-Partida: La Constelación Maestra del Día */}
        <div className="pt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-astrolabe-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-astrolabe-300">
                Constelación Maestra del Día ({master.score.toFixed(1)} pts)
              </h3>
            </div>
            <span className="font-mono text-[10px] text-ivory-400">Óptimo Teórico</span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {master.satellites.map((ms) => (
              <div
                key={ms.word}
                className="rounded-xl bg-obsidian-900/80 border border-ivory-100/10 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-ivory-50">{ms.word}</span>
                  <span className="font-mono text-[10px] text-spectral-400">{ms.domain}</span>
                </div>
                <p className="text-[11px] text-ivory-400 mt-0.5 leading-snug">{ms.insight}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShow(false);
                setShowLab(true);
              }}
              className="py-2 px-4 rounded-xl bg-ivory-100/10 hover:bg-ivory-100/15 text-ivory-100 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-astrolabe-400" />
              <span>Explorar Archivo / Modo Laboratorio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
