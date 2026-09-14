import React, { useState, useEffect } from 'react';
import { FlightState, FlightPlan, SharedCockpitSession } from '../types';
import { globalSharedCockpit } from '../simulation/sharedCockpit';
import { Users, Radio, ShieldCheck, ArrowRightLeft, Sparkles, CheckCircle2, Copy, ExternalLink, Bot } from 'lucide-react';

interface SharedCockpitModalProps {
  state: FlightState;
  plan: FlightPlan;
  onClose: () => void;
}

export const SharedCockpitModal: React.FC<SharedCockpitModalProps> = ({
  state,
  plan,
  onClose,
}) => {
  const [session, setSession] = useState<SharedCockpitSession>(globalSharedCockpit.getSession());
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    return globalSharedCockpit.subscribe((s) => {
      setSession(s);
    });
  }, []);

  const handleTransfer = () => {
    globalSharedCockpit.transferControls();
  };

  const handleToggleVirtualCopilot = (enabled: boolean) => {
    globalSharedCockpit.setVirtualCopilot(enabled);
  };

  const handleCopilotAction = (action: 'gear' | 'flaps_takeoff' | 'flaps_landing' | 'spoilers' | 'autopilot') => {
    globalSharedCockpit.executeCoPilotAction(action, state);
  };

  const handleCopyTabLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleOpenDuplicateTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        id="shared-cockpit-dialog"
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Shared Cockpit Multi-Crew System
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  YourControls Engine
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                P2P control synchronization, CRM handover protocol & Virtual First Officer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Active Flight Deck Role & Handover Control */}
          <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${
                  session.role === 'PF'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                }`}
              >
                {session.role}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Your Active Crew Role
                </div>
                <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  {session.role === 'PF' ? (
                    <span className="text-emerald-400">Pilot Flying (Captain)</span>
                  ) : (
                    <span className="text-amber-400">Pilot Monitoring (First Officer)</span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {session.role === 'PF'
                    ? 'You have control of the flight stick, rudder, and throttles.'
                    : 'Monitoring flight systems, radios, autopilot dials, gear, and flaps.'}
                </div>
              </div>
            </div>

            <button
              id="transfer-controls-modal-btn"
              onClick={handleTransfer}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
            >
              <ArrowRightLeft className="w-4 h-4" />
              TRANSFER CONTROLS [C]
            </button>
          </div>

          {/* Announcement Banner if present */}
          {session.transferMessage && (
            <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-500/40 text-xs text-sky-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{session.transferMessage}</span>
            </div>
          )}

          {/* Peer Sync Setup: Multi-Screen / Multi-Tab */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                <Radio className="w-4 h-4 text-sky-400" />
                <span>P2P Multi-Window Cockpit Synchronization</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    session.isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-500'
                  }`}
                />
                <span className={session.isConnected ? 'text-emerald-300 font-semibold' : 'text-zinc-400'}>
                  {session.isConnected ? `Connected (${session.peerCount} Peer Tab)` : 'Solo Flight Deck'}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Open this simulator in a secondary browser window or dual-monitor display. Both sessions instantly link over low-latency channel syncing flight controls, autopilot MCP dials, gear, flaps, and switches!
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleOpenDuplicateTab}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Launch Second Window (Dual Cockpit)
              </button>
              <button
                onClick={handleCopyTabLink}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied Simulator URL' : 'Copy Session Link'}
              </button>
            </div>
          </div>

          {/* Virtual First Officer AI Section */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200">Virtual Co-Pilot (CRM First Officer)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-zinc-400">Active</span>
                <input
                  type="checkbox"
                  checked={session.virtualCopilot}
                  onChange={(e) => handleToggleVirtualCopilot(e.target.checked)}
                  className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              When enabled, your AI First Officer monitors operating limitations and automatically executes standard airline callouts: 
              <span className="text-zinc-300 font-mono ml-1">80 kts crosscheck, V1 ({plan.aircraft.v1Knots} kts), Rotate ({plan.aircraft.vrKnots} kts), Positive climb gear up, Flap retracts, Passing 10,000, 500 stabilized, and Rollout reverse green</span>.
            </p>

            {/* Quick First Officer Commands */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Command First Officer:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleCopilotAction('flaps_takeoff')}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors text-left"
                >
                  "Flaps to Takeoff"
                </button>
                <button
                  onClick={() => handleCopilotAction('gear')}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors text-left"
                >
                  "Gear {state.gearDown ? 'Up' : 'Down'}"
                </button>
                <button
                  onClick={() => handleCopilotAction('flaps_landing')}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors text-left"
                >
                  "Flaps 3 Landing"
                </button>
                <button
                  onClick={() => handleCopilotAction('spoilers')}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors text-left"
                >
                  "Arm Speedbrakes"
                </button>
                <button
                  onClick={() => handleCopilotAction('autopilot')}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors text-left col-span-2 sm:col-span-2"
                >
                  "Autopilot {state.autopilotEnabled ? 'Disengage' : 'Engage'}"
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/80">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dual-pilot authority lock prevents control jitter</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold transition-colors"
          >
            Close Cockpit Panel
          </button>
        </div>
      </div>
    </div>
  );
};
