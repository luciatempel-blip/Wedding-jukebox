import React, { useState } from 'react';
import { JukeboxConfig, SongItem } from '../types';
import { saveConfig } from '../config';
import { saveSettingsPatch, clearEntireQueue, removeQueueSong, shuffleActiveQueue } from '../services/db';
import { getPlayerEngine } from '../services/playerEngine';
import {
  Shield,
  Pause,
  Play,
  SkipForward,
  Volume2,
  Trash2,
  Shuffle,
  Ban,
  Clock,
  Users,
  QrCode,
  Radio,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface AdminViewProps {
  config: JukeboxConfig;
  onUpdateConfig: (cfg: JukeboxConfig) => void;
  queue: SongItem[];
  onRefreshQueue: () => void;
  requestsPaused: boolean;
  onToggleRequestsPaused: () => void;
  onOpenQRSign: () => void;
  showToast: (msg: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  config,
  onUpdateConfig,
  queue,
  onRefreshQueue,
  requestsPaused,
  onToggleRequestsPaused,
  onOpenQRSign,
  showToast
}) => {
  const engine = getPlayerEngine(config);

  const [newBannedWord, setNewBannedWord] = useState('');
  const [bannedWords, setBannedWords] = useState<string[]>(config.bannedWords || []);
  const [replayMinutes, setReplayMinutes] = useState(config.replayAfterMinutes || 30);
  const [maxSongs, setMaxSongs] = useState(config.maxSongsPerGuest || 0);

  const handleAddBanned = (e: React.FormEvent) => {
    e.preventDefault();
    const word = newBannedWord.trim().toLowerCase();
    if (!word || bannedWords.includes(word)) return;
    const updated = [...bannedWords, word];
    setBannedWords(updated);
    setNewBannedWord('');
    const newCfg = { ...config, bannedWords: updated };
    onUpdateConfig(newCfg);
    saveConfig(newCfg);
    showToast(`Added "${word}" to banned filter`);
  };

  const handleRemoveBanned = (word: string) => {
    const updated = bannedWords.filter(w => w !== word);
    setBannedWords(updated);
    const newCfg = { ...config, bannedWords: updated };
    onUpdateConfig(newCfg);
    saveConfig(newCfg);
    showToast(`Removed "${word}" from filter`);
  };

  const handleSaveRules = () => {
    const newCfg: JukeboxConfig = {
      ...config,
      replayAfterMinutes: Number(replayMinutes),
      maxSongsPerGuest: Number(maxSongs)
    };
    onUpdateConfig(newCfg);
    saveConfig(newCfg);
    showToast('Guest request rules updated successfully!');
  };

  const handleRemoteSkip = () => {
    engine.skipCurrentTrack();
    showToast('Triggered remote track skip');
  };

  const handleRemoteTogglePause = () => {
    engine.togglePlayPause();
    showToast('Toggled music pause remotely');
  };

  const handleShuffle = async () => {
    try {
      const n = await shuffleActiveQueue(config);
      showToast(n > 1 ? `Shuffled ${n} requests` : 'Need at least 2 requests');
      onRefreshQueue();
    } catch {
      showToast('Could not shuffle');
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all queued and played songs for the wedding?')) {
      try {
        await clearEntireQueue(config);
        showToast('Queue and history cleared');
        onRefreshQueue();
      } catch {
        showToast('Could not clear queue');
      }
    }
  };

  const activeQueue = queue.filter(s => !s.played && !s.failed);
  const playedQueue = queue.filter(s => s.played);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#b85433] text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#2B2622]">
              Host Administration
            </h1>
          </div>
          <p className="text-xs text-[#756c64] mt-1">
            Remote controls, moderation filters, and wedding queue settings.
          </p>
        </div>

        <button
          onClick={onOpenQRSign}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#476127] text-white hover:bg-[#35491c] transition-colors shadow-xs"
        >
          <QrCode className="w-4 h-4" />
          <span>Print QR Sign</span>
        </button>
      </div>

      {/* Card 1: Remote Player Controls */}
      <div className="bg-white rounded-2xl p-5 border border-[#ebdcd2] shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#2B2622] flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#476127]" />
          Remote Player Actions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleRemoteSkip}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#476127] text-white hover:bg-[#35491c] transition-colors shadow-xs"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip Current Song</span>
          </button>

          <button
            onClick={handleRemoteTogglePause}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#f5e6dc] text-[#2B2622] hover:bg-[#ebdcd2] transition-colors"
          >
            <Pause className="w-4 h-4" />
            <span>Pause / Resume Music</span>
          </button>

          <button
            onClick={onToggleRequestsPaused}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-colors ${
              requestsPaused
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-[#f8ece7] text-[#b85433] hover:bg-[#f3dfd6]'
            }`}
          >
            <span>{requestsPaused ? 'Resume Guest Requests' : 'Pause Guest Requests'}</span>
          </button>
        </div>
      </div>

      {/* Card 2: Guest Request Rules */}
      <div className="bg-white rounded-2xl p-5 border border-[#ebdcd2] shadow-xs space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#2B2622] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#b85433]" />
          Guest Song Limits & Cooldowns
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Replay Cooldown */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#2B2622]">Repeat Cooldown</span>
              <span className="text-[#476127] font-bold">
                {replayMinutes === 0 ? 'No repeats allowed' : `${replayMinutes} Minutes`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={replayMinutes}
              onChange={(e) => setReplayMinutes(Number(e.target.value))}
              className="w-full accent-[#476127] cursor-pointer"
            />
            <p className="text-[11px] text-[#756c64]">
              How long guests must wait before a previously played song can be requested again.
            </p>
          </div>

          {/* Max Songs Per Phone */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#2B2622]">Max Requests Per Guest</span>
              <span className="text-[#476127] font-bold">
                {maxSongs === 0 ? 'Unlimited' : `${maxSongs} Songs`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={maxSongs}
              onChange={(e) => setMaxSongs(Number(e.target.value))}
              className="w-full accent-[#476127] cursor-pointer"
            />
            <p className="text-[11px] text-[#756c64]">
              Soft limit stored on the guest's phone (0 = no limit).
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveRules}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#476127] text-white hover:bg-[#35491c] transition-colors"
        >
          Save Rule Changes
        </button>
      </div>

      {/* Card 3: Banned Words / Prohibited Songs Filter */}
      <div className="bg-white rounded-2xl p-5 border border-[#ebdcd2] shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#2B2622] flex items-center gap-2">
          <Ban className="w-4 h-4 text-red-500" />
          Prohibited Words & Artists
        </h3>
        <p className="text-xs text-[#756c64]">
          Songs with these words in their title or artist cannot be added by guests (e.g. "celine dion", "baby shark").
        </p>

        <form onSubmit={handleAddBanned} className="flex gap-2">
          <input
            type="text"
            value={newBannedWord}
            onChange={(e) => setNewBannedWord(e.target.value)}
            placeholder="Add word or artist (e.g. celine dion)"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#ebdcd2] text-xs outline-hidden focus:border-[#476127]"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2B2622] text-white hover:bg-black transition-colors"
          >
            Add Rule
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-1">
          {bannedWords.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"
            >
              <span>{word}</span>
              <button
                type="button"
                onClick={() => handleRemoveBanned(word)}
                className="hover:text-red-900"
                title="Remove"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Card 4: Queue Management & Danger Zone */}
      <div className="bg-white rounded-2xl p-5 border border-[#ebdcd2] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#2B2622]">
            Queue Management
          </h3>
          <span className="text-xs font-semibold text-[#756c64]">
            {activeQueue.length} Active · {playedQueue.length} Played
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleShuffle}
            disabled={activeQueue.length < 2}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#f5e6dc] text-[#2B2622] hover:bg-[#ebdcd2] transition-colors disabled:opacity-50"
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle Waiting Requests</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Entire Queue & History</span>
          </button>
        </div>
      </div>
    </div>
  );
};
