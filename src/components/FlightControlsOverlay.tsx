import React, { useRef, useState, useEffect } from 'react';
import { CameraMode, FlightPlan, FlightState } from '../types';
import {
  Volume2,
  VolumeX,
  Camera,
  RotateCcw,
  Sliders,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Gauge,
  Compass,
} from 'lucide-react';

interface FlightControlsOverlayProps {
  state: FlightState;
  plan: FlightPlan;
  cameraMode: CameraMode;
  onCameraChange: (mode: CameraMode) => void;
  onPitchRoll: (pitch: number, roll: number) => void;
  onYaw: (yaw: number) => void;
  onThrottle: (throttle: number) => void;
  onToggleGear: () => void;
  onFlapsChange: (index: number) => void;
  onToggleSpoilers: () => void;
  onToggleBrakes: (active: boolean) => void;
  onToggleReverseThrust: () => void;
  onToggleEngines: () => void;
  onToggleAutopilot: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onOpenSettings: () => void;
  onResetFlight: () => void;
  onOpenTutorial: () => void;
  timeCompression: number;
  onSetTimeCompression: (tc: number) => void;
  showCockpitInstruments: boolean;
  onToggleCockpitInstruments: () => void;
}

export const FlightControlsOverlay: React.FC<FlightControlsOverlayProps> = ({
  state,
  plan,
  cameraMode,
  onCameraChange,
  onPitchRoll,
  onYaw,
  onThrottle,
  onToggleGear,
  onFlapsChange,
  onToggleSpoilers,
  onToggleBrakes,
  onToggleReverseThrust,
  onToggleEngines,
  onToggleAutopilot,
  onToggleMute,
  isMuted,
  onOpenSettings,
  onResetFlight,
  onOpenTutorial,
  timeCompression,
  onSetTimeCompression,
  showCockpitInstruments,
  onToggleCockpitInstruments,
}) => {
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const joystickRef = useRef<HTMLDivElement | null>(null);

  // Virtual Joystick touch/pointer handlers
  const handleJoystickPointerDown = (e: React.PointerEvent) => {
    setIsDraggingJoystick(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingJoystick) return;
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = () => {
    setIsDraggingJoystick(false);
    setJoystickPos({ x: 0, y: 0 });
    onPitchRoll(0, 0);
    onYaw(0);
    // If was braking on ground via stick, release brake
    if (state.radioAltitudeFt < 15) {
      onToggleBrakes(false);
    }
  };

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 12;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: dx, y: dy });

    // Normalize:
    // X: Steer / Roll (-1 left to +1 right)
    // Y: Up is negative dy, Down is positive dy
    // Pushing stick UP (-dy > 0) = Fly UP (pitch +1)
    // Pushing stick DOWN (dy > 0) = Fly DOWN / Brake on ground
    const normRoll = dx / maxRadius;
    const normPitch = -dy / maxRadius; // Up is positive pitch (Fly UP!)

    onPitchRoll(normPitch, normRoll);
    onYaw(normRoll * 0.75); // Steer nosewheel on ground & rudder in flight

    // If on ground and dragging stick DOWN (dy > 0.3 * maxRadius), apply brakes!
    if (state.radioAltitudeFt < 15) {
      if (dy > 0.3 * maxRadius) {
        onToggleBrakes(true);
      } else {
        onToggleBrakes(false);
      }
    }
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ': // Spacebar for instant 100% takeoff throttle
          e.preventDefault();
          onThrottle(state.throttle > 0.5 ? 0.0 : 1.0);
          break;
        case 'w':
        case 'arrowup':
          e.preventDefault();
          // If on runway and throttle not full, also advance throttle
          if (state.radioAltitudeFt < 15 && state.throttle < 0.95) {
            onThrottle(Math.min(1.0, state.throttle + 0.25));
          }
          // Fly UP / Pitch UP!
          onPitchRoll(1.0, state.rollInput);
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          // On ground: S / Down Arrow acts as brake and cuts throttle!
          if (state.radioAltitudeFt < 15) {
            onToggleBrakes(true);
            onThrottle(Math.max(0.0, state.throttle - 0.25));
          } else {
            // In air: Fly DOWN / Pitch DOWN
            onPitchRoll(-1.0, state.rollInput);
          }
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          onPitchRoll(state.pitchInput, -1.0); // Bank left
          onYaw(-1.0); // Steer left
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          onPitchRoll(state.pitchInput, 1.0); // Bank right
          onYaw(1.0); // Steer right
          break;
        case 'q':
          onYaw(-1.0);
          break;
        case 'e':
          onYaw(1.0);
          break;
        case 'shift':
          onThrottle(Math.min(1.0, state.throttle + 0.15));
          break;
        case 'control':
          onThrottle(Math.max(0.0, state.throttle - 0.15));
          break;
        case 'g':
          onToggleGear();
          break;
        case 'f':
          onFlapsChange(Math.min(4, state.flapsIndex + 1));
          break;
        case 'v':
          onFlapsChange(Math.max(0, state.flapsIndex - 1));
          break;
        case 'b':
          e.preventDefault();
          onToggleBrakes(true);
          break;
        case '/':
          onToggleSpoilers();
          break;
        case 'c': {
          const modes: CameraMode[] = ['chase', 'cockpit', 'wing', 'gear'];
          const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
          onCameraChange(modes[nextIdx]);
          break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          onPitchRoll(0, state.rollInput);
          break;
        case 's':
        case 'arrowdown':
          if (state.radioAltitudeFt < 15) {
            onToggleBrakes(false);
          }
          onPitchRoll(0, state.rollInput);
          break;
        case 'a':
        case 'd':
        case 'arrowleft':
        case 'arrowright':
          onPitchRoll(state.pitchInput, 0);
          onYaw(0);
          break;
        case 'q':
        case 'e':
          onYaw(0);
          break;
        case 'b':
          onToggleBrakes(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state, cameraMode]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 select-none">
      {/* 1. Ultra-clean Minimalist Top Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-2">
        {/* Left: Quick Aircraft Badge & Tutorial Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 text-white shadow-lg">
            <span className="font-black text-xs text-cyan-400">AIRPLANE SIMULATOR</span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              {plan.aircraft.name}
            </span>
          </div>

          <button
            onClick={onOpenTutorial}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/90 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-full shadow-lg text-xs transition-all animate-pulse"
            title="Open Quick Tutorial"
          >
            <HelpCircle className="w-4 h-4 fill-current" />
            <span>How to Fly</span>
          </button>
        </div>

        {/* Right: Quick Controls: Camera, Audio, Reset, Settings */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md px-2 py-1 rounded-full border border-slate-700/60 text-white shadow-lg">
          {/* Camera Cycle */}
          <button
            onClick={() => {
              const modes: CameraMode[] = ['chase', 'cockpit', 'wing', 'gear'];
              const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
              onCameraChange(modes[nextIdx]);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-xs font-mono capitalize transition-colors"
            title="Switch Camera (Press C)"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>{cameraMode}</span>
          </button>

          {/* Toggle Full Cockpit Glass Display */}
          <button
            onClick={onToggleCockpitInstruments}
            className={`px-2 py-1 rounded-full text-xs font-mono transition-colors flex items-center gap-1 ${
              showCockpitInstruments
                ? 'bg-cyan-600 text-white font-bold'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
            title="Toggle Cockpit PFD/EICAS Panels"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Avionics</span>
          </button>

          {/* Sound Mute */}
          <button
            onClick={onToggleMute}
            className={`p-1.5 rounded-full transition-colors ${
              isMuted ? 'text-red-400 bg-red-950/50' : 'text-slate-300 hover:text-white bg-slate-800/80'
            }`}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Reset */}
          <button
            onClick={onResetFlight}
            className="p-1.5 rounded-full bg-slate-800/80 text-slate-300 hover:text-white transition-colors"
            title="Reset Flight"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-full bg-slate-800/80 text-slate-300 hover:text-white transition-colors"
            title="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Floating Sleek Aviation HUD Tapes (Zero View Obstruction) */}
      <div className="pointer-events-none flex justify-between items-center px-2 my-auto">
        {/* Airspeed Gauge Badge (Left Edge) */}
        <div className="flex flex-col items-center bg-slate-950/60 backdrop-blur-md p-2 rounded-xl border border-slate-700/50 text-white shadow-xl">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">SPEED</span>
          <span className={`text-2xl font-black font-mono ${state.airspeedKnots >= 136 ? 'text-emerald-400 animate-pulse' : 'text-cyan-300'}`}>
            {Math.round(state.airspeedKnots)}
          </span>
          <span className="text-[9px] font-mono text-slate-400">KNOTS</span>
          {state.airspeedKnots >= 136 && state.radioAltitudeFt < 20 && (
            <span className="mt-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500 animate-bounce">
              READY TO FLY!
            </span>
          )}
        </div>

        {/* Center Prominent Takeoff Notice (When 136+ knots is hit on the runway) */}
        {state.radioAltitudeFt < 25 && state.airspeedKnots >= 136 && (
          <div className="pointer-events-none px-5 py-3 rounded-2xl bg-emerald-600/95 border-2 border-emerald-300 text-white shadow-[0_0_35px_rgba(16,185,129,0.85)] flex flex-col items-center animate-pulse">
            <div className="text-base sm:text-lg font-black tracking-wide uppercase flex items-center gap-2">
              <span>🚀</span> 136+ KNOTS REACHED! FLY UP NOW! <span>🚀</span>
            </div>
            <div className="text-xs font-semibold bg-black/40 px-3 py-1 rounded-lg mt-1 text-emerald-100 flex items-center gap-1.5">
              <span>Press</span>
              <kbd className="bg-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-white border border-emerald-400">W</kbd>
              <span>or</span>
              <kbd className="bg-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-white border border-emerald-400">↑ UP ARROW</kbd>
              <span>(or push stick UP) to take off!</span>
            </div>
          </div>
        )}

        {/* Center Progress when rolling down runway before 136 knots */}
        {state.radioAltitudeFt < 25 && state.airspeedKnots < 136 && (
          <div className="pointer-events-none px-4 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/70 text-white shadow-xl flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-400">RUNWAY SPEED:</span>
              <span className={`font-bold ${state.airspeedKnots >= 100 ? 'text-amber-400' : 'text-cyan-300'}`}>
                {Math.round(state.airspeedKnots)}
              </span>
              <span className="text-slate-400">/ 136 KTS (Need 136+ to fly)</span>
            </div>
            <div className="text-[10px] text-slate-300">
              Hold <span className="text-cyan-300 font-bold">[W]</span> or <span className="text-cyan-300 font-bold">[Shift]</span> for 100% power • <span className="text-red-300 font-bold">[B]</span> to brake
            </div>
          </div>
        )}

        {/* Altitude & Heading Badge (Right Edge) */}
        <div className="flex flex-col items-center bg-slate-950/60 backdrop-blur-md p-2 rounded-xl border border-slate-700/50 text-white shadow-xl">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">ALTITUDE</span>
          <span className="text-2xl font-black font-mono text-emerald-400">
            {Math.round(state.altitudeFt)}
          </span>
          <span className="text-[9px] font-mono text-slate-400">FEET</span>
          <span className="text-[10px] font-mono text-slate-400 mt-0.5">
            HDG {Math.round(state.headingDeg).toString().padStart(3, '0')}°
          </span>
        </div>
      </div>

      {/* 3. Non-Intrusive Bottom Controls */}
      <div className="pointer-events-auto flex items-end justify-between gap-2">
        {/* Left: Compact Throttle & Power Buttons */}
        <div className="flex flex-col items-center bg-slate-950/70 backdrop-blur-md p-2 rounded-2xl border border-slate-700/60 shadow-2xl text-white">
          <span className="text-[10px] font-mono text-slate-300 font-bold">
            POWER {Math.round(state.throttle * 100)}%
          </span>

          {/* Quick 100% Throttle / Full Power Button */}
          <button
            onClick={() => onThrottle(1.0)}
            className={`w-full my-1 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
              state.throttle >= 0.95
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40 shadow'
                : 'bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60'
            }`}
          >
            100% TAKEOFF
          </button>

          {/* Smooth Vertical Throttle Slider */}
          <div className="relative h-28 w-9 bg-slate-900 rounded-lg border border-slate-700/80 flex flex-col justify-end p-0.5 shadow-inner">
            <div
              className="w-full rounded bg-gradient-to-t from-cyan-600 to-emerald-500 transition-all duration-75"
              style={{ height: `${Math.max(6, state.throttle * 100)}%` }}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(state.throttle * 100)}
              onChange={(e) => onThrottle(Number(e.target.value) / 100)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Throttle (Shift to increase, Ctrl to decrease)"
            />
          </div>

          {/* Idle (0%) Button */}
          <button
            onClick={() => onThrottle(0.0)}
            className="w-full mt-1 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white bg-slate-900/90"
          >
            IDLE (0%)
          </button>
        </div>

        {/* Center: Simplified Main Action Buttons */}
        <div className="flex flex-col items-center gap-1.5">
          {/* Advanced Controls Dropdown (Hidden by default to avoid clutter) */}
          {showAdvancedControls && (
            <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 text-xs font-mono shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={onToggleAutopilot}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                  state.autopilotEnabled
                    ? 'bg-cyan-600 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                AP {state.autopilotEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={onToggleReverseThrust}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                  state.reverseThrust
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                REV THRUST
              </button>
              <button
                onClick={onToggleSpoilers}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                  state.spoilersDeployed
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                SPOILERS (/)
              </button>
              <button
                onClick={onToggleEngines}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                  state.enginesRunning
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-red-950 border-red-500 text-red-300'
                }`}
              >
                ENG {state.enginesRunning ? 'RUN' : 'OFF'}
              </button>
            </div>
          )}

          {/* Primary Quick Controls: Gear, Flaps, Brake, Advanced Toggle */}
          <div className="flex items-center gap-2 bg-slate-950/75 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/60 shadow-xl text-white">
            {/* Landing Gear */}
            <button
              onClick={onToggleGear}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${
                state.gearDown
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm'
                  : 'bg-slate-900/90 border-slate-700 text-slate-400'
              }`}
              title="Toggle Landing Gear (G)"
            >
              GEAR: {state.gearDown ? 'DOWN' : 'UP'}
            </button>

            {/* Flaps */}
            <button
              onClick={() => onFlapsChange((state.flapsIndex + 1) % 5)}
              className="px-3 py-1.5 rounded-xl font-mono text-xs font-bold bg-slate-900/90 border border-slate-700 text-cyan-300 hover:border-cyan-500 transition-all"
              title="Flaps (F to extend, V to retract)"
            >
              FLAPS: POS {state.flapsIndex}
            </button>

            {/* Brakes */}
            <button
              onClick={() => onToggleBrakes(!state.brakesActive)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${
                state.brakesActive
                  ? 'bg-red-700 border-red-500 text-white'
                  : 'bg-slate-900/90 border-slate-700 text-slate-400'
              }`}
              title="Hold or Tap Brake (B)"
            >
              BRAKE (B)
            </button>

            {/* Toggle Advanced Controls */}
            <button
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white text-[11px] font-mono transition-colors"
              title="Toggle Advanced Aircraft Controls"
            >
              {showAdvancedControls ? 'Less' : 'More...'}
            </button>
          </div>
        </div>

        {/* Right: Floating Semi-Transparent Virtual Flight Stick */}
        <div className="flex flex-col items-center bg-slate-950/70 backdrop-blur-md p-2 rounded-2xl border border-slate-700/60 shadow-2xl text-white">
          <span className="text-[10px] font-mono text-slate-300 font-bold uppercase mb-1">
            FLIGHT STICK / STEERING
          </span>

          <div
            ref={joystickRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className="relative w-32 h-32 rounded-full bg-slate-900/85 border-2 border-slate-700 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none shadow-inner select-none"
          >
            {/* Direction Labels */}
            <span className="absolute top-1 text-[9px] font-mono font-bold text-emerald-400">
              FLY UP ▲
            </span>
            <span className="absolute bottom-1 text-[9px] font-mono font-bold text-amber-400">
              ▼ {state.radioAltitudeFt < 15 ? 'BRAKE' : 'DOWN'}
            </span>
            <span className="absolute left-1.5 text-[9px] font-mono font-bold text-cyan-400">
              ◄ L
            </span>
            <span className="absolute right-1.5 text-[9px] font-mono font-bold text-cyan-400">
              R ►
            </span>

            {/* Guide crosshairs */}
            <div className="absolute inset-x-3 h-px bg-slate-800 pointer-events-none" />
            <div className="absolute inset-y-3 w-px bg-slate-800 pointer-events-none" />

            {/* Knob */}
            <div
              className="absolute w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 border-2 border-cyan-300 shadow-md flex items-center justify-center text-[10px] font-black text-white pointer-events-none"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                transition: isDraggingJoystick ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              STICK
            </div>
          </div>

          <div className="text-[9px] font-mono text-slate-400 mt-1 text-center max-w-[150px] leading-tight">
            {state.radioAltitudeFt < 15
              ? 'Push UP to fly up at 136+ kts • DOWN to brake'
              : 'UP/DOWN pitch • LEFT/RIGHT turn'}
          </div>
        </div>
      </div>
    </div>
  );
};
