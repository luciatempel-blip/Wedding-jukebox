import React, { useState } from 'react';
import { ViewMode, JukeboxConfig, NowPlaying } from '../types';
import { Music, Radio, Shield, QrCode, Settings, Play, Pause, SkipForward, Lock, Volume2 } from 'lucide-react';

interface NavigationProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  config: JukeboxConfig;
  nowPlaying: NowPlaying | null;
  isPaused: boolean;
  onTogglePlay: () => void;
  onSkipTrack: () => void;
  adminUnlocked: boolean;
  onUnlockAdmin: (pin: string) => boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  config,
  nowPlaying,
  isPaused,
  onTogglePlay,
  onSkipTrack,
  adminUnlocked,
  onUnlockAdmin
}) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTarget, setPinTarget] = useState<ViewMode | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleNavClick = (view: ViewMode) => {
    if ((view === 'dj' || view === 'admin') && !adminUnlocked) {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
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

          {/* Persistent Mini-Player Pill in Header */}
          {nowPlaying && nowPlaying.title && (
            <div className="hidden md:flex items-center gap-3 bg-white border border-[#ebdcd2] rounded-full py-1.5 px-3.5 shadow-xs max-w-md">
              <div className="flex items-end gap-0.5 h-3.5 w-4 shrink-0 text-[#d8456f]">
                {!isPaused ? (
                  <>
                    <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-1" />
                    <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-2" />
                    <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-3" />
                  </>
                ) : (
                  <span className="text-[10px] text-gray-400 font-bold">||</span>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-[#2B2622] truncate max-w-[140px] lg:max-w-[180px]">
                  {nowPlaying.title}
                </p>
                <p className="text-[11px] text-[#756c64] truncate max-w-[140px] lg:max-w-[180px]">
                  {nowPlaying.artist || 'Wedding Playlist'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 border-l border-[#ebdcd2] pl-2 ml-1">
                <button
                  onClick={onTogglePlay}
                  className="p-1 rounded-full text-[#476127] hover:bg-[#f5e6dc] transition-colors"
                  title={isPaused ? "Play" : "Pause"}
                  aria-label={isPaused ? "Play" : "Pause"}
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                </button>
                <button
                  onClick={onSkipTrack}
                  className="p-1 rounded-full text-[#756c64] hover:text-[#b85433] hover:bg-[#f8ece7] transition-colors"
                  title="Skip to next track"
                  aria-label="Skip track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-[#f5e6dc]/60 p-1.5 rounded-full border border-[#ebdcd2]">
            <button
              onClick={() => handleNavClick('guest')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentView === 'guest'
                  ? 'bg-white text-[#476127] shadow-xs'
                  : 'text-[#756c64] hover:text-[#2B2622] hover:bg-white/60'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Guest Portal
            </button>

            <button
              onClick={() => handleNavClick('dj')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentView === 'dj'
                  ? 'bg-[#191c18] text-[#f6d87b] shadow-xs'
                  : 'text-[#756c64] hover:text-[#2B2622] hover:bg-white/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              DJ Console
              {!adminUnlocked && <Lock className="w-3 h-3 text-[#b85433]" />}
            </button>

            <button
              onClick={() => handleNavClick('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? 'bg-white text-[#b85433] shadow-xs'
                  : 'text-[#756c64] hover:text-[#2B2622] hover:bg-white/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
              {!adminUnlocked && <Lock className="w-3 h-3 text-[#b85433]" />}
            </button>

            <button
              onClick={() => handleNavClick('sign')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentView === 'sign'
                  ? 'bg-white text-[#2B2622] shadow-xs'
                  : 'text-[#756c64] hover:text-[#2B2622] hover:bg-white/60'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              QR Sign
            </button>

            <button
              onClick={() => handleNavClick('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentView === 'config'
                  ? 'bg-white text-[#476127] shadow-xs'
                  : 'text-[#756c64] hover:text-[#2B2622]'
              }`}
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </nav>

          {/* Quick Mobile Icon Links */}
          <div className="flex lg:hidden items-center gap-1">
            <button
              onClick={() => handleNavClick('dj')}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 ${
                currentView === 'dj' ? 'bg-[#191c18] text-[#f6d87b]' : 'bg-[#f5e6dc] text-[#476127]'
              }`}
              title="DJ Console"
            >
              <Radio className="w-4 h-4" />
              <span className="text-[11px] font-bold">DJ</span>
            </button>
            <button
              onClick={() => handleNavClick('sign')}
              className="p-2 rounded-xl bg-[#f5e6dc] text-[#2B2622]"
              title="QR Sign"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleNavClick('admin')}
              className="p-2 rounded-xl bg-[#f5e6dc] text-[#b85433]"
              title="Admin"
            >
              <Shield className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FCFAF5]/95 backdrop-blur-md border-t border-[#ebdcd2] px-3 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => handleNavClick('guest')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
            currentView === 'guest' ? 'text-[#476127]' : 'text-[#756c64]'
          }`}
        >
          <Music className="w-5 h-5" />
          <span>Guest</span>
        </button>

        <button
          onClick={() => handleNavClick('dj')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
            currentView === 'dj' ? 'text-[#2B2622]' : 'text-[#756c64]'
          }`}
        >
          <Radio className="w-5 h-5" />
          <span>DJ Console</span>
        </button>

        <button
          onClick={() => handleNavClick('admin')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
            currentView === 'admin' ? 'text-[#b85433]' : 'text-[#756c64]'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span>Admin</span>
        </button>

        <button
          onClick={() => handleNavClick('sign')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
            currentView === 'sign' ? 'text-[#2B2622]' : 'text-[#756c64]'
          }`}
        >
          <QrCode className="w-5 h-5" />
          <span>QR Sign</span>
        </button>

        <button
          onClick={() => handleNavClick('config')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
            currentView === 'config' ? 'text-[#476127]' : 'text-[#756c64]'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>Config</span>
        </button>
      </div>

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
              Please enter the admin PIN to open the {pinTarget === 'dj' ? 'DJ Console' : 'Admin Area'}.
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
                  placeholder="Enter PIN (e.g. 20260106)"
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
