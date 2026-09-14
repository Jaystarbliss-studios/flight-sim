import React from 'react';
import { AssistanceLevel } from '../types';
import { Keyboard, Sliders, Smartphone, Volume2, X, Eye } from 'lucide-react';

interface SettingsModalProps {
  assistance: AssistanceLevel;
  onSetAssistance: (lvl: AssistanceLevel) => void;
  showDevMetrics: boolean;
  onToggleDevMetrics: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  assistance,
  onSetAssistance,
  showDevMetrics,
  onToggleDevMetrics,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none">
      <div className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold">Simulator Controls & Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard Controls Guide */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-2.5">
            <Keyboard className="w-4 h-4" />
            Laptop / Keyboard Shortcuts
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono text-slate-300">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Pitch (Nose Up/Down):</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">W / S</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Roll (Bank Left/Right):</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">A / D</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Rudder (Yaw Left/Right):</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">Q / E</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Throttle Up / Down:</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">Shift / Ctrl</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Landing Gear:</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">G</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Flaps Extend / Retract:</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">F / V</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Wheel Brakes:</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">B</kbd>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">Cycle Camera Mode:</span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">C</kbd>
            </div>
          </div>
        </div>

        {/* Mobile Touch Instruction */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-2">
            <Smartphone className="w-4 h-4" />
            Mobile & Tablet Touch
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Drag the on-screen virtual flight stick on the bottom-right to control pitch and roll.
            Slide the left throttle lever to set engine power. Tap Gear, Flaps, and Spoilers to configure the aircraft.
          </p>
        </div>

        {/* Simulation Assistance Level */}
        <div>
          <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Assistance Level
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            {(['beginner', 'intermediate', 'realistic'] as AssistanceLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => onSetAssistance(lvl)}
                className={`p-2.5 rounded-xl border capitalize transition-all text-center ${
                  assistance === lvl
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Developer Performance Mode */}
        <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>Show Developer FPS & Sim Physics Monitor</span>
          </div>
          <button
            onClick={onToggleDevMetrics}
            className={`px-3 py-1 rounded border font-bold transition-all ${
              showDevMetrics
                ? 'bg-cyan-600 border-cyan-400 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {showDevMetrics ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm text-white transition-all"
        >
          Close Settings
        </button>
      </div>
    </div>
  );
};
