import { AircraftSpec, FlightPlan, FlightState, FlightSummary } from '../types';

export const MPS_TO_KNOTS = 1.94384;
export const KNOTS_TO_MPS = 0.514444;
export const METERS_TO_FEET = 3.28084;
export const FEET_TO_METERS = 0.3048;
export const GRAVITY = 9.80665;
export const SEA_LEVEL_AIR_DENSITY = 1.225;

const DEG = Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap360 = (value: number) => ((value % 360) + 360) % 360;

/** Force-driven aircraft model. Inputs command control surfaces; forces create the response. */
export class FlightPhysics {
  private aircraft: AircraftSpec;
  private plan: FlightPlan;
  private pitchRate = 0;
  private rollRate = 0;
  private yawRate = 0;

  constructor(plan: FlightPlan) { this.plan = plan; this.aircraft = plan.aircraft; }

  public setPlan(plan: FlightPlan) {
    this.plan = plan;
    this.aircraft = plan.aircraft;
    this.pitchRate = 0; this.rollRate = 0; this.yawRate = 0;
  }

  public initFlightState(runwayAltMeters = 38): FlightState {
    const payload = this.plan.passengers * 85 + this.plan.cargoKg;
    const initialFuel = this.plan.fuelKg;
    const currentWeight = this.aircraft.emptyWeightKg + payload + initialFuel;
    this.pitchRate = 0; this.rollRate = 0; this.yawRate = 0;
    return {
      x: 0, y: runwayAltMeters + 3.2, z: 100, pitch: 0, roll: 0, yaw: Math.PI,
      vx: 0, vy: 0, vz: 0, airspeedKnots: 0, groundSpeedKnots: 0,
      altitudeFt: runwayAltMeters * METERS_TO_FEET, radioAltitudeFt: 0,
      verticalSpeedFpm: 0, headingDeg: 250, angleOfWeekDeg: 0, gForce: 1, mach: 0,
      pitchInput: 0, rollInput: 0, yawInput: 0, throttle: 0, actualThrust: 0,
      n1: 20, n2: 58, egt: 380, gearDown: true, gearPosition: 1,
      flapsIndex: 1, flapsAngle: 5, spoilersDeployed: false, spoilersPosition: 0,
      brakesActive: false, reverseThrust: false, parkingBrake: true, enginesRunning: true,
      apuRunning: false, navLights: true, beaconLights: true, strobeLights: true,
      landingLights: true, taxiLights: true, cabinLights: true, fuelRemainingKg: initialFuel,
      currentWeightKg: currentWeight, isStalled: false, isOverspeed: false,
      isPullUp: false, isSinkRate: false, terrainWarning: false, isCrashed: false,
      touchdownFpm: 0, maxGForce: 1, minGForce: 1, autopilotEnabled: false,
      targetAltitudeFt: this.plan.cruisingAltitudeFt, targetHeadingDeg: 250,
      targetSpeedKnots: Math.max(210, this.aircraft.cruiseSpeedKnots), autoThrottleEnabled: false,
      flightDirector: true, navMode: false, appMode: false, phase: 'parked',
      distanceTraveledM: 0, distanceToDestinationM: 45000, flightTimeSec: 0,
      timeCompression: 1, passengerComfort: 100, safetyViolations: [],
    };
  }

  public update(state: FlightState, deltaSec: number, groundElevationM: number, destX: number, destZ: number): FlightState {
    if (state.isCrashed) return state;
    const dt = Math.min(deltaSec, 0.1) * Math.max(0.1, state.timeCompression);
    state.flightTimeSec += dt;
    this.updateSystems(state, dt);

    const altitudeM = Math.max(0, state.y);
    const airDensity = SEA_LEVEL_AIR_DENSITY * Math.exp(-altitudeM / 8500);
    const mass = Math.max(1, state.currentWeightKg);
    const weightForce = mass * GRAVITY;
    const onGround = state.y <= groundElevationM + 3.25;
    const wind = this.getWindComponents(state.yaw);
    const relativeForward = Math.max(0.1, state.vz - wind.forward);
    const relativeLateral = state.vx - wind.lateral;
    const relativeAirspeed = Math.hypot(relativeForward, relativeLateral);
    const dynamicPressure = 0.5 * airDensity * relativeAirspeed ** 2;

    state.airspeedKnots = relativeAirspeed * MPS_TO_KNOTS;
    state.groundSpeedKnots = Math.hypot(state.vx, state.vz) * MPS_TO_KNOTS;
    state.altitudeFt = altitudeM * METERS_TO_FEET;
    const radioAltM = Math.max(0, state.y - groundElevationM - 3.2);
    state.radioAltitudeFt = radioAltM * METERS_TO_FEET;
    state.verticalSpeedFpm = state.vy * 60 * METERS_TO_FEET;
    state.mach = state.airspeedKnots / Math.max(1, 661.47 * Math.sqrt(Math.max(0.7, 1 - 0.0000068756 * state.altitudeFt)));
    state.headingDeg = wrap360(250 + (state.yaw - Math.PI) / DEG);

    if (state.autopilotEnabled && !onGround) this.runAutopilot(state, dt, destX, destZ);

    const flapFraction = state.flapsAngle / 40;
    const flightPathAngle = relativeForward > 2 ? Math.atan2(state.vy, relativeForward) : 0;
    const aoaRad = state.pitch - flightPathAngle;
    state.angleOfWeekDeg = aoaRad / DEG;
    const cl0 = 0.22 + flapFraction * 0.42;
    const clSlope = 5.4;
    const stallAngleDeg = 14.5 + flapFraction * 2.5;
    let cl = cl0 + clSlope * aoaRad;
    const stalled = Math.abs(state.angleOfWeekDeg) > stallAngleDeg && state.airspeedKnots > this.aircraft.stallSpeedCleanKnots * 0.72;
    state.isStalled = stalled;
    if (stalled) cl *= clamp(1 - (Math.abs(state.angleOfWeekDeg) - stallAngleDeg) / 12, 0.12, 1);

    const heightAboveGround = Math.max(0.5, radioAltM);
    const groundEffect = heightAboveGround < this.aircraft.wingSpanM
      ? 1 + 0.28 * ((this.aircraft.wingSpanM - heightAboveGround) / this.aircraft.wingSpanM) ** 2 : 1;
    cl *= groundEffect;
    const liftForce = Math.max(0, dynamicPressure * this.aircraft.wingAreaM2 * cl);

    const cd0 = 0.021;
    const flapCd = Math.pow(flapFraction, 1.7) * 0.065;
    const gearCd = state.gearPosition * 0.032;
    const spoilerCd = state.spoilersPosition * 0.075;
    const inducedCd = (cl * cl) / (Math.PI * 9.2 * 0.84);
    const dragForce = dynamicPressure * this.aircraft.wingAreaM2 * (cd0 + flapCd + gearCd + spoilerCd + inducedCd);
    const thrust = this.getThrustForce(state, airDensity, onGround);
    const forwardForce = thrust - dragForce;

    if (onGround) this.updateGroundMotion(state, dt, groundElevationM, mass, weightForce, forwardForce, liftForce);
    else this.updateAirMotion(state, dt, mass, weightForce, liftForce, forwardForce, relativeForward, stalled);

    const worldVx = state.vx * Math.cos(state.yaw) + state.vz * Math.sin(state.yaw) + wind.worldX;
    const worldVz = -state.vx * Math.sin(state.yaw) + state.vz * Math.cos(state.yaw) + wind.worldZ;
    state.x += worldVx * dt;
    state.z += worldVz * dt;
    if (!onGround) state.y += state.vy * dt;

    if (state.y < groundElevationM + 3.2 && !onGround) {
      state.y = groundElevationM + 3.2;
      this.handleTouchdownOrCrash(state, groundElevationM);
    }

    state.distanceTraveledM += Math.max(0, state.groundSpeedKnots * KNOTS_TO_MPS) * dt;
    const airborne = state.y > groundElevationM + 3.25;
    state.isOverspeed = airborne && state.airspeedKnots > this.aircraft.maxSpeedKnots;
    state.isSinkRate = airborne && state.verticalSpeedFpm < -1800 && state.radioAltitudeFt < 2500;
    state.isPullUp = airborne && ((state.verticalSpeedFpm < -2500 && state.radioAltitudeFt < 1000) || (state.radioAltitudeFt < 300 && !state.gearDown));
    state.terrainWarning = airborne && state.radioAltitudeFt < 200 && !state.gearDown;

    const dx = destX - state.x;
    const dz = destZ - state.z;
    state.distanceToDestinationM = Math.hypot(dx, dz);
    this.updateFlightPhase(state, onGround);
    return state;
  }

  private updateSystems(state: FlightState, dt: number) {
    if (state.enginesRunning && state.fuelRemainingKg > 0) {
      const targetN1 = state.reverseThrust ? 72 : 20 + state.throttle * 80;
      const spoolRate = state.n1 < targetN1 ? 1.8 : 2.4;
      state.n1 += (targetN1 - state.n1) * Math.min(1, dt * spoolRate);
      state.n2 += ((state.n1 * 0.82 + 18) - state.n2) * Math.min(1, dt * 2.2);
      state.actualThrust = clamp((state.n1 - 20) / 80, 0, 1);
      state.egt += (380 + state.actualThrust * 360 - state.egt) * Math.min(1, dt * 2.5);
      const hourlyBurn = this.aircraft.burnRateKgPerHour * (0.22 + state.actualThrust * 0.78);
      const burned = hourlyBurn * dt / 3600;
      state.fuelRemainingKg = Math.max(0, state.fuelRemainingKg - burned);
      state.currentWeightKg = Math.max(this.aircraft.emptyWeightKg, state.currentWeightKg - burned);
      if (state.fuelRemainingKg <= 0) {
        state.enginesRunning = false;
        state.safetyViolations.push('Fuel exhaustion — engine flameout.');
      }
    } else {
      state.n1 += (20 - state.n1) * Math.min(1, dt * 0.7);
      state.n2 += (18 - state.n2) * Math.min(1, dt * 0.5);
      state.actualThrust = 0;
      state.egt += (25 - state.egt) * Math.min(1, dt * 0.2);
    }
    const flapDegrees = [0, 5, 15, 30, 40];
    state.flapsAngle += ((flapDegrees[state.flapsIndex] ?? 0) - state.flapsAngle) * Math.min(1, dt * 2.5);
    state.gearPosition += ((state.gearDown ? 1 : 0) - state.gearPosition) * Math.min(1, dt * 0.75);
    state.spoilersPosition += ((state.spoilersDeployed ? 1 : 0) - state.spoilersPosition) * Math.min(1, dt * 4);
  }

  private getThrustForce(state: FlightState, airDensity: number, onGround: boolean) {
    if (!state.enginesRunning) return 0;
    const maxThrust = this.aircraft.maxThrustKn * 1000;
    const densityRatio = clamp(airDensity / SEA_LEVEL_AIR_DENSITY, 0.35, 1);
    if (state.reverseThrust && onGround && state.groundSpeedKnots > 20) return -maxThrust * 0.38 * state.actualThrust;
    return maxThrust * state.actualThrust * densityRatio;
  }

  private updateGroundMotion(state: FlightState, dt: number, groundElevationM: number, mass: number, weightForce: number, forwardForce: number, liftForce: number) {
    state.y = groundElevationM + 3.2;
    const speed = Math.max(0, state.vz);
    const braking = state.brakesActive || state.parkingBrake;
    const normalForce = Math.max(0, weightForce - liftForce * Math.cos(state.roll));
    const rollingCoefficient = speed < 12 ? 0.020 : 0.014;
    const wheelFriction = normalForce * (braking ? 0.72 : rollingCoefficient);
    state.vz = Math.max(0, state.vz + ((forwardForce - wheelFriction) / mass) * dt);

    const steeringAuthority = clamp(1 - speed / 95, 0.08, 1);
    this.yawRate += (state.yawInput * (0.65 * steeringAuthority) - this.yawRate * 3.5) * dt;
    state.yaw += this.yawRate * dt;

    if (state.airspeedKnots >= this.aircraft.vrKnots) {
      const targetPitch = state.pitchInput > 0 ? 10 * DEG : 0;
      this.pitchRate += ((targetPitch - state.pitch) * 2.8 + state.pitchInput * 0.65 - this.pitchRate * 2.7) * dt;
      this.pitchRate = clamp(this.pitchRate, -0.12, 0.12);
      state.pitch += this.pitchRate * dt;
    } else {
      this.pitchRate += (0 - this.pitchRate * 4) * dt;
      state.pitch += this.pitchRate * dt;
      state.pitch = clamp(state.pitch, -2 * DEG, 2 * DEG);
    }

    this.rollRate += (state.rollInput * 0.35 - this.rollRate * 5) * dt;
    state.roll += this.rollRate * dt;
    state.roll = clamp(state.roll, -8 * DEG, 8 * DEG);

    const liftSupportsFlight = liftForce > weightForce * 0.92;
    if (!state.parkingBrake && state.airspeedKnots >= this.aircraft.vrKnots && state.pitch > 4 * DEG && liftSupportsFlight) {
      state.vy = clamp((liftForce - weightForce) / mass, 0, 4.5);
      state.y = groundElevationM + 3.2 + state.vy * dt;
      state.phase = 'initial_climb';
    } else state.vy = 0;
    state.gForce = clamp(liftForce / Math.max(1, weightForce), 0.7, 1.4);
  }

  private updateAirMotion(state: FlightState, dt: number, mass: number, weightForce: number, liftForce: number, forwardForce: number, forwardAirspeed: number, stalled: boolean) {
    const forwardAcc = forwardAirspeed > 5 ? forwardForce / mass : 0;
    const verticalAcc = (liftForce * Math.cos(state.roll) - weightForce) / mass;
    const lateralAcc = (liftForce * Math.sin(state.roll)) / mass;
    state.vz = Math.max(0, state.vz + forwardAcc * dt);
    state.vy += verticalAcc * dt;
    state.vx += (lateralAcc / Math.max(20, forwardAirspeed)) * dt * 0.25;

    const speedFactor = clamp(forwardAirspeed / 70, 0.35, 1.3);
    const pitchTarget = clamp(state.pitchInput * 8 * DEG, -8 * DEG, 10 * DEG);
    this.pitchRate += ((pitchTarget - state.pitch) * 2.8 * speedFactor - this.pitchRate * 2.2) * dt;
    if (stalled) this.pitchRate -= 0.7 * dt;
    this.pitchRate = clamp(this.pitchRate, -0.16, 0.16);
    state.pitch += this.pitchRate * dt;
    state.pitch = clamp(state.pitch, -25 * DEG, 22 * DEG);

    const maxBank = this.plan.assistance === 'beginner' ? 30 : 45;
    const rollTarget = state.rollInput * maxBank * DEG;
    this.rollRate += ((rollTarget - state.roll) * 2.7 * speedFactor - this.rollRate * 2.8) * dt;
    this.rollRate = clamp(this.rollRate, -0.85, 0.85);
    state.roll += this.rollRate * dt;
    state.roll = clamp(state.roll, -55 * DEG, 55 * DEG);

    const coordinatedRate = (GRAVITY * Math.tan(state.roll)) / Math.max(25, forwardAirspeed);
    const rudderRate = state.yawInput * 0.32 * speedFactor;
    this.yawRate += (coordinatedRate + rudderRate - this.yawRate) * Math.min(1, dt * 4.5);
    state.yaw += this.yawRate * dt;

    state.gForce = clamp(liftForce / Math.max(1, weightForce), -0.5, 3.5);
    state.maxGForce = Math.max(state.maxGForce, state.gForce);
    state.minGForce = Math.min(state.minGForce, state.gForce);
  }

  private getWindComponents(yaw: number) {
    const speed = Math.max(0, this.plan.windSpeedKnots * KNOTS_TO_MPS);
    const direction = this.plan.windDirectionDeg * DEG;
    const worldX = Math.sin(direction) * speed;
    const worldZ = -Math.cos(direction) * speed;
    const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    return {
      forward: worldX * forwardX + worldZ * forwardZ,
      lateral: worldX * rightX + worldZ * rightZ,
      worldX, worldZ,
    };
  }

  private handleTouchdownOrCrash(state: FlightState, groundElevationM: number) {
    const verticalFpm = state.vy * 60 * METERS_TO_FEET;
    state.touchdownFpm = verticalFpm;
    if (!state.gearDown && state.gearPosition < 0.8) {
      state.isCrashed = true; state.crashReason = 'Gear-up landing: landing gear was not deployed.'; state.phase = 'crashed'; return;
    }
    if (Math.abs(state.roll) > 12 * DEG) {
      state.isCrashed = true; state.crashReason = `Wingtip strike: ${Math.abs(state.roll / DEG).toFixed(1)}° bank at touchdown.`; state.phase = 'crashed'; return;
    }
    if (state.pitch > 13 * DEG) {
      state.isCrashed = true; state.crashReason = `Tailstrike: ${Math.round(state.pitch / DEG)}° pitch at touchdown.`; state.phase = 'crashed'; return;
    }
    if (verticalFpm < -950) {
      state.isCrashed = true; state.crashReason = `Catastrophic hard landing: ${Math.round(verticalFpm)} fpm.`; state.phase = 'crashed'; return;
    }
    state.y = groundElevationM + 3.2;
    state.vy = 0; state.roll = 0; this.rollRate = 0; state.pitch = clamp(state.pitch, 0, 8 * DEG); this.pitchRate = 0;
    if (verticalFpm < -450) {
      state.safetyViolations.push(`Hard touchdown (${Math.round(verticalFpm)} fpm)`);
      state.passengerComfort = Math.max(40, state.passengerComfort - 25);
    } else if (verticalFpm > -180) state.passengerComfort = Math.min(100, state.passengerComfort + 10);
  }

  private runAutopilot(state: FlightState, dt: number, destX: number, destZ: number) {
    if (state.autoThrottleEnabled) {
      const speedError = state.targetSpeedKnots - state.airspeedKnots;
      state.throttle = clamp(state.throttle + speedError * 0.0015 * dt, 0.15, 1);
    }
    let targetHeading = state.targetHeadingDeg;
    if (state.navMode) {
      const dx = destX - state.x, dz = destZ - state.z;
      targetHeading = wrap360(Math.atan2(dx, -dz) / DEG);
    }
    let headingDiff = targetHeading - state.headingDeg;
    while (headingDiff > 180) headingDiff -= 360;
    while (headingDiff < -180) headingDiff += 360;
    const targetBank = clamp(headingDiff * 1.2, -25, 25) * DEG;
    state.rollInput = clamp((targetBank - state.roll) * 2.2, -1, 1);
    const altitudeError = state.targetAltitudeFt - state.altitudeFt;
    const targetVs = clamp(altitudeError * 1.8, -1800, 2200);
    state.pitchInput = clamp((targetVs - state.verticalSpeedFpm) * 0.0012, -1, 1);
  }

  private updateFlightPhase(state: FlightState, onGround: boolean) {
    if (state.phase === 'crashed') return;
    if (onGround) {
      if (state.airspeedKnots < 5 && state.distanceTraveledM < 10 && state.parkingBrake) state.phase = 'parked';
      else if (state.phase === 'landing' && state.airspeedKnots < 70) state.phase = 'taxi_in';
      else if (state.phase === 'taxi_in' && state.airspeedKnots < 2 && state.parkingBrake) state.phase = 'gate_arrival';
      else if (state.airspeedKnots >= this.aircraft.vrKnots && state.throttle > 0.75) state.phase = 'rotation';
      else if (state.airspeedKnots > 35 && state.throttle > 0.45) state.phase = 'takeoff_roll';
      else if (state.phase === 'parked') state.phase = 'taxi_out';
    } else {
      if (state.phase === 'takeoff_roll' || state.phase === 'rotation' || state.phase === 'taxi_out' || state.phase === 'parked') state.phase = 'initial_climb';
      else if (state.phase === 'initial_climb' && state.altitudeFt > 1500) state.phase = 'climb';
      else if (state.phase === 'climb' && Math.abs(state.altitudeFt - this.plan.cruisingAltitudeFt) < 1000) state.phase = 'cruise';
      else if ((state.phase === 'cruise' || state.phase === 'climb') && state.distanceToDestinationM < 25000 && state.distanceTraveledM > 8000) state.phase = 'descent';
      else if (state.phase === 'descent' && state.distanceToDestinationM < 12000 && state.altitudeFt < 4000) state.phase = 'approach';
      else if (state.phase === 'approach' && state.radioAltitudeFt < 300) state.phase = 'landing';
    }
  }

  public getFlightSummary(state: FlightState): FlightSummary {
    const verticalFpm = state.touchdownFpm;
    let scoreText = 'Smooth (Butter)';
    let grade: FlightSummary['overallGrade'] = 'A';
    const comments: string[] = [];
    if (state.isCrashed) { scoreText = 'Crashed'; grade = 'F'; comments.push(state.crashReason || 'Aircraft destroyed.'); }
    else if (verticalFpm > -150) { scoreText = 'Silky Butter Touchdown (Exceptional)'; grade = 'A+'; }
    else if (verticalFpm > -300) scoreText = 'Greaser / Standard Touchdown';
    else if (verticalFpm > -500) { scoreText = 'Firm Touchdown'; grade = 'B'; }
    else if (verticalFpm > -800) { scoreText = 'Hard Landing'; grade = 'C'; }
    else { scoreText = 'Excessive Impact / Structural Strain'; grade = 'D'; }
    if (state.safetyViolations.length === 0) comments.push('Zero safety violations recorded.'); else comments.push(...state.safetyViolations);
    return {
      originCode: this.plan.origin.code, destCode: this.plan.destination.code,
      durationSec: Math.round(state.flightTimeSec), touchdownFpm: Math.round(verticalFpm),
      touchdownGs: Number(state.maxGForce.toFixed(2)), landingScore: scoreText,
      passengerComfort: Math.round(state.passengerComfort), fuelConsumedKg: Math.round(this.plan.fuelKg - state.fuelRemainingKg),
      safetyScore: state.isCrashed ? 0 : Math.max(20, 100 - state.safetyViolations.length * 15),
      overallGrade: grade, comments,
    };
  }
}
