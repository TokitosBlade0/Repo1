/* Satır Arası — YouTube üzerinden telifsiz arka plan müziği: katalog, seçim ve iki oynatıcıyla geçiş.
   Tarayıcıda window.SA_Music, Node'da module.exports (oynatıcı kısmı yalnızca tarayıcıda çalışır). */
(function (root) {
  'use strict';
  const MOODS = ['huzur', 'huzun', 'gerilim', 'karanlik', 'nese', 'ask', 'macera', 'gizem'];

  /* ---------- Katalog ----------
     Hepsi sanatçının kendi kanalında yayımlanmış, CC BY 4.0 lisanslı enstrümantal parçalar.
     Her vid YouTube oEmbed ile doğrulandı (200 = var ve gömülebilir). Atıf satırı ekranda gösterilmeli. */
  const KM = 'Kevin MacLeod', SB = 'Scott Buckley', CZ = 'Chris Zabriskie';
  const SITE = {[KM]: 'incompetech.com', [SB]: 'scottbuckley.com.au', [CZ]: 'chriszabriskie.com'};
  const T = (vid, title, artist, moods, energy, tags) => ({
    vid, title, artist, license: 'CC BY 4.0', moods, energy, tags,
    credit: '"' + title + '" — ' + artist + ' (' + SITE[artist] + '), CC BY 4.0 lisansıyla.'
  });
  const CATALOG = [
    // huzur
    T('fgauFOtjRTE', 'Deep Relaxation', KM, ['huzur'], 0.1, ['calm', 'ambient', 'relaxing', 'meditation', 'long']),
    T('rB68GLeChVM', 'Ethereal Relaxation', KM, ['huzur', 'gizem'], 0.1, ['calm', 'ambient', 'ethereal', 'dreamy', 'long']),
    T('cDISjp3aOEo', 'Garden Music', KM, ['huzur', 'nese'], 0.2, ['calm', 'garden', 'nature', 'gentle', 'long']),
    T('nTtln5hekqw', 'Solace', SB, ['huzur', 'ask'], 0.25, ['calm', 'piano', 'strings', 'gentle']),
    T('e3KpJ5k1Htg', 'Beautiful Oblivion', SB, ['huzur', 'huzun'], 0.2, ['meditative', 'neoclassical', 'piano', 'ambient']),
    T('YlTQSg4so8k', 'Gymnopedie No 1', KM, ['huzur', 'huzun'], 0.15, ['piano', 'classical', 'slow', 'gentle', 'satie']),
    // hüzün
    T('mGpFFxNOiII', 'Undertow', SB, ['huzun'], 0.3, ['sad', 'sombre', 'piano', 'strings']),
    T('uJCJQN3X9Yw', 'Heartbreaking', KM, ['huzun'], 0.25, ['sad', 'piano', 'emotional', 'grief']),
    T('6CqF19xm9Q8', 'Penumbra', SB, ['huzun', 'gizem'], 0.3, ['emotional', 'neoclassical', 'melancholic', 'piano']),
    T('PsxpuDo2FPA', 'Absolution', SB, ['huzun', 'ask'], 0.35, ['emotional', 'strings', 'sad', 'orchestral']),
    T('NBcdKILzgv8', 'Echoes', SB, ['huzun', 'macera'], 0.45, ['emotional', 'orchestral', 'cinematic', 'memory']),
    T('8i_6R2zr9H8', 'The Long Dark', SB, ['huzun', 'karanlik'], 0.2, ['ambient', 'neoclassical', 'piano', 'dark', 'lonely']),
    // gerilim
    T('GWV42GK0E9g', 'Distant Tension', KM, ['gerilim', 'gizem'], 0.55, ['suspense', 'tension', 'mystery', 'cinematic']),
    T('2pXa5jzaOBg', 'Volatile Reaction', KM, ['gerilim', 'macera'], 0.9, ['action', 'chase', 'intense', 'fast', 'danger']),
    T('1skC53i8FBc', 'Red', SB, ['gerilim', 'karanlik'], 0.85, ['epic', 'dark', 'orchestral', 'hybrid', 'battle']),
    T('jdgiQeHnHbY', 'Ignis', SB, ['gerilim', 'macera'], 0.8, ['epic', 'cinematic', 'fire', 'intense']),
    T('laelRe7BS_A', 'Simulacra', SB, ['gerilim'], 0.75, ['epic', 'orchestral', 'tension', 'driving']),
    // karanlık
    T('8W8EJR4ZAm0', 'Maleficus', SB, ['karanlik'], 0.4, ['eerie', 'dark', 'ambient', 'horror', 'gothic']),
    T('lpdu72ndUQw', 'Deep Horrors', KM, ['karanlik'], 0.45, ['horror', 'dark', 'creepy', 'dread']),
    T('eMtWRY1R5j0', 'Darkness is Coming', KM, ['karanlik', 'gerilim'], 0.55, ['dark', 'ominous', 'horror', 'tension']),
    T('7-LEBIfAh1A', 'Dark Fog', KM, ['karanlik', 'gizem'], 0.3, ['dark', 'fog', 'ambient', 'eerie', 'night']),
    T('lTNopjF8Y2Y', 'Hour Of The Witch', SB, ['karanlik', 'gizem'], 0.5, ['dark', 'folk', 'witch', 'gothic', 'cinematic']),
    T('HR4drmVZLGI', 'I Walk With Ghosts', SB, ['karanlik', 'huzun'], 0.25, ['ghost', 'meditative', 'neoclassical', 'haunting']),
    // neşe
    T('uH2vJXVCi9U', 'Upbeat Forever', KM, ['nese'], 0.8, ['happy', 'upbeat', 'cheerful', 'fun']),
    T('BOSaanAf99U', 'Happy Bee', KM, ['nese'], 0.65, ['happy', 'playful', 'light', 'whimsical']),
    T('iIcxxIUSVE8', 'Divertissement', KM, ['nese'], 0.55, ['playful', 'classical', 'whimsical', 'comedy']),
    T('5oQzK7RBpTA', 'Patagonia', SB, ['nese', 'macera'], 0.7, ['uplifting', 'epic', 'orchestral', 'bright']),
    T('2N6LRMFT7_A', 'Snowfall', SB, ['nese', 'huzur'], 0.45, ['uplifting', 'piano', 'winter', 'hopeful']),
    T('Hx3joeh1Jag', 'Growing Up', SB, ['nese', 'huzur'], 0.3, ['calm', 'piano', 'childhood', 'gentle']),
    // aşk
    T('BN3YgwQQCN8', 'At Rest - Romance', KM, ['ask', 'huzur'], 0.2, ['romantic', 'gentle', 'piano', 'tender']),
    T('zRIYMJvOeDo', 'Love Song', KM, ['ask'], 0.3, ['romantic', 'love', 'piano', 'sweet']),
    T('yGHVr5OofVI', 'Aerosol of my Love', KM, ['ask'], 0.35, ['romantic', 'love', 'soft', 'waltz']),
    T('BvIgEsjUYzY', 'Avec Soin - Romance', KM, ['ask', 'huzun'], 0.25, ['romantic', 'tender', 'classical', 'gentle']),
    T('Y-EAU781eG0', 'She Moved Mountains', SB, ['ask', 'huzur'], 0.35, ['ambient', 'piano', 'tender', 'hopeful']),
    T('ittj60VE6bU', 'In This Moment', SB, ['ask', 'huzur'], 0.3, ['ambient', 'piano', 'intimate', 'gentle']),
    // macera
    T('XXEy5qe7O6I', 'Call To Adventure', SB, ['macera'], 0.75, ['adventure', 'cinematic', 'orchestral', 'journey']),
    T('lKfePuM-WdA', 'Pathfinder', SB, ['macera'], 0.85, ['epic', 'adventure', 'orchestral', 'heroic']),
    T('V1S1IfoX8Yg', 'Discovery', SB, ['macera', 'gizem'], 0.7, ['epic', 'cinematic', 'discovery', 'exploration']),
    T('HtkPmu2xlSM', 'Call to Adventure', KM, ['macera'], 0.7, ['adventure', 'orchestral', 'heroic', 'sea']),
    T('Yjx8Oz0VB3s', 'Library Songs 8', SB, ['macera', 'huzun'], 0.6, ['epic', 'emotional', 'orchestral', 'mix', 'long']),
    // gizem
    T('mbNTZW1YPvQ', 'Half Mystery', KM, ['gizem'], 0.35, ['mystery', 'curious', 'investigation', 'sneaky']),
    T('ZjQYnFX25kU', 'Mystery Bazaar', KM, ['gizem', 'macera'], 0.45, ['mystery', 'exotic', 'bazaar', 'intrigue']),
    T('0L-_ySwTSDA', 'Comfortable Mystery 4 - Film Noire', KM, ['gizem'], 0.35, ['noir', 'detective', 'jazz', 'mystery']),
    T('iGyuouyR_Qk', 'World of Magic', SB, ['gizem', 'macera'], 0.5, ['magic', 'mysterious', 'fantasy', 'whimsical']),
    T('wM_AjpJL5I4', 'Decoherence', SB, ['gizem', 'huzur'], 0.3, ['ambient', 'orchestral', 'mysterious', 'space', 'long']),
    T('ujVvdZOgeJU', 'The Temperature of the Air on the Bow of the Kaleetan', CZ, ['gizem', 'huzun'], 0.3, ['ambient', 'electronic', 'pensive', 'sea']),
    T('ye6fxEeZm2g', 'Cylinders (Full Album)', CZ, ['gizem', 'huzur'], 0.3, ['ambient', 'electronic', 'minimal', 'album', 'long']),
    T('4h_kq38dYrQ', 'Undercover Vampire Policeman (Full Album)', CZ, ['gizem', 'karanlik'], 0.4, ['ambient', 'dark', 'electronic', 'album', 'long'])
  ];

  /* ---------- Durum ---------- */
  const S = {
    youtubeKey: '', fetch: null,
    scenes: new Map(), lastVid: null, failed: new Set(), qcache: new Map(),
    players: [null, null], ready: [false, false], active: 0, track: null, state: 'paused',
    volume: 0.6, fading: null, token: 0, listeners: new Set(), waiters: [null, null], prefs: {}
  };
  const api = {CATALOG, init, pick, play, pause, resume, setVolume, current, onChange, configure, setPrefs, rate, prefOf, available: false};
  const hasDOM = typeof document !== 'undefined' && typeof window !== 'undefined';

  function configure(o) {
    o = o || {};
    if ('youtubeKey' in o) { S.youtubeKey = String(o.youtubeKey || '').trim(); S.qcache.clear(); }
    if ('_fetch' in o) S.fetch = o._fetch;          // yalnızca testler için
    if (o._reset) { S.scenes.clear(); S.lastVid = null; S.failed.clear(); S.qcache.clear(); S.track = null; S.prefs = {}; }
  }

  /* ---------- Seçim ---------- */
  const words = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function score(t, mood, energy, qw) {
    const mi = t.moods.indexOf(mood);
    let s = mi === 0 ? 3 : mi > 0 ? 2 : 0;
    s -= Math.abs((t.energy == null ? 0.5 : t.energy) - energy) * 2;
    for (const w of qw) if (t.tags.some(tag => tag === w || (w.length > 4 && tag.startsWith(w.slice(0, 5))))) s += 0.5;
    return s;
  }

  /* ---------- Beğeniler (profil başına; ui.js saklar ve setPrefs ile verir) ----------
     prefs = {<duygu>: {<vid>: 1 | -1}}. O duyguda beğenilen +1,5 puan; beğenilmeyen o duygu için havuzdan çıkar
     (başka aday kalmazsa yine de çalınabilir). Aynı parçayı arka arkaya çalmama kuralı korunur. */
  function setPrefs(p) { S.prefs = p && typeof p === 'object' ? p : {}; }
  function prefOf(vid, mood) { const m = S.prefs && S.prefs[mood]; return m && m[vid] ? m[vid] : 0; }
  function rate(track, mood, v) {
    if (!track || !track.vid) return S.prefs;
    mood = MOODS.includes(mood) ? mood : (track.moods && track.moods[0]) || 'huzur';
    const m = S.prefs[mood] = S.prefs[mood] || {};
    if (v === 1 || v === -1) m[track.vid] = v; else delete m[track.vid];
    if (v === -1) S.scenes.forEach((t, k) => { if (t.vid === track.vid) S.scenes.delete(k); });
    return S.prefs;
  }

  function pickCatalog(req, exclude) {
    const mood = MOODS.includes(req.mood) ? req.mood : 'huzur';
    const energy = typeof req.energy === 'number' && isFinite(req.energy) ? Math.max(0, Math.min(1, req.energy)) : 0.4;
    const qw = words(req.query), seed = String(req.query || '') + '|' + (req.scene == null ? '' : req.scene);
    const base = CATALOG.filter(t => !S.failed.has(t.vid) && !(exclude && exclude.has(t.vid)));
    const liked = base.filter(t => prefOf(t.vid, mood) >= 0);
    const pool = liked.length ? liked : base;
    const list = pool.length ? pool : CATALOG.slice();
    const ranked = list.map(t => ({t, s: score(t, mood, energy, qw) + (prefOf(t.vid, mood) > 0 ? 1.5 : 0), h: hash(seed + t.vid)}))
      .sort((a, b) => b.s - a.s || a.h - b.h);
    const best = ranked.find(x => x.t.vid !== S.lastVid) || ranked[0];
    return best.t;
  }

  function lsGet(k) { try { return root.localStorage ? JSON.parse(root.localStorage.getItem(k)) : null; } catch (_) { return null; } }
  function lsSet(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  // YouTube Data API ile Creative Commons arama (anahtar başlıkta gönderilir)
  async function searchYouTube(query, req) {
    const q = String(query || '').trim().slice(0, 80) + ' instrumental';
    const ck = 'sa_yt_q:' + q.toLowerCase();
    let items = S.qcache.get(ck) || lsGet(ck);
    if (!items) {
      const f = S.fetch || root.fetch;
      const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoLicense=creativeCommon' +
        '&videoEmbeddable=true&videoCategoryId=10&maxResults=10&safeSearch=strict&q=' + encodeURIComponent(q);
      const res = await f(url, {headers: {'x-goog-api-key': S.youtubeKey}});
      if (!res.ok) throw new Error('YouTube arama hatası ' + res.status);
      const data = await res.json();
      items = (data.items || []).filter(x => x.id && x.id.videoId).map(x => ({
        vid: x.id.videoId, title: decodeHtml(x.snippet.title), artist: decodeHtml(x.snippet.channelTitle)
      }));
      lsSet(ck, items);
    }
    S.qcache.set(ck, items);
    const mood = MOODS.includes(req.mood) ? req.mood : 'huzur';
    const cands = items.filter(x => !S.failed.has(x.vid) && prefOf(x.vid, mood) >= 0);
    const c = cands.find(x => x.vid !== S.lastVid);
    if (!c) throw new Error('uygun sonuç yok');
    return {vid: c.vid, title: c.title, artist: c.artist, license: 'Creative Commons (YouTube)', moods: [mood],
      energy: req.energy == null ? 0.4 : req.energy, tags: words(query), source: 'youtube',
      credit: '"' + c.title + '" — ' + c.artist + ' (YouTube, Creative Commons atıf lisansı).',
      alternates: cands.filter(x => x.vid !== c.vid).slice(0, 3).map(x => x.vid)};
  }
  function decodeHtml(s) {
    return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  async function pick(req) {
    req = req || {};
    if (req.scene != null && S.scenes.has(req.scene)) {
      const t = S.scenes.get(req.scene);
      if (!S.failed.has(t.vid) && prefOf(t.vid, req.mood) >= 0) return t;
    }
    let track = null;
    if (S.youtubeKey && req.query && (S.fetch || root.fetch)) {
      try { track = await searchYouTube(req.query, req); } catch (_) { track = null; }  // her hatada kataloga dön
    }
    if (!track) track = pickCatalog(req);
    if (req.scene != null) S.scenes.set(req.scene, track);
    S.lastVid = track.vid;
    return track;
  }

  /* ---------- Bildirimler ---------- */
  function emit(state, track) {
    S.state = state;
    if (track !== undefined) S.track = track;
    const ev = {track: S.track, state};
    S.listeners.forEach(cb => { try { cb(ev); } catch (_) {} });
  }
  function onChange(cb) { S.listeners.add(cb); return () => S.listeners.delete(cb); }
  function current() { return {track: S.track, state: S.state}; }

  /* ---------- Oynatıcılar ---------- */
  function loadApi(timeoutMs) {
    return new Promise(resolve => {
      if (root.YT && root.YT.Player) return resolve(true);
      const t = setTimeout(() => resolve(false), timeoutMs);
      const prev = root.onYouTubeIframeAPIReady;
      root.onYouTubeIframeAPIReady = function () { if (typeof prev === 'function') try { prev(); } catch (_) {} clearTimeout(t); resolve(true); };
      if (!document.querySelector('script[data-sa-yt]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.setAttribute('data-sa-yt', '');
        s.onerror = () => { clearTimeout(t); resolve(false); };
        document.head.appendChild(s);
      }
    });
  }

  function init(hostEl) {
    if (!hasDOM || !hostEl) { api.available = false; return Promise.resolve(false); }
    if (S.initP) return S.initP;
    const started = Date.now();
    S.initP = loadApi(8000).then(ok => {
      if (!ok) { api.available = false; return false; }
      if (getComputedStyle(hostEl).position === 'static') hostEl.style.position = 'relative';
      return new Promise(resolve => {
        let n = 0;
        const done = v => { if (done.d) return; done.d = true; clearTimeout(to); api.available = v; resolve(v); };
        const to = setTimeout(() => done(false), Math.max(1000, 8000 - (Date.now() - started)));
        for (let i = 0; i < 2; i++) {
          const div = document.createElement('div');
          const wrap = document.createElement('div');
          // İki oynatıcı üst üste; etkin olan önde. Boyut hostEl'den gelir (YouTube koşulu: en az 200×200).
          wrap.style.cssText = 'position:absolute;inset:0;transition:opacity .6s;opacity:' + (i === 0 ? 1 : 0) + ';z-index:' + (i === 0 ? 2 : 1);
          wrap.className = 'sa-yt-player'; wrap.appendChild(div); hostEl.appendChild(wrap);
          S.players[i] = new root.YT.Player(div, {
            width: '100%', height: '100%',
            // Boş videoId'li gömme (/embed/?…) YouTube içinde "400 Bad Request" üretiyordu; geçerli bir katalog
            // parçasıyla açılır (autoplay=0, ses 0 — hiçbir şey çalmaz, ilk play() zaten loadVideoById yapar).
            videoId: CATALOG[i].vid,
            playerVars: {autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0,
              origin: location.origin},
            events: {
              onReady: () => { S.ready[i] = true; try { S.players[i].setVolume(0); } catch (_) {} if (++n === 2) done(true); },
              onStateChange: e => onState(i, e.data),
              onError: e => onError(i, e.data)
            }
          });
          S.players[i]._wrap = wrap;
        }
      });
    }).catch(() => { api.available = false; return false; });
    return S.initP;
  }

  function onState(i, st) {
    const w = S.waiters[i];
    if (st === 1 && w) { S.waiters[i] = null; w.resolve(); }
    if (st === 0 && i === S.active) { try { S.players[i].seekTo(0, true); S.players[i].playVideo(); } catch (_) {} } // döngü
  }
  function onError(i, code) {
    const w = S.waiters[i];
    if (w) { S.waiters[i] = null; w.reject(new Error('Oynatıcı hatası ' + code)); }
    else if (i === S.active && S.track) { // çalarken bozulursa sıradakine geç
      S.failed.add(S.track.vid);
      emit('error');
      play(nextCandidate(S.track), {fadeSec: 1}).catch(() => {});
    }
  }

  function startOn(i, track) {
    return new Promise((resolve, reject) => {
      const p = S.players[i];
      const old = S.waiters[i]; if (old) old.reject(new Error('iptal'));
      const to = setTimeout(() => { if (S.waiters[i] === w) { S.waiters[i] = null; reject(new Error('zaman aşımı')); } }, 15000);
      const w = {resolve: () => { clearTimeout(to); resolve(); }, reject: e => { clearTimeout(to); reject(e); }};
      S.waiters[i] = w;
      try { p.setVolume(0); p.loadVideoById({videoId: track.vid, startSeconds: track.start || 0}); }
      catch (e) { S.waiters[i] = null; clearTimeout(to); reject(e); }
    });
  }

  function nextCandidate(track) {
    if (track.alternates) {
      const alt = track.alternates.find(v => !S.failed.has(v));
      if (alt) return Object.assign({}, track, {vid: alt, alternates: track.alternates.filter(v => v !== alt)});
    }
    const ex = new Set([track.vid]);
    return pickCatalog({mood: track.moods && track.moods[0], energy: track.energy, query: (track.tags || []).join(' ')}, ex);
  }

  function crossfade(from, to, sec) {
    if (S.fading) clearInterval(S.fading);
    const P = S.players, steps = Math.max(1, Math.round(sec * 20));
    let k = 0;
    P[to]._wrap.style.opacity = 1; P[to]._wrap.style.zIndex = 2; P[from]._wrap.style.zIndex = 1;
    return new Promise(resolve => {
      const tick = () => {
        k++;
        const x = Math.min(1, k / steps), V = S.volume * 100;
        try { P[to].setVolume(Math.round(V * x)); if (from !== to) P[from].setVolume(Math.round(V * (1 - x))); } catch (_) {}
        if (x >= 1) {
          clearInterval(S.fading); S.fading = null;
          if (from !== to) { try { P[from].pauseVideo(); } catch (_) {} P[from]._wrap.style.opacity = 0; }
          resolve();
        }
      };
      S.fading = setInterval(tick, 50); tick();
    });
  }

  async function play(track, opts) {
    if (!track) return;
    const fadeSec = opts && opts.fadeSec != null ? opts.fadeSec : 3;
    if (!api.available || !S.players[0]) { emit('error', track); throw new Error('YouTube oynatıcısı kullanılamıyor.'); }
    const my = ++S.token;
    if (S.track && S.track.vid === track.vid && S.state === 'playing') return S.track;
    let t = track;
    for (let attempt = 0; attempt < 4; attempt++) {
      emit('loading', t);
      const next = 1 - S.active;
      try {
        await startOn(next, t);
        if (my !== S.token) { try { S.players[next].pauseVideo(); } catch (_) {} return null; } // daha yeni bir istek geldi
        const from = S.active; S.active = next;
        emit('playing', t);
        await crossfade(from, next, fadeSec);
        return t;
      } catch (e) {
        if (my !== S.token) return null;
        S.failed.add(t.vid);
        if (S.scenes) S.scenes.forEach((v, k) => { if (v.vid === t.vid) S.scenes.delete(k); });
        t = nextCandidate(t);
      }
    }
    emit('error', t);
    throw new Error('Müzik çalınamadı.');
  }

  function pause() {
    S.token++;
    if (S.fading) { clearInterval(S.fading); S.fading = null; }
    S.players.forEach(p => { try { p && p.pauseVideo(); } catch (_) {} });
    if (S.track) emit('paused');
  }
  function resume() {
    const p = S.players[S.active];
    if (!p || !S.track) return;
    try { p.setVolume(Math.round(S.volume * 100)); p.playVideo(); emit('playing'); } catch (_) { emit('error'); }
  }
  function setVolume(v) {
    S.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (!S.fading) { const p = S.players[S.active]; try { p && p.setVolume(Math.round(S.volume * 100)); } catch (_) {} }
  }

  api._internal = {score, pickCatalog, state: S};
  root.SA_Music = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
