import { AIRCRAFTS } from '../src/data/aircraft';
import { AIRPORTS } from '../src/data/airports';
import { CompleteSimulationSystems, haversineDistanceM, initialBearingDeg } from '../src/simulation/completeSystems';
import { FlightPhysics } from '../src/simulation/flightPhysics';
import { FlightPlan } from '../src/types';

const aircraft = AIRCRAFTS[0];
const origin = AIRPORTS.find(a => a.code === 'KLAX')!;
const destination = AIRPORTS.find(a => a.code === 'KSFO')!;
const plan: FlightPlan = { aircraft, origin, destination, cruisingAltitudeFt: 33000, passengers: 120, maxPassengers: 180, cargoKg: 2500, fuelKg: Math.min(12000, aircraft.fuelCapacityKg), weather: 'storm', timeOfDay: 'day', windSpeedKnots: 18, windDirectionDeg: 250, assistance: 'realistic' };

const physics = new FlightPhysics(plan);
const state = physics.initFlightState(origin.runways[0].altitudeMeters);
const systems = new CompleteSimulationSystems(plan);

if (!(haversineDistanceM({ lat: origin.lat, lon: origin.lon }, { lat: destination.lat, lon: destination.lon }) > 400000)) throw new Error('Great-circle navigation distance failed');
if (!(initialBearingDeg({ lat: origin.lat, lon: origin.lon }, { lat: destination.lat, lon: destination.lon }) >= 0)) throw new Error('Bearing calculation failed');
for (let i = 0; i < 600; i++) { physics.update(state, 1 / 60, origin.runways[0].altitudeMeters, destination.worldX, destination.worldZ); systems.update(state, 1 / 60, 1000 / 60); }
const snapshot = systems.getSnapshot();
if (snapshot.traffic.length !== 8) throw new Error('AI traffic population failed');
if (snapshot.loadedCells !== 25) throw new Error('World streaming cell budget failed');
if (!(snapshot.weather.visibilityKm < 35 && snapshot.weather.turbulence > 0)) throw new Error('Weather engine failed');
if (!(snapshot.nav.distanceM > 0 && Number.isFinite(snapshot.nav.etaSec))) throw new Error('Navigation solution failed');
console.log('Complete simulator systems tests passed.');
