export type FlightPhase =
  | 'parked'
  | 'boarding'
  | 'pushback'
  | 'taxi_out'
  | 'takeoff_roll'
  | 'rotation'
  | 'initial_climb'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'taxi_in'
  | 'gate_arrival'
  | 'shutdown'
  | 'crashed';

export type CameraMode = 'cockpit' | 'chase' | 'wing' | 'gear' | 'free';

export type AssistanceLevel = 'beginner' | 'intermediate' | 'realistic';

export type WeatherType = 'clear' | 'partly_cloudy' | 'overcast' | 'rain' | 'storm' | 'fog';

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';

export interface RunwayDef {
  id: string;
  name: string; // e.g. "24L"
  heading: number; // in degrees
  lengthMeters: number;
  widthMeters: number;
  thresholdOffset: number;
  altitudeMeters: number;
  ilsFrequency?: number;
  papiAngle: number; // 3.0 degrees standard
}

export interface AirportDef {
  code: string; // ICAO, e.g. KLAX
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  elevation: number; // ft
  runways: RunwayDef[];
  worldX: number; // local simulation world coordinate in meters
  worldZ: number;
}

export interface AircraftSpec {
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  emptyWeightKg: number;
  maxTakeoffWeightKg: number;
  maxThrustKn: number;
  wingAreaM2: number;
  wingSpanM: number;
  lengthM: number;
  maxSpeedKnots: number;
  cruiseSpeedKnots: number;
  stallSpeedCleanKnots: number;
  stallSpeedFullFlapsKnots: number;
  fuelCapacityKg: number;
  burnRateKgPerHour: number;
  v1Knots: number;
  vrKnots: number;
  v2Knots: number;
  vRefKnots: number;
  description: string;
  isFighter?: boolean;
  hasAfterburner?: boolean;
}

export interface FlightPlan {
  aircraft: AircraftSpec;
  origin: AirportDef;
  destination: AirportDef;
  cruisingAltitudeFt: number;
  passengers: number;
  maxPassengers: number;
  cargoKg: number;
  fuelKg: number;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  windSpeedKnots: number;
  windDirectionDeg: number;
  assistance: AssistanceLevel;
}

export interface FlightState {
  // Position & Orientation
  x: number; // meters
  y: number; // altitude above sea level in meters
  z: number; // meters
  pitch: number; // radians
  roll: number; // radians
  yaw: number; // radians (heading = -yaw * 180 / PI)
  
  // Velocity in body coordinates (m/s)
  vx: number; // lateral velocity
  vy: number; // vertical speed
  vz: number; // forward speed
  
  // Aerodynamic & Flight terms
  airspeedKnots: number;
  groundSpeedKnots: number;
  altitudeFt: number;
  radioAltitudeFt: number; // altitude above terrain
  verticalSpeedFpm: number;
  headingDeg: number;
  angleOfWeekDeg: number; // angle of attack
  gForce: number;
  mach: number;

  // Flight Controls (0 to 1 or -1 to 1)
  pitchInput: number; // -1 (pitch down) to +1 (pitch up)
  rollInput: number; // -1 (bank left) to +1 (bank right)
  yawInput: number; // -1 (rudder left) to +1 (rudder right)
  throttle: number; // 0.0 to 1.0 (or -0.3 for reverse thrust)
  actualThrust: number; // spooled thrust 0.0 to 1.0
  n1: number; // engine spool percent (20% idle to 100% full)
  n2: number;
  egt: number; // exhaust gas temp in Celsius

  // Systems
  gearDown: boolean;
  gearPosition: number; // 0 (up) to 1 (down) for smooth animation
  flapsIndex: number; // 0=0°, 1=5°, 2=15°, 3=30°, 4=40°
  flapsAngle: number; // current animated angle in degrees
  spoilersDeployed: boolean;
  spoilersPosition: number; // 0 to 1
  brakesActive: boolean;
  reverseThrust: boolean;
  parkingBrake: boolean;
  enginesRunning: boolean;
  apuRunning: boolean;
  
  // Lights
  navLights: boolean;
  beaconLights: boolean;
  strobeLights: boolean;
  landingLights: boolean;
  taxiLights: boolean;
  cabinLights: boolean;

  // Fuel & Weights
  fuelRemainingKg: number;
  currentWeightKg: number;

  // Alarms & Warnings
  isStalled: boolean;
  isOverspeed: boolean;
  isPullUp: boolean;
  isSinkRate: boolean;
  terrainWarning: boolean;
  isCrashed: boolean;
  crashReason?: string;
  touchdownFpm: number;
  maxGForce: number;
  minGForce: number;

  // Autopilot
  autopilotEnabled: boolean;
  targetAltitudeFt: number;
  targetHeadingDeg: number;
  targetSpeedKnots: number;
  autoThrottleEnabled: boolean;
  flightDirector: boolean;
  navMode: boolean; // follow route
  appMode: boolean; // ILS approach

  // Phase & Progress
  phase: FlightPhase;
  distanceTraveledM: number;
  distanceToDestinationM: number;
  flightTimeSec: number;
  timeCompression: number; // 1, 2, 4, 8

  // Passenger & Rating stats
  passengerComfort: number; // 0 to 100%
  safetyViolations: string[];

  // Military / Tactical Features (dimartarmizi/web-flight-simulator inspired)
  isTacticalHud?: boolean;
  afterburnerActive?: boolean;
  flaresRemaining?: number;
  lastFlareTime?: number;
  targetDrone?: {
    x: number;
    y: number;
    z: number;
    distanceNm: number;
    bearingDeg: number;
    locked: boolean;
  };

  // Multi-Crew Shared Cockpit (Sequal32/yourcontrols inspired)
  crewRole?: CrewRole;
  controlTransferAnnouncement?: string;
  isVirtualCopilotActive?: boolean;
}

export type CrewRole = 'PF' | 'PM';

export interface SharedCockpitPacket {
  type: 'sync' | 'transfer_request' | 'transfer_accept' | 'checklist_action' | 'copilot_callout';
  senderRole: CrewRole;
  senderId: string;
  timestamp: number;
  controls?: {
    pitchInput: number;
    rollInput: number;
    yawInput: number;
    throttle: number;
    brakesActive: boolean;
  };
  systems?: {
    gearDown: boolean;
    flapsIndex: number;
    spoilersDeployed: boolean;
    reverseThrust: boolean;
    autopilotEnabled: boolean;
    autoThrottleEnabled: boolean;
    targetAltitudeFt: number;
    targetHeadingDeg: number;
    targetSpeedKnots: number;
    navMode: boolean;
    appMode: boolean;
    navLights: boolean;
    beaconLights: boolean;
    strobeLights: boolean;
    landingLights: boolean;
    taxiLights: boolean;
    com1Freq?: string;
    transponderCode?: string;
  };
  calloutText?: string;
}

export interface SharedCockpitSession {
  role: CrewRole;
  isHost: boolean;
  isConnected: boolean;
  peerCount: number;
  virtualCopilot: boolean;
  lastTransferTime: number;
  transferMessage: string | null;
}

export interface FlightSummary {
  originCode: string;
  destCode: string;
  durationSec: number;
  touchdownFpm: number;
  touchdownGs: number;
  landingScore: string; // "Butter (Silky Smooth)", "Greaser", "Firm", "Hard", "Structural Damage"
  passengerComfort: number;
  fuelConsumedKg: number;
  safetyScore: number;
  overallGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  comments: string[];
}
