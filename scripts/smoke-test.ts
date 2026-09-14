import { AIRCRAFTS } from '../src/data/aircraft';
import { AIRPORTS } from '../src/data/airports';
import { FlightPhysics } from '../src/simulation/flightPhysics';
import type { FlightPlan } from '../src/types';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`SMOKE TEST FAILED: ${message}`);
};

const makePlan = (aircraft = AIRCRAFTS[0]): FlightPlan => {
  const maxPassengers = aircraft.id === 'e195' ? 146 : aircraft.id === 'b777' ? 396 : 180;
  const passengers = Math.min(120, maxPassengers);
  const fuelKg = Math.min(14000, aircraft.fuelCapacityKg);
  const availablePayload = Math.max(0, aircraft.maxTakeoffWeightKg - aircraft.emptyWeightKg - fuelKg);
  const cargoKg = Math.min(2400, Math.max(0, availablePayload - passengers * 85));
  return {
    aircraft, origin: AIRPORTS[0], destination: AIRPORTS[1], cruisingAltitudeFt: 33000,
    passengers, maxPassengers, cargoKg, fuelKg, weather: 'clear', timeOfDay: 'day',
    windSpeedKnots: 8, windDirectionDeg: 250, assistance: 'realistic',
  };
};

for (const aircraft of AIRCRAFTS) {
  const plan = makePlan(aircraft);
  const physics = new FlightPhysics(plan);
  const state = physics.initFlightState(38);
  assert(state.enginesRunning, `${aircraft.id}: engines should initialize running`);
  assert(state.gearDown && state.gearPosition === 1, `${aircraft.id}: landing gear should start down`);
  assert(state.currentWeightKg <= aircraft.maxTakeoffWeightKg, `${aircraft.id}: dispatch weight exceeds MTOW`);
  state.throttle = 1;
  physics.update(state, 1 / 60, 38, plan.destination.worldX, plan.destination.worldZ);
  assert(state.n1 > 20, `${aircraft.id}: engine spool did not respond to throttle`);
  assert(state.fuelRemainingKg < plan.fuelKg, `${aircraft.id}: fuel burn did not occur`);
}

const a320Plan = makePlan(AIRCRAFTS[0]);
const a320 = new FlightPhysics(a320Plan);
const flight = a320.initFlightState(38);
flight.throttle = 1;
flight.parkingBrake = false;
for (let i = 0; i < 180; i++) a320.update(flight, 1 / 60, 38, a320Plan.destination.worldX, a320Plan.destination.worldZ);
assert(flight.airspeedKnots > 0, 'A320 should accelerate under thrust');
assert(!flight.isCrashed, 'A320 should not crash during the initial acceleration smoke test');

console.log('Flight simulator smoke tests passed.');
