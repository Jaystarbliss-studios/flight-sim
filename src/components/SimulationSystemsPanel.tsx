import React from 'react';
import { CloudRain, Compass, Gauge, Navigation, Plane, Radio, Route, Users, Wrench, Zap } from 'lucide-react';
import { CompleteSimulationSystems } from '../simulation/completeSystems';
import { FlightPlan, FlightState } from '../types';

interface Props { systems: CompleteSimulationSystems; state: FlightState; plan: FlightPlan; }

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function SimulationSystemsPanel({ systems, state, plan }: Props) {
  const s = systems.getSnapshot();
  const nav = s.nav;
  const weather = s.weather;
  const ground = s.ground;
  const perf = s.performance;
  return <div className="w-[min(94vw,430px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-950/90 p-3 text-white shadow-2xl backdrop-blur-xl font-mono text-[11px]">
    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
      <div><div className="font-black tracking-widest text-cyan-300">SIMULATION SYSTEMS</div><div className="text-[9px] text-slate-500">LIVE INTEGRATED FLIGHT STACK</div></div>
      <Gauge className="w-4 h-4 text-cyan-300" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Navigation className="w-3 h-3"/>NAVIGATION</div><div className="mt-1 font-bold">{nav.bearingDeg.toFixed(0)}° → {Math.round(nav.distanceM / 1000)} km</div><div className="text-slate-500">ETA {Math.round(nav.etaSec / 60)} min · XTK {Math.round(nav.crossTrackM)}m</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Route className="w-3 h-3"/>ILS</div><div className="mt-1 font-bold">LOC {s.ils.localizerDeg.toFixed(2)}°</div><div className="text-slate-500">GS {s.ils.glideslopeDeg.toFixed(2)}° · {s.ils.captured ? 'CAPTURED' : 'ARM/SEARCH'}</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><CloudRain className="w-3 h-3"/>WEATHER</div><div className="mt-1 font-bold">{plan.weather.toUpperCase()}</div><div className="text-slate-500">Wind {Math.round(Math.hypot(weather.windEastKt, weather.windNorthKt))}kt · Vis {weather.visibilityKm.toFixed(1)}km</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Users className="w-3 h-3"/>TRAFFIC</div><div className="mt-1 font-bold">{s.traffic.length} AI CONTACTS</div><div className="text-slate-500">Separation-managed local traffic</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Wrench className="w-3 h-3"/>GROUND OPS</div><div className="mt-1 font-bold">BOARD {pct(ground.boarding)}</div><div className="text-slate-500">Bags {pct(ground.bagsLoaded)} · Fuel {Math.round(ground.fuelLoadedKg)}kg</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Radio className="w-3 h-3"/>AUTOPILOT</div><div className="mt-1 font-bold">{state.autopilotEnabled ? 'ENGAGED' : 'MANUAL'}</div><div className="text-slate-500">HDG {Math.round(state.targetHeadingDeg)} · ALT {Math.round(state.targetAltitudeFt)}</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Plane className="w-3 h-3"/>WORLD</div><div className="mt-1 font-bold">{s.loadedCells} STREAM CELLS</div><div className="text-slate-500">Origin {plan.origin.code} · Dest {plan.destination.code}</div></div>
      <div className="rounded-xl bg-white/5 p-2"><div className="flex gap-1 text-slate-400"><Zap className="w-3 h-3"/>PERFORMANCE</div><div className="mt-1 font-bold">{perf.fps.toFixed(0)} FPS</div><div className="text-slate-500">{perf.frameMs.toFixed(1)}ms · {perf.quality.toUpperCase()}</div></div>
    </div>
    <div className="mt-2 flex items-center justify-between rounded-xl bg-cyan-400/5 px-2 py-2 text-[10px]"><span className="text-slate-400">CAREER CREDITS</span><span className="font-black text-cyan-300">{s.credits.toLocaleString()}</span></div>
  </div>;
}
