import React from 'react';
import { FlightPlan, FlightState } from '../types';
import { Shield, Crosshair, Flame } from 'lucide-react';

interface TacticalHudOverlayProps {
  state: FlightState;
  plan: FlightPlan;
  onDeployFlares?: () => void;
  onToggleHudMode?: () => void;
}

export const TacticalHudOverlay: React.FC<TacticalHudOverlayProps> = ({
  state,
  plan,
  onDeployFlares,
  onToggleHudMode,
}) => {
  const pitchDeg = (state.pitch * 180) / Math.PI;
  const rollDeg = (state.roll * 180) / Math.PI;

  // Velocity vector offset (flight path marker) based on pitch and yaw slip
  const pitchLadderOffsetPx = pitchDeg * 12;
  const fpmX = Math.max(-120, Math.min(120, state.rollInput * 35));
  const fpmY = Math.max(-100, Math.min(100, (state.verticalSpeedFpm / 100) * 1.5));

  // Compass heading ribbon
  const heading = Math.round(state.headingDeg);

  // Target Drone intercept solution
  const drone = state.targetDrone;
  const droneBearingDiff = drone ? ((drone.bearingDeg - heading + 540) % 360) - 180 : 0;
  const droneScreenX = Math.max(-200, Math.min(200, droneBearingDiff * 8));

  const isAfterburner = Boolean(state.afterburnerActive);
  const flares = state.flaresRemaining ?? 0;

  return (
    <div id="tactical-military-hud" className="pointer-events-none absolute inset-0 select-none overflow-hidden font-mono text-emerald-400">
      {/* Collimated HUD Glow effect filter */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,_transparent_60%,_rgba(0,0,0,0.4)_100%]" />

      {/* Top Header: Mode & Heading Ribbon */}
      <div className="absolute top-4 inset-x-0 flex flex-col items-center pointer-events-auto">
        <div className="flex items-center gap-4 px-3 py-1 rounded bg-black/60 backdrop-blur border border-emerald-500/40 text-xs">
          <span className="font-bold tracking-widest text-emerald-300">TACTICAL COMBAT HUD</span>
          <span className="text-emerald-500">|</span>
          <span>{plan.aircraft.name.toUpperCase()}</span>
          {onToggleHudMode && (
            <button
              onClick={onToggleHudMode}
              className="ml-2 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 text-emerald-300 text-[10px] tracking-wide transition-colors"
            >
              SWITCH TO AIRLINER PFD
            </button>
          )}
        </div>

        {/* Heading Scale Ribbon */}
        <div className="relative mt-2 w-80 h-10 border-b border-emerald-500/60 overflow-hidden flex justify-center items-end pb-1">
          <div className="absolute top-0 w-0.5 h-3 bg-emerald-400" />
          <div className="text-sm font-bold tracking-widest text-emerald-300 bg-black/50 px-1.5 rounded">
            {String(heading).padStart(3, '0')}°
          </div>
          <div className="absolute bottom-0 text-[10px] flex gap-8 text-emerald-500/70">
            <span>{((heading - 20 + 360) % 360).toString().padStart(3, '0')}</span>
            <span>{((heading - 10 + 360) % 360).toString().padStart(3, '0')}</span>
            <span className="text-emerald-300 font-bold">{heading.toString().padStart(3, '0')}</span>
            <span>{((heading + 10) % 360).toString().padStart(3, '0')}</span>
            <span>{((heading + 20) % 360).toString().padStart(3, '0')}</span>
          </div>
        </div>
      </div>

      {/* Left Column: Speed, Mach, AoA, G-Meter */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {/* Airspeed Box */}
        <div className="bg-black/60 border border-emerald-500/60 rounded px-3 py-2 w-28 text-right shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <div className="text-[10px] text-emerald-400/80">AIRSPEED</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-300">
            {Math.round(state.airspeedKnots)}
            <span className="text-xs ml-1 font-normal text-emerald-500">KTS</span>
          </div>
          <div className="text-xs text-emerald-400/80 mt-0.5">
            GS: <span className="font-semibold text-emerald-300">{Math.round(state.groundSpeedKnots)}</span>
          </div>
        </div>

        {/* Mach & G-Force */}
        <div className="bg-black/60 border border-emerald-500/60 rounded px-3 py-2 w-28 text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-emerald-400/70">MACH</span>
            <span className="font-bold text-emerald-300 text-sm">
              {state.mach >= 1.0 ? (
                <span className="text-amber-400 animate-pulse">M {state.mach.toFixed(2)}</span>
              ) : (
                `M ${state.mach.toFixed(2)}`
              )}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-400/70">G-LOAD</span>
            <span className={`font-bold ${state.gForce > 6.0 ? 'text-red-400 animate-pulse' : 'text-emerald-300'}`}>
              {state.gForce >= 0 ? `+${state.gForce.toFixed(1)}` : state.gForce.toFixed(1)}G
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-emerald-500">
            <span>MAX G</span>
            <span>+{state.maxGForce.toFixed(1)}G</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-emerald-500">
            <span>ALPHA α</span>
            <span>{state.angleOfWeekDeg.toFixed(1)}°</span>
          </div>
        </div>
      </div>

      {/* Right Column: Altitude, Radar Alt, Vertical Speed */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {/* Altitude Box */}
        <div className="bg-black/60 border border-emerald-500/60 rounded px-3 py-2 w-32 text-left shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <div className="text-[10px] text-emerald-400/80">ALTITUDE MSL</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-300">
            {Math.round(state.altitudeFt).toLocaleString()}
            <span className="text-xs ml-1 font-normal text-emerald-500">FT</span>
          </div>
          <div className="text-xs text-emerald-400/80 mt-0.5">
            R-ALT: <span className="font-semibold text-emerald-300">{Math.round(state.radioAltitudeFt)} FT</span>
          </div>
        </div>

        {/* Vertical Speed & Waypoint */}
        <div className="bg-black/60 border border-emerald-500/60 rounded px-3 py-2 w-32 text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-emerald-400/70">V/S</span>
            <span className="font-bold text-emerald-300">
              {state.verticalSpeedFpm >= 0 ? `+${Math.round(state.verticalSpeedFpm)}` : Math.round(state.verticalSpeedFpm)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-emerald-500">
            <span>DEST DIST</span>
            <span>{(state.distanceToDestinationM / 1852).toFixed(1)} NM</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-emerald-500">
            <span>BARO</span>
            <span>29.92 IN</span>
          </div>
        </div>
      </div>

      {/* Center Collimated HUD Display: Pitch Ladder, Boresight, Velocity Vector, Target Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Pitch & Roll Gimbal Frame */}
        <div
          className="relative w-96 h-96 transition-transform duration-75 ease-out"
          style={{
            transform: `rotate(${-rollDeg}deg) translateY(${pitchLadderOffsetPx}px)`,
          }}
        >
          {/* Horizon Line */}
          <div className="absolute top-1/2 inset-x-0 -translate-y-1/2 flex items-center justify-between">
            <div className="w-28 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <div className="text-[10px] tracking-widest text-emerald-300">00</div>
            <div className="w-28 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>

          {/* +10° Pitch Line */}
          <div className="absolute top-[calc(50%-120px)] inset-x-12 flex items-center justify-between">
            <div className="w-16 h-0.5 bg-emerald-400/70 border-l-2 border-emerald-400 h-2" />
            <span className="text-[10px] text-emerald-300">+10</span>
            <div className="w-16 h-0.5 bg-emerald-400/70 border-r-2 border-emerald-400 h-2" />
          </div>

          {/* +20° Pitch Line */}
          <div className="absolute top-[calc(50%-240px)] inset-x-16 flex items-center justify-between">
            <div className="w-12 h-0.5 bg-emerald-400/70 border-l-2 border-emerald-400 h-2" />
            <span className="text-[10px] text-emerald-300">+20</span>
            <div className="w-12 h-0.5 bg-emerald-400/70 border-r-2 border-emerald-400 h-2" />
          </div>

          {/* -10° Pitch Line (Dashed) */}
          <div className="absolute top-[calc(50%+120px)] inset-x-12 flex items-center justify-between">
            <div className="w-16 border-t-2 border-dashed border-emerald-400/70 border-l-2 h-2" />
            <span className="text-[10px] text-emerald-300">-10</span>
            <div className="w-16 border-t-2 border-dashed border-emerald-400/70 border-r-2 h-2" />
          </div>

          {/* -20° Pitch Line (Dashed) */}
          <div className="absolute top-[calc(50%+240px)] inset-x-16 flex items-center justify-between">
            <div className="w-12 border-t-2 border-dashed border-emerald-400/70 border-l-2 h-2" />
            <span className="text-[10px] text-emerald-300">-20</span>
            <div className="w-12 border-t-2 border-dashed border-emerald-400/70 border-r-2 h-2" />
          </div>
        </div>

        {/* Fixed Waterline Boresight Cross (-w-) */}
        <div className="absolute flex items-center justify-center text-emerald-300 text-lg font-bold drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]">
          <span className="w-6 h-0.5 bg-emerald-300 mr-1" />
          <span className="text-xs pb-0.5">∨</span>
          <span className="w-6 h-0.5 bg-emerald-300 ml-1" />
        </div>

        {/* Flight Path Marker (Velocity Vector -o-) */}
        <div
          className="absolute transition-transform duration-75 ease-out flex items-center justify-center drop-shadow-[0_0_8px_rgba(52,211,153,1)]"
          style={{
            transform: `translate(${fpmX}px, ${-fpmY}px)`,
          }}
        >
          <div className="w-4 h-0.5 bg-emerald-300 mr-0.5" />
          <div className="relative w-5 h-5 rounded-full border-2 border-emerald-300 flex items-center justify-center">
            <div className="w-0.5 h-1.5 bg-emerald-300 absolute -top-1.5" />
          </div>
          <div className="w-4 h-0.5 bg-emerald-300 ml-0.5" />
        </div>

        {/* Target Intercept Bracket / Radar Track (dimartarmizi reference) */}
        {drone && (
          <div
            className={`absolute flex flex-col items-center transition-transform duration-100 ease-out ${
              drone.locked ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]' : 'text-emerald-400'
            }`}
            style={{
              transform: `translate(${droneScreenX}px, -40px)`,
            }}
          >
            <div className="relative w-12 h-12 border-2 border-dashed border-current flex items-center justify-center">
              <Crosshair className="w-5 h-5 opacity-80" />
              {drone.locked && (
                <span className="absolute -top-5 text-[10px] font-black tracking-wider text-red-400 bg-black/80 px-1 rounded animate-pulse">
                  *LOCK*
                </span>
              )}
            </div>
            <div className="text-[10px] font-bold bg-black/70 px-1 mt-1 rounded border border-current">
              TGT {drone.distanceNm} NM
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Engine Afterburner & Countermeasures Status */}
      <div className="absolute bottom-6 inset-x-8 flex justify-between items-end pointer-events-auto">
        {/* Left Bottom: Thrust & Afterburner */}
        <div className="bg-black/70 border border-emerald-500/50 rounded-lg p-3 w-64 backdrop-blur">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-emerald-400/90 font-bold flex items-center gap-1.5">
              <Flame className={`w-4 h-4 ${isAfterburner ? 'text-orange-400 animate-pulse' : 'text-emerald-500'}`} />
              AFTERBURNER
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-black tracking-wider ${
                isAfterburner
                  ? 'bg-orange-500/30 text-orange-300 border border-orange-400/80 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-pulse'
                  : 'bg-emerald-950/60 text-emerald-500 border border-emerald-500/30'
              }`}
            >
              {isAfterburner ? 'ZONE 5 LIT' : 'DRY THRUST'}
            </span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-emerald-300">
              <span>THROTTLE</span>
              <span className="font-bold">{Math.round(state.throttle * 100)}%</span>
            </div>
            <div className="w-full bg-emerald-950/80 h-2 rounded overflow-hidden border border-emerald-500/40">
              <div
                className={`h-full transition-all duration-75 ${
                  isAfterburner ? 'bg-gradient-to-r from-emerald-400 via-orange-400 to-amber-300' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, state.throttle * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-emerald-400/80 pt-1">
              <span>TURBINE EGT</span>
              <span className={state.egt > 700 ? 'text-amber-300 font-bold' : ''}>{Math.round(state.egt)}°C</span>
            </div>
          </div>
        </div>

        {/* Center Bottom: Master Arm & Countermeasure Controls */}
        <div className="bg-black/70 border border-emerald-500/50 rounded-lg p-3 flex items-center gap-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-emerald-400/80 tracking-wide">FLARE DISPENSER</div>
              <div className="text-lg font-bold text-emerald-300">
                {flares} <span className="text-xs font-normal text-emerald-500">REMAINING</span>
              </div>
            </div>
          </div>

          {onDeployFlares && (
            <button
              id="deploy-flares-button"
              onClick={onDeployFlares}
              disabled={flares <= 0}
              className={`px-4 py-2 rounded font-bold text-xs tracking-wider transition-all shadow-md ${
                flares > 0
                  ? 'bg-amber-500/20 border border-amber-400 text-amber-300 hover:bg-amber-500/30 active:scale-95'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              }`}
            >
              DEPLOY FLARES [X]
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
