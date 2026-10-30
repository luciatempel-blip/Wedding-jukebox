import React, { useState } from 'react';
import { JukeboxConfig } from '../types';
import { DEFAULT_CONFIG, saveConfig } from '../config';
import { Settings, Save, RotateCcw, X, Key, Database, Music, Download } from 'lucide-react';

interface ConfigModalProps {
  config: JukeboxConfig;
  onSaveConfig: (cfg: JukeboxConfig) => void;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  config,
  onSaveConfig,
  isOpen,
  onClose,
  showToast
}) => {
  const [form, setForm] = useState<JukeboxConfig>({ ...config });

  if (!isOpen) return null;

  const handleChange = (key: keyof JukeboxConfig, val: any) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(form);
    saveConfig(form);
    showToast('Configuration settings saved!');
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to original Rudi & Lucia defaults?')) {
      setForm({ ...DEFAULT_CONFIG });
      onSaveConfig(DEFAULT_CONFIG);
      saveConfig(DEFAULT_CONFIG);
      showToast('Reset to default settings');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FCFAF5] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#ebdcd2] my-auto space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-[#ebdcd2]">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#476127] text-white flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#f6d87b]" />
            </span>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#2B2622]">
                Jukebox Configuration
              </h2>
              <p className="text-xs text-[#756c64]">Customize wedding details, API keys & playlist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#756c64] hover:bg-[#ebdcd2]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs font-medium">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#2B2622] font-bold mb-1">Couple Names</label>
              <input
                type="text"
                value={form.coupleNames}
                onChange={e => handleChange('coupleNames', e.target.value)}
                className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[#2B2622] font-bold mb-1">Menu Title</label>
              <input
                type="text"
                value={form.siteTitle}
                onChange={e => handleChange('siteTitle', e.target.value)}
                className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#2B2622] font-bold mb-1">
              YouTube Base Playlist ID or URL
            </label>
            <input
              type="text"
              value={form.basePlaylistId}
              onChange={e => handleChange('basePlaylistId', e.target.value)}
              placeholder="e.g. PLC9pq_EfiiU0 or full youtube link"
              className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden"
            />
            <p className="text-[10px] text-[#756c64] mt-1">
              Fills gaps when the guest queue is empty.
            </p>
          </div>

          <div>
            <label className="block text-[#2B2622] font-bold mb-1">
              Firebase Realtime Database URL
            </label>
            <input
              type="text"
              value={form.firebaseDbUrl}
              onChange={e => handleChange('firebaseDbUrl', e.target.value)}
              placeholder="https://your-project-rtdb.firebaseio.com/"
              className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#2B2622] font-bold mb-1">Admin Security PIN</label>
              <input
                type="text"
                value={form.adminPin}
                onChange={e => handleChange('adminPin', e.target.value)}
                className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block text-[#2B2622] font-bold mb-1">Region Code</label>
              <input
                type="text"
                value={form.regionCode}
                onChange={e => handleChange('regionCode', e.target.value)}
                placeholder="ZA, US, GB, etc."
                className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#2B2622] font-bold mb-1">
              YouTube API Key
            </label>
            <input
              type="password"
              value={form.youtubeApiKey}
              onChange={e => handleChange('youtubeApiKey', e.target.value)}
              className="w-full bg-white p-2.5 rounded-xl border border-[#ebdcd2] text-xs focus:border-[#476127] outline-hidden font-mono"
            />
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#ebdcd2]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#b85433] hover:underline flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <a
                href="/wedding-jukebox-vercel.zip"
                download="wedding-jukebox-vercel.zip"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#f5e6dc] text-[#476127] border border-[#ebdcd2] hover:bg-[#ebdcd2] transition-colors"
                title="Download Vercel-ready ZIP"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ZIP</span>
              </a>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#ebdcd2] text-xs font-semibold text-[#756c64] hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#476127] text-white text-xs font-bold hover:bg-[#35491c] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
