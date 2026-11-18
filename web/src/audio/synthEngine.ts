/**
 * Motor de Audio Generativo Espacial 2.0 (Web Audio API Pura — 0 KB de samples MP3)
 * Incluye Reverb por Convolución Algorítmica, Delay Estéreo, Síntesis FM Cristalina
 * en Escala Lidia (Do Lidio Maj9#11) y Feedback Háptico Móvil.
 */

class SpatialSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private wetGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private enabled = true;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (val) {
      this.ensureGraph();
    } else if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.05);
      this.playTick();
    }
    return this.enabled;
  }

  private vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignorar en navegadores sin permiso háptico
      }
    }
  }

  public ensureGraph(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      this.masterGain = master;

      const dry = ctx.createGain();
      dry.gain.value = 0.72;
      dry.connect(master);
      this.dryGain = dry;

      // Reverb algorítmica de cúpula astronómica (2.1 segundos)
      const convolver = ctx.createConvolver();
      convolver.buffer = this.buildCosmicImpulse(ctx, 2.1, 2.8);
      const wet = ctx.createGain();
      wet.gain.value = 0.36;
      convolver.connect(wet);
      wet.connect(master);
      this.reverbNode = convolver;
      this.wetGain = wet;

      // Delay cósmico filtrado
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = 0.24;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1650;

      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      this.delayNode = delay;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private buildCosmicImpulse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * env * 0.55;
      }
    }
    return impulse;
  }

  private connectVoice(node: AudioNode, sendDelay = false): void {
    if (!this.dryGain || !this.reverbNode) return;
    node.connect(this.dryGain);
    node.connect(this.reverbNode);
    if (sendDelay && this.delayNode) {
      node.connect(this.delayNode);
    }
  }

  public playTick(): void {
    const ctx = this.ensureGraph();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.045);
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.05);
    osc.connect(g);
    this.connectVoice(g, false);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playInvalidShake(): void {
    const ctx = this.ensureGraph();
    this.vibrate(20);
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.setValueAtTime(155, now + 0.06);
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    this.connectVoice(g, false);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Despegue balístico de sonda hacia el núcleo (~550ms de vuelo) */
  public playProbeLaunch(): void {
    const ctx = this.ensureGraph();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.38);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(g);
    this.connectVoice(g, true);
    osc.start(now);
    osc.stop(now + 0.44);
  }

  /** Incineración en el Límite de Roche: caída sub-grave + crepitación de plasma */
  public playRocheBurn(): void {
    const ctx = this.ensureGraph();
    this.vibrate([35, 25, 55]);
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub-grave descendente
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(145, now);
    sub.frequency.exponentialRampToValueAtTime(44, now + 0.48);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(95, now + 0.48);

    subGain.gain.setValueAtTime(0.16, now);
    subGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);

    sub.connect(lp);
    lp.connect(subGain);
    this.connectVoice(subGain, false);
    sub.start(now);
    sub.stop(now + 0.54);

    // Ráfaga corta de ruido filtrado (plasma)
    const bufSize = Math.floor(ctx.sampleRate * 0.28);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.8);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 920;
    bp.Q.value = 1.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.09;
    noise.connect(bp);
    bp.connect(ng);
    this.connectVoice(ng, true);
    noise.start(now);
  }

  /** Escape frío al Vacío Exterior: efecto Doppler descendente espacial */
  public playVoidEscape(): void {
    const ctx = this.ensureGraph();
    this.vibrate(25);
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.55);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);

    osc.connect(g);
    this.connectVoice(g, true);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  /** Captura orbital inicial del satélite */
  public playOrbitCapture(slotIndex: number): void {
    const ctx = this.ensureGraph();
    this.vibrate(14);
    if (!ctx) return;
    const now = ctx.currentTime;

    // Escala Lidia en Do: C4, D4, E4, F#4, G4, A4, B4, D5
    const lydian = [261.63, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 587.33];
    const baseFreq = lydian[slotIndex % lydian.length];

    const carrier = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const g = ctx.createGain();
    const hg = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq, now);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(baseFreq * 2, now);
    hg.gain.value = 0.22;

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.85);

    carrier.connect(g);
    harmonic.connect(hg);
    hg.connect(g);
    this.connectVoice(g, true);

    carrier.start(now);
    harmonic.start(now);
    carrier.stop(now + 0.88);
    harmonic.stop(now + 0.88);
  }

  /** Arista geométrica trazándose hacia un satélite previo (consonante o fricción) */
  public playEdgeSnap(distance: number, stepIdx: number): void {
    const ctx = this.ensureGraph();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (distance < 0.58) {
      // Fricción roja: díada tensa de segunda menor suave
      const f1 = 220;
      const f2 = 233.08;
      [f1, f2].forEach((f) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.045, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);
        osc.connect(g);
        this.connectVoice(g, false);
        osc.start(now);
        osc.stop(now + 0.34);
      });
      return;
    }

    // Arpegio cristalino ascendente proporcional a la divergencia
    const highLydian = [392.0, 440.0, 493.88, 587.33, 659.25, 739.99, 783.99, 880.0];
    const idx = Math.min(
      highLydian.length - 1,
      Math.floor(Math.max(0, distance - 0.55) * 10) + (stepIdx % 3)
    );
    const freq = highLydian[idx];

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.065, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.55);

    osc.connect(g);
    this.connectVoice(g, true);
    osc.start(now);
    osc.stop(now + 0.58);
  }

  /** Eyección táctica de un satélite para optimizar la constelación */
  public playEject(): void {
    const ctx = this.ensureGraph();
    this.vibrate(18);
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(195, now + 0.22);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    this.connectVoice(g, false);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Clímax al sellar la constelación: Acorde Lidio Maj9(#11) luminoso */
  public playConstellationSealed(isHarmonicResonance: boolean): void {
    const ctx = this.ensureGraph();
    this.vibrate(isHarmonicResonance ? [20, 40, 20, 40, 70] : [25, 35, 45]);
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = isHarmonicResonance
      ? [130.81, 196.0, 329.63, 493.88, 587.33, 739.99, 987.77] // C Maj9(#11) completo
      : [130.81, 196.0, 293.66, 392.0, 493.88]; // C Maj9 contemplativo

    notes.forEach((freq, i) => {
      const t = now + i * 0.075;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);

      g.gain.setValueAtTime(0.0008, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.09 : 0.065, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 2.1);

      osc.connect(g);
      this.connectVoice(g, true);
      osc.start(t);
      osc.stop(t + 2.15);
    });
  }
}

export const synth = new SpatialSynthEngine();
