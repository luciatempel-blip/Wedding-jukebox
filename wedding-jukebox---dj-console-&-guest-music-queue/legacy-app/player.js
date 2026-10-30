/* Player page: two-deck crossfade, guest queue + base playlist, remote controls (skip / volume / pause)
   from the admin page, DJ console buttons, and the QR code modal. */
(function () {
  'use strict';
  var J = window.Jukebox, C = J.C, DB = J.DB, h = J.h;
  var $ = function (id) { return document.getElementById(id); };

  $('names').textContent = C.coupleNames;
  $('signNames').textContent = C.coupleNames;
  J.banner($('demoBanner'));
  J.initMenu({ mount: $('menuMount'), current: 'player' });

  /* iPads and iPhones don't let a web page change the volume of a video (to my knowledge), so a fade can't work there.
     On those devices songs simply follow each other and the volume slider is switched off. */
  var IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var XFADE = IOS ? 0 : Math.max(0, Number(C.crossfadeSeconds) || 0);       // overlap between songs
  var SKIPFADE = IOS ? 0 : Math.max(0, Number(C.skipFadeSeconds) || 0);     // overlap when someone presses Skip
  var FAKE_SECONDS = Number(C.demoSongSeconds) || 40;             // length of a pretend song in demo mode

  var decks = [], cur = -1;                 // two decks; cur = index of the deck that is "now playing"
  var started = false, advancing = false, nowItem = null;
  var baseAll = [], basePool = [], loadedAt = 0, lastGoodAt = Date.now();
  var master = 100;                         // master volume 0-100 (set from admin page or the slider here)
  var musicPaused = false, reqPaused = false, lastSkip = null;
  var lastVolAt = 0, lastMusicAt = 0, lastReqAt = 0;   // when WE last changed it, so polling doesn't undo it
  var warmedFor = null, warming = false, publishedIdle = false, volTimer = null;

  function status(msg) { $('status').textContent = msg || ''; }
  function fill(el, kids) { while (el.firstChild) el.removeChild(el.firstChild); kids.forEach(function (k) { el.appendChild(k); }); }
  function noop() { }

  /* ---------- Decks (each deck is one YouTube player) ---------- */
  function baseDeck(i) { return { id: i, el: $(i ? 'deckB' : 'deckA'), gain: 0, timer: null, errored: 0 }; }

  function makeRealDeck(i) {
    return new Promise(function (resolve) {
      // the buttons live on this page, so YouTube's own controls and full-screen button are switched off
      var vars = { playsinline: 1, rel: 0, modestbranding: 1, controls: 0, fs: 0, disablekb: 1 };
      if (/^https?:/.test(location.protocol)) vars.origin = location.origin;
      var deck = baseDeck(i), p;
      p = new YT.Player(i ? 'ytB' : 'ytA', {
        width: '100%', height: '100%', playerVars: vars,
        events: {
          onReady: function () { resolve(deck); },
          onStateChange: function (e) { onState(deck, e.data); },
          onError: function (e) { onPlayerError(deck, e.data); }
        }
      });
      deck.load = function (id) { p.loadVideoById(id); };
      deck.play = function () { try { p.playVideo(); } catch (e) { } };
      deck.pause = function () { try { p.pauseVideo(); } catch (e) { } };
      deck.stop = function () { try { p.stopVideo(); } catch (e) { } };
      deck.setVolume = function (v) { try { p.setVolume(v); } catch (e) { } };
      deck.time = function () { try { return p.getCurrentTime() || 0; } catch (e) { return 0; } };
      deck.duration = function () { try { return p.getDuration() || 0; } catch (e) { return 0; } };
      deck.state = function () { try { return p.getPlayerState(); } catch (e) { return -1; } };
    });
  }

  /* Demo deck: no sound, but behaves like a real one (position, length, volume) so you can rehearse. */
  function makeFakeDeck(i) {
    var deck = baseDeck(i), box = $(i ? 'ytB' : 'ytA'), vol = 100, playing = false, elapsed = 0, since = 0;
    var name = h('span', {}, ''), line = h('span', {}, '');
    box.className = 'fake';
    fill(box, [h('div', { class: 'fake-inner' }, [h('b', {}, 'DEMO PLAYER ' + (i ? 'B' : 'A') + ' · no real sound'), name, line])]);
    function pos() { return playing ? elapsed + (Date.now() - since) / 1000 : elapsed; }
    deck.load = function (id, meta) { elapsed = 0; since = Date.now(); playing = true; name.textContent = meta.title + ' – ' + (meta.artist || ''); onState(deck, 1); };
    deck.play = function () { if (!playing && name.textContent) { since = Date.now(); playing = true; } };
    deck.pause = function () { if (playing) { elapsed = pos(); playing = false; } };
    deck.stop = function () { playing = false; elapsed = 0; name.textContent = ''; };
    deck.setVolume = function (v) { vol = v; };
    deck.time = pos;
    deck.duration = function () { return name.textContent ? FAKE_SECONDS : 0; };
    deck.state = function () { return playing ? 1 : (name.textContent && elapsed >= FAKE_SECONDS ? 0 : 2); };
    setInterval(function () {
      line.textContent = 'volume ' + Math.round(vol) + '%  ·  ' + J.fmtTime(pos()) + ' / ' + J.fmtTime(FAKE_SECONDS);
      if (playing && pos() >= FAKE_SECONDS) { elapsed = FAKE_SECONDS; playing = false; onState(deck, 0); }
    }, 250);
    return Promise.resolve(deck);
  }

  function applyVol(d) {
    d.setVolume(Math.round(d.gain * master));
    d.el.style.opacity = String(d.gain);
  }

  /* Smooth "equal-power" fade of one deck to a target level (0 = silent, 1 = full). */
  function fadeTo(d, target, sec, done) {
    clearInterval(d.timer); d.timer = null;
    var from = d.gain, t0 = Date.now(), ms = sec * 1000;
    if (ms <= 0) { d.gain = target; applyVol(d); if (done) done(); return; }
    d.timer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      var f = target > from ? Math.sin(k * Math.PI / 2) : 1 - Math.cos(k * Math.PI / 2);
      d.gain = from + (target - from) * f;
      applyVol(d);
      if (k >= 1) { clearInterval(d.timer); d.timer = null; if (done) done(); }
    }, 100);
  }

  function hardStop(d) { clearInterval(d.timer); d.timer = null; d.gain = 0; d.stop(); applyVol(d); }

  function onState(deck, s) {
    if (deck !== decks[cur]) return;                    // ignore the song that is fading out
    if (s === 1 || s === 2 || s === 3) { lastGoodAt = Date.now(); $('tapOverlay').hidden = true; }
    if (s === 0) advance(1.5);                          // song ended without a crossfade (e.g. very short clip)
  }

  function onPlayerError(deck, code) {
    if (deck !== decks[cur]) return;
    status('Skipped a song that would not play. YouTube error ' + code + '.');
    deck.errored = Date.now();                          // tick() skips it after a moment
  }

  /* ---------- Base playlist & picking the next song ---------- */
  function nextBase() {
    if (!baseAll.length) return null;
    if (!basePool.length) {
      basePool = J.shuffle(baseAll.slice());
      if (nowItem && basePool.length > 1 && basePool[0].videoId === nowItem.videoId) basePool.push(basePool.shift());
    }
    return basePool.shift();
  }

  async function loadBase() {
    var rawId = C.basePlaylistId || '';
    var m = rawId.match(/[?&]list=([A-Za-z0-9_-]+)/);
    var id = m ? m[1] : rawId.trim();

    if (!id) { status('No base playlist set – only guest songs will play.'); return; }

    try {
      baseAll = await J.playlistVideos(id, 250);
      status(baseAll.length ? 'Base playlist loaded: ' + baseAll.length + ' songs.' : 'Base playlist looks empty – check privacy settings.');
    } catch (e) {
      status("Couldn't load the base playlist: " + e.message + ". Check that it is set to Public or Unlisted on YouTube.");
    }
  }

  async function nextRequest() {
    var q = await DB.getQueue();
    return q.filter(function (i) { return !i.played && !i.failed; })[0] || null;
  }

  async function resolveItem(item) {
    if (item.videoId) return item.videoId;
    var id = await J.resolveVideo(item);
    DB.update(item.id, { videoId: id }).catch(noop);
    item.videoId = id; return id;
  }

  /* Look up the next guest request's YouTube video a little early so the crossfade starts instantly. */
  async function warmNext() {
    if (warming) return; warming = true;
    try { var item = await nextRequest(); if (item && !item.videoId) await resolveItem(item); }
    catch (e) { } finally { warming = false; }
  }

  /* Guest requests first, base playlist second. If the database can't be reached, keep going with the base playlist. */
  async function pickNext() {
    for (var tries = 0; tries < 5; tries++) {
      var item = null;
      try { item = await nextRequest(); } catch (e) { item = null; }
      if (!item) break;
      try {
        var vid = await resolveItem(item);
        await DB.update(item.id, { played: true, playedAt: Date.now() });
        return { title: item.title, artist: item.artist, art: item.art, videoId: vid, requested: true };
      } catch (e) {
        await DB.update(item.id, { failed: true, failReason: String(e.message || e) }).catch(noop);
      }
    }
    var b = nextBase();
    return b ? Object.assign({}, b, { requested: false }) : null;
  }

  /* ---------- Song transition: the next song fades in on the other deck while this one fades out ---------- */
  async function advance(fadeSec) {
    if (advancing || !started) return;
    advancing = true;
    try {
      if (musicPaused) { setMusicPaused(false); DB.setSettings({ musicPaused: false }).catch(noop); }   // skipping resumes the music
      var track = await pickNext();
      var out = cur >= 0 ? decks[cur] : null;

      if (!track) {                                      // nothing to play
        if (out) fadeTo(out, 0, fadeSec, function () { out.stop(); });
        cur = -1;
        await setIdle();
        return;
      }

      var innIdx = cur === 0 ? 1 : 0, inn = decks[innIdx];
      hardStop(inn);                                     // if an older song is still fading out here, stop it now
      inn.errored = 0;
      cur = innIdx; nowItem = track; warmedFor = null;
      loadedAt = Date.now(); lastGoodAt = Date.now();
      inn.el.style.zIndex = '2'; if (out) out.el.style.zIndex = '1';

      inn.load(track.videoId, track);
      fadeTo(inn, 1, out ? fadeSec : Math.max(fadeSec, 2));
      if (out) fadeTo(out, 0, fadeSec, function () { out.stop(); });

      renderNow(); renderQueue();
      publishNow(); setTimeout(publishNow, 2500);        // second update once YouTube has told us the song length
    } finally {
      advancing = false;
    }
  }

  async function setIdle() {
    nowItem = null; renderNow();
    if (!publishedIdle) { publishedIdle = true; DB.setSettings({ now: null }).catch(noop); }
  }

  /* Runs 4 times a second: start the crossfade when the song is nearly over, and catch stuck / ended / broken songs. */
  function tick() {
    if (!started || advancing || cur < 0 || musicPaused) return;
    var d = decks[cur], now = Date.now();
    if (d.errored && now - d.errored > 800) { d.errored = 0; advance(1); return; }
    if (now - loadedAt < 2500) return;                   // YouTube may still report the previous song's numbers
    if (d.state() === 0) { advance(1.5); return; }       // ended and we missed the event
    var dur = d.duration(), t = d.time();
    if (dur > 0) {
      if (nowItem) nowItem.duration = dur;
      var left = dur - t;
      if (warmedFor !== nowItem && left <= XFADE + 25) { warmedFor = nowItem; warmNext(); }
      if (XFADE > 0 && dur > XFADE * 2.5 && left > 0 && left <= XFADE) advance(XFADE);
    }
  }
  setInterval(tick, 250);

  /* Tell the guest pages what is playing and how far through it is (they animate the bar between updates). */
  function publishNow() {
    if (!started || !nowItem || cur < 0) return;
    var d = decks[cur];
    var dur = d.duration() || nowItem.duration || 0;
    publishedIdle = false;
    DB.setSettings({
      now: {
        title: nowItem.title, artist: nowItem.artist || '', art: nowItem.art || '', requested: !!nowItem.requested,
        at: Date.now(), duration: Math.round(dur), pos: Math.round(d.time()), paused: musicPaused
      }
    }).catch(noop);
  }
  setInterval(publishNow, 5000);

  function renderNow() {
    if (nowItem) {
      $('npTitle').textContent = nowItem.title;
      $('npArtist').textContent = (nowItem.artist || '') + (nowItem.requested ? '  ·  requested by a guest' : '');
    } else {
      $('npTitle').textContent = started ? 'Queue is empty' : 'Waiting to start…';
      $('npArtist').textContent = started ? 'Songs appear here as guests add them.' : '';
    }
  }

  async function renderQueue() {
    try {
      var q = (await DB.getQueue()).filter(function (i) { return !i.played && !i.failed; });
      $('count').textContent = q.length ? String(q.length) : '';
      fill($('list'), q.length ? q.slice(0, 12).map(function (i, n) {
        return h('li', { class: 'song' }, [
          h('div', { class: 'num' }, String(n + 1)),
          J.thumb(i.art, i.title),
          h('div', { class: 'meta' }, [h('div', { class: 't' }, i.title), h('div', { class: 'a' }, i.artist)]),
          h('button', { class: 'btn ghost mini', title: 'Play next', 'aria-label': 'Play next', onclick: function () { playFirst(i, q); } }, '↑'),
          h('button', { class: 'btn danger mini', title: 'Skip this song', 'aria-label': 'Skip this song', onclick: function () { skipQueued(i); } }, h('i', { class: 'fa-solid fa-xmark' }))
        ]);
      }) : [h('li', {}, h('p', { class: 'small' }, 'No guest songs waiting.'))]);
    } catch (e) { }
  }

  /* per-song controls in the Up next list: move a song to the front, or skip it before it ever plays */
  async function playFirst(i, q) {
    var min = q.length ? q[0].order : Date.now();
    try { await DB.update(i.id, { order: min - 1 }); J.toast('Moved to the front'); renderQueue(); } catch (e) { J.toast("Couldn't move it – try again"); }
  }
  async function skipQueued(i) {
    try { await DB.remove(i.id); J.toast('Skipped ' + i.title); renderQueue(); } catch (e) { J.toast("Couldn't skip it – try again"); }
  }

  /* progress bar for the song that is playing */
  function updateBar() {
    var d = cur >= 0 ? decks[cur] : null, dur = d ? (d.duration() || (nowItem && nowItem.duration) || 0) : 0;
    if (!started || !nowItem || !d || !(dur > 0)) { $('npBar').hidden = true; return; }
    var t = Math.max(0, Math.min(dur, d.time()));
    $('npBar').hidden = false;
    $('npFill').style.width = (t / dur * 100).toFixed(1) + '%';
    $('npPos').textContent = J.fmtTime(t); $('npDur').textContent = J.fmtTime(dur);
  }
  setInterval(updateBar, 500);

  /* ---------- Controls: volume, pause music, pause requests, shuffle, skip ---------- */
  function setMaster(v) {
    master = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    $('volSlider').value = master;
    decks.forEach(applyVol);
  }
  $('volSlider').addEventListener('input', function () {
    setMaster(this.value); lastVolAt = Date.now();
    clearTimeout(volTimer);
    volTimer = setTimeout(function () { DB.setSettings({ volume: master }).catch(noop); }, 300);
  });

  function setMusicPaused(p) {
    musicPaused = p; lastMusicAt = Date.now();
    $('musicBtn').innerHTML = p ? '<i class="fa-solid fa-play"></i> Resume Music' : '<i class="fa-solid fa-pause"></i> Pause Music';
    decks.forEach(function (d) { if (p) d.pause(); else if (d.gain > 0) d.play(); });
    publishNow();
  }
  $('musicBtn').onclick = function () {
    if (!started) return J.toast('Press Start the Music first');
    setMusicPaused(!musicPaused);
    DB.setSettings({ musicPaused: musicPaused }).catch(function () { J.toast("Couldn't tell the admin pages – try again"); });
  };

  function showReqPaused(p) {
    reqPaused = p;
    $('pauseRequestsBtn').innerHTML = p ? '<i class="fa-solid fa-play"></i> Resume Requests' : '<i class="fa-solid fa-circle-pause"></i> Pause Guest Requests';
  }
  $('pauseRequestsBtn').onclick = async function () {
    var next = !reqPaused;
    try {
      await DB.setSettings({ paused: next });
      lastReqAt = Date.now(); showReqPaused(next);
      J.toast(next ? 'Requests Paused' : 'Requests Resumed');
    } catch (e) { J.toast('Try again'); }
  };

  $('shuffleBtn').onclick = async function () {
    try {
      var n = await J.shuffleQueue();
      J.toast(n > 1 ? 'Shuffled ' + n + ' requests' : 'Need at least 2 requests to shuffle');
      renderQueue();
    } catch (e) { J.toast('Try again'); }
  };

  $('resetQueueBtn').onclick = async function () {
    if (!confirm('Clear all queued and played songs?')) return;
    try {
      await DB.clearQueue();
      J.toast('Queue Cleared');
      renderQueue();
    } catch (e) { J.toast('Try again'); }
  };

  $('moreBtn').onclick = function () {
    var open = $('hostMore').classList.toggle('open');
    this.setAttribute('aria-expanded', String(open));
    this.innerHTML = open ? '<i class="fa-solid fa-xmark"></i> Fewer controls' : '<i class="fa-solid fa-ellipsis"></i> More controls';
  };

  $('tapBtn').onclick = function () { $('tapOverlay').hidden = true; decks.forEach(function (d) { if (d.gain > 0) d.play(); }); };
  $('skipBtn').onclick = function () { advance(SKIPFADE); };

  /* Check the shared settings every 2 seconds so the admin page (and your fiancee's phone) can control this player. */
  async function pollControl() {
    var s;
    try { s = await DB.getSettings(); } catch (e) { return; }
    var tok = s.skipToken || 0, now = Date.now();
    if (lastSkip === null) lastSkip = tok;                // ignore any skip pressed before this page opened
    else if (tok !== lastSkip) { lastSkip = tok; if (started) advance(SKIPFADE); }
    if (typeof s.volume === 'number' && now - lastVolAt > 4000 && Math.round(s.volume) !== master) setMaster(s.volume);
    if (started && now - lastMusicAt > 4000 && !!s.musicPaused !== musicPaused) setMusicPaused(!!s.musicPaused);
    if (now - lastReqAt > 4000) showReqPaused(!!s.paused);
  }
  setInterval(pollControl, 2000); pollControl();

  /* ---------- QR code modal ---------- */
  function drawQr() {
    var guestUrl = location.href.replace(/player\.html.*$/, '');
    if (/^file:/.test(location.protocol)) guestUrl += 'index.html';
    $('signUrl').textContent = guestUrl;
    var box = $('qr'); box.textContent = '';
    try {
      var qr = qrcode(0, 'M'); qr.addData(guestUrl); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) { box.textContent = 'Could not draw QR code.'; }
  }

  $('qrModalBtn').onclick = function () { drawQr(); $('qrModal').hidden = false; };
  $('closeQrBtn').onclick = function () { $('qrModal').hidden = true; };
  $('printQrBtn').onclick = function () { window.print(); };

  /* ---------- Start ---------- */
  $('startBtn').onclick = async function () {
    $('startBtn').disabled = true; $('startStatus').textContent = 'Loading…';
    try {
      if (J.ytDemo) decks = [await makeFakeDeck(0), await makeFakeDeck(1)];
      else { await J.loadYouTubeApi(); decks = [await makeRealDeck(0), await makeRealDeck(1)]; }
      decks.forEach(function (d) { d.gain = 0; applyVol(d); });
      started = true;
      $('startOverlay').hidden = true;
      DB.setSettings({ volumeOk: !IOS }).catch(noop);    // lets the admin page warn when volume can't be controlled
      await loadBase();
      await advance(2);
    } catch (e) {
      $('startBtn').disabled = false;
      $('startStatus').textContent = 'Problem: ' + e.message;
    }
  };

  /* Every 3 seconds: refresh the list, restart if idle, show the "tap to play" bar if the browser blocked playback. */
  setInterval(function () {
    renderQueue();
    if (!started) return;
    if (!nowItem && !advancing && !musicPaused) advance(2);
    var now = Date.now();
    if (nowItem && !musicPaused && !J.ytDemo && now - loadedAt > 5000 && now - lastGoodAt > 5000) $('tapOverlay').hidden = false;
  }, 3000);

  if (IOS) {
    $('iosNote').hidden = false;
    $('volSlider').disabled = true; $('volSlider').title = 'Not available on iPad/iPhone – use the device volume buttons';
  }

  renderNow(); renderQueue();
})();
