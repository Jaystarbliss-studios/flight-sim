import { FlightState } from '../types';

type CameraMode = 'cockpit' | 'chase' | 'wing' | 'gear';

/** Desktop keyboard layer. It owns input state; physics remains responsible for aircraft response. */
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
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  public detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.handleBlur();
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

    const key = event.key.toLowerCase();
    const handled = ['w', 's', 'a', 'd', 'q', 'e', 'b', 'g', 'f', 'r', 'p', '1', '2', '3', '4', 'escape', ' '].includes(key)
      || event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight';

    if (handled) event.preventDefault();
    if (event.repeat) return;

    const state = this.getState();
    if (!state) return;
    this.pressed.add(key);

    switch (key) {
      case 'g':
        state.gearDown = !state.gearDown;
        break;
      case 'f':
        state.flapsIndex = Math.min(4, state.flapsIndex + 1);
        break;
      case 'r':
        state.flapsIndex = Math.max(0, state.flapsIndex - 1);
        break;
      case 'b':
        state.brakesActive = true;
        break;
      case 'q':
        state.yawInput = -1;
        break;
      case 'e':
        state.yawInput = 1;
        break;
      case '1':
        this.onCamera('cockpit');
        break;
      case '2':
        this.onCamera('chase');
        break;
      case '3':
        this.onCamera('wing');
        break;
      case '4':
        this.onCamera('gear');
        break;
      case ' ':
        state.parkingBrake = !state.parkingBrake;
        break;
      case 'escape':
        state.pitchInput = 0;
        state.rollInput = 0;
        state.yawInput = 0;
        break;
    }

    this.applyAxes(state);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const state = this.getState();
    const key = event.key.toLowerCase();
    this.pressed.delete(key);
    if (!state) return;
    if (key === 'b') state.brakesActive = false;
    if (key === 'q' || key === 'e') state.yawInput = 0;
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
    const up = this.pressed.has('w') || this.pressed.has('arrowup');
    const down = this.pressed.has('s') || this.pressed.has('arrowdown');
    const left = this.pressed.has('a') || this.pressed.has('arrowleft');
    const right = this.pressed.has('d') || this.pressed.has('arrowright');

    state.pitchInput = (up ? 1 : 0) + (down ? -1 : 0);
    state.rollInput = (right ? 1 : 0) + (left ? -1 : 0);
  }
}
