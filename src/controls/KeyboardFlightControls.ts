import { FlightState } from '../types';

/** Desktop keyboard layer. It owns input state; physics remains responsible for aircraft response. */
export class KeyboardFlightControls {
  private readonly state: FlightState;
  private readonly onCamera: (mode: 'cockpit' | 'chase' | 'wing' | 'gear') => void;
  private readonly pressed = new Set<string>();
  private attached = false;

  constructor(
    state: FlightState,
    onCamera: (mode: 'cockpit' | 'chase' | 'wing' | 'gear') => void
  ) {
    this.state = state;
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
    this.pressed.add(key);

    switch (key) {
      case 'g':
        this.state.gearDown = !this.state.gearDown;
        break;
      case 'f':
        this.state.flapsIndex = Math.min(4, this.state.flapsIndex + 1);
        break;
      case 'r':
        this.state.flapsIndex = Math.max(0, this.state.flapsIndex - 1);
        break;
      case 'b':
        this.state.brakesActive = true;
        break;
      case 'q':
        this.state.yawInput = -1;
        break;
      case 'e':
        this.state.yawInput = 1;
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
        this.state.parkingBrake = !this.state.parkingBrake;
        break;
      case 'escape':
        this.state.pitchInput = 0;
        this.state.rollInput = 0;
        this.state.yawInput = 0;
        break;
    }

    this.applyAxes();
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.pressed.delete(key);
    if (key === 'b') this.state.brakesActive = false;
    if (key === 'q' || key === 'e') this.state.yawInput = 0;
    this.applyAxes();
  };

  private handleBlur = () => {
    this.pressed.clear();
    this.state.pitchInput = 0;
    this.state.rollInput = 0;
    this.state.yawInput = 0;
    this.state.brakesActive = false;
  };

  private applyAxes() {
    const up = this.pressed.has('w') || this.pressed.has('arrowup');
    const down = this.pressed.has('s') || this.pressed.has('arrowdown');
    const left = this.pressed.has('a') || this.pressed.has('arrowleft');
    const right = this.pressed.has('d') || this.pressed.has('arrowright');

    this.state.pitchInput = (up ? 1 : 0) + (down ? -1 : 0);
    this.state.rollInput = (right ? 1 : 0) + (left ? -1 : 0);
  }
}
