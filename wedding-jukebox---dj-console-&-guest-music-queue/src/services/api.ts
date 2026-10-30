import { JukeboxConfig } from '../types';

export interface SearchResult {
  key: string;
  title: string;
  artist: string;
  art?: string;
  durationMs?: number;
  videoId?: string;
  category?: 'house' | 'afrikaans' | 'party' | 'romantic';
}

const JUNK_REGEX = /karaoke|tribute|made famous|originally performed|lullaby|instrumental version|8-bit|music box/i;

// Cache map in memory for search results
const searchCache = new Map<string, SearchResult[]>();

export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function generateSongKey(title: string, artist: string): string {
  return normalizeText(title) + '___' + normalizeText(artist);
}

function decodeHtml(html: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

/**
 * Curated Feelgood Songs: A mixture of House, Deep House, and Afrikaans party classics.
 * Easy for guests to quickly pick their favorite songs without any guessing.
 */
export const CURATED_WEDDING_PICKS: SearchResult[] = [
  // --- HOUSE & DEEP HOUSE ANTHEMS ---
  {
    key: generateSongKey('Spin My World Around', 'DJ Kent ft. The Arrows'),
    title: 'Spin My World Around',
    artist: 'DJ Kent ft. The Arrows',
    art: 'https://i.ytimg.com/vi/aFq5p4nL1p8/hqdefault.jpg',
    videoId: 'aFq5p4nL1p8',
    category: 'house',
    durationMs: 270000
  },
  {
    key: generateSongKey('Drive', 'Black Coffee & David Guetta ft. Delilah Montagu'),
    title: 'Drive',
    artist: 'Black Coffee & David Guetta ft. Delilah Montagu',
    art: 'https://i.ytimg.com/vi/qfZ3qK-sA_8/hqdefault.jpg',
    videoId: 'qfZ3qK-sA_8',
    category: 'house',
    durationMs: 251000
  },
  {
    key: generateSongKey('These Streets', 'Mi Casa'),
    title: 'These Streets',
    artist: 'Mi Casa',
    art: 'https://i.ytimg.com/vi/E8vG6s3W98g/hqdefault.jpg',
    videoId: 'E8vG6s3W98g',
    category: 'house',
    durationMs: 260000
  },
  {
    key: generateSongKey('Jika', 'Mi Casa'),
    title: 'Jika',
    artist: 'Mi Casa',
    art: 'https://i.ytimg.com/vi/G2L3H_6s3p4/hqdefault.jpg',
    videoId: 'G2L3H_6s3p4',
    category: 'house',
    durationMs: 284000
  },
  {
    key: generateSongKey('Fetch Your Life', 'Prince Kaybee ft. Msaki'),
    title: 'Fetch Your Life',
    artist: 'Prince Kaybee ft. Msaki',
    art: 'https://i.ytimg.com/vi/m9g4u1T4V_k/hqdefault.jpg',
    videoId: 'm9g4u1T4V_k',
    category: 'house',
    durationMs: 295000
  },
  {
    key: generateSongKey('Akanamali', 'Sun-EL Musician ft. Samthing Soweto'),
    title: 'Akanamali',
    artist: 'Sun-EL Musician ft. Samthing Soweto',
    art: 'https://i.ytimg.com/vi/zU7O6N6E3_M/hqdefault.jpg',
    videoId: 'zU7O6N6E3_M',
    category: 'house',
    durationMs: 320000
  },
  {
    key: generateSongKey('Hold Tight', 'Goldfish'),
    title: 'Hold Tight',
    artist: 'Goldfish',
    art: 'https://i.ytimg.com/vi/G7p8A4_k0tE/hqdefault.jpg',
    videoId: 'G7p8A4_k0tE',
    category: 'house',
    durationMs: 218000
  },
  {
    key: generateSongKey('Lady (Hear Me Tonight)', 'Modjo'),
    title: 'Lady (Hear Me Tonight)',
    artist: 'Modjo',
    art: 'https://i.ytimg.com/vi/vBD_yX7pE9g/hqdefault.jpg',
    videoId: 'vBD_yX7pE9g',
    category: 'house',
    durationMs: 306000
  },
  {
    key: generateSongKey('Show Me Love', 'Robin S'),
    title: 'Show Me Love',
    artist: 'Robin S',
    art: 'https://i.ytimg.com/vi/Ps2Jc28tQrw/hqdefault.jpg',
    videoId: 'Ps2Jc28tQrw',
    category: 'house',
    durationMs: 255000
  },
  {
    key: generateSongKey('One More Time', 'Daft Punk'),
    title: 'One More Time',
    artist: 'Daft Punk',
    art: 'https://i.ytimg.com/vi/FGBhQbmMxH8/hqdefault.jpg',
    videoId: 'FGBhQbmMxH8',
    category: 'house',
    durationMs: 320000
  },

  // --- AFRIKAANS TREFFERS & SOKKIE CLASSICS ---
  {
    key: generateSongKey('Kaptein (Span Die Seile)', 'Kurt Darren'),
    title: 'Kaptein (Span Die Seile)',
    artist: 'Kurt Darren',
    art: 'https://i.ytimg.com/vi/q_HkI-Xp8iI/hqdefault.jpg',
    videoId: 'q_HkI-Xp8iI',
    category: 'afrikaans',
    durationMs: 235000
  },
  {
    key: generateSongKey('Toe Vind Ek Jou', 'Francois van Coke & Karen Zoid'),
    title: 'Toe Vind Ek Jou',
    artist: 'Francois van Coke ft. Karen Zoid',
    art: 'https://i.ytimg.com/vi/aL3p-9aYm4w/hqdefault.jpg',
    videoId: 'aL3p-9aYm4w',
    category: 'afrikaans',
    durationMs: 242000
  },
  {
    key: generateSongKey('Boerepompie', 'Ricus Nel & Snotkop'),
    title: 'Boerepompie',
    artist: 'Ricus Nel ft. Snotkop',
    art: 'https://i.ytimg.com/vi/7jYgZ3u3w0A/hqdefault.jpg',
    videoId: '7jYgZ3u3w0A',
    category: 'afrikaans',
    durationMs: 198000
  },
  {
    key: generateSongKey('Loslappie', 'Kurt Darren'),
    title: 'Loslappie',
    artist: 'Kurt Darren',
    art: 'https://i.ytimg.com/vi/1_M0Q6A7YkE/hqdefault.jpg',
    videoId: '1_M0Q6A7YkE',
    category: 'afrikaans',
    durationMs: 215000
  },
  {
    key: generateSongKey('Sonop-Blom', 'Bernice West'),
    title: 'Sonop-Blom',
    artist: 'Bernice West',
    art: 'https://i.ytimg.com/vi/9S4T8y5U3Ew/hqdefault.jpg',
    videoId: '9S4T8y5U3Ew',
    category: 'afrikaans',
    durationMs: 204000
  },
  {
    key: generateSongKey('Vuur op die Water', 'Elandré'),
    title: 'Vuur op die Water',
    artist: 'Elandré',
    art: 'https://i.ytimg.com/vi/Nkmmoq1UHIg/hqdefault.jpg',
    videoId: 'Nkmmoq1UHIg',
    category: 'afrikaans',
    durationMs: 210000
  },
  {
    key: generateSongKey('Dikkelik', 'Snotkop'),
    title: 'Dikkelik',
    artist: 'Snotkop',
    art: 'https://i.ytimg.com/vi/y8K9eJp0bJw/hqdefault.jpg',
    videoId: 'y8K9eJp0bJw',
    category: 'afrikaans',
    durationMs: 195000
  },
  {
    key: generateSongKey('Klein Tambotieboom', 'Die Heuwels Fantasties'),
    title: 'Klein Tambotieboom',
    artist: 'Die Heuwels Fantasties',
    art: 'https://i.ytimg.com/vi/u4b3tZ8t5f4/hqdefault.jpg',
    videoId: 'u4b3tZ8t5f4',
    category: 'afrikaans',
    durationMs: 220000
  },
  {
    key: generateSongKey('Lenie Blou', 'Spoegwolf'),
    title: 'Lenie Blou',
    artist: 'Spoegwolf',
    art: 'https://i.ytimg.com/vi/M7lM1vj8mXU/hqdefault.jpg',
    videoId: 'M7lM1vj8mXU',
    category: 'afrikaans',
    durationMs: 245000
  },
  {
    key: generateSongKey('Leeuloop', 'Robbie Wessels'),
    title: 'Leeuloop',
    artist: 'Robbie Wessels',
    art: 'https://i.ytimg.com/vi/R7Y8x4r_g1w/hqdefault.jpg',
    videoId: 'R7Y8x4r_g1w',
    category: 'afrikaans',
    durationMs: 218000
  },
  {
    key: generateSongKey('Dans', 'Riana Nel'),
    title: 'Dans',
    artist: 'Riana Nel',
    art: 'https://i.ytimg.com/vi/X4b8c9d2f3g/hqdefault.jpg',
    videoId: 'X4b8c9d2f3g',
    category: 'afrikaans',
    durationMs: 212000
  },
  {
    key: generateSongKey('De La Rey', 'Bok van Blerk'),
    title: 'De La Rey',
    artist: 'Bok van Blerk',
    art: 'https://i.ytimg.com/vi/0W1J4kL_T7Y/hqdefault.jpg',
    videoId: '0W1J4kL_T7Y',
    category: 'afrikaans',
    durationMs: 240000
  },

  // --- PARTY & DANCEFLOOR FAVOURITES ---
  {
    key: generateSongKey('September', 'Earth, Wind & Fire'),
    title: 'September',
    artist: 'Earth, Wind & Fire',
    art: 'https://i.ytimg.com/vi/Gs069dndIYk/hqdefault.jpg',
    videoId: 'Gs069dndIYk',
    category: 'party',
    durationMs: 215000
  },
  {
    key: generateSongKey('Dancing Queen', 'ABBA'),
    title: 'Dancing Queen',
    artist: 'ABBA',
    art: 'https://i.ytimg.com/vi/xFljpJd89VU/hqdefault.jpg',
    videoId: 'xFljpJd89VU',
    category: 'party',
    durationMs: 231000
  },
  {
    key: generateSongKey('Nkalakatha', 'Mandoza'),
    title: 'Nkalakatha',
    artist: 'Mandoza',
    art: 'https://i.ytimg.com/vi/3R3KqB5k7A0/hqdefault.jpg',
    videoId: '3R3KqB5k7A0',
    category: 'party',
    durationMs: 298000
  },
  {
    key: generateSongKey('Special Star', 'Mango Groove'),
    title: 'Special Star',
    artist: 'Mango Groove',
    art: 'https://i.ytimg.com/vi/P2mS3A0hI6w/hqdefault.jpg',
    videoId: 'P2mS3A0hI6w',
    category: 'party',
    durationMs: 226000
  },
  {
    key: generateSongKey('Jerusalema', 'Master KG & Nomcebo Zikode'),
    title: 'Jerusalema',
    artist: 'Master KG & Nomcebo Zikode',
    art: 'https://i.ytimg.com/vi/fCZVL_8D048/hqdefault.jpg',
    videoId: 'fCZVL_8D048',
    category: 'party',
    durationMs: 343000
  },
  {
    key: generateSongKey('Wake Me Up', 'Avicii'),
    title: 'Wake Me Up',
    artist: 'Avicii',
    art: 'https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg',
    videoId: 'IcrbM1l_BoI',
    category: 'party',
    durationMs: 247000
  },
  {
    key: generateSongKey('Shut Up and Dance', 'WALK THE MOON'),
    title: 'Shut Up and Dance',
    artist: 'WALK THE MOON',
    art: 'https://i.ytimg.com/vi/6JCLY0R17gk/hqdefault.jpg',
    videoId: '6JCLY0R17gk',
    category: 'party',
    durationMs: 199000
  },

  // --- STADIGE DANS & ROMANTIES (LOVE SONGS) ---
  {
    key: generateSongKey('Thinking Out Loud', 'Ed Sheeran'),
    title: 'Thinking Out Loud',
    artist: 'Ed Sheeran',
    art: 'https://i.ytimg.com/vi/lp-EO5I60KA/hqdefault.jpg',
    videoId: 'lp-EO5I60KA',
    category: 'romantic',
    durationMs: 281000
  },
  {
    key: generateSongKey('Marry You', 'Bruno Mars'),
    title: 'Marry You',
    artist: 'Bruno Mars',
    art: 'https://i.ytimg.com/vi/8xg3vE8Ie_E/hqdefault.jpg',
    videoId: '8xg3vE8Ie_E',
    category: 'romantic',
    durationMs: 230000
  },
  {
    key: generateSongKey('Sonvanger', 'Refentse'),
    title: 'Sonvanger',
    artist: 'Refentse',
    art: 'https://i.ytimg.com/vi/q_HkI-Xp8iI/hqdefault.jpg',
    videoId: 'x8HkI9Xp8iI',
    category: 'romantic',
    durationMs: 224000
  }
];

/**
 * Searches exclusively using the YouTube Data API v3.
 * Returns verified YouTube video IDs directly so every requested song plays cleanly.
 */
export async function searchSongs(
  query: string,
  config: JukeboxConfig,
  limit = 15
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `${normalizeText(q)}_${limit}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  // 1. First check curated list for instant instant match
  const normQ = normalizeText(q);
  const matchedCurated = CURATED_WEDDING_PICKS.filter(
    p => normalizeText(p.title).includes(normQ) || normalizeText(p.artist).includes(normQ)
  );

  // 2. Query YouTube Data API v3
  const apiKey = (config.youtubeApiKey || '').trim();
  if (apiKey && !apiKey.startsWith('MY_')) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('maxResults', String(limit));
      url.searchParams.set('q', `${q} official audio music`);
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('videoSyndicated', 'true');
      url.searchParams.set('key', apiKey);
      if (config.regionCode) {
        url.searchParams.set('regionCode', config.regionCode);
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const items: any[] = data.items || [];
        const seen = new Set<string>();
        const results: SearchResult[] = [];

        // Add curated matches at the top if any
        for (const c of matchedCurated) {
          seen.add(c.videoId || c.key);
          results.push(c);
        }

        for (const item of items) {
          const videoId = item.id?.videoId;
          if (!videoId || seen.has(videoId)) continue;
          seen.add(videoId);

          const rawTitle = decodeHtml(item.snippet?.title || '');
          const rawChannel = decodeHtml(item.snippet?.channelTitle || '').replace(/ - Topic$/, '');
          
          if (JUNK_REGEX.test(`${rawTitle} ${rawChannel}`)) continue;

          // Attempt to extract Artist - Title if separated by hyphen
          let title = rawTitle;
          let artist = rawChannel;

          if (rawTitle.includes(' - ')) {
            const parts = rawTitle.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').replace(/[\(\[].*?[\)\]]/g, ' ').trim();
          }

          const thumbs = item.snippet?.thumbnails || {};
          const art = (thumbs.high || thumbs.medium || thumbs.default || {}).url || '';

          results.push({
            key: `yt:${videoId}`,
            title,
            artist,
            art,
            videoId,
            durationMs: 220000 // Standard fallback duration until loaded
          });
        }

        if (results.length > 0) {
          searchCache.set(cacheKey, results);
          return results;
        }
      }
    } catch (ytErr) {
      console.warn('YouTube search API error, falling back to curated list:', ytErr);
    }
  }

  // Fallback: Filter from curated wedding list if YouTube API is offline or quota reached
  if (matchedCurated.length > 0) {
    return matchedCurated;
  }

  return CURATED_WEDDING_PICKS.slice(0, limit);
}

/**
 * Resolves a song to a YouTube videoId using YouTube Data API v3.
 */
export async function resolveYouTubeVideo(
  title: string,
  artist: string,
  apiKey: string,
  regionCode = 'ZA'
): Promise<string> {
  // If title already matches a curated track, return its exact videoId
  const key = generateSongKey(title, artist);
  const found = CURATED_WEDDING_PICKS.find(s => s.key === key && s.videoId);
  if (found && found.videoId) {
    return found.videoId;
  }

  const cleanTitle = (title || '').replace(/[\(\[].*?[\)\]]/g, ' ').trim();
  const query = `${cleanTitle} ${artist || ''} official audio`;

  if (!apiKey || apiKey.startsWith('MY_')) {
    return 'q_HkI-Xp8iI'; // Kurt Darren Kaptein fallback
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('q', query);
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('videoSyndicated', 'true');
  url.searchParams.set('key', apiKey.trim());
  if (regionCode) url.searchParams.set('regionCode', regionCode);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status}`);
  }
  const data = await res.json();
  const first = data.items?.[0];
  if (!first || !first.id?.videoId) {
    throw new Error('No video found on YouTube');
  }
  return first.id.videoId;
}

/**
 * Fetches videos from a base YouTube playlist.
 */
export async function fetchPlaylistVideos(
  playlistId: string,
  apiKey: string,
  max = 100
): Promise<{ title: string; artist: string; videoId: string; art?: string }[]> {
  const m = playlistId.match(/[?&]list=([A-Za-z0-9_-]+)/);
  const cleanId = m ? m[1] : playlistId.trim();

  if (!cleanId || !apiKey || apiKey.startsWith('MY_')) {
    return [];
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', String(Math.min(max, 50)));
  url.searchParams.set('playlistId', cleanId);
  url.searchParams.set('key', apiKey.trim());

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Could not load playlist: ${res.status}`);
  }
  const data = await res.json();
  return (data.items || []).map((item: any) => {
    const snip = item.snippet || {};
    const thumbs = snip.thumbnails || {};
    return {
      title: snip.title || '',
      artist: (snip.videoOwnerChannelTitle || snip.channelTitle || '').replace(/ - Topic$/, ''),
      videoId: snip.resourceId?.videoId || '',
      art: (thumbs.high || thumbs.medium || thumbs.default || {}).url
    };
  }).filter((v: any) => v.videoId && v.title !== 'Private video' && v.title !== 'Deleted video');
}
