import { AircraftSpec, FlightPlan, FlightState, FlightSummary } from '../types';

export const MPS_TO_KNOTS = 1.94384;
export const KNOTS_TO_MPS = 0.514444;
export const METERS_TO_FEET = 3.28084;
export const FEET_TO_METERS = 0.3048;
export const GRAVITY = 9.80665;
export const SEA_LEVEL_AIR_DENSITY = 1.225; // kg/m3

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
      x: 0,
      y: runwayAltMeters + 3.2, // gear height above runway
      z: 100, // starting at runway threshold facing down runway
      pitch: 0,
      roll: 0,
      yaw: Math.PI, // aligned straight down the runway
      vx: 0,
      vy: 0,
      vz: 0,
      airspeedKnots: 0,
      groundSpeedKnots: 0,
      altitudeFt: runwayAltMeters * METERS_TO_FEET,
      radioAltitudeFt: 0,
      verticalSpeedFpm: 0,
      headingDeg: 250,
      angleOfWeekDeg: 0,
      gForce: 1.0,
      mach: 0,
      pitchInput: 0,
      rollInput: 0,
      yawInput: 0,
      throttle: 0,
      actualThrust: 0,
      n1: 20, // idle %
      n2: 58,
      egt: 380,
      gearDown: true,
      gearPosition: 1.0,
      flapsIndex: 1, // Flaps 1 (Takeoff configuration)
      flapsAngle: 5,
      spoilersDeployed: false,
      spoilersPosition: 0,
      brakesActive: false,
      reverseThrust: false,
      parkingBrake: false, // Ready to roll!
      enginesRunning: true, // Engines started and ready
      apuRunning: false,
      navLights: true,
      beaconLights: true,
      strobeLights: true,
      landingLights: true,
      taxiLights: false,
      cabinLights: true,
      fuelRemainingKg: initialFuel,
      currentWeightKg: currentWeight,
      isStalled: false,
      isOverspeed: false,
      isPullUp: false,
      isSinkRate: false,
      terrainWarning: false,
      isCrashed: false,
      touchdownFpm: 0,
      maxGForce: 1.0,
      minGForce: 1.0,
      autopilotEnabled: false,
      targetAltitudeFt: this.plan.cruisingAltitudeFt,
      targetHeadingDeg: 250,
      targetSpeedKnots: 250,
      autoThrottleEnabled: false,
      flightDirector: true,
      navMode: false,
      appMode: false,
      phase: 'parked',
      distanceTraveledM: 0,
      distanceToDestinationM: 45000,
      flightTimeSec: 0,
      timeCompression: 1,
      passengerComfort: 100,
      safetyViolations: [],
    };
  }

  public update(
    state: FlightState,
    deltaSec: number,
    groundElevationM: number,
    destX: number,
    destZ: number
  ): FlightState {
    if (state.isCrashed) return state;

    const dt = Math.min(deltaSec, 0.1) * state.timeCompression;
    state.flightTimeSec += dt;

    // 1. Systems & Engine Spooling
    if (state.enginesRunning) {
      const targetN1 = state.reverseThrust
        ? 75
        : 20 + state.throttle * 80;
      state.n1 += (targetN1 - state.n1) * (dt * 1.5);
      state.actualThrust = (state.n1 - 20) / 80;
      state.egt = 380 + state.actualThrust * 360;

      // Fuel burn
      const hourlyBurn = (this.aircraft.burnRateKgPerHour * (0.3 + 0.7 * state.actualThrust)) / 3600;
      state.fuelRemainingKg = Math.max(0, state.fuelRemainingKg - hourlyBurn * dt);
      if (state.fuelRemainingKg <= 0) {
        state.enginesRunning = false;
        state.safetyViolations.push('Fuel Exhaustion - Dual Engine Flameout');
      }
    } else {
      state.n1 += (0 - state.n1) * (dt * 0.8);
      state.actualThrust = 0;
      state.egt += (25 - state.egt) * (dt * 0.2);
    }

    // Flaps animation
    const flapDegrees = [0, 5, 15, 30, 40];
    const targetFlapAngle = flapDegrees[state.flapsIndex] || 0;
    state.flapsAngle += (targetFlapAngle - state.flapsAngle) * (dt * 2.0);

    // Gear animation
    const targetGear = state.gearDown ? 1.0 : 0.0;
    state.gearPosition += (targetGear - state.gearPosition) * (dt * 0.6);

    // Spoilers animation
    const targetSpoilers = state.spoilersDeployed ? 1.0 : 0.0;
    state.spoilersPosition += (targetSpoilers - state.spoilersPosition) * (dt * 3.0);

    // 2. Air Data Calculations
    const altitudeM = Math.max(0, state.y);
    state.altitudeFt = altitudeM * METERS_TO_FEET;
    const radioAltM = Math.max(0, state.y - groundElevationM - 3.2);
    state.radioAltitudeFt = radioAltM * METERS_TO_FEET;

    // Exponential atmospheric density model
    const airDensity = SEA_LEVEL_AIR_DENSITY * Math.exp(-altitudeM / 8500);

    // Speeds
    const forwardSpeed = Math.max(0, state.vz);
    state.airspeedKnots = forwardSpeed * MPS_TO_KNOTS;
    state.groundSpeedKnots = Math.hypot(state.vx, state.vz) * MPS_TO_KNOTS;
    state.verticalSpeedFpm = state.vy * 60 * METERS_TO_FEET;
    state.mach = state.airspeedKnots / (661.47 * Math.sqrt(Math.max(0.7, 1 - 0.0000068756 * state.altitudeFt)));

    // Heading calculation: runway 24L is 250 degrees when aligned with runway (yaw = Math.PI)
    let heading = (250 + (state.yaw - Math.PI) * (180 / Math.PI)) % 360;
    if (heading < 0) heading += 360;
    state.headingDeg = heading;

    // On-ground detection
    const onGround = state.y <= groundElevationM + 3.25;

    // 3. Autopilot Logic
    if (state.autopilotEnabled && !onGround) {
      this.runAutopilot(state, dt, destX, destZ);
    }

    // 4. Aerodynamics & Forces
    const dynamicPressure = 0.5 * airDensity * forwardSpeed * forwardSpeed;
    const wingArea = this.aircraft.wingAreaM2;

    // Angle of Attack (AoA)
    const flightPathAngle = forwardSpeed > 1 ? Math.atan2(state.vy, forwardSpeed) : 0;
    const aoaRad = state.pitch - flightPathAngle;
    state.angleOfWeekDeg = (aoaRad * 180) / Math.PI;

    // Lift coefficient CL with flap boost & stall drop
    const flapClBoost = (state.flapsAngle / 40) * 0.9;
    const cl0 = 0.25 + flapClBoost * 0.5;
    const clSlope = 5.5; // per radian
    let cl = cl0 + clSlope * aoaRad;

    // Critical stall angle
    const stallAngleDeg = 15.5 + (state.flapsAngle / 40) * 2.0;
    const stallAngleRad = (stallAngleDeg * Math.PI) / 180;
    const isStalled = Math.abs(state.angleOfWeekDeg) > stallAngleDeg && forwardSpeed > 10;
    state.isStalled = isStalled;

    if (isStalled) {
      // Lift collapse
      cl *= Math.max(0.2, Math.cos(aoaRad * 2.5));
    }

    // Ground effect (wing in ground proximity increases effective aspect ratio and lift)
    const span = this.aircraft.wingSpanM;
    const heightAboveGround = Math.max(0.5, radioAltM);
    const groundEffectFactor = heightAboveGround < span ? 1.0 + 0.35 * Math.pow((span - heightAboveGround) / span, 2) : 1.0;
    cl *= groundEffectFactor;

    const liftForce = dynamicPressure * wingArea * cl;

    // Drag coefficient CD
    const cd0 = 0.022;
    const flapCd = Math.pow(state.flapsAngle / 40, 1.8) * 0.055;
    const gearCd = state.gearPosition * 0.035;
    const spoilerCd = state.spoilersPosition * 0.075;
    const aspectratio = 9.5;
    const inducedCd = (cl * cl) / (Math.PI * aspectratio * 0.85);
    const cd = cd0 + flapCd + gearCd + spoilerCd + inducedCd;
    const dragForce = dynamicPressure * wingArea * cd;

    // Engine Thrust
    const totalMaxThrustN = this.aircraft.maxThrustKn * 1000;
    let thrustForce = 0;
    if (state.enginesRunning) {
      if (state.reverseThrust && onGround) {
        thrustForce = -totalMaxThrustN * 0.45;
      } else {
        thrustForce = totalMaxThrustN * state.actualThrust * (airDensity / SEA_LEVEL_AIR_DENSITY);
      }
    }

    // Total Weight
    const mass = state.currentWeightKg;
    const weightForce = mass * GRAVITY;

    // Acceleration and Movement
    if (onGround) {
      // Ground mechanics
      state.y = groundElevationM + 3.2;
      state.roll = 0; // wings level on tarmac

      // Steering & braking (braked by pressing 'B' or moving throttle / flight stick down)
      let rollingResistance = mass * 0.02 * GRAVITY;
      const isBraking = state.brakesActive || state.parkingBrake || (state.pitchInput < -0.2 && state.airspeedKnots < 136);
      if (isBraking) {
        rollingResistance += mass * 0.65 * GRAVITY;
      }
      if (state.spoilersDeployed) {
        rollingResistance += dragForce * 0.8;
      }

      // Net longitudinal force
      const netLongitudinalForce = thrustForce - dragForce - rollingResistance;
      const forwardAcc = netLongitudinalForce / mass;

      state.vz = Math.max(0, state.vz + forwardAcc * dt);

      // Nosewheel steering via rudder or stick/keyboard left/right (A/D or flight stick)
      const steerInput = state.yawInput + state.rollInput;
      if (state.vz > 0.3) {
        const turnRate = (-steerInput * (22 / Math.max(6, state.vz))) * (Math.PI / 180);
        state.yaw += turnRate * dt;
      }

      // STRICT 136-KNOT TAKEOFF RULE:
      // Plane CANNOT fly until speed on the runway reaches 136 knots and above!
      const canTakeoff = state.airspeedKnots >= 136;

      if (!canTakeoff) {
        // Below 136 knots, lift off is strictly prevented; nose stays on runway
        state.pitch = Math.max(-0.02, Math.min(0.04, state.pitch));
        state.vy = 0;
        state.y = groundElevationM + 3.2;
      } else {
        // 136+ knots reached! Full elevator authority to rotate and take off!
        const elevatorAuthority = Math.min(1.2, Math.max(0.6, state.airspeedKnots / 136));
        state.pitch += state.pitchInput * 0.55 * elevatorAuthority * dt;
        state.pitch = Math.max(-0.02, Math.min(0.28, state.pitch));

        // Lift off check: when nose is raised or player presses W / Up Arrow / pulls stick up
        if (state.pitch > 0.04 || state.pitchInput > 0.1) {
          state.vy = Math.max(1.8, ((liftForce - weightForce) / mass) * dt + 2.6);
          state.y += state.vy * dt + 0.15;
          if (state.phase === 'takeoff_roll' || state.phase === 'parked') {
            state.phase = 'initial_climb';
          }
        } else {
          state.vy = 0;
          state.y = groundElevationM + 3.2;
        }
      }

      state.gForce = 1.0;
    } else {
      // In-flight 6-DOF
      const forwardAcc = (thrustForce - dragForce) / mass;
      const vertAcc = (liftForce * Math.cos(state.roll) - weightForce) / mass;
      const latAcc = (liftForce * Math.sin(state.roll)) / mass;

      state.vz += forwardAcc * dt;
      state.vy += vertAcc * dt;
      state.vx += latAcc * dt * 0.2; // side slip damping

      // Aerodynamic rotational damping & pilot authority (responsive left, right, up, down)
      const dynamicControlAuthority = Math.min(1.3, Math.max(0.4, forwardSpeed / 65));

      // Pitch control: W / Up Arrow flies UP (+pitch), S / Down Arrow flies DOWN (-pitch)
      const pitchRate = state.pitchInput * 0.75 * dynamicControlAuthority;
      state.pitch += pitchRate * dt;
      // Damping & natural pitch down in stall
      if (isStalled) {
        state.pitch -= 0.5 * dt;
      } else {
        // Pitch stability
        state.pitch = Math.max(-0.45, Math.min(0.45, state.pitch));
        if (Math.abs(state.pitchInput) < 0.05) {
          state.pitch -= (state.pitch - aoaRad * 0.2) * 0.15 * dt;
        }
      }

      // Roll / Bank control: A / Left Arrow banks left, D / Right Arrow banks right
      const rollRate = state.rollInput * 1.1 * dynamicControlAuthority;
      state.roll += rollRate * dt;
      state.roll = Math.max(-1.1, Math.min(1.1, state.roll));
      // Natural roll stability / auto-leveling
      if (Math.abs(state.rollInput) < 0.05 && this.plan.assistance === 'beginner') {
        state.roll += (0 - state.roll) * 1.8 * dt;
      }

      // Yaw & coordinated turn
      const turnRateFromBank = (GRAVITY * Math.tan(state.roll)) / Math.max(15, forwardSpeed);
      const rudderTurnRate = -state.yawInput * 0.5 * dynamicControlAuthority;
      state.yaw += (turnRateFromBank + rudderTurnRate) * dt;

      // G-force calculation
      state.gForce = Math.max(-0.5, Math.min(3.5, (liftForce / weightForce)));
      state.maxGForce = Math.max(state.maxGForce, state.gForce);
      state.minGForce = Math.min(state.minGForce, state.gForce);

      // Touchdown or Crash detection
      if (state.y <= groundElevationM + 3.2) {
        this.handleTouchdownOrCrash(state, groundElevationM);
      }
    }

    // 5. Update World Positions (For both ground roll and in-flight!)
    // Aircraft local forward = +Z (nose). Rotation around Y = state.yaw:
    const worldVx = state.vx * Math.cos(state.yaw) + state.vz * Math.sin(state.yaw);
    const worldVz = -state.vx * Math.sin(state.yaw) + state.vz * Math.cos(state.yaw);

    state.x += worldVx * dt;
    state.z += worldVz * dt;
    if (!onGround) {
      state.y += state.vy * dt;
    }
    state.distanceTraveledM += state.vz * dt;

    // 5. Warnings and GPWS
    if (!onGround) {
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

    // 6. Navigation progress
    const dx = destX - state.x;
    const dz = destZ - state.z;
    state.distanceToDestinationM = Math.hypot(dx, dz);
    state.distanceTraveledM += forwardSpeed * dt;

    // 7. Update Flight Phase
    this.updateFlightPhase(state, onGround);

    return state;
  }

  private handleTouchdownOrCrash(state: FlightState, groundElevationM: number) {
    const verticalFpm = state.vy * 60 * METERS_TO_FEET;
    state.touchdownFpm = verticalFpm;

    // Check for crash conditions
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

    // Successful touchdown
    state.y = groundElevationM + 3.2;
    state.vy = 0;
    state.roll = 0;
    state.pitch = Math.max(0, Math.min(0.08, state.pitch)); // nose drops to runway

    if (verticalFpm < -450) {
      state.safetyViolations.push(`Hard Touchdown (${Math.round(verticalFpm)} fpm)`);
      state.passengerComfort = Math.max(40, state.passengerComfort - 25);
    } else if (verticalFpm > -180) {
      // Butter landing!
      state.passengerComfort = Math.min(100, state.passengerComfort + 10);
    }
  }

  private runAutopilot(state: FlightState, dt: number, destX: number, destZ: number) {
    // 1. Auto-Throttle (SPD)
    if (state.autoThrottleEnabled) {
      const speedError = state.targetSpeedKnots - state.airspeedKnots;
      const throttleAdj = speedError * 0.015;
      state.throttle = Math.max(0.15, Math.min(1.0, state.throttle + throttleAdj * dt));
    }

    // 2. Heading Select (HDG) / NAV
    let targetHeading = state.targetHeadingDeg;
    if (state.navMode) {
      const dx = destX - state.x;
      const dz = destZ - state.z;
      const trackRad = Math.atan2(dx, -dz);
      targetHeading = ((trackRad * 180) / Math.PI + 360) % 360;
    }

    let headingDiff = targetHeading - state.headingDeg;
    while (headingDiff > 180) headingDiff -= 360;
    while (headingDiff < -180) headingDiff += 360;

    // Desired bank angle (up to 25 degrees)
    const targetBankDeg = Math.max(-25, Math.min(25, headingDiff * 1.5));
    const targetBankRad = (targetBankDeg * Math.PI) / 180;
    state.rollInput = Math.max(-1, Math.min(1, (targetBankRad - state.roll) * 2.0));

    // 3. Altitude Hold (ALT)
    const altDiffFt = state.targetAltitudeFt - state.altitudeFt;
    const targetVsFpm = Math.max(-2200, Math.min(2500, altDiffFt * 2.5));
    const vsDiffFpm = targetVsFpm - state.verticalSpeedFpm;
    state.pitchInput = Math.max(-0.6, Math.min(0.8, vsDiffFpm * 0.0015));
  }

  private updateFlightPhase(state: FlightState, onGround: boolean) {
    if (state.phase === 'crashed') return;

    if (onGround) {
      if (state.airspeedKnots < 5 && state.phase === 'parked') {
        // waiting for boarding
      } else if (state.reverseThrust && state.airspeedKnots < 10) {
        state.phase = 'pushback';
      } else if (state.airspeedKnots < 40 && (state.phase === 'pushback' || state.phase === 'taxi_out')) {
        state.phase = 'taxi_out';
      } else if (state.airspeedKnots >= 40 && state.throttle > 0.7 && state.phase === 'taxi_out') {
        state.phase = 'takeoff_roll';
      } else if (state.airspeedKnots >= this.aircraft.vrKnots && state.phase === 'takeoff_roll') {
        state.phase = 'rotation';
      } else if (state.phase === 'landing' && state.airspeedKnots < 60) {
        state.phase = 'taxi_in';
      } else if (state.phase === 'taxi_in' && state.airspeedKnots < 2 && !state.enginesRunning) {
        state.phase = 'gate_arrival';
      }
    } else {
      if (state.phase === 'rotation' || state.phase === 'takeoff_roll') {
        state.phase = 'initial_climb';
      } else if (state.phase === 'initial_climb' && state.altitudeFt > 1500) {
        state.phase = 'climb';
      } else if (state.phase === 'climb' && Math.abs(state.altitudeFt - this.plan.cruisingAltitudeFt) < 1000) {
        state.phase = 'cruise';
      } else if ((state.phase === 'cruise' || state.phase === 'climb') && state.distanceToDestinationM < 25000) {
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
      scoreText = 'Crashed';
      grade = 'F';
      comments.push(state.crashReason || 'Aircraft destroyed.');
    } else {
      if (verticalFpm > -150) {
        scoreText = 'Silky Butter Touchdown (Exceptional)';
        grade = 'A+';
        comments.push('Flawless gentle flare, passengers cheered with applause!');
      } else if (verticalFpm > -300) {
        scoreText = 'Greaser / Standard Touchdown';
        grade = 'A';
        comments.push('Professional landing within airline standards.');
      } else if (verticalFpm > -500) {
        scoreText = 'Firm Touchdown';
        grade = 'B';
        comments.push('Slightly firm arrival, gear took the impact well.');
      } else if (verticalFpm > -800) {
        scoreText = 'Hard Landing';
        grade = 'C';
        comments.push('Severe jolt to the passengers and landing gear inspections required.');
      } else {
        scoreText = 'Excessive Impact / Structural Strain';
        grade = 'D';
        comments.push('Critical structural stress limit exceeded.');
      }

      if (state.passengerComfort > 90) {
        comments.push('Outstanding passenger comfort maintained throughout flight.');
      } else if (state.passengerComfort < 60) {
        comments.push('Passenger comfort impacted by high Gs or steep banking.');
      }

      if (state.safetyViolations.length === 0) {
        comments.push('Zero safety or airspace violations recorded.');
      } else {
        comments.push(...state.safetyViolations);
      }
    }

    const fuelConsumed = this.plan.fuelKg - state.fuelRemainingKg;

    return {
      originCode: this.plan.origin.code,
      destCode: this.plan.destination.code,
      durationSec: Math.round(state.flightTimeSec),
      touchdownFpm: Math.round(verticalFpm),
      touchdownGs: Number(state.maxGForce.toFixed(2)),
      landingScore: scoreText,
      passengerComfort: Math.round(state.passengerComfort),
      fuelConsumedKg: Math.round(fuelConsumed),
      safetyScore: state.isCrashed ? 0 : Math.max(20, 100 - state.safetyViolations.length * 15),
      overallGrade: grade,
      comments,
    };
  }
}
