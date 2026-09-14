import React from 'react';
import { FlightPhase, FlightPlan, FlightState } from '../types';
import { AtcMessage } from '../simulation/atcSystem';
import { Radio, AlertTriangle } from 'lucide-react';

interface FlightPhaseBarProps {
  state: FlightState;
  plan: FlightPlan;
  atcMessage: AtcMessage | null;
}

export const FlightPhaseBar: React.FC<FlightPhaseBarProps> = ({ state, plan, atcMessage }) => {
  const getPhaseHint = (phase: FlightPhase): string => {
    switch (phase) {
      case 'parked':
      case 'taxi_out':
      case 'takeoff_roll':
        return state.airspeedKnots >= 136
          ? '🚀 136+ KTS REACHED! Press [W] / [↑] or push stick UP to FLY UP!'
          : `Accelerating: ${Math.round(state.airspeedKnots)}/136 KTS (Need 136+ knots to fly)`;
      case 'rotation':
        return 'Climbing out! Maintain +12° pitch angle';
      case 'initial_climb':
        return 'Airborne! Press G to raise landing gear, climb to 4,000 ft';
      case 'climb':
        return 'Climbing to cruising altitude';
      case 'cruise':
        return `Cruising at FL${Math.round(plan.cruisingAltitudeFt / 100)} (${plan.destination.city})`;
      case 'descent':
        return 'Descending: Reduce throttle to 50%, align with runway';
      case 'approach':
        return 'Final Approach: Gear DOWN (G), keep 2 White 2 Red PAPI';
      case 'landing':
        return 'Touchdown: Idle throttle, deploy reverse thrust & brakes';
      case 'taxi_in':
        return 'Welcome! Slow down and taxi to gate';
      case 'gate_arrival':
        return 'Flight Completed! Welcome to destination';
      case 'crashed':
        return state.crashReason || 'Crash: Structural failure';
      default:
        return '';
    }
  };

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1 max-w-xl mx-auto w-[94%] select-none">
      {/* Critical Stall Alert (Only when stalled) */}
      {state.isStalled && (
        <div className="w-full bg-red-600/95 text-white font-mono font-bold text-center py-1 rounded-full shadow-red-500/50 shadow-lg animate-pulse flex items-center justify-center gap-2 text-xs border border-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span>STALL! PUSH NOSE DOWN (W / UP ARROW) & INCREASE POWER!</span>
        </div>
      )}

      {/* Slim Modern Floating Status Pill */}
      <div className="flex items-center justify-between w-full bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/60 text-xs font-mono text-white shadow-lg gap-2">
        {/* Phase Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-cyan-600/90 text-[10px] font-bold tracking-wider uppercase text-white shadow-sm">
            {state.phase.replace('_', ' ')}
          </span>
        </div>

        {/* Action Hint */}
        <div className="flex-1 text-center truncate text-[11px] text-slate-200">
          {getPhaseHint(state.phase)}
        </div>

        {/* Mini PAPI Indicator on Approach */}
        {(state.phase === 'approach' || state.phase === 'landing' || state.radioAltitudeFt < 1200) && (
          <div className="flex items-center gap-1 shrink-0 bg-slate-900/90 px-1.5 py-0.5 rounded-full border border-slate-700">
            {(() => {
              const distFromThreshold = Math.hypot(state.x, state.z - 180);
              const altitudeAboveRwy = Math.max(0, state.y - 38);
              const actualAngleDeg = (Math.atan2(altitudeAboveRwy, Math.max(10, distFromThreshold)) * 180) / Math.PI;
              const numWhite =
                actualAngleDeg > 3.4 ? 4 : actualAngleDeg > 3.1 ? 3 : actualAngleDeg > 2.8 ? 2 : actualAngleDeg > 2.5 ? 1 : 0;

              return [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < numWhite ? 'bg-white shadow-[0_0_4px_white]' : 'bg-red-500 shadow-[0_0_4px_red]'
                  }`}
                />
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
