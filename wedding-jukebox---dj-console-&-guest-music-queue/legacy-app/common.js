/* Shared code for guest, player and admin pages. No need to edit. */
(function () {
  'use strict';

  var C = Object.assign({
    coupleNames: 'Our Wedding', firebaseDbUrl: '', youtubeApiKey: '', basePlaylistId: '',
    adminPin: '1234', maxSongsPerGuest: 5, blockExplicit: false, bannedWords: [],
    regionCode: 'ZA', musicOnly: true,
    crossfadeSeconds: 8, skipFadeSeconds: 3,
    siteTitle: 'Jukebox', replayAfterMinutes: 30
  }, window.JUKEBOX_CONFIG || {});

  var dbDemo = !String(C.firebaseDbUrl || '').trim();
  var ytDemo = !String(C.youtubeApiKey || '').trim();
  var dbBase = String(C.firebaseDbUrl || '').trim().replace(/\/+$/, '');

  /* ---------- tiny helpers ---------- */
  function h(tag, props, kids) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'class') el.className = props[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), props[k]);
      else el.setAttribute(k, props[k]);
    });
    (function add(k) {
      if (k == null || k === false) return;
      if (Array.isArray(k)) return k.forEach(add);
      el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    })(kids);
    return el;
  }

  function fill(el, kids) { while (el.firstChild) el.removeChild(el.firstChild); (kids || []).forEach(function (k) { el.appendChild(k); }); }

  function decodeHtml(s) { var t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; }

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[\(\[].*?[\)\]]/g, ' ')
      .replace(/\b(feat|ft|featuring)\b.*$/, ' ')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function songKey(title, artist) { return norm(artist) + '|' + norm(title); }

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var s = sec % 60; return Math.floor(sec / 60) + ':' + (s < 10 ? '0' : '') + s;
  }

  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function banner(el) {
    var missing = [];
    if (dbDemo) missing.push('online database');
    if (ytDemo) missing.push('YouTube key');
    if (!el || !missing.length) return;
    el.hidden = false;
    el.textContent = 'PREVIEW MODE – missing: ' + missing.join(' + ') +
      '. ' + (dbDemo ? 'Songs are only saved on this device. ' : '') + (ytDemo ? 'The player pretends to play.' : '');
  }

  /* ---------- burger menu: slide-out list of the pages ----------
     Guests only see their own page. The Player and Admin links appear on the host pages,
     or on the guest page once the admin PIN has been typed in on that device. */
  function hostUnlocked() { try { return sessionStorage.getItem('jb_admin') === '1'; } catch (e) { return false; } }

  function initMenu(opts) {
    var mount = opts && opts.mount; if (!mount) return;
    var page = opts.current, extra = opts.extra || [], pin = String(C.adminPin || ''), asking = null;

    var btn = h('button', { class: 'menu-btn', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false', 'aria-controls': 'menuDrawer' },
      [h('span'), h('span'), h('span')]);
    var overlay = h('div', { class: 'menu-overlay' });
    var drawer = h('nav', { class: 'menu-drawer', id: 'menuDrawer', 'aria-label': 'Menu', 'aria-hidden': 'true' });

    var PAGES = {
      index: { icon: 'fa-solid fa-compact-disc', name: 'Guest page', desc: 'Request songs', href: 'index.html' },
      player: { icon: 'fa-solid fa-sliders', name: 'Player', desc: 'Plays the music', href: 'player.html' },
      admin: { icon: 'fa-solid fa-gear', name: 'Admin', desc: 'Skip, volume and the QR sign', href: 'admin.html' }
    };

    function rowBody(p, tail) {
      return [
        h('span', { class: 'menu-text' }, [
          h('span', { class: 'menu-name' }, [h('i', { class: p.icon }), ' ' + p.name]),
          h('span', { class: 'menu-desc' }, p.desc)
        ]),
        tail || null
      ];
    }

    function page_(key) {
      var p = PAGES[key];
      return key === page
        ? h('div', { class: 'menu-item current', 'aria-current': 'page' }, rowBody(p, h('span', { class: 'menu-here' }, 'you are here')))
        : h('a', { class: 'menu-item', href: p.href }, rowBody(p));
    }

    function build() {
      var kids = [
        h('div', { class: 'menu-head' }, [
          h('span', { class: 'menu-title' }, C.siteTitle || 'Jukebox'),
          h('button', { class: 'menu-close', type: 'button', 'aria-label': 'Close menu', onclick: close }, h('i', { class: 'fa-solid fa-xmark' }))          ])
      ];
      if (extra.length) {
        extra.forEach(function (e) { kids.push(h('button', { class: 'menu-item', type: 'button', onclick: function () { close(); e.run(); } }, e.label)); });
        kids.push(h('div', { class: 'menu-rule' }));
      }
      kids.push(h('div', { class: 'menu-label' }, 'Pages'));
      kids.push(page_('index'));
      kids.push(hostItem('player'));
      if (asking && asking.key === 'player') kids.push(pinForm());
      kids.push(hostItem('admin'));
      if (asking && asking.key === 'admin') kids.push(pinForm());
      fill(drawer, kids);
      var pinBox = drawer.querySelector('#menuPin'); if (pinBox) pinBox.focus();
    }

    /* Player and Admin: a normal link once the PIN has been entered on this device, otherwise a locked row that asks for it */
    function hostItem(key) {
      if (key === page || !pin || hostUnlocked()) return page_(key);
      var p = PAGES[key];
      return h('button', { class: 'menu-item', type: 'button', 'aria-label': p.name + ', locked, needs the PIN', onclick: function () { asking = { key: key, page: p }; build(); } },
        rowBody(p, h('span', { class: 'menu-here' }, '\u{1F512}')));
    }

    function pinForm() {
      var input = h('input', { id: 'menuPin', type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'PIN' });
      var err = h('p', { class: 'menu-err', hidden: 'hidden' }, "That's not right – try again.");
      return h('form', {
        class: 'menu-lock', onsubmit: function (e) {
          e.preventDefault();
          if (input.value === pin) {
            try { sessionStorage.setItem('jb_admin', '1'); } catch (x) { }
            location.href = asking.page.href;
          } else { err.hidden = false; input.select(); }
        }
      }, [h('label', { for: 'menuPin' }, 'Enter the PIN to open ' + asking.page.name),
        h('div', { class: 'menu-lockrow' }, [input, h('button', { class: 'btn', type: 'submit' }, 'Open')]), err]);
    }

    function open() {
      asking = null; build();
      drawer.classList.add('open'); overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false'); btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var f = drawer.querySelector('.menu-item:not(.current), .menu-close'); if (f) f.focus();
    }
    function close() {
      if (!drawer.classList.contains('open')) return;
      drawer.classList.remove('open'); overlay.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true'); btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      btn.focus();
    }

    btn.addEventListener('click', function () { drawer.classList.contains('open') ? close() : open(); });
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    mount.appendChild(btn); document.body.appendChild(overlay); document.body.appendChild(drawer);
  }

  function thumb(art, label) {
    var d = h('div', { class: 'thumb' });
    if (art) {
      var img = h('img', { src: art, alt: '', loading: 'lazy' });
      img.addEventListener('error', function () { img.remove(); d.textContent = (label || '♪').charAt(0).toUpperCase(); });
      d.appendChild(img);
    } else d.textContent = (label || '♪').charAt(0).toUpperCase();
    return d;
  }

  /* ---------- database (Firebase Realtime Database over plain web requests) ---------- */
  var LS = 'jukebox_demo_v1';
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || { queue: {}, settings: {} }; } catch (e) { return { queue: {}, settings: {} }; } }
  function save(s) { localStorage.setItem(LS, JSON.stringify(s)); }

  async function rest(path, method, body) {
    var res = await fetch(dbBase + path + '.json', {
      method: method || 'GET',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Database error ' + res.status);
    return res.json();
  }

  function toList(map) {
    return Object.keys(map || {}).map(function (id) { return Object.assign({ id: id }, map[id]); })
      .filter(function (x) { return x && x.title; })           // ignore half-deleted stubs
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  var DB = {
    demo: dbDemo,
    getQueue: async function () { return toList(dbDemo ? load().queue : await rest('/queue')); },
    add: async function (item) {
      var rec = Object.assign({ order: Date.now(), played: false }, item);
      if (dbDemo) { var s = load(); var id = 'd' + Date.now() + Math.random().toString(36).slice(2, 6); s.queue[id] = rec; save(s); return id; }
      return (await rest('/queue', 'POST', rec)).name;
    },
    update: async function (id, patch) {
      if (dbDemo) { var s = load(); if (s.queue[id]) { Object.assign(s.queue[id], patch); save(s); } return; }
      await rest('/queue/' + id, 'PATCH', patch);
    },
    remove: async function (id) {
      if (dbDemo) { var s = load(); delete s.queue[id]; save(s); return; }
      await rest('/queue/' + id, 'DELETE');
    },
    clearQueue: async function () {
      if (dbDemo) { var s = load(); s.queue = {}; save(s); return; }
      await rest('/queue', 'DELETE');
    },
    getSettings: async function () { return dbDemo ? (load().settings || {}) : ((await rest('/settings')) || {}); },
    setSettings: async function (patch) {
      if (dbDemo) { var s = load(); s.settings = Object.assign(s.settings || {}, patch); save(s); return; }
      await rest('/settings', 'PATCH', patch);
    }
  };

  /* Randomly reorder the songs guests have requested but that haven't played yet.
     Returns how many songs were shuffled (0 or 1 means there was nothing to shuffle). */
  async function shuffleQueue() {
    var q = (await DB.getQueue()).filter(function (i) { return !i.played && !i.failed; });
    if (q.length < 2) return q.length;
    var first = Math.min.apply(null, q.map(function (i) { return i.order || 0; }));
    var ids = shuffle(q.map(function (i) { return i.id; }));
    await Promise.all(ids.map(function (id, n) { return DB.update(id, { order: first + n }); }));
    return q.length;
  }

  /* ---------- guest song search: Apple's free search (no quota), YouTube as backup ---------- */
  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = '__jb_' + Math.random().toString(36).slice(2);
      var s = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('timeout')); }, 10000);
      function cleanup() { clearTimeout(timer); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (d) { cleanup(); resolve(d); };
      s.onerror = function () { cleanup(); reject(new Error('network')); };
      s.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + cb;
      document.head.appendChild(s);
    });
  }

  var JUNK = /karaoke|tribute|made famous|originally performed|lullaby|instrumental version|8-bit|music box/i;

  async function itunesSearch(q, want, fetchCount) {
    var url = 'https://itunes.apple.com/search?media=music&entity=song&limit=' + (fetchCount || 20) + '&term=' + encodeURIComponent(q) +
      (C.regionCode ? '&country=' + encodeURIComponent(C.regionCode) : '');
    var d = await jsonp(url);
    var seen = {};
    return (d.results || []).filter(function (r) {
      if (!r.trackName || !r.artistName) return false;
      if (JUNK.test(r.trackName + ' ' + (r.collectionName || '') + ' ' + r.artistName)) return false;
      if (C.blockExplicit && r.trackExplicitness === 'explicit') return false;
      var k = songKey(r.trackName, r.artistName); if (seen[k]) return false; seen[k] = 1; return true;
    }).slice(0, want || 10).map(function (r) {
      return {
        key: songKey(r.trackName, r.artistName), title: r.trackName, artist: r.artistName,
        art: (r.artworkUrl100 || '').replace('100x100', '200x200'), durationMs: r.trackTimeMillis || 0
      };
    });
  }

  async function ytFetch(endpoint, params) {
    var url = new URL('https://www.googleapis.com/youtube/v3/' + endpoint);
    var all = Object.assign({ key: C.youtubeApiKey.trim() }, params);
    Object.keys(all).forEach(function (k) { url.searchParams.set(k, all[k]); });
    var res = await fetch(url.toString());
    var data = {}; try { data = await res.json(); } catch (e) { }
    if (!res.ok) {
      var err = new Error((data.error && data.error.message) || ('YouTube error ' + res.status));
      err.reason = data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
      throw err;
    }
    return data;
  }

  async function youtubeSearch(q) {
    var p = { part: 'snippet', type: 'video', maxResults: 8, q: q, videoEmbeddable: 'true', videoSyndicated: 'true' };
    if (C.musicOnly) p.videoCategoryId = '10';
    if (C.regionCode) p.regionCode = C.regionCode;
    var d = await ytFetch('search', p);
    return (d.items || []).map(function (i) {
      var t = (i.snippet.thumbnails || {});
      return {
        key: 'yt:' + i.id.videoId, videoId: i.id.videoId, title: decodeHtml(i.snippet.title),
        artist: decodeHtml(i.snippet.channelTitle).replace(/ - Topic$/, ''), art: ((t.medium || t.default || {}).url) || '', durationMs: 0
      };
    });
  }

  var DEMO = [['Dancing Queen', 'ABBA'], ['September', 'Earth, Wind & Fire'], ['I Wanna Dance with Somebody', 'Whitney Houston'],
  ['Uptown Funk', 'Mark Ronson & Bruno Mars'], ['Shut Up and Dance', 'WALK THE MOON'], ['Love on Top', 'Beyoncé'],
  ["Can't Stop the Feeling!", 'Justin Timberlake'], ['Happy', 'Pharrell Williams'], ['Jerusalema', 'Master KG & Nomcebo Zikode'],
  ['Thinking Out Loud', 'Ed Sheeran'], ['Marry You', 'Bruno Mars'], ['Sweet Caroline', 'Neil Diamond'],
  ['Shallow', 'Lady Gaga & Bradley Cooper'], ['Perfect', 'Ed Sheeran'], ['Valerie', 'Amy Winehouse']];

  function demoSearch(q) {
    q = q.toLowerCase();
    return DEMO.filter(function (d) { return (d[0] + ' ' + d[1]).toLowerCase().indexOf(q) > -1; })
      .map(function (d) { return { key: songKey(d[0], d[1]), title: d[0], artist: d[1], art: '', durationMs: 200000 }; });
  }

  async function search(q) {
    q = q.trim();
    if (ytDemo && dbDemo) return demoSearch(q);
    var out = [], failed = false;
    try { out = await itunesSearch(q); } catch (e) { failed = true; }
    if (!out.length && !ytDemo) {
      try { out = await youtubeSearch(q); failed = false; } catch (e) { if (failed) throw e; }
    }
    if (!out.length && failed) throw new Error('network');
    if (!out.length && ytDemo) out = demoSearch(q);
    return out;
  }

  /* ---------- player side: turn "artist + title" into a YouTube video ---------- */
  function parseListId(s) {
    s = String(s || '').trim(); if (!s) return '';
    var m = s.match(/[?&]list=([A-Za-z0-9_-]+)/); return m ? m[1] : s;
  }
  function isoSeconds(iso) {
    var m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ''); if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  var BAD = ['cover', 'karaoke', 'instrumental', 'reaction', 'tutorial', 'piano', '8d', 'slowed', 'sped up', 'nightcore',
    'remix', 'live', 'mashup', 'loop', '1 hour', 'acoustic', 'reverb'];

  async function resolveVideo(item) {
    if (item.videoId) return item.videoId;
    if (ytDemo) return 'demo-' + item.key;
    var q = item.artist + ' ' + item.title;
    var p = { part: 'snippet', type: 'video', maxResults: 6, q: q, videoEmbeddable: 'true', videoSyndicated: 'true' };
    if (C.regionCode) p.regionCode = C.regionCode;
    if (C.musicOnly) p.videoCategoryId = '10';
    var s = await ytFetch('search', p);
    if (!(s.items || []).length && p.videoCategoryId) { delete p.videoCategoryId; s = await ytFetch('search', p); }
    var ids = (s.items || []).map(function (i) { return i.id.videoId; }).filter(Boolean);
    if (!ids.length) throw new Error('No YouTube match');
    var v = await ytFetch('videos', { part: 'contentDetails,snippet', id: ids.join(',') });
    var wantT = norm(item.title), wantA = norm(item.artist), wantSec = (item.durationMs || 0) / 1000;
    var wantTitleLow = (item.title || '').toLowerCase();
    var best = null, bestScore = -1e9;
    (v.items || []).forEach(function (vid, idx) {
      var title = (vid.snippet.title || '').toLowerCase(), chan = (vid.snippet.channelTitle || '').toLowerCase();
      var score = -0.1 * idx;
      if (norm(title).indexOf(wantT) > -1) score += 3;
      if (norm(title).indexOf(wantA) > -1 || norm(chan).indexOf(wantA) > -1) score += 2;
      if (/ - topic$/.test(chan)) score += 1;
      var dur = isoSeconds(vid.contentDetails && vid.contentDetails.duration);
      if (wantSec && dur) { var diff = Math.abs(dur - wantSec); score += diff <= 8 ? 4 : diff <= 20 ? 2 : diff > 60 ? -3 : 0; }
      BAD.forEach(function (w) { if (title.indexOf(w) > -1 && wantTitleLow.indexOf(w) === -1) score -= 4; });
      if (score > bestScore) { bestScore = score; best = vid.id; }
    });
    return best || ids[0];
  }

  async function playlistVideos(listId, max) {
    if (ytDemo) return DEMO.slice(0, 6).map(function (d, i) { return { videoId: 'demoB' + i, title: d[0], artist: d[1], art: '' }; });
    var out = [], token = '';
    while (out.length < max) {
      var p = { part: 'snippet', playlistId: listId, maxResults: 50 }; if (token) p.pageToken = token;
      var d = await ytFetch('playlistItems', p);
      (d.items || []).forEach(function (i) {
        var s = i.snippet; if (!s || !s.resourceId || !s.resourceId.videoId) return;
        if (s.title === 'Private video' || s.title === 'Deleted video') return;
        var t = s.thumbnails || {};
        out.push({
          videoId: s.resourceId.videoId, title: decodeHtml(s.title),
          artist: decodeHtml(s.videoOwnerChannelTitle || '').replace(/ - Topic$/, ''), art: ((t.medium || t.default || {}).url) || ''
        });
      });
      token = d.nextPageToken; if (!token) break;
    }
    return out;
  }

  function loadYouTubeApi() {
    return new Promise(function (resolve, reject) {
      if (window.YT && window.YT.Player) return resolve();
      window.onYouTubeIframeAPIReady = resolve;
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = function () { reject(new Error('Could not load YouTube. Is the internet working?')); };
      document.head.appendChild(s);
    });
  }

  window.Jukebox = {
    C: C, DB: DB, h: h, fill: fill, toast: toast, banner: banner, thumb: thumb, norm: norm, songKey: songKey,
    dbDemo: dbDemo, ytDemo: ytDemo, search: search, resolveVideo: resolveVideo, playlistVideos: playlistVideos,
    parseListId: parseListId, loadYouTubeApi: loadYouTubeApi,
    shuffle: shuffle, fmtTime: fmtTime, shuffleQueue: shuffleQueue, initMenu: initMenu,
    itunes: itunesSearch, demoSongs: DEMO
  };
})();
