import { AircraftSpec, FlightPlan, FlightState, FlightSummary } from '../types';

export const MPS_TO_KNOTS = 1.94384;
export const KNOTS_TO_MPS = 0.514444;
export const METERS_TO_FEET = 3.28084;
export const FEET_TO_METERS = 0.3048;
export const GRAVITY = 9.80665;
export const SEA_LEVEL_AIR_DENSITY = 1.225;

export class FlightPhysics {
  private aircraft: AircraftSpec;
  private plan: FlightPlan;

  constructor(plan: FlightPlan) {
    this.plan = plan;
    this.aircraft = plan.aircraft;
  }

  public setPlan(plan: FlightPlan) {
    this.plan = plan;
    this.aircraft = plan.aircraft;
  }

  public initFlightState(runwayAltMeters: number = 38): FlightState {
    const emptyWeight = this.aircraft.emptyWeightKg;
    const payload = this.plan.passengers * 85 + this.plan.cargoKg;
    const initialFuel = this.plan.fuelKg;
    const currentWeight = emptyWeight + payload + initialFuel;

    return {
      x: 0, y: runwayAltMeters + 3.2, z: 100,
      pitch: 0, roll: 0, yaw: Math.PI,
      vx: 0, vy: 0, vz: 0,
      airspeedKnots: 0, groundSpeedKnots: 0,
      altitudeFt: runwayAltMeters * METERS_TO_FEET,
      radioAltitudeFt: 0, verticalSpeedFpm: 0, headingDeg: 250,
      angleOfWeekDeg: 0, gForce: 1.0, mach: 0,
      pitchInput: 0, rollInput: 0, yawInput: 0, throttle: 0,
      actualThrust: 0, n1: 20, n2: 58, egt: 380,
      gearDown: true, gearPosition: 1.0,
      flapsIndex: 1, flapsAngle: 5,
      spoilersDeployed: false, spoilersPosition: 0,
      brakesActive: false, reverseThrust: false, parkingBrake: false,
      enginesRunning: true, apuRunning: false,
      navLights: true, beaconLights: true, strobeLights: true,
      landingLights: true, taxiLights: false, cabinLights: true,
      fuelRemainingKg: initialFuel, currentWeightKg: currentWeight,
      isStalled: false, isOverspeed: false, isPullUp: false, isSinkRate: false,
      terrainWarning: false, isCrashed: false, touchdownFpm: 0,
      maxGForce: 1.0, minGForce: 1.0,
      autopilotEnabled: false, targetAltitudeFt: this.plan.cruisingAltitudeFt,
      targetHeadingDeg: 250, targetSpeedKnots: 250,
      autoThrottleEnabled: false, flightDirector: true, navMode: false, appMode: false,
      phase: 'parked', distanceTraveledM: 0, distanceToDestinationM: 45000,
      flightTimeSec: 0, timeCompression: 1, passengerComfort: 100,
      safetyViolations: [],
    };
  }

  public update(state: FlightState, deltaSec: number, groundElevationM: number, destX: number, destZ: number): FlightState {
    if (state.isCrashed) return state;
    const dt = Math.min(deltaSec, 0.1) * Math.max(0.1, state.timeCompression);
    state.flightTimeSec += dt;

    if (state.enginesRunning) {
      const targetN1 = state.reverseThrust ? 75 : 20 + state.throttle * 80;
      state.n1 += (targetN1 - state.n1) * Math.min(1, dt * 1.5);
      state.actualThrust = Math.max(0, Math.min(1, (state.n1 - 20) / 80));
      state.egt = 380 + state.actualThrust * 360;
      const hourlyBurn = (this.aircraft.burnRateKgPerHour * (0.3 + 0.7 * state.actualThrust)) / 3600;
      state.fuelRemainingKg = Math.max(0, state.fuelRemainingKg - hourlyBurn * dt);
      if (state.fuelRemainingKg <= 0) {
        state.enginesRunning = false;
        state.safetyViolations.push('Fuel Exhaustion - Dual Engine Flameout');
      }
    } else {
      state.n1 += (0 - state.n1) * Math.min(1, dt * 0.8);
      state.actualThrust = 0;
      state.egt += (25 - state.egt) * Math.min(1, dt * 0.2);
    }

    const flapDegrees = [0, 5, 15, 30, 40];
    const targetFlapAngle = flapDegrees[state.flapsIndex] || 0;
    state.flapsAngle += (targetFlapAngle - state.flapsAngle) * Math.min(1, dt * 2);
    const targetGear = state.gearDown ? 1 : 0;
    state.gearPosition += (targetGear - state.gearPosition) * Math.min(1, dt * 0.6);
    const targetSpoilers = state.spoilersDeployed ? 1 : 0;
    state.spoilersPosition += (targetSpoilers - state.spoilersPosition) * Math.min(1, dt * 3);

    const altitudeM = Math.max(0, state.y);
    state.altitudeFt = altitudeM * METERS_TO_FEET;
    const radioAltM = Math.max(0, state.y - groundElevationM - 3.2);
    state.radioAltitudeFt = radioAltM * METERS_TO_FEET;
    const airDensity = SEA_LEVEL_AIR_DENSITY * Math.exp(-altitudeM / 8500);
    const forwardSpeed = Math.max(0, state.vz);
    state.airspeedKnots = forwardSpeed * MPS_TO_KNOTS;
    state.groundSpeedKnots = Math.hypot(state.vx, state.vz) * MPS_TO_KNOTS;
    state.verticalSpeedFpm = state.vy * 60 * METERS_TO_FEET;
    state.mach = state.airspeedKnots / (661.47 * Math.sqrt(Math.max(0.7, 1 - 0.0000068756 * state.altitudeFt)));

    let heading = (250 + (state.yaw - Math.PI) * (180 / Math.PI)) % 360;
    if (heading < 0) heading += 360;
    state.headingDeg = heading;

    const onGround = state.y <= groundElevationM + 3.25;
    if (state.autopilotEnabled && !onGround) this.runAutopilot(state, dt, destX, destZ);

    const dynamicPressure = 0.5 * airDensity * forwardSpeed * forwardSpeed;
    const wingArea = this.aircraft.wingAreaM2;
    const flightPathAngle = forwardSpeed > 1 ? Math.atan2(state.vy, forwardSpeed) : 0;
    const aoaRad = state.pitch - flightPathAngle;
    state.angleOfWeekDeg = (aoaRad * 180) / Math.PI;

    // Tuned around the A320neo reference speeds: the aircraft must generate real lift.
    const flapFraction = state.flapsAngle / 40;
    const cl0 = 0.50 + flapFraction * 0.35;
    const clSlope = 6.5;
    let cl = cl0 + clSlope * aoaRad;
    const stallAngleDeg = 15.5 + flapFraction * 2;
    const isStalled = Math.abs(state.angleOfWeekDeg) > stallAngleDeg && forwardSpeed > 10;
    state.isStalled = isStalled;
    if (isStalled) cl *= Math.max(0.15, Math.cos(aoaRad * 2.5));

    const span = this.aircraft.wingSpanM;
    const heightAboveGround = Math.max(0.5, radioAltM);
    const groundEffectFactor = heightAboveGround < span
      ? 1 + 0.35 * Math.pow((span - heightAboveGround) / span, 2)
      : 1;
    cl *= groundEffectFactor;
    const liftForce = Math.max(0, dynamicPressure * wingArea * cl);

    const cd0 = 0.022;
    const flapCd = Math.pow(flapFraction, 1.8) * 0.055;
    const gearCd = state.gearPosition * 0.035;
    const spoilerCd = state.spoilersPosition * 0.075;
    const inducedCd = (cl * cl) / (Math.PI * 9.5 * 0.85);
    const dragForce = dynamicPressure * wingArea * (cd0 + flapCd + gearCd + spoilerCd + inducedCd);

    const totalMaxThrustN = this.aircraft.maxThrustKn * 1000;
    let thrustForce = 0;
    if (state.enginesRunning) {
      thrustForce = state.reverseThrust && onGround
        ? -totalMaxThrustN * 0.45
        : totalMaxThrustN * state.actualThrust * (airDensity / SEA_LEVEL_AIR_DENSITY);
    }
    const mass = Math.max(1, state.currentWeightKg);
    const weightForce = mass * GRAVITY;

    if (onGround) {
      state.y = groundElevationM + 3.2;
      state.roll *= Math.max(0, 1 - dt * 6);

      let rollingResistance = mass * 0.018 * GRAVITY;
      const isBraking = state.brakesActive || state.parkingBrake;
      if (isBraking) rollingResistance += mass * 0.65 * GRAVITY;
      if (state.spoilersDeployed) rollingResistance += dragForce * 0.8;

      const netLongitudinalForce = thrustForce - dragForce - rollingResistance;
      state.vz = Math.max(0, state.vz + (netLongitudinalForce / mass) * dt);

      const steerInput = state.yawInput + state.rollInput * 0.65;
      if (state.vz > 0.3) {
        const turnRate = (-steerInput * (22 / Math.max(8, state.vz))) * (Math.PI / 180);
        state.yaw += turnRate * dt;
      }

      const vrReached = state.airspeedKnots >= this.aircraft.vrKnots;
      const rotationInput = state.pitchInput > 0.08;
      if (vrReached) {
        const elevatorAuthority = Math.min(1.25, Math.max(0.55, state.airspeedKnots / Math.max(1, this.aircraft.vrKnots)));
        state.pitch += state.pitchInput * 0.62 * elevatorAuthority * dt;
        state.pitch = Math.max(-0.02, Math.min(0.24, state.pitch));
      } else {
        state.pitch = Math.max(-0.02, Math.min(0.035, state.pitch));
      }

      // No scripted vertical impulse: liftoff happens only when aerodynamic lift supports the aircraft.
      const liftSupportsFlight = liftForce >= weightForce * 0.96;
      if (vrReached && rotationInput && liftSupportsFlight) {
        state.vy = Math.max(0, (liftForce - weightForce) / mass);
        state.y += state.vy * dt;
        if (state.phase === 'parked' || state.phase === 'taxi_out' || state.phase === 'takeoff_roll' || state.phase === 'rotation') {
          state.phase = 'initial_climb';
        }
      } else {
        state.vy = 0;
      }
      state.gForce = 1;
    } else {
      const forwardAcc = (thrustForce - dragForce) / mass;
      const verticalAcc = (liftForce * Math.cos(state.roll) - weightForce) / mass;
      const lateralAcc = (liftForce * Math.sin(state.roll)) / mass;
      state.vz = Math.max(0, state.vz + forwardAcc * dt);
      state.vy += verticalAcc * dt;
      state.vx += lateralAcc * dt * 0.2;

      const authority = Math.min(1.3, Math.max(0.4, forwardSpeed / 65));
      state.pitch += state.pitchInput * 0.75 * authority * dt;
      state.pitch = Math.max(-0.45, Math.min(0.45, state.pitch));
      if (isStalled) state.pitch -= 0.5 * dt;
      else if (Math.abs(state.pitchInput) < 0.05) state.pitch -= (state.pitch - aoaRad * 0.2) * 0.15 * dt;

      state.roll += state.rollInput * 1.1 * authority * dt;
      state.roll = Math.max(-1.1, Math.min(1.1, state.roll));
      if (Math.abs(state.rollInput) < 0.05 && this.plan.assistance === 'beginner') {
        state.roll += (0 - state.roll) * 1.8 * dt;
      }

      const turnRateFromBank = (GRAVITY * Math.tan(state.roll)) / Math.max(15, forwardSpeed);
      const rudderTurnRate = -state.yawInput * 0.5 * authority;
      state.yaw += (turnRateFromBank + rudderTurnRate) * dt;
      state.gForce = Math.max(-0.5, Math.min(3.5, liftForce / weightForce));
      state.maxGForce = Math.max(state.maxGForce, state.gForce);
      state.minGForce = Math.min(state.minGForce, state.gForce);

      if (state.y <= groundElevationM + 3.2) this.handleTouchdownOrCrash(state, groundElevationM);
    }

    const worldVx = state.vx * Math.cos(state.yaw) + state.vz * Math.sin(state.yaw);
    const worldVz = -state.vx * Math.sin(state.yaw) + state.vz * Math.cos(state.yaw);
    state.x += worldVx * dt;
    state.z += worldVz * dt;
    if (!onGround) state.y += state.vy * dt;
    state.distanceTraveledM += Math.max(0, state.vz) * dt;

    const airborne = !onGround;
    if (airborne) {
      state.isOverspeed = state.airspeedKnots > this.aircraft.maxSpeedKnots;
      state.isSinkRate = state.verticalSpeedFpm < -1800 && state.radioAltitudeFt < 2500;
      state.isPullUp = (state.verticalSpeedFpm < -2500 && state.radioAltitudeFt < 1000) || (state.radioAltitudeFt < 300 && !state.gearDown);
      state.terrainWarning = state.radioAltitudeFt < 200 && !state.gearDown;
    } else {
      state.isOverspeed = false;
      state.isSinkRate = false;
      state.isPullUp = false;
      state.terrainWarning = false;
    }

    const dx = destX - state.x;
    const dz = destZ - state.z;
    state.distanceToDestinationM = Math.hypot(dx, dz);
    this.updateFlightPhase(state, onGround);
    return state;
  }

  private handleTouchdownOrCrash(state: FlightState, groundElevationM: number) {
    const verticalFpm = state.vy * 60 * METERS_TO_FEET;
    state.touchdownFpm = verticalFpm;

    if (!state.gearDown && state.gearPosition < 0.8) {
      state.isCrashed = true;
      state.crashReason = 'Gear-Up Belly Landing: Landing gear was not deployed!';
      state.phase = 'crashed';
      return;
    }
    if (Math.abs(state.roll) > (12 * Math.PI) / 180) {
      state.isCrashed = true;
      state.crashReason = `Wingtip Strike: Excessive bank angle (${((state.roll * 180) / Math.PI).toFixed(1)}°) on touchdown!`;
      state.phase = 'crashed';
      return;
    }
    if (state.pitch > (13 * Math.PI) / 180) {
      state.isCrashed = true;
      state.crashReason = `Tailstrike: Severe pitch-up (${((state.pitch * 180) / Math.PI).toFixed(1)}°) on touchdown!`;
      state.phase = 'crashed';
      return;
    }
    if (verticalFpm < -950) {
      state.isCrashed = true;
      state.crashReason = `Catastrophic Hard Landing: Descent rate of ${Math.round(verticalFpm)} fpm collapsed the airframe.`;
      state.phase = 'crashed';
      return;
    }

    state.y = groundElevationM + 3.2;
    state.vy = 0;
    state.roll = 0;
    state.pitch = Math.max(0, Math.min(0.08, state.pitch));
    if (verticalFpm < -450) {
      state.safetyViolations.push(`Hard Touchdown (${Math.round(verticalFpm)} fpm)`);
      state.passengerComfort = Math.max(40, state.passengerComfort - 25);
    } else if (verticalFpm > -180) {
      state.passengerComfort = Math.min(100, state.passengerComfort + 10);
    }
  }

  private runAutopilot(state: FlightState, dt: number, destX: number, destZ: number) {
    if (state.autoThrottleEnabled) {
      const speedError = state.targetSpeedKnots - state.airspeedKnots;
      state.throttle = Math.max(0.15, Math.min(1, state.throttle + speedError * 0.015 * dt));
    }
    let targetHeading = state.targetHeadingDeg;
    if (state.navMode) {
      const dx = destX - state.x;
      const dz = destZ - state.z;
      targetHeading = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
    }
    let headingDiff = targetHeading - state.headingDeg;
    while (headingDiff > 180) headingDiff -= 360;
    while (headingDiff < -180) headingDiff += 360;
    const targetBankRad = (Math.max(-25, Math.min(25, headingDiff * 1.5)) * Math.PI) / 180;
    state.rollInput = Math.max(-1, Math.min(1, (targetBankRad - state.roll) * 2));
    const altDiffFt = state.targetAltitudeFt - state.altitudeFt;
    const targetVsFpm = Math.max(-2200, Math.min(2500, altDiffFt * 2.5));
    state.pitchInput = Math.max(-0.6, Math.min(0.8, (targetVsFpm - state.verticalSpeedFpm) * 0.0015));
  }

  private updateFlightPhase(state: FlightState, onGround: boolean) {
    if (state.phase === 'crashed') return;

    if (onGround) {
      if (state.airspeedKnots < 5 && state.distanceTraveledM < 10) {
        state.phase = 'parked';
      } else if (state.airspeedKnots < 40) {
        if (state.phase !== 'taxi_in') state.phase = 'taxi_out';
      } else if (state.airspeedKnots < this.aircraft.vrKnots && state.throttle > 0.7) {
        state.phase = 'takeoff_roll';
      } else if (state.phase === 'landing' && state.airspeedKnots < 60) {
        state.phase = 'taxi_in';
      } else if (state.phase === 'taxi_in' && state.airspeedKnots < 2 && !state.enginesRunning) {
        state.phase = 'gate_arrival';
      }
    } else {
      if (state.phase === 'takeoff_roll' || state.phase === 'rotation' || state.phase === 'taxi_out' || state.phase === 'parked') {
        state.phase = 'initial_climb';
      } else if (state.phase === 'initial_climb' && state.altitudeFt > 1500) {
        state.phase = 'climb';
      } else if (state.phase === 'climb' && Math.abs(state.altitudeFt - this.plan.cruisingAltitudeFt) < 1000) {
        state.phase = 'cruise';
      } else if ((state.phase === 'cruise' || state.phase === 'climb') && state.distanceToDestinationM < 25000 && state.distanceTraveledM > 8000) {
        state.phase = 'descent';
      } else if (state.phase === 'descent' && state.distanceToDestinationM < 12000 && state.altitudeFt < 4000) {
        state.phase = 'approach';
      } else if (state.phase === 'approach' && state.radioAltitudeFt < 300) {
        state.phase = 'landing';
      }
    }
  }

  public getFlightSummary(state: FlightState): FlightSummary {
    const verticalFpm = state.touchdownFpm;
    let scoreText = 'Smooth (Butter)';
    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    const comments: string[] = [];

    if (state.isCrashed) {
      scoreText = 'Crashed'; grade = 'F'; comments.push(state.crashReason || 'Aircraft destroyed.');
    } else {
      if (verticalFpm > -150) { scoreText = 'Silky Butter Touchdown (Exceptional)'; grade = 'A+'; comments.push('Flawless gentle flare, passengers cheered with applause!'); }
      else if (verticalFpm > -300) { scoreText = 'Greaser / Standard Touchdown'; grade = 'A'; comments.push('Professional landing within airline standards.'); }
      else if (verticalFpm > -500) { scoreText = 'Firm Touchdown'; grade = 'B'; comments.push('Slightly firm arrival, gear took the impact well.'); }
      else if (verticalFpm > -800) { scoreText = 'Hard Landing'; grade = 'C'; comments.push('Severe jolt to the passengers and landing gear inspections required.'); }
      else { scoreText = 'Excessive Impact / Structural Strain'; grade = 'D'; comments.push('Critical structural stress limit exceeded.'); }
      if (state.passengerComfort > 90) comments.push('Outstanding passenger comfort maintained throughout flight.');
      else if (state.passengerComfort < 60) comments.push('Passenger comfort impacted by high Gs or steep banking.');
      if (state.safetyViolations.length === 0) comments.push('Zero safety or airspace violations recorded.');
      else comments.push(...state.safetyViolations);
    }

    return {
      originCode: this.plan.origin.code,
      destCode: this.plan.destination.code,
      durationSec: Math.round(state.flightTimeSec),
      touchdownFpm: Math.round(verticalFpm),
      touchdownGs: Number(state.maxGForce.toFixed(2)),
      landingScore: scoreText,
      passengerComfort: Math.round(state.passengerComfort),
      fuelConsumedKg: Math.round(this.plan.fuelKg - state.fuelRemainingKg),
      safetyScore: state.isCrashed ? 0 : Math.max(20, 100 - state.safetyViolations.length * 15),
      overallGrade: grade,
      comments,
    };
  }
}
