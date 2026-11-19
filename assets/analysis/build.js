// Önerilen kitapların hazır sahne analizi (LLM yok, yalnızca yerel Core): node assets/analysis/build.js
// Metin: cache/pg<gid>.txt, yoksa http://localhost:4173/api/gutenberg?id=<gid>. Çıktı: assets/analysis/<gid>.json
// Biçim: {v, gid, id, title, n, source:'hazır', scenes:[{from,to,mood,energy,query}]}  (from/to 1 tabanlı, ui.js'teki
// paragraf sırası: Core.parseText(Core.parseGutenberg(raw).body) içinde başlık olmayan bloklar).
// Kullanım: SA_Claude.merge(book, null, Object.assign({ok: true}, data)) → results[i] = {..., source: 'hazır'}
'use strict';
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..', '..');
const Core = require(path.join(W, 'core.js')), Books = require(path.join(W, 'books.js'));
const MOODS = Core.MOODS, MIN_SCENE = 4;
const QUERY = {huzur: 'calm ambient piano', huzun: 'sad emotional piano strings', gerilim: 'suspense tension cinematic',
  karanlik: 'dark ambient horror', nese: 'happy playful whimsical', ask: 'romantic gentle piano',
  macera: 'epic adventure orchestral', gizem: 'mysterious ambient noir'};
const ENERGY = {huzur: 0.2, huzun: 0.3, gerilim: 0.75, karanlik: 0.45, nese: 0.65, ask: 0.35, macera: 0.75, gizem: 0.4};

async function text(gid, page) {
  // Türk klasikleri (page): cache/vk-<ad>.txt (server.js ile aynı adlandırma), yoksa /api/vikikaynak
  const f = page ? path.join(W, 'cache', 'vk-' + page.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 80) + '.txt') : path.join(W, 'cache', 'pg' + gid + '.txt');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const r = await fetch(page ? 'http://localhost:4173/api/vikikaynak?page=' + encodeURIComponent(page) : 'http://localhost:4173/api/gutenberg?id=' + gid);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
function scenesOf(blocks, lang) {
  const items = [];
  let brk = true;
  for (const b of blocks) { if (b.h) { brk = true; continue; } const a = Core.analyze(b.t, lang); items.push({v: a.v, n: a.n, amb: a.amb, brk}); brk = false; }
  const dec = Core.decode(items), runs = [];
  for (let i = 0; i < items.length; i++) {
    const p = runs[runs.length - 1];
    if (p && p.m === dec.mood[i] && !items[i].brk) { p.to = i; p.e += dec.inten[i]; }
    else runs.push({from: i, to: i, m: dec.mood[i], e: dec.inten[i]});
  }
  // Kısa sahneleri (tek diyalog satırı vb.) komşuya kat: müzik sık değişmesin
  const out = [];
  for (const r of runs) {
    const p = out[out.length - 1], len = r.to - r.from + 1;
    if (p && (p.m === r.m || len < MIN_SCENE)) { p.to = r.to; p.e += r.e; } else out.push(r);
  }
  if (out.length > 1 && out[0].to - out[0].from + 1 < MIN_SCENE) { out[1].from = 0; out[1].e += out[0].e; out.shift(); }
  return {n: items.length, scenes: out.map(r => {
    const mood = MOODS[r.m], avg = r.e / (r.to - r.from + 1);
    return {from: r.from + 1, to: r.to + 1, mood, energy: +Math.max(0, Math.min(1, ENERGY[mood] + (avg - 0.45) * 0.4)).toFixed(2), query: QUERY[mood]};
  })};
}
(async () => {
  const only = process.argv.includes('--tr');   // yalnız Türk klasikleri
  for (const rec of (only ? [] : Books.RECOMMENDED).concat(Books.TURKISH || [])) {
    try {
      const g = Core.parseGutenberg(await text(rec.gid, rec.page)), blocks = Core.parseText(g.body);
      const lang = rec.lang || g.lang || 'en', {n, scenes} = scenesOf(blocks, lang);
      const data = {v: 1, gid: rec.gid, id: rec.id || 'pg' + rec.gid, title: rec.title, lang, n, source: 'hazır', generated: new Date().toISOString().slice(0, 10), scenes};
      fs.writeFileSync(path.join(__dirname, rec.gid + '.json'), JSON.stringify(data));
      console.log(rec.gid, rec.title, '→', n, 'paragraf,', scenes.length, 'sahne');
    } catch (e) { console.log(rec.gid, rec.title, 'HATA:', e.message); process.exitCode = 1; }
  }
})();
