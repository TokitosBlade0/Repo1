/* Satır Arası — arayüz katmanı.
   Bölümler: 0 yardımcılar ve yedek modüller · 1 depolama ve profiller · 2 giriş ekranı · 3 kitap verisi ve çözümleme
             4 menü (3B kitaplık) · 5 uçuş geçişleri · 6 okuma ekranı · 7 müzik bağlantısı · 8 açılış
   Anahtarlar hiçbir zaman konsola yazılmaz. */
(function () {
'use strict';

/* ================= 0. Yardımcılar ================= */
const $ = id => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const tick = () => new Promise(r => setTimeout(r, 0));
/* Animasyon bitişi; görünmeyen panelde/sekmede WAAPI durursa süre dolunca bitir (açılış takılmasın) */
const fin = a => { const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {}; return Promise.race([a.finished, new Promise(r => setTimeout(() => { try { a.finish(); } catch (e) { /* yok */ } r(); }, (+t.duration || 600) + (+t.delay || 0) + 400))]); };
const frame = () => new Promise(r => { let d = 0; const go = () => { if (!d) { d = 1; r(); } }; requestAnimationFrame(go); setTimeout(go, 60); });   // görünmeyen sekmede rAF durur (birlikte oku)
const Core = window.Core;
const M = Core.MOODS, INFO = Core.INFO;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const darkPref = matchMedia('(prefers-color-scheme: dark)');
const compactMq = matchMedia('(max-width: 720px)');
const MOOD_COL = {huzur: '#86a98c', huzun: '#7393b8', gerilim: '#cf7a3e', karanlik: '#a2524b', nese: '#d8b250', ask: '#c9707f', macera: '#5ea39c', gizem: '#8f8bb6'};
const MOOD_EN = {huzur: 'calm peaceful', huzun: 'melancholic sad', gerilim: 'tense suspense', karanlik: 'dark gothic', nese: 'cheerful light', ask: 'romantic tender', macera: 'epic adventure', gizem: 'mysterious'};
const BRASS = '#c49a5c';
const pct = x => '%' + Math.round(clamp(x, 0, 1) * 100);
const moodName = m => (INFO[m] ? INFO[m].ad : '');
const scrub = s => String(s || '').replace(/AIza[0-9A-Za-z_\-]{8,}/g, '••••').replace(/key=[^&\s]+/gi, 'key=••••').slice(0, 180);
const mask = k => !k ? '' : k.length <= 8 ? '••••' : k.slice(0, 4) + '••••••' + k.slice(-4);
function ago(t) { if (!t) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'bugün' : d === 1 ? 'dün' : d < 30 ? d + ' gün önce' : new Date(t).toLocaleDateString('tr-TR'); }
function hashNum(s) { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }
function hexRgb(hex) { const n = parseInt(String(hex).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

/* Yedek modüller: diğer dosyalar yoksa yalnızca deneme için. */
const MOCK = {};
if (!window.SA_Books) {
  MOCK.books = true;
  const R = [
    ['suc-ve-ceza', 2554, 'Suç ve Ceza', 'Fyodor Dostoyevski', 'en', 'gerilim', 'Petersburg’un boğucu yazında bir öğrenci, kendi kuramını bir baltayla sınar. Vicdanın en uzun kovalamacası.'],
    ['dracula', 345, 'Drakula', 'Bram Stoker', 'en', 'karanlik', 'Mektuplar, günlükler, gazete kupürleri: Transilvanya’dan Londra’ya yayılan bir gölge.'],
    ['sherlock', 1661, 'Sherlock Holmes’un Maceraları', 'Arthur Conan Doyle', 'en', 'gizem', 'Baker Sokağı 221B’de bir keman, bir pipo ve en olmadık ayrıntıdan çözülen on iki dava.'],
    ['pride', 1342, 'Aşk ve Gurur', 'Jane Austen', 'en', 'ask', 'Bir taşra balosunda başlayan yanlış anlaşılma; zekâ, gurur ve yavaş yavaş dönen bir kalp.'],
    ['alice', 11, 'Alice Harikalar Diyarında', 'Lewis Carroll', 'en', 'nese', 'Bir tavşan deliği, bir şişe “beni iç” ve mantığın tepetaklak olduğu bir öğleden sonra.'],
    ['moby', 2701, 'Moby Dick', 'Herman Melville', 'en', 'macera', 'Kaptan Ahab’ın beyaz balinaya duyduğu saplantı, okyanus kadar geniş bir yolculuk.'],
    ['donusum', 5200, 'Dönüşüm', 'Franz Kafka', 'en', 'huzun', 'Gregor Samsa bir sabah dev bir böceğe dönüşmüş olarak uyanır; ailesi ise hiç değişmez.'],
    ['walden', 205, 'Walden', 'Henry David Thoreau', 'en', 'huzur', 'Bir gölün kıyısında iki yıl: sade yaşamak, yavaş düşünmek, mevsimleri izlemek.']
  ];
  window.SA_Books = {
    RECOMMENDED: R.map(([id, gid, title, author, lang, mood, blurb]) => ({id, gid, title, author, lang, mood, blurb, cover: 'assets/covers/' + gid + '.jpg'})),
    fetchText: book => new Promise(res => setTimeout(() => {
      let body = '';
      for (let k = 0; k < 4; k++) for (const b of Core.SAMPLE.blocks) body += (b.h ? (k + 1) + '.' + b.t : b.t) + '\n\n';
      res('The Project Gutenberg eBook of ' + book.title + '\nTitle: ' + book.title + '\nAuthor: ' + book.author + '\nLanguage: Turkish\n\n*** START OF THE PROJECT GUTENBERG EBOOK ***\n' + body + '*** END OF THE PROJECT GUTENBERG EBOOK ***');
    }, 700))
  };
}
if (!window.SA_Gemini) {
  MOCK.gemini = true;
  let cfg = {};
  window.SA_Gemini = {
    DEFAULT_MODEL: 'gemini-2.5-flash',
    configure(c) { cfg = Object.assign({}, c); },
    test() { return new Promise(r => setTimeout(() => r(cfg.key && cfg.key.length >= 20 ? {ok: true, model: cfg.model || this.DEFAULT_MODEL} : {ok: false, error: 'Anahtar geçersiz görünüyor (deneme kipi).'}), 600)); },
    getCached() { return null; },
    analyze(book, opt) {
      opt = opt || {};
      return new Promise((res, rej) => {
        const P = book.paragraphs, out = new Array(P.length).fill(null); let i = opt.from || 0;
        const step = () => {
          if (opt.signal && opt.signal.aborted) return rej(new Error('iptal'));
          for (let k = 0; k < 6 && i < P.length; k++, i++) { const a = Core.analyze(P[i], book.lang), m = M[Core.topMood(a.v)]; out[i] = {mood: m, energy: 0.5, query: MOOD_EN[m], scene: m, source: 'local'}; }
          if (opt.onProgress) opt.onProgress(out, i, P.length);
          if (i >= P.length) res(out); else setTimeout(step, 160);
        };
        setTimeout(step, 300);
      });
    }
  };
}
if (!window.SA_Music) {
  MOCK.music = true;
  window.SA_Music = {available: false, init: () => Promise.resolve(), configure() {}, pick: () => Promise.reject(new Error('müzik modülü yok')), play() {}, pause() {}, resume() {}, setVolume() {}, current: () => null, onChange() {}};
}
const G = window.SA_Gemini, B = window.SA_Books, MU_API = window.SA_Music;
let recCache = null;
function recList() {
  if (!recCache) recCache = (Array.isArray(B.TURKISH) ? B.TURKISH : []).concat(Array.isArray(B.RECOMMENDED) ? B.RECOMMENDED : []).filter(r => r && r.title)
    .map(r => {
      const o = Object.assign({}, r, {id: String(r.id || r.gid), mood: M.includes(r.mood) ? r.mood : 'huzur'});
      // Boyalı kapağı olmayan (Vikikaynak) eserler: covers.js tipografik tasarımı, başlığa göre sabit
      if (!o.cover && window.SA_Covers) try { o.coverSpec = SA_Covers.localSpec({title: o.title, author: o.author, mood: o.mood}); } catch (e) { /* düz kapak */ }
      return o;
    });
  return recCache;
}
// Önerilenler rafı iki bölüm: Türk klasikleri (tr) / Dünya klasikleri (diğerleri)
const recSection = () => { const v = LS.get('recSec', 'tr'); return v === 'en' ? 'en' : 'tr'; };
function recShown() { const s = recSection(), L = recList(), tr = L.filter(r => r.lang === 'tr'); return s === 'tr' && tr.length ? tr : L.filter(r => r.lang !== 'tr'); }

/* ================= 1. Depolama ve profiller ================= */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('sa:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sa:' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('sa:' + k); } catch (e) { /* yok */ } },
  keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('sa:' + prefix)) out.push(k.slice(3)); } } catch (e) { /* yok */ } return out; }
};
/* Kitap metinleri büyük: IndexedDB'de, profiller arasında ortak (içerik özetiyle anahtarlı). */
const DB = (() => {
  let p = null; const mem = new Map();
  const open = () => p || (p = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB yok'));
    const r = indexedDB.open('satir-arasi', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('texts', {keyPath: 'id'});
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('texts', mode), q = fn(t.objectStore('texts'));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  const remember = rec => { if (mem.size > 3) mem.delete(mem.keys().next().value); mem.set(rec.id, rec); };
  return {
    get: id => mem.has(id) ? Promise.resolve(mem.get(id)) : tx('readonly', s => s.get(id)).then(r => { if (r) remember(r); return r || null; }).catch(() => null),
    put: rec => { remember(rec); return tx('readwrite', s => s.put(rec)).catch(() => null); },
    del: id => { mem.delete(id); return tx('readwrite', s => s.delete(id)).catch(() => null); }
  };
})();

const DEF_SET = {theme: 'auto', size: 19, lh: 1.65, warm: 0.35, focus: false, vol: 0.6, autoplay: true};
let profiles = LS.get('profiles', []);
let P = null, lib = [], set = Object.assign({}, DEF_SET);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const saveProfiles = () => LS.set('profiles', profiles);
let libT = null;
const saveLib = () => { clearTimeout(libT); libT = null; if (P) LS.set('lib:' + P.id, lib); };
const saveLibSoon = () => { if (!libT) libT = setTimeout(saveLib, 800); };
const saveSet = () => { if (P) LS.set('set:' + P.id, set); };
const needGemini = () => !!(P && P.gemKey);

function configureModules(p) {
  // Model boşsa gemini.js ListModels ile anahtarın erişebildiği en iyi Flash modelini seçer.
  try { G.configure({key: (p && p.gemKey) || '', model: (p && p.gemModel) || ''}); } catch (e) { /* yok */ }
  try { MU_API.configure({youtubeKey: (p && p.ytKey) || ''}); } catch (e) { /* yok */ }
}
function activate(p) {
  abortJobs();
  P = p; LS.set('current', p.id);
  configureModules(p);
  lib = LS.get('lib:' + p.id, []);
  set = Object.assign({}, DEF_SET, LS.get('set:' + p.id, {}));
}
function signOut() { saveLib(); abortJobs(); P = null; lib = []; LS.del('current'); configureModules(null); openWelcome(); }
function gcTexts(ids) {
  const used = new Set();
  for (const q of profiles) for (const e of LS.get('lib:' + q.id, [])) used.add(e.id);
  for (const id of ids) if (!used.has(id)) DB.del(id);
}
async function deleteProfile(p) {
  const ok = await ask('“' + p.name + '” profilini silmek istiyor musun? Anahtarları, kitaplığı ve kaldığı yerler bu tarayıcıdan kalıcı olarak silinir. Bu geri alınamaz.', 'Profili sil');
  if (!ok) return;
  const ids = LS.get('lib:' + p.id, []).map(e => e.id);
  if (P && P.id === p.id) { abortJobs(); P = null; lib = []; LS.del('current'); configureModules(null); }
  for (const k of [...LS.keys('lib:' + p.id), ...LS.keys('set:' + p.id), ...LS.keys('heard:' + p.id + ':')]) LS.del(k);
  profiles = profiles.filter(x => x.id !== p.id); saveProfiles();
  gcTexts(ids);
  openWelcome();
}

/* Onay penceresi */
function ask(msg, okLabel) {
  const d = $('dlgAsk'); $('askMsg').textContent = msg; $('askOk').textContent = okLabel || 'Sil';
  d.returnValue = '';
  return new Promise(res => { d.addEventListener('close', () => res(d.returnValue === 'yes'), {once: true}); d.showModal(); });
}
let toastT = null;
function toast(msg, ms) {
  if (document.body.dataset.screen === 'reader') { note(msg); return; }
  const t = $('toast'); t.textContent = msg || ''; clearTimeout(toastT);
  if (msg) toastT = setTimeout(() => { t.textContent = ''; }, ms || 6000);
}

function show(name) {
  for (const s of ['welcome', 'menu', 'reader']) $('scr-' + s).hidden = s !== name;
  document.body.dataset.screen = name;
  if (name === 'reader') stopLoop(); else startLoop();
}

/* ================= 2. Giriş / profil ekranı ================= */
let editing = null;
function openWelcome(mode) {
  editing = mode === 'edit' ? P : null;
  const f = $('wForm'); f.reset();
  $('wTestMsg').textContent = ''; $('wTestMsg').className = 'testmsg';
  $('wKey').type = 'password'; $('wKeyShow').setAttribute('aria-pressed', 'false');
  $('wFormTitle').textContent = editing ? 'Anahtarları düzenle' : profiles.length ? 'Yeni profil' : 'Hoş geldin';
  $('wFormLede').textContent = editing ? 'Yeni bir anahtar yapıştırırsan eskisinin yerine geçer. Boş bırakırsan kayıtlı anahtar kalır.' : 'Bir profil oluştur. Her profilin kendi anahtarları, kitaplığı ve kaldığı yerler olur.';
  $('wName').value = editing ? editing.name : '';
  $('wKey').placeholder = editing && editing.gemKey ? 'Kayıtlı: ' + mask(editing.gemKey) : 'AIza…';
  $('wYt').placeholder = editing && editing.ytKey ? 'Kayıtlı: ' + mask(editing.ytKey) : 'AIza…';
  $('wModel').value = (editing && editing.gemModel) || '';
  $('wModel').placeholder = 'otomatik (en yeni Flash)';
  $('wSave').textContent = editing ? 'Kaydet' : 'Kaydet ve kitaplığa gir';
  $('wSkip').hidden = !!editing; $('wSkipHelp').hidden = !!editing;
  $('wCancel').hidden = !editing;
  $('wKeyClear').hidden = !(editing && editing.gemKey);
  renderProfileList();
  applyGlow(BRASS, true);
  show('welcome');
  setTimeout(() => { if (!profiles.length || editing) $('wName').focus(); }, 30);
}
function renderProfileList() {
  const box = $('wProfiles'), ul = $('wProfileList'); ul.textContent = '';
  const list = editing ? [] : profiles;
  box.hidden = !list.length;
  for (const p of list) {
    const li = h('li'), b = h('button', 'w-pbtn'); b.type = 'button';
    const n = LS.get('lib:' + p.id, []).length;
    b.append(h('span', 'mono', (p.name || '?').trim().charAt(0).toLocaleUpperCase('tr')));
    const t = h('span'); t.append(h('strong', null, p.name)); t.append(h('small', null, (p.gemKey ? 'Gemini bağlı' : 'Anahtarsız') + ' · ' + n + ' kitap'));
    b.append(t);
    b.addEventListener('click', () => { activate(p); enterMenu(); });
    const del = h('button', 'btn icon ghost'); del.type = 'button'; del.setAttribute('aria-label', p.name + ' profilini sil');
    del.innerHTML = '<svg class="ic"><use href="#i-trash"/></svg>';
    del.addEventListener('click', () => deleteProfile(p));
    li.append(b, del); ul.append(li);
  }
}
function testMsg(text, kind) { const m = $('wTestMsg'); m.textContent = text; m.className = 'testmsg' + (kind ? ' ' + kind : ''); }
async function testKey() {
  const key = $('wKey').value.trim() || (editing && editing.gemKey) || '';
  if (!key) { testMsg('Önce anahtarı yapıştır.', 'bad'); $('wKey').focus(); return; }
  const btn = $('wTest'); btn.disabled = true; testMsg('Sınanıyor…');
  const model = $('wModel').value.trim();
  try {
    G.configure({key, model});
    const r = await G.test();
    if (r && r.ok) testMsg('Model: ' + (r.model || model) + (r.auto ? ' (anahtarına göre otomatik seçildi)' : '') + (MOCK.gemini ? ' (deneme kipi)' : '') + '.', 'ok');
    else testMsg(scrub(r && r.error) || 'Anahtar kabul edilmedi.', 'bad');
  } catch (err) { testMsg(scrub(err && err.message) || 'Google’a ulaşılamadı.', 'bad'); }
  finally { btn.disabled = false; configureModules(P); }
}
function saveWelcome(skip) {
  const name = $('wName').value.trim() || (editing && editing.name) || 'Okur';
  let p = editing;
  if (!p) { p = {id: newId(), name, created: Date.now()}; profiles.push(p); }
  p.name = name;
  p.gemKey = skip ? '' : ($('wKey').value.trim() || p.gemKey || '');
  p.ytKey = skip ? '' : ($('wYt').value.trim() || p.ytKey || '');
  p.gemModel = $('wModel').value.trim() || p.gemModel || '';
  saveProfiles(); activate(p); enterMenu();
}
function wireWelcome() {
  $('wForm').addEventListener('submit', e => { e.preventDefault(); saveWelcome(false); });
  $('wSkip').addEventListener('click', () => saveWelcome(true));
  $('wCancel').addEventListener('click', () => enterMenu());
  $('wTest').addEventListener('click', testKey);
  $('wKeyShow').addEventListener('click', () => {
    const k = $('wKey'), on = k.type === 'password'; k.type = on ? 'text' : 'password';
    $('wKeyShow').setAttribute('aria-pressed', String(on)); $('wKeyShow').setAttribute('aria-label', on ? 'Anahtarı gizle' : 'Anahtarı göster');
  });
  const clr = h('button', 'btn ghost', 'Kayıtlı anahtarı kaldır'); clr.type = 'button'; clr.id = 'wKeyClear'; clr.hidden = true;
  clr.addEventListener('click', () => { if (!editing) return; editing.gemKey = ''; saveProfiles(); $('wKey').placeholder = 'AIza…'; clr.hidden = true; testMsg('Anahtar kaldırıldı; çözümleme yerel yapılacak.'); });
  $('wTest').after(clr);
}

/* ================= 3. Kitap verisi ve çözümleme ================= */
async function readTxt(file) {
  const buf = await file.arrayBuffer(); let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(buf); } catch (e) { text = new TextDecoder('windows-1254').decode(buf); }
  text = Core.repairMojibake(text);
  const g = Core.parseGutenberg(text), fn = Core.fromFilename(file.name);
  return {title: g.title || fn.title, author: g.author || fn.author, lang: g.lang, blocks: Core.parseText(g.body)};
}
async function readEpub(file) {
  if (!window.JSZip) throw new Error('EPUB okuyucu yüklenemedi. Kitabı .txt olarak ekle ya da metnini yapıştır.');
  const zip = await JSZip.loadAsync(file), xml = (s, type) => new DOMParser().parseFromString(s, type);
  const cont = zip.file('META-INF/container.xml');
  if (!cont) throw new Error('Bu dosya geçerli bir EPUB değil.');
  const opfPath = xml(await cont.async('text'), 'application/xml').getElementsByTagName('rootfile')[0].getAttribute('full-path');
  const opf = xml(await zip.file(opfPath).async('text'), 'application/xml');
  const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const meta = tag => { const el = opf.getElementsByTagNameNS('*', tag)[0]; return el ? el.textContent.trim() : ''; };
  const man = {}; for (const it of opf.getElementsByTagNameNS('*', 'item')) man[it.getAttribute('id')] = it.getAttribute('href');
  const blocks = [];
  for (const ref of opf.getElementsByTagNameNS('*', 'itemref')) {
    const href = man[ref.getAttribute('idref')]; if (!href) continue;
    const f = zip.file(dir + decodeURIComponent(href.split('#')[0])); if (!f) continue;
    const doc = xml(await f.async('text'), 'text/html');
    const els = doc.body ? doc.body.querySelectorAll('h1,h2,h3,p') : [];
    if (els.length) els.forEach(el => { const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t) blocks.push(el.tagName === 'P' ? {t} : {h: 1, t}); });
    else if (doc.body) blocks.push(...Core.parseText(doc.body.textContent));
  }
  const l = meta('language').toLowerCase();
  return {title: meta('title') || Core.fromFilename(file.name).title, author: meta('creator'), lang: l.startsWith('tr') ? 'tr' : l.startsWith('en') ? 'en' : '', blocks};
}

/* Yerel çözümleme: büyük kitaplarda arayüzü dondurmamak için parça parça. */
const memLocal = new Map();
async function localAnalysis(blocks, lang) {
  const items = [], lens = [], texts = []; let brk = true, k = 0;
  for (const b of blocks) {
    if (b.h) { brk = true; continue; }
    const a = Core.analyze(b.t, lang);
    items.push({v: a.v, n: a.n, amb: a.amb, brk}); lens.push(b.t.length); texts.push(b.t); brk = false;
    if (++k % 250 === 0) await tick();
  }
  const dec = Core.decode(items);
  return {dec, lens, texts};
}
function rememberLocal(id, la) { if (memLocal.size > 4) memLocal.delete(memLocal.keys().next().value); memLocal.set(id, la); }

async function addBook(b) {
  const texts = b.blocks.filter(x => !x.h).map(x => x.t);
  if (!texts.length) throw new Error('Bu metinde okunacak paragraf bulunamadı.');
  const all = texts.join('\n');
  // Dil metnin kendisinden (baş/orta/son örnekleri); dosya üst verisi (EPUB dc:language, Gutenberg Language:) yalnızca kanıt belirsizse
  const lang = Core.detectLang(texts, {hint: b.lang});
  const id = b.id || Core.hashText(all);
  const ex = lib.find(e => e.id === id);
  if (ex) return {entry: ex, dup: true};
  let title = b.title, author = b.author || '';
  if (!b.rec) { const idn = Core.identifyBook({title, author}, all); title = idn.title; author = idn.author; }
  await DB.put({id, title, author, lang, blocks: b.blocks});
  const la = await localAnalysis(b.blocks, lang); rememberLocal(id, la);
  const entry = {id, title, author, lang, langV: Core.LANG_V, langMeta: b.lang || '', n: texts.length, chars: all.length, mood: M[la.dec.dominant] || 'huzur',
    bar: Core.barcode(la.dec.mood, la.lens, 48), added: Date.now(), last: 0, para: 0,
    gid: b.gid || null, cover: b.cover || null, rec: !!b.rec,
    ana: needGemini() ? {state: 'run', done: 0, total: texts.length} : {state: 'local'}};
  lib.unshift(entry); saveLib();
  if (document.body.dataset.screen === 'menu') renderMine();
  runAnalysis(entry, texts);
  if (!entry.rec) runCover(entry, texts);
  return {entry};
}
async function importFiles(files) {
  let last = null;
  for (const file of files) {
    if (!/\.(txt|epub)$/i.test(file.name) && !/^text\//.test(file.type)) { toast('“' + file.name + '” eklenemedi: yalnızca .txt ve .epub dosyaları.'); continue; }
    toast('“' + file.name + '” okunuyor…', 0);
    try {
      const b = /\.epub$/i.test(file.name) ? await readEpub(file) : await readTxt(file);
      const r = await addBook(b); last = r.entry;
      toast(r.dup ? 'Bu kitap zaten kitaplığında.' : '“' + r.entry.title + '” kitaplığına eklendi. Hemen okuyabilirsin; çözümleme arka planda sürüyor.');
    } catch (err) { toast('Eklenemedi: ' + ((err && err.message) || 'dosya okunamadı') + ' Başka bir .txt ya da .epub dene.', 9000); }
  }
  if (last && document.body.dataset.screen === 'menu') focusEntry(last.id);
}
async function adopt(rec, bookEl) {
  const id = 'gut-' + (rec.gid || rec.id);
  const have = lib.find(x => x.id === id); if (have) return have;
  if (bookEl) bookEl.classList.add('loading');
  try {
    const raw = await B.fetchText(rec);
    const g = Core.parseGutenberg(raw);
    const r = await addBook({id, title: rec.title || g.title, author: rec.author || g.author, lang: rec.lang || g.lang, blocks: Core.parseText(g.body), gid: rec.gid, cover: rec.cover, rec: true});
    if (!r.entry.cover && rec.coverSpec && !r.entry.coverSpec) { r.entry.coverSpec = rec.coverSpec; saveLib(); }
    return r.entry;
  } finally { if (bookEl) bookEl.classList.remove('loading'); }
}
async function removeEntry(entry) {
  if (!await ask('“' + entry.title + '” kitaplığından çıkarılsın mı? Kaldığın yer ve dinlediğin müzik listesi de silinir.', 'Kitaplıktan çıkar')) return;
  const j = jobs.get(entry.id); if (j) j.ctrl.abort();
  lib = lib.filter(e => e.id !== entry.id); saveLib();
  LS.del('heard:' + P.id + ':' + entry.id);
  gcTexts([entry.id]);
  renderMine(); plaque(null);
}

/* Gemini çözümlemesi: arka planda, kitap okunabilir durumdayken. */
const jobs = new Map();
function abortJobs() { for (const j of jobs.values()) j.ctrl.abort(); jobs.clear(); }
function mergeRes(job, results) {
  if (!results) return;
  let touchedActive = false;
  for (let i = 0; i < results.length; i++) if (results[i] && !job.results[i]) { job.results[i] = results[i]; if (R && R.active === i) touchedActive = true; }
  if (R && R.entry.id === job.id) { R.gem = job.results; scheduleRibbon(); if (touchedActive) scheduleScene(R.active); }
}
/* Durumlar: run (ilerliyor) · wait (kota/sunucu/ağ; retryAt'te yeniden denenecek) · err (durdu; yerel sürüyor) · done.
   Her hata halkada ve okuma göstergesinde açık Türkçe bir durum olarak görünür; “Yeniden dene” ile tekrar başlar. */
async function runAnalysis(entry, texts) {
  if (!needGemini() || jobs.has(entry.id)) return;
  let cached = null; try { cached = await Promise.resolve(G.getCached(entry.id)); } catch (e) { /* yok */ }
  const total = texts.length, res = Array.isArray(cached) ? cached.slice(0, total) : [];
  let have = 0; for (let i = 0; i < total; i++) if (res[i]) have++;
  if (have >= total) { setAna(entry, {state: 'done', done: total, total}); return; }
  // İlk istek okurun bulunduğu yerin çevresinden: açık kitapta etkin paragraf, değilse kaldığı yer
  const from = R && R.entry.id === entry.id && R.active >= 0 ? R.active : clamp(entry.para || 0, 0, total - 1);
  const ctrl = new AbortController(), pid = P.id;
  const job = {id: entry.id, ctrl, results: res, done: have, total, diag: null}; jobs.set(entry.id, job);
  const live = () => P && P.id === pid && !ctrl.signal.aborted;
  setAna(entry, {state: 'run', done: have, total});
  try {
    const out = await G.analyze({id: entry.id, lang: entry.lang, title: entry.title, paragraphs: texts}, {
      from, signal: ctrl.signal,
      onProgress: (results, done, tot) => { mergeRes(job, results); job.done = done; if (live() && entry.ana.state !== 'wait') setAna(entry, {state: 'run', done, total: tot || total}); },
      onStatus: d => {
        job.diag = d; if (!live()) return;
        if (d.state === 'wait') setAna(entry, {state: 'wait', done: job.done, total, kind: d.kind, err: d.lastError, retryAt: d.retryAt});
        else if (d.state === 'run' && entry.ana.state === 'wait') setAna(entry, {state: 'run', done: job.done, total});
        else if (R && R.entry.id === entry.id) updateSrc();
      }
    });
    mergeRes(job, out);
    if (P && P.id === pid) {
      if (out && out.error) setAna(entry, {state: 'err', done: job.done, total, kind: out.errorKind, err: scrub(out.error), detail: scrub(out.errorDetail)});
      else setAna(entry, {state: 'done', done: total, total});
    }
  } catch (err) {
    if (!ctrl.signal.aborted && P && P.id === pid) setAna(entry, {state: 'err', done: job.done, total, kind: err && err.kind || 'net', err: scrub(err && (err.short || err.message)), detail: scrub(err && err.message)});
  } finally { if (jobs.get(entry.id) === job) { jobs.delete(entry.id); lastDiag.set(entry.id, job.diag); } }
}
const lastDiag = new Map();
// Cümle kipi özeti (sakin, tek satır): “Gemini’ye 38 cümle gitti · ~%84 token tasarrufu”
function kwLine(entry) {
  let s = null; try { s = G.kwStats ? G.kwStats(entry.id) : null; } catch (e) { /* yok */ }
  if (!s || !s.fullTokens) return '';
  return 'Gemini’ye ' + s.sentences + ' cümle gitti · ~%' + s.saving + ' token tasarrufu';
}
async function retryAnalysis(entry) {
  const j = jobs.get(entry.id); if (j) { j.ctrl.abort(); jobs.delete(entry.id); }
  const texts = R && R.entry.id === entry.id ? R.texts : ((await DB.get(entry.id)) || {blocks: []}).blocks.filter(x => !x.h).map(x => x.t);
  if (texts.length) runAnalysis(entry, texts);
}
// Anahtar kaldırıldıysa eski Gemini durumları (hata/bekleme) gösterilmez: her şey yerel
const anaOf = e => needGemini() ? (e.ana || {}) : {state: 'local'};
// Kısa durum etiketi: halkada, levhada ve okuma göstergesinde aynı metin
function anaLabel(a) {
  if (!a) return '';
  if (a.state === 'wait') {
    const s = Math.ceil(((a.retryAt || 0) - Date.now()) / 1000);
    const base = a.kind === 'quota' ? 'Gemini: kota doldu' : a.kind === 'server' ? 'Gemini yanıt vermiyor' : a.kind === 'net' ? 'Gemini’ye ulaşılamadı' : (a.err || 'Gemini bekliyor');
    return base + (s > 0 ? ', ' + s + ' sn sonra yeniden denenecek' : ', yeniden deneniyor…');
  }
  if (a.state === 'err') return a.err || 'Gemini’ye ulaşılamadı';
  return '';
}
function anaDiag(entry) {
  const j = jobs.get(entry.id), d = (j && j.diag) || lastDiag.get(entry.id) || {}, a = entry.ana || {};
  let model = d.model || ''; try { model = model || G.currentModel(); } catch (e) { /* yok */ }
  return 'Tanılama: model ' + (model || 'henüz seçilmedi') + ' · parti ' + (d.batchesDone || 0) + '/' + (d.batchesTotal || 0) +
    ' · son hata: ' + (scrub(a.detail || d.lastError || a.err) || 'yok');
}
let waitT = null;
function setAna(entry, a) {
  entry.ana = a; saveLibSoon();
  updateAnaUI(entry);
  if (R && R.entry.id === entry.id) updateSrc();
  // Bekleme sırasında geri sayımı canlı tut
  if (!waitT && lib.some(e => e.ana && e.ana.state === 'wait')) waitT = setInterval(() => {
    const W = lib.filter(e => e.ana && e.ana.state === 'wait');
    if (!W.length) { clearInterval(waitT); waitT = null; return; }
    for (const e of W) {
      updateAnaUI(e, null, true);
      if (plaqueEntry === e) $('plBlurb').textContent = anaLabel(e.ana) + '. Bu arada müzik yerel çözümlemeyle seçiliyor.';
      if (R && R.entry.id === e.id) updateSrc();
    }
  }, 1000);
}
async function resumeJobs() {
  if (!needGemini()) return;
  const pid = P.id;
  for (const e of lib.slice()) {
    if (!P || P.id !== pid) return;
    if (!e.ana || (e.ana.state !== 'run' && e.ana.state !== 'wait') || jobs.has(e.id)) continue;
    const d = await DB.get(e.id); if (!d) continue;
    recheckLang(e, d);
    runAnalysis(e, d.blocks.filter(x => !x.h).map(x => x.t));
  }
}

/* Kapaklar: kendi eklenen kitaplar için arka planda (okumayı hiç bekletmez). Önerilenler kendi kapaklarını korur. */
const coverJobs = new Set();
async function runCover(entry, texts) {
  const C = window.SA_Covers;
  if (!C || entry.rec || entry.coverSrc || coverJobs.has(entry.id)) return;
  coverJobs.add(entry.id);
  const pid = P.id, excerpt = (texts || []).slice(0, 6).join('\n\n').slice(0, 3000), book = {title: entry.title, author: entry.author, mood: entry.mood, excerpt, coverScene: entry.coverScene || '', summary: entry.coverScene || ''};
  entry.coverState = 'busy'; refreshCover(entry);
  let cands;
  try {
    cands = await C.find(book, {G, hasKey: needGemini() && !MOCK.gemini, onState: t => { entry.coverMsg = t; refreshCover(entry); }});
  } catch (e) { cands = [{spec: C.localSpec(book), source: 'design'}]; }
  coverJobs.delete(entry.id); delete entry.coverState; delete entry.coverMsg;
  if (entry.coverScene && Array.isArray(cands)) for (const c of cands) if (c && c.spec && !c.spec.summary) c.spec.summary = entry.coverScene;   // Claude'un kapak sahnesi
  if (!P || P.id !== pid || !lib.includes(entry)) return;
  entry.coverCands = cands; applyCover(entry, 0);
}
function applyCover(entry, i) {
  const c = entry.coverCands && entry.coverCands[i]; if (!c) return;
  entry.coverIdx = i; entry.coverSrc = c.source;
  if (c.spec) { entry.coverSpec = c.spec; entry.cover = null; } else { entry.cover = c.src; entry.coverSpec = null; }
  saveLib(); refreshCover(entry);
  if (plaqueEntry === entry) plaque(entry, 'mine', true);
}
function nextCover(entry) {
  const C = window.SA_Covers; if (!C) return;
  const L = entry.coverCands = entry.coverCands || [];
  let i = (entry.coverIdx || 0) + 1;
  if (i >= L.length) {
    if (L.filter(c => c.spec).length >= 6) i = 0;     // yeterince çeşitleme var: başa dön
    else { entry.coverSeed = (entry.coverSeed || 0) + 1; L.push({spec: C.localSpec({title: entry.title, mood: entry.mood}, entry.coverSeed), source: 'design'}); }
  }
  applyCover(entry, i);
  toast('Kapak: ' + (C.LABEL[entry.coverSrc] || 'tasarım') + (L.length > 1 ? ' (' + (entry.coverIdx + 1) + '/' + L.length + ')' : ''), 2500);
}
function uploadCover(entry) {
  const C = window.SA_Covers, inp = h('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = async () => {
      const src = (C && await C.toJpeg(fr.result)) || null;
      if (!src) { toast('Bu görsel okunamadı; başka bir resim dene.'); return; }
      (entry.coverCands = entry.coverCands || []).push({src, source: 'upload'});
      applyCover(entry, entry.coverCands.length - 1); toast('Kapak güncellendi.', 2500);
    };
    fr.readAsDataURL(f);
  });
  inp.click();
}
function refreshCover(entry) {
  const b = findBookEl(entry.id, 'mine'); if (!b) return;
  const old = b.querySelector('.front .cover'); if (old) old.replaceWith(coverEl(entry));
}
async function resumeCovers() {
  const pid = P.id;
  for (const e of lib.slice()) {
    if (!P || P.id !== pid) return;
    if (e.rec || e.coverSrc || coverJobs.has(e.id)) continue;
    const d = await DB.get(e.id); if (d) runCover(e, d.blocks.filter(x => !x.h).map(x => x.t));
  }
}

/* ================= 4. Menü: 3B kitaplık ================= */
const COVER_PAL = [[8, 44, 24], [22, 40, 22], [36, 42, 25], [72, 22, 21], [140, 18, 19], [176, 28, 19], [200, 30, 21], [214, 34, 18], [352, 32, 22], [28, 20, 14], [4, 30, 16]];
function coverColors(title) {
  const [hh, s, l] = COVER_PAL[hashNum(title) % COVER_PAL.length];
  return {cv: 'hsl(' + hh + ' ' + s + '% ' + l + '%)', sp: 'hsl(' + hh + ' ' + s + '% ' + Math.max(8, l - 6) + '%)'};
}
function barGradient(bar) {
  const n = bar.length, stops = [];
  for (let i = 0; i < n; i++) { const c = MOOD_COL[M[+bar[i]]] || BRASS; stops.push(c + ' ' + (i / n * 100).toFixed(2) + '% ' + ((i + 1) / n * 100).toFixed(2) + '%'); }
  return 'linear-gradient(180deg,' + stops.join(',') + ')';
}
let BH = 200;
function computeBH() {
  BH = compactMq.matches ? clamp(innerHeight * 0.34, 170, 230) : clamp((innerHeight - 340) / 2.3, 140, 250);
  $('world').style.setProperty('--bh', BH + 'px');
}
function dimsFor(kind, entry) {
  if (kind === 'mine') {
    const H = BH * (0.86 + 0.12 * ((hashNum(entry.id) % 100) / 100)), W = H * 0.67, D = Math.round(20 + Math.min(34, Math.sqrt(entry.n || 50) * 0.8));
    return {H, W, D, sw: D + 3, fw: D};
  }
  const H = BH * (kind === 'add' ? 0.95 : 0.93), W = H * 0.67, D = kind === 'add' ? 28 : 30;
  return {H, W, D, sw: W * (kind === 'add' ? 0.9 : 0.8), fw: W * 0.9};
}
function coverEl(entry) {
  const c = h('div', 'cover'), t = h('div', 'cv-type');
  const tl = (entry.title || '').length;
  t.append(h('span', 'cv-orn'), h('span', 'cv-title' + (tl > 40 ? ' xlong' : tl > 20 ? ' long' : ''), entry.title || 'Adsız'), h('span', 'cv-rule'));
  if (entry.author) t.append(h('span', 'cv-author', entry.author));
  c.append(t);
  // tr-* (Vikikaynak) eserlerinin boyalı kapakları var; kullanıcı kapak seçmediyse eski tipografik tasarımın yerine geçer
  const trPaint = !entry.cover && !entry.coverSrc && /^tr-[\w-]+$/.test(String(entry.gid || '')) && hasAnalysis(entry.gid);
  const src = entry.cover || ((/^\d+$/.test(String(entry.gid || '')) && hasAnalysis(entry.gid)) || trPaint ? 'assets/covers/' + entry.gid + '.jpg' : null);
  if (entry.coverSpec && !trPaint && window.SA_Covers) {
    const d = h('div', 'cv-svg'); d.setAttribute('aria-hidden', 'true');
    try { d.innerHTML = SA_Covers.renderSVG(entry.coverSpec, entry); c.append(d); c.classList.add('has-svg'); } catch (e) { /* tipografik kalsın */ }
  } else if (src) {
    const img = new Image(); img.alt = ''; img.className = 'cv-img'; img.decoding = 'async';
    img.onload = () => c.classList.add('has-img'); img.onerror = () => img.remove();
    const plate = h('div', 'cv-plate'); plate.append(h('span', null, entry.title), h('span', null, entry.author || ''));
    c.append(img, plate); img.src = src;
  }
  if (entry.coverState === 'busy') { const s = h('span', 'cv-busy', 'Kapak hazırlanıyor'); if (entry.coverMsg) s.title = entry.coverMsg; c.append(s); }
  return c;
}
function bookLabel(kind, e) {
  if (kind === 'add') return 'Kitap ekle: dosya seç ya da metin yapıştır';
  if (kind === 'rec') return e.title + ', ' + (e.author || '') + '. Önerilen, ' + moodName(e.mood) + '.';
  const prog = e.done ? 'bitirildi' : e.para ? pct(e.para / Math.max(1, e.n - 1)) + ' okundu' : 'başlanmadı';
  const ea = anaOf(e), ana = ea && ea.state === 'run' ? ', çözümleniyor ' + pct(ea.done / Math.max(1, ea.total)) : ea && (ea.state === 'wait' || ea.state === 'err') ? ', ' + anaLabel(ea) : '';
  return e.title + (e.author ? ', ' + e.author : '') + '. ' + prog + ana + '. Açmak için Enter.';
}
function bookSlot(kind, entry) {
  const d = dimsFor(kind, entry);
  const slot = h('div', 'slot ' + kind); slot.setAttribute('role', 'listitem');
  slot.style.cssText = '--sw:' + d.sw + 'px;--fw:' + d.fw + 'px;--cw:' + d.W + 'px';
  const b = h('div', 'book'); b.tabIndex = 0; b.setAttribute('role', 'button');
  const col = kind === 'add' ? {cv: '#241a12', sp: '#1d150e'} : coverColors(entry.title);
  b.style.cssText = '--w:' + d.W + 'px;--h:' + d.H + 'px;--d:' + d.D + 'px;--cv:' + col.cv + ';--sp:' + col.sp + ';--mc:' + (MOOD_COL[entry.mood] || BRASS);
  if (entry.bar) b.style.setProperty('--barcode', barGradient(entry.bar));
  const front = h('div', 'f front');
  if (kind === 'add') {
    const af = h('div', 'add-face'); af.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg>';
    af.append(h('strong', null, 'Kitap ekle'), h('span', null, '.txt · .epub · metin'));
    const cv = h('div', 'cover'); cv.append(af); front.append(cv);
  } else front.append(coverEl(entry));
  front.append(h('i', 'sheen'));
  const spine = h('div', 'f spine');
  spine.append(h('span', 'sp-band a'), h('span', 'sp-band b'), h('span', 'sp-title', kind === 'add' ? 'Kitap ekle' : entry.title));
  if (kind !== 'add') { spine.append(h('span', 'sp-author', (entry.author || '').split(' ').slice(-1)[0] || '')); spine.append(h('span', 'sp-bar')); }
  if (kind === 'mine') { const pr = h('span', 'sp-prog'), i = h('i'); pr.append(i); pr.style.setProperty('--p', entry.para ? entry.para / Math.max(1, entry.n - 1) : 0); spine.append(pr); }
  b.append(front, h('div', 'f back'), spine, h('div', 'f fore'), h('div', 'f topf'));
  if (kind === 'mine' && entry.para > 0) b.append(h('div', 'f markf'));
  if (kind === 'mine' && entry.done) { b.classList.add('done'); front.append(h('span', 'done-rib', 'Bitti')); spine.append(h('span', 'sp-done', '✓')); }
  b.setAttribute('aria-label', bookLabel(kind, entry));
  slot.append(h('div', 'shadow'), b);
  slot._b = b; b._entry = entry; b._kind = kind; slot.dataset.id = entry.id || 'add';
  if (kind === 'mine') updateAnaUI(entry, b);
  return slot;
}
function updateAnaUI(entry, bookEl, noPlaque) {
  if (!noPlaque && plaqueEntry === entry && !bookEl) plaque(entry, 'mine', true);
  const b = bookEl || findBookEl(entry.id, 'mine'); if (!b) return;
  b.querySelectorAll('.ana-wrap,.sp-ana').forEach(x => x.remove());
  const a = anaOf(entry);
  if (a && (a.state === 'run' || a.state === 'wait' || a.state === 'err')) {
    const f = a.done / Math.max(1, a.total), w = h('div', 'ana-wrap ' + a.state), ring = h('div', 'ana');
    ring.style.setProperty('--a', f); w.append(ring, h('span', 'ana-t', pct(f)));
    if (a.state !== 'run') { w.append(h('span', 'ana-msg', anaLabel(a))); w.title = anaDiag(entry); }
    b.querySelector('.front').append(w);
    b.querySelector('.spine').append(h('span', 'sp-ana', a.state === 'run' ? pct(f) : '!'));
  }
  b.setAttribute('aria-label', bookLabel('mine', entry));
}
function findBookEl(id, kind) {
  const row = $(kind === 'rec' ? 'rowRec' : 'rowMine');
  for (const s of row.children) if (s._b && s.dataset.id === id) return s._b;
  return null;
}
function sortedLib() { return lib.slice().sort((a, b) => (b.last || b.added || 0) - (a.last || a.added || 0)); }
function renderMine() {
  const row = $('rowMine'); row.textContent = '';
  row.append(bookSlot('add', {id: 'add', title: 'Kitap ekle'}));
  const L = sortedLib();
  for (const e of L) row.append(bookSlot('mine', e));
  if (L.length) { const q = quoteSlot(); if (q) row.append(q); }
  if (!L.length) row.append(h('p', 'empty-note', 'Rafın boş. Aşağıdan önerilen bir kitap seç ya da kendi kitabını ekle; dosyayı sayfaya bırakman da yeter.'));
  $('mineCount').textContent = L.length ? String(L.length) : '';
  setOff('rowMine', offs.rowMine || 0, true);
}
function renderRec() {
  const row = $('rowRec'); row.textContent = '';
  const R0 = recShown(), sec = recSection();
  for (const r of R0) row.append(bookSlot('rec', r));
  $('recCount').textContent = R0.length ? String(R0.length) : '';
  document.querySelectorAll('#recTabs [data-sec]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.sec === sec));
    if (!b._w) { b._w = 1; b.addEventListener('click', () => { if (recSection() === b.dataset.sec) return; LS.set('recSec', b.dataset.sec); offs.rowRec = 0; renderRec(); }); }
  });
  setOff('rowRec', offs.rowRec || 0, true);
}
let baseGlow = BRASS;
function renderMenu() {
  computeBH();
  $('mProfName').textContent = P.name;
  $('mProfInit').textContent = (P.name || '?').trim().charAt(0).toLocaleUpperCase('tr');
  renderMine(); renderRec(); goalRing(); loadMusicPrefs();
  baseGlow = MOOD_COL[P.lastMood] || BRASS;
  applyGlow(baseGlow);
  plaque(null);
}
function enterMenu() { show('menu'); renderMenu(); resumeJobs(); resumeCovers(); tourMaybe(); }

/* Raf kaydırma (masaüstü: 3B bağlamı bozmamak için transform; telefon: yerel kaydırma) */
const offs = {};
function setOff(rowId, off, instant) {
  const row = $(rowId); if (compactMq.matches) { row.style.transform = ''; return; }
  const shelf = row.parentNode, cs = getComputedStyle(shelf);
  const vis = shelf.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const max = Math.max(0, row.scrollWidth - vis + 20);
  offs[rowId] = clamp(off, 0, max);
  if (instant) row.style.transition = 'none';
  row.style.transform = 'translate3d(' + (-offs[rowId]) + 'px,0,0)';
  if (instant) { void row.offsetWidth; row.style.transition = ''; }
  const nav = shelf.querySelectorAll('.shelf-nav .btn');
  if (nav.length === 2) { nav[0].disabled = offs[rowId] <= 0; nav[1].disabled = offs[rowId] >= max; }
}
function ensureVisible(slot, instant) {
  const row = slot.parentNode;
  if (compactMq.matches) { slot.scrollIntoView({inline: 'center', block: 'nearest', behavior: instant || reduced.matches ? 'auto' : 'smooth'}); return; }
  const shelf = row.parentNode, vis = shelf.clientWidth - 2 * parseFloat(getComputedStyle(shelf).paddingLeft);
  const left = slot.offsetLeft - row.offsetLeft, right = left + slot.offsetWidth, off = offs[row.id] || 0, pad = 140;
  if (left - off < pad) setOff(row.id, left - pad, instant);
  else if (right - off > vis - pad) setOff(row.id, right - vis + pad, instant);
}

/* Etkin (öne çekilmiş) kitap */
let hot = null, leaveT = null, lastPtr = 'mouse';
function setHot(b) {
  if (hot === b) return;
  if (hot) { hot.classList.remove('hot'); hot.parentNode.classList.remove('hot'); }
  hot = b;
  if (b) { b.classList.add('hot'); b.parentNode.classList.add('hot'); applyGlow(b._kind === 'add' ? BRASS : MOOD_COL[b._entry.mood] || BRASS); plaque(b._entry, b._kind); }
  else applyGlow(baseGlow);
}
function activateBook(b) {
  if (!b) return;
  if (b._kind === 'add') { $('dlgAdd').showModal(); return; }
  if (b._kind === 'mine') { openEntry(b._entry, b); return; }
  primeAudio();
  adopt(b._entry, b).then(e => openEntry(e, b)).catch(err => toast('Kitap getirilemedi: ' + scrub(err && err.message || 'bağlantı sorunu').replace(/[.\s]+$/, '') + '. Biraz sonra yeniden dene.', 9000));
}
function focusEntry(id) {
  const b = findBookEl(id, 'mine'); if (!b) return;
  ensureVisible(b.parentNode); b.focus({preventScroll: true}); setHot(b);
}
// Kapak parıltısı: imleç kapakta gezindikçe lamba yansıması yüzeyde kayar (yalnız transform, rAF ile)
let sheenRaf = 0, sheenFx = 0.5;
function moveSheen(e) {
  if (e.pointerType !== 'mouse' || !hot || reduced.matches) return;
  const r = hot.parentNode.getBoundingClientRect(); sheenFx = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
  if (sheenRaf) return;
  sheenRaf = requestAnimationFrame(() => { sheenRaf = 0; const s = hot && hot.querySelector('.sheen'); if (s) s.style.transform = 'translate3d(' + ((sheenFx - 0.5) * 60).toFixed(1) + '%,0,0)'; });
}
function wireRow(row) {
  row.addEventListener('pointermove', moveSheen, {passive: true});
  row.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const s = e.target.closest('.slot'); if (!s || !s._b) return;
    clearTimeout(leaveT); setHot(s._b);
  });
  row.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(leaveT);
    leaveT = setTimeout(() => { if (!row.contains(document.activeElement)) setHot(null); }, 160);
  });
  row.addEventListener('pointerdown', e => { lastPtr = e.pointerType; });
  row.addEventListener('click', e => {
    const s = e.target.closest('.slot'); if (!s || !s._b) return;
    if (lastPtr !== 'mouse' && hot !== s._b) { setHot(s._b); ensureVisible(s); return; }
    activateBook(s._b);
  });
  row.addEventListener('focusin', e => { const b = e.target.closest('.book'); if (b) { setHot(b); ensureVisible(b.parentNode); } });
  row.addEventListener('keydown', e => {
    const b = e.target.closest('.book'); if (!b) return;
    const slots = [...row.children].filter(s => s._b), i = slots.indexOf(b.parentNode);
    const go = s => { if (s) { s._b.focus({preventScroll: true}); } };
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(slots[clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, slots.length - 1)]); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go(slots[e.key === 'Home' ? 0 : slots.length - 1]); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const other = $(row.id === 'rowMine' ? 'rowRec' : 'rowMine'), os = [...other.children].filter(s => s._b);
      if ((row.id === 'rowMine') === (e.key === 'ArrowDown') && os.length) { e.preventDefault(); go(os[clamp(i, 0, os.length - 1)]); }
    }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateBook(b); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && b._kind === 'mine') { e.preventDefault(); removeEntry(b._entry); }
  });
  const shelf = row.parentNode;
  shelf.addEventListener('wheel', e => {
    if (compactMq.matches) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return;
    e.preventDefault(); setOff(row.id, (offs[row.id] || 0) + d * 1.2);
  }, {passive: false});
  let tx = null;
  shelf.addEventListener('touchstart', e => { if (!compactMq.matches) tx = {x: e.touches[0].clientX, o: offs[row.id] || 0}; }, {passive: true});
  shelf.addEventListener('touchmove', e => { if (tx) setOff(row.id, tx.o - (e.touches[0].clientX - tx.x), true); }, {passive: true});
  shelf.addEventListener('touchend', () => { tx = null; }, {passive: true});
  shelf.querySelectorAll('.shelf-nav .btn').forEach(btn => btn.addEventListener('click', () => {
    setOff(row.id, (offs[row.id] || 0) + (+btn.dataset.dir) * shelf.clientWidth * 0.6);
  }));
}

/* Bilgi levhası */
let plaqueEntry = null;
function plaque(entry, kind, refresh) {
  if (!entry && !refresh) {
    const last = lib.filter(e => e.last).sort((a, b) => b.last - a.last)[0];
    if (last) { plaque(last, 'mine-last'); return; }
  }
  plaqueEntry = entry;
  const K = $('plKicker'), T = $('plTitle'), S = $('plSub'), Bl = $('plBlurb'), A = $('plActions');
  A.textContent = ''; K.textContent = '';
  const btn = (label, cls, fn, icon) => { const b = h('button', 'btn ' + cls); b.type = 'button'; if (icon) b.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-' + icon + '"/></svg>'; b.append(label); b.addEventListener('click', fn); A.append(b); return b; };
  const tag = m => { const t = h('span', 'mtag', moodName(m)); t.style.setProperty('--c', MOOD_COL[m]); return t; };
  if (!entry) {
    $('plSwatch').style.setProperty('--plc', BRASS);
    K.textContent = 'Kitaplık'; T.textContent = 'Bir kitabın üstüne gel';
    S.textContent = 'Fareyle raflarda gez; sekme ve ok tuşları da olur. Dokunmatikte bir dokunuş seçer, ikincisi açar.';
    Bl.textContent = 'Kendi kitabını eklemek için rafın başındaki boş cilde bas ya da dosyayı sayfaya bırak.';
    return;
  }
  $('plSwatch').style.setProperty('--plc', kind === 'add' ? BRASS : MOOD_COL[entry.mood] || BRASS);
  if (kind === 'add') {
    K.textContent = 'Yeni kitap'; T.textContent = 'Kitap ekle'; S.textContent = '.txt ya da .epub dosyası, ya da yapıştırılmış metin.';
    Bl.textContent = 'Eklediğin kitap hemen okunabilir. Gemini anahtarın varsa sahneler arka planda çözümlenir, ilerlemesi kapakta görünür.';
    btn('Dosya seç', 'brass', () => $('fileIn').click(), 'file'); btn('Metin yapıştır', 'line', openPaste, 'paste');
    return;
  }
  if (kind === 'rec') {
    const inLib = lib.find(x => x.id === 'gut-' + (entry.gid || entry.id));
    K.append(h('span', null, 'Önerilen'), tag(entry.mood));
    T.textContent = entry.title; S.textContent = (entry.author || '') + (inLib ? ' · kitaplığında' : '');
    Bl.textContent = entry.blurb || '';
    btn(inLib ? 'Devam et' : 'Oku', 'brass', () => activateBook(findBookEl(entry.id, 'rec') || {_kind: 'rec', _entry: entry}), 'back');
    A.lastChild.querySelector('svg').style.transform = 'scaleX(-1)';
    return;
  }
  const f = entry.para ? entry.para / Math.max(1, entry.n - 1) : 0;
  K.append(h('span', null, kind === 'mine-last' ? 'Kaldığın yer' : 'Kitaplığında'), tag(entry.mood));
  T.textContent = entry.title;
  const C = window.SA_Covers;
  const cap = entry.coverState === 'busy' ? 'Kapak hazırlanıyor…' : entry.coverSrc && C ? 'Kapak: ' + (C.LABEL[entry.coverSrc] || entry.coverSrc) : '';
  S.textContent = (entry.author ? entry.author + ' · ' : '') + (entry.done ? 'Bitti' : f ? pct(f) + ' okundu' : 'Başlanmadı') + (entry.last ? ' · ' + ago(entry.last) : '') + (cap ? ' · ' + cap : '');
  const a = anaOf(entry);
  Bl.textContent = a.state === 'run' ? 'Gemini sahneleri çözümlüyor: ' + pct(a.done / Math.max(1, a.total)) + '. Bu arada okuyabilirsin; müzik şimdilik yerel çözümlemeyle seçilir.'
    : a.state === 'done' ? 'Sahneler Gemini ile çözümlendi. ' + entry.n.toLocaleString('tr-TR') + ' paragraf.'
    : a.state === 'wait' ? anaLabel(a) + '. Bu arada müzik yerel çözümlemeyle seçiliyor.'
    : a.state === 'err' ? anaLabel(a) + '. Müzik yerel çözümlemeyle sürüyor. ' + (a.kind === 'key' ? 'Anahtarı profilinden düzeltebilirsin.' : '')
    : entry.n.toLocaleString('tr-TR') + ' paragraf · sahneler yerel sözcük çözümlemesiyle bulunur.';
  if (a.state === 'wait' || a.state === 'err') Bl.title = anaDiag(entry); else Bl.removeAttribute('title');
  btn(f ? 'Devam et' : 'Okumaya başla', 'brass', () => openEntry(entry, findBookEl(entry.id, 'mine')), 'back');
  A.lastChild.querySelector('svg').style.transform = 'scaleX(-1)';
  if (needGemini() && (a.state === 'err' || a.state === 'wait')) btn('Yeniden dene', 'line', () => retryAnalysis(entry));
  if (!entry.rec && C && entry.coverState !== 'busy') {
    const cv = btn('Kapağı değiştir', 'line', () => nextCover(entry), 'swap'); cv.title = 'Sıradaki kapak adayına geç';
    const up = btn('', 'icon ghost', () => uploadCover(entry), 'file'); up.setAttribute('aria-label', 'Kendi kapak resmini yükle'); up.title = 'Kendi kapak resmini yükle';
  }
  const rm = btn('', 'icon ghost', () => removeEntry(entry), 'trash'); rm.setAttribute('aria-label', 'Kitaplıktan çıkar'); rm.title = 'Kitaplıktan çıkar';
}

/* Sürpriz kitap */
function openSurprise() {
  const box = $('surMoods'); box.textContent = '';
  const R0 = recList();
  for (const m of M) {
    const n = R0.filter(r => r.mood === m).length;
    const b = h('button', 'mood-b'); b.type = 'button'; b.style.setProperty('--c', MOOD_COL[m]);
    const t = h('span'); t.append(h('strong', null, moodName(m)), h('small', null, n ? n + ' kitap' : 'başka bir havadan seçeriz'));
    b.append(t);
    b.addEventListener('click', () => {
      $('dlgSurprise').close();
      const pool = R0.filter(r => r.mood === m), pick = (pool.length ? pool : R0)[Math.floor(Math.random() * (pool.length || R0.length))];
      if (!pick) return;
      const el = findBookEl(pick.id, 'rec');
      if (el) { ensureVisible(el.parentNode); setHot(el); setTimeout(() => activateBook(el), reduced.matches ? 50 : 900); }
    });
    box.append(b);
  }
  $('dlgSurprise').showModal();
}
/* Profil penceresi */
function openProfile() {
  const kv = $('profKv'); kv.textContent = '';
  const row = (k, v, code) => { kv.append(h('dt', null, k)); const d = h('dd'); if (code) d.append(h('code', null, code), ' '); d.append(v); kv.append(d); };
  row('Ad', P.name);
  row('Gemini', P.gemKey ? 'bağlı' : 'anahtar yok, yerel çözümleme', P.gemKey ? mask(P.gemKey) : '');
  row('YouTube', P.ytKey ? 'canlı arama' : 'yerleşik telifsiz katalog', P.ytKey ? mask(P.ytKey) : '');
  row('Kitaplık', lib.length + ' kitap');
  $('dlgProfile').showModal();
}
/* Metin yapıştır */
function openPaste(prefill) {
  if ($('dlgAdd').open) $('dlgAdd').close();
  $('pTitle').value = ''; $('pAuthor').value = ''; $('pErr').textContent = '';
  $('pText').value = typeof prefill === 'string' ? prefill : '';
  $('dlgPaste').showModal(); $('pText').focus();
}
async function submitPaste() {
  const raw = Core.repairMojibake($('pText').value.trim());
  if (raw.length < 40) { $('pErr').textContent = 'Biraz daha uzun bir metin yapıştır; en az birkaç cümle.'; return; }
  const blocks = Core.parseText(raw);
  let title = $('pTitle').value.trim();
  if (!title) { const first = raw.split('\n')[0].trim(); title = first.length <= 60 ? first : first.slice(0, 48).replace(/\s+\S*$/, '') + '…'; }
  $('dlgPaste').close();
  try { const r = await addBook({title, author: $('pAuthor').value.trim(), blocks}); toast(r.dup ? 'Bu metin zaten kitaplığında.' : '“' + r.entry.title + '” kitaplığına eklendi.'); focusEntry(r.entry.id); }
  catch (err) { toast('Eklenemedi: ' + (err && err.message)); }
}

/* Arka plan: paralaks, ışık, toz */
const BG = {tx: 0, ty: 0, x: 0, y: 0, run: false, raf: 0, motes: [], col: hexRgb(BRASS), want: hexRgb(BRASS)};
function applyGlow(hex, instant) {
  document.documentElement.style.setProperty('--glow', hex);
  BG.want = hexRgb(hex); if (instant) BG.col = BG.want.slice();
}
function sizeDust() {
  const cv = $('dust'), d = Math.min(1.5, devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
  const n = innerWidth < 720 ? 28 : 64;
  BG.motes = Array.from({length: n}, () => ({x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.6, z: 0.3 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.00006, vy: -0.00002 - Math.random() * 0.00007, ph: Math.random() * 6.28}));
  if (!BG.run) drawDust(0);
}
function drawDust(t) {
  const cv = $('dust'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) BG.col[i] += (BG.want[i] - BG.col[i]) * 0.04;
  const [r, gg, b] = BG.col.map(v => Math.round(v * 0.6 + 255 * 0.4));
  for (const m of BG.motes) {
    if (!reduced.matches) { m.x += m.vx + Math.sin(t / 3000 + m.ph) * 0.00003; m.y += m.vy; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } if (m.x < -0.02) m.x = 1.02; if (m.x > 1.02) m.x = -0.02; }
    const a = (0.25 + 0.35 * Math.sin(t / 1400 + m.ph * 3) ** 2) * m.z;
    const x = (m.x - BG.x * 0.02 * m.z) * W, y = (m.y - BG.y * 0.015 * m.z) * H;
    g.fillStyle = 'rgba(' + r + ',' + gg + ',' + b + ',' + a.toFixed(3) + ')';
    g.beginPath(); g.arc(x, y, m.r * m.z * (W / innerWidth), 0, 6.283); g.fill();
  }
}
function loop(t) {
  if (!BG.run) return;
  const still = reduced.matches || compactMq.matches;
  BG.x += ((still ? 0 : BG.tx) - BG.x) * 0.05; BG.y += ((still ? 0 : BG.ty) - BG.y) * 0.05;
  if (document.body.dataset.screen === 'menu' && !compactMq.matches) $('world').style.transform = 'rotateX(' + (-5 - BG.y * 3).toFixed(3) + 'deg) rotateY(' + (BG.x * 4).toFixed(3) + 'deg)';
  document.querySelector('.bd-img').style.transform = 'translate3d(' + (-BG.x * 14).toFixed(2) + 'px,' + (-BG.y * 9).toFixed(2) + 'px,0) scale(1.06)';
  drawDust(t);
  BG.raf = requestAnimationFrame(loop);
}
function startLoop() { if (BG.run || document.hidden) return; BG.run = true; BG.raf = requestAnimationFrame(loop); }
function stopLoop() { BG.run = false; cancelAnimationFrame(BG.raf); }

/* ================= 5. Uçuş geçişleri ================= */
function flightGeom(r) {
  const s = Math.min((innerHeight * 0.72) / r.height, (innerWidth * 0.44) / r.width, 4);
  const dx = innerWidth / 2 + (r.width * s) / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2);
  const w = r.width * s, hh = r.height * s, cx = r.left + r.width / 2 + dx, cy = r.top + r.height / 2 + dy;
  return {s, dx, dy, page: {left: cx - w / 2, top: cy - hh / 2, width: w, height: hh}};
}
function makeFlightBook(bookEl, r) {
  const fb = h('div', 'fb');
  Object.assign(fb.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
  const page = h('div', 'fb-page' + (readerTheme() === 'paper' ? ' fb-paper' : ''));
  const cov = h('div', 'fb-cover'), cover = bookEl.querySelector('.front .cover');
  const outside = cover ? cover.cloneNode(true) : h('div', 'cover');
  outside.style.setProperty('--h', r.height + 'px'); outside.style.setProperty('--cv', bookEl.style.getPropertyValue('--cv'));
  cov.append(outside, h('div', 'fb-inside')); fb.append(page, cov);
  return {fb, cov};
}
const sheetFrom = pr => 'translate(' + pr.left + 'px,' + pr.top + 'px) scale(' + (pr.width / innerWidth) + ',' + (pr.height / innerHeight) + ')';
async function flyIn(bookEl, build) {
  const fl = $('flight');
  const front = bookEl && bookEl.isConnected && bookEl.querySelector('.front');
  const r = front && front.getBoundingClientRect();
  if (reduced.matches || !r || !r.width) {
    fl.textContent = ''; fl.hidden = false; fl.style.setProperty('--sheet', readerColors().bg);
    const sh = h('div', 'fb-sheet'); fl.append(sh);
    await fin(sh.animate([{opacity: 0}, {opacity: 1}], {duration: reduced.matches ? 1 : 220, fill: 'forwards'}));
    await build();
    await fin(sh.animate([{opacity: 1}, {opacity: 0}], {duration: reduced.matches ? 1 : 260, fill: 'forwards'}));
    fl.hidden = true; fl.textContent = ''; return;
  }
  fl.textContent = ''; fl.hidden = false; fl.style.setProperty('--sheet', readerColors().bg);
  const {fb, cov} = makeFlightBook(bookEl, r); fl.append(fb);
  bookEl.style.visibility = 'hidden';
  const g = flightGeom(r);
  // Kitap kameraya doğru hafifçe dönerek gelir, kapak açılır, sonra kamera ilk sayfaya dalar.
  const a1 = fb.animate([{transform: 'translate(0,0) scale(1) rotateY(0deg) rotateX(0deg)'},
    {transform: 'translate(' + g.dx * 0.6 + 'px,' + g.dy * 0.6 + 'px) scale(' + (1 + (g.s - 1) * 0.6) + ') rotateY(-16deg) rotateX(5deg)', offset: 0.55},
    {transform: 'translate(' + g.dx + 'px,' + g.dy + 'px) scale(' + g.s + ') rotateY(0deg) rotateX(0deg)'}], {duration: 760, easing: 'cubic-bezier(.35,.75,.2,1)', fill: 'forwards'});
  const a2 = cov.animate([{transform: 'rotateY(0deg)'}, {transform: 'rotateY(-172deg)'}], {duration: 780, delay: 260, easing: 'cubic-bezier(.55,.1,.3,1)', fill: 'forwards'});
  await Promise.all([fin(a1), fin(a2)]);
  const sh = h('div', 'fb-sheet'); fl.append(sh);
  const dive = fb.animate([{transform: 'translate(' + g.dx + 'px,' + g.dy + 'px) scale(' + g.s + ')', opacity: 1}, {transform: 'translate(' + g.dx + 'px,' + g.dy + 'px) scale(' + g.s * 1.5 + ')', opacity: 0}], {duration: 520, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards'});
  await Promise.all([fin(sh.animate([{transform: sheetFrom(g.page)}, {transform: 'none'}], {duration: 520, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards'})), fin(dive)]);
  fb.remove(); bookEl.style.visibility = '';
  await build();
  await fin(sh.animate([{opacity: 1}, {opacity: 0}], {duration: 380, fill: 'forwards'}));
  fl.hidden = true; fl.textContent = '';
}
async function flyOut(entry, after) {
  const fl = $('flight');
  fl.textContent = ''; fl.hidden = false; fl.style.setProperty('--sheet', readerColors().bg);
  const sh = h('div', 'fb-sheet'); fl.append(sh);
  after();
  await frame();
  const b = findBookEl(entry.id, 'mine');
  if (reduced.matches || !b) {
    if (b) { ensureVisible(b.parentNode, true); setHot(b); }
    await fin(sh.animate([{opacity: 1}, {opacity: 0}], {duration: reduced.matches ? 1 : 320, fill: 'forwards'}));
    fl.hidden = true; fl.textContent = ''; return;
  }
  ensureVisible(b.parentNode, true);
  b.classList.add('instant'); setHot(b); void b.offsetWidth;
  const r = b.querySelector('.front').getBoundingClientRect();
  b.classList.remove('instant');
  if (!r.width || !r.height) {   // kitap görünmüyorsa (dar ekran/gizli raf) scale(NaN) üretmeden sade geçiş
    await fin(sh.animate([{opacity: 1}, {opacity: 0}], {duration: 320, fill: 'forwards'}));
    fl.hidden = true; fl.textContent = ''; return;
  }
  const g = flightGeom(r), {fb, cov} = makeFlightBook(b, r);
  fb.style.transform = 'translate(' + g.dx + 'px,' + g.dy + 'px) scale(' + g.s + ')'; cov.style.transform = 'rotateY(-172deg)';
  fl.insertBefore(fb, sh); b.style.visibility = 'hidden';
  await fin(sh.animate([{transform: 'none'}, {transform: sheetFrom(g.page)}], {duration: 480, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards'}));
  sh.remove();
  const a2 = cov.animate([{transform: 'rotateY(-172deg)'}, {transform: 'rotateY(0deg)'}], {duration: 620, easing: 'cubic-bezier(.5,.1,.3,1)', fill: 'forwards'});
  const a1 = fb.animate([{transform: fb.style.transform}, {transform: 'none'}], {duration: 680, delay: 240, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'});
  await Promise.all([fin(a1), fin(a2)]);
  b.style.visibility = ''; fl.hidden = true; fl.textContent = '';
}

/* ================= 6. Okuma ekranı ================= */
let R = null, opening = false;
const PAL = {
  dark: {bg: ['#18191b', '#1e1913'], bg2: ['#1f2023', '#26201a'], ink: ['#d3d3cd', '#e0d4c0'], mute: ['#8f8e8a', '#9b8f7c'], rule: ['#2c2d30', '#342c23']},
  paper: {bg: ['#f1f1ed', '#f4ead7'], bg2: ['#e7e7e2', '#ebdfc8'], ink: ['#232428', '#2c2219'], mute: ['#646468', '#75675a'], rule: ['#d6d6d0', '#dacdb6']}
};
const readerTheme = () => set.theme === 'auto' ? (darkPref.matches ? 'dark' : 'paper') : set.theme;
function readerColors() { const p = PAL[readerTheme()], o = {}; for (const k in p) o[k] = mix(p[k][0], p[k][1], set.warm); return o; }
/* Okunabilirlik: Atkinson Hyperlegible (gerekince Google Fonts'tan), harf/sözcük aralığı, satır odağı cetveli */
const RUL = {el: null, y: innerHeight * 0.4, raf: 0};
function applyLegible(el) {
  if (set.atk && !document.getElementById('fAtk')) {
    const l = document.createElement('link'); l.id = 'fAtk'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.append(l);
  }
  el.classList.toggle('atk', !!set.atk);
  el.style.setProperty('--ls', (set.ls || 0) + 'em'); el.style.setProperty('--ws', (set.ws || 0) + 'em');
  $('sAtk').checked = !!set.atk; $('sRuler').checked = !!set.ruler;
  $('sLs').value = set.ls || 0; $('oLs').textContent = (+(set.ls || 0)).toFixed(2).replace('.', ',') + ' em';
  $('sWs').value = set.ws || 0; $('oWs').textContent = (+(set.ws || 0)).toFixed(2).replace('.', ',') + ' em';
  if (set.ruler) { if (!RUL.el) { RUL.el = h('div', 'ruler'); RUL.el.setAttribute('aria-hidden', 'true'); el.append(RUL.el); } RUL.el.hidden = false; moveRuler(RUL.y); }
  else if (RUL.el) RUL.el.hidden = true;
}
function moveRuler(y) {
  RUL.y = y; if (RUL.raf || !RUL.el) return;
  RUL.raf = requestAnimationFrame(() => {
    RUL.raf = 0;
    const a = $('rText').getBoundingClientRect(), bh = set.size * set.lh * 1.15;
    const s = RUL.el.style; s.left = (a.left - 8) + 'px'; s.width = (a.width + 16) + 'px'; s.height = bh + 'px';
    s.transform = 'translate3d(0,' + Math.round(RUL.y - bh / 2) + 'px,0)';
  });
}
function applyLook() {
  const el = $('scr-reader'), c = readerColors();
  el.dataset.theme = readerTheme();
  for (const k in c) el.style.setProperty('--' + k, c[k]);
  el.style.setProperty('--fs', set.size + 'px'); el.style.setProperty('--lh', set.lh);
  el.classList.toggle('focus', !!set.focus);
  applyLegible(el);
  $('rFocus').setAttribute('aria-pressed', String(!!set.focus)); $('sFocus').checked = !!set.focus;
  $('sSize').value = set.size; $('oSize').textContent = set.size + ' px';
  $('sLh').value = set.lh; $('oLh').textContent = (+set.lh).toFixed(2).replace('.', ',');
  $('sWarm').value = set.warm; $('oWarm').textContent = pct(set.warm);
  $('sAuto').checked = !!set.autoplay;
  for (const r of document.querySelectorAll('input[name="theme"]')) r.checked = r.value === set.theme;
  $('npVol').value = set.vol;
  scheduleRibbon();
}

/* Kitap dili: okurun elle seçimi (langManual) her şeyi geçer; yoksa eski tanıyıcıyla saklanan dil açılışta yeniden tanınır.
   Dil değişirse o kitabın dile bağlı yerel çözümlemesi ve Gemini önbelleği atılır (yanlış dille üretilmişti). */
function setEntryLang(entry, lang, manual) {
  const changed = entry.lang !== lang;
  entry.lang = lang; entry.langV = Core.LANG_V;
  if (manual) entry.langManual = lang;
  if (changed) {
    memLocal.delete(entry.id);
    const j = jobs.get(entry.id); if (j) { j.ctrl.abort(); jobs.delete(entry.id); }
    try { Promise.resolve(G.clearCache && G.clearCache(entry.id)).catch(() => {}); } catch (e) { /* yok */ }
  }
  saveLib();
  return changed;
}
function recheckLang(entry, data) {
  if (entry.langManual) { if (entry.lang !== entry.langManual) setEntryLang(entry, entry.langManual); return; }
  if (entry.langV === Core.LANG_V && entry.lang) return;
  const texts = data.blocks.filter(x => !x.h).map(x => x.t);
  setEntryLang(entry, Core.detectLang(texts, {hint: entry.langMeta || (entry.rec ? entry.lang : '')}));
}
async function setBookLang(lang) {
  if (!R || (lang !== 'tr' && lang !== 'en')) return;
  const entry = R.entry, changed = setEntryLang(entry, lang, true);
  syncBookLangUI();
  if (!changed) return;
  const la = await localAnalysis((await DB.get(entry.id) || {blocks: []}).blocks, lang); rememberLocal(entry.id, la);
  if (R && R.entry === entry) {
    R.dec = la.dec; R.gem = null; $('rText').lang = lang;
    try { R.gem = (await preAnalysis(entry, R.texts)) || null; } catch (e) { /* yok */ }
    if (V.on) { V.alignOn = alignPossible(); V.langNoted = false; if (V.alignOn) { V.aligner = new Core.Aligner(R.texts, lang); V.aligner.seek(Math.max(0, R.active)); V.lastCursor = -1; } else underline(-1); noteLang(); restartRec(); }
    if (typeof scheduleRibbon === 'function') scheduleRibbon();
    runAnalysis(entry, R.texts);
  }
  toast('Kitap dili: ' + (lang === 'tr' ? 'Türkçe' : 'İngilizce') + ' (bu kitap için kaydedildi).', 2600);
}
function syncBookLangUI() {
  const l = R ? (R.entry.lang || 'tr') : '';
  document.querySelectorAll('[data-bl]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.bl === l)));
}
async function openEntry(entry, bookEl) {
  if (opening || !entry) return;
  opening = true; primeAudio();
  try {
    const data = await DB.get(entry.id);
    if (!data) { toast('Bu kitabın metni bu tarayıcıda bulunamadı; yeniden eklemen gerekebilir.', 9000); return; }
    recheckLang(entry, data);
    await flyIn(bookEl, () => buildReader(entry, data));
  } catch (err) { toast('Kitap açılamadı: ' + scrub(err && err.message)); show('menu'); }
  finally { opening = false; }
}
/* "Kaldığın yerde ne oluyordu?" — ≥1 gün sonra açılışta, son ~30 paragraftan yerel özet kartı */
function showRecap(at, away) {
  const old = document.querySelector('.recap'); if (old) old.remove();
  let sents = [];
  try { sents = Core.recap(R.texts, at - 1, {lang: R.entry.lang || 'tr', span: 30, k: 3, chars: Core.findChars(R.texts.slice(Math.max(0, at - 400), at))}); } catch (e) { return; }
  if (!sents.length) return;
  const days = Math.round(away / 864e5), mood = effInfo(Math.max(0, at)).mood;
  const card = h('aside', 'recap'); card.setAttribute('aria-label', 'Kaldığın yerde ne oluyordu');
  const head = h('div', 'recap-h');
  head.append(h('strong', null, 'Kaldığın yerde ne oluyordu?'));
  const x = h('button', 'btn icon ghost'); x.type = 'button'; x.setAttribute('aria-label', 'Kapat'); x.textContent = '×';
  head.append(x); card.append(head);
  card.append(h('div', 'recap-k', (days >= 1 ? days + ' gün önce' : 'Geçen sefer') + ' burada kaldın · şu anki hava: ' + moodName(mood)));
  const ol = h('ol');
  for (const s of sents) { const li = h('li'); const b = h('button', 'recap-s', s.text); b.type = 'button'; b.title = 'Bu cümleye git'; b.onclick = () => { jumpTo(s.para); }; li.append(b); ol.append(li); }
  card.append(ol);
  card.style.setProperty('--mc', MOOD_COL[mood] || BRASS);
  const close = () => { card.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  x.onclick = close; document.addEventListener('keydown', esc);
  // Metnin içinde, kaldığın paragrafın hemen üstünde durur (üstte yüzen bir katman değil; metni örtmez)
  const p = R.paras[at] && R.paras[at].el; if (!p) return;
  p.parentNode.insertBefore(card, p);
  setTimeout(() => { if (card.isConnected && !card.matches(':hover')) card.classList.add('dim'); }, 45000);
}
async function buildReader(entry, data) {
  const oldRecap = document.querySelector('.recap'); if (oldRecap) oldRecap.remove();
  const la = memLocal.get(entry.id) || await localAnalysis(data.blocks, entry.lang);
  rememberLocal(entry.id, la);
  R = {entry, paras: [], heads: [], dec: la.dec, texts: la.texts, cum: [0], gem: null, active: -1, cand: -1, sceneTracks: new Map(), curScene: null};
  const job = jobs.get(entry.id);
  if (job) R.gem = job.results;
  else { try { const c = await Promise.resolve(G.getCached(entry.id)); if (Array.isArray(c)) R.gem = c; } catch (e) { /* yok */ } }
  if (!R.gem || !R.gem.some(Boolean)) R.gem = (await preAnalysis(entry, la.texts)) || R.gem;

  const art = $('rText'); art.textContent = ''; art.lang = entry.lang || 'tr';
  const frag = document.createDocumentFragment();
  const front = h('header', 'r-front');
  front.append(h('h1', null, entry.title));
  if (entry.author) front.append(h('p', 'by', entry.author));
  const mins = Math.max(1, Math.round((entry.chars || la.lens.reduce((a, b) => a + b, 0)) / 6 / 230));
  front.append(h('p', 'meta', R.texts.length.toLocaleString('tr-TR') + ' paragraf · ' + (mins < 60 ? 'yaklaşık ' + mins + ' dakika' : 'yaklaşık ' + (mins / 60).toFixed(1).replace('.', ',') + ' saat') + ' · baskın hava: ' + moodName(M[la.dec.dominant])));
  front.append(h('span', 'orn'));
  frag.append(front);
  let sec = null, cnt = 0, pi = 0, chap = 0, fresh = true;
  for (const bl of data.blocks) {
    if (!sec || cnt >= 40) { sec = h('div', 'chunk'); frag.append(sec); cnt = 0; }
    if (bl.h) { const e = h('h2', null, bl.t); R.heads.push({t: bl.t, el: e, pi}); sec.append(e); chap++; fresh = true; }
    else {
      const e = h('p', null, bl.t); e.dataset.i = pi;
      if (fresh && /^\p{L}/u.test(bl.t) && bl.t.length > 120) e.className = 'dc';
      fresh = false;
      R.paras.push({el: e, chap}); R.cum.push(R.cum[pi] + bl.t.length); sec.append(e); pi++;
    }
    cnt++;
  }
  art.append(frag);
  $('rBook').innerHTML = ''; $('rBook').append(h('b', null, entry.title), entry.author ? ' · ' + entry.author : '');
  $('rSettings').hidden = true; $('rType').setAttribute('aria-expanded', 'false');
  applyLook();
  show('reader');
  const away = entry.last ? Date.now() - entry.last : 0;
  entry.last = Date.now(); P.lastBook = entry.id; saveProfiles(); saveLib();
  const start = clamp(entry.para || 0, 0, R.paras.length - 1);
  await frame();
  if (start > 0) await jumpTo(start); else { $('rScroll').scrollTop = 0; setActive(0, true); }
  if (start >= 5 && (away >= 864e5 || /[?&]recap/.test(location.search))) showRecap(start, away);
  $('rScroll').focus({preventScroll: true});
  drawRibbon(); updateSrc(); renderHeard(); setupMusic(); syncLangUI();
  if (needGemini() && !jobs.has(entry.id) && !(entry.ana && entry.ana.state === 'done')) runAnalysis(entry, R.texts);
  featInit();
  clearInterval(extTimer); let lastExt = R.active;
  // Gemini yalnızca okunan pencereyi çözümler; okur ilerledikçe pencereyi kaydır
  extTimer = setInterval(() => {
    if (!R || R.entry !== entry || !needGemini() || !G.extend || jobs.has(entry.id)) return;
    if (Math.abs(R.active - lastExt) < 80) return;
    lastExt = R.active;
    Promise.resolve(G.extend(entry.id, R.active, {onProgress: res => { const j = {id: entry.id, results: R.gem || [], ctrl: {}}; mergeRes(j, res); R.gem = j.results; updateSrc(); }}))
      .then(res => { if (R && R.entry === entry && res && Array.isArray(res.results || res)) { const j = {id: entry.id, results: R.gem || []}; mergeRes(j, res.results || res); R.gem = j.results; updateSrc(); } }).catch(() => {});
  }, 4000);
}
let extTimer = 0;
/* Yalnızca assets/analysis/ altında hazır JSON'u olan (önerilen) kitaplar için istek at; eski/kaldırılmış gid'ler konsolda 404 bırakmasın. */
let analysedGids = null;
function hasAnalysis(gid) {
  if (!analysedGids) { const B = window.SA_Books || {}; analysedGids = new Set([...(B.RECOMMENDED || []), ...(B.TURKISH || [])].map(b => String(b.gid))); }
  return analysedGids.has(String(gid));
}
/* Hazır (önerilen kitap) ya da daha önce Claude ile tanımlanmış sahneler. */
async function preAnalysis(entry, texts) {
  const C = window.SA_Claude; if (!C) return null;
  const book = {id: entry.id, title: entry.title, lang: entry.lang, paragraphs: texts};
  try { const s = localStorage.getItem('sa-claude-' + entry.id); if (s) return C.merge(book, null, Object.assign({ok: true}, JSON.parse(s))); } catch (e) { /* yok */ }
  if (!entry.gid || !hasAnalysis(entry.gid)) return null;
  try {
    const r = await fetch('assets/analysis/' + entry.gid + '.json'); if (!r.ok) return null;
    const d = await r.json(); return d.n && Math.abs(d.n - texts.length) > 3 ? null : C.merge(book, null, Object.assign({ok: true}, d));
  } catch (e) { return null; }
}
/* Claude hesabıyla tanımlatma: parça indir → istemi kopyala → claude.ai → cevabı yapıştır. */
function claudePanel() {
  const C = window.SA_Claude; if (!R || !C) { toast('Claude aktarımı yüklenemedi.'); return; }
  const entry = R.entry, book = {id: entry.id, title: entry.title, author: entry.author, lang: entry.lang, paragraphs: R.texts};
  const parts = C.buildExport(book).parts; let k = 0, acc = [];
  const dlg = h('dialog', 'claude-dlg'); document.body.append(dlg);
  const draw = () => {
    const p = parts[k]; dlg.textContent = '';
    dlg.append(h('h3', null, 'Claude ile tanımla' + (parts.length > 1 ? ' · parça ' + (k + 1) + '/' + parts.length : '')));
    dlg.append(h('p', null, 'Anahtar gerekmez: kendi Claude hesabında şu adımları izle. ¶' + p.from + '–¶' + p.to + ' arası.'));
    const step = (t, f) => { const b = h('button', 'btn line', t); b.type = 'button'; b.onclick = f; dlg.append(b, ' '); };
    step('1 · Metni indir (.txt)', () => { const a = h('a'); a.href = URL.createObjectURL(new Blob([p.text], {type: 'text/plain'})); a.download = p.filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    step('2 · İstemi kopyala', () => navigator.clipboard.writeText(p.prompt).then(() => toast('İstem kopyalandı.'), () => toast('Kopyalanamadı; elle seç.')));
    step('3 · claude.ai’yi aç', () => window.open('https://claude.ai/new', '_blank', 'noopener'));
    const ta = h('textarea'); ta.rows = 6; ta.placeholder = 'Claude’un cevabını buraya yapıştır'; ta.style.width = '100%'; dlg.append(ta);
    const msg = h('p', 'claude-msg'); dlg.append(msg);
    step('4 · Uygula', () => {
      const r = C.parseResult(ta.value, book, p);
      if (!r || !r.ok) { msg.textContent = 'Cevap okunamadı. ' + ((r && r.warnings || []).join(' ')); return; }
      acc.push(...r.scenes); const cv = r.coverage || {};
      msg.textContent = 'Kapsam: %' + Math.round((cv.ratio || 0) * 100) + (r.warnings && r.warnings.length ? ' · ' + r.warnings.join(' ') : '');
      const all = {ok: true, scenes: acc, book: r.book || {}};
      R.gem = C.merge(book, null, all); scheduleRibbon(); scheduleScene(R.active); updateSrc();
      try { localStorage.setItem('sa-claude-' + entry.id, JSON.stringify({scenes: acc, book: all.book})); } catch (e) { /* dolu */ }
      if (r.book && r.book.coverScene) { entry.coverScene = r.book.coverScene; saveLib(); if (!entry.rec && entry.coverSrc === 'design') { delete entry.coverSrc; runCover(entry, R.texts); } }
      if (k < parts.length - 1) { k++; setTimeout(draw, 900); } else toast('Claude sahneleri uygulandı.');
    });
    step('Kapat', () => dlg.close());
  };
  dlg.addEventListener('close', () => dlg.remove());
  draw(); dlg.showModal();
}
function closeReader() {
  if (!R) return;
  clearInterval(extTimer); featClose(); ttsStop(); stopVoice(); releaseMic(); savePos(true); stopMusic();
  const entry = R.entry;
  if (R.active >= 0) P.lastMood = infoFor(R.active).mood;
  saveProfiles();
  flyOut(entry, () => { show('menu'); renderMenu(); }).then(() => { $('rText').textContent = ''; R = null; const b = findBookEl(entry.id, 'mine'); if (b) b.focus({preventScroll: true}); });
}

/* Paragrafın havası: Gemini sonucu varsa o, yoksa yerel çözümleme. */
function infoFor(i) {
  const g = R.gem && R.gem[i];
  const amb = R.dec.amb[i] >= 0 ? Core.AMBS[R.dec.amb[i]] : null;
  if (g && M.includes(g.mood)) return {mood: g.mood, energy: g.energy != null ? +g.energy : 0.5, query: g.query || MOOD_EN[g.mood] + ' instrumental', scene: 'G:' + (g.scene || g.mood), sceneText: g.scene || '', source: g.source === 'local' ? 'local' : 'gemini', amb};
  const m = M[R.dec.mood[i]] || 'huzur';
  return {mood: m, energy: R.dec.inten[i], query: MOOD_EN[m] + ' instrumental', scene: 'L:' + m, sceneText: '', source: 'local', neutral: !!R.dec.neutral[i], amb};
}

/* Paragraf takibi: fare 400 ms bekleyince; dokunmatikte okuma çizgisi. */
const sc = () => $('rScroll');
let dwellT = null, mouse = {x: 0, y: 0, t: 0, over: false}, scrollRaf = 0;
function candidate(i) {
  if (!R || i == null || isNaN(i) || i === R.cand || T.on) return;   // sesli kitapta paragrafı ses belirler; tıklayınca oradan sürer
  R.cand = i; clearTimeout(dwellT);
  dwellT = setTimeout(() => setActive(i), 400);
}
function paraAt(x, y) {
  for (const dy of [0, 14, -14, 28]) {
    const el = document.elementFromPoint(x, y + dy), p = el && el.closest && el.closest('p[data-i]');
    if (p) return +p.dataset.i;
  }
  return null;
}
function readingLineY() { const r = sc().getBoundingClientRect(); return r.top + 60 + (r.height - 60) * 0.34; }
function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0; if (!R) return;
    if (V.on) {   // sesli okumada paragrafı ses belirler; yalnızca okurun kendi kaydırması okuma çizgisinden yeniden eşler
      if (performance.now() - V.autoT < 1500) return;
      const a = $('rText').getBoundingClientRect(); candidate(paraAt(a.left + a.width / 2, readingLineY())); return;
    }
    if (mouse.over && performance.now() - mouse.t < 10000) candidate(paraAt(mouse.x, mouse.y));
    else { const a = $('rText').getBoundingClientRect(); candidate(paraAt(a.left + a.width / 2, readingLineY())); }
  });
}
function setActive(i, quiet) {
  if (!R || i < 0 || i >= R.paras.length || i === R.active) return;
  const prev = R.active;
  if (prev >= 0) for (let j = prev - 1; j <= prev + 1; j++) if (R.paras[j]) R.paras[j].el.classList.remove('act', 'near');
  R.active = i; R.cand = i;
  const inf = infoFor(i), el = R.paras[i].el;
  for (let j = i - 1; j <= i + 1; j++) if (R.paras[j]) R.paras[j].el.classList.add('near');
  el.classList.add('act'); el.dataset.m = moodName(inf.mood);
  $('scr-reader').style.setProperty('--mc', MOOD_COL[inf.mood]);
  updateThumb(); savePos(); renderScene(effInfo(i)); featActive(i, prev);
  if (V.on && !V.fromVoice && V.aligner) { V.aligner.seek(i); V.lastCursor = -1; underline(-1); }   // fare/dokunuş/kaydırma: hizalayıcıyı eşle
  if (quiet) return;
  scheduleScene(i);
}
let posT = null;
function savePos(now) {
  clearTimeout(posT);
  const go = () => { if (!R || R.active < 0) return; R.entry.para = R.active; R.entry.last = Date.now(); saveLib(); };
  if (now) go(); else posT = setTimeout(go, 1000);
}
async function jumpTo(i) {
  if (!R || !R.paras[i]) return;
  const el = R.paras[i].el, s = sc();
  for (let k = 0; k < 3; k++) { s.scrollTop += el.getBoundingClientRect().top - readingLineY() + 6; await frame(); }
  clearTimeout(dwellT); setActive(i);
}

/* Duygu şeridi: kitabın tamamı, aynı zamanda kaydırıcı */
let ribT = null;
function scheduleRibbon() { if (!ribT) ribT = setTimeout(() => { ribT = null; drawRibbon(); }, 600); }
function drawRibbon() {
  if (!R || $('scr-reader').hidden) return;
  const cv = $('ribbonCv'), r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; if (!r.height) return;
  cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  const g = cv.getContext('2d'); g.scale(d, d);
  const tot = R.cum[R.cum.length - 1] || 1, Hh = r.height, Ww = r.width;
  for (let i = 0; i < R.paras.length; i++) {
    const a = R.cum[i] / tot * Hh, b = R.cum[i + 1] / tot * Hh, inf = infoFor(i);
    g.globalAlpha = inf.source === 'gemini' ? 1 : 0.72; g.fillStyle = MOOD_COL[inf.mood];
    g.fillRect(0, a, Ww, Math.max(b - a, 0.7));
  }
  g.globalAlpha = 1; g.fillStyle = readerColors().bg;
  for (const hd of R.heads) if (hd.pi > 0) g.fillRect(0, R.cum[hd.pi] / tot * Hh - 0.5, Ww, 1.5);
  updateThumb();
}
function fracOf(i) { const tot = R.cum[R.cum.length - 1] || 1; return R.cum[i] / tot; }
function paraOfFrac(f) {
  const tot = R.cum[R.cum.length - 1] || 1, target = f * tot; let lo = 0, hi = R.paras.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R.cum[m] <= target) lo = m; else hi = m - 1; }
  return lo;
}
function chapterOf(i) { let c = null; for (const hd of R.heads) { if (hd.pi <= i) c = hd; else break; } return c; }
function updateThumb() {
  if (!R || R.active < 0) return;
  const cv = $('ribbonCv'), f = fracOf(R.active);
  $('rbThumb').style.top = (cv.offsetTop + f * cv.offsetHeight) + 'px';
  const rib = $('ribbon'), inf = infoFor(R.active), ch = chapterOf(R.active);
  rib.setAttribute('aria-valuenow', String(Math.round(f * 100)));
  rib.setAttribute('aria-valuetext', pct(f) + ', ' + moodName(inf.mood) + (ch ? ', ' + ch.t : ''));
}
function wireRibbon() {
  const rib = $('ribbon'), tip = $('rbTip'), cv = $('ribbonCv'); let drag = false;
  const fAt = y => { const r = cv.getBoundingClientRect(); return clamp((y - r.top) / r.height, 0, 1); };
  const showTip = (y, i) => {
    const inf = infoFor(i), ch = chapterOf(i);
    tip.textContent = pct(fracOf(i)) + ' · ' + moodName(inf.mood) + (ch ? ' · ' + ch.t.slice(0, 40) : '');
    tip.style.top = (y - rib.getBoundingClientRect().top) + 'px'; tip.hidden = false;
  };
  rib.addEventListener('pointerdown', e => { if (!R) return; drag = true; rib.setPointerCapture(e.pointerId); const i = paraOfFrac(fAt(e.clientY)); showTip(e.clientY, i); jumpTo(i); });
  rib.addEventListener('pointermove', e => { if (!R) return; const i = paraOfFrac(fAt(e.clientY)); showTip(e.clientY, i); if (drag) { R.paras[i].el.scrollIntoView({block: 'center'}); setActive(i, true); } });
  rib.addEventListener('pointerup', e => { if (drag && R) { drag = false; jumpTo(paraOfFrac(fAt(e.clientY))).then(() => { if (R) scheduleScene(R.active); }); } });
  rib.addEventListener('pointerleave', () => { if (!drag) tip.hidden = true; });
  rib.addEventListener('keydown', e => {
    if (!R) return; const f = fracOf(Math.max(0, R.active));
    const step = {ArrowUp: -0.01, ArrowDown: 0.01, ArrowLeft: -0.01, ArrowRight: 0.01, PageUp: -0.1, PageDown: 0.1}[e.key];
    let t = null;
    if (step != null) t = clamp(f + step, 0, 1); else if (e.key === 'Home') t = 0; else if (e.key === 'End') t = 1;
    if (t == null) return;
    e.preventDefault();
    let i = paraOfFrac(t); if (i === R.active && step) i = clamp(i + Math.sign(step), 0, R.paras.length - 1);
    jumpTo(i);
  });
}

/* Kaynak göstergesi */
function updateSrc() {
  if (!R) return;
  const s = $('rSrc'), t = $('rSrcT'), a = R.entry.ana || {};
  let st = 'local', txt = 'Yerel çözümleme', tip = 'Gemini anahtarı yok; sahneler bu tarayıcıda sözcüklerden çıkarılıyor.';
  const pre = R.gem && R.gem.find(x => x && (x.source === 'claude' || x.source === 'hazır'));
  if (pre) { st = 'gemini'; txt = pre.source === 'claude' ? 'Claude ile tanımlandı' : 'Hazır sahneler'; tip = pre.source === 'claude' ? 'Sahneler Claude hesabınla tanımlandı.' : 'Önerilen kitabın sahneleri önceden çıkarıldı.'; }
  if (needGemini()) {
    if (a.state === 'run') { st = 'run'; txt = 'Gemini çözümlüyor · ' + pct(a.done / Math.max(1, a.total)); tip = 'Henüz çözümlenmemiş paragraflarda yerel çözümleme kullanılıyor.'; s.style.setProperty('--a', a.done / Math.max(1, a.total)); }
    else if (a.state === 'wait') { st = 'err'; txt = anaLabel(a); tip = 'Beklerken müzik yerel çözümlemeyle seçiliyor.'; }
    else if (a.state === 'err') { st = 'err'; txt = anaLabel(a) + (a.kind === 'daily' ? '' : ' · yerel'); tip = (a.detail || a.err || 'Bağlantı sorunu.') + ' Müzik yerel çözümlemeyle sürüyor.'; }
    else if (R.gem && R.gem.some(x => x && x.source === 'gemini')) { st = 'gemini'; txt = 'Gemini çözümlemesi'; tip = 'Sahneler ve havalar Gemini ile çözümlendi.'; }
    const kl = kwLine(R.entry); if (kl) tip += '\n' + kl;
    tip += '\n' + anaDiag(R.entry);
  }
  if (MOCK.gemini && st !== 'local') tip += ' (Gemini modülü yüklenmedi; deneme kipi.)';
  // Yerel ipucu: title yalnız fareyle görünür, dokunmatik/klavyede ve satır sonlarında (kwLine) güvenilmez → kendi kutumuz
  s.dataset.s = st; t.textContent = txt; s.removeAttribute('title'); $('rSrcTip').textContent = tip; s.setAttribute('aria-label', txt + '. ' + tip);
  if (!s.dataset.tipBound) {
    s.dataset.tipBound = '1';
    const tp = $('rSrcTip');
    const show = () => { if (!tp.textContent) return; tp.hidden = false; const r = s.getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
      tp.style.width = w + 'px'; tp.style.left = clamp(r.left, 8, innerWidth - w - 8) + 'px'; tp.style.top = (r.bottom + 8) + 'px'; };
    const hide = () => { tp.hidden = true; };
    s.addEventListener('mouseenter', show); s.addEventListener('mouseleave', hide);
    s.addEventListener('focus', show); s.addEventListener('blur', hide);
    s.addEventListener('click', () => (tp.hidden ? show() : hide()));
    s.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    $('rScroll').addEventListener('scroll', hide, {passive: true});
  }
  $('rRetry').hidden = !(needGemini() && (a.state === 'err' || a.state === 'wait'));
}

/* Bölümler */
function openChapters() {
  const ol = $('chapList'); ol.textContent = '';
  if (!R || !R.heads.length) { ol.append(h('li', 'help', 'Bu kitapta bölüm başlığı bulunamadı.')); }
  else for (const hd of R.heads) {
    const li = h('li'), b = h('button'); b.type = 'button';
    b.append(h('span', null, hd.t), h('small', null, pct(fracOf(Math.min(hd.pi, R.paras.length - 1)))));
    b.addEventListener('click', () => { $('dlgChapters').close(); jumpTo(Math.min(hd.pi, R.paras.length - 1)); });
    li.append(b); ol.append(li);
  }
  $('dlgChapters').showModal();
}

function wireReader() {
  const s = sc(), art = $('rText');
  s.tabIndex = -1;
  s.addEventListener('scroll', onScroll, {passive: true});
  art.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouse = {x: e.clientX, y: e.clientY, t: performance.now(), over: true};
    if (V.on) return;   // sesli okumada fare beklemesi paragrafı değiştirmez
    const p = e.target.closest('p[data-i]'); if (p) candidate(+p.dataset.i);
  });
  art.addEventListener('pointerleave', () => { mouse.over = false; });
  art.addEventListener('click', e => {
    const p = e.target.closest('p[data-i]'); if (!p) return;
    if (!getSelection().isCollapsed) return;   // metin seçimi (not/altını çiz) paragraf atlatmasın
    if (T.on) { ttsSpeak(+p.dataset.i); return; }
    if (V.on) { clearTimeout(dwellT); const i = +p.dataset.i; if (i === R.active) { V.aligner.seek(i); V.lastCursor = -1; underline(-1); } else setActive(i); vToast('Buradan devam ediyorum.', 2200); return; }
    if (lastPtrR === 'mouse') return; clearTimeout(dwellT); setActive(+p.dataset.i);
  });
  art.addEventListener('pointerdown', e => { lastPtrR = e.pointerType; });
  $('rBack').addEventListener('click', closeReader);
  $('rChapters').addEventListener('click', openChapters);
  $('rFocus').addEventListener('click', () => { set.focus = !set.focus; saveSet(); applyLook(); });
  $('rTheme').addEventListener('click', () => { set.theme = readerTheme() === 'dark' ? 'paper' : 'dark'; saveSet(); applyLook(); });
  $('rType').addEventListener('click', () => { const p = $('rSettings'); p.hidden = !p.hidden; $('rType').setAttribute('aria-expanded', String(!p.hidden)); });
  $('sSize').addEventListener('input', e => { set.size = +e.target.value; saveSet(); applyLook(); });
  $('sLh').addEventListener('input', e => { set.lh = +e.target.value; saveSet(); applyLook(); });
  $('sWarm').addEventListener('input', e => { set.warm = +e.target.value; saveSet(); applyLook(); });
  $('sFocus').addEventListener('change', e => { set.focus = e.target.checked; saveSet(); applyLook(); });
  $('sAtk').addEventListener('change', e => { set.atk = e.target.checked; saveSet(); applyLook(); });
  $('sLs').addEventListener('input', e => { set.ls = +e.target.value; saveSet(); applyLook(); });
  $('sWs').addEventListener('input', e => { set.ws = +e.target.value; saveSet(); applyLook(); });
  $('sRuler').addEventListener('change', e => { set.ruler = e.target.checked; saveSet(); applyLook(); });
  $('scr-reader').addEventListener('pointermove', e => { if (set.ruler && e.target.closest('.r-scroll')) moveRuler(e.clientY); }, {passive: true});
  addEventListener('resize', () => { if (set.ruler && document.body.dataset.screen === 'reader') moveRuler(RUL.y); });
  $('sAuto').addEventListener('change', e => { set.autoplay = e.target.checked; saveSet(); });
  for (const r of document.querySelectorAll('input[name="theme"]')) r.addEventListener('change', e => { set.theme = e.target.value; saveSet(); applyLook(); });
  document.addEventListener('keydown', e => {
    if (document.body.dataset.screen !== 'reader' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); togglePlay(); }
    else if ((e.key === 'v' || e.key === 'V') && SR) { e.preventDefault(); toggleVoice(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); set.focus = !set.focus; saveSet(); applyLook(); }
    else if (e.key === 'Escape' && !$('rSettings').hidden) { $('rSettings').hidden = true; $('rType').setAttribute('aria-expanded', 'false'); $('rType').focus(); }
  });
  darkPref.addEventListener('change', () => { if (R && set.theme === 'auto') applyLook(); });
  $('rClaude').addEventListener('click', claudePanel);
  // Uyku zamanlayıcısı: kapalı → 10/20/30 dk → bölüm sonunda; süre dolunca müzik 8 sn'de kısılıp durur
  const SL = {k: 0, t: 0, opts: [0, 10, 20, 30, 'bölüm']};
  const sleepEnd = () => {
    clearInterval(SL.t); SL.k = 0; $('rSleep').textContent = 'Uyku: kapalı';
    const e = MU.engine;
    if (MU.mode === 'engine' && e && e.fadeTo && e.playing) { e.fadeTo(0, 8); setTimeout(() => { stopMusic(); try { e.volume(musicVol()); } catch (x) { /* yok */ } }, 8200); }
    else stopMusic();
    F.amb && F.amb.scene && F.amb.scene(null);
    toast('Uyku zamanlayıcısı: müzik durduruldu. İyi uykular.');
  };
  $('rSleep').addEventListener('click', () => {
    clearInterval(SL.t); SL.k = (SL.k + 1) % SL.opts.length; const o = SL.opts[SL.k];
    $('rSleep').textContent = 'Uyku: ' + (!o ? 'kapalı' : o === 'bölüm' ? 'bölüm sonunda' : o + ' dk');
    if (!o) return;
    const end = Date.now() + (+o || 0) * 60000, ch = R && R.active >= 0 && R.paras[R.active] ? R.paras[R.active].chap : -1;
    SL.t = setInterval(() => {
      if (!R) { clearInterval(SL.t); return; }
      if (o === 'bölüm' ? (R.active >= 0 && R.paras[R.active] && R.paras[R.active].chap !== ch) : Date.now() >= end) sleepEnd();
    }, 2000);
  });
  $('wClaude').addEventListener('click', () => { $('wSkip').click(); toast('Kitabı açınca üst çubuktaki “Claude ile tanımla” düğmesini kullan.'); });
  $('rRetry').addEventListener('click',() => { if (R) { retryAnalysis(R.entry); vToast('Gemini çözümlemesi yeniden deneniyor.', 2500); } });
  wireRibbon(); wireVoice();
}

/* ================= 6b. Sesli okuma =================
   Web Speech API (Chrome/Edge; ses Google sunucularında tanınır) + mikrofon ölçümü (getUserMedia + AnalyserNode).
   Sesle okunan paragraf, fare beklemesiyle aynı yoldan (setActive) etkin olur; müzik sahneye göre değişir.
   Sesin yüksekliği ve hızı müziğin enerjisini belirler (kararlı ve seyrek değişimle). */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const V = {on: false, rec: null, stream: null, actx: null, an: null, buf: null, meterT: 0, aligner: null, lastCursor: -1, backoff: 300, restartT: 0,
  fromVoice: false, autoT: 0, gate: null, dbS: -60, speakMs: 0, wordLog: [], words: 0, paras: new Set(), t0: 0, told: false, micDenied: false, netErr: 0};
let vToastT = null;
function vToast(msg, ms) {
  const t = $('rToast'); if (!t) return;
  t.textContent = msg || ''; clearTimeout(vToastT);
  if (msg) vToastT = setTimeout(() => { t.textContent = ''; }, ms || 4000);
}
function wireVoice() {
  const b = $('rMic');
  document.querySelectorAll('[data-bl]').forEach(x => x.addEventListener('click', () => setBookLang(x.dataset.bl)));
  if (!SR || !window.isSecureContext) {
    b.hidden = true;
    b.title = 'Sesli okuma bu tarayıcıda kullanılamıyor: Chrome ya da Edge ile localhost veya https üzerinden aç.';
    $('rVoiceHelp').textContent = b.title;
    return;
  }
  b.addEventListener('click', toggleVoice);
  document.querySelectorAll('.vlang [data-sl]').forEach(x => x.addEventListener('click', () => setSpeechLang(x.dataset.sl)));
}
/* Tanıma dili OKURUN dilidir (kitabın değil); profil başına saklanır. Varsayılan Türkçe, tarayıcı İngilizceyse İngilizce. */
function speechLang() {
  const l = P && P.speechLang;
  return l === 'en-US' || l === 'tr-TR' ? l : /^en/i.test(navigator.language || '') ? 'en-US' : 'tr-TR';
}
function syncLangUI() {
  syncBookLangUI();
  const l = speechLang();
  document.querySelectorAll('.vlang [data-sl]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sl === l)));
}
function setSpeechLang(l) {
  if (!P || l === speechLang()) { syncLangUI(); return; }
  P.speechLang = l; saveProfiles(); syncLangUI();
  if (V.on && R) { V.alignOn = alignPossible(); V.langNoted = false; noteLang(); if (V.alignOn) { V.aligner.seek(Math.max(0, R.active)); V.lastCursor = -1; } else underline(-1); restartRec(); }
  vToast('Konuşma dili: ' + (l === 'tr-TR' ? 'Türkçe' : 'İngilizce'), 2000);
}
// Hizalayıcı yalnızca konuşma dili kitabın diliyle aynıysa metni izleyebilir
const alignPossible = () => !!R && speechLang().slice(0, 2) === (R.entry.lang || 'tr');
function noteLang() {
  const n = $('npVNote');
  if (V.alignOn || !R) { n.hidden = true; return; }
  const ad = l => l === 'en' ? 'İngilizce' : 'Türkçe';
  n.textContent = 'Kitap ' + ad(R.entry.lang) + ', sen ' + ad(speechLang().slice(0, 2)) + ' konuşuyorsun: sayfa takibi kapalı; sesli komutlar ve sesine göre müzik çalışıyor. Kitabın dili yanlışsa “Kitap TR/EN” ile düzelt.';
  n.hidden = false;
}
function restartRec() {
  const old = V.rec; V.rec = null; clearTimeout(V.restartT);
  if (old) { try { old.abort(); } catch (e) { /* yok */ } }
  if (V.on) startRec();
}
// Sözcüklerin çoğu etkin paragraf çevresinde geçiyor mu (güveni bilinmeyen sonuçlar için)
function matchesText(words) {
  if (!V.alignOn || !R) return false;
  const ws = words.filter(w => w.length >= 3); if (!ws.length) return false;
  const a = Math.max(0, R.active), pool = new Set();
  for (let i = Math.max(0, a - 1); i <= Math.min(R.texts.length - 1, a + 3); i++) for (const w of Core.wordsOf(R.texts[i], R.entry.lang)) pool.add(w.slice(0, 5));
  return ws.filter(w => pool.has(w.slice(0, 5))).length / ws.length >= 0.5;
}
/* webkitSpeechRecognition'ı gösterip Google ses anahtarı olmayan tarayıcılar (Electron, Claude masaüstü içi tarayıcı,
   Chromium türevleri): tanıma her seferinde 'network' hatasıyla düşer. Yalnızca Chrome ve Edge gerçekten çalışır. */
function speechUnsupported() {
  const ua = navigator.userAgent || '';
  if (/Electron|Claude\//.test(ua)) return true;
  const b = navigator.userAgentData && navigator.userAgentData.brands;
  return !!(b && b.length && !b.some(x => /Google Chrome|Microsoft Edge/.test(x.brand)));
}
// Düğmeli kalıcı bildirim (okuma ekranının alt ortasında)
function vPrompt(msg, actions, ms) {
  const t = $('rToast'); if (!t) return;
  clearTimeout(vToastT); t.textContent = msg;
  const row = h('span', 'tb');
  for (const [label, fn, cls] of actions) { const b = h('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; b.addEventListener('click', fn); row.append(b); }
  const x = h('button', 'btn ghost', 'Kapat'); x.type = 'button'; x.addEventListener('click', () => vToast('')); row.append(x);
  t.append(row);
  vToastT = setTimeout(() => { t.textContent = ''; }, ms || 30000);
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch (e) { /* yedek */ }
  try { const ta = h('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
}
function toggleVoice() {
  if (V.on) { stopVoice(); return; }
  if (speechUnsupported() && !V.forceTry) {
    const url = location.origin + '/';
    vPrompt('Sesli takip bu tarayıcıda çalışmıyor. Sayfayı Google Chrome ya da Microsoft Edge’de aç: ' + url, [
      ['Bağlantıyı kopyala', async () => vToast(await copyText(url) ? 'Bağlantı kopyalandı: ' + url : 'Kopyalanamadı; adresi elle yaz: ' + url, 6000), 'brass'],
      ['Yine de dene', () => { V.forceTry = true; vToast(''); startVoice(); }]
    ]);
    return;
  }
  startVoice();
}
function setMicUI(on) {
  const b = $('rMic');
  b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
  b.setAttribute('aria-label', on ? 'Sesli okuma: dinlemeyi durdur' : 'Sesli okuma: dinlemeyi başlat');
  $('npVoice').hidden = !on; document.body.classList.toggle('listening', on);
}
const musicVol = () => clamp(set.vol * (V.on ? 0.5 : 1) * (T.on && !T.paused ? 0.35 : 1), 0, 1);   // dinlerken yarıya, sesli kitap konuşurken daha da kısılır
function applyVol() {
  try { MU_API.setVolume(musicVol()); } catch (e) { /* yok */ }
  if (MU.engine) MU.engine.volume(musicVol());
}
async function startVoice() {
  if (V.on || !R) return;
  V.on = true; setMicUI(true);
  Object.assign(V, {lastCursor: -1, backoff: 300, gate: new Core.VoiceGate({delta: 0.22, hold: 8000, gap: 20000}), dbS: -60, speakMs: 0, wordLog: [], words: 0, paras: new Set(), t0: Date.now(), netErr: 0});
  MU.voiceE = null;
  $('npHeardW').textContent = 'Dinliyorum…';
  if (!V.told) { V.told = true; vToast('Dinliyorum: yüksek sesle oku, sayfa ve müzik seni izler. Chrome sesi tanımak için Google sunucularına gönderir. “Müziği değiştir”, “sesi kıs” gibi komutları da anlarım.', 9000); }
  else vToast('Dinliyorum.', 1800);
  // Mikrofon bir kez istenir ve yeniden kullanılır; reddedilirse yalnızca ses tanıma ile sürer.
  if (!V.stream && !V.micDenied && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try { V.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: false}}); }
    catch (e) {
      if (e && e.name === 'NotFoundError') { stopVoice('Mikrofon bulunamadı. Bir mikrofon bağlayıp yeniden dene.'); return; }
      V.micDenied = true;
      vToast('Mikrofon ölçümüne izin verilmedi; ses düzeyi olmadan, yalnızca tanıma ile dinliyorum.', 6000);
    }
  }
  if (!V.on || !R) return;
  if (V.stream) { V.stream.getTracks().forEach(t => { t.enabled = true; }); startMeter(); }
  V.aligner = new Core.Aligner(R.texts, R.entry.lang);
  V.aligner.seek(Math.max(0, R.active));
  V.alignOn = alignPossible(); V.langNoted = false; noteLang(); syncLangUI();
  applyVol();
  if (MU.mode === 'engine' && MU.engine) commitScene(Math.max(0, R.active));
  startRec();
}
function startRec() {
  const rec = new SR();
  rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.lang = speechLang();   // okurun dili; kitap İngilizce olsa da Türkçe konuşan Türkçe tanınır
  rec.onresult = onVoiceResult;
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopVoice('Mikrofon izni verilmedi. Adres çubuğundaki mikrofon simgesinden izin verip yeniden dene.');
    else if (e.error === 'audio-capture') stopVoice('Mikrofon bulunamadı. Bir mikrofon bağlayıp yeniden dene.');
    else if (e.error === 'network' && ++V.netErr >= 3) stopVoice(speechUnsupported()
      ? 'Sesli takip bu tarayıcıda çalışmıyor (Google ses tanıma yok). Sayfayı Google Chrome ya da Microsoft Edge’de aç: ' + location.origin + '/'
      : 'Ağ hatası: ses tanıma Google sunucularına ulaşamadı. Olası nedenler: bir VPN, güvenlik duvarı ya da reklam engelleyici Google ses servislerini engelliyor olabilir ya da internet bağlantın kopmuş olabilir.');
    else if (e.error === 'language-not-supported') stopVoice('Bu dil ses tanımada desteklenmiyor.');
  };
  // Tanıyıcı sessizlikte kendiliğinden kapanır: geri çekilmeyle yeniden başlat
  rec.onend = () => {
    if (!V.on || V.rec !== rec) return;
    clearTimeout(V.restartT);
    V.restartT = setTimeout(() => { if (V.on && V.rec === rec) { try { rec.start(); } catch (e) { /* zaten açık */ } } }, V.backoff);
    V.backoff = Math.min(5000, V.backoff * 1.7);
  };
  V.rec = rec;
  try { rec.start(); } catch (e) { stopVoice('Dinleme başlatılamadı. Yeniden dene.'); }
}
function onVoiceResult(e) {
  if (!V.on || !V.aligner) return;
  V.backoff = 300; V.netErr = 0;
  let shown = '';
  const lang = speechLang().slice(0, 2);
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i], txt = r[0].transcript, fin = r.isFinal, conf = +r[0].confidence || 0;
    const c = Core.voiceCommand(txt);
    const read = c.cmd ? c.rest : txt;                    // komut hizalamaya gitmez
    const words = Core.wordsOf(read, lang);
    if (fin) {
      // Güven < 0.4 ise yok say; Chrome bazı kesin sonuçlarda 0 verir: bilinmiyor say, yalnızca komut ya da metinle örtüşüyorsa kabul et
      const fits = conf === 0 ? (c.cmd ? 'cmd' : matchesText(words) ? 'text' : '') : conf >= 0.4 ? 'ok' : '';
      if (!fits || fits === 'cmd') { if (V.alignOn) V.aligner.feed('', true); }   // ara sonuç durumunu sıfırla
      if (!fits) continue;
      if (c.cmd) voiceCmd(c.cmd);
      if (V.alignOn && fits !== 'cmd') V.aligner.feed(read, true);
      if (fits !== 'cmd') { V.words += words.length; V.wordLog.push([Date.now(), words.length]); }
      shown = txt;
    } else {
      if (V.alignOn && matchesText(words)) V.aligner.feed(read, false);   // ara sonuç: yalnızca metne uyuyorsa
      if (conf >= 0.6) shown = txt;                                       // vahşi tahminler gösterilmez
    }
  }
  if (shown) $('npHeardW').textContent = '“' + shown.trim().split(/\s+/).slice(-9).join(' ') + '”';
  if (V.alignOn) voiceFollow();
}
function voiceCmd(cmd) {
  if (!R) return;
  if (cmd === 'next') { vToast('Müzik değişiyor.', 2200); otherTrack(); }
  else if (cmd === 'stop') { if (isPlaying() || MU.want) togglePlay(); vToast('Müzik durdu.', 2200); }
  else if (cmd === 'play') { if (!isPlaying()) togglePlay(); vToast('Müzik başlıyor.', 2200); }
  else if (cmd === 'up' || cmd === 'down') {
    set.vol = clamp(+(set.vol + (cmd === 'up' ? 0.15 : -0.15)).toFixed(2), 0, 1); saveSet();
    $('npVol').value = set.vol; applyVol();
    vToast('Ses ' + (cmd === 'up' ? 'açıldı' : 'kısıldı') + ': %' + Math.round(set.vol * 100), 2200);
  }
}
function voiceFollow() {
  const A = V.aligner; if (!A || !R || A.cursor === V.lastCursor) return;
  V.lastCursor = A.cursor;
  const pi = A.paraIndex; if (!R.paras[pi]) return;
  V.paras.add(pi);
  if (pi !== R.active) { clearTimeout(dwellT); V.fromVoice = true; try { setActive(pi); } finally { V.fromVoice = false; } }   // fare beklemesiyle aynı yol
  underline(pi, A.wordInPara);
  // Okunan satırı okuma çizgisinin yakınında tut (yumuşak, küçük adımlarla)
  const r = R.paras[pi].el.getBoundingClientRect(), y = r.top + r.height * A.frac, d = y - readingLineY();
  if (Math.abs(d) > 56) { V.autoT = performance.now(); sc().scrollBy({top: d * 0.8, behavior: reduced.matches ? 'auto' : 'smooth'}); }
}
// Yalnızca etkin paragrafta okunan kelimelerin altını çiz (CSS Custom Highlight API; DOM'a dokunmaz)
function underline(pi, n) {
  if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  if (pi < 0 || !n || !R || !R.paras[pi]) { CSS.highlights.delete('sa-said'); return; }
  const node = R.paras[pi].el.firstChild; if (!node || node.nodeType !== 3) return;
  const toks = Core.tokenize(R.texts[pi], R.entry.lang).filter(t => !t.p).slice(0, n), ranges = [];
  for (const t of toks) { if (t.i + t.len > node.length) break; const rg = new Range(); rg.setStart(node, t.i); rg.setEnd(node, t.i + t.len); ranges.push(rg); }
  CSS.highlights.set('sa-said', new Highlight(...ranges));
}
// Ses düzeyi ölçümü + sesin enerjisi → müzik
function startMeter() {
  try {
    V.actx = V.actx || new (window.AudioContext || window.webkitAudioContext)();
    if (V.actx.state === 'suspended') V.actx.resume().catch(() => {});
    if (!V.an) { V.an = V.actx.createAnalyser(); V.an.fftSize = 1024; V.actx.createMediaStreamSource(V.stream).connect(V.an); V.buf = new Float32Array(V.an.fftSize); }
  } catch (e) { V.an = null; return; }
  let k = 0;
  clearInterval(V.meterT);
  V.meterT = setInterval(() => {
    if (!V.on || !V.an) return;
    V.an.getFloatTimeDomainData(V.buf);
    let s = 0; for (let i = 0; i < V.buf.length; i++) s += V.buf[i] * V.buf[i];
    const db = 20 * Math.log10(Math.sqrt(s / V.buf.length) + 1e-9);
    $('npVu').style.width = Math.round(clamp((db + 60) / 50, 0, 1) * 100) + '%';
    if (db > -48) { V.speakMs += 100; V.dbS = V.dbS < -55 ? db : V.dbS * 0.92 + db * 0.08; }
    if (++k % 10 === 0) voiceEnergyTick();
  }, 100);
}
function voiceWpm() {
  const now = Date.now(), win = 30000; V.wordLog = V.wordLog.filter(x => now - x[0] < win);
  const n = V.wordLog.reduce((a, x) => a + x[1], 0), span = Math.min(win, now - V.t0);
  return span > 8000 ? n / (span / 60000) : 0;
}
function voiceEnergyTick() {
  if (!V.on || !R || Date.now() - V.t0 < 8000) return;
  const e = Core.voiceEnergy(V.an ? V.dbS : -35, voiceWpm());
  const g = V.gate.push(e, Date.now());
  if (g == null) return;
  const was = MU.voiceE; MU.voiceE = g;
  if (was == null && Math.abs(g - effInfo(Math.max(0, R.active)).energy) < 0.15) return;
  note(g >= 0.55 ? 'Sesin hızlandı ve güçlendi; müziği ona göre canlandırıyorum.' : 'Sakin ve yavaş okuyorsun; müziği ona göre yumuşatıyorum.');
  if (!MU.locked) { R.curScene = null; commitScene(Math.max(0, R.active)); }
}
// Kitap kapanınca mikrofonu tamamen bırak (tarayıcının kayıt göstergesi sönsün)
function releaseMic() {
  if (V.stream) V.stream.getTracks().forEach(t => t.stop());
  V.stream = null; V.an = null;
  if (V.actx) { V.actx.close().catch(() => {}); V.actx = null; }
}
// Bir kez çağrılabilir; neden verilirse (hata) özet yerine o gösterilir
function stopVoice(reason) {
  if (!V.on) { if (reason) vToast(reason, 8000); return; }
  V.on = false; setMicUI(false);
  clearTimeout(V.restartT); clearInterval(V.meterT);
  if (V.stream) V.stream.getTracks().forEach(t => { t.enabled = false; });
  const rec = V.rec; V.rec = null; if (rec) { try { rec.abort(); } catch (e) { /* yok */ } }
  underline(-1); $('npVu').style.width = '0';
  const mins = (Date.now() - V.t0) / 60000, speakMin = V.speakMs / 60000, pace = V.words / Math.max(0.25, V.an ? Math.max(speakMin, mins * 0.3) : mins);
  const voiceE = MU.voiceE; MU.voiceE = null;
  applyVol();
  if (R && voiceE != null && !MU.locked) { R.curScene = null; commitScene(Math.max(0, R.active)); }
  if (reason) { vToast(reason, 9000); return; }
  // Sesli okuma özeti
  if (V.words >= 5) vToast('Sesli okuma özeti: ' + (mins < 1 ? Math.max(1, Math.round(mins * 60)) + ' sn' : Math.round(mins) + ' dk') + ' sesli okudun · ' +
    V.paras.size + ' paragraf · ortalama ' + Math.round(pace) + ' kelime/dk.', 9000);
  if (V.words >= 5) coachCard(mins, pace);
  else vToast('Dinleme kapandı.', 2500);
}
let lastPtrR = 'mouse';

/* ================= 7. Müzik bağlantısı ================= */
const MU = {mode: 'engine', want: false, state: 'idle', track: null, pending: null, locked: false, force: '', engine: null, actx: null, token: 0, t: null, ytFailed: false};
const useYT = () => !!MU_API.available && !MU.ytFailed;
function primeAudio() { if (!useYT()) ensureEngine(); }
function ensureEngine() {
  if (MU.engine) return MU.engine;
  if (!window.Engine) return null;
  try {
    MU.actx = MU.actx || new (window.AudioContext || window.webkitAudioContext)();
    MU.engine = Engine.create(MU.actx, {seed: 1 + Math.floor(Math.random() * 1e6), tonic: Core.tonicFor(R ? R.entry.title : '').midi, volume: musicVol(), small: innerWidth < 700});
    MU.engine.onMood = m => { if (MU.mode === 'engine' && R) renderEngineNow(M[m]); };
  } catch (e) { MU.engine = null; }
  return MU.engine;
}
function note(msg) { const n = $('npNote'); n.textContent = msg || ''; n.hidden = !msg; }
function setupMusic() {
  MU.mode = useYT() ? 'yt' : 'engine'; MU.locked = false; MU.force = ''; MU.pending = null; MU.track = null; MU.state = 'idle';
  $('npLock').setAttribute('aria-pressed', 'false'); $('npMood').value = '';
  $('np').classList.toggle('engine', MU.mode === 'engine');
  $('npEngine').hidden = MU.mode !== 'engine';
  note(MU.mode === 'engine' ? 'Çevrim içi müzik şu an kullanılamıyor; müziği bu tarayıcıda yerleşik besteci üretiyor.' : '');
  if (MU.mode === 'engine') { const e = ensureEngine(); if (e) e.tonic(Core.tonicFor(R.entry.title).midi); renderEngineNow(infoFor(Math.max(0, R.active)).mood); }
  else renderNow(null, 'idle');
  MU.want = !!set.autoplay;
  commitScene(Math.max(0, R.active));
  renderPlay();
}
function stopMusic() {
  clearTimeout(MU.t); MU.token++; MU.want = false;
  if (MU.engine && MU.engine.playing) MU.engine.stop();
  if (MU.mode === 'yt') Promise.resolve().then(() => MU_API.pause()).catch(() => {});
}
function effInfo(i) {
  const inf = MU.force ? {mood: MU.force, energy: 0.6, query: MOOD_EN[MU.force] + ' instrumental', scene: 'F:' + MU.force, sceneText: '', source: 'manual', amb: null} : infoFor(i);
  if (MU.voiceE == null) return inf;
  // Sesli okuma: enerjiyi okurun sesine yaklaştır; enerji kademesi sahne anahtarına girer ki parça yeniden seçilsin
  const b = '|v' + Math.round(MU.voiceE * 3);
  return Object.assign({}, inf, {energy: +(0.4 * inf.energy + 0.6 * MU.voiceE).toFixed(2), scene: inf.scene + b, sceneText: inf.sceneText !== '' && inf.sceneText != null ? inf.sceneText + b : ''});
}
function scheduleScene(i) {
  if (MU.locked || !R) return;
  clearTimeout(MU.t);
  MU.t = setTimeout(() => commitScene(i), 900);
}
function startEngine() {
  const e = ensureEngine(); if (!e) return;
  e.volume(musicVol());
  e.start().then(renderPlay).catch(() => note('Ses başlatılamadı. Sayfaya bir kez dokunup yeniden dene.'));
}
async function commitScene(i) {
  if (!R || i < 0) return;
  const inf = effInfo(i); renderScene(inf);
  if (MU.mode === 'engine') {
    const e = ensureEngine(); if (!e) { note('Bu tarayıcı sesi desteklemiyor.'); return; }
    e.set({mood: M.indexOf(inf.mood), neutral: !!inf.neutral, intensity: inf.energy, confidence: 0.7, ambience: inf.amb ? [inf.amb] : [], browsing: false, idle: false, mic: V.on});
    if (MU.want && !e.playing) startEngine();
    return;
  }
  if (inf.scene === R.curScene) return;
  R.curScene = inf.scene;
  const tok = ++MU.token;
  let tr = R.sceneTracks.get(inf.scene);
  if (!tr) {
    try { tr = await MU_API.pick({mood: inf.mood, energy: inf.energy, query: inf.query, scene: inf.sceneText || inf.scene}); }
    catch (err) { if (tok === MU.token) ytFail(); return; }
    if (!tr || !R) return;
    R.sceneTracks.set(inf.scene, tr);
  }
  if (tok !== MU.token || !R) return;
  if (MU.want) { MU.pending = null; ytPlay(tr, 3); }
  else { MU.pending = tr; renderNow(tr, 'ready'); }
}
function ytFail() {
  MU.ytFailed = true; MU.mode = 'engine';
  $('np').classList.add('engine'); $('npEngine').hidden = false;
  note('Çevrim içi müzik bulunamadı; yerleşik besteciye geçtim. Yeniden denemek için kitabı kapatıp aç.');
  renderEngineNow(effInfo(Math.max(0, R.active)).mood);
  commitScene(Math.max(0, R.active));
}
function isPlaying() { return MU.mode === 'engine' ? !!(MU.engine && MU.engine.playing) : MU.state === 'playing' || MU.state === 'buffering' || MU.state === 'loading'; }
function togglePlay() {
  if (!R) return;
  if (MU.mode === 'engine') {
    const e = ensureEngine(); if (!e) return;
    if (e.playing) { e.stop(); MU.want = false; renderPlay(); }
    else { MU.want = true; commitScene(Math.max(0, R.active)); if (!e.playing) startEngine(); }
    setTimeout(renderPlay, 60); return;
  }
  if (isPlaying()) { MU.want = false; Promise.resolve().then(() => MU_API.pause()).catch(() => {}); }
  else {
    MU.want = true;
    if (MU.pending) { const t = MU.pending; MU.pending = null; ytPlay(t, 2); }
    else if (MU.track) Promise.resolve().then(() => MU_API.resume()).catch(() => {});
    else { R.curScene = null; commitScene(Math.max(0, R.active)); }
  }
  renderPlay();
}
async function otherTrack() {
  if (!R) return;
  const i = Math.max(0, R.active);
  if (MU.mode === 'engine') {
    const was = MU.engine && MU.engine.playing;
    if (MU.engine) MU.engine.stop();
    MU.engine = null; ensureEngine();
    if (MU.engine) MU.engine.tonic(Core.tonicFor(R.entry.title + Math.random()).midi);
    MU.want = true; commitScene(i); if (!was) startEngine();
    note('Aynı hava, yeni bir çeşitleme.'); return;
  }
  const inf = effInfo(i), old = R.sceneTracks.get(inf.scene) || MU.track, tok = ++MU.token, btn = $('npOther');
  btn.disabled = true; note('Bu paragrafa başka bir parça aranıyor…');
  let tr = null;
  try {
    for (let k = 0; k < 3; k++) { tr = await MU_API.pick({mood: inf.mood, energy: inf.energy, query: inf.query, scene: (inf.sceneText || inf.scene) + '#' + (++altN)}); if (!tr || !old || tr.vid !== old.vid) break; }
  } catch (e) { tr = null; }
  btn.disabled = false;
  if (tok !== MU.token || !R) return;
  if (!tr || (old && tr.vid === old.vid)) { note('Bu sahne için başka parça bulunamadı.'); return; }
  note('');
  R.sceneTracks.set(inf.scene, tr); R.curScene = inf.scene; MU.want = true; MU.pending = null;
  ytPlay(tr, 2.5);
}
let altN = 0;
function ytPlay(tr, fade) {
  return Promise.resolve().then(() => MU_API.play(tr, {fadeSec: fade})).catch(() => {
    if (!MU_API.available) ytFail(); else note('Bu parça çalınamadı. “Başka müzik bul” ile değiştirebilirsin.');
  });
}
function onMusicChange(ev) {
  if (!ev) return;
  if (ev.state) MU.state = ev.state;
  if (ev.track) MU.track = ev.track;
  if (MU.mode !== 'yt' || !R) return;
  renderNow(MU.track, MU.state); renderPlay();
  if (MU.state === 'playing' && MU.track) addHeard(MU.track);
  if (MU.state === 'error') note('Bu parça çalınamadı. “Başka müzik bul” ile değiştirebilirsin.');
}
const STATE_TR = {playing: 'çalıyor', paused: 'duraklatıldı', loading: 'yükleniyor', buffering: 'yükleniyor', ended: 'bitti', ready: 'sırada', idle: '', error: 'çalınamadı'};
/* Müzik beğenisi: profil başına {duygu: {vid: 1|-1}}; SA_Music.pick beğenileni öne alır, beğenilmeyeni o duyguda atlar */
const mPrefKey = () => 'mprefs:' + (P ? P.id : '');
function loadMusicPrefs() { try { MU_API.setPrefs && MU_API.setPrefs(LS.get(mPrefKey(), {})); } catch (e) { /* yok */ } }
function rateMood() { return R ? effInfo(Math.max(0, R.active)).mood : (MU.track && MU.track.moods && MU.track.moods[0]); }
function renderRate() {
  const t = MU.mode === 'yt' ? MU.track : null, up = $('npLike'), dn = $('npDislike'); if (!up) return;
  up.hidden = dn.hidden = !(t && t.vid);
  const v = t && MU_API.prefOf ? MU_API.prefOf(t.vid, rateMood()) : 0;
  up.setAttribute('aria-pressed', String(v > 0)); dn.setAttribute('aria-pressed', String(v < 0));
}
function rateTrack(v) {
  const t = MU.track; if (!t || !t.vid || !MU_API.rate) return;
  const mood = rateMood(), cur = MU_API.prefOf(t.vid, mood);
  const nv = cur === v ? 0 : v;
  LS.set(mPrefKey(), MU_API.rate(t, mood, nv));
  renderRate();
  if (nv === 1) note('Beğenildi: ' + moodName(mood) + ' sahnelerinde bu parça öne çıkacak.');
  else if (nv === -1) { const m = 'Bir daha ' + moodName(mood) + ' sahnelerinde çalınmayacak.'; note(m); if (R && !MU.locked) otherTrack().then(() => { if (!$('npNote').textContent) note(m); }, () => {}); }
  else note('');
}
function renderNow(t, state) {
  renderRate();
  $('npTitle').textContent = t ? t.title || 'Adsız parça' : 'Henüz parça yok';
  $('npArtist').textContent = t ? (t.artist || '') + (STATE_TR[state] ? ' · ' + STATE_TR[state] : '') : (MU.want ? 'Sahneye uygun parça aranıyor…' : 'Oynat düğmesine bas; müzik paragrafı izler.');
  $('npCredit').textContent = t ? [t.license ? 'Lisans: ' + t.license : '', t.credit || ''].filter(Boolean).join(' · ') || 'Lisans bilgisi bekleniyor.' : '';
}
function renderEngineNow(m) {
  $('npTitle').textContent = 'Yerleşik besteci · ' + moodName(m);
  $('npArtist').textContent = 'Satır Arası' + (MU.engine && MU.engine.playing ? ' · çalıyor' : '');
  $('npCredit').textContent = 'Bu tarayıcıda anlık üretilir; ses dosyası ya da telif yok.';
}
function renderScene(inf) {
  const s = $('npScene'); s.textContent = '';
  const dot = h('i'); s.append(dot, moodName(inf.mood) + ' · ' + (inf.source === 'gemini' ? 'Gemini' : inf.source === 'manual' ? 'elle' : 'yerel'));
  s.title = inf.sceneText ? 'Sahne: ' + inf.sceneText : '';
  if (MU.mode === 'engine' && !MU.engine) renderEngineNow(inf.mood);
}
function renderPlay() {
  const on = isPlaying() || (MU.mode === 'yt' && MU.want && !MU.pending && MU.state !== 'paused');
  $('npPlayUse').setAttribute('href', on ? '#i-pause' : '#i-play');
  $('npPlay').setAttribute('aria-label', on ? 'Müziği duraklat' : 'Müziği başlat');
  $('npPlay').setAttribute('aria-pressed', String(on));
  if (MU.mode === 'engine' && R) renderEngineNow(effInfo(Math.max(0, R.active)).mood);
}
const heardKey = () => 'heard:' + P.id + ':' + R.entry.id;
function addHeard(t) {
  if (!t || !t.vid || !R) return;
  const L = LS.get(heardKey(), []); if (L.some(x => x.vid === t.vid)) return;
  L.push({vid: t.vid, title: t.title, artist: t.artist, license: t.license, credit: t.credit, mood: effInfo(Math.max(0, R.active)).mood, at: Date.now()});
  LS.set(heardKey(), L.slice(-60)); renderHeard();
}
function renderHeard() {
  const L = R ? LS.get(heardKey(), []) : [], ol = $('npHeardList'); ol.textContent = '';
  $('npHeardN').textContent = L.length ? '(' + L.length + ')' : '';
  const ids = L.map(x => x.vid).filter(v => /^[\w-]{11}$/.test(v)).slice(-50);
  $('npShare').hidden = !ids.length;
  if (ids.length) $('npYtList').href = 'https://www.youtube.com/watch_videos?video_ids=' + ids.join(',');
  if (!L.length) { ol.append(h('li', null, MU_API.available ? 'Dinlediğin parçalar ve lisansları burada birikir.' : 'Yerleşik besteci kayıt tutmaz; çevrim içi parçalar burada listelenir.')); return; }
  for (const t of L.slice().reverse()) {
    const li = h('li'); li.append(h('b', null, t.title || 'Adsız'), ' · ' + (t.artist || ''));
    li.append(h('span', null, [moodName(t.mood), t.license, t.credit].filter(Boolean).join(' · ')));
    ol.append(li);
  }
}
/* Kitap kartı: kapak, başlık, duygu barkodu, en son dinlenen 3 parça (lisans/emeğiyle) → PNG */
async function soundtrackCard() {
  if (!R) return;
  const e = R.entry, L = LS.get(heardKey(), []).slice(-3).reverse();
  const W = 1080, H = 1350, cv = h('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#1d1a17'); grd.addColorStop(1, '#2c2620'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const src = e.cover || (/^\d+$/.test(String(e.gid || '')) ? 'assets/covers/' + e.gid + '.jpg' : null);
  const img = src ? await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }) : null;
  const cx = 80, cy = 120, cw = 360, ch = 540;
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
  g.fillStyle = coverColors(e.title || '').cv; g.fillRect(cx, cy, cw, ch); g.restore();
  if (img) { const r = Math.max(cw / img.width, ch / img.height), iw = img.width * r, ih = img.height * r; g.save(); g.beginPath(); g.rect(cx, cy, cw, ch); g.clip(); g.drawImage(img, cx + (cw - iw) / 2, cy + (ch - ih) / 2, iw, ih); g.restore(); }
  g.fillStyle = '#c8a45a'; g.font = '500 28px Georgia, serif'; g.fillText('SATIR ARASI · KİTABIN MÜZİKLERİ', 80, 80);
  const wrap = (txt, x, y, w, lh, max) => { const ws = String(txt).split(/\s+/); let line = '', n = 0; for (const w2 of ws) { const t = line ? line + ' ' + w2 : w2; if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += lh; line = w2; if (++n >= max - 1) { line += '…'; break; } } else line = t; } g.fillText(line, x, y); return y + lh; };
  g.fillStyle = '#f3ead8'; g.font = 'italic 600 58px Georgia, serif';
  let y = wrap(e.title || 'Adsız', 490, 190, 510, 66, 4);
  g.fillStyle = '#b9ad98'; g.font = '400 32px Georgia, serif'; if (e.author) y = wrap(e.author, 490, y + 6, 510, 40, 2);
  const bar = e.bar || '', bx = 80, by = 720, bw = W - 160, bh = 70;
  // Sağ sütun: baskın duygular (barkoddan) — kapak yanındaki boşluğu doldurur
  if (bar.length) {
    const cnt = {}; for (const c of bar) { const m = M[+c]; if (m) cnt[m] = (cnt[m] || 0) + 1; }
    let yy = Math.max(y + 40, 420);
    g.fillStyle = '#c8a45a'; g.font = '500 24px Georgia, serif'; g.fillText('BASKIN DUYGULAR', 490, yy); yy += 52;
    for (const [m, n] of Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      if (yy > cy + ch - 10) break;
      const pc = Math.round(n / bar.length * 100);
      g.fillStyle = MOOD_COL[m] || BRASS; g.fillRect(490, yy - 22, Math.max(8, 300 * pc / 100), 26);
      g.fillStyle = '#e9dfca'; g.font = '400 30px Georgia, serif'; g.fillText(moodName(m) + ' %' + pc, 490 + Math.max(8, 300 * pc / 100) + 18, yy);
      yy += 50;
    }
  }
  // Duygu barkodu (kitabın baştan sona duygu akışı)
  g.fillStyle = '#c8a45a'; g.font = '500 24px Georgia, serif'; g.fillText('DUYGU BARKODU', bx, by - 18);
  if (bar.length) for (let i = 0; i < bar.length; i++) { g.fillStyle = MOOD_COL[M[+bar[i]]] || BRASS; g.fillRect(bx + i * bw / bar.length, by, Math.ceil(bw / bar.length), bh); }
  else { g.fillStyle = '#3a332b'; g.fillRect(bx, by, bw, bh); }
  g.fillStyle = '#c8a45a'; g.font = '500 24px Georgia, serif'; g.fillText('PARÇALAR', 80, 870);
  y = 920;
  for (const t of L) {
    g.fillStyle = MOOD_COL[t.mood] || BRASS; g.beginPath(); g.arc(92, y - 12, 9, 0, 6.283); g.fill();
    g.fillStyle = '#f3ead8'; g.font = '600 36px Georgia, serif'; y = wrap((t.title || 'Adsız') + (t.artist ? ' — ' + t.artist : ''), 116, y, W - 196, 42, 2);
    g.fillStyle = '#9d927f'; g.font = '400 24px Georgia, serif'; y = wrap([moodName(t.mood), t.license, ((t.credit || '').match(/\(([^()]+)\)[^()]*$/) || [])[1]].filter(Boolean).join(' · '), 116, y - 6, W - 196, 30, 2) + 22;
  }
  g.fillStyle = '#6f675a'; g.font = '400 22px Georgia, serif'; g.fillText('Müzikler YouTube’dan; haklar sahiplerine aittir.', 80, H - 60);
  cv.toBlob(b => { if (!b) return; const a = h('a'); a.href = URL.createObjectURL(b); a.download = (e.title || 'kitap').replace(/[\\/:*?"<>|]+/g, '').slice(0, 50) + ' - müzikler.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
}
function wireMusic() {
  $('npCard').addEventListener('click', () => soundtrackCard().catch(() => toast('Kart oluşturulamadı.')));
  const sel = $('npMood'); sel.append(new Option('Otomatik', ''));
  for (const m of M) sel.append(new Option(moodName(m), m));
  sel.addEventListener('change', () => { MU.force = sel.value; if (R) { R.curScene = null; commitScene(Math.max(0, R.active)); } });
  $('npPlay').addEventListener('click', togglePlay);
  // Telefon: alt sayfa (varsayılan kapalı ince çubuk). Oynatıcı DOM'da ve görünür kalır, yalnızca sayfa aşağı kaydırılır.
  $('npBarPlay').addEventListener('click', togglePlay);
  const npSheet = (open) => { $('np').classList.toggle('np-open', open); const x = $('npBarX'); x.setAttribute('aria-expanded', String(open)); x.setAttribute('aria-label', open ? 'Oynatıcıyı küçült' : 'Oynatıcıyı aç'); };
  $('npBarX').addEventListener('click', (e) => { e.stopPropagation(); npSheet(!$('np').classList.contains('np-open')); });
  $('npBarTitle').addEventListener('click', () => npSheet(!$('np').classList.contains('np-open')));
  new MutationObserver(() => { $('npBarTitle').textContent = $('npTitle').textContent; }).observe($('npTitle'), { childList: true, characterData: true, subtree: true });
  const npSync = (el, a, v) => { if (v != null && el.getAttribute(a) !== v) el.setAttribute(a, v); };
  new MutationObserver(() => { const p = $('npPlay'), b = $('npBarPlay'); npSync(b, 'aria-pressed', p.getAttribute('aria-pressed')); npSync(b, 'aria-label', p.getAttribute('aria-label')); npSync($('npBarPlayUse'), 'href', $('npPlayUse').getAttribute('href')); }).observe($('np'), { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'href'] });
  $('npOther').addEventListener('click', otherTrack);
  $('npLike').addEventListener('click', () => rateTrack(1));
  $('npDislike').addEventListener('click', () => rateTrack(-1));
  $('npLock').addEventListener('click', () => {
    MU.locked = !MU.locked; const b = $('npLock');
    b.setAttribute('aria-pressed', String(MU.locked));
    b.setAttribute('aria-label', MU.locked ? 'Müzik sabit; serbest bırak' : 'Müziği sabitle');
    note(MU.locked ? 'Müzik sabitlendi: sahne değişse de parça değişmez.' : '');
    if (!MU.locked && R) scheduleScene(R.active);
  });
  $('npVol').addEventListener('input', e => {
    set.vol = +e.target.value; saveSet(); applyVol();
  });
  try { MU_API.onChange(onMusicChange); } catch (e) { /* yok */ }
}

/* ================= 8. Açılış ================= */
function wireMenu() {
  wireRow($('rowMine')); wireRow($('rowRec'));
  $('scene').addEventListener('scroll', e => { if (!compactMq.matches) { e.target.scrollTop = 0; e.target.scrollLeft = 0; } });
  $('scr-menu').addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    BG.tx = (e.clientX / innerWidth) * 2 - 1; BG.ty = (e.clientY / innerHeight) * 2 - 1;
  });
  $('mSurprise').addEventListener('click', openSurprise);
  $('mAddTop').addEventListener('click', () => $('dlgAdd').showModal());
  $('mProfile').addEventListener('click', openProfile);
  $('addFile').addEventListener('click', () => { $('dlgAdd').close(); $('fileIn').click(); });
  $('addPaste').addEventListener('click', openPaste);
  $('fileIn').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) importFiles(f); });
  $('pasteForm').addEventListener('submit', e => { if (e.submitter && e.submitter.value === 'ok') { e.preventDefault(); submitPaste(); } });
  $('pfEdit').addEventListener('click', () => { $('dlgProfile').close(); openWelcome('edit'); });
  $('pfSwitch').addEventListener('click', () => { $('dlgProfile').close(); saveLib(); openWelcome(); });
  $('pfOut').addEventListener('click', () => { $('dlgProfile').close(); signOut(); });
  $('pfDel').addEventListener('click', () => { $('dlgProfile').close(); deleteProfile(P); });
  /* Sürükle-bırak: her yerde (giriş ekranı dışında) */
  let depth = 0;
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (!hasFiles(e) || !P || document.body.dataset.screen === 'welcome') return; e.preventDefault(); depth++; $('drop').hidden = false; });
  addEventListener('dragover', e => { if (hasFiles(e) && P) e.preventDefault(); });
  addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) $('drop').hidden = true; });
  addEventListener('drop', e => {
    if (!hasFiles(e)) return; e.preventDefault(); depth = 0; $('drop').hidden = true;
    if (!P || document.body.dataset.screen === 'welcome') return;
    const files = [...e.dataTransfer.files]; if (files.length) importFiles(files);
  });
  /* Menüde doğrudan yapıştırma */
  document.addEventListener('paste', e => {
    if (document.body.dataset.screen !== 'menu' || document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const t = e.clipboardData && e.clipboardData.getData('text'); if (t && t.trim().length > 200) { e.preventDefault(); openPaste(t); }
  });
}
/* ================= 8b. Sesli kitap (tarayıcının speechSynthesis'i; çevrimdışı, anahtarsız) =================
   Okunan paragraf etkin olur (fare beklemesiyle aynı yol → müzik hikâyeyi izler), okunan sözcük CSS Highlight ile çizilir, müzik konuşurken kısılır. */
const T = {on: false, paused: false, rate: 1, i: -1, gen: 0, autoT: 0, self: false, bar: null};
try { T.rate = clamp(+localStorage.getItem('sa-tts-rate') || 1, 0.6, 2); } catch (e) { /* yok */ }
const ttsOK = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
function ttsVoice(lang) {
  const vs = speechSynthesis.getVoices(), L = (lang || 'tr').slice(0, 2).toLowerCase();
  const mine = vs.filter(v => (v.lang || '').toLowerCase().startsWith(L));
  return mine.find(v => v.localService && v.default) || mine.find(v => v.localService) || mine[0] || null;
}
function ttsChunks(t) {   // Chrome uzun cümlede susabiliyor: ≤ 220 karakterlik cümle parçaları, metin içi konumlarıyla
  const out = [], re = /[^.!?…;:]+[.!?…;:]*[”"»’)]*\s*/g; let m;
  while ((m = re.exec(t))) {
    let s = m[0], at = m.index;
    while (s.length > 220) { let cut = s.lastIndexOf(' ', 220); if (cut < 60) cut = 220; out.push({at, s: s.slice(0, cut)}); at += cut; s = s.slice(cut); }
    if (s.trim()) out.push({at, s});
    if (!m[0]) re.lastIndex++;
  }
  return out;
}
function ttsMark(i, a, b) {
  if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  if (i < 0 || !R || !R.paras[i]) { CSS.highlights.delete('sa-tts'); return; }
  const node = R.paras[i].el.firstChild; if (!node || node.nodeType !== 3 || b > node.length || b <= a) return;
  const rg = new Range(); rg.setStart(node, a); rg.setEnd(node, b); CSS.highlights.set('sa-tts', new Highlight(rg));
}
function ttsSpeak(i) {
  if (!R || !T.on) return;
  if (i >= R.paras.length) { ttsStop(); toast('Kitabın sonuna geldin.'); return; }
  const g = ++T.gen; T.i = i; speechSynthesis.cancel();
  if (i !== R.active) { T.self = true; T.autoT = performance.now(); clearTimeout(dwellT); Promise.resolve(jumpTo(i)).finally(() => { T.self = false; }); }
  const text = R.texts[i] || '', parts = ttsChunks(text), v = ttsVoice(R.entry.lang);
  if (!parts.length) { setTimeout(() => g === T.gen && ttsSpeak(i + 1), 50); return; }
  let k = 0;
  const next = () => {
    if (g !== T.gen || !T.on) return;
    if (k >= parts.length) { ttsMark(-1); ttsSpeak(i + 1); return; }
    const p = parts[k++], u = new SpeechSynthesisUtterance(p.s);
    if (v) u.voice = v; u.lang = v ? v.lang : (R.entry.lang === 'en' ? 'en-US' : 'tr-TR'); u.rate = T.rate;
    u.onboundary = e => {
      if (g !== T.gen || e.name === 'sentence') return;
      const a = p.at + e.charIndex, len = e.charLength || (/^[\p{L}\p{N}'’-]+/u.exec(p.s.slice(e.charIndex)) || [''])[0].length;
      ttsMark(i, a, a + Math.max(1, len));
    };
    u.onend = () => setTimeout(next, 0);
    u.onerror = e => { if (g === T.gen && e.error !== 'interrupted' && e.error !== 'canceled') { toast('Sesli kitap durdu: ' + (e.error || 'ses hatası')); ttsStop(); } };
    speechSynthesis.speak(u);
  };
  next();
}
function ttsStart(from) {
  if (!R) return;
  if (!ttsOK()) { toast('Bu tarayıcı sesli okumayı desteklemiyor.'); return; }
  if (V.on) stopVoice();
  T.on = true; T.paused = false; ttsBar(); applyVol();
  if (!ttsVoice(R.entry.lang)) toast((R.entry.lang === 'en' ? 'İngilizce' : 'Türkçe') + ' ses bulunamadı; varsayılan ses kullanılıyor.', 4000);
  ttsSpeak(from != null ? from : Math.max(0, R.active));
}
function ttsStop() {
  T.on = false; T.paused = false; T.gen++; T.i = -1;
  if (ttsOK()) speechSynthesis.cancel();
  ttsMark(-1); ttsBar(); applyVol();
}
function ttsPause() {
  if (!T.on) return;
  T.paused = !T.paused;
  if (T.paused) speechSynthesis.pause(); else { speechSynthesis.resume(); if (!speechSynthesis.speaking) ttsSpeak(T.i); }
  ttsBar(); applyVol();
}
function ttsBar() {
  let b = T.bar;
  if (!b) {
    b = T.bar = h('div', 'tts-bar'); b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'Sesli kitap');
    const pp = h('button', 'btn line tts-pp'); pp.type = 'button'; pp.onclick = ttsPause;
    const sp = h('select', 'tts-rate'); sp.setAttribute('aria-label', 'Okuma hızı');
    for (const r of [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75]) { const o = h('option', null, r.toString().replace('.', ',') + '×'); o.value = r; sp.append(o); }
    sp.onchange = () => { T.rate = +sp.value; try { localStorage.setItem('sa-tts-rate', T.rate); } catch (e) { /* yok */ } if (T.on && !T.paused) ttsSpeak(T.i); };
    const st = h('button', 'btn line'); st.type = 'button'; st.textContent = 'Durdur'; st.onclick = ttsStop;
    b.append(h('span', 'tts-l', '🔊 Sesli kitap'), pp, sp, st); $('scr-reader').append(b);
  }
  b.hidden = !T.on;
  b.querySelector('.tts-pp').textContent = T.paused ? 'Sürdür' : 'Duraklat';
  b.querySelector('.tts-rate').value = String(T.rate);
  const btn = $('rTts'); if (btn) { btn.setAttribute('aria-pressed', String(T.on)); btn.classList.toggle('on', T.on); }
}
if (ttsOK()) speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => {});
$('rTts') && $('rTts').addEventListener('click', () => T.on ? ttsStop() : ttsStart());

/* ================= 8c. Altını çiz · not · alıntı (profil + kitap başına, yerel) =================
   Vurgular metni bölmez: CSS Highlight API (::highlight(sa-mark)) ile paragraf metin düğümü üzerinde aralık olarak çizilir. */
const nKey = () => 'sa-notes-' + (P ? P.id : '');
function notesAll() { try { return JSON.parse(localStorage.getItem(nKey()) || '{}') || {}; } catch (e) { return {}; } }
function notesSave(all) { try { localStorage.setItem(nKey(), JSON.stringify(all)); } catch (e) { toast('Not kaydedilemedi: tarayıcı deposu dolu.'); } }
function notesOf(id) { const a = notesAll()[id]; return a && Array.isArray(a.items) ? a.items : []; }
function notesPut(entry, fn) {
  const all = notesAll(), b = all[entry.id] = all[entry.id] || {t: entry.title, a: entry.author || '', items: []};
  b.t = entry.title; b.a = entry.author || ''; fn(b.items); b.items.sort((x, y) => x.i - y.i || x.a - y.a);
  if (!b.items.length) delete all[entry.id];
  notesSave(all); notesPaint();
}
function notesPaint() {
  if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  if (!R) { CSS.highlights.delete('sa-mark'); return; }
  const rs = [];
  for (const n of notesOf(R.entry.id)) {
    const p = R.paras[n.i], node = p && p.el.firstChild;
    if (!node || node.nodeType !== 3 || n.b > node.length) continue;
    const rg = new Range(); rg.setStart(node, n.a); rg.setEnd(node, n.b); rs.push(rg);
  }
  if (rs.length) CSS.highlights.set('sa-mark', new Highlight(...rs)); else CSS.highlights.delete('sa-mark');
}
/* Seçimi paragraf içi konuma çevir (yalnızca tek paragraf, metin düğümü) */
function selInfo() {
  const s = getSelection(); if (!R || !s || s.isCollapsed || !s.rangeCount) return null;
  const rg = s.getRangeAt(0), pa = rg.startContainer.parentElement && rg.startContainer.parentElement.closest('#rText p[data-i]');
  if (!pa || rg.startContainer !== rg.endContainer || rg.startContainer !== pa.firstChild) return null;
  let a = rg.startOffset, b = rg.endOffset; const t = rg.startContainer.data;
  while (a < b && /\s/.test(t[a])) a++; while (b > a && /\s/.test(t[b - 1])) b--;
  if (b - a < 2) return null;
  return {i: +pa.dataset.i, a, b, text: t.slice(a, b), rect: rg.getBoundingClientRect()};
}
/* Sözcük bakma: çift tıkla → İngilizcede dictionaryapi.dev (anahtarsız, bellek önbelleği), Türkçede TDK bağlantısı */
const WL = {el: null, cache: new Map(), seq: 0};
function hideLookup() { if (WL.el) WL.el.hidden = true; }
function placeLookup(rect) {
  const el = WL.el, w = el.offsetWidth || 320, x = clamp(rect.left + rect.width / 2 - w / 2, 8, innerWidth - w - 8);
  const below = rect.bottom + 10, hgt = el.offsetHeight || 120;
  el.style.left = x + 'px'; el.style.top = (below + hgt > innerHeight - 8 ? Math.max(8, rect.top - hgt - 54) : below) + 'px';
}
async function lookupWord(word, rect, lang) {
  if (!WL.el) {
    WL.el = h('div', 'wl-pop'); WL.el.setAttribute('role', 'dialog'); WL.el.setAttribute('aria-label', 'Sözcük anlamı'); WL.el.hidden = true;
    document.body.append(WL.el);
    document.addEventListener('pointerdown', e => { if (WL.el && !WL.el.hidden && !WL.el.contains(e.target)) hideLookup(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideLookup(); });
    $('rScroll').addEventListener('scroll', () => { if (Math.abs($('rScroll').scrollTop - WL.st) > 80) hideLookup(); }, {passive: true});
  }
  const el = WL.el, my = ++WL.seq; el.textContent = ''; el.hidden = false; WL.st = $('rScroll').scrollTop;
  const head = h('div', 'wl-h'); head.append(h('strong', null, word)); el.append(head);
  if (lang !== 'en') {
    const a = h('a', 'btn line sm', 'TDK’da aç'); a.href = 'https://sozluk.gov.tr/'; a.target = '_blank'; a.rel = 'noopener';
    a.addEventListener('click', () => { try { navigator.clipboard.writeText(word); } catch (e) { /* yok */ } });
    el.append(h('p', 'wl-note', 'Güncel Türkçe Sözlük yeni sekmede açılır; sözcük panoya kopyalanır, arama kutusuna yapıştırman yeter.'), a);
    placeLookup(rect); return;
  }
  const body = h('div', 'wl-b', 'Aranıyor…'); el.append(body); placeLookup(rect);
  const key = word.toLowerCase();
  let res = WL.cache.get(key);
  if (!res) {
    try {
      if (navigator.onLine === false) throw new TypeError('offline');
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(key));
      res = r.status === 404 ? {none: true} : r.ok ? {data: await r.json()} : {err: 'Sözlük şu an yanıt vermiyor (' + r.status + ').'};
      if (!res.err) WL.cache.set(key, res);
    } catch (e) { res = {err: 'Çevrimdışısın ya da sözlüğe ulaşılamadı; bağlantı gelince yeniden dene.'}; }
  }
  if (my !== WL.seq) return;
  body.textContent = '';
  if (res.err || res.none) { body.append(h('p', 'wl-note', res.err || 'Bu sözcük sözlükte bulunamadı.')); placeLookup(rect); return; }
  const d = res.data[0] || {}, ph = d.phonetic || ((d.phonetics || []).find(p => p.text) || {}).text;
  if (ph) head.append(h('span', 'wl-ph', ph));
  for (const m of (d.meanings || []).slice(0, 3)) {
    const df = (m.definitions || [])[0]; if (!df) continue;
    const p = h('p', 'wl-def'); p.append(h('em', null, m.partOfSpeech || ''), ' ' + df.definition);
    if (df.example) p.append(h('span', 'wl-ex', '“' + df.example + '”'));
    body.append(p);
  }
  body.append(h('p', 'wl-src', 'Kaynak: Free Dictionary API (Wiktionary)'));
  placeLookup(rect);
}
function wireLookup() {
  $('rText').addEventListener('dblclick', e => {
    if (!R || !e.target.closest('p[data-i]')) return;
    const s = getSelection(), raw = s ? String(s).trim() : '';
    const word = (raw.match(/^[\p{L}'’-]+$/u) || [])[0]; if (!word || word.length < 2) return;
    const rect = s.getRangeAt(0).getBoundingClientRect();
    lookupWord(word.replace(/[’']s$/, ''), rect, (R.entry.lang || 'tr') === 'en' ? 'en' : 'tr');
  });
}
let selMenu = null;
function hideSelMenu() { if (selMenu) selMenu.hidden = true; }
function showSelMenu() {
  const si = selInfo(); if (!si) { hideSelMenu(); return; }
  if (!selMenu) {
    selMenu = h('div', 'sel-menu'); selMenu.setAttribute('role', 'toolbar'); selMenu.setAttribute('aria-label', 'Seçili metin');
    const mk = (t, f) => { const b = h('button', null, t); b.type = 'button'; b.addEventListener('mousedown', e => e.preventDefault()); b.onclick = () => { const s = selMenu._si; hideSelMenu(); if (s) f(s); }; return b; };
    selMenu.append(mk('Altını çiz', markSel), mk('Not ekle', s => noteDialog(s)), mk('Alıntıyı kopyala', copyQuote));
    document.body.append(selMenu);
  }
  selMenu._si = si; selMenu.hidden = false;
  const w = selMenu.offsetWidth || 260, x = clamp(si.rect.left + si.rect.width / 2 - w / 2, 8, innerWidth - w - 8);
  const y = si.rect.top > 70 ? si.rect.top - 46 : si.rect.bottom + 10;
  selMenu.style.left = x + 'px'; selMenu.style.top = y + 'px';
}
function markSel(si, note) {
  if (!R) return;
  notesPut(R.entry, items => {
    const ov = items.find(n => n.i === si.i && n.a < si.b && si.a < n.b);
    if (ov) { ov.a = Math.min(ov.a, si.a); ov.b = Math.max(ov.b, si.b); ov.text = R.texts[si.i].slice(ov.a, ov.b); if (note != null) ov.note = note; ov.t = Date.now(); }
    else items.push({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), i: si.i, a: si.a, b: si.b, text: si.text, note: note || '', t: Date.now()});
  });
  if (F.ch) F.ch.quote = si.text.length <= 260 ? si.text : F.ch.quote;
  getSelection().removeAllRanges();
  toast(note != null ? 'Not kaydedildi.' : 'Altı çizildi. “Notlarım”da duruyor.', 2200);
}
function noteDialog(si, existing) {
  const dlg = h('dialog', 'claude-dlg note-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, existing ? 'Notu düzenle' : 'Not ekle'), h('blockquote', 'note-q', '“' + (existing ? existing.text : si.text) + '”'));
  const ta = h('textarea'); ta.rows = 4; ta.maxLength = 2000; ta.placeholder = 'Aklından geçen…'; ta.value = existing ? existing.note || '' : ''; ta.style.width = '100%';
  const ok = h('button', 'btn brass', 'Kaydet'); ok.type = 'button';
  ok.onclick = () => {
    const v = ta.value.trim();
    if (existing) notesPut(R.entry, items => { const n = items.find(x => x.id === existing.id); if (n) n.note = v; });
    else markSel(si, v);
    dlg.close(); if (existing && $('notesList')) renderNotesList();
  };
  const cl = h('button', 'btn line', 'Vazgeç'); cl.type = 'button'; cl.onclick = () => dlg.close();
  dlg.append(ta, h('p', null, ''), ok, ' ', cl); dlg.showModal(); ta.focus();
}
const quoteText = (text, title, author) => '“' + text + '”\n— ' + [author, title].filter(Boolean).join(', ');
async function copyQuote(si) {
  const q = quoteText(si.text, R.entry.title, R.entry.author);
  try { await navigator.clipboard.writeText(q); toast('Alıntı panoya kopyalandı.', 2200); }
  catch (e) { const ta = h('textarea'); ta.value = q; document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast('Alıntı panoya kopyalandı.', 2200); } catch (x) { toast('Kopyalanamadı.'); } ta.remove(); }
  getSelection().removeAllRanges();
}
function notesMarkdown(entry) {
  const items = notesOf(entry.id), L = ['# ' + entry.title + (entry.author ? ' — ' + entry.author : ''), '', '_Satır Arası notları · ' + new Date().toLocaleDateString('tr-TR') + '_', ''];
  let ch = null;
  for (const n of items) {
    const hd = R && R.entry.id === entry.id && R.paras[n.i] ? (R.heads[R.paras[n.i].chap - 1] || {}).t : null;
    if (hd && hd !== ch) { ch = hd; L.push('## ' + hd, ''); }
    L.push('> ' + n.text.replace(/\n+/g, ' '), '');
    if (n.note) L.push(n.note, '');
    L.push('<sub>¶' + (n.i + 1) + '</sub>', '');
  }
  return L.join('\n');
}
function downloadNotes(entry) {
  const blob = new Blob([notesMarkdown(entry)], {type: 'text/markdown;charset=utf-8'}), a = h('a');
  a.href = URL.createObjectURL(blob); a.download = (entry.title || 'notlar').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) + ' - notlar.md'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function renderNotesList() {
  const ol = $('notesList'); if (!ol || !R) return; ol.textContent = '';
  const items = notesOf(R.entry.id);
  if (!items.length) { ol.append(h('li', 'help', 'Henüz notun yok. Metinde bir yeri seç: “Altını çiz”, “Not ekle” ya da “Alıntıyı kopyala”.')); return; }
  for (const n of items) {
    const li = h('li', 'note-it'), go = h('button', 'note-go'); go.type = 'button';
    go.append(h('span', 'note-txt', '“' + (n.text.length > 160 ? n.text.slice(0, 157) + '…' : n.text) + '”'), n.note ? h('small', 'note-n', n.note) : '', h('small', 'note-p', pct(fracOf(Math.min(n.i, R.paras.length - 1)))));
    go.onclick = () => { ol.closest('dialog').close(); jumpTo(Math.min(n.i, R.paras.length - 1)); };
    const ed = h('button', 'btn line sm', 'Not'); ed.type = 'button'; ed.onclick = () => noteDialog(null, n);
    const del = h('button', 'btn line sm', 'Sil'); del.type = 'button'; del.onclick = () => { notesPut(R.entry, items => { const k = items.findIndex(x => x.id === n.id); if (k >= 0) items.splice(k, 1); }); renderNotesList(); };
    li.append(go, h('span', 'note-act', ''), ed, ' ', del); ol.append(li);
  }
}
function notesPanel() {
  if (!R) return;
  const dlg = h('dialog', 'claude-dlg notes-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  const ol = h('ol', 'notes-list'); ol.id = 'notesList';
  const dl = h('button', 'btn line', 'Markdown olarak indir'); dl.type = 'button'; dl.onclick = () => notesOf(R.entry.id).length ? downloadNotes(R.entry) : toast('İndirilecek not yok.');
  const x = h('button', 'btn brass', 'Kapat'); x.type = 'button'; x.onclick = () => dlg.close();
  dlg.append(h('h3', null, 'Notlarım · ' + R.entry.title), ol, h('p', null, ''), dl, ' ', x);
  renderNotesList(); dlg.showModal();
}
/* Menü: "Alıntılar" kutusu — son altı çizilen cümleler küçük kâğıt kartlarda */
function recentQuotes(max) {
  const all = notesAll(), out = [];
  for (const [id, b] of Object.entries(all)) for (const n of b.items || []) out.push({id, title: b.t, author: b.a, ...n});
  return out.sort((a, b) => b.t - a.t).slice(0, max || 50);
}
function quoteSlot() {
  const qs = recentQuotes(3); if (!qs.length) return null;
  const s = h('div', 'quote-box'); s.setAttribute('role', 'listitem');
  const b = h('button', 'qb-btn'); b.type = 'button'; b.setAttribute('aria-label', 'Alıntılar: son altı çizdiğin cümleler');
  qs.slice().reverse().forEach((q, k) => { const c = h('span', 'qb-card'); c.style.setProperty('--k', k); c.append(h('i', null, '“' + (q.text.length > 90 ? q.text.slice(0, 88) + '…' : q.text) + '”'), h('small', null, q.title)); b.append(c); });
  b.append(h('span', 'qb-label', 'Alıntılar'));
  b.onclick = quotesPanel; s.append(b); return s;
}
function quotesPanel() {
  const dlg = h('dialog', 'claude-dlg notes-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, 'Alıntılar'));
  const ol = h('ol', 'notes-list');
  for (const q of recentQuotes(60)) {
    const li = h('li', 'note-it'), go = h('button', 'note-go'); go.type = 'button';
    go.append(h('span', 'note-txt', '“' + q.text + '”'), q.note ? h('small', 'note-n', q.note) : '', h('small', 'note-p', q.title));
    go.onclick = () => { const en = lib.find(x => x.id === q.id); if (!en) { toast('Bu kitap artık kitaplığında değil.'); return; } dlg.close(); en.para = q.i; saveLib(); openEntry(en); };
    li.append(go); ol.append(li);
  }
  const x = h('button', 'btn brass', 'Kapat'); x.type = 'button'; x.onclick = () => dlg.close();
  dlg.append(ol, h('p', null, ''), x); dlg.showModal();
}
{
  const art = $('rText');
  const later = () => setTimeout(showSelMenu, 10);
  art.addEventListener('mouseup', later); art.addEventListener('touchend', () => setTimeout(showSelMenu, 350)); art.addEventListener('keyup', e => { if (e.shiftKey) later(); });
  document.addEventListener('selectionchange', () => { if (selMenu && !selMenu.hidden && getSelection().isCollapsed) hideSelMenu(); });
  sc().addEventListener('scroll', () => { if (selMenu && !selMenu.hidden) showSelMenu(); }, {passive: true});   // kaydırınca seçimin üstünde kal
  $('rNotes') && $('rNotes').addEventListener('click', notesPanel);
}

/* ================= 8d. Okuma hedefi (günlük dakika, seri) =================
   Etkin okuma süresi: yalnızca bir paragraf etkinken, sekme görünürken ve okur son 3 dakikada bir şey yaptıysa (ya da sesli kitap açıksa) sayılır. */
const GO = {t: 0, last: 0, act: 0};
const gKey = () => 'sa-goal-' + (P ? P.id : '');
function goalLoad() { try { const g = JSON.parse(localStorage.getItem(gKey()) || 'null'); if (g && g.days) return g; } catch (e) { /* yok */ } return {goal: 20, days: {}}; }
function goalSave(g) { try { localStorage.setItem(gKey(), JSON.stringify(g)); } catch (e) { /* dolu */ } }
function goalTick() {
  const now = Date.now(), dt = GO.last ? Math.min(30, (now - GO.last) / 1000) : 0; GO.last = now;
  if (!P || !R || R.active < 0 || document.hidden || !dt) return;
  if (!T.on && now - GO.act > 180000) return;
  const g = goalLoad(), k = Core.dayKey(), before = Core.goalStats(g.days, g.goal).done;
  g.days[k] = Math.round((g.days[k] || 0) + dt);
  const bt = LS.get('btime:' + P.id, {}); bt[R.entry.id] = Math.round((bt[R.entry.id] || 0) + dt); LS.set('btime:' + P.id, bt);   // kitap başına süre (kitap sonu ekranı)
  const keys = Object.keys(g.days).sort(); while (keys.length > 400) delete g.days[keys.shift()];
  goalSave(g);
  if (!before && Core.goalStats(g.days, g.goal).done) toast('Bugünkü okuma hedefin tamam: ' + g.goal + ' dakika. Seri devam ediyor!', 5000);
}
function goalRing() {
  const b = $('mGoal'); if (!b || !P) return;
  const g = goalLoad(), st = Core.goalStats(g.days, g.goal), C2 = 2 * Math.PI * 15;
  b.querySelector('.gr-fg').style.strokeDashoffset = String(C2 * (1 - st.frac));
  b.querySelector('.gr-t').textContent = Math.floor(st.today / 60) + '/' + g.goal;
  b.querySelector('.gr-s').textContent = st.streak ? '🔥' + st.streak : '';
  b.classList.toggle('done', st.done);
  b.title = 'Bugün ' + Math.floor(st.today / 60) + ' / ' + g.goal + ' dakika okudun' + (st.streak ? ' · ' + st.streak + ' günlük seri' : '');
  b.setAttribute('aria-label', b.title);
}
function goalPanel() {
  const g = goalLoad(), st = Core.goalStats(g.days, g.goal);
  const dlg = h('dialog', 'claude-dlg goal-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => { dlg.remove(); goalRing(); });
  dlg.append(h('h3', null, 'Okuma hedefi'));
  dlg.append(h('p', null, 'Bugün ' + Math.floor(st.today / 60) + ' dakika okudun' + (st.done ? ' — hedef tamam.' : '; hedefe ' + Math.max(1, Math.ceil((st.need - st.today) / 60)) + ' dakika kaldı.')));
  dlg.append(h('p', null, st.streak ? st.streak + ' gündür hedefini tutturuyorsun.' : 'Hedefi tutturduğun her gün seriye eklenir.'));
  const wk = h('div', 'goal-week'), d = new Date();
  for (let k = 6; k >= 0; k--) {
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() - k, 12), sec = g.days[Core.dayKey(dd)] || 0, col = h('div', 'gw-d');
    const bar = h('span', 'gw-b'); bar.style.height = Math.max(3, Math.min(1, sec / (g.goal * 60)) * 56) + 'px'; if (sec >= g.goal * 60) bar.classList.add('ok');
    col.title = Math.floor(sec / 60) + ' dk'; col.append(bar, h('small', null, dd.toLocaleDateString('tr-TR', {weekday: 'short'}))); wk.append(col);
  }
  dlg.append(wk);
  const lab = h('label', 'goal-set'), sel = h('select');
  for (const m of [5, 10, 15, 20, 30, 45, 60, 90]) { const o = h('option', null, m + ' dakika'); o.value = m; sel.append(o); }
  sel.value = String(g.goal); sel.onchange = () => { const x = goalLoad(); x.goal = +sel.value; goalSave(x); goalRing(); };
  lab.append('Günlük hedef: ', sel); dlg.append(lab);
  dlg.append(h('p', 'help small', 'Yalnızca etkin okuma sayılır: bir paragraf etkinken, sekme açıkken ve son 3 dakikada kaydırma/fare/dokunma varken (sesli kitapta da).'));
  const x = h('button', 'btn brass', 'Kapat'); x.type = 'button'; x.onclick = () => dlg.close(); dlg.append(x);
  dlg.showModal();
}
{
  const mark = () => { GO.act = Date.now(); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, mark, {passive: true, capture: true});
  sc().addEventListener('scroll', mark, {passive: true});
  setInterval(goalTick, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) goalTick(); else GO.last = Date.now(); });
  $('mGoal') && $('mGoal').addEventListener('click', goalPanel);
}

/* ================= 8e. Kısayollar ("?") ve ilk açılış turu ================= */
function helpPanel() {
  if (document.querySelector('dialog.keys-dlg')) return;
  const dlg = h('dialog', 'claude-dlg keys-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, 'Klavye kısayolları'));
  const grp = (title, rows) => {
    const tb = h('dl', 'keys'); for (const [k, t] of rows) { const dt = h('dt'); for (const x of k.split(' ')) dt.append(h('kbd', null, x)); tb.append(dt, h('dd', null, t)); }
    dlg.append(h('h4', null, title), tb);
  };
  grp('Okurken', [['M', 'Müziği başlat / duraklat'], ['S', 'Sesli kitap: aç / kapat'], ['Boşluk', 'Sesli kitapta duraklat / sürdür'], ['V', 'Sesli okuma (mikrofon) aç / kapat'], ['N', 'Notlarım'], ['F', 'Odak modu'], ['Esc', 'Ayarları kapat']]);
  grp('Kitaplıkta', [['← →', 'Rafta kitaplar arasında gez'], ['Enter', 'Seçili kitabı aç'], ['Ctrl V', 'Metni yapıştırıp kitap olarak ekle']]);
  grp('Her yerde', [['?', 'Bu yardım']]);
  dlg.append(h('p', 'help small', 'Metinde bir yeri seçince “Altını çiz / Not ekle / Alıntıyı kopyala” menüsü açılır.'));
  const x = h('button', 'btn brass', 'Tamam'); x.type = 'button'; x.onclick = () => dlg.close(); dlg.append(x);
  dlg.showModal();
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.key === '?') { e.preventDefault(); helpPanel(); return; }
  if (document.body.dataset.screen !== 'reader' || document.querySelector('dialog[open]')) return;
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); T.on ? ttsStop() : ttsStart(); }
  else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); notesPanel(); }
  else if (e.key === ' ' && T.on && e.target === document.body) { e.preventDefault(); ttsPause(); }
});

const TOUR = [
  {sel: '#rowMine', title: 'Kitaplığın', text: 'Önerilenlerden bir kitap seç ya da kendi .txt / .epub dosyanı ekle. Kitaba tıklayınca açılır.'},
  {sel: '#mGoal', title: 'Günlük hedefin', text: 'Halka bugünkü okuma dakikalarını gösterir; hedefini tutturdukça seri büyür. Tıklayıp hedefi değiştirebilirsin.'},
  {sel: '#mJourney', title: 'Okurken', text: 'Müzik okuduğun paragrafın havasını izler. “🔊 Sesli kitap” kitabı sana okur, metni seçip not alabilirsin. Kısayollar için “?” tuşu.'}
];
function tourMaybe() {
  let done = false; try { done = !!localStorage.getItem('sa-tour-done'); } catch (e) { done = true; }
  if (done || document.querySelector('.tour')) return;
  setTimeout(() => { if (document.body.dataset.screen === 'menu' && !document.querySelector('dialog[open]')) tourStep(0); }, 900);
}
function tourStep(k) {
  document.querySelectorAll('.tour, .tour-spot').forEach(x => x.remove());
  const st = TOUR[k], end = () => { document.querySelectorAll('.tour, .tour-spot').forEach(x => x.remove()); try { localStorage.setItem('sa-tour-done', '1'); } catch (e) { /* yok */ } };
  if (!st) { end(); return; }
  const tg = document.querySelector(st.sel), r = tg && tg.offsetParent !== null ? tg.getBoundingClientRect() : null;
  if (!r || !r.width) { tourStep(k + 1); return; }
  const spot = h('div', 'tour-spot'); spot.style.cssText = 'left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px';
  const card = h('div', 'tour'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', st.title);
  card.append(h('small', null, (k + 1) + ' / ' + TOUR.length), h('b', null, st.title), h('p', null, st.text));
  const nx = h('button', 'btn brass', k === TOUR.length - 1 ? 'Başlayalım' : 'İleri'); nx.type = 'button'; nx.onclick = () => tourStep(k + 1);
  const sk = h('button', 'btn line', 'Geç'); sk.type = 'button'; sk.onclick = end;
  const row = h('div', 'tour-act'); row.append(sk, nx); card.append(row);
  document.body.append(spot, card);
  const cw = Math.min(320, innerWidth - 32), below = r.bottom + 14 + 170 < innerHeight;
  card.style.width = cw + 'px'; card.style.left = clamp(r.left + r.width / 2 - cw / 2, 16, innerWidth - cw - 16) + 'px';
  card.style.top = (below ? r.bottom + 14 : Math.max(16, r.top - 14 - card.offsetHeight)) + 'px';
  nx.focus();
}

/* ================= 9. Yaratıcı özellikler =================
   Karakter temaları · sahne sesleri · rol kipi · bölüm sonu kartı · sesli okuma koçu · yolculuk haritası · bugünkü havam · birlikte oku */
const F = {opt: {themes: true, scenes: true, role: true}, chars: [], scene: null, sceneHold: 0, amb: null, lastMotif: new Map(), ch: null, vlog: [], jr: null, jrN: 0, room: null, roomT: 0, applying: false, speaker: ''};
try { Object.assign(F.opt, JSON.parse(localStorage.getItem('sa-feat') || '{}')); } catch (e) { /* yok */ }
const saveOpt = () => { try { localStorage.setItem('sa-feat', JSON.stringify(F.opt)); } catch (e) { /* yok */ } };
function findChars(texts) {   // ad bulma core.js'te (gemi/yer adları elenir); burada yalnızca motif atanır
  const SC = [0, 2, 4, 7, 9, 12, 14];
  return (Core.findChars ? Core.findChars(texts) : []).map(({name, n}) => {
    let hsh = 7; for (const c of name) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    const len = 3 + (hsh % 2), notes = []; for (let k = 0; k < len; k++) notes.push(SC[(hsh >>> (k * 3)) % SC.length]);
    return {name, n, notes};
  });
}
const isDialogue = t => /^[\s]*[“"«—–-]|[“”«»"]/.test(t);
const SPEECH = /\b(said|says|asked|replied|cried|answered|whispered|shouted|exclaimed|continued|returned|dedi|diyordu|diye|sordu|bağırdı|yanıtladı|fısıldadı|söyledi|haykırdı)\b/giu;
function speakerOf(t) {
  let best = null, bd = 1e9; const verbs = []; let m; SPEECH.lastIndex = 0;
  while ((m = SPEECH.exec(t))) verbs.push(m.index);
  for (const c of F.chars) {
    let i = t.indexOf(c.name); if (i < 0) continue;
    while (i >= 0) { const d = verbs.length ? Math.min(...verbs.map(v => Math.abs(v - i))) : 500 + i; if (d < bd) { bd = d; best = c; } i = t.indexOf(c.name, i + 1); }
  }
  return best;
}
const SCENE_RX = [['fire', /\b(ateş\p{L}*|alev\p{L}*|şömine\p{L}*|fire|flames?|hearth|blaz\p{L}*|fireplace)\b/iu], ['hooves', /\b(atlar\p{L}*|atın|atını|süvari\p{L}*|dörtnal\p{L}*|horses?|hoofs?|hooves|gallop\p{L}*|rode)\b/iu],
  ['crowd', /\b(kalabalı\p{L}*|meydan\p{L}*|pazar\p{L}*|crowds?|throngs?|multitude|market\p{L}*)\b/iu], ['rain', /\b(yağmur\p{L}*|sağanak|rain\p{L}*|drizzl\p{L}*|storm\p{L}*)\b/iu],
  ['sea', /\b(deniz\p{L}*|dalga\p{L}*|sahil\p{L}*|sea|waves?|shore|ocean)\b/iu], ['wind', /\b(rüzg[âa]r\p{L}*|fırtına\p{L}*|wind\p{L}*|gales?|breeze)\b/iu]];
function sceneFor(i) {
  for (let j = i; j <= i + 1; j++) { const t = R.texts[j]; if (!t) continue; for (const [id, rx] of SCENE_RX) if (rx.test(t)) return id; }
  const a = infoFor(i).amb; return a || null;
}
function sceneLayer() {
  if (MU.mode === 'engine') { const e = MU.engine; return e && e.scene ? e : null; }
  if (!F.amb && window.Engine && Engine.ambience) { try { MU.actx = MU.actx || new (window.AudioContext || window.webkitAudioContext)(); F.amb = Engine.ambience(MU.actx); F.amb.volume && F.amb.volume(0.5); } catch (e) { F.amb = null; } }
  return F.amb;
}
function setSceneSound(id) {
  if (id === F.scene) return; F.scene = id;
  const l = sceneLayer(); if (l && l.scene) { try { l.scene(id); } catch (e) { /* yok */ } }
}
function featInit() {
  notesPaint();
  F.chars = []; F.scene = null; F.vlog = []; F.speaker = '';
  if (R && R.active >= 0 && !F.ch) featActive(R.active, -1);
  const run = () => { if (R) { F.chars = findChars(R.texts); renderRole(); } };
  (window.requestIdleCallback || setTimeout)(run, {timeout: 1500});
  if (!$('rRole')) { const d = h('div', 'r-role'); d.id = 'rRole'; d.hidden = true; $('scr-reader').append(d); }
  if (!F.selWired) {
    F.selWired = true;
    const grab = () => { const s = String(getSelection() || '').trim().replace(/\s+/g, ' '); if (R && F.ch && s.length >= 12 && s.length <= 260) { F.ch.quote = s; } };   // sessizce: seçim menüsü ayrıca açılır
    $('rText').addEventListener('mouseup', grab); $('rText').addEventListener('touchend', () => setTimeout(grab, 300));
  }
}
function featClose() {
  hideSelMenu(); if (window.CSS && CSS.highlights) { CSS.highlights.delete('sa-mark'); CSS.highlights.delete('sa-tts'); }
  setSceneSound(null); journeySave(true); F.ch = null; if (F.room && F.room.code) roomSend(true);
  const r = $('rRole'); if (r) r.hidden = true;
}
function featActive(i, prev) {
  if (!R) return;
  const p = R.paras[i], inf = infoFor(i), t = R.texts[i] || '';
  // bölüm takibi
  if (!F.ch || F.ch.c !== p.chap) {
    if (F.ch && prev >= 0 && R.paras[prev] && R.paras[prev].chap === F.ch.c && p.chap === F.ch.c + 1 && F.ch.moods.length >= 3) chapterCard(F.ch);
    F.ch = {c: p.chap, t0: Date.now(), moods: [], tracks: new Map(), quote: '', title: R.heads[p.chap - 1] ? R.heads[p.chap - 1].t : 'Giriş'};
  }
  F.ch.moods.push(inf.mood);
  // kitap sonu: son paragrafa ilk varışta sakin bir kapanış ekranı (aynı oturumda bir kez)
  if (i === R.texts.length - 1 && prev !== i && !R.endShown && R.texts.length > 5) { R.endShown = true; const ent = R.entry; setTimeout(() => { if (R && R.entry === ent) endCard(); }, 1800); }
  if (isPlaying()) {
    const tr = MU.mode === 'yt' ? MU.track : null;
    if (tr && tr.title) F.ch.tracks.set(tr.title, [tr.title, tr.artist, tr.license, tr.credit].filter(Boolean).join(' · '));
    else if (MU.mode === 'engine') F.ch.tracks.set('engine', 'Yerleşik besteci (Satır Arası) · ' + moodName(inf.mood));
  }
  if (V.on) F.vlog.push({i, t: Date.now()});
  // sahne sesleri
  if (F.opt.scenes && isPlaying()) {
    const s = sceneFor(i);
    if (s) { F.sceneHold = 3; setSceneSound(s); } else if (--F.sceneHold <= 0) setSceneSound(null);
  } else setSceneSound(null);
  // rol kipi ve karakter motifleri
  const dlg = isDialogue(t), sp = dlg && F.chars.length ? speakerOf(t) : null;
  F.speaker = sp ? sp.name : ''; renderRole(dlg);
  if (sp && F.opt.themes && isPlaying()) {
    const last = F.lastMotif.get(sp.name) || 0;
    if (Date.now() - last > 20000) {
      F.lastMotif.set(sp.name, Date.now());
      const e = MU.engine || ensureEngine(); if (e && e.motif) { try { e.motif(sp.notes, {gain: 0.12}); } catch (x) { /* yok */ } }
    }
  }
  journeyTick(inf.mood);
  if (F.room && F.room.code && !F.applying) roomSend();
}
function renderRole(dlg) {
  const d = $('rRole'); if (!d) return;
  d.hidden = !(F.opt.role && dlg && F.speaker);
  if (!d.hidden) { const c = F.chars.find(x => x.name === F.speaker); d.textContent = ''; d.append(h('small', null, 'Konuşan'), h('b', null, F.speaker), c ? h('span', null, ' ♪') : ''); }
}

/* Özellikler paneli */
function featPanel() {
  if (!R) return;
  const dlg = h('dialog', 'claude-dlg feat-dlg'); document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, 'Okuma özellikleri'));
  const tog = (k, label, help) => {
    const l = h('label', 'feat-tog'), c = h('input'); c.type = 'checkbox'; c.checked = !!F.opt[k];
    c.onchange = () => { F.opt[k] = c.checked; saveOpt(); if (k === 'scenes' && !c.checked) setSceneSound(null); renderRole(isDialogue(R.texts[R.active] || '')); };
    l.append(c, ' ', h('b', null, label), h('small', null, ' — ' + help)); dlg.append(l);
  };
  tog('themes', 'Karakter temaları', 'ana karakterler diyalogda konuşunca kısa bir ezgi çalar');
  tog('scenes', 'Sahne sesleri', 'yağmur, deniz, rüzgâr, ateş, at nalı, kalabalık müziğin altında hafifçe');
  tog('role', 'Rol kipi', 'diyalogda konuşan karakteri gösterir');
  const cl = h('div', 'feat-chars');
  if (!F.chars.length) cl.append(h('small', null, 'Bu kitapta belirgin karakter adı bulunamadı.'));
  for (const c of F.chars) {
    const b = h('button', 'btn line', '♪ ' + c.name); b.type = 'button'; b.title = c.n + ' kez geçiyor';
    b.onclick = () => { const e = MU.engine || ensureEngine(); if (e && e.motif) { MU.actx && MU.actx.resume && MU.actx.resume(); e.motif(c.notes, {gain: 0.2}); } else toast('Motif çalmak için ses motoru henüz hazır değil.'); };
    cl.append(b, ' ');
  }
  dlg.append(h('h4', null, 'Karakterler'), cl);
  const bc = h('button', 'btn line', 'Bu bölümün kartını göster'); bc.type = 'button'; bc.onclick = () => { dlg.close(); if (F.ch) chapterCard(F.ch); };
  dlg.append(h('h4', null, 'Bölüm sonu kartı'), h('p', 'help small', 'Bölüm bitince kendiliğinden açılır. Metinde bir cümleyi seçersen (telefonda uzun bas) karta eklenir.'), bc);
  dlg.append(h('h4', null, 'Birlikte oku'), roomBox());
  const x = h('button', 'btn brass', 'Kapat'); x.type = 'button'; x.onclick = () => dlg.close(); dlg.append(h('p', null, ''), x);
  dlg.showModal();
}

/* Kitap sonu ekranı: bütün kitabın duygu yolculuğu, toplam süre, müzikler + emeği, not sayısı, benzer kitap önerisi */
function moodProfile(moods) { const v = {}; let n = 0; for (const m of moods) if (m) { v[m] = (v[m] || 0) + 1; n++; } for (const k in v) v[k] /= n || 1; return v; }
function cosMood(a, b) { let d = 0, x = 0, y = 0; for (const m of M) { const p = a[m] || 0, q = b[m] || 0; d += p * q; x += p * p; y += q * q; } return x && y ? d / Math.sqrt(x * y) : 0; }
async function similarRec(entry, prof) {
  let best = null;
  for (const rec of recList()) {
    if (String(rec.gid) === String(entry.gid) || lib.some(x => x.id === 'gut-' + rec.gid && (x.done || x.para >= x.n - 2))) continue;
    let rp = {[rec.mood]: 1};
    try { const d = await (await fetch('assets/analysis/' + rec.gid + '.json')).json(); const ms = []; for (const s of d.scenes || []) for (let k = s.from; k <= s.to; k++) ms.push(s.mood); if (ms.length) rp = moodProfile(ms); } catch (e) { /* yalnız ana duygu */ }
    const s = cosMood(prof, rp) + (rec.lang === entry.lang ? 0.05 : 0);
    if (!best || s > best.s) best = {rec, s};
  }
  return best && best.rec;
}
function endCard() {
  if (!R) return;
  const e = R.entry, n = R.texts.length, moods = [];
  for (let k = 0; k < n; k++) { try { moods.push(infoFor(k).mood); } catch (x) { moods.push(null); } }
  const prof = moodProfile(moods), secs = (LS.get('btime:' + P.id, {})[e.id]) || 0;
  if (!e.done) { e.done = Date.now(); saveLib(); }   // rafta "Bitti" şeridi
  let notes = 0; try { const nd = JSON.parse(localStorage.getItem(nKey()) || '{}')[e.id]; notes = nd && nd.items ? nd.items.length : 0; } catch (x) { /* yok */ }
  const heard = LS.get(heardKey(), []);
  const dlg = h('dialog', 'end-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  const box = h('div', 'end-box'); dlg.append(box);
  box.append(h('p', 'end-kick', 'Son sayfa'), h('h2', 'end-title', e.title || 'Adsız'), h('p', 'end-author', e.author || ''));
  // duygu yolculuğu: en çok 240 dilim, her dilimde baskın duygu
  const strip = h('div', 'end-strip'), B0 = Math.min(240, n), step = n / B0;
  for (let b = 0; b < B0; b++) { const c = {}; for (let k = Math.floor(b * step); k < Math.floor((b + 1) * step) || k === Math.floor(b * step); k++) if (moods[k]) c[moods[k]] = (c[moods[k]] || 0) + 1; const top = Object.entries(c).sort((x, y) => y[1] - x[1])[0]; const s = h('i'); s.style.background = top ? MOOD_COL[top[0]] : '#3a332b'; strip.append(s); }
  box.append(h('p', 'end-lbl', 'Duygu yolculuğu'), strip);
  const leg = h('p', 'end-legend');
  for (const [m, v] of Object.entries(prof).sort((x, y) => y[1] - x[1]).slice(0, 4)) { const d = h('span'); d.style.setProperty('--c', MOOD_COL[m]); d.textContent = moodName(m) + ' %' + Math.round(v * 100); leg.append(d); }
  box.append(leg);
  const hr = Math.floor(secs / 3600), mn = Math.round((secs % 3600) / 60);
  const stats = h('div', 'end-stats'), stat = (v, l) => { const d = h('div'); d.append(h('b', null, v), h('span', null, l)); return d; };
  stats.append(stat(secs < 60 ? '—' : (hr ? hr + ' sa ' : '') + mn + ' dk', 'okuma süresi'), stat(String(n), 'paragraf'), stat(String(notes), 'not / alıntı'), stat(String(heard.length), 'parça'));
  box.append(stats);
  if (heard.length) {
    const ol = h('ol', 'end-tracks');
    for (const t of heard.slice(-8)) { const li = h('li'); li.append(h('b', null, t.title || 'Adsız'), ' — ' + (t.artist || ''), h('small', null, [moodName(t.mood), t.license, t.credit].filter(Boolean).join(' · '))); ol.append(li); }
    box.append(h('p', 'end-lbl', 'Bu kitabın müzikleri' + (heard.length > 8 ? ' (son 8)' : '')), ol);
  } else box.append(h('p', 'end-lbl', 'Bu kitapta çevrim içi müzik kaydı yok.'));
  const sug = h('div', 'end-sug'), acts = h('div', 'end-acts');
  const bs = h('button', 'btn brass', 'Benzer bir kitap öner'); bs.type = 'button';
  const bb = h('button', 'btn line', 'Kitaplığa dön'); bb.type = 'button';
  bb.onclick = () => { dlg.close(); closeReader(); };
  bs.onclick = async () => {
    bs.disabled = true; sug.textContent = 'Duygu profiline bakılıyor…';
    const rec = await similarRec(e, prof); sug.textContent = '';
    if (!rec) { sug.textContent = 'Şimdilik önerecek başka kitap yok.'; bs.disabled = false; return; }
    const go = h('button', 'btn brass', 'Hemen aç'); go.type = 'button';
    go.onclick = async () => { go.disabled = true; try { const en = await adopt(rec); dlg.close(); closeReader(); setTimeout(() => openEntry(en), 400); } catch (x) { toast('Açılamadı: ' + (x.message || x)); go.disabled = false; } };
    sug.append(h('p', 'end-lbl', 'Benzer hava'), h('h3', null, rec.title), h('p', 'end-author', (rec.author || '') + ' · ' + moodName(rec.mood)), h('p', null, rec.blurb || ''), go);
    bs.disabled = false;
  };
  acts.append(bs, bb); box.append(acts, sug);
  dlg.showModal();
}
window.SA_EndCard = () => endCard();   // elle denemek için
// Son paragraf ekran ortasına hiç gelemeyebilir (sayfa dibi): dibe varınca ve okur son birkaç paragraftaysa da aç
{
  const sc = document.getElementById('rScroll'); let tm = 0;
  if (sc) sc.addEventListener('scroll', () => {
    if (tm || !R || R.endShown) return;
    tm = setTimeout(() => {
      tm = 0;
      if (!R || R.endShown || R.texts.length <= 5 || document.body.dataset.screen !== 'reader') return;
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 24 && R.active >= R.texts.length - 8) {
        R.endShown = true; const ent = R.entry; setTimeout(() => { if (R && R.entry === ent) endCard(); }, 2500);
      }
    }, 400);
  }, {passive: true});
}

/* Bölüm sonu kartı: duygu şeridi, parçalar, süre, seçilen cümle → PNG */
function chapterCard(ch) {
  const W = 1080, H = 1350, cv = h('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), mins = Math.max(1, Math.round((Date.now() - ch.t0) / 60000));
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#1d1a17'); grd.addColorStop(1, '#2c2620'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c8a45a'; g.font = '500 30px Georgia, serif'; g.fillText('SATIR ARASI · BÖLÜM SONU', 80, 110);
  g.fillStyle = '#f3ead8'; g.font = '600 64px Georgia, serif';
  const wrap = (txt, x, y, w, lh, max) => { const ws = String(txt).split(/\s+/); let line = '', n = 0; for (const w2 of ws) { const t = line ? line + ' ' + w2 : w2; if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += lh; line = w2; if (++n >= max - 1) { line += '…'; break; } } else line = t; } g.fillText(line, x, y); return y + lh; };
  let y = wrap(ch.title, 80, 210, W - 160, 74, 2);
  g.font = '28px Georgia, serif'; g.fillStyle = '#b9ab92'; g.fillText((R ? R.entry.title : '') + ' · ' + mins + ' dakika · ' + ch.moods.length + ' paragraf', 80, y + 4); y += 60;
  const bw = (W - 160) / ch.moods.length; ch.moods.forEach((m, k) => { g.fillStyle = MOOD_COL[m] || '#888'; g.fillRect(80 + k * bw, y, Math.ceil(bw), 70); }); y += 110;
  const cnt = {}; ch.moods.forEach(m => cnt[m] = (cnt[m] || 0) + 1);
  g.font = '26px Georgia, serif'; let x = 80;
  for (const [m, n] of Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4)) { g.fillStyle = MOOD_COL[m]; g.beginPath(); g.arc(x + 10, y - 9, 10, 0, 7); g.fill(); g.fillStyle = '#e9dfca'; const s = moodName(m) + ' %' + Math.round(n / ch.moods.length * 100); g.fillText(s, x + 30, y); x += g.measureText(s).width + 70; }
  y += 90;
  if (ch.quote) { g.fillStyle = '#f3ead8'; g.font = 'italic 40px Georgia, serif'; y = wrap('“' + ch.quote + '”', 80, y, W - 160, 56, 6) + 30; }
  g.fillStyle = '#c8a45a'; g.font = '500 26px Georgia, serif'; g.fillText('ÇALAN PARÇALAR', 80, y); y += 46; g.font = '26px Georgia, serif'; g.fillStyle = '#d9ceb8';
  const trs = [...ch.tracks.values()]; if (!trs.length) trs.push('Bu bölümde müzik çalmadı.');
  for (const t of trs.slice(0, 6)) y = wrap('• ' + t, 80, y, W - 160, 36, 2);
  const dlg = h('dialog', 'claude-dlg card-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, 'Bölüm bitti: ' + ch.title)); cv.className = 'card-cv'; dlg.append(cv);
  const sv = h('button', 'btn brass', 'Görsel olarak kaydet'); sv.type = 'button';
  sv.onclick = () => cv.toBlob(b => { const a = h('a'); a.href = URL.createObjectURL(b); a.download = 'satir-arasi-bolum.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  const cl = h('button', 'btn line', 'Okumaya dön'); cl.type = 'button'; cl.onclick = () => dlg.close();
  dlg.append(h('p', null, ''), sv, ' ', cl); dlg.showModal();
}

/* Sesli okuma koçu */
function coachCard(mins, pace) {
  if (!R) return;
  const L = F.vlog; F.vlog = [];
  const rows = [];
  for (let k = 0; k < L.length - 1; k++) { const d = L[k + 1].t - L[k].t, t = R.texts[L[k].i] || ''; if (d > 2000 && d < 180000) rows.push({i: L[k].i, d, wpm: t.split(/\s+/).length / (d / 60000)}); }
  const med = rows.length ? rows.map(r => r.d).sort((a, b) => a - b)[rows.length >> 1] : 0;
  const pauses = rows.filter(r => r.d > med * 2.5).length, fast = rows.slice().sort((a, b) => b.wpm - a.wpm)[0];
  const silent = V.an && V.t0 ? Math.max(0, 1 - V.speakMs / Math.max(1, Date.now() - V.t0)) : null;
  const dlg = h('dialog', 'claude-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, 'Sesli okuma koçu'));
  const tempo = pace < 110 ? 'sakin ve ağır; dinleyen için rahat.' : pace <= 170 ? 'rahat bir anlatıcı temposu.' : 'hızlı; virgüllerde biraz nefes almayı dene.';
  dlg.append(h('p', null, 'Hız: ortalama ' + Math.round(pace) + ' kelime/dk — ' + tempo));
  dlg.append(h('p', null, 'Duraklama: ' + (silent != null ? 'sürenin %' + Math.round(silent * 100) + '’i sessiz geçti; ' : '') + (pauses ? pauses + ' yerde uzunca durdun.' : 'akıcı okudun, belirgin uzun duraklama yok.')));
  if (fast) {
    const inf = infoFor(fast.i), b = h('button', 'btn line', 'O sahneye git'); b.type = 'button'; b.onclick = () => { dlg.close(); jumpTo(fast.i); };
    dlg.append(h('p', null, 'En hızlandığın sahne (' + Math.round(fast.wpm) + ' kelime/dk, ' + moodName(inf.mood) + '): “' + (R.texts[fast.i] || '').replace(/^[\s“”"«»—–-]+/, '').slice(0, 90) + '…”'), b, ' ');
  } else dlg.append(h('p', 'help small', 'Sahne bazında geri bildirim için en az birkaç paragraf sesli oku.'));
  const x = h('button', 'btn brass', 'Tamam'); x.type = 'button'; x.onclick = () => dlg.close(); dlg.append(x);
  dlg.showModal();
}

/* Okuma yolculuğu: kitap başına duygu sayımı (profil başına yerel) */
const jKey = () => 'sa-journey-' + (P ? P.id : '');
function journeyLoad() { try { return JSON.parse(localStorage.getItem(jKey()) || '{}'); } catch (e) { return {}; } }
function journeyTick(mood) {
  if (!R) return; F.jr = F.jr || journeyLoad();
  const e = F.jr[R.entry.id] = F.jr[R.entry.id] || {t: R.entry.title, m: {}, first: Date.now()};
  e.m[mood] = (e.m[mood] || 0) + 1; e.last = Date.now();
  if (++F.jrN % 10 === 0) journeySave(true);
}
function journeySave() { if (F.jr) try { localStorage.setItem(jKey(), JSON.stringify(F.jr)); } catch (e) { /* dolu */ } }
function journeyPanel() {
  const jr = F.jr = journeyLoad(), items = Object.entries(jr).sort((a, b) => (a[1].first || 0) - (b[1].first || 0));
  const dlg = h('dialog', 'claude-dlg journey-dlg'); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove());
  dlg.append(h('h3', null, 'Okuma yolculuğum'));
  const sky = h('div', 'j-sky'), plane = h('div', 'j-plane'); sky.append(plane);
  if (!items.length) plane.append(h('p', 'j-empty', 'Henüz yıldız yok. Bir kitap okudukça burada duygusunun renginde parlayacak.'));
  items.forEach(([id, e], k) => {
    const tot = Object.values(e.m).reduce((a, b) => a + b, 0), dom = Object.entries(e.m).sort((a, b) => b[1] - a[1])[0][0];
    let hs = 3; for (const c of id) hs = (hs * 33 + c.charCodeAt(0)) >>> 0;
    const s = h('button', 'j-star'); s.type = 'button';
    s.style.left = (8 + (items.length > 1 ? k / (items.length - 1) : 0.5) * 84) + '%'; s.style.top = (18 + (hs % 60)) + '%';
    s.style.setProperty('--c', MOOD_COL[dom]); s.style.setProperty('--s', (10 + Math.min(26, Math.sqrt(tot) * 1.6)).toFixed(0) + 'px');
    s.title = e.t + ' · baskın: ' + moodName(dom) + ' · ' + tot + ' paragraf';
    s.append(h('span', null, e.t));
    s.onclick = () => { const en = lib.find(x => x.id === id); if (en) { dlg.close(); if (!R) openEntry(en); } };
    plane.append(s);
  });
  dlg.append(sky, h('p', 'help small', 'Soldan sağa okuma sırası; renk kitabın baskın duygusu, büyüklük ne kadar okuduğun.'));
  dlg.append(h('h4', null, 'Bugünkü havam'), h('p', 'help small', 'Bir duygu seç: kitaplığından ve önerilenlerden o duygunun en güçlü sahnesine doğrudan açayım.'));
  const row = h('div', 'feat-chars');
  for (const m of M) { const b = h('button', 'btn line', moodName(m)); b.type = 'button'; b.style.borderColor = MOOD_COL[m]; b.onclick = () => { dlg.close(); moodJump(m); }; row.append(b, ' '); }
  dlg.append(row);
  const x = h('button', 'btn brass', 'Kapat'); x.type = 'button'; x.onclick = () => dlg.close(); dlg.append(h('p', null, ''), x);
  dlg.showModal();
}
async function moodJump(m) {
  toast(moodName(m) + ' sahnesi aranıyor…', 2500);
  const mi = M.indexOf(m), cands = [], seen = new Set();
  const fromJson = async (gid, ref) => { try { const d = await (await fetch('assets/analysis/' + gid + '.json')).json(); for (const s of d.scenes || []) if (s.mood === m) cands.push({ref, para: s.from - 1, score: (s.energy || 0.5) + Math.min(0.5, (s.to - s.from) / 60)}); } catch (e) { /* yok */ } };
  for (const en of lib) {
    seen.add(en.id);
    if (en.gid && hasAnalysis(en.gid)) { await fromJson(en.gid, {entry: en}); continue; }
    try {
      const d = await DB.get(en.id); if (!d) continue; const tx = d.blocks.filter(b => !b.h).map(b => b.t), st = Math.max(1, Math.floor(tx.length / 1500));
      let best = -1, bs = 0; for (let i = 0; i < tx.length; i += st) { const v = Core.analyze(tx[i], en.lang).v; if (v && v[mi] > bs) { bs = v[mi]; best = i; } }
      if (best >= 0) cands.push({ref: {entry: en}, para: best, score: Math.min(1.4, bs)});
    } catch (e) { /* yok */ }
  }
  for (const rec of (B.RECOMMENDED || [])) if (rec.gid && !seen.has('gut-' + rec.gid)) await fromJson(rec.gid, {rec});
  const best = cands.sort((a, b) => b.score - a.score)[0];
  if (!best) { toast('Bu duygu için güçlü bir sahne bulamadım.'); return; }
  let en = best.ref.entry;
  if (!en) { try { en = await adopt(best.ref.rec); } catch (e) { toast('Kitap indirilemedi: ' + scrub(e && e.message)); return; } }
  if (R && R.entry.id === en.id) { jumpTo(best.para); return; }
  en.para = best.para; saveLib();
  const go = () => openEntry(en);
  if (R) { closeReader(); setTimeout(go, 1200); } else go();
  toast('“' + en.title + '” · ' + moodName(m) + ' sahnesi açılıyor.', 3500);
}

/* Birlikte oku: SA_Room (yalnızca aynı sunucu / yerel ağ) */
function roomBox() {
  const box = h('div', 'room-box'), Rm = window.SA_Room;
  box.append(h('p', 'help small', 'Yalnızca aynı Satır Arası sunucusuna bağlı tarayıcılar arasında (bu bilgisayar ya da aynı yerel ağ, LAN) çalışır; internet üzerinden paylaşılmaz. Kitabın iki tarafın kitaplığında da olması gerekir.'));
  if (!Rm || !Rm.available) { box.append(h('p', null, 'Bu sunucu birlikte okumayı henüz desteklemiyor.')); return box; }
  const st = h('p', 'room-st', F.room && F.room.code ? 'Oda: ' + F.room.code + ' · ' + (F.room.peers || 1) + ' kişi' : 'Bir odada değilsin.');
  const inp = h('input'); inp.placeholder = 'Oda kodu'; inp.maxLength = 12; inp.style.width = '9em';
  const mk = (t, f) => { const b = h('button', 'btn line', t); b.type = 'button'; b.onclick = f; return b; };
  const join = async (code, own) => {   // katılan, odanın son durumunu izler; yalnızca kuran kendi konumunu yollar
    try { await Rm.join(code, roomEvent); F.room = {code, peers: 1}; st.textContent = 'Oda: ' + code + ' · bağlandı'; if (own) roomSend(true); toast('Birlikte oku: ' + code + ' odasındasın.'); }
    catch (e) { st.textContent = 'Odaya bağlanılamadı.'; }
  };
  box.append(st, mk('Oda kur', async () => { try { const c = await Rm.create(); inp.value = c; join(c, true); } catch (e) { st.textContent = 'Oda kurulamadı.'; } }), ' ', inp, ' ',
    mk('Katıl', () => inp.value.trim() && join(inp.value.trim().toUpperCase())), ' ', mk('Ayrıl', () => { try { Rm.leave(); } catch (e) { /* yok */ } F.room = null; st.textContent = 'Odadan ayrıldın.'; }));
  return box;
}
function roomSend(now) {
  const Rm = window.SA_Room; if (!Rm || !F.room || !R) return;
  clearTimeout(F.roomT);
  const go = () => { try { Rm.send({bookId: R.entry.id, para: R.active, vid: MU.track && (MU.track.vid || MU.track.id) || null}); } catch (e) { /* yok */ } };
  if (now) go(); else F.roomT = setTimeout(go, 1200);
}
function roomTrack(vid) {   // arkadaşın çaldığı YouTube parçasını da çal
  if (!vid || !R || MU.mode !== 'yt' || !isPlaying() || (MU.track && MU.track.vid === vid)) return;
  const tr = {vid, title: 'Arkadaşının parçası'}, inf = infoFor(R.active);
  R.sceneTracks.set(inf.scene, tr); R.curScene = inf.scene; MU.want = true; MU.pending = null; ytPlay(tr, 2);
}
async function roomEvent(ev) {
  if (!ev || !F.room) return;
  if (ev.type === 'peers') { F.room.peers = ev.n; const s = document.querySelector('.room-st'); if (s) s.textContent = 'Oda: ' + F.room.code + ' · ' + ev.n + ' kişi'; return; }
  if (ev.type !== 'state' || ev.bookId == null) return;
  if (R && R.entry.id === ev.bookId) {
    if (Math.abs(R.active - ev.para) >= 1) { F.applying = true; try { await jumpTo(clamp(ev.para, 0, R.paras.length - 1)); } finally { setTimeout(() => { F.applying = false; }, 1500); } }
    roomTrack(ev.vid); return;
  }
  const en = lib.find(x => x.id === ev.bookId);
  if (!en) { toast('Arkadaşın kitaplığında olmayan bir kitap okuyor.', 4000); return; }
  en.para = ev.para; F.applying = true; toast('Arkadaşın “' + en.title + '” okuyor; sen de geçiyorsun.', 4000);
  if (R) { closeReader(); await new Promise(r => setTimeout(r, 1200)); }
  try { await openEntry(en); } finally { setTimeout(() => { F.applying = false; }, 1500); }
}
$('rFeat').addEventListener('click', featPanel);
$('mJourney').addEventListener('click', journeyPanel);

function boot() {
  if (!Core) { document.body.textContent = 'core.js yüklenemedi.'; return; }
  wireWelcome(); wireMenu(); wireReader(); wireMusic(); wireLookup();
  sizeDust();
  try { const p = MU_API.init($('musicHost')); if (p && p.catch) p.catch(() => {}); } catch (e) { /* yok */ }
  let rsT = null;
  addEventListener('resize', () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => {
      sizeDust();
      const s = document.body.dataset.screen;
      if (s === 'menu' && P) { hot = null; computeBH(); renderMine(); renderRec(); }
      if (s === 'reader') drawRibbon();
    }, 160);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoop(); else if (document.body.dataset.screen !== 'reader') startLoop(); });
  addEventListener('pagehide', () => { if (R) savePos(true); saveLib(); });
  const cur = LS.get('current', null), p = profiles.find(x => x.id === cur);
  if (p) { activate(p); enterMenu(); } else openWelcome();
}
boot();
})();
