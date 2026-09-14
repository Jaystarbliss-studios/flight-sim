import React, { useState } from 'react';
import { Check, Plane, X, Sparkles, Box } from 'lucide-react';
import { AIRCRAFTS } from '../data/aircraft';
import { AircraftSpec } from '../types';

export type VisualModel = 'procedural' | 'detailed';

interface HangarModalProps {
  currentAircraft: AircraftSpec;
  currentVisualModel: VisualModel;
  onSelect: (aircraft: AircraftSpec, visualModel: VisualModel) => void;
  onClose: () => void;
}

export const HangarModal: React.FC<HangarModalProps> = ({ currentAircraft, currentVisualModel, onSelect, onClose }) => {
  const [selectedId, setSelectedId] = useState(currentAircraft.id);
  const [visualModel, setVisualModel] = useState<VisualModel>(currentVisualModel);
  const selectedAircraft = AIRCRAFTS.find((item) => item.id === selectedId) ?? AIRCRAFTS[0];
  const detailedAvailable = selectedAircraft.id === 'a320';

  const confirm = () => {
    onSelect(selectedAircraft, detailedAvailable ? visualModel : 'procedural');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-lg p-4 select-none">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950/95 shadow-2xl text-white">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-bold uppercase tracking-[0.2em]"><Plane className="w-4 h-4" /> Hangar</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black">Choose Your Aircraft</h2>
            <p className="text-xs text-slate-400 mt-1">Pick the aircraft and visual model before dispatch. Nothing changes underneath you automatically.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white" title="Close hangar"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          {AIRCRAFTS.map((aircraft) => {
            const active = aircraft.id === selectedId;
            return (
              <button key={aircraft.id} onClick={() => setSelectedId(aircraft.id)} className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${active ? 'border-cyan-400 bg-cyan-950/50 shadow-xl shadow-cyan-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}>
                <div className="h-36 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950/40">
                  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_30%,rgba(56,189,248,.35),transparent_55%)]" />
                  <div className="absolute left-1/2 top-[44%] h-20 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-slate-100/90 shadow-lg rotate-[-5deg]" />
                  <div className="absolute left-1/2 top-[44%] w-[85%] h-1.5 -translate-x-1/2 bg-cyan-500/70 rotate-[-5deg]" />
                  {active && <div className="absolute right-3 top-3 rounded-full bg-cyan-500 p-1.5"><Check className="w-4 h-4 text-white" /></div>}
                </div>
                <div className="p-4">
                  <div className="text-sm font-black">{aircraft.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{aircraft.manufacturer} • {aircraft.type}</div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-3 min-h-12">{aircraft.description}</p>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-mono">
                    <div className="rounded-lg bg-slate-950/70 p-2"><span className="text-slate-500 block">CRUISE</span><span className="text-cyan-300">{aircraft.cruiseSpeedKnots} kt</span></div>
                    <div className="rounded-lg bg-slate-950/70 p-2"><span className="text-slate-500 block">MTOW</span><span className="text-cyan-300">{Math.round(aircraft.maxTakeoffWeightKg / 1000)} t</span></div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div><div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Aircraft Visual</div><div className="text-sm font-bold mt-1">How should {selectedAircraft.name} appear?</div></div>
              <span className="text-[10px] font-mono text-slate-500">{detailedAvailable ? 'A320 detailed asset available' : 'Detailed asset not yet mapped'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button disabled={!detailedAvailable} onClick={() => setVisualModel('procedural')} className={`rounded-xl border p-3 text-left ${visualModel === 'procedural' || !detailedAvailable ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-800 bg-slate-950/60'} ${!detailedAvailable ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-2 font-bold text-sm"><Box className="w-4 h-4 text-cyan-300" /> Simulator Model</div>
                <div className="text-[11px] text-slate-400 mt-1">Native procedural aircraft with fully controlled flight-surface animation and no network dependency.</div>
              </button>
              <button disabled={!detailedAvailable} onClick={() => setVisualModel('detailed')} className={`rounded-xl border p-3 text-left ${visualModel === 'detailed' && detailedAvailable ? 'border-emerald-500 bg-emerald-950/40' : 'border-slate-800 bg-slate-950/60'} ${!detailedAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="flex items-center gap-2 font-bold text-sm"><Sparkles className="w-4 h-4 text-emerald-300" /> Detailed A320</div>
                <div className="text-[11px] text-slate-400 mt-1">The high-detail external A320 asset. It is only shown when you explicitly select it here.</div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-800 p-5">
          <button onClick={onClose} className="sm:w-40 rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-bold text-slate-300 hover:text-white">Cancel</button>
          <button onClick={confirm} className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3 text-sm font-black shadow-lg shadow-cyan-600/20">Use {selectedAircraft.name}</button>
        </div>
      </div>
    </div>
  );
};
