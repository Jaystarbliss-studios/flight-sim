import React, { useMemo } from 'react';
import { FlightState } from '../types';

type Props = { state: FlightState };

export function FlightVisualOverlay({ state }: Props) {
  const bank = state.roll;
  const pitch = state.pitch;
  const speed = state.airspeedKnots;
  const altitude = state.altitudeMeters;
  const intensity = useMemo(() => Math.min(1, Math.max(0, (speed - 80) / 180)), [speed]);

  const horizonTransform = `translate(-50%, -50%) rotate(${bank * 57.2958}deg) translateY(${pitch * 170}px)`;
  const speedBlur = `${Math.round(intensity * 7)}px`;
  const vignetteOpacity = state.phase === 'crashed' ? 0.72 : state.stallWarning ? 0.42 : 0.16;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <div
        className="absolute inset-[-10%] transition-opacity duration-300"
        style={{
          opacity: vignetteOpacity,
          background: 'radial-gradient(circle at center, transparent 38%, rgba(0,0,0,0.9) 100%)',
        }}
      />

      <div className="absolute inset-0" style={{ filter: `blur(${speedBlur})` }} />

      <div
        className="absolute left-1/2 top-1/2 w-[150vw] h-[2px] opacity-30"
        style={{ transform: horizonTransform, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent)' }}
      />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-28 h-16">
          <div className="absolute left-1/2 top-1/2 w-20 h-px -translate-x-1/2 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,.5)]" />
          <div className="absolute left-1/2 top-1/2 h-8 w-px -translate-y-1/2 bg-white/80" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/80" />
        </div>
      </div>

      <div className="absolute bottom-6 left-6 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[10px] tracking-widest text-white/65 backdrop-blur-sm">
        <div>AIRSPEED {Math.round(speed)} KT</div>
        <div>ALT {Math.round(altitude * 3.28084).toLocaleString()} FT</div>
        <div>VS {Math.round(state.verticalSpeedFpm).toLocaleString()} FPM</div>
      </div>

      {state.stallWarning && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs font-black tracking-[0.45em] text-red-300 animate-pulse">
          STALL
        </div>
      )}

      {state.terrainWarning && (
        <div className="absolute inset-x-0 bottom-28 text-center text-xs font-black tracking-[0.35em] text-amber-300 animate-pulse">
          TERRAIN — PULL UP
        </div>
      )}
    </div>
  );
}
