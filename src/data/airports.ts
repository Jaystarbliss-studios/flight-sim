import { AirportDef } from '../types';

export const AIRPORTS: AirportDef[] = [
  { code: 'KLAX', iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', lat: 33.9425, lon: -118.4081, elevation: 125, worldX: 0, worldZ: 0, runways: [
    { id: '24L', name: '24L', heading: 250, lengthMeters: 3300, widthMeters: 45, thresholdOffset: 120, altitudeMeters: 38, ilsFrequency: 108.5, papiAngle: 3.0 },
    { id: '25R', name: '25R', heading: 250, lengthMeters: 3685, widthMeters: 60, thresholdOffset: 150, altitudeMeters: 38, ilsFrequency: 109.9, papiAngle: 3.0 },
  ] },
  { code: 'KSFO', iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', lat: 37.6188, lon: -122.375, elevation: 13, worldX: -8000, worldZ: -42000, runways: [{ id: '28R', name: '28R', heading: 284, lengthMeters: 3618, widthMeters: 60, thresholdOffset: 100, altitudeMeters: 4, ilsFrequency: 110.7, papiAngle: 3.0 }] },
  { code: 'EGLL', iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lon: -0.4543, elevation: 83, worldX: 25000, worldZ: -30000, runways: [{ id: '27R', name: '27R', heading: 272, lengthMeters: 3902, widthMeters: 50, thresholdOffset: 120, altitudeMeters: 25, ilsFrequency: 110.3, papiAngle: 3.0 }] },
  { code: 'DNMM', iata: 'LOS', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria', lat: 6.5774, lon: 3.3212, elevation: 135, worldX: 18000, worldZ: 35000, runways: [{ id: '18R', name: '18R', heading: 180, lengthMeters: 3900, widthMeters: 60, thresholdOffset: 120, altitudeMeters: 41, ilsFrequency: 109.5, papiAngle: 3.0 }] },
  { code: 'KJFK', iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', lat: 40.6413, lon: -73.7781, elevation: 13, worldX: 45000, worldZ: -12000, runways: [{ id: '31L', name: '31L', heading: 314, lengthMeters: 4423, widthMeters: 60, thresholdOffset: 150, altitudeMeters: 4, ilsFrequency: 111.5, papiAngle: 3.0 }] },
  { code: 'LFPG', iata: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479, elevation: 392, worldX: 32000, worldZ: -26000, runways: [{ id: '27L', name: '27L', heading: 267, lengthMeters: 4215, widthMeters: 45, thresholdOffset: 120, altitudeMeters: 119, ilsFrequency: 108.9, papiAngle: 3.0 }] },
  { code: 'EDDF', iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622, elevation: 364, worldX: 39000, worldZ: -18000, runways: [
    { id: '07C', name: '07C', heading: 69, lengthMeters: 4000, widthMeters: 45, thresholdOffset: 120, altitudeMeters: 111, ilsFrequency: 110.9, papiAngle: 3.0 },
    { id: '25C', name: '25C', heading: 249, lengthMeters: 4000, widthMeters: 45, thresholdOffset: 120, altitudeMeters: 111, ilsFrequency: 110.9, papiAngle: 3.0 },
  ] },
  { code: 'RJTT', iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798, elevation: 21, worldX: -42000, worldZ: 42000, runways: [{ id: '34R', name: '34R', heading: 338, lengthMeters: 3360, widthMeters: 60, thresholdOffset: 90, altitudeMeters: 6, ilsFrequency: 111.7, papiAngle: 3.0 }] },
  { code: 'OMDB', iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lon: 55.3657, elevation: 62, worldX: -10000, worldZ: 12000, runways: [{ id: '30R', name: '30R', heading: 304, lengthMeters: 4447, widthMeters: 60, thresholdOffset: 120, altitudeMeters: 19, ilsFrequency: 110.1, papiAngle: 3.0 }] },
  { code: 'FAOR', iata: 'JNB', name: 'O. R. Tambo International Airport', city: 'Johannesburg', country: 'South Africa', lat: -26.1392, lon: 28.2460, elevation: 5558, worldX: 8000, worldZ: 52000, runways: [{ id: '03L', name: '03L', heading: 34, lengthMeters: 4418, widthMeters: 60, thresholdOffset: 120, altitudeMeters: 1694, ilsFrequency: 111.9, papiAngle: 3.0 }] },
];
