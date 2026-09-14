import { AirportDef, FlightPlan, FlightState, WeatherType } from '../types';

export interface GeoPoint { lat: number; lon: number; }
export interface NavSolution { distanceM: number; bearingDeg: number; crossTrackM: number; etaSec: number; }
export interface ILSGuidance { localizerDeg: number; glideslopeDeg: number; localizerError: number; glideslopeError: number; captured: boolean; }
export interface WeatherSample { windNorthKt: number; windEastKt: number; turbulence: number; visibilityKm: number; precipitation: number; convective: boolean; }
export interface TrafficContact { id: string; callsign: string; x: number; y: number; z: number; headingDeg: number; speedKnots: number; altitudeFt: number; phase: 'arrival' | 'departure' | 'cruise'; }
export interface GroundStatus { boarding: number; bagsLoaded: number; fuelLoadedKg: number; pushbackMeters: number; doorsClosed: boolean; ready: boolean; }
export interface CareerMission { id: string; title: string; origin: string; destination: string; passengers: number; targetLandingFpm: number; reward: number; completed: boolean; }

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const EARTH_M = 6371000;
const KNOT_TO_MPS = 0.514444;

export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
export function wrap360(v: number) { return ((v % 360) + 360) % 360; }
export function signedAngleDeg(a: number, b: number) { return ((b - a + 540) % 360) - 180; }

export function haversineDistanceM(a: GeoPoint, b: GeoPoint) {
  const p1 = a.lat * DEG, p2 = b.lat * DEG, dp = (b.lat - a.lat) * DEG, dl = (b.lon - a.lon) * DEG;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_M * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function initialBearingDeg(a: GeoPoint, b: GeoPoint) {
  const p1 = a.lat * DEG, p2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
  return wrap360(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * RAD);
}

export function localTangentM(origin: GeoPoint, point: GeoPoint) {
  const lat = origin.lat * DEG;
  return { east: (point.lon - origin.lon) * DEG * EARTH_M * Math.cos(lat), north: (point.lat - origin.lat) * DEG * EARTH_M };
}

export class NavigationSystem {
  public solve(state: FlightState, plan: FlightPlan): NavSolution {
    const dX = plan.destination.worldX - state.x;
    const dZ = plan.destination.worldZ - state.z;
    const distanceM = Math.hypot(dX, dZ);
    const bearingDeg = wrap360(Math.atan2(dX, -dZ) * RAD);
    const desired = signedAngleDeg(state.headingDeg, bearingDeg);
    const lateral = Math.sin(desired * DEG) * distanceM;
    const speed = Math.max(1, state.groundSpeedKnots * KNOT_TO_MPS);
    return { distanceM, bearingDeg, crossTrackM: lateral, etaSec: distanceM / speed };
  }

  public ils(state: FlightState, airport: AirportDef): ILSGuidance {
    const runway = airport.runways[0];
    const runwayHeading = runway?.heading ?? 250;
    const approachHeading = wrap360(runwayHeading + 180);
    const headingError = signedAngleDeg(state.headingDeg, approachHeading);
    const dx = state.x - airport.worldX, dz = state.z - airport.worldZ;
    const courseRad = runwayHeading * DEG;
    const lateralM = dx * Math.cos(courseRad) + dz * Math.sin(courseRad);
    const alongM = -dx * Math.sin(courseRad) + dz * Math.cos(courseRad);
    const localizerError = clamp(lateralM / Math.max(1500, Math.abs(alongM) * 0.18), -1, 1) + clamp(headingError / 30, -0.5, 0.5);
    const radioAlt = Math.max(0, state.radioAltitudeFt);
    const idealAlt = Math.max(0, Math.abs(alongM) * Math.tan((runway?.papiAngle ?? 3) * DEG) * 3.28084);
    const glideslopeError = clamp((radioAlt - idealAlt) / 700, -1, 1);
    return { localizerDeg: localizerError * 2.5, glideslopeDeg: glideslopeError * 3, localizerError, glideslopeError, captured: Math.abs(localizerError) < 0.22 && Math.abs(glideslopeError) < 0.22 && state.radioAltitudeFt < 2500 };
  }

  public nextAltitude(state: FlightState, plan: FlightPlan) {
    if (state.phase === 'initial_climb' || state.phase === 'climb') return Math.min(plan.cruisingAltitudeFt, Math.max(10000, state.altitudeFt + 500));
    if (state.phase === 'descent') return Math.max(3000, Math.min(plan.cruisingAltitudeFt, state.altitudeFt - 500));
    if (state.phase === 'approach') return Math.max(1500, state.altitudeFt - 300);
    return plan.cruisingAltitudeFt;
  }
}

export class WeatherEngine {
  private elapsed = 0;
  public sample(plan: FlightPlan, state: FlightState, dt: number): WeatherSample {
    this.elapsed += dt;
    const base = plan.windSpeedKnots;
    const dir = plan.windDirectionDeg * DEG;
    const gust = Math.sin(this.elapsed * 0.71 + state.x * 0.0003) * 0.35 + Math.sin(this.elapsed * 1.83 + state.z * 0.0002) * 0.2;
    const severity: Record<WeatherType, number> = { clear: 0.05, partly_cloudy: 0.12, overcast: 0.18, rain: 0.35, storm: 0.85, fog: 0.2 };
    const s = severity[plan.weather];
    return {
      windNorthKt: Math.cos(dir) * base * (1 + gust) + Math.sin(this.elapsed * 0.37) * base * s,
      windEastKt: Math.sin(dir) * base * (1 + gust) + Math.cos(this.elapsed * 0.29) * base * s,
      turbulence: clamp(Math.abs(gust) * s + (plan.weather === 'storm' ? 0.45 : 0), 0, 1),
      visibilityKm: plan.weather === 'fog' ? 1.5 : plan.weather === 'storm' ? 6 : plan.weather === 'rain' ? 10 : 35,
      precipitation: plan.weather === 'rain' ? 0.65 : plan.weather === 'storm' ? 1 : 0,
      convective: plan.weather === 'storm',
    };
  }
}

export class AutopilotSystem {
  public update(state: FlightState, plan: FlightPlan, nav: NavSolution, ils: ILSGuidance, dt: number) {
    if (!state.autopilotEnabled) return;
    const altitudeError = state.targetAltitudeFt - state.altitudeFt;
    const headingTarget = state.appMode && ils.captured ? state.headingDeg - ils.localizerError * 25 : (state.navMode ? nav.bearingDeg : state.targetHeadingDeg);
    const headingError = signedAngleDeg(state.headingDeg, headingTarget);
    const pitchCommand = clamp(altitudeError / 3500, -0.28, 0.28) - (state.appMode && ils.captured ? ils.glideslopeError * 0.09 : 0);
    const rollCommand = clamp(headingError / 35, -1, 1);
    state.pitchInput += (pitchCommand - state.pitchInput) * Math.min(1, dt * 2.5);
    state.rollInput += (rollCommand - state.rollInput) * Math.min(1, dt * 2.5);
    if (state.autoThrottleEnabled) {
      const speedError = state.targetSpeedKnots - state.airspeedKnots;
      state.throttle = clamp(state.throttle + speedError * 0.00055 * dt * 60, 0, 1);
    }
  }
}

export class GroundOperationsSystem {
  private status: GroundStatus = { boarding: 0, bagsLoaded: 0, fuelLoadedKg: 0, pushbackMeters: 0, doorsClosed: false, ready: false };
  public reset(plan: FlightPlan) { this.status = { boarding: plan.passengers >= plan.maxPassengers ? 1 : 0, bagsLoaded: 0, fuelLoadedKg: 0, pushbackMeters: 0, doorsClosed: false, ready: false }; }
  public update(plan: FlightPlan, state: FlightState, dt: number) {
    if (state.phase === 'parked' || state.phase === 'boarding') {
      this.status.boarding = clamp(this.status.boarding + dt / Math.max(8, plan.passengers * 0.18), 0, 1);
      this.status.bagsLoaded = clamp(this.status.bagsLoaded + dt / Math.max(10, plan.passengers * 0.11), 0, 1);
      this.status.fuelLoadedKg = clamp(this.status.fuelLoadedKg + dt * 900, 0, plan.fuelKg);
      this.status.doorsClosed = this.status.boarding >= 1 && this.status.bagsLoaded >= 1 && this.status.fuelLoadedKg >= plan.fuelKg * 0.98;
    }
    if (state.phase === 'pushback') this.status.pushbackMeters = clamp(this.status.pushbackMeters + dt * 1.8, 0, 30);
    this.status.ready = this.status.doorsClosed && this.status.pushbackMeters >= (state.phase === 'pushback' ? 30 : 0);
    return this.status;
  }
  public getStatus() { return { ...this.status }; }
}

export class TrafficSystem {
  private contacts: TrafficContact[] = [];
  private seed = 7;
  public reset(plan: FlightPlan) {
    this.contacts = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 7000 + (i % 3) * 4500;
      this.contacts.push({ id: `AI-${i + 1}`, callsign: `Skyway ${410 + i}`, x: plan.origin.worldX + Math.sin(angle) * radius, y: 1000 + (i % 4) * 900, z: plan.origin.worldZ + Math.cos(angle) * radius, headingDeg: wrap360(angle * RAD + 180), speedKnots: 150 + (i % 4) * 25, altitudeFt: 3300 + (i % 4) * 3000, phase: i < 3 ? 'arrival' : i < 5 ? 'departure' : 'cruise' });
    }
  }
  public update(dt: number, plan: FlightPlan) {
    for (const c of this.contacts) {
      const v = c.speedKnots * KNOT_TO_MPS;
      c.x += Math.sin(c.headingDeg * DEG) * v * dt;
      c.z -= Math.cos(c.headingDeg * DEG) * v * dt;
      if (Math.hypot(c.x - plan.origin.worldX, c.z - plan.origin.worldZ) > 45000) c.headingDeg = wrap360(c.headingDeg + 175 + (this.seed++ % 20));
    }
    return this.contacts.map(c => ({ ...c }));
  }
  public getContacts() { return this.contacts.map(c => ({ ...c })); }
}

export class CareerSystem {
  private missions: CareerMission[] = [
    { id: 'maiden-hop', title: 'Maiden Hop', origin: 'KLAX', destination: 'KSFO', passengers: 120, targetLandingFpm: -650, reward: 1200, completed: false },
    { id: 'atlantic-run', title: 'Atlantic Run', origin: 'EGLL', destination: 'LFPG', passengers: 220, targetLandingFpm: -700, reward: 2600, completed: false },
    { id: 'lagos-express', title: 'Lagos Express', origin: 'DNMM', destination: 'KLAX', passengers: 160, targetLandingFpm: -800, reward: 3400, completed: false },
  ];
  private credits = 0;
  constructor() { try { this.credits = Number(localStorage.getItem('flight-sim-career-credits') || 0); } catch { /* SSR-safe */ } }
  public getMissions() { return this.missions.map(m => ({ ...m })); }
  public getCredits() { return this.credits; }
  public completeLanding(origin: string, destination: string, touchdownFpm: number) {
    const mission = this.missions.find(m => !m.completed && m.origin === origin && m.destination === destination);
    if (!mission || Math.abs(touchdownFpm) > mission.targetLandingFpm * -1 + 350) return false;
    mission.completed = true; this.credits += mission.reward;
    try { localStorage.setItem('flight-sim-career-credits', String(this.credits)); } catch { /* optional */ }
    return true;
  }
}

export class WorldStreamingSystem {
  private loaded = new Set<string>();
  private readonly cellM = 10000;
  public update(x: number, z: number) {
    const cx = Math.floor(x / this.cellM), cz = Math.floor(z / this.cellM);
    const wanted = new Set<string>();
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) wanted.add(`${cx + dx}:${cz + dz}`);
    this.loaded = wanted;
    return this.loaded.size;
  }
  public getLoadedCells() { return this.loaded.size; }
}

export class PerformanceSystem {
  private fps = 60;
  private frameMs = 16.67;
  private samples: number[] = [];
  public sample(deltaMs: number) {
    this.samples.push(deltaMs); if (this.samples.length > 30) this.samples.shift();
    const avg = this.samples.reduce((a, b) => a + b, 0) / Math.max(1, this.samples.length);
    this.frameMs = avg; this.fps = 1000 / Math.max(0.1, avg);
    return { fps: this.fps, frameMs: this.frameMs, quality: this.fps > 52 ? 'high' : this.fps > 35 ? 'medium' : 'low' as 'high' | 'medium' | 'low' };
  }
  public get() { return { fps: this.fps, frameMs: this.frameMs, quality: this.fps > 52 ? 'high' : this.fps > 35 ? 'medium' : 'low' as 'high' | 'medium' | 'low' }; }
}

export class CompleteSimulationSystems {
  readonly navigation = new NavigationSystem();
  readonly weather = new WeatherEngine();
  readonly autopilot = new AutopilotSystem();
  readonly ground = new GroundOperationsSystem();
  readonly traffic = new TrafficSystem();
  readonly career = new CareerSystem();
  readonly world = new WorldStreamingSystem();
  readonly performance = new PerformanceSystem();
  private weatherSample: WeatherSample = { windNorthKt: 0, windEastKt: 0, turbulence: 0, visibilityKm: 35, precipitation: 0, convective: false };
  private navSolution: NavSolution = { distanceM: 0, bearingDeg: 0, crossTrackM: 0, etaSec: 0 };
  private ilsGuidance: ILSGuidance = { localizerDeg: 0, glideslopeDeg: 0, localizerError: 0, glideslopeError: 0, captured: false };
  private contacts: TrafficContact[] = [];
  constructor(private plan: FlightPlan) { this.reset(plan); }
  public reset(plan: FlightPlan) { this.plan = plan; this.ground.reset(plan); this.traffic.reset(plan); this.navSolution = this.navigation.solve({ x: plan.origin.worldX, z: plan.origin.worldZ, headingDeg: plan.origin.runways[0]?.heading ?? 250, groundSpeedKnots: 1 } as FlightState, plan); this.weatherSample = this.weather.sample(plan, { x: 0, z: 0 } as FlightState, 0); this.contacts = this.traffic.getContacts(); }
  public update(state: FlightState, dt: number, realFrameMs = dt * 1000) {
    this.navSolution = this.navigation.solve(state, this.plan);
    this.ilsGuidance = this.navigation.ils(state, this.plan.destination);
    this.weatherSample = this.weather.sample(this.plan, state, dt);
    this.autopilot.update(state, this.plan, this.navSolution, this.ilsGuidance, dt);
    this.ground.update(this.plan, state, dt);
    this.contacts = this.traffic.update(dt, this.plan);
    this.world.update(state.x, state.z);
    this.performance.sample(realFrameMs);
    const turbulence = this.weatherSample.turbulence;
    if (turbulence > 0 && !state.isCrashed) {
      state.passengerComfort = clamp(state.passengerComfort - turbulence * 0.12 * dt, 0, 100);
      if (turbulence > 0.55) state.safetyViolations = Array.from(new Set([...state.safetyViolations, 'Severe turbulence encountered']));
    }
    if (state.appMode && this.ilsGuidance.captured) {
      state.targetHeadingDeg = wrap360(state.headingDeg - this.ilsGuidance.localizerError * 18);
      state.targetAltitudeFt = Math.max(1500, state.altitudeFt - this.ilsGuidance.glideslopeError * 450);
    }
  }
  public setPlan(plan: FlightPlan) { this.reset(plan); }
  public getSnapshot() { return { nav: this.navSolution, ils: this.ilsGuidance, weather: this.weatherSample, ground: this.ground.getStatus(), traffic: this.contacts, loadedCells: this.world.getLoadedCells(), performance: this.performance.get(), credits: this.career.getCredits(), missions: this.career.getMissions() }; }
}
