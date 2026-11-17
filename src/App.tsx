import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, JukeboxConfig, SongItem, NowPlaying, SettingsState, RemoteCommand } from './types';
import { loadConfig, saveConfig } from './config';
import { fetchQueue, fetchSettings, fetchSharedConfig, saveSettingsPatch, saveSharedConfig } from './services/db';
import { getPlayerEngine, DEVICE_ID } from './services/playerEngine';
import { Navigation } from './components/Navigation';
import { GuestView } from './components/GuestView';
import { DJConsole, RemoteState } from './components/DJConsole';
import { AdminView } from './components/AdminView';
import { QRSignModal } from './components/QRSignModal';
import { ConfigModal } from './components/ConfigModal';

// A device counts as "playing" if it has sent a heartbeat in the last 15 seconds
const PLAYER_TIMEOUT_MS = 15000;

type CommandInput = Pick<RemoteCommand, 'type' | 'value' | 'target'>;

export default function App() {
  const [config, setConfig] = useState<JukeboxConfig>(loadConfig);
  const [currentView, setCurrentView] = useState<ViewMode>('guest');
  const [queue, setQueue] = useState<SongItem[]>([]);
  const [requestsPaused, setRequestsPaused] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({});
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('jb_admin_unlocked') === '1';
    } catch {
      return false;
    }
  });

  // State of the audio engine on THIS device (only meaningful where music is started)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isQRSignOpen, setIsQRSignOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const lastCommandId = useRef<string | null>(null);
  const commandsBaselined = useRef(false);

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
      setIsStarted(state.isStarted);
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
      const s: SettingsState = (await fetchSettings(config)) || {};
      setSettings(s);
      if (s.paused !== undefined) setRequestsPaused(!!s.paused);

      // Remote control: the device playing the music carries out commands sent to it
      const cmd = s.command;
      if (!commandsBaselined.current) {
        // First read: ignore any command already sitting in the database
        commandsBaselined.current = true;
        lastCommandId.current = cmd?.id ?? null;
      } else if (cmd && cmd.id !== lastCommandId.current) {
        lastCommandId.current = cmd.id;
        const forThisDevice = !cmd.target || cmd.target === DEVICE_ID;
        if (engine.started && forThisDevice) {
          if (cmd.type === 'skip') engine.skipCurrentTrack();
          else if (cmd.type === 'toggle') engine.togglePlayPause();
          else if (cmd.type === 'volume' && typeof cmd.value === 'number') engine.setMasterVolume(cmd.value);
          else if (cmd.type === 'release') engine.release();
        }
      }
    } catch (e) {
      console.warn('Settings refresh failed', e);
    }
  }, [config, engine]);

  const refreshSharedConfig = useCallback(async () => {
    try {
      const shared = await fetchSharedConfig(config);
      if (!shared) return;
      const nextConfig = { ...config, ...shared };
      if (
        nextConfig.youtubeApiKey !== config.youtubeApiKey ||
        nextConfig.basePlaylistId !== config.basePlaylistId ||
        nextConfig.regionCode !== config.regionCode
      ) {
        engine.updateConfig(nextConfig);
      }
      setConfig(current => {
        const next = { ...current, ...shared };
        return next.youtubeApiKey !== current.youtubeApiKey ||
          next.basePlaylistId !== current.basePlaylistId ||
          next.regionCode !== current.regionCode
          ? next
          : current;
      });
    } catch (e) {
      console.warn('Shared configuration refresh failed', e);
    }
  }, [config, engine]);

  useEffect(() => {
    refreshQueue();
    refreshSettings();
    refreshSharedConfig();

    const interval = setInterval(() => {
      refreshQueue();
      refreshSettings();
      refreshSharedConfig();
    }, 4500);

    return () => clearInterval(interval);
  }, [refreshQueue, refreshSettings, refreshSharedConfig]);

  const sendCommand = useCallback((cmd: CommandInput) => {
    const command: RemoteCommand = {
      ...cmd,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      target: cmd.target ?? settings.playerId,
      at: Date.now()
    };
    return saveSettingsPatch(config, { command });
  }, [config, settings.playerId]);

  const handleUnlockAdmin = (pin: string) => {
    if (!config.adminPin.trim()) return false;
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

  const handleUpdateConfig = (newCfg: JukeboxConfig) => {
    setConfig(newCfg);
    saveConfig(newCfg);
    engine.updateConfig(newCfg);
  };

  const handleSaveConfig = async (newCfg: JukeboxConfig): Promise<string> => {
    handleUpdateConfig(newCfg);
    try {
      await saveSharedConfig(newCfg);
      return 'Configuration saved to Firebase. Other devices using the same database will receive it.';
    } catch (e) {
      console.error('Failed to share configuration', e);
      return 'Saved on this device only. Check the shared Firebase URL and database rules to sync it.';
    }
  };

  // What the guest page and header show: this device's playback if it is the one playing,
  // otherwise whatever the playing device last published
  const playerOnline = !!settings.playerSeenAt && Date.now() - settings.playerSeenAt < PLAYER_TIMEOUT_MS;
  const publishedNow = playerOnline ? settings.now ?? null : null;
  const displayNow = isStarted ? nowPlaying : publishedNow;
  const displayPaused = isStarted ? isPaused : !!settings.musicPaused;

  const remote: RemoteState = {
    now: publishedNow,
    musicPaused: !!settings.musicPaused,
    volume: settings.volume ?? 100,
    playerOnline,
    playerId: settings.playerId
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
        nowPlaying={displayNow}
        isPaused={displayPaused}
        adminUnlocked={adminUnlocked}
        onUnlockAdmin={handleUnlockAdmin}
      />

      {/* Main View Router */}
      <main className="flex-1 w-full">
        {currentView === 'guest' && (
          <GuestView
            config={config}
            nowPlaying={displayNow}
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
            remote={remote}
            onSendCommand={sendCommand}
            requestsPaused={requestsPaused}
            onToggleRequestsPaused={handleToggleRequestsPaused}
          />
        )}

        {currentView === 'admin' && (
          <AdminView
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onOpenConfig={() => setIsConfigOpen(true)}
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
        isOpen={isConfigOpen && adminUnlocked}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#2B2622] text-white px-5 py-3 rounded-full text-xs font-semibold shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none flex items-center gap-2 max-w-sm text-center"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
