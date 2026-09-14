import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraMode, FlightPhase, FlightPlan, FlightState, FlightSummary } from './types';
import { AIRPORTS } from './data/airports';
import { AIRCRAFTS } from './data/aircraft';
import { FlightPhysics } from './simulation/flightPhysics';
import { globalAudio } from './simulation/audioEngine';
import { AtcSystem, AtcMessage } from './simulation/atcSystem';
import { WorldRenderer } from './graphics/WorldRenderer';
import { CockpitDisplay } from './components/CockpitDisplay';
import { FlightControlsOverlay } from './components/FlightControlsOverlay';
import { FlightPhaseBar } from './components/FlightPhaseBar';
import { FlightResultModal } from './components/FlightResultModal';
import { FlightSetupModal } from './components/FlightSetupModal';
import { SettingsModal } from './components/SettingsModal';
import { DevMetricsPanel } from './components/DevMetricsPanel';
import { QuickTutorial } from './components/QuickTutorial';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const physicsRef = useRef<FlightPhysics | null>(null);
  const atcRef = useRef<AtcSystem>(new AtcSystem());

  // Default Flight Plan: Los Angeles (KLAX) to San Francisco (KSFO) on AeroSky A320neo
  // Default to Beginner assistance for smooth, forgiving stability
  const [flightPlan, setFlightPlan] = useState<FlightPlan>(() => ({
    aircraft: AIRCRAFTS[0],
    origin: AIRPORTS[0],
    destination: AIRPORTS[1],
    cruisingAltitudeFt: 30000,
    passengers: 142,
    maxPassengers: 180,
    cargoKg: 3800,
    fuelKg: 14000,
    weather: 'clear',
    timeOfDay: 'day',
    windSpeedKnots: 6,
    windDirectionDeg: 250,
    assistance: 'beginner',
  }));

  // Flight state ref for the 60fps render loop
  const stateRef = useRef<FlightState | null>(null);
  const [uiState, setUiState] = useState<FlightState | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  // Modals & Overlays
  const [showTutorial, setShowTutorial] = useState(true);
  const [showCockpitInstruments, setShowCockpitInstruments] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [flightSummary, setFlightSummary] = useState<FlightSummary | null>(null);

  // Sound & Sim Controls
  const [isMuted, setIsMuted] = useState(false);
  const [timeCompression, setTimeCompression] = useState(1);
  const [showDevMetrics, setShowDevMetrics] = useState(false);
  const [currentAtcMessage, setCurrentAtcMessage] = useState<AtcMessage | null>(null);

  // Performance Telemetry
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);

  // Mouse camera drag
  const isMouseDownRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Initialize Simulator
  const initSimulation = useCallback((plan: FlightPlan) => {
    const physics = new FlightPhysics(plan);
    physicsRef.current = physics;
    const initialRunwayAlt = plan.origin.runways[0]?.altitudeMeters || 38;
    const initialState = physics.initFlightState(initialRunwayAlt);
    stateRef.current = initialState;
    setUiState({ ...initialState });
    atcRef.current.reset();
    setFlightSummary(null);

    // Initial Clearance
    const initialAtc = atcRef.current.getTransmissionForPhase('takeoff_roll', plan);
    setCurrentAtcMessage(initialAtc);

    if (rendererRef.current) {
      rendererRef.current.setPlan(plan);
    }
  }, []);

  // Initialize 3D Engine
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const renderer = new WorldRenderer(container, flightPlan);
    rendererRef.current = renderer;
    initSimulation(flightPlan);

    // Mouse drag for camera orbit / cockpit view
    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName === 'CANVAS') {
        isMouseDownRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        globalAudio.init();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isMouseDownRef.current || !rendererRef.current) return;
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      rendererRef.current.rotateCamera(dx * 0.006, dy * 0.006);
    };

    const handlePointerUp = () => {
      isMouseDownRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (rendererRef.current) {
        rendererRef.current.zoomCamera(e.deltaY * 0.04);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('wheel', handleWheel, { passive: true });

    // Main Simulation and Animation Loop
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();
    let animId: number;

    const tick = (now: number) => {
      animId = requestAnimationFrame(tick);

      const deltaMs = now - lastTime;
      lastTime = now;
      const deltaSec = Math.min(deltaMs / 1000, 0.1);

      frameCount++;
      if (now - fpsTimer >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTimer)));
        setFrameTimeMs(deltaMs);
        frameCount = 0;
        fpsTimer = now;
      }

      if (!stateRef.current || !physicsRef.current || !rendererRef.current) return;

      const state = stateRef.current;
      state.timeCompression = timeCompression;

      // Ground elevation
      const groundElevationM = flightPlan.origin.runways[0]?.altitudeMeters || 38;
      const destX = flightPlan.destination.worldX;
      const destZ = flightPlan.destination.worldZ;

      // Step Physics
      physicsRef.current.update(state, deltaSec, groundElevationM, destX, destZ);

      // Update Audio Engine
      globalAudio.update(state);

      // Update 3D Graphics
      rendererRef.current.update(state, deltaSec);

      // Check ATC message for phase change
      const newAtc = atcRef.current.getTransmissionForPhase(state.phase, flightPlan);
      if (newAtc) {
        setCurrentAtcMessage(newAtc);
        globalAudio.playChime();
      }

      // Check for Flight Completion or Crash Result Modal
      if ((state.phase === 'gate_arrival' || state.phase === 'crashed') && !flightSummary) {
        const summary = physicsRef.current.getFlightSummary(state);
        setFlightSummary(summary);
      }

      // Sync state to UI (throttled)
      if (frameCount % 3 === 0) {
        setUiState({ ...state });
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('wheel', handleWheel);
      renderer.destroy();
    };
  }, [initSimulation, timeCompression]);

  // Handle Flight Control Events
  const handlePitchRoll = (pitch: number, roll: number) => {
    if (!stateRef.current) return;
    stateRef.current.pitchInput = pitch;
    stateRef.current.rollInput = roll;
  };

  const handleYaw = (yaw: number) => {
    if (!stateRef.current) return;
    stateRef.current.yawInput = yaw;
  };

  const handleThrottle = (val: number) => {
    if (!stateRef.current) return;
    stateRef.current.throttle = val;
    globalAudio.init();
  };

  const handleFullThrottle = () => {
    if (!stateRef.current) return;
    stateRef.current.throttle = 1.0;
    stateRef.current.parkingBrake = false;
    stateRef.current.enginesRunning = true;
    globalAudio.init();
    globalAudio.playChime();
  };

  const handleToggleGear = () => {
    if (!stateRef.current) return;
    stateRef.current.gearDown = !stateRef.current.gearDown;
    globalAudio.playChime();
  };

  const handleFlapsChange = (index: number) => {
    if (!stateRef.current) return;
    stateRef.current.flapsIndex = index;
    globalAudio.playChime();
  };

  const handleToggleSpoilers = () => {
    if (!stateRef.current) return;
    stateRef.current.spoilersDeployed = !stateRef.current.spoilersDeployed;
    globalAudio.playChime();
  };

  const handleToggleBrakes = (active: boolean) => {
    if (!stateRef.current) return;
    stateRef.current.brakesActive = active;
    if (active) stateRef.current.parkingBrake = false;
  };

  const handleToggleReverseThrust = () => {
    if (!stateRef.current) return;
    stateRef.current.reverseThrust = !stateRef.current.reverseThrust;
    globalAudio.playChime();
  };

  const handleToggleEngines = () => {
    if (!stateRef.current) return;
    stateRef.current.enginesRunning = !stateRef.current.enginesRunning;
    globalAudio.playChime();
  };

  const handleToggleAutopilot = () => {
    if (!stateRef.current) return;
    stateRef.current.autopilotEnabled = !stateRef.current.autopilotEnabled;
    stateRef.current.autoThrottleEnabled = stateRef.current.autopilotEnabled;
    globalAudio.playChime();
  };

  const handleCameraChange = (mode: CameraMode) => {
    setCameraMode(mode);
    if (rendererRef.current) {
      rendererRef.current.setCameraMode(mode);
    }
  };

  const handleToggleMute = () => {
    const muted = globalAudio.toggleMute();
    setIsMuted(muted);
  };

  const handleConfirmPlan = (newPlan: FlightPlan) => {
    setFlightPlan(newPlan);
    setShowSetupModal(false);
    initSimulation(newPlan);
  };

  const handleRestartFlight = () => {
    initSimulation(flightPlan);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
      {/* 3D WebGL Viewport (Clear, unblocked view of the aircraft and sky) */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Developer Sim Metrics Panel (Only when toggled ON in settings) */}
      {showDevMetrics && uiState && (
        <DevMetricsPanel
          fps={fps}
          frameTimeMs={frameTimeMs}
          state={uiState}
          cameraMode={cameraMode}
        />
      )}

      {/* Top Floating Sleek Flight Phase Status Pill */}
      {uiState && (
        <div className="absolute top-12 sm:top-14 inset-x-0 pointer-events-none flex flex-col items-center gap-1 z-20">
          <FlightPhaseBar
            state={uiState}
            plan={flightPlan}
            atcMessage={currentAtcMessage}
          />
        </div>
      )}

      {/* Interactive Quick Step-by-Step Pilot Tutorial */}
      {showTutorial && uiState && (
        <QuickTutorial
          state={uiState}
          onDismiss={() => setShowTutorial(false)}
          onFullThrottle={handleFullThrottle}
        />
      )}

      {/* Optional Cockpit Glass Display Panel (Only visible if user opens Avionics) */}
      {uiState && showCockpitInstruments && (
        <div className="absolute top-24 left-4 pointer-events-auto z-30 animate-in fade-in zoom-in-95">
          <div className="relative">
            <button
              onClick={() => setShowCockpitInstruments(false)}
              className="absolute -top-3 -right-3 z-40 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg"
              title="Close Avionics"
            >
              ✕
            </button>
            <CockpitDisplay state={uiState} plan={flightPlan} />
          </div>
        </div>
      )}

      {/* Minimalist Modern Flight Controls Overlay */}
      {uiState && (
        <FlightControlsOverlay
          state={uiState}
          plan={flightPlan}
          cameraMode={cameraMode}
          onCameraChange={handleCameraChange}
          onPitchRoll={handlePitchRoll}
          onYaw={handleYaw}
          onThrottle={handleThrottle}
          onToggleGear={handleToggleGear}
          onFlapsChange={handleFlapsChange}
          onToggleSpoilers={handleToggleSpoilers}
          onToggleBrakes={handleToggleBrakes}
          onToggleReverseThrust={handleToggleReverseThrust}
          onToggleEngines={handleToggleEngines}
          onToggleAutopilot={handleToggleAutopilot}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          onOpenSettings={() => setShowSettingsModal(true)}
          onResetFlight={handleRestartFlight}
          onOpenTutorial={() => setShowTutorial(true)}
          timeCompression={timeCompression}
          onSetTimeCompression={setTimeCompression}
          showCockpitInstruments={showCockpitInstruments}
          onToggleCockpitInstruments={() => setShowCockpitInstruments(!showCockpitInstruments)}
        />
      )}

      {/* Flight Setup & Dispatch Modal */}
      {showSetupModal && (
        <FlightSetupModal
          currentPlan={flightPlan}
          onConfirmPlan={handleConfirmPlan}
          onClose={() => setShowSetupModal(false)}
        />
      )}

      {/* Simulator Settings & Keybindings Modal */}
      {showSettingsModal && (
        <SettingsModal
          assistance={flightPlan.assistance}
          onSetAssistance={(lvl) => setFlightPlan({ ...flightPlan, assistance: lvl })}
          showDevMetrics={showDevMetrics}
          onToggleDevMetrics={() => setShowDevMetrics(!showDevMetrics)}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Flight Results / Incident Modal */}
      {flightSummary && (
        <FlightResultModal
          summary={flightSummary}
          onRestart={handleRestartFlight}
          onClose={() => setFlightSummary(null)}
        />
      )}
    </div>
  );
}
