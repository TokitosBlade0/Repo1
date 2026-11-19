/* Satır Arası — kapak hattı (window.SA_Covers; Node'da module.exports).
   1) Gerçek kapak: Open Library, sonra Google Books (anahtarsız). Yalnızca kendinden emin başlık eşleşmesi kabul edilir.
   2) Gemini anahtarı varsa: metin modelinden tek istekte sahne özeti + tasarım tarifi; görsel üretebilen model varsa yazısız resim.
   3) Her zaman çalışan son çare: tarif (JSON) → kendi çizdiğimiz SVG motifleriyle tipografik kapak. */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require === 'function' ? require('./core.js') : null);
  const MOODS = (Core && Core.MOODS) || ['huzur', 'huzun', 'gerilim', 'karanlik', 'nese', 'ask', 'macera', 'gizem'];

  /* ---------- Motifler: 100×100 kutuda, çizgi (stroke) olarak ---------- */
  const MOTIFS = {
    moon: '<path d="M60 16a35 35 0 1 0 24 54A29 29 0 1 1 60 16z"/><path d="M24 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM80 84l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"/>',
    wave: '<path d="M6 56c11-11 22-11 33 0s22 11 33 0 18-10 22-6M6 72c11-11 22-11 33 0s22 11 33 0 18-10 22-6M6 40c11-11 22-11 33 0s22 11 33 0 18-10 22-6"/>',
    key: '<circle cx="28" cy="50" r="15"/><circle cx="28" cy="50" r="5"/><path d="M43 50h46M78 50v12M88 50v9M66 50v7"/>',
    rose: '<path d="M50 24c-12 0-18 9-18 18 0 11 8 18 18 18s18-7 18-18c0-9-6-18-18-18zM50 33c-6 0-9 4-9 9s4 9 9 9 9-4 9-9-3-8-8-8M50 60v32M50 76c-8-7-17-5-22 0 7 5 15 5 22 0zM50 84c8-7 17-5 22 0-7 5-15 5-22 0z"/>',
    castle: '<path d="M14 90V46h10v-9h8v9h8V28h20v18h8v-9h8v9h10v44zM42 90V72a8 8 0 0 1 16 0v18M14 46h72M48 28v-12l12 4-12 4"/>',
    ship: '<path d="M12 66h76l-12 18H24zM50 66V12M50 16l28 44H50M50 22L26 60h24M6 92c8-4 14-4 22 0s14 4 22 0 14-4 22 0 14 4 22 0"/>',
    tree: '<path d="M50 92V54M50 66l-14-11M50 60l13-12M36 92h28"/><circle cx="50" cy="36" r="25"/><path d="M38 30c4-6 10-8 16-6M58 44c4-2 6-6 6-10"/>',
    eye: '<path d="M8 50s17-26 42-26 42 26 42 26-17 26-42 26S8 50 8 50z"/><circle cx="50" cy="50" r="13"/><circle cx="50" cy="50" r="4"/><path d="M50 14v6M28 20l3 5M72 20l-3 5"/>',
    feather: '<path d="M80 12C46 18 24 46 22 90M80 12C78 46 58 72 26 82M38 62l16-3M46 48l15-3M56 34l13-3M30 74l14-2"/>',
    flame: '<path d="M50 10c7 18 28 29 28 52a28 28 0 0 1-56 0c0-15 10-22 13-34 6 9 7 15 15 19 4-13-2-25 0-37zM50 90c-9 0-13-7-13-13 0-9 9-13 13-21 4 8 13 12 13 21 0 6-4 13-13 13z"/>',
    mountain: '<path d="M4 84l30-46 14 20 13-17 35 43zM27 49l7 7 7-7M57 50l4 4 5-5"/><circle cx="76" cy="22" r="7"/>',
    lighthouse: '<path d="M39 90l5-52h12l5 52zM41 38h18l-3-11H44zM46 27v-7h8v7M60 24l28-9M60 30l28 9M40 24l-28-9M40 30l-28 9M10 90h80M43 56h14M42 72h16"/>',
    sword: '<path d="M50 6l6 9v55H44V15zM30 70h40M50 70v16M50 15v50"/><circle cx="50" cy="91" r="4"/>',
    mask: '<path d="M12 32c13-7 25-7 38 0 13-7 25-7 38 0 0 26-13 42-25 42-7 0-11-6-13-11-2 5-6 11-13 11-12 0-25-16-25-42z"/><path d="M24 46c5-5 11-5 16 0M60 46c5-5 11-5 16 0M40 64c6 4 14 4 20 0"/>',
    bird: '<path d="M8 56c15-5 25 0 31 8 6-17 21-26 36-26l13 6-13 5c-2 23-21 36-42 36-10 0-19-6-25-15 9 2 15 0 19-4-7 0-13-4-19-10z"/><circle cx="74" cy="42" r="1.5"/>',
    star: '<path d="M50 8l10.5 29.5H92L66.5 56l9.5 31L50 68.5 24 87l9.5-31L8 37.5h31.5z"/><path d="M50 28l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z"/>'
  };
  const MOTIF_NAMES = Object.keys(MOTIFS);
  const LAYOUTS = ['center', 'band', 'frame'];
  const MOOD_PAL = {huzur: ['#22382c', '#b9d3b0'], huzun: ['#1d2a3d', '#a9c0dc'], gerilim: ['#3a1d10', '#e8a15e'], karanlik: ['#1a0f12', '#c97a6f'],
    nese: ['#3b2e0e', '#f1d27a'], ask: ['#3a1620', '#efb1bc'], macera: ['#0f3330', '#8fd3c8'], gizem: ['#1e1c33', '#c4c0ea']};
  const MOOD_MOTIF = {huzur: 'tree', huzun: 'feather', gerilim: 'sword', karanlik: 'castle', nese: 'bird', ask: 'rose', macera: 'ship', gizem: 'key'};
  // Sözcük başı eşleşmesi (Türkçe ekleri kabul eder: “denizde”, “fenerin”)
  const KEYWORDS = [
    ['lighthouse', 'lighthouse|fener|harbour|liman'], ['moon', 'moon|night|gece|lunar|mehtap'], ['ship', 'ship|sail|whale|gemi|kaptan|captain|balina|voyage'],
    ['wave', 'sea |ocean|wave|deniz|dalga|okyanus|river|nehir'], ['castle', 'castle|vampire|şato|kale |gothic|abbey'],
    ['rose', 'love|rose|heart|aşk|gül |sevgi|marriage|evlilik'], ['key', 'key|secret|anahtar|sır |mystery|gizem|detective|dedektif'],
    ['eye', 'eye|göz|spy|casus'], ['sword', 'sword|war |battle|kılıç|savaş|knight|şövalye'], ['flame', 'fire|flame|ateş|alev|yangın'],
    ['mountain', 'mountain|dağ|peak|journey|yolculuk'], ['tree', 'tree|forest|ağaç|orman|garden|bahçe'], ['bird', 'bird|kuş|wing|kanat'],
    ['mask', 'mask|maske|theatre|tiyatro|disguise'], ['feather', 'feather|tüy|letter|mektup|poem|şiir'], ['star', 'star|yıldız|prince|prens|dream|rüya|wonder']
  ].map(([m, w]) => [m, new RegExp('(?:^|[^\\p{L}])(?:' + w + ')', 'u')]);

  /* ---------- Başlık eşleşmesi (Türkçe duyarlı) ---------- */
  const FOLD = {'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u'};
  function norm(s) {
    let t = String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
    t = t.replace(/[çğıöşüâîû]/g, c => FOLD[c]).normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    return t.replace(/^(the|a|an) /, '');
  }
  const mainTitle = s => String(s || '').split(/\s*[:;(\[]\s*|\s+[-–—]\s+|\s*\/\s*/)[0];
  const tokens = s => norm(s).split(' ').filter(Boolean);
  function titleScore(want, got) {
    const a = norm(mainTitle(want)), b = norm(mainTitle(got));
    if (!a || !b) return 0;
    if (a === b || norm(want) === norm(got)) return 1;
    const A = new Set(a.split(' ')), B = new Set(b.split(' '));
    let inter = 0; for (const x of A) if (B.has(x)) inter++;
    return inter / (A.size + B.size - inter);
  }
  function authorOk(want, got) {
    const w = tokens(want);
    if (!w.length) return true;
    const g = new Set([].concat(got || []).flatMap(tokens));
    if (!g.size) return false;
    return w.some(x => x.length > 2 && g.has(x));
  }
  function isConfident(want, got) {
    const s = titleScore(want.title, got.title);
    if (s < 0.9) return false;
    return authorOk(want.author, got.authors) || (s === 1 && !(got.authors || []).length);
  }

  /* ---------- Kaynaklar ---------- */
  const doFetch = (o, ...a) => ((o && o.fetch) || root.fetch)(...a);
  async function fromOpenLibrary(book, o) {
    const q = 'title=' + encodeURIComponent(mainTitle(book.title)) + (book.author ? '&author=' + encodeURIComponent(book.author) : '');
    const r = await doFetch(o, 'https://openlibrary.org/search.json?' + q + '&limit=5&fields=key,title,author_name,cover_i,first_publish_year');
    if (!r.ok) return [];
    const d = await r.json();
    return (d.docs || []).filter(x => x.cover_i && isConfident(book, {title: x.title, authors: x.author_name}))
      .map(x => ({src: 'https://covers.openlibrary.org/b/id/' + x.cover_i + '-L.jpg', source: 'openlibrary', year: x.first_publish_year || null}));
  }
  async function fromGoogleBooks(book, o) {
    const q = 'intitle:' + mainTitle(book.title) + (book.author ? ' inauthor:' + book.author : '');
    const r = await doFetch(o, 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=5&printType=books');
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).map(x => x.volumeInfo || {}).filter(v => v.imageLinks && isConfident(book, {title: v.title, authors: v.authors}))
      .map(v => ({src: String(v.imageLinks.thumbnail || v.imageLinks.smallThumbnail).replace(/^http:/, 'https:').replace(/&edge=curl/, ''), source: 'googlebooks'}));
  }
  // Görsel gerçekten yükleniyor mu ve 1×1 yer tutucu değil mi
  function verifyImage(src, ms) {
    if (typeof root.Image !== 'function') return Promise.resolve(true);
    return new Promise(res => {
      const img = new root.Image(); let done = false;
      const fin = v => { if (!done) { done = true; clearTimeout(t); res(v); } };
      const t = setTimeout(() => fin(false), ms || 9000);
      img.onload = () => fin(img.naturalWidth > 50 && img.naturalHeight > 50);
      img.onerror = () => fin(false);
      img.referrerPolicy = 'no-referrer'; img.src = src;
    });
  }
  // Resmi 400×600 JPEG'e çiz (≈300 KB altında). Kaynak çapraz kökenliyse ve CORS yoksa null.
  function toJpeg(src, maxBytes) {
    maxBytes = maxBytes || 300000;
    if (typeof root.document === 'undefined') return Promise.resolve(null);
    return new Promise(res => {
      const img = new root.Image();
      img.onload = () => {
        try {
          const W = 400, H = 600, cv = root.document.createElement('canvas'); cv.width = W; cv.height = H;
          const g = cv.getContext('2d'), s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
          const w = img.naturalWidth * s, h = img.naturalHeight * s;
          g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
          let q = 0.86, out = cv.toDataURL('image/jpeg', q);
          while (out.length * 0.75 > maxBytes && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
          res(out);
        } catch (_) { res(null); }
      };
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  /* ---------- Tasarım tarifi ---------- */
  const HEX = /^#[0-9a-f]{6}$/i;
  function lum(hex) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function validateSpec(raw, fb) {
    raw = raw && typeof raw === 'object' ? raw : {};
    fb = fb || localSpec({});
    let pal = Array.isArray(raw.palette) ? raw.palette.map(x => String(x || '').trim()).filter(x => HEX.test(x)).slice(0, 2) : [];
    if (pal.length < 2) pal = fb.palette.slice();
    if (lum(pal[0]) > lum(pal[1])) pal = [pal[1], pal[0]];             // [zemin (koyu), vurgu (açık)]
    if (contrast(pal[0], pal[1]) < 3) pal = fb.palette.slice();          // okunmuyorsa yedek palet
    const motif = MOTIF_NAMES.includes(raw.motif) ? raw.motif : fb.motif;
    const layout = LAYOUTS.includes(raw.layout) ? raw.layout : fb.layout;
    const summary = typeof raw.summary === 'string' ? raw.summary.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
    return {palette: pal.map(x => x.toLowerCase()), motif, layout, summary};
  }
  function hashNum(s) { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }
  // Anahtarsız: başlık + ilk paragraflardaki sözcüklerden motif, baskın havadan palet. seed varyant üretir.
  function localSpec(book, seed) {
    seed = seed || 0;
    const mood = MOODS.includes(book.mood) ? book.mood : 'huzur';
    const low = s => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase() + ' ';
    const tl = low(book.title), txt = tl + low(String(book.excerpt || '').slice(0, 3000));
    // Sıra: başlıktaki ipuçları → baskın havanın motifi → açılış metnindeki ipuçları → geri kalanlar
    const order = [];
    const add = m => { if (!order.includes(m)) order.push(m); };
    for (const [m, re] of KEYWORDS) if (re.test(tl)) add(m);
    add(MOOD_MOTIF[mood]);
    for (const [m, re] of KEYWORDS) if (re.test(txt)) add(m);
    MOTIF_NAMES.forEach(add);
    const h = hashNum(book.title || '');
    return {palette: MOOD_PAL[mood].slice(), motif: order[seed % order.length], layout: LAYOUTS[(h + seed) % LAYOUTS.length], summary: ''};
  }
  const SPEC_SCHEMA = {type: 'OBJECT', required: ['summary', 'palette', 'motif', 'layout'], properties: {
    summary: {type: 'STRING'}, palette: {type: 'ARRAY', items: {type: 'STRING'}}, motif: {type: 'STRING', enum: MOTIF_NAMES}, layout: {type: 'STRING', enum: LAYOUTS}}};
  function specPrompt(book) {
    return 'Design a book cover for a reading app.\nTitle: ' + (book.title || 'Untitled') + '\nAuthor: ' + (book.author || 'unknown') +
      '\nDominant mood: ' + (book.mood || 'huzur') + '\nOpening excerpt:\n' + String(book.excerpt || '').slice(0, 1500) +
      '\n\nReturn JSON: summary = one English sentence (max 25 words) describing a single evocative scene from this book for an illustrator; ' +
      'palette = two hex colours [dark background, light accent] with strong contrast; motif = one of ' + MOTIF_NAMES.join(', ') + '; layout = one of ' + LAYOUTS.join(', ') + '.';
  }
  const imagePrompt = (book, spec) => 'A painterly book-cover illustration, portrait 2:3, rich texture, no text, no letters, no title, no watermark. Scene: ' +
    (spec.summary || ('an evocative scene from "' + book.title + '"')) + ' Mood: ' + (book.mood || 'calm') + '. Colour palette around ' + spec.palette.join(' and ') + '.';

  /* ---------- SVG kapak (uygulamanın yazı tipleriyle; satır içi kullanılır) ---------- */
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function wrap(text, max) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    for (const w of words) { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) lines.push(cur);
    if (lines.length > 4) { lines.length = 4; lines[3] = lines[3].replace(/\s*\S*$/, '') + '…'; }
    return lines;
  }
  function renderSVG(spec, book) {
    const [bg, ac] = spec.palette, L = spec.layout, id = 'g' + (hashNum(book.title + spec.motif + L) % 1e6);
    const lines = wrap(book.title || 'Adsız', L === 'band' ? 16 : 14), longest = Math.max(...lines.map(l => l.length), 4);
    const fs = Math.max(26, Math.min(54, Math.round(330 / longest * 1.05)));
    const motifAt = (x, y, s, op) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="none" stroke="' + ac + '" stroke-width="' + (2.2 / s * 2.6).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (op || 0.95) + '">' + MOTIFS[spec.motif] + '</g>';
    const title = (y0, color) => '<text x="200" y="' + y0 + '" text-anchor="middle" fill="' + color + '" style="font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:500" font-size="' + fs + '">' +
      lines.map((l, k) => '<tspan x="200" dy="' + (k ? Math.round(fs * 1.08) : 0) + '">' + esc(l) + '</tspan>').join('') + '</text>';
    const author = (y, color) => book.author ? '<text x="200" y="' + y + '" text-anchor="middle" fill="' + color + '" opacity=".8" style="font-family:\'Instrument Sans\',system-ui,sans-serif;font-weight:500;letter-spacing:4px" font-size="17">' + esc((book.lang === 'tr' ? String(book.author).toLocaleUpperCase('tr') : String(book.author).toUpperCase()).slice(0, 34)) + '</text>' : '';
    const th = Math.round(fs * 1.08) * (lines.length - 1);
    let body = '';
    if (L === 'band') {
      body = motifAt(110, 60, 1.8) + '<rect x="0" y="300" width="400" height="' + (150 + th) + '" fill="' + ac + '"/>' + title(360, bg) + author(430 + th, bg);
    } else if (L === 'frame') {
      body = '<rect x="22" y="22" width="356" height="556" fill="none" stroke="' + ac + '" stroke-opacity=".7" stroke-width="2"/><rect x="32" y="32" width="336" height="536" fill="none" stroke="' + ac + '" stroke-opacity=".3"/>' +
        motifAt(160, 70, 0.8) + title(250, ac) + '<path d="M150 ' + (300 + th) + 'h100" stroke="' + ac + '" stroke-opacity=".6"/>' + author(340 + th, ac) + motifAt(60, 400, 2.8, 0.14);
    } else {
      body = motifAt(100, 70, 2) + '<path d="M150 ' + 312 + 'h100" stroke="' + ac + '" stroke-opacity=".6"/>' + title(380, ac) + author(530, ac);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(book.title) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="' + bg + '"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient>' +
      '<radialGradient id="' + id + 'r" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="' + ac + '" stop-opacity=".22"/><stop offset="1" stop-color="' + ac + '" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="400" height="600" fill="' + bg + '"/><rect width="400" height="600" fill="url(#' + id + ')" opacity=".55"/><rect width="400" height="600" fill="url(#' + id + 'r)"/>' + body + '</svg>';
  }

  /* ---------- Hat ----------
     book: {title, author, mood, excerpt}; o: {G (SA_Gemini), hasKey, signal, fetch, onState(text)}
     Dönüş: aday listesi [{src, source} | {spec, source:'design'}], ilk aday seçilir. Asla reddetmez. */
  async function find(book, o) {
    o = o || {};
    const cands = [], say = t => { try { if (o.onState) o.onState(t); } catch (_) { /* yok */ } };
    for (const [fn, label] of [[fromOpenLibrary, 'Open Library'], [fromGoogleBooks, 'Google Books']]) {
      say('Kapak aranıyor: ' + label);
      try {
        for (const c of (await fn(book, o)).slice(0, 3)) if (!cands.some(x => x.src === c.src) && await verifyImage(c.src)) cands.push(c);
      } catch (_) { /* kaynak yok: sıradaki */ }
      if (cands.length && label === 'Open Library') break;
    }
    const local = localSpec(book);
    let spec = local;
    if (!cands.length && o.hasKey && o.G && o.G.generateJSON) {
      say('Kapak tasarlanıyor (Gemini)');
      try { spec = validateSpec(await o.G.generateJSON(specPrompt(book), SPEC_SCHEMA, {signal: o.signal, temperature: 0.8}), local); } catch (_) { spec = local; }
      if (o.G.generateImage) {
        try {
          const raw = await o.G.generateImage(imagePrompt(book, spec), {signal: o.signal});
          const small = raw && (await toJpeg(raw) || (raw.length < 400000 ? raw : null));
          if (small) cands.push({src: small, source: 'gemini'});
        } catch (_) { /* ücretsiz katman reddetti: tasarıma düş */ }
      }
    }
    cands.push({spec, source: 'design'});
    return cands;
  }
  const LABEL = {openlibrary: 'Open Library', googlebooks: 'Google Books', gemini: 'Gemini', design: 'tasarım', upload: 'senin'};

  const api = {MOTIFS, MOTIF_NAMES, LAYOUTS, LABEL, norm, mainTitle, titleScore, authorOk, isConfident, validateSpec, localSpec, renderSVG,
    fromOpenLibrary, fromGoogleBooks, verifyImage, toJpeg, find, specPrompt, imagePrompt};
  root.SA_Covers = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
