import React from 'react';
import { FlightState } from '../types';
import { Play, Check, ChevronRight, X, ArrowUp, ArrowDown, HelpCircle, Navigation } from 'lucide-react';

interface QuickTutorialProps {
  state: FlightState;
  onDismiss: () => void;
  onFullThrottle: () => void;
}

export const QuickTutorial: React.FC<QuickTutorialProps> = ({ state, onDismiss, onFullThrottle }) => {
  const isAirborne = state.radioAltitudeFt > 30;
  const isSpeeding = state.airspeedKnots > 20;
  const readyToRotate = state.airspeedKnots >= 136 && !isAirborne;

  // Determine current active tutorial step
  let currentStep = 1;
  if (isAirborne) {
    currentStep = 3;
  } else if (readyToRotate) {
    currentStep = 2;
  } else if (isSpeeding) {
    currentStep = 1;
  }

  return (
    <div className="pointer-events-auto fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-full bg-slate-950/95 backdrop-blur-lg border-2 border-cyan-500/80 rounded-2xl p-4 text-white shadow-2xl shadow-cyan-950/50 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/50">
            ✈️
          </div>
          <h3 className="font-bold text-sm tracking-wide text-cyan-300">
            QUICK PILOT FLIGHT GUIDE
          </h3>
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors"
        >
          <span>Hide</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dynamic Instruction Card */}
      {currentStep === 1 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/40 shrink-0 mt-0.5">
              1
            </div>
            <div>
              <div className="font-bold text-sm text-amber-300">
                Step 1: Accelerate to 136 Knots
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                The plane cannot fly until it reaches <b>136 knots</b> on the runway! Push throttle to <b>100%</b>, or press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">Shift</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">Space</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">W</kbd>.
              </p>
              <div className="text-[11px] text-slate-400 mt-1">
                • <b>Brake</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-red-300 font-mono text-[10px]">B</kbd> or pull stick down<br />
                • <b>Steer runway</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[10px]">A</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[10px]">D</kbd>
              </div>
            </div>
          </div>

          {state.throttle < 0.8 && (
            <button
              onClick={onFullThrottle}
              className="w-full py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Full Takeoff Power (100% Throttle)</span>
            </button>
          )}

          {state.throttle >= 0.8 && (
            <div className="text-xs font-mono text-emerald-400 bg-emerald-950/60 p-2 rounded-lg border border-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Speeding up on runway:</span>
              </div>
              <span className="font-bold">{Math.round(state.airspeedKnots)} / 136 KTS</span>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/40 shrink-0 mt-0.5 animate-bounce">
              2
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-300">
                Step 2: 136 Knots Reached! FLY UP NOW!
              </div>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                Takeoff speed hit (<b>{Math.round(state.airspeedKnots)} kts</b>)! Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-xs font-bold">W</kbd> or <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-xs font-bold">Up Arrow ↑</kbd> (or push flight stick UP) to fly up into the sky!
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/40 shrink-0 mt-0.5">
              3
            </div>
            <div>
              <div className="font-bold text-sm text-cyan-300">
                Step 3: You are Flying in the Sky!
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                • <b>Fly Up / Down</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">W</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">S</kbd> or <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">↑</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">↓</kbd><br />
                • <b>Turn Left / Right</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">A</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">D</kbd> or <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">←</kbd> / <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">→</kbd><br />
                • <b>Landing Gear</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">G</kbd> to retract wheels<br />
                • <b>Brake</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-red-300 font-mono text-[11px]">B</kbd><br />
                • <b>Camera Views</b>: Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono text-[11px]">C</kbd>
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all"
          >
            I Got It, Close Guide
          </button>
        </div>
      )}
    </div>
  );
};
