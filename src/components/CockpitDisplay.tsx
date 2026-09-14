import React, { useEffect, useRef } from 'react';
import { FlightPlan, FlightState } from '../types';

interface CockpitDisplayProps {
  state: FlightState;
  plan: FlightPlan;
  compact?: boolean;
}

export const CockpitDisplay: React.FC<CockpitDisplayProps> = ({ state, plan, compact = false }) => {
  const pfdCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw PFD onto HTML5 Canvas for ultra-smooth 60fps glass cockpit graphics
  useEffect(() => {
    const canvas = pfdCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // 1. Artificial Horizon (Attitude Indicator)
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 75, cy - 95, 150, 190);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(-state.roll);

    const pitchPixelsPerDegree = 3.6;
    const pitchOffset = (state.pitch * 180 / Math.PI) * pitchPixelsPerDegree;
    ctx.translate(0, pitchOffset);

    // Sky & Earth
    ctx.fillStyle = '#1e75b8'; // Blue sky
    ctx.fillRect(-300, -600, 600, 600);
    ctx.fillStyle = '#6b4f2c'; // Earth brown
    ctx.fillRect(-300, 0, 600, 600);

    // Horizon line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-150, 0);
    ctx.lineTo(150, 0);
    ctx.stroke();

    // Pitch ladder lines (±10°, ±20°, ±30°)
    ctx.font = '10px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    for (let deg = -40; deg <= 40; deg += 5) {
      if (deg === 0) continue;
      const yPos = -deg * pitchPixelsPerDegree;
      const lineLen = deg % 10 === 0 ? 32 : 16;
      ctx.beginPath();
      ctx.moveTo(-lineLen, yPos);
      ctx.lineTo(lineLen, yPos);
      ctx.stroke();
      if (deg % 10 === 0) {
        ctx.fillText(`${Math.abs(deg)}`, -lineLen - 12, yPos + 3);
        ctx.fillText(`${Math.abs(deg)}`, lineLen + 12, yPos + 3);
      }
    }

    ctx.restore();

    // 2. Fixed Aircraft Symbol (Yellow reticle in center)
    ctx.strokeStyle = '#facc15'; // yellow
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    // Left wing
    ctx.moveTo(cx - 36, cy);
    ctx.lineTo(cx - 14, cy);
    ctx.lineTo(cx - 14, cy + 6);
    // Right wing
    ctx.moveTo(cx + 36, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.lineTo(cx + 14, cy + 6);
    // Center pip
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);

    // Flight Director crossbars (magenta)
    if (state.flightDirector) {
      ctx.strokeStyle = '#e11d48'; // magenta
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 40, cy - 4);
      ctx.lineTo(cx + 40, cy - 4);
      ctx.moveTo(cx, cy - 40);
      ctx.lineTo(cx, cy + 40);
      ctx.stroke();
    }

    // 3. Airspeed Tape (Left side)
    const tapeX = cx - 75;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(tapeX - 44, cy - 95, 44, 190);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(tapeX - 44, cy - 95, 44, 190);

    const speedPixelPerKnot = 1.8;
    const currentSpeed = Math.round(state.airspeedKnots);

    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX - 44, cy - 95, 44, 190);
    ctx.clip();

    ctx.font = '11px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'right';
    for (let s = Math.floor((currentSpeed - 60) / 10) * 10; s <= currentSpeed + 60; s += 10) {
      if (s < 0) continue;
      const sy = cy - (s - currentSpeed) * speedPixelPerKnot;
      ctx.beginPath();
      ctx.moveTo(tapeX, sy);
      ctx.lineTo(tapeX - (s % 20 === 0 ? 12 : 7), sy);
      ctx.stroke();
      if (s % 20 === 0) {
        ctx.fillText(`${s}`, tapeX - 14, sy + 4);
      }
    }

    // Stall speed barber-pole (red band)
    const stallSpeed = state.flapsIndex > 2 ? plan.aircraft.stallSpeedFullFlapsKnots : plan.aircraft.stallSpeedCleanKnots;
    const stallTopY = cy - (stallSpeed - currentSpeed) * speedPixelPerKnot;
    if (stallTopY < cy + 95) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.fillRect(tapeX - 8, Math.max(cy - 95, stallTopY), 8, 200);
    }
    ctx.restore();

    // Current Speed Window Box
    ctx.fillStyle = '#020617';
    ctx.fillRect(tapeX - 46, cy - 14, 46, 28);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tapeX - 46, cy - 14, 46, 28);
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentSpeed}`, tapeX - 23, cy + 5);

    // 4. Altitude Tape (Right side)
    const altX = cx + 75;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(altX, cy - 95, 52, 190);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(altX, cy - 95, 52, 190);

    const currentAlt = Math.round(state.altitudeFt);
    const altPixelPer100Ft = 0.45;

    ctx.save();
    ctx.beginPath();
    ctx.rect(altX, cy - 95, 52, 190);
    ctx.clip();

    ctx.font = '10px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    for (let a = Math.floor((currentAlt - 500) / 100) * 100; a <= currentAlt + 500; a += 100) {
      if (a < 0) continue;
      const ay = cy - (a - currentAlt) * altPixelPer100Ft;
      ctx.beginPath();
      ctx.moveTo(altX, ay);
      ctx.lineTo(altX + (a % 500 === 0 ? 14 : 7), ay);
      ctx.stroke();
      if (a % 200 === 0) {
        ctx.fillText(`${a}`, altX + 16, ay + 3);
      }
    }
    ctx.restore();

    // Current Altitude Box
    ctx.fillStyle = '#020617';
    ctx.fillRect(altX, cy - 14, 52, 28);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(altX, cy - 14, 52, 28);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentAlt}`, altX + 26, cy + 5);

    // 5. Compass Heading Ribbon (Bottom)
    const compY = cy + 115;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(cx - 75, compY - 14, 150, 28);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(cx - 75, compY - 14, 150, 28);

    const heading = Math.round(state.headingDeg);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 75, compY - 14, 150, 28);
    ctx.clip();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    for (let hDeg = heading - 40; hDeg <= heading + 40; hDeg += 5) {
      const normH = ((hDeg % 360) + 360) % 360;
      const hx = cx + (hDeg - heading) * 3.5;
      ctx.beginPath();
      ctx.moveTo(hx, compY - 14);
      ctx.lineTo(hx, compY - (normH % 10 === 0 ? 4 : 8));
      ctx.stroke();
      if (normH % 10 === 0) {
        const label = normH === 0 ? 'N' : normH === 90 ? 'E' : normH === 180 ? 'S' : normH === 270 ? 'W' : `${normH / 10}`;
        ctx.fillText(label, hx, compY + 8);
      }
    }
    ctx.restore();

    // Center Heading Marker
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(cx, compY - 14);
    ctx.lineTo(cx - 5, compY - 20);
    ctx.lineTo(cx + 5, compY - 20);
    ctx.fill();

  }, [state, plan]);

  return (
    <div className={`flex flex-col bg-slate-950/90 backdrop-blur-md rounded-xl border border-slate-800 p-2.5 shadow-2xl text-white select-none ${compact ? 'scale-90' : ''}`}>
      {/* Top Annunciator Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-900/90 rounded border border-slate-800 text-[11px] font-mono mb-2">
        <span className={state.autopilotEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
          AP {state.autopilotEnabled ? 'ENG' : 'OFF'}
        </span>
        <span className={state.autoThrottleEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
          A/THR {state.autoThrottleEnabled ? 'ON' : 'OFF'}
        </span>
        <span className="text-cyan-400 font-bold">
          HDG {Math.round(state.targetHeadingDeg).toString().padStart(3, '0')}°
        </span>
        <span className="text-cyan-400 font-bold">
          ALT {Math.round(state.targetAltitudeFt)} FT
        </span>
        <span className={state.isStalled ? 'text-red-500 animate-pulse font-bold' : 'text-slate-500'}>
          {state.isStalled ? 'STALL' : 'NORMAL'}
        </span>
      </div>

      <div className="flex gap-2">
        {/* PFD Canvas */}
        <div className="relative rounded overflow-hidden border border-slate-800 bg-black">
          <canvas
            ref={pfdCanvasRef}
            width={290}
            height={270}
            className="block"
          />
          {/* Vertical Speed Digital Display */}
          <div className="absolute top-2 right-2 font-mono text-[10px] text-emerald-400 bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800">
            V/S: {Math.round(state.verticalSpeedFpm)} FPM
          </div>
          {/* Mach Number */}
          <div className="absolute bottom-2 left-2 font-mono text-[10px] text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800">
            M {state.mach.toFixed(2)}
          </div>
        </div>

        {/* EICAS & Engine Instruments */}
        <div className="flex flex-col justify-between w-44 bg-slate-900/80 rounded border border-slate-800 p-2 text-xs font-mono">
          {/* Engine 1 & 2 N1% Gauges */}
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
              Engines ({plan.aircraft.name.split(' ')[0]})
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">ENG 1</div>
                <div className="text-sm font-bold text-emerald-400">{state.n1.toFixed(1)}%</div>
                <div className="text-[9px] text-slate-400">N1 RPM</div>
                <div className="w-full bg-slate-800 h-1 rounded mt-1 overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, state.n1)}%` }} />
                </div>
              </div>
              <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">ENG 2</div>
                <div className="text-sm font-bold text-emerald-400">{state.n1.toFixed(1)}%</div>
                <div className="text-[9px] text-slate-400">N1 RPM</div>
                <div className="w-full bg-slate-800 h-1 rounded mt-1 overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, state.n1)}%` }} />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-300 mt-2 px-1">
              <span>EGT: <b className="text-amber-400">{Math.round(state.egt)}°C</b></span>
              <span>THR: <b className="text-cyan-400">{Math.round(state.actualThrust * 100)}%</b></span>
            </div>
          </div>

          {/* Flaps & Gear Status */}
          <div className="border-t border-slate-800 pt-1.5">
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-slate-400">FLAPS:</span>
              <span className="font-bold text-cyan-400">
                POS {state.flapsIndex} ({Math.round(state.flapsAngle)}°)
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-slate-400">GEAR:</span>
              <span className={`font-bold ${state.gearPosition > 0.9 ? 'text-emerald-400' : state.gearPosition < 0.1 ? 'text-slate-500' : 'text-amber-400 animate-pulse'}`}>
                {state.gearPosition > 0.9 ? 'DOWN & LOCKED' : state.gearPosition < 0.1 ? 'UP' : 'IN TRANSIT'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">SPOILERS:</span>
              <span className={state.spoilersDeployed ? 'font-bold text-amber-400' : 'text-slate-500'}>
                {state.spoilersDeployed ? 'DEPLOYED' : 'ARMED / RETRACT'}
              </span>
            </div>
          </div>

          {/* Fuel Remaining */}
          <div className="border-t border-slate-800 pt-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">FUEL FOB:</span>
              <span className="font-bold text-emerald-400">
                {Math.round(state.fuelRemainingKg)} KG
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded mt-1 overflow-hidden">
              <div
                className="bg-cyan-500 h-full"
                style={{ width: `${Math.max(0, (state.fuelRemainingKg / plan.aircraft.fuelCapacityKg) * 100)}%` }}
              />
            </div>
          </div>

          {/* G-Force & Radio Altitude */}
          <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-1">
            <span>G: <b className="text-slate-200">{state.gForce.toFixed(2)}</b></span>
            <span>RADIO ALT: <b className="text-cyan-300">{Math.round(state.radioAltitudeFt)} FT</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};
