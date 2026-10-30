export interface JukeboxConfig {
  coupleNames: string;
  siteTitle: string;
  replayAfterMinutes: number;
  firebaseDbUrl: string;
  youtubeApiKey: string;
  basePlaylistId: string;
  adminPin: string;
  maxSongsPerGuest: number;
  blockExplicit: boolean;
  bannedWords: string[];
  regionCode: string;
  musicOnly: boolean;
  suggestionArtists: string[];
  crossfadeSeconds: number;
  skipFadeSeconds: number;
}

export interface SongItem {
  id: string;
  key: string;
  title: string;
  artist: string;
  art?: string;
  durationMs?: number;
  videoId?: string;
  order: number;
  played?: boolean;
  playedAt?: number;
  failed?: boolean;
  failReason?: string;
  requesterName?: string;
}

export interface NowPlaying {
  title: string;
  artist: string;
  art?: string;
  duration: number; // in seconds
  pos: number;      // in seconds
  at: number;       // timestamp of update
  paused: boolean;
  requested?: boolean;
  videoId?: string;
}

export interface SettingsState {
  now?: NowPlaying | null;
  paused?: boolean;       // requests paused
  musicPaused?: boolean;  // audio playback paused
  volume?: number;        // 0-100
  skipToken?: number;     // incremented to trigger skip remotely
}

export type ViewMode = 'guest' | 'dj' | 'admin' | 'sign' | 'config';

export interface SuggestionCategory {
  title: string;
  description: string;
  songs: {
    key: string;
    title: string;
    artist: string;
    art?: string;
    durationMs?: number;
  }[];
}
