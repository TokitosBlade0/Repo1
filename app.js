/* Satır Arası — arayüz. Algılama Core'da, müzik Engine'de; burası ikisini okura bağlar. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const M = Core.MOODS, INFO = Core.INFO;
const store = {
  get(k, d) { try { const v = localStorage.getItem('sa:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sa:' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('sa:' + k); } catch (e) {} }
};
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const WPM = 200;

const set = Object.assign({fs: 0, vol: 60, theme: '', img: true, amb: true}, store.get('set', {}));
const saveSet = () => store.set('set', set);

let book = null, paras = [], chunks = [], dec = null, mood = null, neutral = null, overrides = [], cum = [];
let active = -2, committed = -2, shown = '', force = -1;
let engine = null, actx = null, dwellT = null, idleT = null, browsing = false, idle = false;
const art = $('text');

/* ---------- Bildirim satırı ---------- */
let toastT = null;
function toast(msg, ms) { $('toast').textContent = msg; clearTimeout(toastT); if (msg && ms !== 0) toastT = setTimeout(() => { $('toast').textContent = ''; }, ms || 6000); }

/* ---------- Kitap yükleme ---------- */
async function readTxt(file) {
  const buf = await file.arrayBuffer(); let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(buf); } catch (e) { text = new TextDecoder('windows-1254').decode(buf); }
  const g = Core.parseGutenberg(text), fn = Core.fromFilename(file.name);
  return {title: g.title || fn.title, author: g.author || fn.author, lang: g.lang, blocks: Core.parseText(g.body)};
}
async function readEpub(file) {
  if (!window.JSZip) throw new Error('EPUB okuyucu yüklenemedi. Kitabı .txt olarak aç ya da metnini yapıştır.');
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
async function openFile(file) {
  const msg = $('fileMsg'); msg.className = ''; msg.textContent = 'Açılıyor…';
  try {
    const b = /\.epub$/i.test(file.name) ? await readEpub(file) : await readTxt(file);
    if (!b.blocks.some(x => !x.h)) throw new Error('Bu dosyada okunacak metin bulunamadı.');
    loadBook(b); $('libDlg').close();
    msg.textContent = '.txt ya da .epub. Dosyayı sayfanın üstüne de bırakabilirsin. Metin bu tarayıcıdan çıkmaz.';
  } catch (err) { msg.className = 'err'; msg.textContent = 'Açılamadı: ' + (err.message || 'dosya okunamadı') + ' Başka bir .txt ya da .epub dene.'; if (!$('libDlg').open) $('libDlg').showModal(); }
}

function loadBook(b) {
  const texts = b.blocks.filter(x => !x.h).map(x => x.t);
  const all = texts.join('\n');
  b.lang = b.lang || Core.detectLang(all);
  b.id = b.id || Core.hashText(all);
  const idn = Core.identifyBook({title: b.title, author: b.author}, all);
  b.title = idn.title; b.author = idn.author; b.known = idn.known; b.evidence = idn.evidence;
  book = b; paras = []; chunks = []; active = -2; committed = -2; cum = [0];
  overrides = store.get('ov:' + b.id, []);
  stopListen();

  // Çözümleme
  const items = []; let brk = true, chap = 0;
  for (const bl of b.blocks) { if (bl.h) { brk = true; chap++; continue; } const a = Core.analyze(bl.t, b.lang); items.push({v: a.v, n: a.n, amb: a.amb, brk}); paras.push({t: bl.t, n: a.n, chap, brk, el: null, sec: 0}); cum.push(cum[cum.length - 1] + a.n); brk = false; }
  dec = Core.decode(items);
  mood = Uint8Array.from(dec.mood); neutral = Uint8Array.from(dec.neutral);
  for (const o of overrides) for (let i = o.a; i <= o.b && i < mood.length; i++) { mood[i] = o.m; neutral[i] = 0; }
  for (let i = 0; i < paras.length; i++) { let e = i; while (e + 1 < paras.length && paras[e + 1].chap === paras[i].chap) e++; for (let k = i; k <= e; k++) paras[k].chapEnd = e; i = e; }

  // Sayfa: ön sayfa + 40'ar bloklu bölümler (ekran dışındakiler çizilmez)
  art.textContent = ''; art.lang = b.lang;
  art.appendChild(buildFront());
  let sec = null, count = 0, pi = 0;
  for (const bl of b.blocks) {
    if (!sec || count >= 40) { sec = document.createElement('section'); sec.className = 'chunk'; art.appendChild(sec); chunks.push({el: sec, ps: []}); count = 0; }
    const el = document.createElement(bl.h ? 'h2' : 'p'); el.textContent = bl.t; sec.appendChild(el); count++;
    if (!bl.h) { paras[pi].el = el; paras[pi].sec = chunks.length - 1; el.dataset.i = pi; chunks[chunks.length - 1].ps.push(pi); pi++; }
  }
  $('tbook').textContent = b.title + (b.author ? ' · ' + b.author : '');
  if (engine) engine.tonic(Core.tonicFor(b.title).midi);

  // Kayıt: son kitap metni (sığarsa) ve kitaplık dizini
  if (b.sample) store.del('book');
  else { const js = {id: b.id, title: b.title, author: b.author, lang: b.lang, blocks: b.blocks}; if (JSON.stringify(js).length > 2500000 || !store.set('book', js)) store.del('book'); }
  const pos = touchIndex();
  drawThread(); drawFrontBar();
  if (pos > 0 && paras[pos]) jumpTo(pos, true); else window.scrollTo(0, 0);
  requestAnimationFrame(() => track(true));
}
function touchIndex(para) {                // kitaplık dizini: en çok 12 kitap, en son açılan başta
  if (!book || book.sample) return 0;
  let idx = store.get('idx', []); const old = idx.find(x => x.id === book.id);
  const lens = paras.map(p => p.n), e = {id: book.id, title: book.title, author: book.author, n: paras.length, para: para !== undefined ? para : (old ? old.para : 0), bar: Core.barcode(mood, lens, 60), last: Date.now()};
  idx = [e, ...idx.filter(x => x.id !== book.id)].slice(0, 12); store.set('idx', idx);
  return e.para;
}
let posT = null;
function savePos() { clearTimeout(posT); posT = setTimeout(() => { if (active >= 0) touchIndex(active); }, 900); }

function buildFront() {
  const f = document.createElement('section'); f.className = 'front';
  const words = cum[cum.length - 1], mins = Math.max(1, Math.round(words / WPM)), ton = Core.tonicFor(book.title);
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; f.appendChild(e); return e; };
  add('p', 'fkick', book.sample ? 'Örnek metin. Kendi kitabını açmak için sol üstteki Satır Arası’na bas.' : (book.known ? 'Kitap tanındı' : 'Yeni kitap'));
  add('h1', 'ftitle', book.title);
  add('p', 'fauthor', book.author || 'Yazarı bilinmiyor');
  const cv = add('canvas', 'fbar'); cv.id = 'frontBar'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Kitabın baştan sona duygu şeridi');
  const cap = add('div', 'fbarcap'); cap.append(Object.assign(document.createElement('span'), {textContent: 'Kitabın havası, baştan sona'}), Object.assign(document.createElement('span'), {textContent: paras.length + ' paragraf'}));
  const dl = add('dl', 'fmeta');
  const row = (k, v) => { dl.append(Object.assign(document.createElement('dt'), {textContent: k}), Object.assign(document.createElement('dd'), {textContent: v})); };
  row('Dil', book.lang === 'tr' ? 'Türkçe' : 'İngilizce');
  row('Okuma süresi', mins < 60 ? 'yaklaşık ' + mins + ' dakika' : 'yaklaşık ' + (mins / 60).toFixed(1).replace('.', ',') + ' saat');
  row('Baskın hava', INFO[M[dec.dominant]].ad + ' · ' + INFO[M[dec.dominant]].tur);
  row('Kitabın tonu', ton.ad + ' (müzik bu ses üzerine kurulur)');
  if (book.evidence) row('Tanıma', book.evidence);
  add('p', 'fhint', 'Aşağı kaydırıp okumaya başla. Müziği alttaki üçgenle açarsın; hava değiştikçe o da değişir.');
  return f;
}
function paint(cv, drawer) {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; if (!r.width || !r.height) return;
  cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  const g = cv.getContext('2d'); g.scale(d, d); g.clearRect(0, 0, r.width, r.height); drawer(g, r.width, r.height);
}
const moodCols = () => M.map(m => css('--m-' + m));
function drawFrontBar() {
  const cv = $('frontBar'); if (!cv || !paras.length) return;
  const col = moodCols(), tot = cum[cum.length - 1] || 1;
  paint(cv, (g, w, h) => { for (let i = 0; i < paras.length; i++) { const x = cum[i] / tot * w, x2 = cum[i + 1] / tot * w; g.globalAlpha = neutral[i] ? 0.35 : 1; g.fillStyle = col[mood[i]]; g.fillRect(x, 0, Math.max(x2 - x, 0.6), h); } });
}

/* ---------- İplik: duygu haritası ve kaydırma çubuğu ---------- */
const thread = $('thread');
function drawThread() {
  if (!paras.length) return;
  const col = moodCols(), tot = cum[cum.length - 1] || 1, rule = css('--ink-2');
  paint($('threadCv'), (g, w, h) => {
    const vert = h > w, L = vert ? h : w;
    for (let i = 0; i < paras.length; i++) {
      const a = cum[i] / tot * L, b = cum[i + 1] / tot * L;
      g.globalAlpha = (i <= active ? 1 : 0.3) * (neutral[i] ? 0.55 : 1); g.fillStyle = col[mood[i]];
      if (vert) g.fillRect(w / 2 - 1.5, a, 3, Math.max(b - a, 0.6)); else g.fillRect(a, h / 2 - 1.5, Math.max(b - a, 0.6), 3);
      if (paras[i].brk && i > 0) { g.globalAlpha = 0.7; g.fillStyle = rule; if (vert) g.fillRect(w / 2 - 6, a, 12, 1); else g.fillRect(a, h / 2 - 5, 1, 10); }
    }
  });
  moveMark();
}
function moveMark() {
  const r = thread.getBoundingClientRect(), vert = r.height > r.width, tot = cum[cum.length - 1] || 1;
  const f = active < 0 ? 0 : (cum[active] + paras[active].n / 2) / tot;
  $('tmark').style.transform = vert ? `translateY(${Math.round(f * r.height)}px)` : `translateX(${Math.round(f * r.width)}px)`;
  thread.setAttribute('aria-valuenow', Math.round(f * 100));
}
function threadSeek(e) {
  const r = thread.getBoundingClientRect(), vert = r.height > r.width, tot = cum[cum.length - 1] || 1;
  const f = Math.max(0, Math.min(1, vert ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width)), target = f * tot;
  let lo = 0, hi = paras.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid + 1] < target) lo = mid + 1; else hi = mid; }
  jumpTo(lo, true);
}
let dragging = false;
thread.addEventListener('pointerdown', e => { dragging = true; thread.setPointerCapture(e.pointerId); threadSeek(e); });
thread.addEventListener('pointermove', e => { if (dragging) threadSeek(e); });
thread.addEventListener('pointerup', () => { dragging = false; });
thread.addEventListener('pointercancel', () => { dragging = false; });
thread.addEventListener('keydown', e => { const d = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, PageDown: 10, PageUp: -10}[e.key]; if (d) { e.preventDefault(); jumpTo(Math.max(0, Math.min(paras.length - 1, Math.max(0, active) + d)), true); } });

function jumpTo(i, instant) {
  const p = paras[i]; if (!p) return;
  chunks[p.sec].el.scrollIntoView({block: 'start'});               // önce bölümü çizdir, sonra paragrafa git
  window.scrollTo({top: lineScroll(window.scrollY + p.el.getBoundingClientRect().top + 4), behavior: instant || reduced() ? 'auto' : 'smooth'});
}

/* Belge içindeki P noktasını kayan okuma çizgisine getiren kaydırma konumu (çizgi konumu kaydırmaya bağlı olduğundan kapalı çözüm). */
function lineScroll(P) { const vh = innerHeight, max = Math.max(1, document.documentElement.scrollHeight - vh); return Math.max(0, Math.min(max, (P - 0.25 * vh) / (1 + 0.5 * vh / max))); }

/* ---------- Okuma çizgisini izle ---------- */
function scrollFrac() { const max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? window.scrollY / max : 0; }
function findActive() {
  if (!chunks.length) return -1;
  const y = innerHeight * Core.readingLine(scrollFrac());
  let lo = 0, hi = chunks.length - 1, c = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (chunks[mid].el.getBoundingClientRect().top <= y) { c = mid; lo = mid + 1; } else hi = mid - 1; }
  if (c < 0) return -1;
  const ps = chunks[c].ps; lo = 0; hi = ps.length - 1; let a = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (paras[ps[mid]].el.getBoundingClientRect().top <= y) { a = mid; lo = mid + 1; } else hi = mid - 1; }
  if (a >= 0) return ps[a];
  return c > 0 && chunks[c - 1].ps.length ? chunks[c - 1].ps[chunks[c - 1].ps.length - 1] : -1;
}
function track(now) {
  if (!paras.length) return;
  const i = findActive();
  if (i === active && !now) return;
  if (active >= 0 && paras[active]) { paras[active].el.classList.remove('now'); if (decorated === active && !listening) undecorate(); }
  active = i;
  if (i >= 0) paras[i].el.classList.add('now');
  updatePos(); drawThread(); savePos();
  clearTimeout(dwellT);
  if (now) commit(); else if (!browsing) dwellT = setTimeout(commit, dwellMs(i));
}
const dwellMs = i => i < 0 ? 1200 : Math.max(1200, Math.min(4000, paras[i].n / WPM * 60000 * 0.15));
function updatePos() {
  if (active < 0) { $('tpos').textContent = 'ön sayfa'; return; }
  const left = cum[paras[active].chapEnd + 1] - cum[active], mins = Math.round(left / WPM);
  $('tpos').textContent = '¶ ' + (active + 1) + ' / ' + paras.length + (mins >= 1 ? ' · bölüm sonuna ~' + mins + ' dk' : '');
}

/* Karar: bekleme süresi dolunca müziğe bildir. */
function stateFor(i) {
  if (force >= 0) return {mood: force, neutral: false, intensity: 0.6, confidence: 0.9, ambience: ambFor(i)};
  if (i < 0) return {mood: dec.dominant, neutral: true, intensity: 0.3, confidence: 0.4, ambience: []};
  return {mood: mood[i], neutral: !!neutral[i], intensity: dec.inten[i], confidence: Math.max(0.2, dec.conf[i]), ambience: ambFor(i)};
}
const ambFor = i => (set.amb && i >= 0 && dec.amb[i] >= 0) ? [Core.AMBS[dec.amb[i]]] : [];
function commit() {
  if (!dec) return;
  const prev = committed; committed = active;
  const st = stateFor(active);
  if (engine) { engine.set(Object.assign({browsing: false, idle, mic: listening}, st));
    if (prev >= 0 && active > prev && active - prev < 4 && paras[active].chap !== paras[prev].chap) engine.chapter(); }
  if (!engine || !engine.playing || engine.mood === st.mood || (prev < 0) !== (active < 0)) showMood(st.mood, 2.5);
  describe(st);
}
function describe(st) {
  const i = committed, b = $('moodBtn'); b.classList.toggle('neutral', !!st.neutral && force < 0);
  let why;
  if (force >= 0) why = 'elle seçildi';
  else if (i < 0) why = 'kitabın genel havası';
  else if (st.neutral) why = 'belirgin ipucu yok, önceki hava sürüyor';
  else { const cues = cuesFor(i).filter(c => c.m === M[st.mood] && !c.neg).map(c => c.w); why = cues.length ? 'ipucu: ' + [...new Set(cues)].slice(0, 3).join(', ') : 'sahnenin havası sürüyor'; }
  if (st.ambience.length) why += ' · ' + Core.AMB_AD[st.ambience[0]] + ' sesi';
  $('why').textContent = why;
}
const cuesFor = i => i < 0 ? [] : Core.analyze(paras[i].t, book.lang).cues;

/* Renk, levha ve duygu adı birlikte değişir; müzik çalıyorsa motorun geçişiyle eşzamanlı. */
let flip = false;
function showMood(m, fade) {
  const id = M[m], pic = committed < 0 ? 'kapak' : id, keyNow = m + pic;
  if (keyNow === shown) return; shown = keyNow;
  document.documentElement.style.setProperty('--mood', 'var(--m-' + id + ')');
  $('moodBtn').textContent = INFO[id].ad; $('plateMood').textContent = INFO[id].ad;
  const on = $(flip ? 'pA' : 'pB'), off = $(flip ? 'pB' : 'pA'); flip = !flip;
  const dur = (reduced() ? 0 : Math.min(4, fade || 3)) + 's';
  on.style.transitionDuration = off.style.transitionDuration = dur;
  on.style.backgroundImage = 'url(ink/' + pic + '.jpg)'; on.classList.add('on'); off.classList.remove('on');
}

/* ---------- Kaydırma: hız, üst çubuk, dalgınlık ---------- */
let lastY = 0, lastT = 0, ticking = false, calmT = null, speed = 0;
function onScroll() {
  const now = performance.now(), y = window.scrollY, dt = Math.max(1, now - lastT);
  speed = speed * 0.6 + Math.abs(y - lastY) / dt * 1000 * 0.4;
  if (y > lastY + 4 && y > 200) document.body.classList.add('tophide'); else if (y < lastY - 4 || y < 200) document.body.classList.remove('tophide');
  lastY = y; lastT = now;
  const fast = speed > innerHeight * 1.5;
  if (fast && !browsing) { browsing = true; if (engine) engine.set({browsing: true}); }   // sayfa çevirirken müzik donar
  clearTimeout(calmT); calmT = setTimeout(() => { speed = 0; if (browsing) { browsing = false; track(true); } }, 350);
  wake();
  if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; track(); }); }
}
function wake() {
  if (idle) { idle = false; if (engine) engine.set({idle: false}); }
  clearTimeout(idleT); idleT = setTimeout(() => { idle = true; if (engine) engine.set({idle: true}); }, 150000);   // 2,5 dk kıpırtı yoksa yalnızca ped
}
addEventListener('scroll', onScroll, {passive: true});
addEventListener('pointerdown', wake, {passive: true}); addEventListener('keydown', wake);
let rsT = null;
addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { drawThread(); drawFrontBar(); track(true); }, 120); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawThread(); drawFrontBar(); });
new MutationObserver(() => { drawThread(); drawFrontBar(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

/* ---------- Müzik ---------- */
const PLAY = 'M6 3.5v15l12.5-7.5z', PAUSE = 'M5.5 3.5h4v15h-4zM12.5 3.5h4v15h-4z';
function ensureEngine() {
  if (engine) return engine;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  engine = Engine.create(actx, {seed: 1 + Math.floor(Math.random() * 1e6), tonic: Core.tonicFor(book ? book.title : '').midi, volume: set.vol / 100, small: innerWidth < 700});
  engine.onMood = (m, fade) => showMood(m, fade);
  for (const k in pendingTracks) engine.setCustom(+k, pendingTracks[k]);
  return engine;
}
let wakeLock = null;
async function togglePlay() {
  ensureEngine();
  if (engine.playing) { engine.stop(); if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  else { engine.set(Object.assign({browsing: false, idle: false, mic: listening}, stateFor(active)));
    try { await engine.start(); } catch (e) { toast('Ses başlatılamadı. Sayfaya bir kez dokunup yeniden dene.'); return; }
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; }).catch(() => {}); }
  $('playGlyph').setAttribute('d', engine.playing ? PAUSE : PLAY);
  $('play').setAttribute('aria-label', engine.playing ? 'Müziği duraklat' : 'Müziği başlat');
}
$('play').addEventListener('click', togglePlay);
$('vol').value = set.vol;
$('vol').addEventListener('input', e => { set.vol = +e.target.value; if (engine) engine.volume(set.vol / 100); saveSet(); });

/* ---------- Paragraf süsleme: ipucu altı çizgisi ya da sesle okunan kelimeler ---------- */
let decorated = -1;
function undecorate() { if (decorated >= 0 && paras[decorated]) paras[decorated].el.textContent = paras[decorated].t; decorated = -1; }
function decorate(i, ranges) {            // ranges: [{i, len, cls, c}] sıralı ve çakışmasız
  undecorate(); const p = paras[i]; if (!p) return; const t = p.t, frag = document.createDocumentFragment(); let at = 0;
  for (const r of ranges) { if (r.i < at) continue; frag.append(t.slice(at, r.i)); const e = document.createElement(r.tag || 'span'); e.className = r.cls; if (r.c) e.style.setProperty('--c', r.c); e.textContent = t.slice(r.i, r.i + r.len); frag.append(e); at = r.i + r.len; }
  frag.append(t.slice(at)); p.el.textContent = ''; p.el.append(frag); decorated = i;
}

/* ---------- "Neden bu müzik?" ---------- */
function openWhy() {
  const i = committed, st = stateFor(i), id = M[st.mood];
  $('whyTitle').textContent = 'Neden ' + INFO[id].ad.toLocaleLowerCase('tr') + '?';
  const txt = $('whyText'); txt.textContent = '';
  if (force >= 0) txt.textContent = 'Müzik kipini elle seçtin; Ayarlar’dan Otomatik’e dönebilirsin.';
  else if (i < 0) txt.textContent = 'Henüz ön sayfadasın. Müzik kitabın baskın havasıyla, alçak sesle bekliyor.';
  else {
    const cues = cuesFor(i).filter(c => !c.neg);
    if (!listening && cues.length) decorate(i, cues.map(c => ({i: c.i, len: c.len, tag: 'u', cls: 'cue', c: 'var(--m-' + c.m + ')'})));
    if (st.neutral || !cues.length) txt.textContent = 'Bu paragrafta belirgin bir ipucu yok; önceki sahnenin havası sürüyor.';
    else { const by = {}; for (const c of cues) (by[c.m] || (by[c.m] = new Set())).add(c.w);
      Object.keys(by).sort((a, b) => (b === id) - (a === id)).forEach((m, k) => { if (k) txt.append(' · '); const u = document.createElement('u'); u.className = 'cue'; u.style.setProperty('--c', 'var(--m-' + m + ')'); u.textContent = [...by[m]].join(', '); txt.append(u, ' → ' + INFO[m].ad.toLocaleLowerCase('tr')); });
    }
  }
  const bits = [];
  if (i >= 0 && force < 0) { const c = dec.conf[i]; bits.push('Güven: ' + (c > 0.6 ? 'yüksek' : c > 0.3 ? 'orta' : 'düşük')); if (overrides.some(o => i >= o.a && i <= o.b)) bits.push('bu sahneyi sen etiketledin'); }
  if (st.ambience.length) bits.push('metinde ' + Core.AMB_AD[st.ambience[0]] + ' geçtiği için o ses de açık');
  $('whyMeta').textContent = bits.join(' · ');
  for (const b of $('relabel').children) b.setAttribute('aria-pressed', i >= 0 && +b.dataset.m === mood[i] && !neutral[i]);
  $('whyDlg').showModal();
}
$('moodBtn').addEventListener('click', openWhy);
$('whyDlg').addEventListener('close', () => { if (!listening) undecorate(); });
function relabel(m) {
  const i = committed; if (i < 0) return;
  let a = i, b = i; const cur = dec.mood[i];
  while (a > 0 && dec.mood[a - 1] === cur && !paras[a].brk) a--;
  while (b + 1 < paras.length && dec.mood[b + 1] === cur && !paras[b + 1].brk) b++;
  overrides = overrides.filter(o => o.b < a || o.a > b);
  if (m >= 0) overrides.push({a, b, m});
  store.set('ov:' + book.id, overrides);
  for (let k = a; k <= b; k++) { mood[k] = m >= 0 ? m : dec.mood[k]; neutral[k] = m >= 0 ? 0 : dec.neutral[k]; }
  drawThread(); drawFrontBar(); commit(); $('whyDlg').close();
  toast(m >= 0 ? 'Bu sahne artık ' + INFO[M[m]].ad.toLocaleLowerCase('tr') + ' olarak çalıyor.' : 'Bu sahne yeniden otomatik.', 4000);
}
function moodButtons(host, onPick, withAuto) {
  if (withAuto) { const b = document.createElement('button'); b.textContent = 'Otomatik'; b.dataset.m = -1; b.addEventListener('click', () => onPick(-1)); host.append(b); }
  M.forEach((id, k) => { const b = document.createElement('button'); b.dataset.m = k; const dot = document.createElement('i'); dot.style.setProperty('--c', 'var(--m-' + id + ')'); b.append(dot, INFO[id].ad); b.addEventListener('click', () => onPick(k)); host.append(b); });
}
moodButtons($('relabel'), relabel, true);
moodButtons($('forceMoods'), m => { force = m; syncForce(); commit(); }, true);
function syncForce() { for (const b of $('forceMoods').children) b.setAttribute('aria-pressed', +b.dataset.m === force); }
syncForce();

/* ---------- Sesle takip ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, aligner = null, lastCursor = -1;
function stopListen(msg) {
  if (!listening && !msg) return;
  listening = false; document.body.classList.remove('listening');
  if (rec) { try { rec.stop(); } catch (e) {} }
  $('mic').setAttribute('aria-pressed', 'false'); undecorate();
  if (engine) engine.set({mic: false});
  toast(msg || 'Dinleme kapandı.', msg ? 8000 : 2500);
}
function startListen() {
  aligner = new Core.Aligner(paras.map(p => p.t), book.lang);
  aligner.seek(Math.max(0, active)); lastCursor = -1;
  rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = book.lang === 'tr' ? 'tr-TR' : 'en-US';
  rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) aligner.feed(e.results[i][0].transcript, e.results[i].isFinal); follow(); };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopListen('Mikrofon izni verilmedi. Adres çubuğundaki mikrofon simgesinden izin verip yeniden dene.');
    else if (e.error === 'network') stopListen('Ses tanıma servisine ulaşılamadı. İnternet bağlantını kontrol et ya da sayfayı Chrome ile aç.');
    else if (e.error === 'audio-capture') stopListen('Mikrofon bulunamadı. Bir mikrofon bağlayıp yeniden dene.');
  };
  let backoff = 250;
  rec.onend = () => { if (listening) setTimeout(() => { if (listening) { try { rec.start(); } catch (e) {} } }, backoff = Math.min(4000, backoff * 1.5)); };
  rec.onstart = () => { backoff = 250; };
  try { rec.start(); } catch (e) { toast('Dinleme başlatılamadı. Yeniden dene.'); return; }
  listening = true; document.body.classList.add('listening'); $('mic').setAttribute('aria-pressed', 'true');
  if (engine) engine.set({mic: true});
  toast('Dinliyorum: sesli oku, sayfa seni izler. Kaybolursam bulunduğun paragrafa dokun. Tarayıcı sesi tanımak için Google’a gönderir; kulaklık takarsan daha iyi duyarım.', 12000);
}
function follow() {
  if (!aligner || aligner.cursor === lastCursor) return; lastCursor = aligner.cursor;
  const pi = aligner.paraIndex, p = paras[pi]; if (!p) return;
  const toks = Core.tokenize(p.t, book.lang).filter(t => !t.p), n = aligner.wordInPara;
  decorate(pi, toks.slice(0, n).map(t => ({i: t.i, len: t.len, cls: 'said'})));
  if (!chunks[p.sec].el.getBoundingClientRect().height) chunks[p.sec].el.scrollIntoView({block: 'start'});
  const r = p.el.getBoundingClientRect();
  const y = lineScroll(window.scrollY + r.top + r.height * aligner.frac * 0.9 + 6);
  if (Math.abs(y - window.scrollY) > 24) window.scrollTo({top: y, behavior: reduced() ? 'auto' : 'smooth'});
}
if (SR) { $('mic').hidden = false; $('mic').addEventListener('click', () => listening ? stopListen() : startListen()); }
art.addEventListener('click', e => { if (!listening) return; const p = e.target.closest('p[data-i]'); if (p) { aligner.seek(+p.dataset.i); lastCursor = -1; follow(); toast('Buradan devam ediyorum.', 2500); } });
for (const ev of ['wheel', 'touchmove']) addEventListener(ev, () => { if (listening) { clearTimeout(follow.t); follow.t = setTimeout(() => { if (listening && active >= 0 && active !== aligner.paraIndex) { aligner.seek(active); lastCursor = -1; } }, 500); } }, {passive: true});

/* ---------- Kitaplık ve ayarlar ---------- */
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
function openLib() {
  const idx = store.get('idx', []), sh = $('shelf'); sh.textContent = ''; $('shelfBox').hidden = !idx.length;
  const saved = store.get('book', null), col = moodCols();
  for (const e of idx) {
    const b = document.createElement('button'); b.className = 'srow';
    const cv = document.createElement('canvas');
    b.append(Object.assign(document.createElement('b'), {textContent: e.title + (e.author ? ' · ' + e.author : '')}), Object.assign(document.createElement('span'), {textContent: '¶ ' + (e.para + 1) + ' / ' + e.n}), cv);
    b.addEventListener('click', () => {
      if (book && book.id === e.id) { $('libDlg').close(); return; }
      if (saved && saved.id === e.id) { loadBook(saved); $('libDlg').close(); }
      else { $('fileMsg').className = ''; $('fileMsg').textContent = '“' + e.title + '” metni bu tarayıcıda saklanmadı. Dosyasını yeniden seç; kaldığın paragraftan devam edersin.'; $('file').click(); }
    });
    sh.append(b);
    requestAnimationFrame(() => paint(cv, (g, w, h) => { const n = e.bar.length; for (let k = 0; k < n; k++) { g.fillStyle = col[+e.bar[k]]; g.fillRect(k / n * w, 0, w / n + 0.5, h); } }));
  }
  $('libDlg').showModal();
}
$('brand').addEventListener('click', openLib);
$('openFile').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; });
$('showPaste').addEventListener('click', () => { $('pasteBox').hidden = !$('pasteBox').hidden; if (!$('pasteBox').hidden) $('pasteText').focus(); });
$('pasteGo').addEventListener('click', () => { const t = $('pasteText').value.trim(); if (!t) { $('pasteText').focus(); return; } const g = Core.parseGutenberg(t); loadBook({title: $('pasteTitle').value.trim() || g.title || 'Yapıştırılan metin', author: g.author, lang: g.lang, blocks: Core.parseText(g.body)}); $('libDlg').close(); });
$('sampleGo').addEventListener('click', () => { loadBook(Object.assign({}, Core.SAMPLE)); $('libDlg').close(); });
let dragN = 0;
addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; $('drop').hidden = false; } });
addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) $('drop').hidden = true; });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragN = 0; $('drop').hidden = true; const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) openFile(f); });

$('setBtn').addEventListener('click', () => $('setDlg').showModal());
const BASE = () => innerWidth >= 1100 ? 19 : 17;
function applyFs() { if (set.fs) art.style.setProperty('--fs', (BASE() + set.fs) + 'px'); else art.style.removeProperty('--fs'); requestAnimationFrame(() => track(true)); }
$('fsDown').addEventListener('click', () => { set.fs = Math.max(-4, set.fs - 1); saveSet(); applyFs(); });
$('fsUp').addEventListener('click', () => { set.fs = Math.min(8, set.fs + 1); saveSet(); applyFs(); });
function applyTheme() { if (set.theme) document.documentElement.dataset.theme = set.theme; else if (themeTouched) delete document.documentElement.dataset.theme; for (const b of $('themeSeg').children) b.setAttribute('aria-pressed', b.dataset.v === set.theme); }
let themeTouched = false;
for (const b of $('themeSeg').children) b.addEventListener('click', () => { themeTouched = true; set.theme = b.dataset.v; saveSet(); applyTheme(); });
function applyImg() { document.body.classList.toggle('noimg', !set.img); $('imgOn').checked = set.img; requestAnimationFrame(() => { drawThread(); track(true); }); }
$('imgOn').addEventListener('change', e => { set.img = e.target.checked; saveSet(); applyImg(); });
$('ambOn').checked = set.amb;
$('ambOn').addEventListener('change', e => { set.amb = e.target.checked; saveSet(); commit(); });
const pendingTracks = {};
M.forEach((id, k) => {
  const l = document.createElement('label'); l.htmlFor = 'trk-' + id; const dot = document.createElement('i'); dot.style.setProperty('--c', 'var(--m-' + id + ')'); l.append(dot, INFO[id].ad);
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*'; inp.id = 'trk-' + id;
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) { delete pendingTracks[k]; if (engine) engine.setCustom(k, null); return; }
    try { ensureEngine(); const buf = await actx.decodeAudioData(await f.arrayBuffer()); pendingTracks[k] = buf; engine.setCustom(k, buf); } catch (e) { inp.value = ''; toast('Bu ses dosyası çözülemedi. MP3, WAV ya da OGG dene.'); }
  });
  $('trkList').append(l, inp);
});
const tl = document.querySelector('a[href="test.html"]');
if (tl && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) tl.closest('section').hidden = true;
[...M, 'kapak'].forEach(id => { const im = new Image(); im.src = 'ink/' + id + '.jpg'; });

/* ---------- Açılış ---------- */
document.documentElement.lang = 'tr';
applyTheme(); applyImg(); applyFs();
const savedBook = store.get('book', null);
loadBook(savedBook && savedBook.blocks ? savedBook : Object.assign({}, Core.SAMPLE));
wake();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawThread(); track(true); });
window.__sa = {get state() { return {active, committed, shown, browsing, idle, listening, paras: paras.length, chunks: chunks.length, mood: active >= 0 ? M[mood[active]] : null, engine: engine ? {playing: engine.playing, mood: engine.mood, nodes: engine.nodes} : null}; }, jumpTo, feed: (t, f) => { if (aligner) { aligner.feed(t, f); follow(); } }, startAligner: () => { aligner = new Core.Aligner(paras.map(p => p.t), book.lang); aligner.seek(Math.max(0, active)); listening = true; }, loadBook};
})();
