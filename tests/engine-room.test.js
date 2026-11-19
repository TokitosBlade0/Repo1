// node tests/engine-room.test.js — motor eklentileri (sahne, motif, fadeTo, ambience), oda API'si ve room.js
'use strict';
const assert = require('assert'), path = require('path'), http = require('http'), {spawn} = require('child_process');
const ROOT = path.join(__dirname, '..');
const Engine = require(path.join(ROOT, 'engine.js'));
let pass = 0, fail = 0;
async function T(name, fn) { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  HATA ' + name + ': ' + (e && e.message)); } }

/* ---- Sahte Web Audio bağlamı ---- */
function mockCtx(sr) {
  const ctx = {currentTime: 0, sampleRate: sr || 8000, state: 'running', destination: {name: 'dest'}, live: new Set(), stops: [], all: []};
  const Param = v => ({value: v, ev: [], setValueAtTime(x, t) { this.ev.push(['set', x, t]); }, linearRampToValueAtTime(x, t) { this.ev.push(['lin', x, t]); },
    setTargetAtTime(x, t, c) { this.ev.push(['tgt', x, t, c]); }, cancelScheduledValues(t) { this.ev.push(['cancel', t]); }});
  const node = kind => { const n = {kind, outs: new Set(), connect(o) { this.outs.add(o); return o; }, disconnect() { this.outs.clear(); ctx.live.delete(this); },
      start() {}, stop(t) { ctx.stops.push({n: this, t}); }, setPeriodicWave() {}, onended: null};
    for (const p of ['gain', 'frequency', 'Q', 'detune', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release']) n[p] = Param(p === 'gain' ? 1 : 0);
    ctx.live.add(n); ctx.all.push(n); return n; };
  for (const k of ['Gain', 'BiquadFilter', 'StereoPanner', 'Oscillator', 'BufferSource', 'Convolver', 'DynamicsCompressor']) ctx['create' + k] = () => node(k);
  ctx.createPeriodicWave = () => ({});
  ctx.createBuffer = (ch, len, rate) => { const d = []; for (let i = 0; i < ch; i++) d.push(new Float32Array(len)); return {numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: i => d[i]}; };
  ctx.resume = async () => { ctx.state = 'running'; }; ctx.suspend = () => {};
  ctx.advance = dt => { ctx.currentTime += dt; ctx.stops = ctx.stops.filter(s => { if (s.t <= ctx.currentTime + 1e-9) { if (s.n.onended) s.n.onended(); return false; } return true; }); };
  return ctx;
}
const peak = b => { let m = 0; for (let c = 0; c < b.numberOfChannels; c++) for (const x of b.getChannelData(c)) { if (!Number.isFinite(x)) return NaN; m = Math.max(m, Math.abs(x)); } return m; };

async function engineTests() {
  console.log('Motor');
  await T('selfTest hâlâ geçiyor', () => { const bad = Engine.selfTest().filter(r => !r.ok); assert.strictEqual(bad.length, 0, JSON.stringify(bad)); });
  await T('altı sahne de üretiliyor, tepe ≤ -30 dBFS, sessiz değil', () => {
    const ctx = mockCtx(8000);
    for (const id of ['rain', 'wind', 'sea', 'fire', 'hooves', 'crowd']) {
      const b = Engine.renderScene(ctx, id, Engine.mulberry32(3)), p = peak(b);
      assert.ok(Math.abs(p - 1) < 1e-6, id + ' normalize değil: ' + p);
      assert.ok(b.duration >= 7, id + ' döngü kısa');
    }
  });
  await T('toynaklar ~2,2 Hz, hafif swing', () => {
    const ctx = mockCtx(8000), b = Engine.renderScene(ctx, 'hooves', Engine.mulberry32(5)), d = b.getChannelData(0), fr = 80; // 10 ms kare
    const e = []; for (let i = 0; i + fr <= d.length; i += fr) { let s = 0; for (let j = 0; j < fr; j++) s += d[i + j] * d[i + j]; e.push(s); }
    const mx = Math.max(...e), on = []; for (let i = 1; i < e.length; i++) if (e[i] > mx * 0.15 && e[i - 1] <= mx * 0.15) on.push(i * 0.01);
    assert.ok(on.length >= 14 && on.length <= 18, 'vuruş sayısı ' + on.length);
    const iv = on.slice(1).map((t, i) => t - on[i]), mean = iv.reduce((a, b) => a + b, 0) / iv.length;
    assert.ok(Math.abs(1 / mean - 2.2) < 0.15, 'tempo ' + (1 / mean).toFixed(2) + ' Hz');
    assert.ok(Math.max(...iv) - Math.min(...iv) > 0.03, 'swing yok');
  });
  await T('scene: 2 sn çapraz geçiş, seviye ≤ -30 dBFS, düğüm sızıntısı yok, tampon önbellekte', () => {
    const ctx = mockCtx(8000), en = Engine.create(ctx, {offline: true}); en.advanceTo(0.1);
    const base = ctx.live.size;
    en.scene('fire'); assert.strictEqual(en.sceneId, 'fire'); assert.ok(en.liveExtra > 0);
    const g = [...ctx.live].filter(n => n.kind === 'Gain').pop(), lin = g.gain.ev.find(e => e[0] === 'lin');
    assert.ok(lin && lin[1] <= Engine.SCENE_PEAK + 1e-9 && Math.abs(lin[2] - ctx.currentTime - 2) < 1e-9, 'rampa ' + JSON.stringify(lin));
    const buf1 = [...ctx.live].find(n => n.kind === 'BufferSource' && n.loop).buffer;
    for (let i = 0; i < 20; i++) { en.scene(['wind', 'crowd', 'fire', 'sea', 'hooves', 'rain'][i % 6]); ctx.advance(0.5); }
    en.scene('fire'); const buf2 = [...ctx.live].filter(n => n.kind === 'BufferSource' && n.loop).pop().buffer;
    assert.strictEqual(buf1, buf2, 'tampon yeniden üretildi');
    en.scene('bilinmeyen'); assert.strictEqual(en.sceneId, null);
    ctx.advance(2.5);
    assert.strictEqual(en.liveExtra, 0); assert.strictEqual(ctx.live.size, base, 'sızıntı: ' + (ctx.live.size - base));
  });
  await T('fadeTo: doğrusal rampa, akor değişimi rampayı bozmaz, 0 olunca motor durmaz', () => {
    const ctx = mockCtx(8000), en = Engine.create(ctx, {offline: true}); en.advanceTo(1);
    const lim = ctx.all.find(n => n.kind === 'DynamicsCompressor'), vol = ctx.all.find(n => n.kind === 'Gain' && n.outs.has(lim));
    ctx.currentTime = 1; en.fadeTo(0, 30); const last = vol.gain.ev[vol.gain.ev.length - 1];
    assert.deepStrictEqual(last.slice(0, 2), ['lin', 0]); assert.ok(Math.abs(last[2] - 31) < 1e-9);
    const n0 = vol.gain.ev.length; en.set({mood: 4}); ctx.currentTime = 10; en.advanceTo(25);
    assert.strictEqual(vol.gain.ev.length, n0, 'rampa sırasında ses düzeyi değişti');
    ctx.currentTime = 40; en.advanceTo(60); assert.ok(en.playing, 'motor durdu');
    en.volume(0.5); assert.ok(vol.gain.ev.some(e => e[0] === 'tgt' && e[1] === 0.5));
  });
  await T('motif: sonraki vuruşa hizalı, 6 sn kuralı, geçersiz girdi yok sayılır, düğümler temizlenir', () => {
    const ctx = mockCtx(8000), en = Engine.create(ctx, {offline: true}); en.advanceTo(0.5); ctx.currentTime = 3.21;
    assert.strictEqual(en.motif([0, 4, 7], {gain: 0.8}) > 3.21, true);
    const beat = 60 / 72; ctx.currentTime = 3.21;
    assert.strictEqual(en.motif([0, 2, 4]), false, '6 sn içinde ikinci motif');
    ctx.advance(6.1);
    const t0 = en.motif([0, 3, 7, 12]); assert.ok(t0 >= ctx.currentTime && Math.abs(t0 / beat - Math.round(t0 / beat)) < 1e-6, 'hizasız ' + t0);
    ctx.advance(7);
    assert.strictEqual(en.motif([0, 1]), false); assert.strictEqual(en.motif('abc'), false); assert.strictEqual(en.motif([0, NaN, 2]), false);
    ctx.advance(6); assert.strictEqual(en.liveExtra, 0);
  });
  await T('Engine.ambience: bağımsız katman, ses düzeyi, temizlik', () => {
    const ctx = mockCtx(8000); ctx.state = 'suspended'; const A = Engine.ambience(ctx);
    A.scene('sea'); assert.strictEqual(ctx.state, 'running'); assert.strictEqual(A.id, 'sea'); A.volume(0.4); A.volume(7);
    A.scene('crowd'); ctx.advance(2.2); assert.strictEqual(A.live, 2); A.scene(null); ctx.advance(2.2); assert.strictEqual(A.live, 0);
  });
}

/* ---- Oda API'si ---- */
function startServer(port, env) {
  return new Promise((res, rej) => { const p = spawn(process.execPath, [path.join(ROOT, 'server.js')], {env: Object.assign({}, process.env, {PORT: String(port)}, env || {})});
    p.stdout.on('data', () => res(p)); p.on('error', rej); setTimeout(() => rej(new Error('sunucu açılmadı')), 4000); });
}
const req = (port, method, p, body, raw) => new Promise((res, rej) => {
  const data = raw !== undefined ? raw : body === undefined ? null : JSON.stringify(body);
  const r = http.request({host: '127.0.0.1', port, method, path: p, headers: data ? {'Content-Type': 'application/json'} : {}}, x => { let s = ''; x.on('data', c => s += c); x.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} res({status: x.statusCode, j}); }); });
  r.on('error', rej); if (data) r.write(data); r.end();
});
function sseClient(port, code, id) {
  const c = {ev: [], status: 0, closed: false};
  c.req = http.get({host: '127.0.0.1', port, path: '/api/room/' + code + '/events?id=' + id}, r => { c.status = r.statusCode; let buf = '';
    r.on('data', d => { buf += d; let k; while ((k = buf.indexOf('\n\n')) >= 0) { const blk = buf.slice(0, k); buf = buf.slice(k + 2); const m = /^data: (.*)$/m.exec(blk); if (m) c.ev.push(JSON.parse(m[1])); } });
    r.on('end', () => c.closed = true); });
  c.req.on('error', () => {}); c.close = () => c.req.destroy(); return c;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function serverTests() {
  console.log('Oda API');
  const port = 4300 + Math.floor(Math.random() * 500), srv = await startServer(port);
  try {
    let code;
    await T('GET /api/room yoklama, POST kod üretir', async () => {
      assert.strictEqual((await req(port, 'GET', '/api/room')).j.ok, true);
      const r = await req(port, 'POST', '/api/room'); code = r.j.code; assert.ok(/^[A-HJKMNP-Z2-9]{6}$/.test(code), code);
    });
    await T('iki SSE istemcisi: peers ve state aktarımı (gönderene geri gelmez)', async () => {
      const a = sseClient(port, code, 'aaa'); await wait(150); const b = sseClient(port, code, 'bbb'); await wait(150);
      assert.deepStrictEqual(a.ev.map(e => e.n), [1, 2]); assert.deepStrictEqual(b.ev, [{type: 'peers', n: 2}]);
      const r = await req(port, 'POST', '/api/room/' + code.toLowerCase() + '/state', {bookId: 'pg1342', para: 12, vid: 'dQw4w9WgXcQ', from: 'aaa', extra: 'x'});
      assert.strictEqual(r.status, 200); assert.strictEqual(r.j.sent, 1); await wait(100);
      assert.deepStrictEqual(b.ev[1], {type: 'state', bookId: 'pg1342', para: 12, vid: 'dQw4w9WgXcQ', from: 'aaa'});
      assert.ok(!a.ev.some(e => e.type === 'state'), 'gönderene yankı');
      const c = sseClient(port, code, 'ccc'); await wait(150); assert.strictEqual(c.ev.find(e => e.type === 'state').para, 12, 'yeni gelen son durumu almadı');
      c.close(); await wait(150); assert.deepStrictEqual(a.ev.filter(e => e.type === 'peers').pop(), {type: 'peers', n: 2}, 'ayrılış bildirilmedi');
      a.close(); b.close();
    });
    await T('doğrulama: tür, 2 KB, bilinmeyen oda, en çok 8 kişi', async () => {
      const u = '/api/room/' + code + '/state';
      for (const bad of [{bookId: 1, para: -1, from: 'a'}, {bookId: 'x', para: 1.5, from: 'a'}, {bookId: 'x', para: 1}, {bookId: {}, para: 1, from: 'a'}, {bookId: 'x', para: 1, from: 'a', vid: 5}, [1]])
        assert.strictEqual((await req(port, 'POST', u, bad)).status, 400, JSON.stringify(bad));
      assert.strictEqual((await req(port, 'POST', u, null, '{oops')).status, 400);
      assert.strictEqual((await req(port, 'POST', u, {bookId: 'x'.repeat(3000), para: 1, from: 'a'})).status, 413);
      assert.strictEqual((await req(port, 'POST', '/api/room/ZZZZZZ/state', {bookId: 'x', para: 1, from: 'a'})).status, 404);
      assert.strictEqual((await req(port, 'GET', '/api/room/ZZZZZZ/events')).status, 404);
      const cs = []; for (let i = 0; i < 8; i++) cs.push(sseClient(port, code, 'p' + i)); await wait(250);
      const ninth = sseClient(port, code, 'p9'); await wait(150); assert.strictEqual(ninth.status, 409);
      assert.strictEqual((await req(port, 'GET', '/api/room/' + code)).j.n, 8);
      cs.forEach(c => c.close()); ninth.close();
    });
    await T('mevcut yollar değişmedi', async () => {
      assert.strictEqual((await req(port, 'GET', '/')).status, 200); assert.strictEqual((await req(port, 'GET', '/api/gutenberg?id=x')).status, 400);
      assert.strictEqual((await req(port, 'GET', '/cache/x')).status, 403);
    });
  } finally { srv.kill(); }
  const port2 = port + 1, srv2 = await startServer(port2, {ROOM_IDLE_MS: '300'});
  try {
    await T('boşta kalan oda süresi dolunca kapanır', async () => {
      const code = (await req(port2, 'POST', '/api/room')).j.code, a = sseClient(port2, code, 'a'); await wait(900);
      assert.ok(a.ev.some(e => e.type === 'closed') && a.closed, 'kapanmadı'); assert.strictEqual((await req(port2, 'GET', '/api/room/' + code)).status, 404);
    });
  } finally { srv2.kill(); }
}

/* ---- room.js (sahte fetch/EventSource ile) ---- */
async function roomTests() {
  console.log('room.js');
  const calls = [], sources = [];
  globalThis.location = {protocol: 'http:'};
  globalThis.EventSource = class { constructor(u) { this.url = u; this.readyState = 0; sources.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 5); } close() { this.readyState = 2; } };
  globalThis.fetch = async (u, o) => { calls.push({u, o}); const body = u === '/api/room' && o && o.method === 'POST' ? {code: 'ABC234'} : /\/api\/room\/[A-Z0-9]{6}$/.test(u) ? (u.endsWith('ZZZZZZ') ? null : {n: 1, max: 8}) : {ok: true};
    return {ok: !!body, status: body ? 200 : 404, json: async () => body || {error: 'yok'}}; };
  const R = require(path.join(ROOT, 'room.js'));
  await T('available yoklamayla belirlenir, create kod döndürür', async () => { assert.strictEqual(await R.ready, true); assert.strictEqual(R.available, true); assert.strictEqual(await R.create(), 'ABC234'); });
  await T('join: geçersiz/bilinmeyen kod Türkçe hata verir', async () => {
    await assert.rejects(R.join('ab'), /geçersiz/); await assert.rejects(R.join('ZZZZZZ'), /bulunamadı/);
  });
  await T('join + olaylar + send 2/sn ile sınırlı (son durum gönderilir)', async () => {
    const got = []; await R.join('abc234', e => got.push(e)); const es = sources[sources.length - 1];
    assert.ok(es.url.includes('/api/room/ABC234/events?id='));
    es.onmessage({data: JSON.stringify({type: 'peers', n: 2})}); es.onmessage({data: JSON.stringify({type: 'state', para: 3, from: R.id})});
    assert.deepStrictEqual(got, [{type: 'peers', n: 2}]);
    const n0 = calls.length; for (let i = 0; i < 6; i++) R.send({bookId: 'b', para: i});
    await wait(50); const posts = () => calls.slice(n0).filter(c => c.u.endsWith('/state'));
    assert.strictEqual(posts().length, 1); await wait(550);
    assert.strictEqual(posts().length, 2); assert.strictEqual(JSON.parse(posts()[1].o.body).para, 5); assert.strictEqual(JSON.parse(posts()[1].o.body).from, R.id);
    R.leave(); assert.strictEqual(es.readyState, 2); assert.strictEqual(R.code, null);
  });
}

(async () => {
  await engineTests(); await serverTests(); await roomTests();
  console.log(pass + ' / ' + (pass + fail) + ' test geçti'); process.exit(fail ? 1 : 0);
})();
