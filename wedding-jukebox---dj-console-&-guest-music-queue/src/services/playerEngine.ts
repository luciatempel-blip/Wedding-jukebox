import { JukeboxConfig, NowPlaying, SongItem } from '../types';
import { resolveYouTubeVideo, fetchPlaylistVideos } from './api';
import { fetchQueue, updateQueueSong, saveSettingsPatch } from './db';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    documentPictureInPicture?: {
      requestWindow: (options: { width: number; height: number }) => Promise<Window>;
      window?: Window;
    };
  }
}

export type PlayerStateCallback = (state: {
  nowPlaying: NowPlaying | null;
  deckAActive: boolean;
  deckBActive: boolean;
  deckAGain: number;
  deckBGain: number;
  isStarted: boolean;
  isPaused: boolean;
  masterVolume: number;
  currentTime: number;
  duration: number;
  nextTrack: { title: string; artist: string; art?: string; requested?: boolean } | null;
  wakeLockActive: boolean;
  pipActive: boolean;
  statusMessage: string;
}) => void;

class PlayerEngine {
  private config: JukeboxConfig;
  private subscribers = new Set<PlayerStateCallback>();

  private playerA: any = null;
  private playerB: any = null;
  private ytReady = false;

  private currentDeck: 0 | 1 = 0; // 0 = A, 1 = B
  private isStarted = false;
  private isPaused = false;
  private masterVolume = 100;
  private deckAGain = 0;
  private deckBGain = 0;

  private nowItem: (NowPlaying & { id?: string }) | null = null;
  private nextItem: { title: string; artist: string; art?: string; videoId?: string; requested?: boolean; id?: string } | null = null;

  private basePlaylist: { title: string; artist: string; videoId: string; art?: string }[] = [];
  private basePool: { title: string; artist: string; videoId: string; art?: string }[] = [];

  private tickTimer: any = null;
  private publishTimer: any = null;
  private fadeIntervalA: any = null;
  private fadeIntervalB: any = null;
  private wakeLock: any = null;
  private wakeLockActive = false;

  // Virtual demo timers
  private demoA = { playing: false, elapsed: 0, since: 0, duration: 200, title: '', artist: '', art: '' };
  private demoB = { playing: false, elapsed: 0, since: 0, duration: 200, title: '', artist: '', art: '' };

  // PiP reference
  private pipWindow: Window | null = null;
  private pipVideoEl: HTMLVideoElement | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
  private pipCanvasInterval: any = null;

  private statusMessage = 'Ready to start';

  constructor(config: JukeboxConfig) {
    this.config = config;
    this.initYouTube();
    this.initSilentAudio();
    this.startLoop();
  }

  public updateConfig(config: JukeboxConfig) {
    this.config = config;
    if (this.basePlaylist.length === 0) {
      this.loadBasePlaylist();
    }
  }

  public subscribe(cb: PlayerStateCallback) {
    this.subscribers.add(cb);
    this.emit();
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private emit() {
    const curTime = this.getCurrentTime();
    const curDur = this.getDuration();

    const state = {
      nowPlaying: this.nowItem,
      deckAActive: this.currentDeck === 0,
      deckBActive: this.currentDeck === 1,
      deckAGain: this.deckAGain,
      deckBGain: this.deckBGain,
      isStarted: this.isStarted,
      isPaused: this.isPaused,
      masterVolume: this.masterVolume,
      currentTime: curTime,
      duration: curDur,
      nextTrack: this.nextItem,
      wakeLockActive: this.wakeLockActive,
      pipActive: !!(this.pipWindow || (document.pictureInPictureElement && document.pictureInPictureElement === this.pipVideoEl)),
      statusMessage: this.statusMessage
    };

    for (const sub of this.subscribers) {
      try {
        sub(state);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }

    this.updatePiPContent();
  }

  private initYouTube() {
    if (window.YT && window.YT.Player) {
      this.ytReady = true;
    } else {
      window.onYouTubeIframeAPIReady = () => {
        this.ytReady = true;
      };
    }
  }

  public mountYouTubeDecks(containerAId: string, containerBId: string) {
    if (!this.ytReady || !window.YT) {
      setTimeout(() => this.mountYouTubeDecks(containerAId, containerBId), 400);
      return;
    }

    const vars = {
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      controls: 0,
      fs: 0,
      disablekb: 1,
      origin: window.location.origin
    };

    try {
      this.playerA = new window.YT.Player(containerAId, {
        width: '100%',
        height: '100%',
        playerVars: vars,
        events: {
          onReady: () => {
            this.statusMessage = 'Deck A Ready';
            this.emit();
          },
          onStateChange: (e: any) => this.onPlayerStateChange(0, e.data),
          onError: (e: any) => this.onPlayerError(0, e.data)
        }
      });

      this.playerB = new window.YT.Player(containerBId, {
        width: '100%',
        height: '100%',
        playerVars: vars,
        events: {
          onReady: () => {
            this.statusMessage = 'Deck B Ready';
            this.emit();
          },
          onStateChange: (e: any) => this.onPlayerStateChange(1, e.data),
          onError: (e: any) => this.onPlayerError(1, e.data)
        }
      });
    } catch (err) {
      console.warn('YouTube player mount fallback:', err);
    }
  }

  private onPlayerStateChange(deck: 0 | 1, state: number) {
    // 0 = ENDED, 1 = PLAYING, 2 = PAUSED
    if (state === 0 && deck === this.currentDeck) {
      this.advanceTrack(this.config.skipFadeSeconds || 2);
    }
    this.emit();
  }

  private onPlayerError(deck: 0 | 1, code: number) {
    console.warn(`Deck ${deck} error code ${code}`);
    if (deck === this.currentDeck) {
      this.statusMessage = `Skipped unplayable song (YouTube error ${code})`;
      setTimeout(() => this.advanceTrack(1), 1000);
    }
  }

  private initSilentAudio() {
    // Keeps mobile WebKit audio session alive in the background
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001; // virtually inaudible
        osc.connect(gain);
        gain.connect(ctx.destination);
        // Resumed on user interaction
        const unlock = () => {
          if (ctx.state === 'suspended') ctx.resume();
          document.removeEventListener('click', unlock);
          document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
      }
    } catch (e) {
      // ignore
    }
  }

  public async startMusic() {
    this.isStarted = true;
    this.isPaused = false;
    this.statusMessage = 'Loading music...';
    this.emit();

    await this.loadBasePlaylist();
    await this.advanceTrack(0);
    this.requestWakeLock();
  }

  public async loadBasePlaylist() {
    if (!this.config.basePlaylistId || !this.config.youtubeApiKey) return;
    try {
      this.basePlaylist = await fetchPlaylistVideos(
        this.config.basePlaylistId,
        this.config.youtubeApiKey,
        150
      );
      this.statusMessage = `Loaded ${this.basePlaylist.length} base songs`;
      this.emit();
    } catch (e: any) {
      this.statusMessage = `Base playlist note: ${e.message || 'using demo'}`;
      this.emit();
    }
  }

  private getNextBaseSong() {
    if (this.basePlaylist.length === 0) return null;
    if (this.basePool.length === 0) {
      // Shuffle base playlist
      this.basePool = [...this.basePlaylist].sort(() => Math.random() - 0.5);
    }
    return this.basePool.shift() || null;
  }

  private async fetchNextCandidate(): Promise<{
    id?: string;
    title: string;
    artist: string;
    art?: string;
    videoId: string;
    requested?: boolean;
    durationMs?: number;
  } | null> {
    try {
      const queue = await fetchQueue(this.config);
      const activeRequests = queue.filter(s => !s.played && !s.failed);

      for (const item of activeRequests.slice(0, 4)) {
        try {
          let vid = item.videoId;
          if (!vid) {
            vid = await resolveYouTubeVideo(
              item.title,
              item.artist,
              this.config.youtubeApiKey,
              this.config.regionCode
            );
            await updateQueueSong(this.config, item.id, { videoId: vid });
          }
          await updateQueueSong(this.config, item.id, { played: true, playedAt: Date.now() });
          return {
            id: item.id,
            title: item.title,
            artist: item.artist,
            art: item.art,
            videoId: vid,
            requested: true,
            durationMs: item.durationMs
          };
        } catch (err: any) {
          await updateQueueSong(this.config, item.id, {
            failed: true,
            failReason: String(err?.message || err)
          });
        }
      }
    } catch (e) {
      console.warn('Queue lookup error, using base playlist', e);
    }

    const base = this.getNextBaseSong();
    if (base) {
      return {
        title: base.title,
        artist: base.artist,
        art: base.art,
        videoId: base.videoId,
        requested: false
      };
    }

    return null;
  }

  public async advanceTrack(fadeSec: number = 8) {
    if (!this.isStarted) return;
    this.statusMessage = 'Transitioning decks...';
    this.emit();

    const nextTrack = await this.fetchNextCandidate();
    const oldDeck = this.currentDeck;
    const newDeck = (oldDeck === 0 ? 1 : 0) as 0 | 1;

    if (!nextTrack) {
      this.statusMessage = 'End of playlist and queue';
      this.fadeDeck(oldDeck, 0, fadeSec, () => {
        this.stopDeck(oldDeck);
      });
      this.nowItem = null;
      this.emit();
      this.syncNowPlayingToSettings();
      return;
    }

    this.currentDeck = newDeck;
    this.nowItem = {
      id: nextTrack.id,
      title: nextTrack.title,
      artist: nextTrack.artist,
      art: nextTrack.art,
      videoId: nextTrack.videoId,
      duration: Math.round((nextTrack.durationMs || 210000) / 1000),
      pos: 0,
      at: Date.now(),
      paused: false,
      requested: nextTrack.requested
    };

    // Load and play new deck
    this.loadAndPlayDeck(newDeck, nextTrack.videoId, nextTrack);
    this.fadeDeck(newDeck, 1, fadeSec);
    this.fadeDeck(oldDeck, 0, fadeSec, () => {
      this.stopDeck(oldDeck);
    });

    this.statusMessage = `Playing: ${nextTrack.title}`;
    this.updateMediaSession(this.nowItem);
    this.emit();
    this.syncNowPlayingToSettings();

    // Pre-resolve next track in queue for instant warm transition
    setTimeout(() => this.peekNextTrack(), 3000);
  }

  private async peekNextTrack() {
    try {
      const queue = await fetchQueue(this.config);
      const active = queue.filter(s => !s.played && !s.failed);
      if (active.length > 0) {
        this.nextItem = {
          id: active[0].id,
          title: active[0].title,
          artist: active[0].artist,
          art: active[0].art,
          requested: true
        };
      } else if (this.basePlaylist.length > 0) {
        const nextBase = this.basePlaylist[0];
        this.nextItem = {
          title: nextBase.title,
          artist: nextBase.artist,
          art: nextBase.art,
          requested: false
        };
      } else {
        this.nextItem = null;
      }
      this.emit();
    } catch {
      // ignore
    }
  }

  private loadAndPlayDeck(deck: 0 | 1, videoId: string, meta: any) {
    const p = deck === 0 ? this.playerA : this.playerB;
    if (p && typeof p.loadVideoById === 'function') {
      try {
        p.loadVideoById(videoId);
        p.playVideo();
        return;
      } catch (e) {
        console.warn('Real deck play error:', e);
      }
    }

    // Demo simulation fallback
    const targetDemo = deck === 0 ? this.demoA : this.demoB;
    targetDemo.playing = true;
    targetDemo.elapsed = 0;
    targetDemo.since = Date.now();
    targetDemo.duration = Math.round((meta.durationMs || 220000) / 1000);
    targetDemo.title = meta.title;
    targetDemo.artist = meta.artist;
    targetDemo.art = meta.art;
  }

  private fadeDeck(deck: 0 | 1, targetGain: number, durationSec: number, onComplete?: () => void) {
    const isDeckA = deck === 0;
    const intervalRef = isDeckA ? this.fadeIntervalA : this.fadeIntervalB;
    if (intervalRef) clearInterval(intervalRef);

    const fromGain = isDeckA ? this.deckAGain : this.deckBGain;
    const startTime = Date.now();
    const durationMs = Math.max(durationSec * 1000, 100);

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Equal power curve
      const factor = targetGain > fromGain
        ? Math.sin(progress * Math.PI / 2)
        : 1 - Math.cos(progress * Math.PI / 2);
      const currentGain = fromGain + (targetGain - fromGain) * factor;

      if (isDeckA) {
        this.deckAGain = currentGain;
        this.applyDeckVolume(0, currentGain);
      } else {
        this.deckBGain = currentGain;
        this.applyDeckVolume(1, currentGain);
      }

      if (progress >= 1) {
        if (isDeckA) {
          clearInterval(this.fadeIntervalA);
          this.fadeIntervalA = null;
        } else {
          clearInterval(this.fadeIntervalB);
          this.fadeIntervalB = null;
        }
        if (onComplete) onComplete();
      }
      this.emit();
    };

    if (isDeckA) {
      this.fadeIntervalA = setInterval(step, 80);
    } else {
      this.fadeIntervalB = setInterval(step, 80);
    }
  }

  private applyDeckVolume(deck: 0 | 1, gain: number) {
    const vol = Math.round(gain * this.masterVolume);
    const p = deck === 0 ? this.playerA : this.playerB;
    if (p && typeof p.setVolume === 'function') {
      try {
        p.setVolume(vol);
      } catch (e) {
        // ignore
      }
    }
  }

  private stopDeck(deck: 0 | 1) {
    if (deck === 0) {
      this.deckAGain = 0;
      this.demoA.playing = false;
      if (this.playerA && typeof this.playerA.stopVideo === 'function') {
        try { this.playerA.stopVideo(); } catch {}
      }
    } else {
      this.deckBGain = 0;
      this.demoB.playing = false;
      if (this.playerB && typeof this.playerB.stopVideo === 'function') {
        try { this.playerB.stopVideo(); } catch {}
      }
    }
    this.emit();
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(100, Math.round(vol)));
    this.applyDeckVolume(0, this.deckAGain);
    this.applyDeckVolume(1, this.deckBGain);
    this.emit();
    saveSettingsPatch(this.config, { volume: this.masterVolume });
  }

  public togglePlayPause() {
    this.setPaused(!this.isPaused);
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    const curP = this.currentDeck === 0 ? this.playerA : this.playerB;
    const curDemo = this.currentDeck === 0 ? this.demoA : this.demoB;

    if (paused) {
      if (curP && typeof curP.pauseVideo === 'function') {
        try { curP.pauseVideo(); } catch {}
      }
      if (curDemo.playing) {
        curDemo.elapsed += (Date.now() - curDemo.since) / 1000;
        curDemo.playing = false;
      }
      this.statusMessage = 'Music Paused';
    } else {
      if (curP && typeof curP.playVideo === 'function') {
        try { curP.playVideo(); } catch {}
      }
      if (!curDemo.playing && curDemo.title) {
        curDemo.since = Date.now();
        curDemo.playing = true;
      }
      this.statusMessage = 'Playing';
    }

    if (this.nowItem) {
      this.nowItem.paused = paused;
    }

    this.emit();
    this.syncNowPlayingToSettings();
  }

  public skipCurrentTrack() {
    const fade = this.config.skipFadeSeconds || 2;
    this.advanceTrack(fade);
  }

  public getCurrentTime(): number {
    const p = this.currentDeck === 0 ? this.playerA : this.playerB;
    if (p && typeof p.getCurrentTime === 'function') {
      try {
        return p.getCurrentTime() || 0;
      } catch {}
    }
    const d = this.currentDeck === 0 ? this.demoA : this.demoB;
    return d.playing ? d.elapsed + (Date.now() - d.since) / 1000 : d.elapsed;
  }

  public getDuration(): number {
    const p = this.currentDeck === 0 ? this.playerA : this.playerB;
    if (p && typeof p.getDuration === 'function') {
      try {
        const d = p.getDuration();
        if (d > 0) return d;
      } catch {}
    }
    const d = this.currentDeck === 0 ? this.demoA : this.demoB;
    return d.duration || (this.nowItem?.duration || 210);
  }

  private startLoop() {
    this.tickTimer = setInterval(() => {
      if (!this.isStarted || this.isPaused || !this.nowItem) return;

      const dur = this.getDuration();
      const pos = this.getCurrentTime();

      if (dur > 0 && pos > 0) {
        const remaining = dur - pos;
        const xfade = this.config.crossfadeSeconds || 8;

        // Auto trigger crossfade when song is about to end
        if (xfade > 0 && remaining <= xfade && remaining > 0 && dur > xfade * 2) {
          this.advanceTrack(xfade);
        } else if (remaining <= 0.5) {
          this.advanceTrack(1.5);
        }
      }

      this.emit();
    }, 400);

    // Sync to remote database every 5 seconds
    this.publishTimer = setInterval(() => {
      this.syncNowPlayingToSettings();
    }, 5000);
  }

  private async syncNowPlayingToSettings() {
    if (!this.nowItem || !this.isStarted) {
      saveSettingsPatch(this.config, { now: null, musicPaused: this.isPaused, volume: this.masterVolume });
      return;
    }

    const payload: NowPlaying = {
      title: this.nowItem.title,
      artist: this.nowItem.artist || '',
      art: this.nowItem.art || '',
      duration: Math.round(this.getDuration()),
      pos: Math.round(this.getCurrentTime()),
      at: Date.now(),
      paused: this.isPaused,
      requested: !!this.nowItem.requested,
      videoId: this.nowItem.videoId
    };

    saveSettingsPatch(this.config, {
      now: payload,
      musicPaused: this.isPaused,
      volume: this.masterVolume
    });
  }

  /* ---------- Media Session API (Lock Screen & Background Audio) ---------- */
  private updateMediaSession(song: NowPlaying) {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: 'Rudi & Lucia Wedding Jukebox',
        artwork: song.art ? [
          { src: song.art, sizes: '96x96', type: 'image/jpeg' },
          { src: song.art, sizes: '256x256', type: 'image/jpeg' },
          { src: song.art, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });

      navigator.mediaSession.playbackState = this.isPaused ? 'paused' : 'playing';

      navigator.mediaSession.setActionHandler('play', () => this.setPaused(false));
      navigator.mediaSession.setActionHandler('pause', () => this.setPaused(true));
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skipCurrentTrack());
    } catch (e) {
      console.warn('MediaSession error', e);
    }
  }

  /* ---------- Screen Wake Lock API ---------- */
  public async toggleWakeLock(): Promise<boolean> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        this.wakeLockActive = false;
        this.emit();
        return false;
      } catch {}
    }

    return this.requestWakeLock();
  }

  public async requestWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLockActive = true;
        this.wakeLock.addEventListener('release', () => {
          this.wakeLockActive = false;
          this.emit();
        });
        this.emit();
        return true;
      } catch (err) {
        console.warn('Wake Lock request error', err);
      }
    }
    return false;
  }

  /* ---------- Picture-in-Picture (PiP) ---------- */
  public async togglePiP(): Promise<boolean> {
    // 1. Try Document Picture-in-Picture API (Chrome/Edge desktop)
    if (window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function') {
      if (this.pipWindow) {
        this.pipWindow.close();
        this.pipWindow = null;
        this.emit();
        return false;
      }

      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 360,
          height: 220
        });
        this.pipWindow = pipWin;

        pipWin.addEventListener('pagehide', () => {
          this.pipWindow = null;
          this.emit();
        });

        this.setupDocumentPiP(pipWin);
        this.emit();
        return true;
      } catch (e) {
        console.warn('Document PiP failed, trying Canvas Video PiP fallback:', e);
      }
    }

    // 2. Video Picture-in-Picture Fallback (Safari, Firefox, Mobile/Desktop video PiP)
    return this.toggleVideoPiP();
  }

  private setupDocumentPiP(win: Window) {
    // Inject styles
    const style = win.document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      body { background: #191c18; color: #fbf8f3; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; height: 100vh; overflow: hidden; user-select: none; }
      .row { display: flex; align-items: center; gap: 12px; }
      .art { width: 56px; height: 56px; border-radius: 10px; background: #343a31; object-fit: cover; flex-shrink: 0; }
      .meta { flex: 1; min-width: 0; }
      .title { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .artist { color: #c4beb4; font-size: 13px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bar-wrap { height: 6px; background: #343a31; border-radius: 99px; overflow: hidden; margin: 10px 0 6px; }
      .bar-fill { height: 100%; width: 0%; background: #f6d87b; border-radius: 99px; transition: width .3s linear; }
      .controls { display: flex; align-items: center; justify-content: space-between; }
      .btn { background: #343a31; color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; font-size: 13px; }
      .btn.primary { background: #476127; }
      .time { font-size: 11px; color: #c4beb4; }
    `;
    win.document.head.appendChild(style);

    win.document.body.innerHTML = `
      <div class="row">
        <img id="pipArt" class="art" src="${this.nowItem?.art || ''}" alt="" />
        <div class="meta">
          <div id="pipTitle" class="title">${this.nowItem?.title || 'Waiting to start...'}</div>
          <div id="pipArtist" class="artist">${this.nowItem?.artist || 'DJ Console'}</div>
        </div>
      </div>
      <div class="bar-wrap"><div id="pipFill" class="bar-fill"></div></div>
      <div class="controls">
        <span id="pipTime" class="time">0:00 / 0:00</span>
        <div style="display:flex;gap:8px;">
          <button id="pipPlayBtn" class="btn primary">${this.isPaused ? '▶ Play' : '⏸ Pause'}</button>
          <button id="pipSkipBtn" class="btn">⏭ Skip</button>
        </div>
      </div>
    `;

    const playBtn = win.document.getElementById('pipPlayBtn');
    const skipBtn = win.document.getElementById('pipSkipBtn');

    if (playBtn) playBtn.onclick = () => this.togglePlayPause();
    if (skipBtn) skipBtn.onclick = () => this.skipCurrentTrack();

    this.updatePiPContent();
  }

  private updatePiPContent() {
    if (!this.pipWindow) return;
    const doc = this.pipWindow.document;
    if (!doc) return;

    const titleEl = doc.getElementById('pipTitle');
    const artistEl = doc.getElementById('pipArtist');
    const artEl = doc.getElementById('pipArt') as HTMLImageElement;
    const fillEl = doc.getElementById('pipFill');
    const timeEl = doc.getElementById('pipTime');
    const playBtn = doc.getElementById('pipPlayBtn');

    if (titleEl) titleEl.textContent = this.nowItem?.title || 'Waiting to start...';
    if (artistEl) artistEl.textContent = this.nowItem?.artist || 'Rudi & Lucia Wedding';
    if (artEl && this.nowItem?.art) artEl.src = this.nowItem.art;

    const cur = this.getCurrentTime();
    const dur = this.getDuration();

    if (fillEl && dur > 0) {
      fillEl.style.width = `${Math.min(100, (cur / dur) * 100).toFixed(1)}%`;
    }
    if (timeEl) {
      const format = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
      };
      timeEl.textContent = `${format(cur)} / ${format(dur)}`;
    }
    if (playBtn) {
      playBtn.textContent = this.isPaused ? '▶ Play' : '⏸ Pause';
    }
  }

  private async toggleVideoPiP(): Promise<boolean> {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      this.emit();
      return false;
    }

    if (!document.pictureInPictureEnabled) {
      alert('Picture-in-Picture is not supported on this browser.');
      return false;
    }

    try {
      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 480;
        this.pipCanvas.height = 300;
      }
      if (!this.pipVideoEl) {
        this.pipVideoEl = document.createElement('video');
        this.pipVideoEl.muted = true;
        this.pipVideoEl.playsInline = true;
        (this.pipVideoEl as any).srcObject = (this.pipCanvas as any).captureStream(15);
      }

      await this.pipVideoEl.play();

      this.pipCanvasInterval = setInterval(() => {
        if (!this.pipCanvas) return;
        const ctx = this.pipCanvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#191c18';
        ctx.fillRect(0, 0, 480, 300);

        // Header
        ctx.fillStyle = '#f6d87b';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('WEDDING JUKEBOX · DJ CONSOLE', 20, 36);

        // Track title
        ctx.fillStyle = '#fbf8f3';
        ctx.font = 'bold 22px Georgia, serif';
        const title = this.nowItem?.title || 'Waiting to start...';
        ctx.fillText(title.length > 28 ? title.slice(0, 26) + '...' : title, 20, 80);

        // Artist
        ctx.fillStyle = '#c4beb4';
        ctx.font = '16px sans-serif';
        const artist = this.nowItem?.artist || 'Rudi and Lucia';
        ctx.fillText(artist.length > 32 ? artist.slice(0, 30) + '...' : artist, 20, 114);

        // Status
        ctx.fillStyle = this.isPaused ? '#e57373' : '#81c784';
        ctx.font = '14px sans-serif';
        ctx.fillText(this.isPaused ? '⏸ PAUSED' : '▶ LIVE PLAYING', 20, 150);

        // Progress bar
        const cur = this.getCurrentTime();
        const dur = this.getDuration();
        const pct = dur > 0 ? Math.min(1, cur / dur) : 0;

        ctx.fillStyle = '#343a31';
        ctx.fillRect(20, 200, 440, 12);
        ctx.fillStyle = '#f6d87b';
        ctx.fillRect(20, 200, 440 * pct, 12);

        // Time
        const format = (s: number) => {
          const m = Math.floor(s / 60);
          const sec = Math.floor(s % 60);
          return `${m}:${sec < 10 ? '0' : ''}${sec}`;
        };
        ctx.fillStyle = '#c4beb4';
        ctx.font = '13px monospace';
        ctx.fillText(`${format(cur)} / ${format(dur)}`, 20, 240);
      }, 250);

      await this.pipVideoEl.requestPictureInPicture();
      this.pipVideoEl.addEventListener('leavepictureinpicture', () => {
        clearInterval(this.pipCanvasInterval);
        this.emit();
      });

      this.emit();
      return true;
    } catch (e: any) {
      console.warn('Video PiP failed:', e);
      return false;
    }
  }
}

// Global Singleton instance
let playerInstance: PlayerEngine | null = null;

export function getPlayerEngine(config: JukeboxConfig): PlayerEngine {
  if (!playerInstance) {
    playerInstance = new PlayerEngine(config);
  } else {
    playerInstance.updateConfig(config);
  }
  return playerInstance;
}
