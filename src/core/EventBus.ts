export type SimulationEventMap = {
  engine_started: { timestamp: number };
  engine_stopped: { timestamp: number };
  takeoff_roll: { speedKnots: number };
  rotation: { speedKnots: number };
  liftoff: { altitudeFt: number; speedKnots: number };
  touchdown: { touchdownFpm: number; groundSpeedKnots: number };
  crash: { reason: string };
  reset: undefined;
};

type Listener<T> = (payload: T) => void;

/** Small typed event bus used to decouple simulation, audio, UI and effects. */
export class EventBus {
  private listeners = new Map<keyof SimulationEventMap, Set<Listener<unknown>>>();

  public on<K extends keyof SimulationEventMap>(event: K, listener: Listener<SimulationEventMap[K]>) {
    const set = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return () => set.delete(listener as Listener<unknown>);
  }

  public emit<K extends keyof SimulationEventMap>(event: K, payload: SimulationEventMap[K]) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  public clear() {
    this.listeners.clear();
  }
}

export const simulationEvents = new EventBus();
