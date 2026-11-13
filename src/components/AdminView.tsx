import React, { useState } from 'react';
import { JukeboxConfig } from '../types';
import { saveConfig } from '../config';
import { Shield, Ban, Users, Settings } from 'lucide-react';

interface AdminViewProps {
  config: JukeboxConfig;
  onUpdateConfig: (cfg: JukeboxConfig) => void;
  onOpenConfig: () => void;
  showToast: (msg: string) => void;
}

// Set these before the party. Live playback is controlled from the Host console.
export const AdminView: React.FC<AdminViewProps> = ({
  config,
  onUpdateConfig,
  onOpenConfig,
  showToast
}) => {
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#b85433] text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#2B2622]">Setup</h1>
          </div>
          <p className="text-xs text-[#756c64] mt-1">
            Set these before the party. Changes apply to new guest requests.
          </p>
        </div>

        <button
          onClick={onOpenConfig}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#2B2622] text-white hover:bg-black transition-colors shadow-xs shrink-0"
        >
          <Settings className="w-4 h-4" />
          <span>Wedding Details</span>
        </button>
      </div>

      {/* Card 1: Guest Request Rules */}
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

      {/* Card 2: Banned Words / Prohibited Songs Filter */}
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
    </div>
  );
};
