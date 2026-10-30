import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, JukeboxConfig, SongItem, NowPlaying } from './types';
import { loadConfig, saveConfig } from './config';
import { fetchQueue, fetchSettings, saveSettingsPatch } from './services/db';
import { getPlayerEngine } from './services/playerEngine';
import { Navigation } from './components/Navigation';
import { GuestView } from './components/GuestView';
import { DJConsole } from './components/DJConsole';
import { AdminView } from './components/AdminView';
import { QRSignModal } from './components/QRSignModal';
import { ConfigModal } from './components/ConfigModal';

export default function App() {
  const [config, setConfig] = useState<JukeboxConfig>(loadConfig);
  const [currentView, setCurrentView] = useState<ViewMode>('guest');
  const [queue, setQueue] = useState<SongItem[]>([]);
  const [requestsPaused, setRequestsPaused] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('jb_admin_unlocked') === '1';
    } catch {
      return false;
    }
  });

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isQRSignOpen, setIsQRSignOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const engine = getPlayerEngine(config);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  // Dismiss toast after 3.2s
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Subscribe to audio engine state
  useEffect(() => {
    const unsub = engine.subscribe((state) => {
      setNowPlaying(state.nowPlaying);
      setIsPaused(state.isPaused);
    });
    return () => unsub();
  }, [engine]);

  // Poll database for queue and settings changes
  const refreshQueue = useCallback(async () => {
    try {
      const list = await fetchQueue(config);
      setQueue(list);
    } catch (e) {
      console.warn('Queue refresh failed', e);
    }
  }, [config]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await fetchSettings(config);
      if (s) {
        if (s.paused !== undefined) setRequestsPaused(!!s.paused);
      }
    } catch (e) {
      console.warn('Settings refresh failed', e);
    }
  }, [config]);

  useEffect(() => {
    refreshQueue();
    refreshSettings();

    const interval = setInterval(() => {
      refreshQueue();
      refreshSettings();
    }, 4500);

    return () => clearInterval(interval);
  }, [refreshQueue, refreshSettings]);

  const handleUnlockAdmin = (pin: string) => {
    if (pin.trim() === config.adminPin.trim()) {
      setAdminUnlocked(true);
      try {
        sessionStorage.setItem('jb_admin_unlocked', '1');
      } catch {}
      showToast('Unlocked successfully');
      return true;
    }
    return false;
  };

  const handleToggleRequestsPaused = async () => {
    const nextState = !requestsPaused;
    setRequestsPaused(nextState);
    await saveSettingsPatch(config, { paused: nextState });
    showToast(nextState ? 'Guest requests paused' : 'Guest requests resumed');
  };

  const handleSaveConfig = (newCfg: JukeboxConfig) => {
    setConfig(newCfg);
    saveConfig(newCfg);
    engine.updateConfig(newCfg);
  };

  return (
    <div className="min-h-screen bg-[#FCFAF5] flex flex-col font-sans selection:bg-[#476127] selection:text-white">
      
      {/* Navigation Header */}
      <Navigation
        currentView={currentView}
        onSelectView={(v) => {
          if (v === 'sign') {
            setIsQRSignOpen(true);
          } else if (v === 'config') {
            setIsConfigOpen(true);
          } else {
            setCurrentView(v);
          }
        }}
        config={config}
        nowPlaying={nowPlaying}
        isPaused={isPaused}
        onTogglePlay={() => engine.togglePlayPause()}
        onSkipTrack={() => engine.skipCurrentTrack()}
        adminUnlocked={adminUnlocked}
        onUnlockAdmin={handleUnlockAdmin}
      />

      {/* Main View Router */}
      <main className="flex-1 w-full">
        {currentView === 'guest' && (
          <GuestView
            config={config}
            nowPlaying={nowPlaying}
            queue={queue}
            onSongAdded={refreshQueue}
            requestsPaused={requestsPaused}
            showToast={showToast}
          />
        )}

        {currentView === 'dj' && (
          <DJConsole
            config={config}
            queue={queue}
            onRefreshQueue={refreshQueue}
            onOpenQRSign={() => setIsQRSignOpen(true)}
            showToast={showToast}
          />
        )}

        {currentView === 'admin' && (
          <AdminView
            config={config}
            onUpdateConfig={handleSaveConfig}
            queue={queue}
            onRefreshQueue={refreshQueue}
            requestsPaused={requestsPaused}
            onToggleRequestsPaused={handleToggleRequestsPaused}
            onOpenQRSign={() => setIsQRSignOpen(true)}
            showToast={showToast}
          />
        )}
      </main>

      {/* QR Sign Modal */}
      <QRSignModal
        isOpen={isQRSignOpen}
        onClose={() => setIsQRSignOpen(false)}
        config={config}
      />

      {/* Configuration Settings Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-16 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#2B2622] text-white px-5 py-3 rounded-full text-xs font-semibold shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none flex items-center gap-2 max-w-sm text-center"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
