import React, { useState, useEffect, useMemo } from 'react';
import { JukeboxConfig, SongItem, NowPlaying } from '../types';
import { searchSongs, SearchResult, CURATED_WEDDING_PICKS } from '../services/api';
import { addQueueSong } from '../services/db';
import { Search, Music, Heart, Sparkles, Check, Clock, Radio, UserCheck, Flame, Disc } from 'lucide-react';
import { Thumbnail } from './Thumbnail';

interface GuestViewProps {
  config: JukeboxConfig;
  nowPlaying: NowPlaying | null;
  queue: SongItem[];
  onSongAdded: () => void;
  requestsPaused: boolean;
  showToast: (msg: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Suggestions', icon: Sparkles },
  { id: 'house', label: 'House & Dance', icon: Flame },
  { id: 'afrikaans', label: 'Afrikaans Treffers', icon: Disc },
  { id: 'party', label: 'Party Favourites', icon: Music },
  { id: 'romantic', label: 'Stadige Dans', icon: Heart },
];

export const GuestView: React.FC<GuestViewProps> = ({
  config,
  nowPlaying,
  queue,
  onSongAdded,
  requestsPaused,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'queue'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [mySongKeys, setMySongKeys] = useState<string[]>([]);
  const [filterMyRequests, setFilterMyRequests] = useState(false);

  // Load "my requested songs" from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('wedding_my_requests') || '[]');
      setMySongKeys(stored);
    } catch {
      setMySongKeys([]);
    }
  }, []);

  const saveMySongKey = (key: string) => {
    const updated = [...mySongKeys, key];
    setMySongKeys(updated);
    try {
      localStorage.setItem('wedding_my_requests', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Perform search with debounce exclusively via YouTube
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchSongs(searchQuery, config, 15);
        setSearchResults(results);
      } catch (err) {
        console.error('YouTube search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, config]);

  // Status helper for a song
  const getSongStatus = (key: string): { isQueued: boolean; isPlayed: boolean; replayMinutesLeft: number } => {
    const replayLimitMs = (config.replayAfterMinutes || 30) * 60 * 1000;
    let isQueued = false;
    let isPlayed = false;
    let replayMinutesLeft = 0;

    for (const item of queue) {
      if (item.key === key && !item.failed) {
        if (!item.played) {
          isQueued = true;
        } else if (item.playedAt) {
          const elapsed = Date.now() - item.playedAt;
          if (elapsed < replayLimitMs) {
            isPlayed = true;
            replayMinutesLeft = Math.ceil((replayLimitMs - elapsed) / 60000);
          }
        }
      }
    }

    return { isQueued, isPlayed, replayMinutesLeft };
  };

  const handleAddSong = async (song: SearchResult) => {
    if (requestsPaused) {
      showToast('Requests are currently paused by the host');
      return;
    }

    if (config.maxSongsPerGuest > 0 && mySongKeys.length >= config.maxSongsPerGuest) {
      showToast(`You have reached the limit of ${config.maxSongsPerGuest} requests. Thank you!`);
      return;
    }

    // Check banned words
    const combined = `${song.title} ${song.artist}`.toLowerCase();
    for (const banned of config.bannedWords || []) {
      if (combined.includes(banned.toLowerCase().trim())) {
        showToast("That song can't be added. Try another favourite!");
        return;
      }
    }

    const status = getSongStatus(song.key);
    if (status.isQueued) {
      showToast('That song is already waiting in the queue!');
      return;
    }
    if (status.isPlayed) {
      showToast(`That song just played! You can request it again in ${status.replayMinutesLeft} min.`);
      return;
    }

    setAddingKey(song.key);
    try {
      await addQueueSong(config, {
        key: song.key,
        title: song.title,
        artist: song.artist,
        art: song.art || '',
        durationMs: song.durationMs || 220000,
        videoId: song.videoId
      });

      saveMySongKey(song.key);
      showToast('Added! 🎶 See it in the Up Next tab');
      onSongAdded();
    } catch (err) {
      showToast('Could not add song. Please try again.');
    } finally {
      setAddingKey(null);
    }
  };

  // Filtered curated picks based on category
  const displayedCurated = useMemo(() => {
    if (selectedCategory === 'all') {
      return CURATED_WEDDING_PICKS;
    }
    return CURATED_WEDDING_PICKS.filter(s => s.category === selectedCategory);
  }, [selectedCategory]);

  const activeQueue = useMemo(() => {
    const list = queue.filter(s => !s.played && !s.failed);
    if (filterMyRequests) {
      return list.filter(s => mySongKeys.includes(s.key));
    }
    return list;
  }, [queue, filterMyRequests, mySongKeys]);

  return (
    <div className="max-w-xl mx-auto px-4 py-5 pb-24 space-y-5">
      
      {/* Wedding Header Greeting */}
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-widest font-semibold text-[#b85433]">
          {config.coupleNames} · Wedding Jukebox
        </p>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2B2622]">
          Pick Your Favourite Songs
        </h1>
        <p className="text-xs text-[#756c64]">
          Add music to the live celebration queue right from your phone.
        </p>
      </div>

      {/* Live Now Playing Banner */}
      {nowPlaying && nowPlaying.title ? (
        <div className="bg-gradient-to-r from-[#476127] to-[#35491c] text-white p-4 rounded-2xl shadow-md border border-[#476127]/30">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#f6d87b]">
                <Radio className="w-3.5 h-3.5" />
                {nowPlaying.paused ? 'Paused' : 'Now Playing On Deck'}
              </span>
            </div>
            {!nowPlaying.paused && (
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-1" />
                <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-2" />
                <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-3" />
                <span className="w-1 bg-[#d8456f] rounded-xs animate-eq-4" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/20 shrink-0 overflow-hidden shadow-xs flex items-center justify-center">
              <Thumbnail src={nowPlaying.art} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-serif font-bold text-base leading-tight truncate text-white">
                {nowPlaying.title}
              </h4>
              <p className="text-xs text-[#ebf3e2] truncate mt-0.5">
                {nowPlaying.artist || 'Wedding Playlist'}
              </p>
              {nowPlaying.requested && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d8456f]/30 text-[#fdecf2] border border-[#d8456f]/40">
                  Guest Request 💖
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#f5e6dc]/60 border border-[#ebdcd2] rounded-2xl p-4 text-center">
          <p className="text-xs font-semibold text-[#756c64]">
            🎵 The music is ready! Request songs below to hear them at the celebration.
          </p>
        </div>
      )}

      {/* Main Mode Tabs */}
      <div className="flex bg-[#f5e6dc] p-1 rounded-2xl border border-[#ebdcd2]">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'search'
              ? 'bg-white text-[#476127] shadow-xs'
              : 'text-[#756c64] hover:text-[#2B2622]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Request a Song
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'queue'
              ? 'bg-white text-[#476127] shadow-xs'
              : 'text-[#756c64] hover:text-[#2B2622]'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          Up Next in Queue ({activeQueue.length})
        </button>
      </div>

      {/* Request View Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          
          {/* YouTube Search Box */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#756c64]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search YouTube for any song or artist..."
              className="w-full bg-white pl-11 pr-10 py-3.5 rounded-2xl border-2 border-[#ebdcd2] focus:border-[#476127] outline-hidden text-sm font-medium transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#f5e6dc] text-[#756c64] text-xs font-bold flex items-center justify-center hover:bg-[#ebdcd2]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results List */}
          {searchQuery.trim() ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#756c64]">
                  YouTube Search Results
                </span>
                {isSearching && (
                  <span className="text-xs text-[#b85433] animate-pulse">Searching YouTube...</span>
                )}
              </div>

              {searchResults.length === 0 && !isSearching ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-[#ebdcd2]">
                  <p className="text-sm font-medium text-[#756c64]">
                    No videos found for "{searchQuery}". Check the spelling or try another song title!
                  </p>
                </div>
              ) : (
                searchResults.map((song) => {
                  const status = getSongStatus(song.key);
                  const isAdding = addingKey === song.key;

                  return (
                    <div
                      key={song.key}
                      className="bg-white rounded-xl p-2.5 sm:p-3 flex items-center gap-3 border border-[#ebdcd2] shadow-xs"
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#f5e6dc] overflow-hidden shrink-0 flex items-center justify-center">
                        <Thumbnail src={song.art} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate text-[#2B2622]">
                          {song.title}
                        </h4>
                        <p className="text-xs text-[#756c64] truncate">
                          {song.artist}
                        </p>
                      </div>

                      {status.isQueued ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#eaf3e5] text-[#476127] shrink-0 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Added
                        </span>
                      ) : status.isPlayed ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#f5e6dc] text-[#756c64] shrink-0 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> In {status.replayMinutesLeft}m
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddSong(song)}
                          disabled={isAdding || requestsPaused}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-[#476127] text-white hover:bg-[#35491c] transition-all shrink-0 active:scale-95 disabled:opacity-50"
                        >
                          {isAdding ? 'Adding...' : '+ Add'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Curated Wedding Suggestions ("Feelgood Celebration Favourites") */
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2B2622]">
                    Popular Song Ideas
                  </h3>
                  <p className="text-xs text-[#756c64]">
                    Tap any song to add it straight to the queue
                  </p>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                        selectedCategory === cat.id
                          ? 'bg-[#476127] text-white shadow-xs'
                          : 'bg-white text-[#756c64] border border-[#ebdcd2] hover:bg-[#f5e6dc]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Suggestions Grid */}
              <div className="space-y-2">
                {displayedCurated.map((song) => {
                  const status = getSongStatus(song.key);
                  const isAdding = addingKey === song.key;

                  return (
                    <div
                      key={song.key}
                      className="bg-white rounded-xl p-2.5 sm:p-3 flex items-center gap-3 border border-[#ebdcd2] shadow-xs hover:border-[#476127]/30 transition-all"
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#f5e6dc] overflow-hidden shrink-0 flex items-center justify-center">
                        <Thumbnail src={song.art} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate text-[#2B2622]">
                          {song.title}
                        </h4>
                        <p className="text-xs text-[#756c64] truncate">
                          {song.artist}
                        </p>
                      </div>

                      {status.isQueued ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#eaf3e5] text-[#476127] shrink-0 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Added
                        </span>
                      ) : status.isPlayed ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#f5e6dc] text-[#756c64] shrink-0 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> In {status.replayMinutesLeft}m
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddSong(song)}
                          disabled={isAdding || requestsPaused}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-[#476127] text-white hover:bg-[#35491c] transition-all shrink-0 active:scale-95 disabled:opacity-50"
                        >
                          {isAdding ? 'Adding...' : '+ Add'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue View Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2B2622]">
                Up Next In Queue
              </h3>
              <p className="text-xs text-[#756c64]">Songs lined up for the celebration</p>
            </div>

            {mySongKeys.length > 0 && (
              <button
                onClick={() => setFilterMyRequests(!filterMyRequests)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  filterMyRequests
                    ? 'bg-[#d8456f] text-white border-[#d8456f]'
                    : 'bg-white text-[#756c64] border-[#ebdcd2]'
                }`}
              >
                <UserCheck className="w-3 h-3" />
                My Songs ({mySongKeys.length})
              </button>
            )}
          </div>

          {activeQueue.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-[#ebdcd2] space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#f5e6dc] text-[#476127] flex items-center justify-center mx-auto">
                <Music className="w-6 h-6" />
              </div>
              <h4 className="font-serif font-bold text-base text-[#2B2622]">
                {filterMyRequests ? "You haven't requested songs yet" : "The queue is open!"}
              </h4>
              <p className="text-xs text-[#756c64] max-w-xs mx-auto">
                {filterMyRequests
                  ? 'Switch back to the Request tab and add your favorite party tracks!'
                  : 'Be the first to add a track and get the celebration dancing.'}
              </p>
              <button
                onClick={() => {
                  setFilterMyRequests(false);
                  setActiveTab('search');
                }}
                className="mt-2 px-4 py-2 rounded-full text-xs font-bold bg-[#476127] text-white hover:bg-[#35491c]"
              >
                Add a Song
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeQueue.map((item, idx) => {
                const isMine = mySongKeys.includes(item.key);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-3 flex items-center gap-3 border border-[#ebdcd2] shadow-xs"
                  >
                    <span className="w-6 text-center text-xs font-bold text-[#756c64]">
                      #{idx + 1}
                    </span>

                    <div className="w-11 h-11 rounded-lg bg-[#f5e6dc] overflow-hidden shrink-0 flex items-center justify-center">
                      <Thumbnail src={item.art} className="w-full h-full object-cover" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-semibold text-sm truncate text-[#2B2622]">
                          {item.title}
                        </h4>
                        {isMine && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#fdecf2] text-[#d8456f] border border-[#d8456f]/30 shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#756c64] truncate">
                        {item.artist}
                      </p>
                    </div>

                    <span className="text-[11px] font-semibold text-[#476127] bg-[#eaf3e5] px-2.5 py-1 rounded-full shrink-0">
                      Waiting
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
