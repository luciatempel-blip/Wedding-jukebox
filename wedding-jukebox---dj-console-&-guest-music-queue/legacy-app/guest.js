/* Guest page: search, suggestions, add, live now-playing card, and the queue. */
(function () {
  'use strict';
  var J = window.Jukebox, C = J.C, DB = J.DB, h = J.h, fill = J.fill;
  var $ = function (id) { return document.getElementById(id); };

  $('names').textContent = C.coupleNames;
  J.banner($('demoBanner'));
  J.initMenu({
    mount: $('menuMount'), current: 'index',
    extra: [
      { label: '➕ Add a song', run: function () { showTab('add'); } },
      { label: '\u{1F4CB} See the queue', run: function () { showTab('queue'); refresh(); } }
    ]
  });

  var queue = [], settings = {}, results = [], fails = 0, adding = false;
  var picks = [], picksLoading = false, picksFailed = false, searchActive = false;

  /* songs this phone has added (soft limit, kept on the phone) */
  var MINE = 'jukebox_my_songs';
  function mine() { try { return JSON.parse(localStorage.getItem(MINE)) || []; } catch (e) { return []; } }
  function addMine(k) { try { var m = mine(); m.push(k); localStorage.setItem(MINE, JSON.stringify(m)); } catch (e) { } }

  /* small cache helpers (fail quietly if the phone blocks storage) */
  function cacheGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  /* ---------- tabs ---------- */
  function showTab(name) {
    var q = name === 'queue';
    $('viewAdd').hidden = q; $('viewQueue').hidden = !q;
    $('tabAdd').setAttribute('aria-selected', String(!q));
    $('tabQueue').setAttribute('aria-selected', String(q));
    window.scrollTo(0, 0);
  }
  $('tabAdd').onclick = function () { showTab('add'); };
  $('tabQueue').onclick = function () { showTab('queue'); refresh(); };

  /* ---------- helpers ---------- */
  /* Is this song waiting in the queue, and when did it last play? (a song that failed to play doesn't count) */
  function history(key) {
    var queued = false, at = 0;
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i]; if (it.key !== key || it.failed) continue;
      if (!it.played) queued = true; else at = Math.max(at, it.playedAt || it.order || 0);
    }
    return { queued: queued, at: at };
  }
  function replayMs() { var m = Number(C.replayAfterMinutes); return m > 0 ? m * 60000 : Infinity; }

  /* '' = free to request, 'queued' = already waiting, 'played' = played too recently to repeat */
  function statusOf(key) {
    var s = history(key);
    if (s.queued) return 'queued';
    return s.at && Date.now() - s.at < replayMs() ? 'played' : '';
  }
  /* whole minutes until a played song can be requested again (0 when repeats are switched off) */
  function replayIn(key) {
    var s = history(key); if (!s.at || replayMs() === Infinity) return 0;
    return Math.max(1, Math.ceil((s.at + replayMs() - Date.now()) / 60000));
  }
  function upcoming() { return queue.filter(function (i) { return !i.played && !i.failed; }); }
  function remaining() { return C.maxSongsPerGuest > 0 ? Math.max(0, C.maxSongsPerGuest - mine().length) : Infinity; }
  function isBanned(r) {
    var hay = (r.title + ' ' + r.artist).toLowerCase();
    for (var i = 0; i < (C.bannedWords || []).length; i++) {
      if (hay.indexOf(String(C.bannedWords[i]).toLowerCase()) > -1) return true;
    }
    return false;
  }

  function friendly(err) {
    if (err && err.reason === 'quotaExceeded') return 'Search is taking a break because it is a busy night. Please try again in a little while.';
    if (err && (err.message === 'network' || err.message === 'timeout')) return "Couldn't reach the music search. Check your connection and try again.";
    return 'Something went wrong with the search. Please try again.';
  }

  /* ---------- search ---------- */
  $('searchForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var q = $('q').value.trim(); if (!q) return;
    $('q').blur();
    searchActive = true; renderPicks();
    fill($('results'), [h('p', { class: 'msg' }, 'Searching…')]);
    try {
      results = await J.search(q);
      renderResults(q);
    } catch (err) {
      fill($('results'), [h('p', { class: 'msg' }, friendly(err))]);
    }
  });

  /* clearing the search box brings the suggestions back */
  $('q').addEventListener('input', function () {
    if ($('q').value.trim()) return;
    searchActive = false; results = [];
    fill($('results'), [h('p', { class: 'msg' }, 'Type a song or artist above and tap Search.')]);
    renderPicks();
  });

  function renderResults(q) {
    updateNotices();
    if (!results.length) {
      fill($('results'), [h('p', { class: 'msg' }, 'No songs found for “' + q + '”. Try the song name and artist.')]);
      return;
    }
    fill($('results'), results.map(resultRow));
  }

  /* redraw whichever list is on screen (search results, or the homescreen suggestions) */
  function rerender() { if (results.length) renderResults(''); else renderPicks(); }

  function resultRow(r) {
    var st = statusOf(r.key), btn;
    if (st === 'played') btn = h('button', { class: 'btn add played', disabled: 'disabled' }, replayIn(r.key) > 0 ? 'Again in ' + replayIn(r.key) + ' min' : 'Played');
    else if (st === 'queued') btn = h('button', { class: 'btn add done', disabled: 'disabled' }, [h('i', { class: 'fa-solid fa-check' }), ' Added']);
    else btn = h('button', { class: 'btn add', onclick: function () { onAdd(r, btn); } }, '+ Add');
    return h('div', { class: 'song' }, [
      J.thumb(r.art, r.title),
      h('div', { class: 'meta' }, [h('div', { class: 't' }, r.title), h('div', { class: 'a' }, r.artist)]),
      btn
    ]);
  }

  async function onAdd(r, btn) {
    if (adding) return;
    if (settings.paused) return J.toast('Requests are paused right now');
    if (remaining() <= 0) return J.toast("You've added your " + C.maxSongsPerGuest + ' songs – thank you!');
    if (isBanned(r)) return J.toast("That one can't be added – try another!");
    adding = true; btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await refresh();                                   // check duplicates against the freshest queue
      var st = statusOf(r.key);
      if (st) {
        var wait = replayIn(r.key);
        J.toast(st === 'queued' ? 'Already in the queue \u{1F389}' : wait > 0 ? 'That one just played. You can request it again in ' + wait + ' min.' : 'That one already played tonight!');
        rerender(); return;
      }
      var rec = { key: r.key, title: r.title, artist: r.artist, art: r.art || '', durationMs: r.durationMs || 0 };
      if (r.videoId) rec.videoId = r.videoId;
      await DB.add(rec);
      addMine(r.key);
      J.toast('Added! \u{1F3B6} See it in the Queue tab');
      await refresh();
      rerender();
    } catch (err) {
      btn.disabled = false; btn.textContent = '+ Add';
      J.toast("Couldn't add that – please try again");
    } finally { adding = false; }
  }

  function updateNotices() {
    $('paused').hidden = !settings.paused;
    var left = remaining();
    if (C.maxSongsPerGuest > 0 && left <= 0) { $('limit').hidden = false; $('limit').textContent = "You've added your " + C.maxSongsPerGuest + ' songs – thank you! \u{1F496}'; }
    else $('limit').hidden = true;
  }

  /* ---------- homescreen suggestions: more from the artists on the base playlist and in the requests ---------- */
  function unique(a) { var seen = {}; return a.filter(function (x) { var k = J.norm(x); if (!k || seen[k]) return false; seen[k] = 1; return true; }); }

  function cleanTitle(t) {
    return String(t || '').replace(/[\(\[].*?[\)\]]/g, ' ')
      .replace(/\b(official|video|music|lyrics?|audio|hd|hq|4k|mv|visuali[sz]er)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  /* Artists behind a few random songs on the base playlist (the playlist is read once per phone and remembered for 6 hours). */
  async function baseArtists(n) {
    var id = J.parseListId(C.basePlaylistId); if (!id) return [];
    var cached = cacheGet('jb_base_titles'), titles = cached && Date.now() - cached.at < 6 * 3600 * 1000 ? cached.titles : null;
    if (!titles) {
      var failedAt = cacheGet('jb_base_fail');
      if (failedAt && Date.now() - failedAt < 10 * 60 * 1000) return [];      // playlist unreadable a moment ago: don't keep asking YouTube
      try { titles = (await J.playlistVideos(id, 250)).map(function (v) { return v.title; }); cacheSet('jb_base_titles', { at: Date.now(), titles: titles }); }
      catch (e) { cacheSet('jb_base_fail', Date.now()); return []; }
    }
    var chosen = J.shuffle(titles.slice()).slice(0, n), known = cacheGet('jb_title_artist') || {};
    await Promise.all(chosen.filter(function (t) { return !known[t]; }).map(async function (t) {
      try { var r = await J.itunes(cleanTitle(t), 1); known[t] = r.length ? r[0].artist : '-'; } catch (e) { }
    }));
    cacheSet('jb_title_artist', known);
    return chosen.map(function (t) { return known[t]; }).filter(function (a) { return a && a !== '-'; });
  }

  async function buildPicks() {
    if (J.ytDemo && J.dbDemo) {                          // preview mode: no internet lookups
      return J.shuffle(J.demoSongs.slice()).map(function (d) { return { key: J.songKey(d[0], d[1]), title: d[0], artist: d[1], art: '', durationMs: 200000 }; })
        .filter(function (r) { return !statusOf(r.key) && !isBanned(r); }).slice(0, 8);
    }
    var requested = unique(queue.map(function (i) { return i.artist; }));
    var listed = unique(C.suggestionArtists || []);                           // artists the couple typed into config.js
    var pool = unique(J.shuffle(requested.slice()).slice(0, 3)
      .concat(J.shuffle(await baseArtists(4)).slice(0, 3))
      .concat(J.shuffle(listed.slice()).slice(0, 2)));
    /* nothing to go on yet (empty queue and the playlist couldn't be read): fall back to crowd-pleasing wedding artists */
    if (pool.length < 3) {
      var fallback = unique(J.demoSongs.map(function (d) { return d[1]; }));
      pool = unique(pool.concat(J.shuffle(fallback).slice(0, 5 - pool.length)));
    }
    pool = pool.slice(0, 5);
    var lists = await Promise.all(pool.map(function (a) {
      return J.itunes(a, 25, 40).then(function (found) {
        var want = J.norm(a);
        return found.filter(function (r) { return J.norm(r.artist).indexOf(want) > -1 && !statusOf(r.key) && !isBanned(r); });
      }).catch(function () { return []; });
    }));
    var out = [];
    lists.forEach(function (l) { out = out.concat(J.shuffle(l).slice(0, 3)); });
    return J.shuffle(out).slice(0, 8);
  }

  function renderPicks() {
    var box = $('picks');
    if (searchActive) { box.hidden = true; return; }
    if (picksLoading && !picks.length) { box.hidden = false; fill($('picksList'), [h('p', { class: 'msg' }, 'Finding songs you might like…')]); return; }
    if (!picks.length) {
      if (!picksFailed) { box.hidden = true; return; }
      box.hidden = false;                                  // say so instead of silently showing nothing
      fill($('picksList'), [h('p', { class: 'msg' }, 'Couldn’t load ideas just now. Tap “New ideas” to try again, or use the search above.')]);
      return;
    }
    box.hidden = false;
    fill($('picksList'), picks.map(resultRow));
  }

  async function loadPicks() {
    if (picksLoading) return;
    picksLoading = true; picksFailed = false; picks = []; renderPicks();
    try { picks = await buildPicks(); } catch (e) { picks = []; }
    picksLoading = false; picksFailed = !picks.length; renderPicks();
  }
  $('picksMore').onclick = loadPicks;

  /* ---------- now playing card ---------- */
  var npKey = '', npAt = null, npRecv = 0;

  function applyNow() {
    var s = settings.now;
    if (!s || !s.title) {
      $('npTitle').textContent = 'The music is about to start!'; $('npArtist').textContent = '';
      $('npLabel').textContent = 'Now playing'; $('npEq').hidden = true; $('npBar').hidden = true;
      if (npKey) { fill($('npThumb'), []); npKey = ''; }
      return;
    }
    if (s.at !== npAt) { npAt = s.at; npRecv = Date.now(); }   // the moment this phone heard the latest position
    $('npTitle').textContent = s.title;
    $('npArtist').textContent = s.artist || '';
    $('npLabel').textContent = s.paused ? 'Paused' : 'Now playing';
    $('npEq').hidden = !!s.paused;
    var key = s.title + '|' + (s.art || '');
    if (key !== npKey) { npKey = key; fill($('npThumb'), [J.thumb(s.art, s.title)]); }
    updateBar();
  }

  /* the player reports its position every few seconds; between reports the bar moves on its own */
  function updateBar() {
    var s = settings.now;
    if (!s || !s.title || !(s.duration > 0)) { $('npBar').hidden = true; return; }
    var pos = (Number(s.pos) || 0) + (s.paused ? 0 : (Date.now() - npRecv) / 1000);
    pos = Math.max(0, Math.min(s.duration, pos));
    $('npBar').hidden = false;
    $('npFill').style.width = (pos / s.duration * 100).toFixed(1) + '%';
    $('npPos').textContent = J.fmtTime(pos); $('npDur').textContent = J.fmtTime(s.duration);
  }
  setInterval(updateBar, 500);

  async function refreshNow() {
    try { settings = (await DB.getSettings()) || {}; } catch (e) { return; }
    updateNotices(); applyNow();
  }
  setInterval(function () { if (!document.hidden) refreshNow(); }, 3000);

  /* ---------- queue view ---------- */
  function renderQueue() {
    var up = upcoming(), m = mine();
    $('count').textContent = up.length ? String(up.length) : '';
    if (!up.length) { fill($('list'), [h('li', {}, h('p', { class: 'msg' }, 'Nothing queued yet – add the first song!'))]); return; }
    fill($('list'), up.map(function (i, n) {
      return h('li', { class: 'song' }, [
        h('div', { class: 'num' }, String(n + 1)),
        J.thumb(i.art, i.title),
        h('div', { class: 'meta' }, [
          h('div', { class: 't' }, [i.title, m.indexOf(i.key) > -1 ? h('span', { class: 'you' }, 'You') : null]),
          h('div', { class: 'a' }, i.artist)])
      ]);
    }));
  }

  /* ---------- keep up to date ---------- */
  async function refresh() {
    try {
      var r = await Promise.all([DB.getQueue(), DB.getSettings()]);
      queue = r[0]; settings = r[1] || {}; fails = 0; $('conn').hidden = true;
    } catch (e) { if (++fails >= 3) $('conn').hidden = false; return; }
    updateNotices(); applyNow(); renderQueue();
    if (!adding) rerender();
  }
  refresh().then(loadPicks);
  setInterval(function () { if (!document.hidden) refresh(); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
