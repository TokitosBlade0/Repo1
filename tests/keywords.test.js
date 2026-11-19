// Anahtar sözcük ön taraması testleri: node tests/keywords.test.js  (ağ yok, gerçek API çağrısı yok)
// Kalite ölçümü: cache/ içindeki yerel kitap metinleri + assets/analysis/<gid>.json hazır sahneleri.
'use strict';
const assert = require('assert');
const path = require('path'), fs = require('fs');
const W = path.join(__dirname, '..');
const Core = require(path.join(W, 'core.js')), KW = require(path.join(W, 'keywords.js')), G = require(path.join(W, 'gemini.js')), Books = require(path.join(W, 'books.js'));
const MOODS = Core.MOODS;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const res = (status, data) => ({ok: status >= 200 && status < 300, status, json: async () => data});
const reply = items => ({candidates: [{content: {parts: [{text: JSON.stringify({items})}]}}]});

/* ---------- Cümle bölücü ---------- */
test('splitSentences: kısaltma, baş harf, tırnak, üç nokta, ondalık', () => {
  const s = KW.splitSentences('Mr. Holmes met Dr. Watson at 3.15 p.m. today. “Who is there?” she cried. J. R. Smith left… Then silence.').map(x => x.s);
  assert.deepStrictEqual(s, ['Mr. Holmes met Dr. Watson at 3.15 p.m. today.', '“Who is there?” she cried.', 'J. R. Smith left…', 'Then silence.']);
  const t = KW.splitSentences('Birden kapı açıldı! Prof. Ahmet içeri girdi... ve sustu. Kim vardı orada? 3. bölüm başladı.').map(x => x.s);
  assert.deepStrictEqual(t, ['Birden kapı açıldı!', 'Prof. Ahmet içeri girdi... ve sustu.', 'Kim vardı orada?', '3. bölüm başladı.']);
  assert.deepStrictEqual(KW.splitSentences(''), []);
  assert.strictEqual(KW.splitSentences('Tek cümle noktasız').length, 1);
});

/* ---------- Tarama ---------- */
test('scan: isabetler cümle düzeyinde, duygu puanı, ipucu ve olumsuzluk', () => {
  const sc = KW.scan(['The garden was calm and quiet. Suddenly a scream broke the night; terror seized her.', 'He was not afraid. It was a fine day.', 'Kısa.'], 'en');
  const p0 = sc.paras[0];
  assert.strictEqual(p0.hits.length, 2);
  assert(p0.hits[0].moods.huzur > 0);
  assert(p0.hits[1].cue, 'suddenly/night → sahne ipucu');
  assert(p0.hits[1].moods.karanlik > 0 || p0.hits[1].moods.gerilim > 0);
  assert(!sc.paras[1].hits.some(h => h.moods.karanlik), '“not afraid” olumsuz → isabet değil');
  assert.strictEqual(sc.paras[2].hits.length, 0);
  for (const p of sc.paras) { assert(MOODS.includes(p.localMood)); assert(p.confidence >= 0 && p.confidence <= 1); }
  const tr = KW.scan(['Gece birden bir çığlık duyuldu; korkudan titredi.', 'Korkmadı, sakindi.'], 'tr');
  assert(tr.paras[0].hits[0].cue && tr.paras[0].hits[0].moods.karanlik > 0);
});
test('scanBook: kitap başına önbellek (aynı nesne), localStorage yoksa da çalışır', () => {
  const ps = Array.from({length: 30}, (_, i) => 'Paragraph ' + i + ' was dark and full of fear and dread.');
  const a = KW.scanBook(ps, 'en'), b = KW.scanBook(ps.slice(), 'en');
  assert.strictEqual(a, b);
  assert.notStrictEqual(KW.scanBook(ps.concat(['extra calm line here and there']), 'en'), a);
});

/* ---------- Seçim ---------- */
function synth() {
  const calm = 'The morning was calm and quiet, a gentle breeze in the peaceful garden, warm and pleasant. The man walked to the town hall and back again with his bag.';
  const dark = 'Suddenly in the dark night a ghost appeared; terror and horror and dread filled the haunted crypt. The man walked to the town hall and back again with his bag.';
  return Array.from({length: 24}, (_, i) => i === 7 ? 'Yes.' : i < 12 ? calm : dark);
}
test('select: güvenli → yerel, sınır → 1–2 cümle, kısa/isabetsiz → devral; satır biçimi ve üst sınır', () => {
  const sc = KW.scan(synth(), 'en'), sel = KW.select(sc, 0, 24);
  assert(sel.inherit.includes(7));
  assert(sel.send.length >= 1 && sel.send.length <= 4, 'yalnızca sınır çevresi gider: ' + sel.send.map(s => s.p));
  assert(sel.send.some(s => s.p === 12 || s.p === 11));
  for (const s of sel.send) for (const l of s.lines) { assert(/^p\d+\.\d+\|[^|]+\|k:[^|]*$/.test(l.s), l.s); assert(l.s.split('|')[1].length <= 220); }
  assert(sel.local.length >= 15);
  const tiny = KW.select(sc, 0, 24, {capTokens: 180, overhead: 600});
  assert(tiny.tokens <= 180);
  const r = KW.resolve(sc, 0, 24, sel, new Map([[12, {mood: 'gerilim', intensity: 0.9}]]));
  assert.strictEqual(r.length, 24);
  assert.strictEqual(r[7].via, 'komşu'); assert.strictEqual(r[7].mood, r[6].mood);
  if (sel.send.some(s => s.p === 12)) { assert.strictEqual(r[12].mood, 'gerilim'); assert.strictEqual(r[12].via, 'gemini'); }
});
test('parseAnswers: yalnızca gönderilen kimlikler, "p12" dizgesi de kabul, geçersiz mood atılır', () => {
  const m = KW.parseAnswers({items: [{p: 3, mood: 'ask', intensity: 7}, {p: 'p5', mood: 'gizem', intensity: 0.2}, {p: 9, mood: 'ask', intensity: 1}, {p: 4, mood: 'xx', intensity: 1}]}, [3, 4, 5]);
  assert.deepStrictEqual([...m.keys()].sort(), [3, 5]);
  assert.strictEqual(m.get(3).intensity, 0.7);
});

/* ---------- gemini.js cümle kipi (sahte fetch) ---------- */
function setup(fetchFn) {
  G.configure({key: 'TEST', model: 'gemini-2.5-flash', mode: 'kw', _persist: false, _fetch: fetchFn, _interval: 0, _resetPacing: true, _sleep: async () => {}});
}
test('analyze (cümle kipi): yalnızca seçilen satırlar gider, kısa sistem istemi, thinkingBudget 0, şema {p,mood,intensity}; API değişmedi', async () => {
  const bodies = [];
  setup(async (url, init) => {
    assert(!/key=/.test(url));
    const body = JSON.parse(init.body); bodies.push(body);
    assert.strictEqual(body.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.deepStrictEqual(body.generationConfig.responseSchema.properties.items.items.required, ['p', 'mood', 'intensity']);
    const ids = (body.contents[0].parts[0].text.match(/^p(\d+)\./gm) || []).map(x => +x.slice(1));
    return res(200, reply([...new Set(ids)].map(p => ({p, mood: 'gerilim', intensity: 0.8}))));
  });
  const paras = synth().concat(synth()), b = {id: 'kw-' + Math.random(), lang: 'en', title: 'T', paragraphs: paras};
  const r = await G.analyze(b, {from: 0});
  assert.strictEqual(r.length, paras.length);
  assert(r.every(x => x && MOODS.includes(x.mood) && x.query && typeof x.energy === 'number'));
  assert(bodies.length >= 1 && bodies.length <= 3, 'istek sayısı: ' + bodies.length);
  for (const body of bodies) {
    const txt = body.contents[0].parts[0].text;
    assert(!txt.includes(paras[0]), 'tam paragraf gönderilmemeli');
    assert(body.systemInstruction.parts[0].text.length < 400);
    assert(Math.ceil((txt.length + body.systemInstruction.parts[0].text.length) / 4) <= 2500);
  }
  const st = G.kwStats(b.id);
  assert(st.sentences > 0 && st.tokens > 0 && st.fullTokens > st.tokens && st.saving >= 50, JSON.stringify(st));
  assert(r.some(x => x.via === 'gemini') && r.some(x => x.via === 'yerel'));
  // Önbellekte: ikinci analyze istek atmaz
  const n0 = bodies.length; await G.analyze(b, {from: 0}); assert.strictEqual(bodies.length, n0);
  assert.strictEqual(G.mode(), 'kw');
});
test('analyze (cümle kipi): ağ hatası → yerel doldurulur, hata alanları ayarlanır; mode:"full" eski kipe döner', async () => {
  setup(async () => { throw new TypeError('Failed to fetch'); });
  const paras = synth(), r = await G.analyze({id: 'kwerr-' + Math.random(), lang: 'en', title: 'T', paragraphs: paras}, {});
  assert(r.every(Boolean)); assert.strictEqual(r.errorKind, 'net');
  let full = 0;
  G.configure({mode: 'full', _persist: false, _fetch: async (u, init) => { full++; assert(/\[0\] /.test(JSON.parse(init.body).contents[0].parts[0].text)); return res(200, reply([])); }, _resetPacing: true});
  await G.analyze({id: 'kwfull-' + Math.random(), lang: 'en', title: 'T', paragraphs: paras}, {});
  assert(full > 0); assert.strictEqual(G.mode(), 'full');
  G.configure({mode: 'kw', _persist: false, key: ''});
});

/* ---------- Kalite ve hız: yerel kitaplar + hazır sahneler ---------- */
function localBooks() {
  const out = [];
  for (const rec of Books.RECOMMENDED.concat(Books.TURKISH || [])) {
    const f = rec.page ? path.join(W, 'cache', 'vk-' + rec.page.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 80) + '.txt') : path.join(W, 'cache', 'pg' + rec.gid + '.txt');
    const aj = path.join(W, 'assets', 'analysis', rec.gid + '.json');
    if (!fs.existsSync(f) || !fs.existsSync(aj)) continue;
    const gt = JSON.parse(fs.readFileSync(aj, 'utf8'));
    const paras = Core.parseText(Core.parseGutenberg(fs.readFileSync(f, 'utf8')).body).filter(b => !b.h).map(b => b.t);
    const truth = []; for (const s of gt.scenes) for (let i = s.from; i <= s.to; i++) truth[i - 1] = s.mood;
    out.push({gid: rec.gid, title: rec.title, lang: gt.lang, paras, truth});
  }
  return out;
}
const report = [];
test('hız: 1.400 paragraflık kitap taraması < 150 ms', () => {
  const bk = localBooks().find(b => b.paras.length >= 1300) || {paras: Array.from({length: 1400}, (_, i) => 'It was a dark and stormy night; suddenly a scream. ' + i + ' She smiled and loved him, calm and quiet.'), lang: 'en'};
  const ps = bk.paras.slice(0, 1400);
  KW.scan(ps, bk.lang);                              // ısınma (JIT)
  let best = Infinity; for (let k = 0; k < 3; k++) { const t0 = process.hrtime.bigint(); KW.scan(ps, bk.lang); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); }
  report.push('hız: ' + ps.length + ' paragraf ' + best.toFixed(0) + ' ms' + (bk.gid ? ' (' + bk.title + ')' : ''));
  assert(best < 150, best + ' ms');
});
test('kalite: token azalması ≥ %70 ve gönderilmeyen paragraflarda uyum ≥ yerel temel çizgi', () => {
  const books = localBooks();
  if (!books.length) { report.push('kalite: yerel kitap metni yok (cache/), atlandı'); return; }
  let full = 0, kwt = 0, n = 0, agKw = 0, agBase = 0, agCore = 0, sent = 0, paras = 0, minBook = 100;
  for (const bk of books) {
    const sc = KW.scan(bk.paras, bk.lang);
    let prev = null; const base = bk.paras.map(p => (prev = G._internal.localOne(p, bk.lang, prev).mood));   // bugünkü yerel yedek (gemini.js)
    const core = bk.paras.map(p => MOODS[Core.topMood(Core.analyze(p, bk.lang).v)]);                         // ham Core.analyze
    let bf = 0, bk2 = 0, bn = 0, ba = 0, bb = 0;
    for (let s = 0; s < bk.paras.length; s += G.WINDOW) {
      const e = Math.min(bk.paras.length, s + G.WINDOW), sel = KW.select(sc, s, e);
      for (let b = s; b < e; b += G._internal.BATCH) {
        const idx = []; for (let i = b; i < Math.min(e, b + G._internal.BATCH); i++) if (bk.paras[i].replace(/\s+/g, ' ').trim().length >= G._internal.MIN_CHARS) idx.push(i);
        if (idx.length) bf += G._internal.reqTokens(G._internal.buildRequest(bk, idx.map(i => bk.paras[i]), b, ''));
      }
      for (const ch of KW.chunks(sel)) bk2 += G._internal.reqTokens(G._internal.buildKwRequest(bk, ch, '', 'huzur'));
      sent += sel.sentences;
      const sentSet = new Set(sel.send.map(x => x.p));
      for (const r of KW.resolve(sc, s, e, sel, new Map())) {
        if (sentSet.has(r.p) || !bk.truth[r.p]) continue;
        bn++; if (r.mood === bk.truth[r.p]) ba++; if (base[r.p] === bk.truth[r.p]) bb++; if (core[r.p] === bk.truth[r.p]) agCore++;
      }
    }
    minBook = Math.min(minBook, 100 * (1 - bk2 / bf));
    report.push('  ' + String(bk.gid).padEnd(26) + String(bk.paras.length).padStart(5) + ' p  tasarruf %' + (100 * (1 - bk2 / bf)).toFixed(1) +
      '  uyum kw %' + (100 * ba / bn).toFixed(1) + ' / temel %' + (100 * bb / bn).toFixed(1));
    full += bf; kwt += bk2; n += bn; agKw += ba; agBase += bb; paras += bk.paras.length;
  }
  const saving = 100 * (1 - kwt / full), a1 = 100 * agKw / n, a0 = 100 * agBase / n, ac = 100 * agCore / n;
  report.push('kalite: ' + books.length + ' kitap, ' + paras + ' paragraf, ' + sent + ' cümle gönderilir; ~' + full + ' → ~' + kwt + ' jeton (tasarruf %' + saving.toFixed(1) + ')');
  report.push('uyum (gönderilmeyen ' + n + ' paragraf): anahtar-sözcük yerel+komşu %' + a1.toFixed(1) + ' · gemini.js yerel yedeği %' + a0.toFixed(1) + ' · ham Core.analyze %' + ac.toFixed(1));
  assert(saving >= 70, 'tasarruf %' + saving.toFixed(1));
  assert(minBook >= 70, 'kitap başına tasarruf en düşük %' + minBook.toFixed(1) + ' (< %70)');
  assert(a1 >= a0 && a1 >= ac, 'uyum temel çizginin altında');
  assert(a1 >= 89.4, 'gönderilmeyenlerde uyum %' + a1.toFixed(1) + ' (< %89.4)');
});

(async () => {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n    ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n    ')); }
  }
  for (const l of report) console.log(l);
  console.log('\n' + pass + ' geçti, ' + fail + ' başarısız');
  process.exit(fail ? 1 : 0);
})();
