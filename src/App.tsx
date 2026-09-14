import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraMode, FlightPlan, FlightState, FlightSummary } from './types';
import { AIRPORTS } from './data/airports';
import { AIRCRAFTS } from './data/aircraft';
import { FlightPhysics } from './simulation/flightPhysics';
import { globalAudio } from './simulation/audioEngine';
import { AtcSystem, AtcMessage } from './simulation/atcSystem';
import { CompleteSimulationSystems } from './simulation/completeSystems';
import { WorldRenderer } from './graphics/WorldRenderer';
import { CockpitDisplay } from './components/CockpitDisplay';
import { FlightControlsOverlay } from './components/FlightControlsOverlay';
import { FlightPhaseBar } from './components/FlightPhaseBar';
import { FlightResultModal } from './components/FlightResultModal';
import { FlightSetupModal } from './components/FlightSetupModal';
import { HangarModal, VisualModel, readHangarPreference } from './components/HangarModal';
import { SettingsModal } from './components/SettingsModal';
import { DevMetricsPanel } from './components/DevMetricsPanel';
import { QuickTutorial } from './components/QuickTutorial';
import { FlightVisualOverlay } from './components/FlightVisualOverlay';
import { SimulationSystemsPanel } from './components/SimulationSystemsPanel';
import { SimulationClock } from './core/SimulationClock';
import { KeyboardFlightControls } from './controls/KeyboardFlightControls';
import { Plane, Radar } from 'lucide-react';

const aircraftCapacity = (id: string) => id === 'b777' ? 396 : id === 'e195' ? 146 : 180;

function initialPlan(): FlightPlan {
  const pref = readHangarPreference();
  const aircraft = AIRCRAFTS.find((a) => a.id === pref?.aircraftId) ?? AIRCRAFTS[0];
  const maxPassengers = aircraftCapacity(aircraft.id);
  const passengers = Math.min(142, maxPassengers);
  const fuelKg = Math.min(14000, aircraft.fuelCapacityKg);
  const cargoKg = Math.max(0, Math.min(3800, aircraft.maxTakeoffWeightKg - aircraft.emptyWeightKg - fuelKg - passengers * 85));
  return { aircraft, origin: AIRPORTS[0], destination: AIRPORTS[0], cruisingAltitudeFt: aircraft.id === 'b777' ? 35000 : 33000, passengers, maxPassengers, cargoKg, fuelKg, weather: 'clear', timeOfDay: 'day', windSpeedKnots: 6, windDirectionDeg: 250, assistance: 'beginner' };
}

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const physicsRef = useRef<FlightPhysics | null>(null);
  const systemsRef = useRef<CompleteSimulationSystems | null>(null);
  const atcRef = useRef<AtcSystem>(new AtcSystem());
  const simulationClockRef = useRef(new SimulationClock({ stepSeconds: 1 / 60, maxFrameSeconds: 0.1, maxStepsPerFrame: 8 }));
  const timeCompressionRef = useRef(1);
  const visualModelRef = useRef<VisualModel>(readHangarPreference()?.visualModel ?? 'procedural');
  const [flightPlan, setFlightPlan] = useState<FlightPlan>(() => initialPlan());
  const flightPlanRef = useRef<FlightPlan>(flightPlan);
  const [uiState, setUiState] = useState<FlightState | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [showTutorial, setShowTutorial] = useState(true);
  const [showCockpitInstruments, setShowCockpitInstruments] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showHangarModal, setShowHangarModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSystemsPanel, setShowSystemsPanel] = useState(false);
  const [flightSummary, setFlightSummary] = useState<FlightSummary | null>(null);
  const flightSummaryRef = useRef<FlightSummary | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [timeCompression, setTimeCompression] = useState(1);
  const [showDevMetrics, setShowDevMetrics] = useState(false);
  const [currentAtcMessage, setCurrentAtcMessage] = useState<AtcMessage | null>(null);
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);
  const [visualModel, setVisualModel] = useState<VisualModel>(visualModelRef.current);
  const isMouseDownRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const applyVisualModel = useCallback((model: VisualModel) => {
    visualModelRef.current = model;
    setVisualModel(model);
    const renderer = rendererRef.current as unknown as { externalAircraftGroup?: { visible: boolean }; fallbackAircraft?: { visible: boolean } } | null;
    if (renderer?.externalAircraftGroup) renderer.externalAircraftGroup.visible = model === 'detailed';
    if (renderer?.fallbackAircraft) renderer.fallbackAircraft.visible = model !== 'detailed';
  }, []);

  const initSimulation = useCallback((plan: FlightPlan) => {
    flightPlanRef.current = plan;
    const physics = new FlightPhysics(plan);
    physicsRef.current = physics;
    systemsRef.current = new CompleteSimulationSystems(plan);
    const initialRunwayAlt = plan.origin.runways[0]?.altitudeMeters || 38;
    const initialState = physics.initFlightState(initialRunwayAlt);
    stateRef.current = initialState;
    simulationClockRef.current.reset();
    timeCompressionRef.current = 1;
    flightSummaryRef.current = null;
    setTimeCompression(1);
    setUiState({ ...initialState });
    setFlightSummary(null);
    atcRef.current.reset();
    setCurrentAtcMessage(atcRef.current.getTransmissionForPhase('takeoff_roll', plan));
    rendererRef.current?.setPlan(plan);
  }, []);

  const stateRef = useRef<FlightState | null>(null);
  useEffect(() => { timeCompressionRef.current = timeCompression; }, [timeCompression]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const renderer = new WorldRenderer(container, flightPlanRef.current);
    rendererRef.current = renderer;
    initSimulation(flightPlanRef.current);
    applyVisualModel(visualModelRef.current);

    const handlePointerDown = (e: PointerEvent) => { if ((e.target as HTMLElement).tagName === 'CANVAS') { isMouseDownRef.current = true; lastMousePosRef.current = { x: e.clientX, y: e.clientY }; globalAudio.init(); } };
    const handlePointerMove = (e: PointerEvent) => { if (!isMouseDownRef.current || !rendererRef.current) return; const dx = e.clientX - lastMousePosRef.current.x, dy = e.clientY - lastMousePosRef.current.y; lastMousePosRef.current = { x: e.clientX, y: e.clientY }; rendererRef.current.rotateCamera(dx * 0.006, dy * 0.006); };
    const handlePointerUp = () => { isMouseDownRef.current = false; };
    const handleWheel = (e: WheelEvent) => rendererRef.current?.zoomCamera(e.deltaY * 0.04);
    window.addEventListener('pointerdown', handlePointerDown); window.addEventListener('pointermove', handlePointerMove); window.addEventListener('pointerup', handlePointerUp); window.addEventListener('wheel', handleWheel, { passive: true });
    const keyboard = new KeyboardFlightControls(() => stateRef.current, (mode) => handleCameraChange(mode)); keyboard.attach();
    let lastTime = performance.now(), frameCount = 0, fpsTimer = performance.now(), animId: number;

    const tick = (now: number) => {
      animId = requestAnimationFrame(tick);
      const deltaMs = now - lastTime; lastTime = now; const deltaSec = Math.min(deltaMs / 1000, 0.1); frameCount++;
      if (now - fpsTimer >= 500) { setFps(Math.round((frameCount * 1000) / (now - fpsTimer))); setFrameTimeMs(deltaMs); frameCount = 0; fpsTimer = now; }
      if (!stateRef.current || !physicsRef.current || !rendererRef.current) return;
      const state = stateRef.current, plan = flightPlanRef.current; state.timeCompression = timeCompressionRef.current;
      const rendererInternals = rendererRef.current as unknown as { externalAircraftGroup?: { visible: boolean }; fallbackAircraft?: { visible: boolean } };
      if (rendererInternals.externalAircraftGroup) rendererInternals.externalAircraftGroup.visible = visualModelRef.current === 'detailed' && plan.aircraft.id === 'a320';
      if (rendererInternals.fallbackAircraft) rendererInternals.fallbackAircraft.visible = !(visualModelRef.current === 'detailed' && plan.aircraft.id === 'a320');
      simulationClockRef.current.advance(deltaSec, (fixedDt) => { if (stateRef.current && physicsRef.current) physicsRef.current.update(stateRef.current, fixedDt, flightPlanRef.current.origin.runways[0]?.altitudeMeters || 38, flightPlanRef.current.destination.worldX, flightPlanRef.current.destination.worldZ); });
      systemsRef.current?.update(state, deltaSec, deltaMs);
      globalAudio.update(state); rendererRef.current.update(state, deltaSec);
      const newAtc = atcRef.current.getTransmissionForPhase(state.phase, plan); if (newAtc) { setCurrentAtcMessage(newAtc); globalAudio.playChime(); }
      if ((state.phase === 'gate_arrival' || state.phase === 'crashed') && !flightSummaryRef.current) { const summary = physicsRef.current.getFlightSummary(state); flightSummaryRef.current = summary; setFlightSummary(summary); systemsRef.current?.career.completeLanding(plan.origin.code, plan.destination.code, state.touchdownFpm); }
      if (frameCount % 3 === 0) setUiState({ ...state });
    };
    animId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animId); keyboard.detach(); window.removeEventListener('pointerdown', handlePointerDown); window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('wheel', handleWheel); renderer.destroy(); };
  }, [initSimulation, applyVisualModel]);

  const handlePitchRoll = (pitch: number, roll: number) => { if (stateRef.current) { stateRef.current.pitchInput = pitch; stateRef.current.rollInput = roll; } };
  const handleYaw = (yaw: number) => { if (stateRef.current) stateRef.current.yawInput = yaw; };
  const handleThrottle = (val: number) => { if (stateRef.current) { stateRef.current.throttle = val; globalAudio.init(); } };
  const handleFullThrottle = () => { if (!stateRef.current) return; stateRef.current.throttle = 1; stateRef.current.parkingBrake = false; stateRef.current.enginesRunning = true; globalAudio.init(); globalAudio.playChime(); };
  const handleToggleGear = () => { if (stateRef.current) { stateRef.current.gearDown = !stateRef.current.gearDown; globalAudio.playChime(); } };
  const handleFlapsChange = (index: number) => { if (stateRef.current) { stateRef.current.flapsIndex = index; globalAudio.playChime(); } };
  const handleToggleSpoilers = () => { if (stateRef.current) { stateRef.current.spoilersDeployed = !stateRef.current.spoilersDeployed; globalAudio.playChime(); } };
  const handleToggleBrakes = (active: boolean) => { if (stateRef.current) { stateRef.current.brakesActive = active; if (active) stateRef.current.parkingBrake = false; } };
  const handleToggleReverseThrust = () => { if (stateRef.current) { stateRef.current.reverseThrust = !stateRef.current.reverseThrust; globalAudio.playChime(); } };
  const handleToggleEngines = () => { if (stateRef.current) { stateRef.current.enginesRunning = !stateRef.current.enginesRunning; globalAudio.playChime(); } };
  const handleToggleAutopilot = () => { if (!stateRef.current) return; stateRef.current.autopilotEnabled = !stateRef.current.autopilotEnabled; stateRef.current.autoThrottleEnabled = stateRef.current.autopilotEnabled; globalAudio.playChime(); };
  const handleCameraChange = (mode: CameraMode) => { setCameraMode(mode); rendererRef.current?.setCameraMode(mode); };
  const handleToggleMute = () => setIsMuted(globalAudio.toggleMute());
  const handleConfirmPlan = (newPlan: FlightPlan) => { setFlightPlan(newPlan); setShowSetupModal(false); initSimulation(newPlan); };
  const handleRestartFlight = () => initSimulation(flightPlanRef.current);

  const handleHangarSelection = (aircraft: typeof AIRCRAFTS[number], model: VisualModel) => {
    const current = flightPlanRef.current;
    const capacity = aircraftCapacity(aircraft.id);
    const nextPlan: FlightPlan = { ...current, aircraft, cruisingAltitudeFt: aircraft.id === 'b777' ? 35000 : aircraft.id === 'e195' ? 30000 : 33000, maxPassengers: capacity, passengers: Math.min(current.passengers, capacity), fuelKg: Math.min(current.fuelKg, aircraft.fuelCapacityKg) };
    try { localStorage.setItem('flight-sim-hangar-preference', JSON.stringify({ aircraftId: aircraft.id, visualModel: model })); } catch { /* optional */ }
    setFlightPlan(nextPlan); applyVisualModel(model);
    if (canvasContainerRef.current && rendererRef.current) {
      rendererRef.current.destroy();
      const nextRenderer = new WorldRenderer(canvasContainerRef.current, nextPlan);
      rendererRef.current = nextRenderer;
      nextRenderer.setCameraMode(cameraMode);
      applyVisualModel(model);
    }
    initSimulation(nextPlan);
  };

  return <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
    <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
    {uiState && <FlightVisualOverlay state={uiState} />}
    {showDevMetrics && uiState && <DevMetricsPanel fps={fps} frameTimeMs={frameTimeMs} state={uiState} cameraMode={cameraMode} />}
    {uiState && <div className="absolute top-12 sm:top-14 inset-x-0 pointer-events-none flex flex-col items-center gap-1 z-20"><FlightPhaseBar state={uiState} plan={flightPlan} atcMessage={currentAtcMessage} /></div>}
    {showTutorial && uiState && <QuickTutorial state={uiState} onDismiss={() => setShowTutorial(false)} onFullThrottle={handleFullThrottle} />}
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex gap-2">
      <button onClick={() => setShowHangarModal(true)} className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/85 px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md hover:bg-slate-900 hover:border-cyan-300 transition-all" title="Open aircraft hangar"><Plane className="w-4 h-4 text-cyan-300" /><span>HANGAR</span><span className="hidden sm:inline text-slate-400 font-mono">{flightPlan.aircraft.name}</span></button>
      <button onClick={() => setShowSystemsPanel(v => !v)} className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-slate-950/85 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md hover:bg-slate-900 transition-all" title="Open simulation systems"><Radar className="w-4 h-4 text-cyan-300" /><span className="hidden sm:inline">SYSTEMS</span></button>
    </div>
    {showSystemsPanel && uiState && systemsRef.current && <div className="absolute top-16 right-3 z-40 pointer-events-auto"><SimulationSystemsPanel systems={systemsRef.current} state={uiState} plan={flightPlan} /></div>}
    {uiState && showCockpitInstruments && <div className="absolute top-24 left-4 pointer-events-auto z-30 animate-in fade-in zoom-in-95"><div className="relative"><button onClick={() => setShowCockpitInstruments(false)} className="absolute -top-3 -right-3 z-40 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg" title="Close Avionics">✕</button><CockpitDisplay state={uiState} plan={flightPlan} /></div></div>}
    {uiState && <FlightControlsOverlay state={uiState} plan={flightPlan} cameraMode={cameraMode} onCameraChange={handleCameraChange} onPitchRoll={handlePitchRoll} onYaw={handleYaw} onThrottle={handleThrottle} onToggleGear={handleToggleGear} onFlapsChange={handleFlapsChange} onToggleSpoilers={handleToggleSpoilers} onToggleBrakes={handleToggleBrakes} onToggleReverseThrust={handleToggleReverseThrust} onToggleEngines={handleToggleEngines} onToggleAutopilot={handleToggleAutopilot} onToggleMute={handleToggleMute} isMuted={isMuted} onOpenSettings={() => setShowSettingsModal(true)} onResetFlight={handleRestartFlight} onOpenTutorial={() => setShowTutorial(true)} timeCompression={timeCompression} onSetTimeCompression={setTimeCompression} showCockpitInstruments={showCockpitInstruments} onToggleCockpitInstruments={() => setShowCockpitInstruments(!showCockpitInstruments)} />}
    {showHangarModal && <HangarModal currentAircraft={flightPlan.aircraft} currentVisualModel={visualModel} onSelect={handleHangarSelection} onClose={() => setShowHangarModal(false)} />}
    {showSetupModal && <FlightSetupModal currentPlan={flightPlan} onConfirmPlan={handleConfirmPlan} onClose={() => setShowSetupModal(false)} />}
    {showSettingsModal && <SettingsModal assistance={flightPlan.assistance} onSetAssistance={(lvl) => setFlightPlan({ ...flightPlan, assistance: lvl })} showDevMetrics={showDevMetrics} onToggleDevMetrics={() => setShowDevMetrics(!showDevMetrics)} onClose={() => setShowSettingsModal(false)} />}
    {flightSummary && <FlightResultModal summary={flightSummary} onRestart={handleRestartFlight} onClose={() => { flightSummaryRef.current = null; setFlightSummary(null); }} />}
  </div>;
}
