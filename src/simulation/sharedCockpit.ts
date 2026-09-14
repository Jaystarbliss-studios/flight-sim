import { CrewRole, FlightPlan, FlightState, SharedCockpitPacket, SharedCockpitSession } from '../types';
import { globalAudio } from './audioEngine';

export type SharedCockpitListener = (session: SharedCockpitSession, packet?: SharedCockpitPacket) => void;

export class SharedCockpitManager {
  private channel: BroadcastChannel | null = null;
  private readonly instanceId = `pilot_${Math.random().toString(36).slice(2, 9)}`;
  private role: CrewRole = 'PF';
  private peerCount = 0;
  private lastPeerHeartbeat = 0;
  private virtualCopilot = true;
  private lastTransferTime = Date.now();
  private transferMessage: string | null = null;
  private listeners = new Set<SharedCockpitListener>();

  // Co-pilot callout tracking
  private called80 = false;
  private calledV1 = false;
  private calledVr = false;
  private calledPositiveRate = false;
  private calledFlaps1 = false;
  private called10000 = false;
  private called500 = false;
  private calledRollout = false;

  constructor() {
    this.initChannel();
  }

  private initChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel('flight_sim_yourcontrols');
      this.channel.onmessage = (event: MessageEvent<SharedCockpitPacket>) => {
        this.handleIncomingPacket(event.data);
      };

      // Announce arrival to any open tabs
      this.broadcast({
        type: 'sync',
        senderRole: this.role,
        senderId: this.instanceId,
        timestamp: Date.now(),
      });
    } catch {
      this.channel = null;
    }
  }

  public getSession(): SharedCockpitSession {
    const isPeerLive = Date.now() - this.lastPeerHeartbeat < 4000;
    return {
      role: this.role,
      isHost: this.role === 'PF',
      isConnected: isPeerLive,
      peerCount: isPeerLive ? Math.max(1, this.peerCount) : 0,
      virtualCopilot: this.virtualCopilot,
      lastTransferTime: this.lastTransferTime,
      transferMessage: this.transferMessage,
    };
  }

  public subscribe(listener: SharedCockpitListener): () => void {
    this.listeners.add(listener);
    listener(this.getSession());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(packet?: SharedCockpitPacket) {
    const session = this.getSession();
    this.listeners.forEach((l) => l(session, packet));
  }

  public setVirtualCopilot(active: boolean) {
    this.virtualCopilot = active;
    this.notify();
  }

  /**
   * Request or execute control handover: "You have controls" <-> "I have controls"
   * (Signature feature of YourControls)
   */
  public transferControls(requestedRole?: CrewRole) {
    const nextRole: CrewRole = requestedRole ?? (this.role === 'PF' ? 'PM' : 'PF');
    this.role = nextRole;
    this.lastTransferTime = Date.now();
    const announcement = nextRole === 'PF' ? 'You have the controls' : 'Co-pilot has the controls';
    this.transferMessage = announcement;

    globalAudio.playChime();
    globalAudio.playVoiceCallout(nextRole === 'PF' ? 'I have controls' : 'You have controls');

    this.broadcast({
      type: 'transfer_accept',
      senderRole: this.role,
      senderId: this.instanceId,
      timestamp: Date.now(),
      calloutText: announcement,
    });

    this.notify();
  }

  /**
   * Called on every simulation tick to synchronize flight controls & systems
   */
  public update(state: FlightState, plan: FlightPlan, dt: number) {
    state.crewRole = this.role;
    state.isVirtualCopilotActive = this.virtualCopilot;
    state.controlTransferAnnouncement = this.transferMessage ?? undefined;

    // Check if peer heartbeat timed out
    if (this.peerCount > 0 && Date.now() - this.lastPeerHeartbeat > 4000) {
      this.peerCount = 0;
      this.notify();
    }

    // Run Virtual Co-pilot callouts if active
    if (this.virtualCopilot) {
      this.runVirtualCopilot(state, plan);
    }

    // Broadcast state to peer co-pilot periodically (~10 times/sec)
    if (Math.random() < 0.18) {
      this.broadcastState(state);
    }
  }

  private broadcastState(state: FlightState) {
    if (!this.channel) return;
    const packet: SharedCockpitPacket = {
      type: 'sync',
      senderRole: this.role,
      senderId: this.instanceId,
      timestamp: Date.now(),
      systems: {
        gearDown: state.gearDown,
        flapsIndex: state.flapsIndex,
        spoilersDeployed: state.spoilersDeployed,
        reverseThrust: state.reverseThrust,
        autopilotEnabled: state.autopilotEnabled,
        autoThrottleEnabled: state.autoThrottleEnabled,
        targetAltitudeFt: state.targetAltitudeFt,
        targetHeadingDeg: state.targetHeadingDeg,
        targetSpeedKnots: state.targetSpeedKnots,
        navMode: state.navMode,
        appMode: state.appMode,
        navLights: state.navLights,
        beaconLights: state.beaconLights,
        strobeLights: state.strobeLights,
        landingLights: state.landingLights,
        taxiLights: state.taxiLights,
      },
    };

    if (this.role === 'PF') {
      packet.controls = {
        pitchInput: state.pitchInput,
        rollInput: state.rollInput,
        yawInput: state.yawInput,
        throttle: state.throttle,
        brakesActive: state.brakesActive,
      };
    }

    this.broadcast(packet);
  }

  private broadcast(packet: SharedCockpitPacket) {
    if (!this.channel) return;
    try {
      this.channel.postMessage(packet);
    } catch {
      // Ignore broadcast errors in sandbox
    }
  }

  private handleIncomingPacket(packet: SharedCockpitPacket) {
    if (packet.senderId === this.instanceId) return;

    this.lastPeerHeartbeat = Date.now();
    this.peerCount = 1;

    if (packet.type === 'transfer_accept' || packet.type === 'transfer_request') {
      // Peer switched role -> we take the complementary role
      const peerRole = packet.senderRole;
      const myNewRole: CrewRole = peerRole === 'PF' ? 'PM' : 'PF';
      if (this.role !== myNewRole) {
        this.role = myNewRole;
        this.lastTransferTime = Date.now();
        this.transferMessage = myNewRole === 'PF' ? 'You have controls' : 'Co-pilot has controls';
        globalAudio.playChime();
        globalAudio.playVoiceCallout(myNewRole === 'PF' ? 'I have controls' : 'You have controls');
      }
    }

    this.notify(packet);
  }

  /**
   * Applies incoming peer sync packet into local flight state
   */
  public applyRemoteSync(state: FlightState, packet: SharedCockpitPacket) {
    if (packet.senderId === this.instanceId) return;

    // If peer is Pilot Flying, adopt their flight surface controls
    if (packet.senderRole === 'PF' && packet.controls && this.role === 'PM') {
      state.pitchInput = packet.controls.pitchInput;
      state.rollInput = packet.controls.rollInput;
      state.yawInput = packet.controls.yawInput;
      state.throttle = packet.controls.throttle;
      state.brakesActive = packet.controls.brakesActive;
    }

    // Systems are shared by both PF and PM
    if (packet.systems) {
      state.gearDown = packet.systems.gearDown;
      state.flapsIndex = packet.systems.flapsIndex;
      state.spoilersDeployed = packet.systems.spoilersDeployed;
      state.reverseThrust = packet.systems.reverseThrust;
      state.autopilotEnabled = packet.systems.autopilotEnabled;
      state.autoThrottleEnabled = packet.systems.autoThrottleEnabled;
      state.targetAltitudeFt = packet.systems.targetAltitudeFt;
      state.targetHeadingDeg = packet.systems.targetHeadingDeg;
      state.targetSpeedKnots = packet.systems.targetSpeedKnots;
      state.navMode = packet.systems.navMode;
      state.appMode = packet.systems.appMode;
      state.navLights = packet.systems.navLights;
      state.beaconLights = packet.systems.beaconLights;
      state.strobeLights = packet.systems.strobeLights;
      state.landingLights = packet.systems.landingLights;
      state.taxiLights = packet.systems.taxiLights;
    }
  }

  /**
   * Virtual Co-Pilot CRM Standard Operating Procedures
   */
  private runVirtualCopilot(state: FlightState, plan: FlightPlan) {
    const v1 = plan.aircraft.v1Knots;
    const vr = plan.aircraft.vrKnots;
    const speed = state.airspeedKnots;
    const airborne = state.radioAltitudeFt > 15;

    // 80 Knots Takeoff roll callout
    if (state.phase === 'takeoff_roll' && speed >= 80 && !this.called80) {
      this.called80 = true;
      this.copilotCallout('80 knots, crosscheck');
    }

    // V1 Callout
    if (state.phase === 'takeoff_roll' && speed >= v1 && !this.calledV1) {
      this.calledV1 = true;
      this.copilotCallout('V1');
    }

    // Rotate Callout
    if (state.phase === 'takeoff_roll' && speed >= vr && !this.calledVr) {
      this.calledVr = true;
      this.copilotCallout('Rotate');
    }

    // Positive Rate - Gear Up
    if (airborne && state.verticalSpeedFpm > 400 && state.gearDown && !this.calledPositiveRate) {
      this.calledPositiveRate = true;
      this.copilotCallout('Positive rate, gear up');
      // Co-pilot automatically retracts landing gear if enabled
      state.gearDown = false;
    }

    // Retract flaps as speed builds safely
    if (airborne && speed > vr + 25 && state.flapsIndex > 1 && !this.calledFlaps1) {
      this.calledFlaps1 = true;
      this.copilotCallout('Speed checks, flaps 1');
      state.flapsIndex = 1;
    }

    // 10,000 ft transition
    if (state.altitudeFt > 10000 && !this.called10000 && state.verticalSpeedFpm > 0) {
      this.called10000 = true;
      this.copilotCallout('Passing 10,000, lights set');
      state.landingLights = false;
    }

    // 500 ft on approach
    if (state.phase === 'landing' && state.radioAltitudeFt <= 500 && !this.called500) {
      this.called500 = true;
      this.copilotCallout('500 feet, stabilized');
    }

    // Touchdown rollout
    if (state.phase === 'taxi_in' && !this.calledRollout && state.airspeedKnots > 60) {
      this.calledRollout = true;
      this.copilotCallout('Spoilers deployed, reverse green, 70 knots');
    }
  }

  private copilotCallout(text: string) {
    this.transferMessage = `Co-Pilot: "${text}"`;
    globalAudio.playVoiceCallout(text);
    setTimeout(() => {
      if (this.transferMessage?.includes(text)) {
        this.transferMessage = null;
        this.notify();
      }
    }, 4500);
    this.notify();
  }

  /**
   * First Officer Assist Actions
   */
  public executeCoPilotAction(action: 'gear' | 'flaps_takeoff' | 'flaps_landing' | 'spoilers' | 'autopilot', state: FlightState) {
    switch (action) {
      case 'gear':
        state.gearDown = !state.gearDown;
        this.copilotCallout(state.gearDown ? 'Gear down, three green' : 'Gear up');
        break;
      case 'flaps_takeoff':
        state.flapsIndex = 1;
        this.copilotCallout('Flaps set 1 for takeoff');
        break;
      case 'flaps_landing':
        state.flapsIndex = 3;
        this.copilotCallout('Flaps 3 set for landing');
        break;
      case 'spoilers':
        state.spoilersDeployed = !state.spoilersDeployed;
        this.copilotCallout(state.spoilersDeployed ? 'Speedbrakes armed' : 'Speedbrakes retracted');
        break;
      case 'autopilot':
        state.autopilotEnabled = !state.autopilotEnabled;
        state.autoThrottleEnabled = state.autopilotEnabled;
        this.copilotCallout(state.autopilotEnabled ? 'Autopilot engaged' : 'Autopilot disengaged');
        break;
    }
  }

  public destroy() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}

export const globalSharedCockpit = new SharedCockpitManager();
