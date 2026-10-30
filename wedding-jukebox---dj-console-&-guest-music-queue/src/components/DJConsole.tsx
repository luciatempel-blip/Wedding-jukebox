import React, { useEffect, useRef, useState } from 'react';
import { JukeboxConfig, NowPlaying, SongItem } from '../types';
import { getPlayerEngine } from '../services/playerEngine';
import { clearEntireQueue, removeQueueSong, updateQueueSong, shuffleActiveQueue } from '../services/db';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  PictureInPicture2,
  Sun,
  QrCode,
  Trash2,
  Radio,
  Disc,
  Clock,
  ArrowUp,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface DJConsoleProps {
  config: JukeboxConfig;
  queue: SongItem[];
  onRefreshQueue: () => void;
  onOpenQRSign: () => void;
  showToast: (msg: string) => void;
}

export const DJConsole: React.FC<DJConsoleProps> = ({
  config,
  queue,
  onRefreshQueue,
  onOpenQRSign,
  showToast
}) => {
  const engine = getPlayerEngine(config);

  const [engineState, setEngineState] = useState({
    nowPlaying: null as NowPlaying | null,
    deckAActive: true,
    deckBActive: false,
    deckAGain: 0,
    deckBGain: 0,
    isStarted: false,
    isPaused: false,
    masterVolume: 100,
    currentTime: 0,
    duration: 0,
    nextTrack: null as { title: string; artist: string; art?: string; requested?: boolean } | null,
    wakeLockActive: false,
    pipActive: false,
    statusMessage: 'Ready'
  });

  const [activeQueueTab, setActiveQueueTab] = useState<'queue' | 'history'>('queue');
  const [crossfadeSec, setCrossfadeSec] = useState(config.crossfadeSeconds || 8);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(100);

  const deckARef = useRef<HTMLDivElement>(null);
  const deckBRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time engine changes
  useEffect(() => {
    const unsub = engine.subscribe(setEngineState);
    return () => unsub();
  }, [engine]);

  // Mount YouTube iframes once in DOM
  useEffect(() => {
    engine.mountYouTubeDecks('ytContainerA', 'ytContainerB');
  }, [engine]);

  const handleStartMusic = async () => {
    await engine.startMusic();
    showToast('DJ Decks Activated! 🎶');
  };

  const handleTogglePlay = () => {
    engine.togglePlayPause();
  };

  const handleSkip = () => {
    engine.skipCurrentTrack();
    showToast('Skipping to next track...');
  };

  const handleVolumeChange = (v: number) => {
    setIsMuted(v === 0);
    engine.setMasterVolume(v);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      handleVolumeChange(prevVol || 100);
      setIsMuted(false);
    } else {
      setPrevVol(engineState.masterVolume);
      handleVolumeChange(0);
      setIsMuted(true);
    }
  };

  const handleTogglePiP = async () => {
    const active = await engine.togglePiP();
    showToast(active ? 'Picture-in-Picture window opened!' : 'Closed PiP window');
  };

  const handleToggleWakeLock = async () => {
    const active = await engine.toggleWakeLock();
    showToast(active ? 'Screen Wake Lock active (display won\'t sleep)' : 'Screen Wake Lock released');
  };

  const handlePlayFirst = async (item: SongItem) => {
    const active = queue.filter(s => !s.played && !s.failed);
    const minOrder = active.length > 0 ? Math.min(...active.map(s => s.order || 0)) : Date.now();
    try {
      await updateQueueSong(config, item.id, { order: minOrder - 1 });
      showToast(`Bumped "${item.title}" to #1 next!`);
      onRefreshQueue();
    } catch {
      showToast('Could not reorder song');
    }
  };

  const handleRemoveSong = async (item: SongItem) => {
    try {
      await removeQueueSong(config, item.id);
      showToast(`Removed "${item.title}"`);
      onRefreshQueue();
    } catch {
      showToast('Could not remove song');
    }
  };

  const handleShuffle = async () => {
    try {
      const n = await shuffleActiveQueue(config);
      showToast(n > 1 ? `Shuffled ${n} requests!` : 'Need at least 2 requests to shuffle');
      onRefreshQueue();
    } catch {
      showToast('Could not shuffle');
    }
  };

  const handleClearQueue = async () => {
    if (window.confirm('Are you sure you want to clear the entire queue and playback history?')) {
      try {
        await clearEntireQueue(config);
        showToast('Queue cleared');
        onRefreshQueue();
      } catch {
        showToast('Could not clear queue');
      }
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const formatRemaining = (cur: number, dur: number) => {
    if (dur <= 0) return '-0:00';
    const rem = Math.max(0, dur - cur);
    return `-${formatTime(rem)}`;
  };

  const activeQueue = queue.filter(s => !s.played && !s.failed);
  const playedHistory = queue.filter(s => s.played).sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));

  // Crossfade position indicator percentage (-100% deck A to +100% deck B)
  const crossfadeBalance = Math.round((engineState.deckBGain - engineState.deckAGain) * 50 + 50);

  return (
    <div className="min-h-screen bg-[#141713] text-[#FBF8F3] p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Hidden YouTube IFrame containers (required by YouTube Iframe API) */}
      <div className="sr-only opacity-0 pointer-events-none w-1 h-1 overflow-hidden" aria-hidden="true">
        <div ref={deckARef} id="ytContainerA" />
        <div ref={deckBRef} id="ytContainerB" />
      </div>

      {/* Top DJ HUD Header */}
      <div className="bg-[#1D211B] border border-[#2B3128] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Console Title & Live Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#476127] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-5 h-5 text-[#f6d87b]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-bold text-[#f6d87b]">
                {config.coupleNames}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#2B3128] text-white border border-white/10">
                <span
                  className={`w-2 h-2 rounded-full ${
                    engineState.isStarted && !engineState.isPaused
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                {engineState.isStarted
                  ? engineState.isPaused
                    ? 'PAUSED'
                    : 'ON AIR'
                  : 'OFFLINE'}
              </span>
            </div>
            <h2 className="text-lg font-serif font-bold text-white tracking-wide">
              Studio DJ Console
            </h2>
          </div>
        </div>

        {/* Right: Master Control Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          
          {/* Master Volume */}
          <div className="flex items-center gap-2 bg-[#252A23] px-3.5 py-2 rounded-xl border border-[#343B30]">
            <button
              onClick={handleToggleMute}
              className="text-[#c4beb4] hover:text-white transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || engineState.masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : engineState.masterVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-20 sm:w-28 accent-[#f6d87b] cursor-pointer"
              title="Master Volume"
              aria-label="Master volume"
            />
            <span className="text-xs font-mono text-[#f6d87b] w-8 text-right font-bold">
              {isMuted ? '0%' : `${engineState.masterVolume}%`}
            </span>
          </div>

          {/* Picture-in-Picture Toggle */}
          <button
            onClick={handleTogglePiP}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              engineState.pipActive
                ? 'bg-[#f6d87b] text-[#141713] border-[#f6d87b] shadow-md shadow-amber-900/20'
                : 'bg-[#252A23] text-[#c4beb4] border-[#343B30] hover:text-white hover:bg-[#2B3128]'
            }`}
            title="Pop out floating Picture-in-Picture player"
          >
            <PictureInPicture2 className="w-4 h-4" />
            <span className="hidden sm:inline">PiP Mode</span>
          </button>

          {/* Wake Lock Screen On */}
          <button
            onClick={handleToggleWakeLock}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              engineState.wakeLockActive
                ? 'bg-[#476127] text-white border-[#5d7c35]'
                : 'bg-[#252A23] text-[#c4beb4] border-[#343B30] hover:text-white'
            }`}
            title="Keep display awake during the wedding"
          >
            <Sun className="w-4 h-4 text-amber-300" />
            <span className="hidden md:inline">Stay Awake</span>
          </button>

          {/* QR Sign Button */}
          <button
            onClick={onOpenQRSign}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#b85433] text-white hover:bg-[#9e4629] transition-all"
            title="Print or view guest QR sign"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">QR Sign</span>
          </button>
        </div>
      </div>

      {/* Start Music Prompt Banner if not started */}
      {!engineState.isStarted && (
        <div className="bg-gradient-to-r from-[#2B3128] via-[#1D211B] to-[#2B3128] border-2 border-[#476127] rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#476127]/30 border border-[#476127] text-[#f6d87b] flex items-center justify-center mx-auto">
            <Disc className="w-8 h-8 animate-spin-slow" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
              Connect to Venue Speakers
            </h3>
            <p className="text-xs sm:text-sm text-[#c4beb4]">
              Connect this iPad or laptop to the sound system, turn the device volume up, and tap Start Music below.
            </p>
          </div>
          <button
            onClick={handleStartMusic}
            className="px-8 py-4 rounded-2xl text-base font-bold bg-[#476127] hover:bg-[#5d7c35] text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-green-950/40 flex items-center gap-2.5 mx-auto"
          >
            <Play className="w-5 h-5 fill-current" />
            Start The Music
          </button>
        </div>
      )}

      {/* Refined DJ Console CSS Grid Configuration */}
      <div className="dj-grid-container">
        
        {/* LEFT COLUMN: Dual Turntable Decks & Now Playing Center Stage */}
        <div className="space-y-6 min-w-0">
          
          {/* Main Stage Now Playing Panel */}
          <div className="bg-[#1D211B] border border-[#2B3128] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-widest font-bold text-[#c4beb4] flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-[#f6d87b]" />
                Deck Live Output
              </span>
              <span className="text-[#f6d87b] font-medium">
                {engineState.statusMessage}
              </span>
            </div>

            {/* Song Meta with Large High-Contrast Display */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
              
              {/* Rotating Vinyl Record Artwork */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0">
                <div
                  className={`w-full h-full rounded-full bg-gradient-to-tr from-black via-[#191c18] to-black border-4 border-[#343B30] shadow-2xl flex items-center justify-center relative overflow-hidden ${
                    engineState.isStarted && !engineState.isPaused ? 'animate-spin-slow' : 'animate-spin-paused'
                  }`}
                >
                  {/* Vinyl Grooves */}
                  <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-5 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />

                  {/* Center Label / Album Artwork */}
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/20 bg-[#476127] flex items-center justify-center">
                    {engineState.nowPlaying?.art ? (
                      <img
                        src={engineState.nowPlaying.art}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc className="w-6 h-6 text-white/70" />
                    )}
                  </div>
                  <div className="absolute w-3 h-3 rounded-full bg-[#141713] border border-white/20" />
                </div>
              </div>

              {/* Title, Artist, and Badges */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {engineState.nowPlaying?.requested ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#d8456f]/30 text-[#fdecf2] border border-[#d8456f]/40">
                      Guest Request 🎉
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#476127]/40 text-[#f6d87b] border border-[#476127]">
                      Curated Base Playlist
                    </span>
                  )}
                  <span className="text-xs text-[#c4beb4] font-mono">
                    Deck {engineState.deckAActive ? 'A' : 'B'}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-white tracking-tight leading-snug line-clamp-2">
                  {engineState.nowPlaying?.title || 'Waiting to start...'}
                </h3>
                <p className="text-sm sm:text-base text-[#c4beb4] line-clamp-1 font-medium">
                  {engineState.nowPlaying?.artist || 'Rudi and Lucia Wedding Jukebox'}
                </p>

                {/* Live Position & Scrub Bar */}
                <div className="pt-3 space-y-1.5">
                  <div className="h-2 w-full bg-[#2B3128] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#f6d87b] to-amber-400 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          engineState.duration > 0
                            ? Math.min(100, (engineState.currentTime / engineState.duration) * 100)
                            : 0
                        }%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-[#c4beb4]">
                    <span>{formatTime(engineState.currentTime)}</span>
                    <span className="text-[#f6d87b] font-bold">
                      {formatRemaining(engineState.currentTime, engineState.duration)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Player Deck Control Buttons */}
            <div className="pt-2 border-t border-[#2B3128] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePlay}
                  disabled={!engineState.isStarted}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-[#141713] hover:bg-[#f6d87b] transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md active:scale-95"
                >
                  {engineState.isPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-current" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 fill-current" /> Pause
                    </>
                  )}
                </button>

                <button
                  onClick={handleSkip}
                  disabled={!engineState.isStarted}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#476127] text-white hover:bg-[#5d7c35] transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-md"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip Song
                </button>
              </div>

              {/* Crossfade timing controller */}
              <div className="flex items-center gap-2 text-xs text-[#c4beb4]">
                <span>Blend:</span>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={crossfadeSec}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCrossfadeSec(val);
                    engine.updateConfig({ ...config, crossfadeSeconds: val });
                  }}
                  className="w-20 accent-[#f6d87b] cursor-pointer"
                  title="Crossfade duration in seconds"
                  aria-label="Crossfade duration"
                />
                <span className="font-mono text-[#f6d87b] font-bold w-6">{crossfadeSec}s</span>
              </div>
            </div>
          </div>

          {/* Dual Turntable Matrix: Deck A vs Deck B Crossfader */}
          <div className="bg-[#1D211B] border border-[#2B3128] rounded-3xl p-5 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#c4beb4]">
              <span>Dual Deck Matrix</span>
              <span className="font-mono text-[#f6d87b]">
                Deck A ({Math.round(engineState.deckAGain * 100)}%) ◄► Deck B ({Math.round(engineState.deckBGain * 100)}%)
              </span>
            </div>

            {/* Deck Visual Cards Side by Side */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              
              {/* Deck A */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  engineState.deckAActive
                    ? 'bg-[#252C21] border-[#476127] shadow-lg shadow-green-950/30'
                    : 'bg-[#181B16] border-[#2B3128] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-mono text-[#f6d87b]">DECK A</span>
                  <span className={`w-2 h-2 rounded-full ${engineState.deckAActive ? 'bg-emerald-400 animate-ping' : 'bg-gray-600'}`} />
                </div>
                <div className="h-1.5 w-full bg-[#1D211B] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-200"
                    style={{ width: `${Math.round(engineState.deckAGain * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[#c4beb4] truncate">
                  {engineState.deckAActive ? (engineState.nowPlaying?.title || 'Active Deck') : 'Fading / Standby'}
                </p>
              </div>

              {/* Deck B */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  engineState.deckBActive
                    ? 'bg-[#252C21] border-[#476127] shadow-lg shadow-green-950/30'
                    : 'bg-[#181B16] border-[#2B3128] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-mono text-[#f6d87b]">DECK B</span>
                  <span className={`w-2 h-2 rounded-full ${engineState.deckBActive ? 'bg-emerald-400 animate-ping' : 'bg-gray-600'}`} />
                </div>
                <div className="h-1.5 w-full bg-[#1D211B] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-200"
                    style={{ width: `${Math.round(engineState.deckBGain * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[#c4beb4] truncate">
                  {engineState.deckBActive ? (engineState.nowPlaying?.title || 'Active Deck') : 'Fading / Standby'}
                </p>
              </div>
            </div>

            {/* Crossfader Visual Slider Bar */}
            <div className="pt-2">
              <div className="flex justify-between text-[11px] text-[#c4beb4] mb-1 font-mono">
                <span>◀ Deck A</span>
                <span>Crossfader Energy Balance ({crossfadeBalance}%)</span>
                <span>Deck B ▶</span>
              </div>
              <div className="relative h-4 bg-[#141713] rounded-full border border-[#2B3128] flex items-center px-1">
                <div
                  className="h-2.5 w-8 rounded-full bg-[#f6d87b] shadow-md transition-all duration-150 transform -translate-x-1/2"
                  style={{ left: `${crossfadeBalance}%` }}
                />
              </div>
            </div>
          </div>

          {/* Up Next Preview Card */}
          {engineState.nextTrack && (
            <div className="bg-[#1D211B] border border-[#2B3128] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#252A23] overflow-hidden shrink-0 flex items-center justify-center">
                  {engineState.nextTrack.art ? (
                    <img src={engineState.nextTrack.art} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-5 h-5 text-[#f6d87b]" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#f6d87b]">
                    Up Next Cued:
                  </span>
                  <p className="text-xs font-semibold text-white truncate">
                    {engineState.nextTrack.title}
                  </p>
                  <p className="text-[11px] text-[#c4beb4] truncate">
                    {engineState.nextTrack.artist}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#2B3128] text-white shrink-0">
                Auto-Fade In
              </span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Up Next Queue & Host Management (Sticky Shelf) */}
        <div className="space-y-4 lg:sticky lg:top-20">
          
          <div className="bg-[#1D211B] border border-[#2B3128] rounded-3xl p-5 shadow-xl space-y-4">
            
            {/* Header & Tabs */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <span>Guest Queue</span>
                  <span className="text-xs font-mono font-bold bg-[#476127] text-white px-2 py-0.5 rounded-full">
                    {activeQueue.length}
                  </span>
                </h3>
                <p className="text-[11px] text-[#c4beb4]">
                  ~{activeQueue.length * 3.5} min of guest music
                </p>
              </div>

              {/* Shuffle Button */}
              <button
                onClick={handleShuffle}
                disabled={activeQueue.length < 2}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#252A23] text-[#f6d87b] border border-[#343B30] hover:bg-[#2B3128] transition-all disabled:opacity-40"
                title="Shuffle guest requests"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>
            </div>

            {/* Queue / History Subtabs */}
            <div className="flex bg-[#141713] p-1 rounded-xl border border-[#2B3128]">
              <button
                onClick={() => setActiveQueueTab('queue')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeQueueTab === 'queue'
                    ? 'bg-[#2B3128] text-white shadow-xs'
                    : 'text-[#c4beb4] hover:text-white'
                }`}
              >
                Waiting ({activeQueue.length})
              </button>
              <button
                onClick={() => setActiveQueueTab('history')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeQueueTab === 'history'
                    ? 'bg-[#2B3128] text-white shadow-xs'
                    : 'text-[#c4beb4] hover:text-white'
                }`}
              >
                Played ({playedHistory.length})
              </button>
            </div>

            {/* Queue List Content */}
            {activeQueueTab === 'queue' ? (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#2B3128]">
                {activeQueue.length === 0 ? (
                  <div className="text-center py-8 space-y-2 text-[#c4beb4]">
                    <Clock className="w-8 h-8 mx-auto text-[#756c64]" />
                    <p className="text-xs font-semibold">No guest songs waiting right now</p>
                    <p className="text-[11px] text-[#756c64]">
                      Base playlist is active. Guests can scan the QR code to add tracks!
                    </p>
                  </div>
                ) : (
                  activeQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-[#252A23] border border-[#343B30] rounded-xl p-2.5 flex items-center gap-2.5 hover:border-[#476127] transition-all group"
                    >
                      <span className="w-5 text-center text-xs font-mono font-bold text-[#f6d87b]">
                        #{idx + 1}
                      </span>

                      <div className="w-10 h-10 rounded-lg bg-[#141713] overflow-hidden shrink-0 flex items-center justify-center">
                        {item.art ? (
                          <img src={item.art} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Disc className="w-4 h-4 text-[#c4beb4]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-[#c4beb4] truncate">
                          {item.artist}
                        </p>
                      </div>

                      {/* Promoted / Bump Action */}
                      <button
                        onClick={() => handlePlayFirst(item)}
                        className="p-1.5 rounded-lg bg-[#141713] text-[#f6d87b] hover:bg-[#476127] hover:text-white transition-colors"
                        title="Bump to play next"
                        aria-label="Play next"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete / Skip Queued Song */}
                      <button
                        onClick={() => handleRemoveSong(item)}
                        className="p-1.5 rounded-lg bg-[#141713] text-red-400 hover:bg-red-900/40 transition-colors"
                        title="Remove from queue"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Played History List */
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {playedHistory.length === 0 ? (
                  <p className="text-center py-6 text-xs text-[#c4beb4]">
                    No songs have finished playing yet.
                  </p>
                ) : (
                  playedHistory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#181B16] border border-[#2B3128] rounded-xl p-2.5 flex items-center gap-2.5 opacity-80"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#141713] overflow-hidden shrink-0">
                        {item.art && <img src={item.art} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                        <p className="text-[10px] text-[#c4beb4] truncate">{item.artist}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {item.playedAt ? new Date(item.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Played'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Clear Queue Action */}
            <div className="pt-2 border-t border-[#2B3128] flex items-center justify-between">
              <span className="text-[11px] text-[#756c64]">DJ Deck Management</span>
              <button
                onClick={handleClearQueue}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Queue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
