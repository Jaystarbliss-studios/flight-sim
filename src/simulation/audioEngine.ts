import { FlightState } from '../types';

/** Lightweight layered WebAudio mix. No external audio files are required for the simulator build. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private isInitialized = false;

  private master!: GainNode;
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private turbineOsc: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private groundGain: GainNode | null = null;
  private stallOsc: OscillatorNode | null = null;
  private stallGain: GainNode | null = null;
  private afterburnerOsc: OscillatorNode | null = null;
  private afterburnerGain: GainNode | null = null;

  private lastCalloutAlt = 99999;
  private hasSpokenRetard = false;
  private previousGearDown: boolean | null = null;
  private previousFlapsIndex: number | null = null;
  private previousPhase: FlightState['phase'] | null = null;
  private previousBrakes = false;
  private previousMach = 0;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);

      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'triangle';
      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.value = 0;
      this.rumbleOsc.connect(this.rumbleGain).connect(this.master);
      this.rumbleOsc.start();

      this.turbineOsc = this.ctx.createOscillator();
      this.turbineOsc.type = 'sawtooth';
      const turbineFilter = this.ctx.createBiquadFilter();
      turbineFilter.type = 'bandpass';
      turbineFilter.Q.value = 3.5;
      this.turbineGain = this.ctx.createGain();
      this.turbineGain.gain.value = 0;
      this.turbineOsc.connect(turbineFilter).connect(this.turbineGain).connect(this.master);
      this.turbineOsc.start();

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 900;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.noiseNode.connect(windFilter).connect(this.windGain).connect(this.master);

      const groundFilter = this.ctx.createBiquadFilter();
      groundFilter.type = 'lowpass';
      groundFilter.frequency.value = 180;
      this.groundGain = this.ctx.createGain();
      this.groundGain.gain.value = 0;
      this.noiseNode.connect(groundFilter).connect(this.groundGain).connect(this.master);
      this.noiseNode.start();

      this.stallOsc = this.ctx.createOscillator();
      this.stallOsc.type = 'square';
      this.stallOsc.frequency.value = 650;
      this.stallGain = this.ctx.createGain();
      this.stallGain.gain.value = 0;
      this.stallOsc.connect(this.stallGain).connect(this.master);
      this.stallOsc.start();

      this.afterburnerOsc = this.ctx.createOscillator();
      this.afterburnerOsc.type = 'sawtooth';
      this.afterburnerOsc.frequency.value = 52;
      const abFilter = this.ctx.createBiquadFilter();
      abFilter.type = 'lowpass';
      abFilter.frequency.value = 240;
      this.afterburnerGain = this.ctx.createGain();
      this.afterburnerGain.gain.value = 0;
      this.afterburnerOsc.connect(abFilter).connect(this.afterburnerGain).connect(this.master);
      this.afterburnerOsc.start();

      this.isInitialized = true;
    } catch {
      this.ctx = null;
    }
  }

  public update(state: FlightState) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;
    const n1 = Math.max(0, Math.min(1, (state.n1 - 18) / 82));
    const speed = Math.max(0, Math.min(1, state.airspeedKnots / 420));
    const airborne = state.radioAltitudeFt > 8;

    if (this.rumbleGain && this.rumbleOsc && this.turbineGain && this.turbineOsc) {
      const running = state.enginesRunning;
      this.rumbleGain.gain.setTargetAtTime(running ? 0.045 + n1 * 0.19 : 0, t, 0.08);
      this.rumbleOsc.frequency.setTargetAtTime(running ? 38 + n1 * 52 : 24, t, 0.08);
      this.turbineGain.gain.setTargetAtTime(running ? 0.018 + n1 * 0.11 : 0, t, 0.08);
      this.turbineOsc.frequency.setTargetAtTime(250 + n1 * 1100, t, 0.08);
    }

    if (this.afterburnerGain) {
      const abActive = Boolean(state.afterburnerActive && state.enginesRunning);
      this.afterburnerGain.gain.setTargetAtTime(abActive ? 0.26 : 0, t, 0.06);
    }

    this.windGain?.gain.setTargetAtTime(speed * speed * 0.2, t, 0.12);
    const groundLevel = !airborne && state.airspeedKnots > 4 ? Math.min(1, state.airspeedKnots / 150) : 0;
    this.groundGain?.gain.setTargetAtTime(groundLevel * 0.18, t, 0.07);
    this.stallGain?.gain.setTargetAtTime(state.isStalled && airborne ? 0.16 : 0, t, 0.03);

    // Sonic boom detection
    if (state.mach >= 1.0 && this.previousMach < 1.0) {
      this.playSonicBoom();
    }
    this.previousMach = state.mach;

    this.detectSystemChanges(state);
    this.checkGpwsCallouts(state);
  }

  public playSonicBoom() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.55);
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  public playFlareSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);
    filter.type = 'bandpass';
    filter.frequency.value = 650;
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private detectSystemChanges(state: FlightState) {
    if (this.previousGearDown !== null && this.previousGearDown !== state.gearDown) this.playMechanical('gear');
    if (this.previousFlapsIndex !== null && this.previousFlapsIndex !== state.flapsIndex) this.playMechanical('flap');
    if (this.previousBrakes !== state.brakesActive && state.brakesActive) this.playMechanical('brake');
    if (this.previousPhase !== null && state.phase === 'landing' && this.previousPhase !== 'landing') this.playChime();
    this.previousGearDown = state.gearDown;
    this.previousFlapsIndex = state.flapsIndex;
    this.previousBrakes = state.brakesActive;
    this.previousPhase = state.phase;
  }

  private playMechanical(kind: 'gear' | 'flap' | 'brake') {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const now = this.ctx.currentTime;
    osc.type = kind === 'brake' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(kind === 'gear' ? 115 : kind === 'flap' ? 180 : 70, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'gear' ? 65 : 90, now + 0.22);
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'brake' ? 420 : 900;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'brake' ? 0.08 : 0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private checkGpwsCallouts(state: FlightState) {
    if (state.verticalSpeedFpm >= -100) {
      if (state.radioAltitudeFt > 600) {
        this.lastCalloutAlt = 99999;
        this.hasSpokenRetard = false;
      }
      return;
    }
    const radAlt = state.radioAltitudeFt;
    for (const threshold of [1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10]) {
      if (radAlt <= threshold && this.lastCalloutAlt > threshold) {
        this.lastCalloutAlt = threshold;
        this.playVoiceCallout(String(threshold));
        break;
      }
    }
    if (radAlt <= 15 && !this.hasSpokenRetard && state.throttle > 0.1) {
      this.hasSpokenRetard = true;
      this.playVoiceCallout('Retard');
    }
    if (state.isPullUp && this.lastCalloutAlt !== -1) {
      this.lastCalloutAlt = -1;
      this.playVoiceCallout('Pull Up');
    }
  }

  public playTouchdownScreech() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.42);
    filter.type = 'highpass';
    filter.frequency.value = 520;
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playChime() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    gain.connect(this.master);
    for (const [freq, offset] of [[880, 0], [660, 0.12]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.35);
    }
  }

  public playVoiceCallout(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.isMuted) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.12;
      utterance.pitch = 0.86;
      utterance.volume = 0.75;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Browser speech APIs are optional.
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    } else if (!this.isMuted && this.ctx) {
      this.master.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.08);
    }
    return this.isMuted;
  }
}

export const globalAudio = new AudioEngine();
