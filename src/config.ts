import { JukeboxConfig } from './types';

export const DEFAULT_CONFIG: JukeboxConfig = {
  coupleNames: "Rudi and Lucia",
  siteTitle: "Scheepers JukeBox",
  replayAfterMinutes: 30,
  firebaseDbUrl: import.meta.env.VITE_FIREBASE_DB_URL || "https://example.firebaseio.com/",
  youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY || "MY_YOUTUBE_API_KEY",
  basePlaylistId: "PLC9pq_EfiiU0", // optional; if no live API key is configured, the app falls back to the curated party playlist
  adminPin: "20260106",
  maxSongsPerGuest: 0, // 0 = unlimited
  blockExplicit: false,
  bannedWords: ["celine dion"],
  regionCode: "ZA",
  musicOnly: false,
  suggestionArtists: ["Kurt Darren", "DJ Kent", "Mi Casa", "Francois van Coke", "Bernice West", "Black Coffee", "Master KG"],
  crossfadeSeconds: 8,
  skipFadeSeconds: 3,
};

const CONFIG_STORAGE_KEY = 'wedding_jukebox_config_v2';

export function loadConfig(): JukeboxConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to read config from localStorage', e);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: JukeboxConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to write config to localStorage', e);
  }
}
