import React, { useState } from 'react';
import { AIRPORTS } from '../data/airports';
import { AIRCRAFTS } from '../data/aircraft';
import { AssistanceLevel, FlightPlan, TimeOfDay, WeatherType } from '../types';
import { Plane, CloudRain, Sun, Users, Fuel, ArrowRight } from 'lucide-react';

interface FlightSetupModalProps { currentPlan: FlightPlan; onConfirmPlan: (plan: FlightPlan) => void; onClose: () => void; }

export const FlightSetupModal: React.FC<FlightSetupModalProps> = ({ currentPlan, onConfirmPlan, onClose }) => {
  const [selectedAircraftId, setSelectedAircraftId] = useState(currentPlan.aircraft.id);
  const [originCode, setOriginCode] = useState(currentPlan.origin.code);
  const [destCode, setDestCode] = useState(currentPlan.destination.code);
  const selectedAircraft = AIRCRAFTS.find((a) => a.id === selectedAircraftId) || AIRCRAFTS[0];
  const capacity = selectedAircraft.id === 'b777' ? 396 : selectedAircraft.id === 'e195' ? 146 : 180;
  const [passengers, setPassengers] = useState(Math.min(currentPlan.passengers, capacity));
  const [fuelKg, setFuelKg] = useState(Math.min(currentPlan.fuelKg, selectedAircraft.fuelCapacityKg));
  const [weather, setWeather] = useState<WeatherType>(currentPlan.weather);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(currentPlan.timeOfDay);
  const [assistance, setAssistance] = useState<AssistanceLevel>(currentPlan.assistance);
  const originAirport = AIRPORTS.find((a) => a.code === originCode) || AIRPORTS[0];
  const destAirport = AIRPORTS.find((a) => a.code === destCode) || AIRPORTS[1];

  const selectAircraft = (id: string) => {
    const ac = AIRCRAFTS.find((a) => a.id === id) || AIRCRAFTS[0];
    const cap = ac.id === 'b777' ? 396 : ac.id === 'e195' ? 146 : 180;
    setSelectedAircraftId(id); setPassengers((p) => Math.min(p, cap)); setFuelKg((f) => Math.min(f, ac.fuelCapacityKg));
  };
  const handleStartFlight = () => {
    const newPlan: FlightPlan = {
      aircraft: selectedAircraft, origin: originAirport, destination: destAirport,
      cruisingAltitudeFt: selectedAircraft.id === 'b777' ? 35000 : selectedAircraft.id === 'e195' ? 30000 : 33000,
      passengers, maxPassengers: capacity, cargoKg: Math.round(passengers * 22), fuelKg,
      weather, timeOfDay, windSpeedKnots: weather === 'storm' ? 24 : weather === 'rain' ? 14 : 8,
      windDirectionDeg: originAirport.runways[0]?.heading ?? 250, assistance,
    };
    onConfirmPlan(newPlan);
  };

  const weatherOptions: WeatherType[] = ['clear', 'partly_cloudy', 'overcast', 'rain', 'storm', 'fog'];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none overflow-y-auto">
    <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white flex flex-col gap-5 my-8">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3"><div><h2 className="text-xl font-bold flex items-center gap-2"><Plane className="w-5 h-5 text-cyan-400" /> Flight Plan & Aircraft Dispatch</h2><p className="text-xs text-slate-400 font-mono">Configure aircraft, route, payload, weather and assistance before dispatch.</p></div><button onClick={onClose} className="text-slate-400 hover:text-white text-xs px-2.5 py-1 bg-slate-900 rounded border border-slate-800">Cancel</button></div>
      <div><label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Aircraft</label><div className="grid grid-cols-3 gap-2.5">{AIRCRAFTS.map((ac) => <button key={ac.id} onClick={() => selectAircraft(ac.id)} className={`p-3 rounded-xl border text-left transition-all ${ac.id === selectedAircraftId ? 'bg-cyan-950/80 border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}><div className="font-bold text-xs">{ac.name}</div><div className="text-[10px] text-slate-400">{ac.type}</div><div className="text-[10px] font-mono text-cyan-400 mt-2">Cruise {ac.cruiseSpeedKnots} kt • {ac.maxTakeoffWeightKg / 1000} t MTOW</div></button>)}</div></div>
      <div><label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">Flight Route</label><div className="grid grid-cols-2 gap-3"><div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-400 font-mono">DEPARTURE</span><select value={originCode} onChange={(e) => setOriginCode(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-white mt-1">{AIRPORTS.map((apt) => <option key={apt.code} value={apt.code}>{apt.code} ({apt.iata}) - {apt.city}</option>)}</select><div className="text-[10px] text-cyan-400 font-mono mt-1">RWY {originAirport.runways[0]?.name} • {originAirport.elevation} ft</div></div><div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-400 font-mono">DESTINATION</span><select value={destCode} onChange={(e) => setDestCode(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-white mt-1">{AIRPORTS.filter((a) => a.code !== originCode).map((apt) => <option key={apt.code} value={apt.code}>{apt.code} ({apt.iata}) - {apt.city}</option>)}</select><div className="text-[10px] text-cyan-400 font-mono mt-1">RWY {destAirport.runways[0]?.name} • ILS {destAirport.runways[0]?.ilsFrequency ?? '—'}</div></div></div></div>
      <div className="grid grid-cols-2 gap-3"><div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800"><div className="flex items-center justify-between text-xs font-mono mb-1"><span className="text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-cyan-400" /> PASSENGERS</span><span className="font-bold">{passengers}/{capacity}</span></div><input type="range" min="20" max={capacity} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="w-full cursor-pointer accent-cyan-500" /></div><div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800"><div className="flex items-center justify-between text-xs font-mono mb-1"><span className="text-slate-400 flex items-center gap-1.5"><Fuel className="w-3.5 h-3.5 text-amber-400" /> FUEL</span><span className="font-bold">{fuelKg.toLocaleString()} kg</span></div><input type="range" min="5000" max={selectedAircraft.fuelCapacityKg} step="500" value={fuelKg} onChange={(e) => setFuelKg(Number(e.target.value))} className="w-full cursor-pointer accent-amber-500" /></div></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] font-mono text-slate-400 font-bold block mb-1.5"><CloudRain className="inline w-3.5 h-3.5 mr-1" />WEATHER</label><div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">{weatherOptions.map((w) => <button key={w} onClick={() => setWeather(w)} className={`py-1.5 px-2 rounded-lg border capitalize ${weather === w ? 'bg-cyan-600 border-cyan-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{w.replace('_', ' ')}</button>)}</div></div><div><label className="text-[11px] font-mono text-slate-400 font-bold block mb-1.5"><Sun className="inline w-3.5 h-3.5 mr-1" />TIME OF DAY</label><div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">{(['dawn','day','sunset','night'] as TimeOfDay[]).map((t) => <button key={t} onClick={() => setTimeOfDay(t)} className={`py-1.5 px-2 rounded-lg border capitalize ${timeOfDay === t ? 'bg-amber-600 border-amber-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{t}</button>)}</div></div></div>
      <div><label className="text-[11px] font-mono text-slate-400 font-bold block mb-1.5">SIMULATION ASSISTANCE</label><div className="grid grid-cols-3 gap-2 text-xs font-mono">{(['beginner','intermediate','realistic'] as AssistanceLevel[]).map((lvl) => <button key={lvl} onClick={() => setAssistance(lvl)} className={`p-2.5 rounded-xl border text-left capitalize ${assistance === lvl ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'}`}><div className="font-bold">{lvl}</div><div className="text-[10px] text-slate-400 lowercase font-normal">{lvl === 'beginner' ? 'Auto-level wings & assisted flare' : lvl === 'intermediate' ? 'Standard aerodynamics' : 'Full real-world stall & inertia'}</div></button>)}</div></div>
      <div className="border-t border-slate-800 pt-4"><button onClick={handleStartFlight} className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2">Dispatch & Start Flight <ArrowRight className="w-4 h-4" /></button></div>
    </div>
  </div>;
};
