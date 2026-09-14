import React from 'react';
import { FlightSummary } from '../types';
import { Trophy, Award, AlertCircle, RotateCcw, CheckCircle, Flame } from 'lucide-react';

interface FlightResultModalProps {
  summary: FlightSummary;
  onRestart: () => void;
  onClose: () => void;
}

export const FlightResultModal: React.FC<FlightResultModalProps> = ({ summary, onRestart, onClose }) => {
  const isPass = summary.overallGrade !== 'F';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg ${
                summary.overallGrade === 'A+' || summary.overallGrade === 'A'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
                  : summary.overallGrade === 'B' || summary.overallGrade === 'C'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                  : 'bg-red-500/20 text-red-400 border border-red-500'
              }`}
            >
              {summary.overallGrade}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {isPass ? 'Flight Completed Successfully' : 'Flight Incident / Structural Damage'}
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Route: {summary.originCode} → {summary.destCode} • Duration: {Math.floor(summary.durationSec / 60)}m {summary.durationSec % 60}s
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          {/* Touchdown Rate */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400">TOUCHDOWN RATE</span>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">
              {summary.touchdownFpm} <span className="text-xs font-normal">FPM</span>
            </div>
            <span className="text-[10px] text-slate-300">{summary.landingScore}</span>
          </div>

          {/* Touchdown Gs */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400">IMPACT G-FORCE</span>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">
              {summary.touchdownGs} <span className="text-xs font-normal">G</span>
            </div>
            <span className="text-[10px] text-slate-300">Max limit: 2.5G</span>
          </div>

          {/* Passenger Comfort */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400">PASSENGER COMFORT</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {summary.passengerComfort}%
            </div>
            <span className="text-[10px] text-slate-300">Based on bank, Gs & smoothness</span>
          </div>

          {/* Fuel Consumed */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400">FUEL CONSUMED</span>
            <div className="text-lg font-bold text-amber-400 mt-0.5">
              {summary.fuelConsumedKg} <span className="text-xs font-normal">KG</span>
            </div>
            <span className="text-[10px] text-slate-300">Normal engine efficiency</span>
          </div>
        </div>

        {/* Evaluation Comments */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Flight Operations Log:
          </span>
          <ul className="text-xs text-slate-300 space-y-1">
            {summary.comments.map((comment, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{comment}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onRestart}
            className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Fly Another Route</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
          >
            Review Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
