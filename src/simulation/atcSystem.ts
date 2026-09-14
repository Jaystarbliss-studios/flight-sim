import { FlightPhase, FlightPlan } from '../types';

export interface AtcMessage {
  id: string;
  sender: 'TOWER' | 'GROUND' | 'DEPARTURE' | 'APPROACH' | 'PILOT';
  text: string;
  timestamp: string;
}

export class AtcSystem {
  private lastPhase: FlightPhase = 'parked';
  private callsign: string = 'AeroSky 242';

  public getTransmissionForPhase(phase: FlightPhase, plan: FlightPlan): AtcMessage | null {
    if (phase === this.lastPhase) return null;
    this.lastPhase = phase;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const orig = plan.origin.code;
    const dest = plan.destination.code;
    const rwy = plan.origin.runways[0]?.name || '24L';
    const destRwy = plan.destination.runways[0]?.name || '28R';

    switch (phase) {
      case 'parked':
        return {
          id: 'atc_parked',
          sender: 'GROUND',
          text: `${this.callsign}, ${orig} Delivery: Cleared to ${dest} flight plan, departure runway ${rwy}. Squawk 4215.`,
          timestamp: timeStr,
        };
      case 'boarding':
        return {
          id: 'atc_boarding',
          sender: 'PILOT',
          text: `Cabin Crew: Passenger boarding commenced. Fuel and baggage manifest verified.`,
          timestamp: timeStr,
        };
      case 'pushback':
        return {
          id: 'atc_pushback',
          sender: 'GROUND',
          text: `${this.callsign}, Ground: Pushback and engine start approved, tail facing South.`,
          timestamp: timeStr,
        };
      case 'taxi_out':
        return {
          id: 'atc_taxi_out',
          sender: 'GROUND',
          text: `${this.callsign}: Taxi to runway ${rwy} via Taxiway Alpha, Charlie. Hold short of runway ${rwy}.`,
          timestamp: timeStr,
        };
      case 'takeoff_roll':
        return {
          id: 'atc_takeoff',
          sender: 'TOWER',
          text: `${this.callsign}, Tower: Wind 250 at 8 knots. Runway ${rwy} CLEARED FOR TAKEOFF!`,
          timestamp: timeStr,
        };
      case 'initial_climb':
        return {
          id: 'atc_initial_climb',
          sender: 'DEPARTURE',
          text: `${this.callsign}, Departure: Radar contact, climb and maintain 10,000 ft. Contact center on 124.85.`,
          timestamp: timeStr,
        };
      case 'cruise':
        return {
          id: 'atc_cruise',
          sender: 'DEPARTURE',
          text: `${this.callsign}: Level at FL${Math.round(plan.cruisingAltitudeFt / 100)}. Smooth ride reported ahead.`,
          timestamp: timeStr,
        };
      case 'descent':
        return {
          id: 'atc_descent',
          sender: 'APPROACH',
          text: `${this.callsign}, ${dest} Approach: Descend and maintain 4,000 ft. Expect ILS runway ${destRwy}.`,
          timestamp: timeStr,
        };
      case 'approach':
        return {
          id: 'atc_approach',
          sender: 'TOWER',
          text: `${this.callsign}: Established on localizer. Check gear down and locked. Wind calm, cleared to land runway ${destRwy}.`,
          timestamp: timeStr,
        };
      case 'landing':
        return {
          id: 'atc_landing',
          sender: 'TOWER',
          text: `${this.callsign}: Touchdown confirmed. Turn off at next available high-speed taxiway, contact ground on 121.9.`,
          timestamp: timeStr,
        };
      case 'taxi_in':
        return {
          id: 'atc_taxi_in',
          sender: 'GROUND',
          text: `${this.callsign}, Ground: Welcome to ${plan.destination.city}. Taxi to Gate 24 via Bravo.`,
          timestamp: timeStr,
        };
      case 'gate_arrival':
        return {
          id: 'atc_gate',
          sender: 'GROUND',
          text: `${this.callsign}: On the blocks at Gate 24. Chocks in place, ground power connected. Have a great day!`,
          timestamp: timeStr,
        };
      default:
        return null;
    }
  }

  public reset() {
    this.lastPhase = 'parked';
  }
}
