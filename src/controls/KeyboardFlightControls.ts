import { FlightState } from '../types';

type CameraMode = 'cockpit' | 'chase' | 'wing' | 'gear' | 'free';

/**
 * Single authoritative desktop input layer.
 *
 * Inspired by YourControls' event/state separation: keys only express pilot
 * intent here; FlightPhysics owns the aircraft response. The listener runs in
 * capture phase so legacy UI keyboard handlers cannot fight the simulator.
 */
export class KeyboardFlightControls {
  private readonly getState: () => FlightState | null;
  private readonly onCamera: (mode: CameraMode) => void;
  private readonly pressed = new Set<string>();
  private attached = false;

  constructor(getState: () => FlightState | null, onCamera: (mode: CameraMode) => void) {
    this.getState = getState;
    this.onCamera = onCamera;
  }

  public attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('keyup', this.handleKeyUp, true);
    window.addEventListener('blur', this.handleBlur);
  }

  public detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('keyup', this.handleKeyUp, true);
    window.removeEventListener('blur', this.handleBlur);
    this.handleBlur();
  }

  private isFlightKey(key: string) {
    return [
      'w', 's', 'a', 'd', 'q', 'e', 'b', 'g', 'f', 'v', 'x', 'r', 'p',
      'l', 'n', 'k', 't', 'z', 'o', 'shift', 'control', '1', '2', '3', '4', '5',
      'escape', ' ', '+', '=', '-', '_', 'c', 'home', 'end', 'pageup', 'pagedown',
    ].includes(key) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!this.isFlightKey(key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.repeat && !['+', '=', '-', '_'].includes(key)) return;
    const state = this.getState();
    if (!state) return;
    this.pressed.add(key);

    switch (key) {
      case 'b': state.brakesActive = true; break;
      case 'g': state.gearDown = !state.gearDown; break;
      case 'f': state.flapsIndex = Math.min(4, state.flapsIndex + 1); break;
      case 'v': state.flapsIndex = Math.max(0, state.flapsIndex - 1); break;
      case 'x': state.spoilersDeployed = !state.spoilersDeployed; break;
      case 'r': state.reverseThrust = !state.reverseThrust; break;
      case 'p': state.parkingBrake = !state.parkingBrake; break;
      case 'l': state.landingLights = !state.landingLights; break;
      case 'n': state.navLights = !state.navLights; break;
      case 'k': state.beaconLights = !state.beaconLights; break;
      case 't': state.strobeLights = !state.strobeLights; break;
      case 'z': state.enginesRunning = !state.enginesRunning; break;
      case 'o':
        state.autopilotEnabled = !state.autopilotEnabled;
        state.autoThrottleEnabled = state.autopilotEnabled;
        break;
      case 'shift': state.throttle = Math.min(1, state.throttle + 0.05); break;
      case 'control': state.throttle = Math.max(0, state.throttle - 0.05); break;
      case '+': case '=': state.throttle = Math.min(1, state.throttle + 0.02); break;
      case '-': case '_': state.throttle = Math.max(0, state.throttle - 0.02); break;
      case '1': this.onCamera('cockpit'); break;
      case '2': this.onCamera('chase'); break;
      case '3': this.onCamera('wing'); break;
      case '4': this.onCamera('gear'); break;
      case '5': this.onCamera('free'); break;
      case 'c': this.onCamera('chase'); break;
      case 'escape':
        this.pressed.clear();
        state.pitchInput = 0;
        state.rollInput = 0;
        state.yawInput = 0;
        state.brakesActive = false;
        break;
      case 'home': state.throttle = 0; break;
      case 'end': state.throttle = 1; state.enginesRunning = true; break;
      case 'pageup': state.flapsIndex = Math.min(4, state.flapsIndex + 1); break;
      case 'pagedown': state.flapsIndex = Math.max(0, state.flapsIndex - 1); break;
    }

    this.applyAxes(state);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!this.isFlightKey(key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const state = this.getState();
    this.pressed.delete(key);
    if (!state) return;
    if (key === 'b') state.brakesActive = false;
    this.applyAxes(state);
  };

  private handleBlur = () => {
    this.pressed.clear();
    const state = this.getState();
    if (!state) return;
    state.pitchInput = 0;
    state.rollInput = 0;
    state.yawInput = 0;
    state.brakesActive = false;
  };

  private applyAxes(state: FlightState) {
    const up = this.pressed.has('w') || this.pressed.has('ArrowUp');
    const down = this.pressed.has('s') || this.pressed.has('ArrowDown');
    const left = this.pressed.has('a') || this.pressed.has('ArrowLeft');
    const right = this.pressed.has('d') || this.pressed.has('ArrowRight');
    const rudderLeft = this.pressed.has('q');
    const rudderRight = this.pressed.has('e');

    state.pitchInput = (up ? 1 : 0) - (down ? 1 : 0);
    state.rollInput = (right ? 1 : 0) - (left ? 1 : 0);
    state.yawInput = (rudderRight ? 1 : 0) - (rudderLeft ? 1 : 0);
  }
}
