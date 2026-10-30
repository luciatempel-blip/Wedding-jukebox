import { JukeboxConfig, SongItem, SettingsState } from '../types';

const LS_QUEUE_KEY = 'wedding_jukebox_local_queue';
const LS_SETTINGS_KEY = 'wedding_jukebox_local_settings';

function getLocalQueue(): Record<string, SongItem> {
  try {
    return JSON.parse(localStorage.getItem(LS_QUEUE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLocalQueue(q: Record<string, SongItem>): void {
  try {
    localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(q));
  } catch (e) {
    console.error('Failed to save local queue', e);
  }
}

function getLocalSettings(): SettingsState {
  try {
    return JSON.parse(localStorage.getItem(LS_SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLocalSettings(s: SettingsState): void {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.error('Failed to save local settings', e);
  }
}

async function firebaseRest(dbUrl: string, path: string, method = 'GET', body?: any) {
  const cleanUrl = dbUrl.replace(/\/+$/, '') + path + '.json';
  const res = await fetch(cleanUrl, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Firebase error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchQueue(config: JukeboxConfig): Promise<SongItem[]> {
  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      const data = await firebaseRest(config.firebaseDbUrl, '/queue');
      if (!data) return [];
      const list: SongItem[] = Object.keys(data).map(id => ({
        ...data[id],
        id
      })).filter(s => s && s.title);
      return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (err) {
      console.warn('Firebase queue fetch error, falling back to local', err);
    }
  }

  const local = getLocalQueue();
  const list = Object.keys(local).map(id => ({ ...local[id], id }));
  return list.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function addQueueSong(
  config: JukeboxConfig,
  song: Omit<SongItem, 'id' | 'order'>
): Promise<string> {
  const item: SongItem = {
    ...song,
    id: '',
    order: Date.now(),
    played: false
  };

  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      const res = await firebaseRest(config.firebaseDbUrl, '/queue', 'POST', item);
      return res.name;
    } catch (err) {
      console.warn('Firebase add song error, using local fallback', err);
    }
  }

  const id = 'local_' + Date.now() + Math.random().toString(36).substring(2, 6);
  item.id = id;
  const local = getLocalQueue();
  local[id] = item;
  setLocalQueue(local);
  return id;
}

export async function updateQueueSong(
  config: JukeboxConfig,
  id: string,
  patch: Partial<SongItem>
): Promise<void> {
  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      await firebaseRest(config.firebaseDbUrl, `/queue/${id}`, 'PATCH', patch);
      return;
    } catch (err) {
      console.warn('Firebase update song error', err);
    }
  }

  const local = getLocalQueue();
  if (local[id]) {
    local[id] = { ...local[id], ...patch };
    setLocalQueue(local);
  }
}

export async function removeQueueSong(config: JukeboxConfig, id: string): Promise<void> {
  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      await firebaseRest(config.firebaseDbUrl, `/queue/${id}`, 'DELETE');
      return;
    } catch (err) {
      console.warn('Firebase delete song error', err);
    }
  }

  const local = getLocalQueue();
  delete local[id];
  setLocalQueue(local);
}

export async function clearEntireQueue(config: JukeboxConfig): Promise<void> {
  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      await firebaseRest(config.firebaseDbUrl, '/queue', 'DELETE');
      return;
    } catch (err) {
      console.warn('Firebase clear queue error', err);
    }
  }

  setLocalQueue({});
}

export async function fetchSettings(config: JukeboxConfig): Promise<SettingsState> {
  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      const data = await firebaseRest(config.firebaseDbUrl, '/settings');
      return data || {};
    } catch (err) {
      console.warn('Firebase settings fetch error', err);
    }
  }
  return getLocalSettings();
}

export async function saveSettingsPatch(
  config: JukeboxConfig,
  patch: Partial<SettingsState>
): Promise<void> {
  if (config.firebaseDbUrl && !config.firebaseDbUrl.includes('example')) {
    try {
      await firebaseRest(config.firebaseDbUrl, '/settings', 'PATCH', patch);
      return;
    } catch (err) {
      console.warn('Firebase settings patch error', err);
    }
  }

  const local = getLocalSettings();
  setLocalSettings({ ...local, ...patch });
}

export async function shuffleActiveQueue(config: JukeboxConfig): Promise<number> {
  const queue = await fetchQueue(config);
  const active = queue.filter(s => !s.played && !s.failed);
  if (active.length < 2) return active.length;

  const minOrder = Math.min(...active.map(s => s.order || 0));
  // Fisher-Yates shuffle
  const shuffledIds = active.map(s => s.id);
  for (let i = shuffledIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
  }

  await Promise.all(
    shuffledIds.map((id, index) => updateQueueSong(config, id, { order: minOrder + index }))
  );
  return active.length;
}
