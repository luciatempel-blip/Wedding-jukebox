import React, { useState } from 'react';
import { ViewMode, JukeboxConfig, NowPlaying } from '../types';
import { Music, Radio, Shield, Lock } from 'lucide-react';

interface NavigationProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  config: JukeboxConfig;
  nowPlaying: NowPlaying | null;
  isPaused: boolean;
  adminUnlocked: boolean;
  onUnlockAdmin: (pin: string) => boolean;
}

// Three places only: the guest page, the host console and setup. Both host areas need the PIN.
const TABS: { view: ViewMode; label: string; icon: React.ReactNode; locked: boolean }[] = [
  { view: 'guest', label: 'Guest Page', icon: <Music className="w-3.5 h-3.5" />, locked: false },
  { view: 'dj', label: 'Host', icon: <Radio className="w-3.5 h-3.5" />, locked: true },
  { view: 'admin', label: 'Setup', icon: <Shield className="w-3.5 h-3.5" />, locked: true }
];

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  config,
  nowPlaying,
  isPaused,
  adminUnlocked,
  onUnlockAdmin
}) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTarget, setPinTarget] = useState<ViewMode | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleNavClick = (view: ViewMode, locked: boolean) => {
    if (locked && !adminUnlocked) {
      setPinTarget(view);
      setEnteredPin('');
      setPinError(false);
      setShowPinModal(true);
      return;
    }
    onSelectView(view);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUnlockAdmin(enteredPin)) {
      setShowPinModal(false);
      if (pinTarget) {
        onSelectView(pinTarget);
      }
    } else {
      setPinError(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FCFAF5]/90 backdrop-blur-md border-b border-[#ebdcd2] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">

          {/* Brand & Couple Names */}
          <div
            onClick={() => onSelectView('guest')}
            className="cursor-pointer flex items-center gap-2.5 min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#476127] to-[#35491c] flex items-center justify-center text-white shadow-xs shrink-0">
              <Music className="w-5 h-5 text-[#f6d87b]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#756c64] truncate">
                {config.coupleNames}
              </div>
              <div className="text-base font-serif font-bold text-[#2B2622] truncate">
                {config.siteTitle}
              </div>
            </div>
          </div>

          {/* Now playing (read-only; controls live in the Host console) */}
          {nowPlaying && nowPlaying.title && (
            <div className="hidden md:flex items-center gap-2.5 bg-white border border-[#ebdcd2] rounded-full py-1.5 px-3.5 shadow-xs max-w-xs">
              <span className="text-[11px] font-bold text-[#d8456f] shrink-0">{isPaused ? 'PAUSED' : 'LIVE'}</span>
              <p className="text-xs font-semibold text-[#2B2622] truncate">{nowPlaying.title}</p>
            </div>
          )}

          {/* Tabs */}
          <nav className="flex items-center gap-1 bg-[#f5e6dc]/60 p-1 rounded-full border border-[#ebdcd2] shrink-0">
            {TABS.map((tab) => {
              const active = currentView === tab.view;
              return (
                <button
                  key={tab.view}
                  onClick={() => handleNavClick(tab.view, tab.locked)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? 'bg-white text-[#2B2622] shadow-xs'
                      : 'text-[#756c64] hover:text-[#2B2622] hover:bg-white/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.locked && !adminUnlocked && <Lock className="w-3 h-3 text-[#b85433]" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* PIN Authentication Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#ebdcd2] animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-[#f8ece7] text-[#b85433] flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-bold text-center text-[#2B2622] mb-1">
              Host Security Check
            </h3>
            <p className="text-xs text-center text-[#756c64] mb-5">
              Enter the admin PIN to open the {pinTarget === 'dj' ? 'Host Console' : 'Setup page'}.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="Enter admin PIN"
                  className="w-full text-center text-xl font-bold tracking-widest px-4 py-3 rounded-xl border-2 border-[#ebdcd2] focus:border-[#476127] outline-hidden transition-all bg-[#fcfaf5]"
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs text-[#b85433] font-medium text-center mt-2">
                    Incorrect PIN. Please try again.
                  </p>
                )}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#ebdcd2] text-xs font-semibold text-[#756c64] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#476127] hover:bg-[#35491c] text-white text-xs font-semibold transition-colors shadow-sm"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
