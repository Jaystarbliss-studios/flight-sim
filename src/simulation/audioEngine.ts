import { FlightState } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Turbofan low rumble
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;

  // Turbine high-pitch whine
  private turbineOsc: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;

  // Jet exhaust & wind noise
  private noiseNode: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private groundGain: GainNode | null = null;

  // Stall alert
  private stallOsc: OscillatorNode | null = null;
  private stallGain: GainNode | null = null;
  private stallInterval: number | null = null;

  // GPWS callouts tracking
  private lastCalloutAlt: number = 99999;
  private hasSpokenRetard: boolean = false;

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // 1. Turbofan low rumble
      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'triangle';
      this.rumbleOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.rumbleOsc.connect(this.rumbleGain);
      this.rumbleGain.connect(this.ctx.destination);
      this.rumbleOsc.start();

      // 2. Turbine whine
      this.turbineOsc = this.ctx.createOscillator();
      this.turbineOsc.type = 'sawtooth';
      this.turbineOsc.frequency.setValueAtTime(320, this.ctx.currentTime);
      const turbineFilter = this.ctx.createBiquadFilter();
      turbineFilter.type = 'bandpass';
      turbineFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      turbineFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      this.turbineGain = this.ctx.createGain();
      this.turbineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.turbineOsc.connect(turbineFilter);
      turbineFilter.connect(this.turbineGain);
      this.turbineGain.connect(this.ctx.destination);
      this.turbineOsc.start();

      // 3. Noise generator (Wind + Ground Roll)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      // Wind filter & gain
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.noiseNode.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      // Ground roll filter & gain
      const groundFilter = this.ctx.createBiquadFilter();
      groundFilter.type = 'lowpass';
      groundFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
      this.groundGain = this.ctx.createGain();
      this.groundGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.noiseNode.connect(groundFilter);
      groundFilter.connect(this.groundGain);
      this.groundGain.connect(this.ctx.destination);

      this.noiseNode.start();

      // 4. Stall alert horn
      this.stallOsc = this.ctx.createOscillator();
      this.stallOsc.type = 'sawtooth';
      this.stallOsc.frequency.setValueAtTime(650, this.ctx.currentTime);
      this.stallGain = this.ctx.createGain();
      this.stallGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.stallOsc.connect(this.stallGain);
      this.stallGain.connect(this.ctx.destination);
      this.stallOsc.start();

      this.isInitialized = true;
    } catch {
      // Audio context permission or unsupported
    }
  }

  public update(state: FlightState) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    const n1Frac = Math.max(0, Math.min(1.0, (state.n1 - 20) / 80));
    const isAirborne = state.radioAltitudeFt > 5;

    // Engine Audio
    if (state.enginesRunning && this.rumbleGain && this.rumbleOsc && this.turbineGain && this.turbineOsc) {
      const baseGain = 0.08 + n1Frac * 0.22;
      this.rumbleGain.gain.setTargetAtTime(baseGain, t, 0.1);
      this.rumbleOsc.frequency.setTargetAtTime(35 + n1Frac * 55, t, 0.1);

      const whineGain = 0.03 + n1Frac * 0.15;
      this.turbineGain.gain.setTargetAtTime(whineGain, t, 0.1);
      this.turbineOsc.frequency.setTargetAtTime(280 + n1Frac * 580, t, 0.1);
    } else if (this.rumbleGain && this.turbineGain) {
      this.rumbleGain.gain.setTargetAtTime(0, t, 0.2);
      this.turbineGain.gain.setTargetAtTime(0, t, 0.2);
    }

    // Wind Sound
    if (this.windGain) {
      const windFrac = Math.min(1.0, state.airspeedKnots / 400);
      this.windGain.gain.setTargetAtTime(windFrac * 0.18, t, 0.15);
    }

    // Ground Roll
    if (this.groundGain) {
      if (!isAirborne && state.airspeedKnots > 3) {
        const groundFrac = Math.min(1.0, state.airspeedKnots / 140);
        this.groundGain.gain.setTargetAtTime(groundFrac * 0.15, t, 0.1);
      } else {
        this.groundGain.gain.setTargetAtTime(0, t, 0.05);
      }
    }

    // Stall Horn
    if (state.isStalled && isAirborne && this.stallGain) {
      this.stallGain.gain.setTargetAtTime(0.2, t, 0.05);
    } else if (this.stallGain) {
      this.stallGain.gain.setTargetAtTime(0, t, 0.05);
    }

    // GPWS Audio Callouts
    this.checkGpwsCallouts(state);
  }

  private checkGpwsCallouts(state: FlightState) {
    if (state.verticalSpeedFpm >= -100) {
      // Reset callouts on climb
      if (state.radioAltitudeFt > 600) {
        this.lastCalloutAlt = 99999;
        this.hasSpokenRetard = false;
      }
      return;
    }

    const radAlt = state.radioAltitudeFt;
    const callouts = [1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10];

    for (const threshold of callouts) {
      if (radAlt <= threshold && this.lastCalloutAlt > threshold) {
        this.lastCalloutAlt = threshold;
        this.playVoiceCallout(`${threshold}`);
        break;
      }
    }

    if (radAlt <= 15 && !this.hasSpokenRetard && state.throttle > 0.1) {
      this.hasSpokenRetard = true;
      this.playVoiceCallout('Retard');
    }

    if (state.isPullUp) {
      this.playVoiceCallout('Pull Up');
    }
  }

  public playTouchdownScreech() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.35);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.45);
    } catch {
      // ignore
    }
  }

  public playChime() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.75);
    } catch {
      // ignore
    }
  }

  public playVoiceCallout(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.15;
      utterance.pitch = 0.9;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.ctx) {
      if (this.rumbleGain) this.rumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.turbineGain) this.turbineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.windGain) this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.groundGain) this.groundGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.stallGain) this.stallGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const globalAudio = new AudioEngine();
