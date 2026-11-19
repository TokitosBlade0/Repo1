// Veri ve ses katmanı testleri: node tests/data.test.js  (bağımlılık yok, gerçek API çağrısı yok)
'use strict';
const assert = require('assert');
const path = require('path');
const R = f => require(path.join(__dirname, '..', f));
const Books = R('books.js'), G = R('gemini.js'), M = R('music.js'), Core = R('core.js');
const MOODS = Core.MOODS;
G.configure({mode: 'full', _persist: false});   // bu dosya eski tam paragraf protokolünü sınar; cümle kipi: tests/keywords.test.js

let pass = 0, fail = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

/* ---------- Sahte Gemini ---------- */
function geminiReply(items) {
  return {candidates: [{content: {parts: [{text: JSON.stringify({items})}]}}]};
}
function paragraphsFromBody(body) {
  const txt = JSON.parse(body).contents[0].parts[0].text;
  return (txt.match(/^\[\d+\] /gm) || []).length;
}
function startFromBody(body) { return +JSON.parse(body).contents[0].parts[0].text.match(/Paragraphs (\d+)/)[1]; }
const res = (status, data) => ({ok: status >= 200 && status < 300, status, json: async () => data});
const okItems = (n, mood) => Array.from({length: n}, (_, i) => ({i, mood: mood || 'gizem', energy: 0.4, query: 'mysterious noir piano', scene: Math.floor(i / 10)}));

function setup(fetchFn, sleeps) {
  G.configure({key: 'TEST', model: 'test-model', _fetch: fetchFn, _interval: 0, _resetPacing: true,
    _sleep: async (ms, signal) => { if (sleeps) sleeps.push(ms); if (signal && signal.aborted) { const e = new Error('x'); e.name = 'AbortError'; throw e; } }});
}
const book = (n, id) => ({id: id || 'b' + Math.random(), lang: 'en', title: 'T', paragraphs: Array.from({length: n}, (_, i) => 'Paragraph ' + i + ': the dark night was silent and very cold.')});

/* ---------- Kitaplar ---------- */
test('RECOMMENDED: 12 kitap, zorunlu gid\'ler, alanlar geçerli', () => {
  const R = Books.RECOMMENDED;
  assert.strictEqual(R.length, 12);
  for (const g of [11, 1661, 345, 84, 1342, 120]) assert(R.some(b => b.gid === g), 'eksik ' + g);
  assert.strictEqual(new Set(R.map(b => b.gid)).size, 12);
  for (const b of R) {
    assert.strictEqual(b.id, 'pg' + b.gid);
    assert(MOODS.includes(b.mood), b.title);
    assert(['en', 'tr'].includes(b.lang));
    assert(b.title && b.author && b.blurb);
    assert.strictEqual(b.cover, 'assets/covers/' + b.gid + '.jpg');
  }
});
test('fetchText proxy adresini kullanır', async () => {
  let url;
  globalThis.fetch = async u => { url = u; return {ok: true, status: 200, text: async () => 'METIN'}; };
  assert.strictEqual(await Books.fetchText(Books.RECOMMENDED[0]), 'METIN');
  assert.strictEqual(url, '/api/gutenberg?id=11');
  await assert.rejects(Books.fetchText({id: 'pgabc'}));
  delete globalThis.fetch;
});

/* ---------- Gemini ---------- */
test('batchOrder: from\'dan dışa doğru, hepsini bir kez kapsar', () => {
  const o = G._internal.batchOrder(400, 170, 40).map(b => b.index);
  assert.deepStrictEqual(o, [4, 5, 3, 6, 2, 7, 1, 8, 0, 9]);
  assert.deepStrictEqual(G._internal.batchOrder(85, 0, 40).map(b => [b.start, b.end]), [[0, 40], [40, 80], [80, 85]]);
  assert.deepStrictEqual(G._internal.batchOrder(100, 9999, 40).map(b => b.index), [2, 1, 0]);
  assert.deepStrictEqual(G._internal.batchOrder(0, 0, 40), []);
});

test('analyze: ilk istek okurun çevresinde 12 paragraf, sonra from\'un toplusundan dışa doğru; anahtar başlıkta, URL\'de değil', async () => {
  const starts = [];
  setup(async (url, init) => {
    assert(!/key=/.test(url), 'anahtar URL\'de olmamalı');
    assert.strictEqual(init.headers['x-goog-api-key'], 'TEST');
    const body = JSON.parse(init.body);
    assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
    assert(body.generationConfig.responseSchema);
    starts.push(startFromBody(init.body));
    return res(200, geminiReply(okItems(paragraphsFromBody(init.body))));
  });
  let calls = 0; const sizes = [];
  const b = book(400);
  const r = await G.analyze(b, {from: 90, onProgress: (res, done) => { calls++; sizes.push(done); }});
  // yalnızca okunan yer: öncü 90–99 (88–89 pencere dışı → yerel), sonra 90–209 penceresi 40'lık topluluklarla
  assert.deepStrictEqual(starts, [90, 100, 130, 170]);
  assert.strictEqual(sizes[1], 10, 'ilk istekten sonra ilerleme 10 paragraf');
  assert.strictEqual(r.length, 400);
  assert(r.every((x, i) => x && x.source === (i >= 90 && i < 90 + G.WINDOW ? 'gemini' : 'local')));
  assert(calls >= 4);
  // okur ilerledi: extend pencereyi kaydırır, önbellekteki Gemini sonuçları tekrar istenmez
  starts.length = 0;
  const r2 = await G.extend(b.id, 200);
  assert.deepStrictEqual(starts, [210, 240, 280]);
  assert(r2.every((x, i) => x && x.source === (i >= 90 && i < 320 ? 'gemini' : 'local')));
  starts.length = 0;
  await Promise.all([G.extend(b.id, 200), G.extend(b.id, 205)]);   // sıraya girer; aynı pencere istek atmaz
  assert.deepStrictEqual(starts, [320]);
  assert.strictEqual(await G.extend('yok-boyle-kitap', 10), null);
});

test('paragraflar ~600 karaktere kısaltılır; ilk istek 12, sonrakiler en çok 40 paragraf', async () => {
  const bodies = [];
  setup(async (u, init) => { bodies.push(init.body); return res(200, geminiReply(okItems(paragraphsFromBody(init.body)))); });
  const b = book(100); b.paragraphs[0] = 'x'.repeat(5000);
  await G.analyze(b, {});
  const counts = bodies.map(paragraphsFromBody);
  assert.strictEqual(counts[0], 12);
  assert(counts.every(n => n <= 40));
  assert.strictEqual(counts.reduce((a, n) => a + n, 0), 100);
  assert(JSON.parse(bodies[0]).contents[0].parts[0].text.length < 12 * 700);
});

test('doğrulama/onarım: bilinmeyen mood → yerel, enerji sınırlanır, eksik → yeniden dene sonra yerel', async () => {
  let n = 0;
  setup(async (u, init) => {
    n++;
    const items = okItems(10);
    items[2].mood = 'uzaylı';
    items[3].energy = 7;      // 0..10 ölçeği → 0.7
    items[4].energy = -3;
    items[5].query = '';
    items.splice(9, 1);       // yanlış uzunluk
    return res(200, geminiReply(items));
  });
  const r = await G.analyze(book(10), {});
  assert.strictEqual(n, 2, 'yanlış uzunlukta bir kez yeniden denenmeli');
  assert.strictEqual(r[2].source, 'local'); assert(MOODS.includes(r[2].mood));
  assert.strictEqual(r[3].energy, 0.7);
  assert.strictEqual(r[4].energy, 0);
  assert(r[5].query.length > 0);
  assert.strictEqual(r[9].source, 'local');
  assert(r.every(x => x && MOODS.includes(x.mood) && x.energy >= 0 && x.energy <= 1 && Number.isInteger(x.scene)));
});

test('parseResponse: bozuk JSON, kod bloğu içinde JSON, i alanı olmayan dizi', () => {
  const P = G._internal.parseResponse;
  assert.strictEqual(P({candidates: [{content: {parts: [{text: 'not json'}]}}]}, 3).valid, 0);
  const wrapped = '```json\n' + JSON.stringify({items: okItems(3)}) + '\n```';
  assert.strictEqual(P({candidates: [{content: {parts: [{text: wrapped}]}}]}, 3).valid, 3);
  const arr = JSON.stringify([{mood: 'ask'}, {mood: 'nese'}]);
  const p = P({candidates: [{content: {parts: [{text: arr}]}}]}, 2);
  assert.strictEqual(p.items[1].mood, 'nese');
  assert.strictEqual(P({}, 2).valid, 0);
});

test('sahne: komşu paragraflar sahneyi paylaşır, toplu sınırında birleşir', async () => {
  setup(async (u, init) => {
    const n = paragraphsFromBody(init.body), s = startFromBody(init.body);
    // 0–49 gizem, 50–79 macera
    return res(200, geminiReply(Array.from({length: n}, (_, i) => ({i, mood: s + i < 50 ? 'gizem' : 'macera', energy: 0.5, query: 'q', scene: s + i < 50 ? 0 : 1}))));
  });
  const r = await G.analyze(book(80), {from: 0});    // öncü 0–11, sonra 12–39, 40–79
  assert.strictEqual(r[0].scene, r[49].scene, 'sınırı aşan sahne tek olmalı');
  assert.strictEqual(r[39].scene, r[40].scene);
  assert.notStrictEqual(r[49].scene, r[50].scene);
  assert.strictEqual(r[50].scene, r[79].scene);
});

test('429: üstel geri çekilme, sonra başarı', async () => {
  const sleeps = []; let n = 0;
  setup(async (u, init) => {
    n++;
    if (n <= 3) return res(429, {error: {code: 429, message: 'quota'}});
    return res(200, geminiReply(okItems(paragraphsFromBody(init.body))));
  }, sleeps);
  const r = await G.analyze(book(5), {});
  assert.strictEqual(n, 4);
  const back = sleeps.filter(x => x >= 1000);
  assert.deepStrictEqual(back, [10000, 20000, 40000]);
  assert(r.every(x => x.source === 'gemini'));
});

test('429 retryDelay yanıtı geri çekilmeyi uzatır', async () => {
  const sleeps = []; let n = 0;
  setup(async (u, init) => {
    if (n++ === 0) return res(429, {error: {code: 429, details: [{'@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s'}]}});
    return res(200, geminiReply(okItems(3)));
  }, sleeps);
  await G.analyze(book(3), {});
  assert(sleeps.includes(37000));
});

test('geçersiz anahtar: kalan paragraflar yerel doldurulur, Türkçe hata', async () => {
  setup(async () => res(400, {error: {code: 400, message: 'API key not valid', status: 'INVALID_ARGUMENT'}}));
  const r = await G.analyze(book(50), {});
  assert(r.every(x => x && x.source === 'local'));
  assert(/anahtar/i.test(r.error));
});

test('signal ile iptal', async () => {
  const ac = new AbortController(); let n = 0;
  setup(async (u, init) => { n++; ac.abort(); return res(200, geminiReply(okItems(40))); });
  await assert.rejects(G.analyze(book(200), {signal: ac.signal}), e => e.name === 'AbortError');
  assert.strictEqual(n, 1);
});

test('anahtar yoksa yalnızca yerel, hiç istek yok', async () => {
  G.configure({key: '', _fetch: async () => { throw new Error('çağrılmamalı'); }});
  const b = book(6); b.paragraphs[3] = 'She laughed with joy and happiness, smiling and dancing merrily.';
  const r = await G.analyze(b, {});
  assert(r.every(x => x.source === 'local' && MOODS.includes(x.mood)));
  assert.strictEqual(r[3].mood, 'nese');
});

test('önbellek: getCached, ikinci analiz istek atmaz, clearCache', async () => {
  let n = 0;
  setup(async (u, init) => { n++; return res(200, geminiReply(okItems(paragraphsFromBody(init.body)))); });
  const b = book(45, 'cache-book');
  await G.analyze(b, {});
  assert.strictEqual(n, 3);   // 0–11, 12–39, 40–44
  const c = await G.getCached('cache-book');
  assert.strictEqual(c.length, 45);
  await G.analyze(b, {});
  assert.strictEqual(n, 3, 'önbellekten gelmeli');
  await G.clearCache('cache-book');
  assert.strictEqual(await G.getCached('cache-book'), null);
});

test('test(): 200, 400, 429, ağ hatası mesajları', async () => {
  const cases = [[200, true, null], [400, false, /anahtar/i], [403, false, /403/], [429, false, /sınır/i]];
  for (const [st, ok, re] of cases) {
    G.configure({key: 'K', model: 'm', _fetch: async (u, init) => { assert(!/key=/.test(u)); assert.strictEqual(init.headers['x-goog-api-key'], 'K'); return res(st, {}); }});
    const t = await G.test();
    assert.strictEqual(t.ok, ok); assert.strictEqual(t.model, 'm');
    if (re) assert(re.test(t.error), t.error);
  }
  G.configure({_fetch: async () => { throw new TypeError('Failed to fetch'); }});
  assert(/ulaşılamadı/.test((await G.test()).error));
  G.configure({key: ''});
  assert.strictEqual((await G.test()).ok, false);
  assert(typeof G.DEFAULT_MODEL === 'string' && G.DEFAULT_MODEL.length > 0);
});

/* ---------- Gemini: gerçekçi hata yanıtları ve model seçimi (Google'ın belgelenmiş biçimleri) ---------- */
const E400KEY = {error: {code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT',
  details: [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com', metadata: {service: 'generativelanguage.googleapis.com'}}]}};
const E404 = m => ({error: {code: 404, message: 'models/' + m + ' is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.', status: 'NOT_FOUND'}});
const E429 = s => ({error: {code: 429, message: 'You exceeded your current quota, please check your plan and billing details.', status: 'RESOURCE_EXHAUSTED',
  details: [{'@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'}]},
    {'@type': 'type.googleapis.com/google.rpc.Help', links: [{description: 'Learn more', url: 'https://ai.google.dev/gemini-api/docs/rate-limits'}]},
    {'@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: s || '40s'}]}});
const E503 = {error: {code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE'}};
const gm = (name, methods) => ({name: 'models/' + name, version: '001', displayName: name, supportedGenerationMethods: methods || ['generateContent', 'countTokens', 'createCachedContent', 'batchGenerateContent']});
const LIST = {models: [gm('gemini-2.0-flash'), gm('gemini-2.0-flash-001'), gm('gemini-2.5-flash'), gm('gemini-2.5-flash-lite'), gm('gemini-2.5-flash-preview-09-2025'),
  gm('gemini-flash-latest'), gm('gemini-2.5-flash-image'), gm('gemini-2.5-pro'), gm('gemini-2.5-flash-preview-tts'), gm('text-embedding-004', ['embedContent']), gm('imagen-4.0-generate-001', ['predict'])], nextPageToken: ''};
// Gerçek yanıt biçimi: candidates[0].content.parts[], usageMetadata, modelVersion; düşünce parçası olabilir
const realReply = (items, thought) => ({candidates: [{content: {role: 'model', parts: (thought ? [{text: 'Let me think about the moods…', thought: true}] : [])
  .concat(JSON.stringify({items}).match(/[\s\S]{1,70}/g).map(text => ({text})))}, finishReason: 'STOP', index: 0}],
  usageMetadata: {promptTokenCount: 900, candidatesTokenCount: 400, totalTokenCount: 1300}, modelVersion: 'gemini-2.5-flash', responseId: 'x'});
const isList = u => /\/models\?pageSize=/.test(u);
const modelOf = u => (u.match(/\/models\/([^:?]+):generateContent/) || [])[1];
function setupAuto(fetchFn, sleeps) {
  G.configure({key: 'AUTO-KEY', model: '', _fetch: async (u, init) => {
    assert(!/key=|AUTO-KEY/.test(u), 'anahtar URL\'de olmamalı');
    assert.strictEqual(init.headers['x-goog-api-key'], 'AUTO-KEY');
    return fetchFn(u, init);
  }, _interval: 0, _resetPacing: true, _resetModels: true, _timeout: 90000,
  _sleep: async (ms, signal) => { if (sleeps) sleeps.push(ms); if (signal && signal.aborted) { const e = new Error('x'); e.name = 'AbortError'; throw e; } }});
}
const geminiOk = init => res(200, realReply(okItems(paragraphsFromBody(init.body)), true));

test('rankModels: en yeni kararlı Flash → Flash-Lite → diğer Flash; görsel/tts/embed hariç', () => {
  const rank = G._internal.rankModels;
  assert.strictEqual(rank(LIST.models)[0], 'gemini-2.5-flash');
  assert.deepStrictEqual(rank(LIST.models).slice(0, 3), ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001']);
  assert.strictEqual(rank([gm('gemini-2.5-flash-lite'), gm('gemini-2.5-flash-preview-09-2025'), gm('gemini-flash-latest')])[0], 'gemini-2.5-flash-lite');
  assert.strictEqual(rank([gm('gemini-flash-latest'), gm('gemini-2.5-pro')])[0], 'gemini-flash-latest');
  assert(!rank(LIST.models).some(n => /image|tts|embed|pro/.test(n)));
  assert.deepStrictEqual(G._internal.imageModels(LIST.models), ['gemini-2.5-flash-image']);
});

test('otomatik model: ListModels (x-goog-api-key) ile seçilir, analiz o modelle yapılır, seçim önbellekte', async () => {
  const urls = [];
  setupAuto(async (u, init) => { urls.push(u); return isList(u) ? res(200, LIST) : geminiOk(init); });
  const r = await G.analyze(book(20), {});
  assert(r.every(x => x.source === 'gemini'));
  assert.strictEqual(urls.filter(isList).length, 1);
  assert(urls.filter(u => !isList(u)).every(u => modelOf(u) === 'gemini-2.5-flash'));
  await G.analyze(book(5), {});
  assert.strictEqual(urls.filter(isList).length, 1, 'model anahtar başına önbellekte');
  assert.strictEqual(G.diag().model, 'gemini-2.5-flash');
  const t = await G.test();
  assert.strictEqual(t.ok, true); assert.strictEqual(t.auto, true); assert.strictEqual(t.model, 'gemini-2.5-flash');
});

test('404 model bulunamadı: bir kez yeniden çözülür ve aynı istek yeni modelle yinelenir', async () => {
  const models = [];
  setupAuto(async (u, init) => {
    if (isList(u)) return res(200, LIST);
    models.push(modelOf(u));
    return modelOf(u) === 'gemini-2.5-flash' ? res(404, E404('gemini-2.5-flash')) : geminiOk(init);
  });
  const r = await G.analyze(book(15), {});
  assert(r.every(x => x.source === 'gemini'));
  assert.deepStrictEqual(models.slice(0, 2), ['gemini-2.5-flash', 'gemini-2.0-flash']);
  assert(!r.error);
});

test('açık model adı 404 → otomatik seçime düşer; ikinci 404 → “Gemini: model bulunamadı”, yerel devam', async () => {
  let gen = 0;
  setupAuto(async (u, init) => { if (isList(u)) return res(200, {models: [gm('gemini-2.5-flash')]}); gen++; return res(404, E404(modelOf(u))); });
  G.configure({model: 'gemini-9-flash-yok'});
  const statuses = [];
  const r = await G.analyze(book(30), {onStatus: s => statuses.push(s)});
  assert.strictEqual(gen, 2, 'yalnızca bir kez yeniden denenir');
  assert.strictEqual(r.error, 'Gemini: model bulunamadı'); assert.strictEqual(r.errorKind, 'model');
  assert(r.every(x => x && x.source === 'local'));
  assert.strictEqual(statuses[statuses.length - 1].state, 'error');
});

test('gerçek 400 API_KEY_INVALID (ListModels): “Gemini: anahtar geçersiz”, generateContent hiç çağrılmaz', async () => {
  let gen = 0;
  setupAuto(async u => { if (isList(u)) return res(400, E400KEY); gen++; return res(400, E400KEY); });
  const r = await G.analyze(book(25), {});
  assert.strictEqual(gen, 0);
  assert.strictEqual(r.error, 'Gemini: anahtar geçersiz'); assert.strictEqual(r.errorKind, 'key');
  assert(/aistudio/.test(r.errorDetail));
  assert(r.every(x => x.source === 'local'));
  const t = await G.test();
  assert.strictEqual(t.ok, false); assert(/anahtar/i.test(t.error)); assert.strictEqual(t.kind, 'key');
});

test('400 API_KEY_INVALID (generateContent, açık model): ölümcül, tek istek', async () => {
  let n = 0;
  setup(async () => { n++; return res(400, E400KEY); });
  const r = await G.analyze(book(60), {});
  assert.strictEqual(n, 1); assert.strictEqual(r.errorKind, 'key');
});

test('429 + RetryInfo 40s: durum “bekliyor/kota” ve yeniden deneme zamanı bildirilir, sonra başarı', async () => {
  const sleeps = [], st = []; let n = 0;
  setupAuto(async (u, init) => { if (isList(u)) return res(200, LIST); return n++ === 0 ? res(429, E429('40s')) : geminiOk(init); }, sleeps);
  const t0 = Date.now();
  const r = await G.analyze(book(12), {onStatus: s => st.push(s)});
  assert(sleeps.includes(40000));
  const w = st.find(s => s.state === 'wait');
  assert(w, 'bekleme durumu bildirilmeli');
  assert.strictEqual(w.kind, 'quota'); assert.strictEqual(w.lastError, 'Gemini: kota doldu');
  assert(Math.abs(w.retryAt - t0 - 40000) < 2000);
  assert(r.every(x => x.source === 'gemini')); assert(!r.error);
  assert.strictEqual(st[st.length - 1].state, 'done');
});

test('429 sürekli: denemeler tükenince durur, “Gemini: kota doldu”, kalan yerel', async () => {
  let n = 0;
  setupAuto(async u => { if (isList(u)) return res(200, LIST); n++; return res(429, E429('20s')); });
  const r = await G.analyze(book(100), {});
  assert.strictEqual(n, 6, '1 + 5 yeniden deneme, sonra durur (her parti için tekrar değil)');
  assert.strictEqual(r.errorKind, 'quota'); assert.strictEqual(r.error, 'Gemini: kota doldu');
  assert(r.every(x => x && x.source === 'local'));
});

test('503 aşırı yük: geri çekilme ve “server” bekleme durumu; sürerse yalnızca o parça yerel, diğerleri sürer', async () => {
  const st = []; let calls = 0;
  setupAuto(async (u, init) => {
    if (isList(u)) return res(200, LIST);
    calls++;
    return startFromBody(init.body) === 0 ? res(503, E503) : geminiOk(init);
  });
  const r = await G.analyze(book(60), {from: 0, onStatus: s => st.push(s)});
  assert(st.some(s => s.state === 'wait' && s.kind === 'server'));
  assert(!r.error, 'geçici sunucu hatası analizi durdurmaz');
  assert(r.slice(0, 12).every(x => x.source === 'local'));
  assert(r.slice(12).every(x => x.source === 'gemini'));
  assert.strictEqual(calls, 6 + 2);
  const c = await G.getCached(undefined);
  assert.strictEqual(c, null);
});

test('ağ hatası: birkaç denemeden sonra “Gemini\'ye ulaşılamadı”', async () => {
  setupAuto(async u => { if (isList(u)) return res(200, LIST); throw new TypeError('Failed to fetch'); });
  const r = await G.analyze(book(10), {});
  assert.strictEqual(r.error, 'Gemini\'ye ulaşılamadı'); assert.strictEqual(r.errorKind, 'net');
  setupAuto(async () => { throw new TypeError('Failed to fetch'); });
  const r2 = await G.analyze(book(10), {});
  assert.strictEqual(r2.errorKind, 'net', 'ListModels\'e de ulaşılamazsa');
});

test('asılı kalan istek zaman aşımına uğrar (sonsuza dek %0 yok)', async () => {
  setupAuto(async (u, init) => {
    if (isList(u)) return res(200, LIST);
    return new Promise((_, rej) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }));
  });
  G.configure({_timeout: 30});
  const r = await G.analyze(book(5), {});
  assert.strictEqual(r.errorKind, 'net');
  G.configure({_timeout: 90000});
});

test('parseResponse: düşünce parçası atlanır, birden çok text parçası birleştirilir; engellenen yanıt tekrar denenmez', async () => {
  const P = G._internal.parseResponse;
  assert.strictEqual(P(realReply(okItems(7), true), 7).valid, 7);
  assert.strictEqual(P(realReply(okItems(7), false), 7).count, 7);
  let n = 0;
  setup(async () => { n++; return res(200, {promptFeedback: {blockReason: 'OTHER'}}); });
  const r = await G.analyze(book(8), {});
  assert.strictEqual(n, 1); assert(r.every(x => x.source === 'local'));
});

test('getCached yalnızca Gemini sonuçlarını döner (yerel yedekler tamamlanmış sayılmaz)', async () => {
  setup(async (u, init) => startFromBody(init.body) === 0 ? res(200, {candidates: [{content: {parts: [{text: 'bozuk'}]}}]}) : res(200, geminiReply(okItems(paragraphsFromBody(init.body)))));
  await G.analyze(book(30, 'partial-book'), {});
  const c = await G.getCached('partial-book');
  assert.strictEqual(c.length, 30);
  assert(c.slice(0, 12).every(x => x === null));
  assert(c.slice(12).every(x => x && x.source === 'gemini'));
});

test('generateImage: ücretsiz katman 429/403 → sessizce null; görsel parçası → data URL', async () => {
  setupAuto(async u => isList(u) ? res(200, LIST) : res(429, E429('5s')));
  assert.strictEqual(await G.generateImage('x'), null);
  setupAuto(async (u, init) => {
    if (isList(u)) return res(200, LIST);
    assert.strictEqual(modelOf(u), 'gemini-2.5-flash-image');
    assert.deepStrictEqual(JSON.parse(init.body).generationConfig.responseModalities, ['TEXT', 'IMAGE']);
    return res(200, {candidates: [{content: {parts: [{text: 'here'}, {inlineData: {mimeType: 'image/png', data: 'iVBORw0KGgo='}}]}}]});
  });
  assert.strictEqual(await G.generateImage('x'), 'data:image/png;base64,iVBORw0KGgo=');
});

/* ---------- Günlük ücretsiz kota ve token tasarrufu ---------- */
const E429DAY = {error: {code: 429, message: 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 250, model: gemini-2.5-flash', status: 'RESOURCE_EXHAUSTED',
  details: [{'@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaDimensions: {location: 'global', model: 'gemini-2.5-flash'}, quotaValue: '250'}]},
    {'@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '33s'}]}};

test('günlük kota (PerDay): beklemeden sıradaki modele geçer (Flash-Lite), dakikalık 429 ise beklenir', async () => {
  assert(G._internal.isDailyQuota(E429DAY)); assert(!G._internal.isDailyQuota(E429('40s')));
  const models = [], sleeps = [];
  setupAuto(async (u, init) => {
    if (isList(u)) return res(200, LIST);
    models.push(modelOf(u));
    return modelOf(u) === 'gemini-2.5-flash' ? res(429, E429DAY) : geminiOk(init);
  }, sleeps);
  const r = await G.analyze(book(20), {});
  assert.deepStrictEqual(models.slice(0, 2), ['gemini-2.5-flash', 'gemini-2.0-flash']);
  assert(!sleeps.some(x => x >= 1000), 'günlük kotada bekleme yok');
  assert(r.every(x => x.source === 'gemini')); assert(!r.error);
  // aynı gün: tükenen model yeniden denenmez
  await G.analyze(book(5), {});
  assert(!models.slice(2).includes('gemini-2.5-flash'));
});

test('tüm modellerin günlük kotası bitti: bir kez her model, sonra o gün hiç istek yok, Türkçe mesaj', async () => {
  let gen = 0, list = 0;
  setupAuto(async u => { if (isList(u)) { list++; return res(200, LIST); } gen++; return res(429, E429DAY); });
  const r = await G.analyze(book(50), {});
  const flash = G._internal.rankModels(LIST.models).length;   // tükenmeden önce bu kadar Flash vardı (setupAuto sıfırladı)
  assert.strictEqual(r.errorKind, 'daily');
  assert.strictEqual(r.error, 'Gemini günlük ücretsiz kotası doldu — yerel analizle devam ediliyor, yarın kendiliğinden yeniden denenecek');
  assert(r.every(x => x && x.source === 'local'));
  assert(gen >= 2 && gen <= 6, 'her model en fazla bir kez: ' + gen);
  assert.strictEqual(flash, 0, 'hepsi tükenmiş sayılır');
  assert.strictEqual(G.dailyBlocked(), true);
  const before = gen + list;
  const r2 = await G.analyze(book(10), {});
  assert.strictEqual(gen + list, before, 'aynı gün hiç istek atılmaz');
  assert.strictEqual(r2.errorKind, 'daily');
  assert.strictEqual(await G.generateImage('x'), null);
  await assert.rejects(G.generateJSON('x'), e => e.kind === 'daily');
});

test('token tasarrufu: 350 karakter sınırı, kısa satırlar gönderilmez ve sahneyi devralır, 2.5 Flash\'ta thinkingBudget 0, maxOutputTokens dar', async () => {
  const bodies = [];
  setupAuto(async (u, init) => { if (isList(u)) return res(200, LIST); bodies.push({m: modelOf(u), b: JSON.parse(init.body)}); return geminiOk(init); });
  const b = book(10); b.paragraphs[0] = 'y'.repeat(2000); b.paragraphs[4] = '“Evet,” dedi.'; b.paragraphs[5] = 'Hayır.';
  const r = await G.analyze(b, {});
  assert.strictEqual(bodies.length, 1);
  const g = bodies[0].b, txt = g.contents[0].parts[0].text;
  assert.strictEqual((txt.match(/^\[\d+\] /gm) || []).length, 8, 'iki kısa satır atlandı');
  assert(!txt.includes('Evet') && !txt.includes('Hayır'));
  assert(!txt.includes('y'.repeat(351)) && txt.includes('y'.repeat(350)));
  assert.deepStrictEqual(g.generationConfig.thinkingConfig, {thinkingBudget: 0});
  assert(g.generationConfig.maxOutputTokens > 0 && g.generationConfig.maxOutputTokens <= 160 + 8 * 60);
  assert(r.every(x => x && x.source === 'gemini'), 'kısa satırlar Gemini komşusundan devralır');
  assert.strictEqual(r[4].scene, r[3].scene); assert.strictEqual(r[5].mood, r[3].mood);
  const other = G._internal.buildRequest({title: 'T'}, ['abc'], 0, 'gemini-2.0-flash');
  assert(!other.generationConfig.thinkingConfig, 'desteklemeyen modele gönderilmez');
});

test('tamamen önbellekte olan kitap yeniden çözümlenmez (ListModels bile çağrılmaz)', async () => {
  let n = 0;
  setupAuto(async (u, init) => { n++; return isList(u) ? res(200, LIST) : geminiOk(init); });
  const b = book(30, 'full-cache-book');
  await G.analyze(b, {});
  const first = n;
  setupAuto(async () => { n++; throw new Error('çağrılmamalı'); });
  const r = await G.analyze(b, {});
  assert.strictEqual(n, first); assert(r.every(x => x.source === 'gemini'));
});

/* ---------- Sesli okuma yardımcıları ---------- */
test('voiceCommand: Türkçe/İngilizce komutlar bulunur ve metinden çıkarılır', () => {
  const C = Core.voiceCommand;
  assert.deepStrictEqual([C('Müziği değiştir').cmd, C('başka müzik lütfen').cmd, C('next song').cmd], ['next', 'next', 'next']);
  assert.strictEqual(C('müziği durdur').cmd, 'stop'); assert.strictEqual(C('Stop music').cmd, 'stop');
  assert.strictEqual(C('müziği başlat').cmd, 'play'); assert.strictEqual(C('play music').cmd, 'play');
  assert.strictEqual(C('sesi aç').cmd, 'up'); assert.strictEqual(C('SESİ KIS').cmd, 'down');
  const x = C('deniz sakindi müziği değiştir dalgalar');
  assert.strictEqual(x.cmd, 'next'); assert.strictEqual(x.rest, 'deniz sakindi dalgalar');
  assert.strictEqual(C('deniz sakindi ve dalgalar kıyıya vuruyordu').cmd, null);
  assert.strictEqual(C('müziğin sesi açıktı').cmd, null, 'kelime ortasında eşleşmez');
});
test('voiceEnergy ve VoiceGate: sakin/yavaş → düşük, hızlı/yüksek → yüksek; 8 sn kalıcı, 20 sn aralık', () => {
  const lo = Core.voiceEnergy(-45, 95), hi = Core.voiceEnergy(-22, 175);
  assert(lo < 0.2 && hi > 0.8, lo + ' ' + hi);
  const g = new Core.VoiceGate({delta: 0.22, hold: 8000, gap: 20000});
  assert.strictEqual(g.push(0.3, 0), null);          // taban
  assert.strictEqual(g.push(0.8, 1000), null);       // kaydı ama kalıcı değil
  assert.strictEqual(g.push(0.35, 3000), null);      // geri döndü: sayaç sıfırlanır
  assert.strictEqual(g.push(0.8, 4000), null);
  assert.strictEqual(g.push(0.8, 11000), null);      // 7 sn
  assert.strictEqual(g.push(0.8, 12100), 0.8);       // 8 sn kalıcı → değişim
  assert.strictEqual(g.push(0.2, 13000), null);
  assert.strictEqual(g.push(0.2, 25000), null, '20 sn dolmadan ikinci değişim yok');
  assert.strictEqual(g.push(0.2, 32200), 0.2);
});

/* ---------- Kapaklar ---------- */
const Cov = R('covers.js');
test('kapak: başlık eşleşmesi Türkçe duyarlı ve kendinden emin', () => {
  assert.strictEqual(Cov.norm('Suç ve Ceza'), Cov.norm('SUC VE CEZA'));
  assert.strictEqual(Cov.norm('İnce Memed'), 'ince memed');
  assert.strictEqual(Cov.norm('KIRMIZI'), 'kirmizi');
  assert.strictEqual(Cov.titleScore('The Adventures of Sherlock Holmes', 'Adventures of Sherlock Holmes'), 1);
  assert.strictEqual(Cov.titleScore('Pride and Prejudice', 'Pride & Prejudice: A Novel'), 1);
  assert(Cov.titleScore('Dracula', "Dracula's Guest") < 0.9);
  assert(Cov.isConfident({title: 'Kürk Mantolu Madonna', author: 'Sabahattin Ali'}, {title: 'Kurk Mantolu Madonna', authors: ['Sabahattin Ali']}));
  assert(!Cov.isConfident({title: 'Kürk Mantolu Madonna', author: 'Sabahattin Ali'}, {title: 'Kürk Mantolu Madonna', authors: ['Başka Biri']}));
  assert(!Cov.isConfident({title: 'Dracula', author: 'Bram Stoker'}, {title: 'Dracula Untold', authors: ['Bram Stoker']}));
  assert(Cov.isConfident({title: 'Walden', author: ''}, {title: 'Walden', authors: ['Henry David Thoreau']}));
});
test('kapak: tasarım tarifi doğrulanır (palet, kontrast, motif, yerleşim, özet)', () => {
  const fb = Cov.localSpec({title: 'Fener Bekçisinin Kızı', mood: 'gizem', excerpt: 'deniz sakindi'});
  assert.strictEqual(fb.motif, 'lighthouse');
  assert(Cov.MOTIF_NAMES.length >= 16);
  const ok = Cov.validateSpec({palette: ['#F1E3C4', '#1a1410'], motif: 'moon', layout: 'band', summary: ' A moonlit\nharbour. '}, fb);
  assert.deepStrictEqual(ok.palette, ['#1a1410', '#f1e3c4'], 'koyu zemin önce');
  assert.strictEqual(ok.motif, 'moon'); assert.strictEqual(ok.layout, 'band'); assert.strictEqual(ok.summary, 'A moonlit harbour.');
  const bad = Cov.validateSpec({palette: ['red', '#123'], motif: 'dragon', layout: 'diagonal', summary: 5}, fb);
  assert.deepStrictEqual(bad.palette, fb.palette); assert.strictEqual(bad.motif, fb.motif); assert.strictEqual(bad.layout, fb.layout); assert.strictEqual(bad.summary, '');
  const low = Cov.validateSpec({palette: ['#333333', '#3a3a3a'], motif: 'key', layout: 'center'}, fb);
  assert.deepStrictEqual(low.palette, fb.palette, 'düşük kontrast → yedek palet');
  assert.notStrictEqual(Cov.localSpec({title: 'X', mood: 'ask'}, 1).motif, Cov.localSpec({title: 'X', mood: 'ask'}, 0).motif, 'seed çeşitleme üretir');
  const svg = Cov.renderSVG(ok, {title: 'Ay & <Liman>', author: 'Örnek'});
  assert(/^<svg/.test(svg) && svg.includes('Ay &amp; &lt;Liman&gt;') && svg.includes('Fraunces') && svg.includes('ÖRNEK'));
});
test('kapak hattı: Open Library güvenilmez eşleşmeyi ve kapaksız kaydı eler; bulunamazsa Gemini tarifi, görsel reddedilirse tasarım', async () => {
  const urls = [];
  const fetch = async u => {
    urls.push(u);
    if (/openlibrary/.test(u)) return res(200, {docs: [{title: 'Moby Dick; or, The Whale', author_name: ['Herman Melville'], cover_i: 12345}, {title: 'Moby Dick Coloring Book', author_name: ['X'], cover_i: 9}, {title: 'Moby Dick', author_name: ['Herman Melville']}]});
    return res(200, {items: []});
  };
  const c = await Cov.find({title: 'Moby Dick', author: 'Herman Melville', mood: 'macera'}, {fetch});
  assert.strictEqual(c[0].src, 'https://covers.openlibrary.org/b/id/12345-L.jpg'); assert.strictEqual(c[0].source, 'openlibrary');
  assert.strictEqual(c.length, 2); assert.strictEqual(c[1].source, 'design');
  assert(/search\.json\?title=Moby%20Dick&author=Herman%20Melville&limit=5&fields=key,title,author_name,cover_i,first_publish_year/.test(urls[0]));
  let asked = null;
  const Gm = {generateJSON: async p => { asked = p; return {summary: 'A lone lamp over a stormy sea.', palette: ['#0b1d2a', '#f3d9a4'], motif: 'lighthouse', layout: 'frame'}; }, generateImage: async () => null};
  const none = async () => res(200, {docs: [], items: []});
  const d = await Cov.find({title: 'Benim Öyküm', author: 'Ben', mood: 'gizem', excerpt: 'Fener...'}, {fetch: none, G: Gm, hasKey: true});
  assert.strictEqual(d.length, 1); assert.strictEqual(d[0].source, 'design');
  assert.strictEqual(d[0].spec.motif, 'lighthouse'); assert.strictEqual(d[0].spec.summary, 'A lone lamp over a stormy sea.');
  assert(/Benim Öyküm/.test(asked));
  const e = await Cov.find({title: 'Benim Öyküm', mood: 'ask'}, {fetch: async () => { throw new TypeError('offline'); }});
  assert.strictEqual(e[0].source, 'design', 'çevrimdışıyken de bir kapak');
});

/* ---------- Müzik ---------- */
test('katalog bütünlüğü: benzersiz vid, geçerli mood, mood başına 4+', () => {
  const C = M.CATALOG;
  assert(C.length >= 32);
  assert.strictEqual(new Set(C.map(t => t.vid)).size, C.length);
  for (const t of C) {
    assert(/^[A-Za-z0-9_-]{11}$/.test(t.vid), t.vid);
    assert(t.title && t.artist && t.license && t.credit);
    assert(t.moods.length && t.moods.every(m => MOODS.includes(m)), t.title);
    assert(t.energy >= 0 && t.energy <= 1);
    assert(Array.isArray(t.tags));
  }
  for (const m of MOODS) assert(C.filter(t => t.moods.includes(m)).length >= 4, m);
});

test('müzik beğenisi: beğenilmeyen o duyguda seçilmez, beğenilen öne geçer, tekrar yok kuralı sürer', async () => {
  M.configure({youtubeKey: '', _reset: true});
  const req = s => ({mood: 'huzun', energy: 0.3, query: 'sad piano', scene: s});
  const first = await M.pick(req(1));
  M.rate(first, 'huzun', -1);
  const again = await M.pick(req(1));                                // sahne önbelleği de beğenilmeyeni bırakır
  assert.notStrictEqual(again.vid, first.vid);
  for (let s = 2; s < 12; s++) assert.notStrictEqual((await M.pick(req(s))).vid, first.vid);
  assert.strictEqual(M.prefOf(first.vid, 'huzun'), -1); assert.strictEqual(M.prefOf(first.vid, 'gizem'), 0);
  // beğenilen, normalde seçilmeyecek bir parça öne geçer
  const loser = M.CATALOG.filter(t => t.moods[0] === 'huzun' && t.vid !== first.vid).map(t => t.vid);
  const base = (await M.pick(req(50))).vid;
  const target = loser.find(v => v !== base);
  M.configure({_reset: true}); M.setPrefs({huzun: {[target]: 1}});
  assert.strictEqual((await M.pick(req(50))).vid, target, 'beğenilen seçilir');
  assert.notStrictEqual((await M.pick(req(51))).vid, target, 'art arda aynı parça yok');
  M.configure({_reset: true});
});

test('pick: belirlenimci, aynı sahne aynı parça, art arda tekrar yok', async () => {
  M.configure({youtubeKey: '', _reset: true});
  const a = await M.pick({mood: 'karanlik', energy: 0.4, query: 'eerie gothic ambient', scene: 1});
  M.configure({_reset: true});
  const b = await M.pick({mood: 'karanlik', energy: 0.4, query: 'eerie gothic ambient', scene: 1});
  assert.strictEqual(a.vid, b.vid, 'aynı girdi aynı sonuç');
  assert(a.moods.includes('karanlik'));
  const same = await M.pick({mood: 'nese', energy: 0.9, query: 'x', scene: 1});
  assert.strictEqual(same.vid, a.vid, 'aynı sahne parçasını korur');
  let prev = a.vid;
  for (let s = 2; s < 30; s++) {
    const t = await M.pick({mood: 'karanlik', energy: 0.4, query: 'eerie gothic ambient', scene: s});
    assert.notStrictEqual(t.vid, prev, 'art arda aynı parça');
    prev = t.vid;
  }
});

test('pick: en yakın enerji ve etiket örtüşmesi', async () => {
  M.configure({youtubeKey: '', _reset: true});
  const hi = await M.pick({mood: 'gerilim', energy: 0.95, query: 'fast chase action', scene: 'a'});
  assert.strictEqual(hi.vid, '2pXa5jzaOBg');
  const noir = await M.pick({mood: 'gizem', energy: 0.35, query: 'film noir detective jazz', scene: 'b'});
  assert.strictEqual(noir.vid, '0L-_ySwTSDA');
});

test('pick: YouTube anahtarıyla CC araması, önbellek, hatada kataloga dönüş', async () => {
  const urls = [];
  M.configure({youtubeKey: 'YT', _reset: true, _fetch: async (u, init) => {
    urls.push(u); assert.strictEqual(init.headers['x-goog-api-key'], 'YT');
    return res(200, {items: [{id: {videoId: 'AAAAAAAAAAA'}, snippet: {title: 'Calm &amp; Soft', channelTitle: 'Someone'}}, {id: {videoId: 'BBBBBBBBBBB'}, snippet: {title: 'B', channelTitle: 'C'}}]});
  }});
  const t = await M.pick({mood: 'huzur', energy: 0.2, query: 'calm piano', scene: 10});
  assert.strictEqual(t.vid, 'AAAAAAAAAAA'); assert.strictEqual(t.title, 'Calm & Soft');
  const u = urls[0];
  for (const p of ['type=video', 'videoLicense=creativeCommon', 'videoEmbeddable=true', 'videoCategoryId=10']) assert(u.includes(p), p);
  assert(/q=calm%20piano%20instrumental/.test(u));
  assert(!/key=/.test(u));
  const t2 = await M.pick({mood: 'huzur', energy: 0.2, query: 'calm piano', scene: 11});
  assert.strictEqual(urls.length, 1, 'sorgu önbellekten');
  assert.strictEqual(t2.vid, 'BBBBBBBBBBB', 'art arda tekrar yok');
  M.configure({youtubeKey: 'YT', _reset: true, _fetch: async () => res(403, {})});
  const f = await M.pick({mood: 'huzur', energy: 0.2, query: 'calm piano', scene: 1});
  assert(M.CATALOG.includes(f));
  M.configure({youtubeKey: '', _fetch: null, _reset: true});
});

test('Node\'da oynatıcı yok: init available=false ile çözülür', async () => {
  assert.strictEqual(await M.init(null), false);
  assert.strictEqual(M.available, false);
  assert.deepStrictEqual(M.current(), {track: null, state: 'paused'});
});

/* ---------- Claude aktarımı ---------- */
const C = R('claude-handoff.js');
const cbook = (n, len) => ({id: 'c1', lang: 'en', title: 'Çalıkuşu Örnek', author: 'R. N. Güntekin',
  paragraphs: Array.from({length: n}, (_, i) => ('P' + i + ' ').padEnd(len || 100, 'x'))});
const reply = o => 'Tabii, işte:\n```json\n' + JSON.stringify(o) + '\n```\nİyi okumalar!';
test('Claude dışa aktarım: tek parça, ¶ numaralı, istem eksiksiz', () => {
  const b = cbook(30), ex = C.buildExport(b);
  assert.strictEqual(ex.parts.length, 1);
  const p = ex.parts[0];
  assert.strictEqual(p.filename, 'calikusu-ornek.txt');
  assert(/^¶1 P0 /m.test(p.text) && /^¶30 P29 /m.test(p.text) && !/¶31/.test(p.text));
  assert(p.prompt.includes('¶1–¶30') && p.prompt.includes('```json') && /YALNIZCA/.test(p.prompt));
  for (const m of MOODS) assert(p.prompt.includes(m), m);
  assert.strictEqual(C.PROMPT_VERSION, 1);
});
test('Claude dışa aktarım: çok parçalı, paragraf sınırında, sınırlar boşluksuz', () => {
  const b = cbook(100, 1000), ex = C.buildExport(b, {maxChars: 10000});
  assert(ex.parts.length >= 10);
  let next = 1;
  for (const p of ex.parts) {
    assert.strictEqual(p.from, next); next = p.to + 1;
    assert(p.text.length - p.text.indexOf('\n\n') <= 10000 + 2, 'parça çok uzun');
    assert(p.prompt.includes('¶' + p.from + '–¶' + p.to) && p.prompt.includes(p.index + '. parça'));
    assert(p.filename.endsWith('-parca-' + p.index + '-' + p.count + '.txt'));
  }
  assert.strictEqual(next, 101);
  const big = C.buildExport(cbook(3, 50000), {maxChars: 20000});   // tek uzun paragraf kendi parçası
  assert.deepStrictEqual(big.parts.map(p => [p.from, p.to]), [[1, 1], [2, 2], [3, 3]]);
});
test('Claude sonuç: geçerli yanıt, kapsam tam, birleştirme biçimi', () => {
  const b = cbook(30);
  const r = C.parseResult(reply({v: 1, book: {title: 'X', author: 'Y', lang: 'tr', genre: 'roman', coverScene: 'A schoolhouse in snow'},
    scenes: [{from: 1, to: 14, mood: 'huzur', energy: 0.3, query: 'calm piano ambient', note: 'giriş'}, {from: 15, to: 30, mood: 'gerilim', energy: 0.8, query: 'tense strings', note: 'kavga'}]}), b);
  assert(r.ok); assert.deepStrictEqual(r.warnings, []);
  assert.strictEqual(r.coverage.ratio, 1); assert.strictEqual(r.coverage.covered, 30);
  assert.strictEqual(r.book.coverScene, 'A schoolhouse in snow');
  const res2 = C.merge(b, null, r);
  assert.strictEqual(res2.length, 30);
  assert.deepStrictEqual(res2[0], {mood: 'huzur', energy: 0.3, query: 'calm piano ambient', scene: 0, source: 'claude'});
  assert.deepStrictEqual(res2[29], {mood: 'gerilim', energy: 0.8, query: 'tense strings', scene: 14, source: 'claude'});
});
test('Claude sonuç: bozuk/yarım JSON onarılır, bilinmeyen duygu yerel, boşluk ve çakışma komşudan', () => {
  const b = cbook(40);
  const txt = '```json\n{"v":1,"book":{"title":"X"},"scenes":[{"from":1,"to":10,"mood":"Hüzün","energy":3,"query":"sad piano",},' +
    '{"from":8,"to":20,"mood":"öfke","energy":0.5},{"from":25,"to":33,"mood":"macera","energy":0.7,"query":"epic"},{"from":34,"to":4';
  const r = C.parseResult(txt, b);
  assert(r.ok, r.warnings.join());
  assert.strictEqual(r.scenes[0].mood, 'huzun'); assert.strictEqual(r.scenes[0].energy, 0.3);
  assert(MOODS.includes(r.scenes[1].mood)); assert.strictEqual(r.scenes[1].from, 11);
  assert.strictEqual(r.scenes[1].to, 24);                     // boşluk 21–24 dolduruldu
  assert.strictEqual(r.scenes[r.scenes.length - 1].to, 40);   // yarım kalan son sahne atıldı, kuyruk dolduruldu
  assert(r.warnings.some(w => /onarıldı/.test(w)) && r.warnings.some(w => /bilinmeyen/.test(w)) && r.warnings.some(w => /çakışma/.test(w)) && r.warnings.some(w => /boşluk/.test(w)));
  assert.strictEqual(r.coverage.covered, 10 + 10 + 9);
  assert.strictEqual(r.coverage.ratio, +(29 / 40).toFixed(3));
  const m = C.merge(b, new Array(40).fill(null), r);
  assert(m.every(x => x && x.source === 'claude'));
});
test('Claude sonuç: kod bloğu yoksa ilk { … son }; JSON yoksa ok=false', () => {
  const b = cbook(10);
  const r = C.parseResult('Sonuç: {"scenes":[{"from":"¶1","to":"¶10","mood":"gizem"}]} bitti', b);
  assert(r.ok); assert.strictEqual(r.scenes[0].query, 'mysterious ambient noir'); assert.strictEqual(r.coverage.ratio, 1);
  const bad = C.parseResult('Üzgünüm, yardımcı olamam.', b);
  assert.strictEqual(bad.ok, false); assert(bad.warnings.length);
  assert.strictEqual(C.parseResult('{"scenes":[]}', b).ok, false);
});
test('Claude sonuç: çok parçalı kitapta parça aralığı ve kapsam', () => {
  const b = cbook(100, 1000), ex = C.buildExport(b, {maxChars: 30000}), p2 = ex.parts[1];
  const r = C.parseResult(reply({v: 1, book: {}, scenes: [{from: p2.from + 2, to: p2.to, mood: 'ask', energy: 0.4, query: 'romantic piano'}]}), b, p2);
  assert(r.ok);
  assert.deepStrictEqual([r.coverage.from, r.coverage.to], [p2.from, p2.to]);
  assert.strictEqual(r.coverage.filled, 2);
  assert.strictEqual(r.coverage.total, 100);
  const prev = new Array(100).fill(null); prev[0] = {mood: 'huzur', energy: 0.2, query: 'q', scene: 0, source: 'gemini'};
  const m = C.merge(b, prev, r);
  assert.strictEqual(m[0].source, 'gemini'); assert.strictEqual(m[p2.from - 1].source, 'claude'); assert.strictEqual(m[p2.to], null);
});

test('hazır analiz: 12 önerilen kitap, sahneler sıralı/boşluksuz, merge source=hazır', () => {
  const fs = require('fs');
  for (const rec of Books.RECOMMENDED) {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'analysis', rec.gid + '.json'), 'utf8'));
    assert.strictEqual(d.source, 'hazır'); assert.strictEqual(d.gid, rec.gid); assert(d.n > 100);
    let next = 1;
    for (const s of d.scenes) { assert.strictEqual(s.from, next, rec.title); assert(s.to >= s.from && MOODS.includes(s.mood) && s.energy >= 0 && s.energy <= 1 && s.query); next = s.to + 1; }
    assert.strictEqual(next, d.n + 1, rec.title);
    if (rec.gid === 43) {
      const m = C.merge({paragraphs: new Array(d.n).fill('x')}, null, Object.assign({ok: true}, d));
      assert(m.every(x => x && x.source === 'hazır'));
    }
  }
});

test('Türk klasikleri: 6 eser, tr, Vikikaynak sayfası, hazır analiz tutarlı, fetchText vekili kullanır', async () => {
  const fs = require('fs'), T = Books.TURKISH;
  assert.strictEqual(T.length, 6); assert.strictEqual(new Set(T.map(b => b.gid)).size, 6);
  for (const b of T) {
    assert.strictEqual(b.lang, 'tr'); assert(b.page && b.blurb && MOODS.includes(b.mood) && /^tr-[a-z-]+$/.test(b.gid) && b.cover === 'assets/covers/' + b.gid + '.jpg' && require('fs').existsSync(require('path').join(__dirname, '..', b.cover)), b.title);
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'analysis', b.gid + '.json'), 'utf8'));
    assert.strictEqual(d.lang, 'tr'); assert(d.n >= 40, b.title);
    let next = 1; for (const s of d.scenes) { assert.strictEqual(s.from, next); next = s.to + 1; } assert.strictEqual(next, d.n + 1);
  }
  let url = ''; const old = globalThis.fetch;
  globalThis.fetch = async u => { url = u; return {ok: true, text: async () => 'metin'}; };
  try { assert.strictEqual(await Books.fetchText(T[0]), 'metin'); } finally { globalThis.fetch = old; }
  assert.strictEqual(url, '/api/vikikaynak?page=' + encodeURIComponent('Kaşağı'));
});

test('karakter adları: gemi/yer adları elenir, konuşan karakter kalır', () => {
  const tx = [];
  for (let i = 0; i < 30; i++) tx.push('The sun rose over the Pequod again and again, ' + i + ' times.', '“Lower away,” said Ahab to the crew, and Ahab turned.', 'We sailed toward Nantucket and Nantucket was far.');
  const names = Core.findChars(tx).map(c => c.name);
  assert.ok(names.includes('Ahab'), names.join(','));
  assert.ok(!names.includes('Pequod'), 'Pequod gemi adı: ' + names.join(','));
  assert.ok(!names.includes('Nantucket'), 'Nantucket yer adı: ' + names.join(','));
  const raw = require('fs').readFileSync(path.join(__dirname, '..', 'cache', 'pg2701.txt'), 'utf8');
  const md = Core.findChars(Core.parseGutenberg(raw).body.split(/\n\s*\n/)).map(c => c.name);
  assert.ok(md.includes('Ahab') && !md.includes('Pequod'), md.join(','));
});

test('recap: son 30 paragraftan 3 cümle, metin sırasıyla, karakter ve sona yakınlık ağır basar', () => {
  const tx = [];
  for (let i = 0; i < 60; i++) tx.push('The weather was plain and the road went on for a long while without any change at all, number ' + i + '.');
  tx[50] = 'Silver drew his knife in a sudden fury and the terrible fear spread through the whole crew at once.';
  tx[58] = 'Jim ran to the stockade, his heart pounding with fear and hope as the shots rang out behind him.';
  tx[10] = 'Silver laughed with joy in the old days long before any of this had happened to the crew.';
  const r = Core.recap(tx, 59, {lang: 'en', chars: [{name: 'Silver'}, {name: 'Jim'}]});
  assert.strictEqual(r.length, 3);
  assert(r.every(x => x.para >= 30), 'yalnız son 30 paragraf');
  assert(r.some(x => x.para === 50) && r.some(x => x.para === 58));
  assert(r[0].para <= r[1].para && r[1].para <= r[2].para);
  assert.deepStrictEqual(Core.recap([], 0), []);
});

test('okuma hedefi: bugünkü dakika, seri (bugün dolmadıysa dünden), boşlukta kopar', () => {
  const now = new Date(2026, 10, 17, 21, 0), k = off => Core.dayKey(new Date(2026, 10, 17 - off, 12));
  const days = {[k(0)]: 600, [k(1)]: 1200, [k(2)]: 1500, [k(3)]: 100, [k(4)]: 2000};
  let g = Core.goalStats(days, 20, now);
  assert.strictEqual(g.today, 600); assert.strictEqual(g.done, false); assert.strictEqual(g.streak, 2); assert.ok(Math.abs(g.frac - 0.5) < 1e-9);
  days[k(0)] = 1300; g = Core.goalStats(days, 20, now);
  assert.strictEqual(g.done, true); assert.strictEqual(g.streak, 3);
  assert.strictEqual(Core.goalStats({}, 20, now).streak, 0);
  assert.strictEqual(Core.dayKey(new Date(2026, 0, 5)), '2026-01-05');
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack || e)); }
  }
  console.log('\n' + pass + ' geçti, ' + fail + ' başarısız');
  process.exit(fail ? 1 : 0);
})();
