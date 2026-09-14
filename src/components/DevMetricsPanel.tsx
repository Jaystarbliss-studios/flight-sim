import React from 'react';
import { CameraMode, FlightState } from '../types';

interface DevMetricsPanelProps {
  fps: number;
  frameTimeMs: number;
  state: FlightState;
  cameraMode: CameraMode;
}

export const DevMetricsPanel: React.FC<DevMetricsPanelProps> = ({
  fps,
  frameTimeMs,
  state,
  cameraMode,
}) => {
  return (
    <div className="pointer-events-none absolute top-16 left-3 bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 shadow-2xl z-30 flex flex-col gap-1 w-64 select-none">
      <div className="flex justify-between items-center text-cyan-400 font-bold border-b border-slate-800 pb-1">
        <span>SIM TELEMETRY</span>
        <span>{fps} FPS ({frameTimeMs.toFixed(1)} ms)</span>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1">
        <div>IAS: <b className="text-white">{Math.round(state.airspeedKnots)} kt</b></div>
        <div>GS: <b className="text-white">{Math.round(state.groundSpeedKnots)} kt</b></div>
        <div>ALT: <b className="text-white">{Math.round(state.altitudeFt)} ft</b></div>
        <div>RAD ALT: <b className="text-white">{Math.round(state.radioAltitudeFt)} ft</b></div>
        <div>V/S: <b className="text-white">{Math.round(state.verticalSpeedFpm)} fpm</b></div>
        <div>MACH: <b className="text-white">{state.mach.toFixed(2)}</b></div>
        <div>PITCH: <b className="text-white">{((state.pitch * 180) / Math.PI).toFixed(1)}°</b></div>
        <div>ROLL: <b className="text-white">{((state.roll * 180) / Math.PI).toFixed(1)}°</b></div>
        <div>HDG: <b className="text-white">{Math.round(state.headingDeg)}°</b></div>
        <div>AoA: <b className="text-white">{state.angleOfWeekDeg.toFixed(1)}°</b></div>
        <div>G-FORCE: <b className="text-white">{state.gForce.toFixed(2)} G</b></div>
        <div>N1 RPM: <b className="text-white">{state.n1.toFixed(1)}%</b></div>
        <div>PHASE: <b className="text-emerald-400 uppercase">{state.phase}</b></div>
        <div>CAM: <b className="text-amber-400 uppercase">{cameraMode}</b></div>
      </div>
    </div>
  );
};
