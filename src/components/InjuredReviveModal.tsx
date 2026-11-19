import React from 'react';
import { AlertTriangle, RotateCcw, Home, Flag } from 'lucide-react';

interface InjuredReviveModalProps {
  reason: string;
  checkpointLabel: string;
  onRevive: () => void;
  onReturnTitle: () => void;
}

export const InjuredReviveModal: React.FC<InjuredReviveModalProps> = ({
  reason,
  checkpointLabel,
  onRevive,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-35 flex items-center justify-center safe-pad p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(16, 4, 6, 0.9)' }}
    >
      <div
        className="w-full max-w-md rounded-sm border border-[#c83b3e]/60 p-5 sm:p-6 space-y-4 text-center"
        style={{ backgroundColor: '#10090b' }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-12 h-12 rounded-sm border border-[#e05255]/50 flex items-center justify-center text-[#f26468]"
            style={{ backgroundColor: 'rgba(180, 32, 38, 0.2)' }}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-[10px] tracking-[0.24em] uppercase text-[#e46c6f] font-semibold">
            Village Outskirts Hazard
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#f7ece4] tracking-wide">
            You got injured!
          </h2>
          <p className="text-xs sm:text-sm text-[#d4bebc] leading-relaxed max-w-sm">
            {reason}
          </p>
        </div>

        <div className="p-3 rounded-sm border border-white/10 bg-[#170f11] flex items-center justify-center gap-2 text-xs text-[#cbb89c]">
          <Flag className="w-3.5 h-3.5 text-[#eab354] shrink-0" />
          <span>
            Last Checkpoint: <strong className="text-[#f5e7cf]">{checkpointLabel}</strong>
          </span>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onRevive}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-sm bg-[#b8322b] hover:bg-[#cf3c34] active:scale-[0.98] text-[#faf3e8] text-xs font-semibold uppercase tracking-[0.16em] transition-all cursor-pointer border border-[#e37b68]/40"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Revive at Checkpoint</span>
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-sm border border-white/12 bg-[#161214] hover:border-white/25 text-[#a9b7b8] hover:text-[#f2ece0] text-xs transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Title</span>
          </button>
        </div>
      </div>
    </div>
  );
};
