/* Satır Arası — Gemini ile paragraf analizi (okurun kendi API anahtarıyla, doğrudan tarayıcıdan).
   Tarayıcıda window.SA_Gemini, Node'da module.exports. Anahtar asla URL'ye ya da konsola yazılmaz (x-goog-api-key başlığı).
   Model: kullanıcı belirtmediyse ListModels ile anahtarın erişebildiği en iyi Flash modeli seçilir (anahtar başına önbellekli). */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require === 'function' ? require('./core.js') : null);
  const MOODS = (Core && Core.MOODS) || ['huzur', 'huzun', 'gerilim', 'karanlik', 'nese', 'ask', 'macera', 'gizem'];
  // Anahtar sözcük ön taraması (keywords.js): yalnızca belirsiz/sınır paragraflarının 1–2 cümlesi gönderilir
  const KW = root.SA_Keywords || (typeof require === 'function' ? (() => { try { return require('./keywords.js'); } catch (_) { return null; } })() : null);
  const KW_CAP = 2500;                    // istek başına tahmini girdi jetonu üst sınırı (harf/4)
  const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
  const API = API_ROOT + '/';
  // Ayarlarda yer tutucu olarak görünür; boş/“auto” ya da bu değer = otomatik seçim (ListModels).
  const DEFAULT_MODEL = 'gemini-flash-latest';
  const BATCH = 40, FIRST = 12, MAX_CHARS = 350, MIN_CHARS = 40, WINDOW = 120;   // WINDOW: Gemini'ye bir kerede okunacak yer (~2 bölüm)
  const MODEL_TTL = 7 * 864e5;

  const QUERY = {huzur: 'calm ambient piano', huzun: 'sad emotional piano strings', gerilim: 'suspense tension cinematic',
    karanlik: 'dark ambient horror', nese: 'happy playful whimsical', ask: 'romantic gentle piano',
    macera: 'epic adventure orchestral', gizem: 'mysterious ambient noir'};
  const ENERGY = {huzur: 0.2, huzun: 0.3, gerilim: 0.75, karanlik: 0.45, nese: 0.65, ask: 0.35, macera: 0.75, gizem: 0.4};

  const cfg = {
    key: '', model: '',                   // model: '' = otomatik
    interval: 6500,                       // ücretsiz katman: ~dakikada 9 istek
    timeout: 90000,                       // tek istek için üst sınır (asılı kalan bağlantı %0'da dondurmasın)
    fetch: null, sleep: null,             // testler için değiştirilebilir
    mode: 'kw'                            // 'kw' = cümle kipi (ön tarama), 'full' = eski tam paragraf kipi
  };
  try { if (root.localStorage && root.localStorage.getItem('sa:gemMode') === 'full') cfg.mode = 'full'; } catch (_) { /* yok */ }
  const kwOn = () => cfg.mode !== 'full' && !!KW;
  const kwStats = new Map();              // kitap → {sentences, paragraphs, requests, tokens, fullTokens}
  function kwStat(id) {
    const s = kwStats.get(id) || {sentences: 0, paragraphs: 0, requests: 0, tokens: 0, fullTokens: 0};
    s.saving = s.fullTokens > 0 ? Math.max(0, Math.round(100 * (1 - s.tokens / s.fullTokens))) : 0;
    return Object.assign({}, s);
  }
  let lastCall = -Infinity, chain = Promise.resolve();
  const resolved = new Map();             // anahtar özeti → model adı
  const badModels = new Set();
  let resolveP = null, modelList = null;
  const diag = {model: '', batchesDone: 0, batchesTotal: 0, lastError: '', kind: '', state: 'idle', retryAt: 0};

  const now = () => Date.now();
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const abortErr = () => { const e = new Error('İptal edildi'); e.name = 'AbortError'; return e; };
  function sleep(ms, signal) {
    if (cfg.sleep) return cfg.sleep(ms, signal);
    return new Promise((res, rej) => {
      if (signal && signal.aborted) return rej(abortErr());
      const t = setTimeout(() => { if (signal) signal.removeEventListener('abort', on); res(); }, ms);
      const on = () => { clearTimeout(t); rej(abortErr()); };
      if (signal) signal.addEventListener('abort', on, {once: true});
    });
  }
  const rawFetch = (...a) => (cfg.fetch || root.fetch)(...a);
  // Zaman aşımlı fetch: dış sinyal iptal ederse AbortError, süre dolarsa ağ hatası gibi davranır.
  async function fetchT(url, init, signal) {
    if (signal && signal.aborted) throw abortErr();
    const AC = root.AbortController;
    if (!AC) return rawFetch(url, init);
    const ac = new AC(); let timedOut = false;
    const onAbort = () => ac.abort();
    if (signal) signal.addEventListener('abort', onAbort, {once: true});
    const t = setTimeout(() => { timedOut = true; ac.abort(); }, cfg.timeout);
    try { return await rawFetch(url, Object.assign({}, init, {signal: ac.signal})); }
    catch (e) {
      if (signal && signal.aborted) throw abortErr();
      if (timedOut) { const n = new TypeError('timeout'); n.timeout = true; throw n; }
      throw e;
    } finally { clearTimeout(t); if (signal) signal.removeEventListener('abort', onAbort); }
  }
  const headers = json => Object.assign(json ? {'Content-Type': 'application/json'} : {}, {'x-goog-api-key': cfg.key});

  function keyId(k) { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + k.length; }
  const isAuto = m => !m || m === 'auto' || m === DEFAULT_MODEL;
  const LSK = () => 'sa:gemModel:' + keyId(cfg.key);
  function lsGet() { try { const v = JSON.parse(root.localStorage.getItem(LSK())); return v && v.model && now() - v.t < MODEL_TTL ? v.model : null; } catch (_) { return null; } }
  function lsSet(m) { try { if (m) root.localStorage.setItem(LSK(), JSON.stringify({model: m, t: now()})); else root.localStorage.removeItem(LSK()); } catch (_) { /* yok */ } }

  /* ---------- Günlük ücretsiz kota: tükenen modeller anahtar başına Pasifik gece yarısına kadar hatırlanır ---------- */
  const pacificDay = () => { try { return new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'}); } catch (_) { return new Date(now() - 8 * 3600e3).toISOString().slice(0, 10); } };
  const exhaustedMem = new Map();         // keyId → {day, models:[], all:bool}
  function exState() {
    const id = keyId(cfg.key), day = pacificDay();
    let s = exhaustedMem.get(id);
    if (!s) { try { s = JSON.parse(root.localStorage.getItem('sa:gemQuota:' + id)); } catch (_) { s = null; } }
    if (!s || s.day !== day) s = {day, models: [], all: false};
    exhaustedMem.set(id, s);
    return s;
  }
  function exSave(s) { try { root.localStorage.setItem('sa:gemQuota:' + keyId(cfg.key), JSON.stringify(s)); } catch (_) { /* yok */ } }
  const isExhausted = m => exState().models.includes(m);
  function markExhausted(m) { const s = exState(); if (!s.models.includes(m)) s.models.push(m); exSave(s); if (cfg.model === m) cfg.model = ''; resolved.delete(keyId(cfg.key)); lsSet(null); }
  function markAllExhausted() { const s = exState(); s.all = true; exSave(s); }
  const dayBlocked = () => !!cfg.key && exState().all;
  const DAILY_MSG = 'Gemini günlük ücretsiz kotası doldu — yerel analizle devam ediliyor, yarın kendiliğinden yeniden denenecek';
  function dailyError() { const e = new Error(DAILY_MSG); e.kind = 'daily'; e.short = DAILY_MSG; e.fatal = true; e.daily = true; return e; }
  // 429'un günlük (ya da bu modelde hiç ücretsiz kota yok: limit 0) olup olmadığı
  function isDailyQuota(body) {
    const er = (body && body.error) || {};
    const s = JSON.stringify(er.details || []) + ' ' + (er.message || '');
    return /PerDay|per day|daily/i.test(s) || /limit:\s*0\b/.test(s);
  }

  function configure(o) {
    o = o || {};
    if ('key' in o) { const k = String(o.key || '').trim(); if (k !== cfg.key) { cfg.key = k; resolveP = null; modelList = null; badModels.clear(); } }
    if ('model' in o) { const m = String(o.model || '').trim().replace(/^models\//, ''); cfg.model = isAuto(m) ? '' : m; }
    // Yalnızca testler için: _fetch, _interval, _sleep, _timeout, _resetPacing, _resetModels
    if ('_fetch' in o) cfg.fetch = o._fetch;
    if ('_interval' in o) cfg.interval = o._interval;
    if ('_sleep' in o) cfg.sleep = o._sleep;
    if ('_timeout' in o) cfg.timeout = o._timeout;
    if ('mode' in o) { cfg.mode = o.mode === 'full' ? 'full' : 'kw'; try { if (o._persist !== false && root.localStorage) root.localStorage.setItem('sa:gemMode', cfg.mode); } catch (_) { /* yok */ } }
    if (o._resetPacing) { lastCall = -Infinity; chain = Promise.resolve(); }
    if (o._resetModels) { resolved.clear(); badModels.clear(); resolveP = null; modelList = null; exhaustedMem.clear(); }
    // Anahtar + otomatik model: modeli şimdiden arka planda çöz (hata sessiz; analiz sırasında görünür olur).
    if (cfg.key && !cfg.model && !o._noResolve && (cfg.fetch || root.fetch) && !('_fetch' in o)) currentModel().catch(() => {});
  }

  /* ---------- Hata türleri: kind = key | model | quota | net | server | bad ---------- */
  const SHORT = {key: 'Gemini: anahtar geçersiz', model: 'Gemini: model bulunamadı', quota: 'Gemini: kota doldu',
    net: 'Gemini\'ye ulaşılamadı', server: 'Gemini yanıt vermiyor', bad: 'Gemini isteği reddetti'};
  const NET_MSG = 'Gemini\'ye ulaşılamadı. İnternet bağlantınızı kontrol edin; bir reklam engelleyici ya da güvenlik duvarı generativelanguage.googleapis.com adresini engelliyor olabilir.';
  function errorFor(status, body, model) {
    const er = (body && body.error) || {}, msg = er.message || '';
    const reasons = (Array.isArray(er.details) ? er.details : []).map(d => d && d.reason).filter(Boolean).join(' ');
    let kind, text;
    if (status === 400 && (/API_KEY/.test(reasons) || /api key/i.test(msg) || !msg)) kind = 'key';
    else if ((status === 400 || status === 404) && /model|not found|not supported/i.test(msg)) kind = 'model';
    else if (status === 400) kind = 'bad';
    else if (status === 401 || status === 403) kind = 'key';
    else if (status === 404) kind = 'model';
    else if (status === 429) kind = 'quota';
    else if (status >= 500) kind = 'server';
    else kind = 'bad';
    if (kind === 'key' && status === 403) text = 'Bu anahtarın Gemini API erişimi yok (403). AI Studio\'da oluşturulmuş bir anahtar kullanın ve Generative Language API\'nin etkin olduğundan emin olun.';
    else if (kind === 'key') text = 'API anahtarı geçersiz. aistudio.google.com/apikey adresinden yeni bir anahtar oluşturup ayarlara yapıştırın.';
    else if (kind === 'model') text = 'Model bulunamadı ya da bu anahtarla kullanılamıyor: "' + (model || '?') + '". Model alanını boş bırakın; uygun model otomatik seçilir.';
    else if (kind === 'quota') text = 'Ücretsiz kullanım sınırına ulaşıldı (429). Biraz bekleyip yeniden deneyin; günlük sınır dolduysa yarın devam eder.';
    else if (kind === 'server') text = 'Gemini şu an yanıt vermiyor (' + status + '). Birazdan yeniden denenecek.';
    else text = 'Gemini isteği reddetti (' + status + ')' + (msg ? ': ' + msg.slice(0, 160) : '');
    const e = new Error(text); e.status = status; e.body = body; e.kind = kind; e.short = SHORT[kind];
    e.fatal = kind === 'key' || kind === 'model' || kind === 'bad';
    if (kind === 'quota' && isDailyQuota(body)) { e.daily = true; e.message = 'Bu modelin günlük ücretsiz kotası doldu (429).'; }
    return e;
  }
  function netError() { const n = new Error(NET_MSG); n.network = true; n.kind = 'net'; n.short = SHORT.net; return n; }

  // 429 yanıtındaki önerilen bekleme süresi ("retryDelay": "37s")
  function retryDelayMs(body) {
    const d = body && body.error && Array.isArray(body.error.details) ? body.error.details : [];
    for (const x of d) if (x && typeof x.retryDelay === 'string') { const s = parseFloat(x.retryDelay); if (s > 0) return s * 1000; }
    return 0;
  }

  /* ---------- Model seçimi (ListModels) ---------- */
  async function listModels(signal) {
    const out = []; let token = '';
    for (let page = 0; page < 4; page++) {
      let res, data = null;
      try { res = await fetchT(API_ROOT + '?pageSize=1000' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), {headers: headers(false)}, signal); }
      catch (e) { if (e.name === 'AbortError') throw e; throw netError(); }
      try { data = await res.json(); } catch (_) { data = null; }
      if (!res.ok) throw errorFor(res.status, data, 'ListModels');
      for (const m of (data && data.models) || []) out.push(m);
      token = data && data.nextPageToken; if (!token) break;
    }
    modelList = out;
    return out;
  }
  // Tercih: en yeni kararlı Flash → kararlı Flash-Lite → diğer Flash (önizleme, “latest” takma adları)
  function rankModels(models) {
    const c = [];
    for (const m of models || []) {
      const name = String(m && m.name || '').replace(/^models\//, '');
      if (!/flash/.test(name) || /image|tts|audio|live|embed|vision|thinking|robotics|computer|native|aqa/.test(name)) continue;
      if (!(m.supportedGenerationMethods || []).includes('generateContent') || badModels.has(name) || (cfg.key && isExhausted(name))) continue;
      const v = name.match(/gemini-(\d+(?:\.\d+)?)/), ver = v ? parseFloat(v[1]) : 0;
      const stable = !/preview|exp|latest/.test(name) && ver > 0, lite = /lite/.test(name);
      const tier = stable && !lite ? 0 : stable ? 1 : 2;
      c.push({name, tier, ver, suffix: /-\d{3}$/.test(name) ? 1 : 0, eight: /8b/.test(name) ? 1 : 0});
    }
    c.sort((a, b) => a.tier - b.tier || b.ver - a.ver || a.eight - b.eight || a.suffix - b.suffix || a.name.length - b.name.length);
    return c.map(x => x.name);
  }
  async function currentModel(signal) {
    if (dayBlocked()) throw dailyError();
    if (cfg.model && !isExhausted(cfg.model)) return cfg.model;
    if (cfg.model) cfg.model = '';
    const id = keyId(cfg.key);
    if (resolved.has(id) && !isExhausted(resolved.get(id))) return resolved.get(id);
    const st = lsGet(); if (st && !badModels.has(st) && !isExhausted(st)) { resolved.set(id, st); return st; }
    if (!resolveP) {
      resolveP = (async () => {
        let list;
        try { list = rankModels(modelList || await listModels(signal)); }
        catch (e) { if (e.kind === 'server') list = [DEFAULT_MODEL]; else throw e; }   // liste geçici olarak yoksa takma adı dene
        if (!list.length && exState().models.length) { markAllExhausted(); throw dailyError(); }   // hepsinin günlük kotası bitti
        if (!list.length) { const e = errorFor(404, null, 'flash'); e.message = 'Bu anahtarla kullanılabilir bir Gemini Flash modeli bulunamadı.'; throw e; }
        resolved.set(id, list[0]); lsSet(list[0]);
        return list[0];
      })().finally(() => { resolveP = null; });
    }
    return resolveP;
  }
  function invalidateModel(model) {
    badModels.add(model);
    if (cfg.model === model) cfg.model = '';
    resolved.delete(keyId(cfg.key)); lsSet(null);
  }

  /* ---------- İstek kuyruğu: tek sıra, istekler arası en az cfg.interval ms, 429/5xx'te üstel geri çekilme ---------- */
  function enqueue(fn) { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; }

  // o: {onWait(err, ms), retries}
  async function call(model, body, signal, o) {
    o = o || {};
    const maxRetry = o.retries == null ? 5 : o.retries;
    return enqueue(async () => {
      let attempt = 0, netTry = 0;
      for (;;) {
        if (signal && signal.aborted) throw abortErr();
        const wait = lastCall + cfg.interval - now();
        if (wait > 0) await sleep(wait, signal);
        lastCall = now();
        let res, data = null;
        try {
          res = await fetchT(API + encodeURIComponent(model) + ':generateContent', {method: 'POST', headers: headers(true), body: JSON.stringify(body)}, signal);
        } catch (e) {
          if (e && e.name === 'AbortError') throw e;
          if (netTry++ >= Math.min(3, maxRetry)) throw netError();
          const ms = 4000 * Math.pow(2, netTry - 1);
          if (o.onWait) o.onWait(netError(), ms);
          await sleep(ms, signal); continue;
        }
        try { data = await res.json(); } catch (_) { data = null; }
        if (res.ok) return data;
        const err = errorFor(res.status, data, model);
        if (err.fatal || err.daily) throw err;            // günlük kota: bekleyip yeniden denemenin anlamı yok
        if ((err.kind === 'quota' || err.kind === 'server') && attempt < maxRetry) {
          const ms = Math.max(Math.min(120000, 10000 * Math.pow(2, attempt)), retryDelayMs(data));
          attempt++;
          if (o.onWait) o.onWait(err, ms);
          await sleep(ms, signal);
          continue;
        }
        throw err;
      }
    });
  }

  /* ---------- test(): anahtarı ve modeli kota harcamadan doğrula ---------- */
  async function test() {
    if (!cfg.key) return {ok: false, model: cfg.model, error: 'Önce bir Gemini API anahtarı girin (aistudio.google.com/apikey, ücretsiz).'};
    if (!cfg.model) {
      try { resolved.delete(keyId(cfg.key)); lsSet(null); const m = await currentModel(); diag.model = m; return {ok: true, model: m, auto: true}; }
      catch (e) { return {ok: false, model: '', error: e.message, kind: e.kind || 'net'}; }
    }
    const model = cfg.model;
    let res, data = null;
    try { res = await fetchT(API + encodeURIComponent(model), {headers: headers(false)}); }
    catch (e) { return {ok: false, model, error: NET_MSG, kind: 'net'}; }
    try { data = await res.json(); } catch (_) { /* boş */ }
    if (res.ok) return {ok: true, model};
    const er = errorFor(res.status, data, model);
    const out = {ok: false, model, error: er.message, kind: er.kind};
    if (er.kind === 'model') { // önerilecek bir Flash modeli bul
      try {
        const list = rankModels(await listModels());
        if (list.length) { out.suggested = list[0]; out.error += ' Hesabınızda kullanılabilir: ' + list.slice(0, 3).join(', ') + '.'; }
      } catch (_) { /* yok */ }
    }
    return out;
  }

  /* ---------- Yerel (Core) analiz ---------- */
  function localOne(text, lang, prevMood) {
    let mood = prevMood || 'huzur', strength = 0;
    if (Core) {
      const a = Core.analyze(String(text || ''), lang), mi = Core.topMood(a.v);
      strength = a.v[mi];
      if (strength >= (Core.NEUTRAL || 0.2) * 0.75 || !prevMood) mood = strength > 0 ? MOODS[mi] : mood;
    }
    return {mood, energy: +clamp01(ENERGY[mood] + Math.min(0.2, strength * 0.3)).toFixed(2), query: QUERY[mood], scene: 0, source: 'local'};
  }

  /* Bir aralığa sahne numarası ver. Sahne kimliği = sahnenin başladığı paragraf indeksi (küresel olarak benzersiz).
     breaks[k] true ise k. öğe yeni sahne başlatır. Komşu toplu işlerle sınırda birleştirir. */
  function placeItems(results, start, items, breaks) {
    for (let k = 0; k < items.length; k++) {
      const i = start + k, it = items[k];
      if (k === 0) { const p = results[i - 1]; it.scene = p && p.mood === it.mood ? p.scene : i; }
      else it.scene = breaks[k] ? i : results[i - 1].scene;
      results[i] = it;
    }
    const end = start + items.length, nx = results[end], last = results[end - 1];
    if (nx && last && nx.mood === last.mood && nx.scene === end) {
      for (let j = end; j < results.length && results[j] && results[j].scene === end; j++) results[j].scene = last.scene;
    }
  }

  function localRange(paragraphs, lang, results, start, end) {
    const items = [], breaks = [];
    let prev = results[start - 1] ? results[start - 1].mood : null;
    for (let i = start; i < end; i++) {
      const it = localOne(paragraphs[i], lang, prev);
      breaks.push(items.length > 0 && it.mood !== prev);
      items.push(it); prev = it.mood;
    }
    placeItems(results, start, items, breaks);
  }

  /* ---------- Toplu iş sırası: `from`un bulunduğu topludan başlayıp dışa doğru (ileri önce) ---------- */
  function batchOrder(total, from, size) {
    size = size || BATCH;
    const n = Math.ceil(total / size), out = [];
    if (!n) return out;
    const s = Math.max(0, Math.min(n - 1, Math.floor((from || 0) / size)));
    out.push(s);
    for (let d = 1; out.length < n; d++) {
      if (s + d < n) out.push(s + d);
      if (s - d >= 0) out.push(s - d);
    }
    return out.map(b => ({index: b, start: b * size, end: Math.min(total, (b + 1) * size)}));
  }
  // İlk istek küçük: okurun konumu çevresinde ~12 paragraf (ilerleme saniyeler içinde kıpırdasın)
  function leadRange(total, from) {
    if (!total) return null;
    const s = Math.max(0, Math.min(total - 1, (from || 0) - 2));
    return {start: s, end: Math.min(total, s + FIRST), lead: true};
  }
  function missingRuns(results, start, end) {
    const runs = [];
    for (let i = start; i < end; i++) if (!results[i]) { let j = i; while (j < end && !results[j]) j++; runs.push([i, j]); i = j; }
    return runs;
  }
  function plan(total, from, results, lo, hi, size) {
    lo = lo || 0; hi = hi == null ? total : Math.min(total, hi);
    const L = leadRange(total, from), ranges = L && L.start < hi ? [{start: L.start, end: Math.min(hi, L.end), lead: true}] : [];
    for (const b of batchOrder(hi - lo, from - lo, size || BATCH)) ranges.push({index: b.index, start: b.start + lo, end: b.end + lo});
    // Toplam tahmini: öncü aralık dolmuş sayılarak eksiği olan aralıklar
    const sim = results.slice(); let count = 0;
    for (const r of ranges) { if (missingRuns(sim, r.start, r.end).length) count++; for (let i = r.start; i < r.end; i++) sim[i] = sim[i] || 1; }
    return {ranges, count};
  }

  /* ---------- İstem ve şema ---------- */
  const SCHEMA = {
    type: 'OBJECT', required: ['items'],
    properties: {items: {type: 'ARRAY', items: {type: 'OBJECT', required: ['i', 'mood', 'energy', 'query', 'scene'],
      properties: {i: {type: 'INTEGER'}, mood: {type: 'STRING', enum: MOODS}, energy: {type: 'NUMBER'},
        query: {type: 'STRING'}, scene: {type: 'INTEGER'}}}}}
  };
  const SYSTEM = [
    'You are a film music supervisor scoring a book for a reading app. For each numbered paragraph choose background music.',
    'mood must be one of: huzur (calm/peaceful), huzun (sad/melancholic), gerilim (tension/suspense/action), karanlik (dark/horror/gothic), nese (joy/humour/playful), ask (love/romance/tenderness), macera (adventure/epic/journey), gizem (mystery/curiosity/intrigue).',
    'energy: 0 = very quiet and slow, 1 = intense and fast.',
    'query: a short English YouTube search phrase (3-6 words) for royalty-free INSTRUMENTAL music fitting the paragraph, e.g. "gentle victorian piano waltz", "dark gothic strings ambience". No artist names, no lyrics.',
    'scene: integer label. Consecutive paragraphs that belong to the same scene and should keep ONE track share the same scene number. Keep the same scene across neighbouring paragraphs unless the mood truly changes; avoid changing music for a single line of dialogue. Start at 0 and increase by 1 when a new scene starts.',
    'Return exactly one item per paragraph, with i equal to the paragraph number, in order.'
  ].join('\n');

  // Düşünme bütçesi 0'ı kabul eden modeller (2.5 Flash / Flash-Lite); diğerlerine alan hiç gönderilmez
  const noThinking = m => /^gemini-2\.5-flash(?!-image)/.test(String(m || ''));
  function buildRequest(book, paras, start, model) {
    const lines = paras.map((p, k) => '[' + k + '] ' + String(p || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS));
    const text = 'Book: "' + (book.title || 'Untitled') + '" (language: ' + (book.lang || 'en') + '). Paragraphs ' + start + '–' + (start + paras.length - 1) +
      ' of the book (very short lines omitted), renumbered 0–' + (paras.length - 1) + ':\n\n' + lines.join('\n\n');
    const gc = {responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4, maxOutputTokens: 160 + paras.length * 60};
    if (noThinking(model)) gc.thinkingConfig = {thinkingBudget: 0};
    return {
      systemInstruction: {parts: [{text: SYSTEM}]},
      contents: [{role: 'user', parts: [{text}]}],
      generationConfig: gc
    };
  }
  // Cümle kipi isteği: kısa sistem istemi + yalnızca seçilen cümle satırları; şema [{p, mood, intensity}]
  function buildKwRequest(book, chunk, model, ctxMood) {
    const text = KW.promptText(book, chunk, ctxMood);
    const gc = {responseMimeType: 'application/json', responseSchema: KW.SCHEMA, temperature: 0.3, maxOutputTokens: 60 + chunk.send.length * 24};
    if (noThinking(model)) gc.thinkingConfig = {thinkingBudget: 0};
    return {systemInstruction: {parts: [{text: KW.SYSTEM}]}, contents: [{role: 'user', parts: [{text}]}], generationConfig: gc};
  }
  // Tahmini girdi jetonu (harf/4): sistem istemi + kullanıcı metni
  const reqTokens = body => Math.ceil(((body.systemInstruction ? body.systemInstruction.parts[0].text.length : 0) + body.contents[0].parts[0].text.length) / 4);
  const isShort = p =>String(p || '').replace(/\s+/g, ' ').trim().length < MIN_CHARS;
  // Kısa satırlar (“Evet.”, başlık parçaları) Gemini'ye gitmez; komşu paragrafın sonucunu (sahnesiyle) devralır
  function fillShort(results, paragraphs, start, end) {
    for (let i = start; i < end; i++) {
      if (!isShort(paragraphs[i])) continue;
      let src = null;
      for (let j = i - 1; j >= Math.max(0, i - 200) && !src; j--) if (results[j] && !isShort(paragraphs[j])) src = results[j];
      for (let j = i + 1; j < Math.min(results.length, i + 200) && !src; j++) if (results[j] && !isShort(paragraphs[j])) src = results[j];
      if (src) results[i] = Object.assign({}, src);
    }
  }

  /* ---------- Yanıt metni: candidates[0].content.parts[].text; düşünce (thought) parçaları atlanır ---------- */
  function responseText(data) {
    try {
      const parts = (data.candidates[0].content.parts || []).filter(p => p && !p.thought && typeof p.text === 'string');
      return parts.map(p => p.text).join('');
    } catch (_) { return ''; }
  }
  /* ---------- Yanıtı doğrula/onar. Dönüş: {items:[ham ya da null], valid: sayı} ---------- */
  function parseResponse(data, n) {
    const txt = responseText(data);
    let obj = null;
    try { obj = JSON.parse(txt); }
    catch (_) { const m = txt.match(/[[{][\s\S]*[\]}]/); if (m) try { obj = JSON.parse(m[0]); } catch (__) { /* bozuk */ } }
    let arr = Array.isArray(obj) ? obj : obj && Array.isArray(obj.items) ? obj.items : [];
    arr = arr.filter(x => x && typeof x === 'object');
    const out = new Array(n).fill(null);
    const byIndex = arr.every(x => Number.isInteger(x.i)) && new Set(arr.map(x => x.i)).size === arr.length;
    arr.forEach((x, k) => { const i = byIndex ? x.i : k; if (i >= 0 && i < n && !out[i]) out[i] = x; });
    const blocked = !!(data && ((data.promptFeedback && data.promptFeedback.blockReason) || (data.candidates && data.candidates[0] && /SAFETY|BLOCKLIST|PROHIBITED|RECITATION/.test(data.candidates[0].finishReason || ''))));
    return {items: out, valid: out.filter(Boolean).length, count: arr.length, blocked};
  }

  // Ham öğeyi temiz sonuca çevir; geçersiz mood → yerel yedek
  function repairItem(raw) {
    if (!raw || !MOODS.includes(raw.mood)) return null;
    let e = Number(raw.energy);
    if (!isFinite(e)) e = ENERGY[raw.mood];
    if (e > 1 && e <= 10) e /= 10;
    let q = typeof raw.query === 'string' ? raw.query.replace(/[\r\n"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!q) q = QUERY[raw.mood];
    return {mood: raw.mood, energy: +clamp01(e).toFixed(2), query: q, scene: Number.isInteger(raw.scene) ? raw.scene : null, source: 'gemini'};
  }

  function finishBatch(results, paragraphs, lang, start, parsed) {
    const n = parsed.items.length, items = [], breaks = [];
    let prev = results[start - 1] ? results[start - 1].mood : null;
    for (let k = 0; k < n; k++) {
      let it = repairItem(parsed.items[k]);
      const ms = it ? it.scene : null;
      if (!it) it = localOne(paragraphs[start + k], lang, prev);
      const p = items[k - 1];
      // Gemini'nin sahne etiketi değiştiyse ya da (etiket yoksa) mood değiştiyse yeni sahne
      breaks.push(k > 0 && (ms !== null && p._ms !== null ? ms !== p._ms : it.mood !== p.mood));
      it._ms = ms; items.push(it); prev = it.mood;
    }
    items.forEach(it => delete it._ms);
    placeItems(results, start, items, breaks);
  }

  /* ---------- Önbellek: IndexedDB (yoksa bellek) ---------- */
  const mem = new Map();
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(res => {
      const t = setTimeout(() => res(null), 3000);    // engellenen/asılı açılış analizi dondurmasın
      const done = v => { clearTimeout(t); res(v); };
      try {
        if (!root.indexedDB) return done(null);
        const r = root.indexedDB.open('satir-arasi-gemini', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('analysis');
        r.onsuccess = () => done(r.result);
        r.onerror = () => done(null);
        r.onblocked = () => done(null);
      } catch (_) { done(null); }
    });
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    if (!d) return undefined;
    return new Promise(res => {
      try {
        const tx = d.transaction('analysis', mode), req = fn(tx.objectStore('analysis'));
        req.onsuccess = () => res(req.result); req.onerror = () => res(undefined);
      } catch (_) { res(undefined); }
    });
  }
  async function loadEntry(id) {
    if (mem.has(id)) return mem.get(id);
    const v = await idb('readonly', s => s.get(id));
    if (v) mem.set(id, v);
    return v || null;
  }
  async function saveEntry(id, entry) {
    mem.set(id, entry);
    await idb('readwrite', s => s.put(entry, id));
  }
  // Yalnızca Gemini'den gelen sonuçlar döner; yerel yedekle doldurulmuş yerler null (tamamlanmış sayılmasın).
  async function getCached(bookId) { const e = await loadEntry(bookId); return e ? e.results.map(r => r && r.source === 'gemini' ? r : null) : null; }
  async function clearCache(bookId) { mem.delete(bookId); await idb('readwrite', s => s.delete(bookId)); }

  function signature(paragraphs) {
    const s = paragraphs.length + '|' + (paragraphs[0] || '').slice(0, 200) + '|' + (paragraphs[paragraphs.length - 1] || '').slice(-200);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  /* ---------- analyze ----------
     opts: {from, window, signal, onProgress(results, geminiDone, total), onStatus(diag)}
     Gemini yalnızca okurun bulunduğu yeri işler: [from, from+window) (varsayılan WINDOW ≈ 2 bölüm); kalan hemen yereldir.
     Okur ilerledikçe extend(bookId, from) aynı ayarlarla pencereyi kaydırır (önbellekteki Gemini sonuçları korunur).
     Ölümcül hata (anahtar/model/ağ/kota tükendi): kalan yerel doldurulur, results.error (kısa Türkçe durum),
     results.errorKind, results.errorDetail ayarlanır ve sonuç döner (reddetmez). */
  async function analyze(book, opts) {
    opts = opts || {};
    const paragraphs = (book && book.paragraphs) || [], total = paragraphs.length, lang = book.lang || 'en';
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};
    const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {};
    const status = s => { Object.assign(diag, s); try { onStatus(Object.assign({}, diag)); } catch (_) { /* yok */ } };
    const signal = opts.signal;
    const gcount = r => r.reduce((a, x) => a + (x && x.source === 'gemini' ? 1 : 0), 0);
    const results = new Array(total).fill(null);
    if (book && book.id != null) sessions.set(book.id, {book, opts});

    if (!cfg.key) { // anahtar yok: tamamen yerel
      localRange(paragraphs, lang, results, 0, total);
      onProgress(results, total, total);
      return results;
    }

    const sig = signature(paragraphs), id = book.id;
    const cached = id != null ? await loadEntry(id) : null;
    if (cached && cached.sig === sig && cached.results.length === total) {
      cached.results.forEach((r, i) => { if (r && r.source === 'gemini') results[i] = r; });
      if (cached.kw && id != null && !kwStats.has(id)) kwStats.set(id, Object.assign({}, cached.kw));
    }
    let model = cfg.model || '';
    const save = () => id != null ? saveEntry(id, {sig, model, total, updated: now(), results: results.slice(), kw: kwStats.get(id) || null}) : null;
    const from = Math.max(0, Math.min(total ? total - 1 : 0, opts.from || 0)), win = opts.window > 0 ? opts.window : WINDOW;
    const lo = from, hi = Math.min(total, from + win);
    for (const [a, b] of missingRuns(results, 0, total)) {     // pencere dışı: önbellekte yoksa yerel
      if (b <= lo) localRange(paragraphs, lang, results, a, b);
      else if (a >= hi) localRange(paragraphs, lang, results, a, b);
      else { if (a < lo) localRange(paragraphs, lang, results, a, lo); if (b > hi) localRange(paragraphs, lang, results, hi, b); }
    }
    // Cümle kipinde pencere tek parti (öncü aralık ayrı): istek sayısı da azalır
    const kw = kwOn() && opts.mode !== 'full', step = kw ? win : BATCH;
    const P = plan(total, from, results, lo, hi, step);
    status({state: 'run', batchesDone: 0, batchesTotal: P.count, lastError: '', kind: '', retryAt: 0, model, windowFrom: lo, windowTo: hi, mode: kw ? 'kw' : 'full', kw: kwStat(id)});
    onProgress(results, gcount(results), total);

    const fail = async e => {
      results.error = e.short || SHORT.net; results.errorKind = e.kind || 'net'; results.errorDetail = e.message;
      for (let i = 0; i < total; i++) if (!results[i]) { let j = i; while (j < total && !results[j]) j++; localRange(paragraphs, lang, results, i, j); i = j; }
      await save();
      status({state: 'error', lastError: results.error, kind: results.errorKind, retryAt: 0});
      onProgress(results, gcount(results), total);
      return results;
    };

    // Tamamı önbellekte: hiçbir istek (ListModels dahil) atılmaz
    if (!results.some(x => !x)) { status({state: 'done', batchesDone: 0, batchesTotal: 0}); return results; }

    try { model = await currentModel(signal); status({model}); }
    catch (e) { if (e.name === 'AbortError') throw e; return fail(e); }

    let reResolved = false;
    const onWait = (err, ms) => status({state: 'wait', kind: err.kind, lastError: err.short, retryAt: now() + ms});
    // Tek istek (model değişimi/geri çekilme dahil). Dönüş: {data} | {done: sonuç (ölümcül hata)} | {skip: true} (5xx tükendi)
    async function request(build) {
      for (;;) {
        if (signal && signal.aborted) { await save(); throw abortErr(); }
        try { return {data: await call(model, build(model), signal, {onWait})}; }
        catch (err) {
          if (err.name === 'AbortError') { await save(); throw err; }
          if (err.daily) {                           // bu modelin günlük kotası bitti: sıradaki modele bir kez geç
            markExhausted(model);
            try { model = await currentModel(signal); status({model, lastError: err.message, kind: 'quota'}); continue; }
            catch (e2) { if (e2.name === 'AbortError') throw e2; return {done: await fail(e2)}; }
          }
          if (err.kind === 'model' && !reResolved) {    // model gitti/yanlış: bir kez yeniden seç ve tekrar dene
            reResolved = true; invalidateModel(model);
            try { model = await currentModel(signal); status({model}); continue; }
            catch (e2) { if (e2.name === 'AbortError') throw e2; return {done: await fail(e2)}; }
          }
          if (err.fatal || err.network || err.kind === 'quota') return {done: await fail(err)};
          status({lastError: err.short || err.message, kind: err.kind || ''});   // 5xx tükendi: bu parça yerel, devam
          return {skip: true};
        }
      }
    }
    // Eski kipte aynı aralık kaç jeton tutardı (tasarruf istatistiği için; istek atılmaz)
    function fullTokensFor(s, e) {
      let t = 0;
      for (let b = s; b < e; b += BATCH) {
        const idx = []; for (let i = b; i < Math.min(e, b + BATCH); i++) if (!isShort(paragraphs[i])) idx.push(i);
        if (idx.length) t += reqTokens(buildRequest(book, idx.map(i => paragraphs[i]), b, ''));
      }
      return t;
    }
    // Cümle kipi: yerel tarama → yalnızca belirsiz/sınır cümleleri Gemini'ye → çöz ve yerleştir
    async function kwBatch(s, e) {
      const sc = KW.scanBook(paragraphs, lang), sel = KW.select(sc, s, e, {capTokens: KW_CAP});
      const st = kwStats.get(id) || {sentences: 0, paragraphs: 0, requests: 0, tokens: 0, fullTokens: 0};
      if (id != null) kwStats.set(id, st);
      st.fullTokens += fullTokensFor(s, e);
      const answers = new Map(), ctx = results[s - 1] ? results[s - 1].mood : '';
      for (const ch of KW.chunks(sel, KW_CAP)) {
        const ids = ch.send.map(x => x.p);
        for (let attempt = 0; attempt < 2; attempt++) {
          const r = await request(m => buildKwRequest(book, ch, m, ctx));
          if (r.done) return r.done;
          if (r.skip) break;
          st.requests++; st.tokens += reqTokens(buildKwRequest(book, ch, model, ctx));
          if (!attempt) { st.sentences += ch.sentences; st.paragraphs += ids.length; }
          const txt = responseText(r.data);
          let obj = null; try { obj = JSON.parse(txt); } catch (_) { const m = txt.match(/[[{][\s\S]*[\]}]/); if (m) try { obj = JSON.parse(m[0]); } catch (__) { /* bozuk */ } }
          const got = KW.parseAnswers(obj, ids);
          got.forEach((v, k) => answers.set(k, v));
          const blocked = !!(r.data && r.data.promptFeedback && r.data.promptFeedback.blockReason);
          if (got.size || blocked) break;            // hiç geçerli yanıt yoksa bir kez daha dene; eksikler yerel kalır
        }
      }
      if (diag.state !== 'run') status({state: 'run', retryAt: 0});
      const res = KW.resolve(sc, s, e, sel, answers), items = [], breaks = [];
      for (let k = 0; k < res.length; k++) {
        const x = res[k], mood = x.mood;
        const energy = x.intensity == null ? ENERGY[mood] : clamp01(ENERGY[mood] + (x.intensity - 0.5) * 0.4);
        items.push({mood, energy: +energy.toFixed(2), query: QUERY[mood], scene: 0, source: 'gemini', via: x.via});
        breaks.push(k > 0 && mood !== items[k - 1].mood);
      }
      placeItems(results, s, items, breaks);
      await save();
      status({kw: kwStat(id)});
      onProgress(results, gcount(results), total);
      return null;
    }

    for (const r of P.ranges) {
      const runs = missingRuns(results, r.start, r.end);
      if (!runs.length) continue;
      for (const [s0, e0] of runs) {
        for (let s = s0; s < e0; s += step) {
          const e = Math.min(e0, s + step);
          if (kw) { const out = await kwBatch(s, e); if (out) return out; continue; }
          const idx = []; for (let i = s; i < e; i++) if (!isShort(paragraphs[i])) idx.push(i);   // kısa satırlar gönderilmez
          const paras = idx.map(i => paragraphs[i]), n = paras.length;
          let parsed = null;
          for (let attempt = 0; n && attempt < 2; attempt++) {
            const rq = await request(m => buildRequest(book, paras, s, m));
            if (rq.done) return rq.done;
            if (rq.skip) break;
            const p = parseResponse(rq.data, n);
            if (!parsed || p.valid > parsed.valid) parsed = p;
            if ((p.valid === n && p.count === n) || p.blocked) break;   // uzunluk doğru → tamam; değilse bir kez daha dene
          }
          if (diag.state !== 'run') status({state: 'run', retryAt: 0});
          // Uzun paragrafların sonuçlarını yerine koy; kısalar önce null (yerel), sonra komşudan devralır
          const full = new Array(e - s).fill(null);
          if (parsed) idx.forEach((i, k) => { full[i - s] = parsed.items[k]; });
          finishBatch(results, paragraphs, lang, s, {items: full});
          fillShort(results, paragraphs, Math.max(0, s - 1), Math.min(total, e + 1));
          await save();
          onProgress(results, gcount(results), total);
        }
      }
      status({batchesDone: Math.min(P.count, diag.batchesDone + 1)});
    }
    status({state: 'done', retryAt: 0});
    return results;
  }

  /* ---------- extend: okur ilerledikçe Gemini penceresini kaydır ----------
     Aynı kitap için son analyze ayarlarıyla (onProgress/onStatus/signal) from'dan ileri WINDOW paragrafı işler.
     Önceki çalışma bitmeden çağrılırsa sıraya girer; aynı pencere tekrar istenirse istek atılmaz. Oturum yoksa null. */
  const sessions = new Map(), running = new Map();
  function extend(bookId, from, o) {
    const s = sessions.get(bookId);
    if (!s) return Promise.resolve(null);
    const opts = Object.assign({}, s.opts, o || {}, {from: Math.max(0, from || 0)});
    const prev = running.get(bookId) || Promise.resolve();
    const p = prev.catch(() => {}).then(() => analyze(s.book, opts));
    running.set(bookId, p);
    p.then(() => { if (running.get(bookId) === p) running.delete(bookId); }, () => { if (running.get(bookId) === p) running.delete(bookId); });
    return p;
  }

  /* ---------- Kapak gibi yan işler için genel istekler (aynı anahtar, aynı kuyruk) ---------- */
  async function generateJSON(prompt, schema, o) {
    o = o || {};
    if (!cfg.key) throw netError();
    let model = await currentModel(o.signal);
    const body = {contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: Object.assign({responseMimeType: 'application/json', temperature: o.temperature == null ? 0.7 : o.temperature}, schema ? {responseSchema: schema} : {})};
    if (o.system) body.systemInstruction = {parts: [{text: o.system}]};
    let data;
    try { data = await call(model, body, o.signal, {retries: o.retries == null ? 1 : o.retries}); }
    catch (e) {
      if (e.daily) { markExhausted(model); throw e; }
      if (e.kind !== 'model') throw e;
      invalidateModel(model); model = await currentModel(o.signal);
      data = await call(model, body, o.signal, {retries: 1});
    }
    const txt = responseText(data);
    try { return JSON.parse(txt); } catch (_) { const m = txt.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('JSON yok'); }
  }
  function imageModels(models) {
    return (models || []).filter(m => { const n = String(m.name || ''); return /image/.test(n) && !/imagen/.test(n) && (m.supportedGenerationMethods || []).includes('generateContent'); })
      .map(m => m.name.replace(/^models\//, ''))
      .sort((a, b) => (/preview|exp/.test(a) ? 1 : 0) - (/preview|exp/.test(b) ? 1 : 0) || b.localeCompare(a));
  }
  // Görsel üretimi: hızlı başarısız olur (yeniden deneme yok). Dönüş: data: URL ya da null.
  async function generateImage(prompt, o) {
    o = o || {};
    if (!cfg.key || dayBlocked()) return null;
    const list = imageModels(modelList || await listModels(o.signal));
    for (const model of list.slice(0, 2)) {
      for (const withCfg of [true, false]) {
        const body = {contents: [{role: 'user', parts: [{text: prompt}]}],
          generationConfig: Object.assign({responseModalities: ['TEXT', 'IMAGE']}, withCfg ? {imageConfig: {aspectRatio: '2:3'}} : {})};
        try {
          const data = await call(model, body, o.signal, {retries: 0});
          const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
          for (const p of parts) { const d = p.inlineData || p.inline_data; if (d && d.data) return 'data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data; }
          break;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          if (e.kind === 'quota' || e.kind === 'key' || e.kind === 'net') return null;   // ücretsiz katman reddetti: sessizce geç
          if (!(e.kind === 'bad' && withCfg)) break;                                       // imageConfig desteklenmiyorsa onsuz bir kez dene
        }
      }
    }
    return null;
  }

  const api = {configure, test, analyze, extend, WINDOW, getCached, clearCache, DEFAULT_MODEL, generateJSON, generateImage,
    listModels, diag: () => Object.assign({}, diag), currentModel: () => cfg.model || resolved.get(keyId(cfg.key)) || '',
    mode: () => (kwOn() ? 'kw' : 'full'), kwStats: id => (kwStats.has(id) ? kwStat(id) : null),
    _internal: {batchOrder, parseResponse, repairItem, finishBatch, localOne, localRange, buildRequest, buildKwRequest, reqTokens, placeItems, rankModels, imageModels, errorFor, plan, leadRange, isDailyQuota, pacificDay, WINDOW, BATCH, FIRST, MAX_CHARS, MIN_CHARS},
    dailyBlocked: dayBlocked, DAILY_MSG};
  root.SA_Gemini = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
