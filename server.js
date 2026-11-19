// Yerel sunucu: node server.js  →  http://localhost:4173  (eski sürüm: /legacy, test alanı: /test.html)
// PORT ortam değişkeniyle farklı bir port seçilebilir.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const PORT = Number(process.env.PORT) || 4173;
const CACHE_DIR = path.join(__dirname, 'cache');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'};
// Yayınlanan sayfayla aynı iskelet: eski uygulama dosyası <body> içeriği olarak yazıldı.
const SKELETON = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';

// Yalnızca gutenberg.org / pglaf.org / tr.wikisource.org'a giden, yönlendirmeleri izleyen basit GET.
function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !(/(^|\.)(gutenberg|pglaf)\.org$/.test(u.hostname) || u.hostname === 'tr.wikisource.org')) return reject(new Error('izinsiz adres'));
    const req = https.get(u, {headers: {'User-Agent': 'SatirArasi/1.0 (yerel okuma uygulamasi)'}}, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hops < 5) {
        r.resume(); return resolve(get(new URL(r.headers.location, u).href, hops + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
      const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => resolve(Buffer.concat(chunks))); r.on('error', reject);
    });
    req.setTimeout(20000, () => req.destroy(new Error('zaman aşımı')));
    req.on('error', reject);
  });
}

const pending = new Map(); // aynı kitap için eşzamanlı indirmeleri birleştir
async function gutenberg(id) {
  const file = path.join(CACHE_DIR, 'pg' + id + '.txt');
  try { return await fs.promises.readFile(file); } catch (_) {}
  if (pending.has(id)) return pending.get(id);
  const job = (async () => {
    const urls = ['https://www.gutenberg.org/cache/epub/' + id + '/pg' + id + '.txt', 'https://www.gutenberg.org/files/' + id + '/' + id + '-0.txt',
      // gutenberg.org bakımdayken Project Gutenberg'in kendi PGLAF yansısı
      'https://aleph.pglaf.org/cache/epub/' + id + '/pg' + id + '.txt'];
    let last;
    for (const url of urls) {
      try {
        const buf = await get(url);
        if (buf.length < 200) throw new Error('boş içerik');
        await fs.promises.mkdir(CACHE_DIR, {recursive: true});
        await fs.promises.writeFile(file, buf);
        return buf;
      } catch (e) { last = e; }
    }
    throw last;
  })();
  pending.set(id, job);
  try { return await job; } finally { pending.delete(id); }
}

/* ---------- Vikikaynak (tr.wikisource.org): kamu malı Türkçe eserler → düz paragraflar ---------- */
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”'};
const decodeEnt = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m));
// Ayrıştırılmış HTML'den yalnızca metin paragrafları: başlık/gezinti şablonları (tablo, noprint, header), dipnotlar ve
// kaynakça atılır; <br> satır sonu olarak korunur (şiir/diyalog), çok kısa gezinti satırları elenir.
function vkParagraphs(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, '');
  for (let k = 0; k < 6; k++) s = s.replace(/<table(?:(?!<table)[\s\S])*?<\/table>/gi, '');     // iç içe tablolar dıştan içe
  s = s.replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<ol class="references[\s\S]*?<\/ol>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:noprint|ws-noexport|ws-header|header|navbox|mw-references)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  const out = [];
  for (const m of s.matchAll(/<(p|dd|div class="poem")[^>]*>([\s\S]*?)<\/(?:p|dd|div)>/gi)) {
    const t = decodeEnt(m[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n')
      .split('\n').filter(l => !/^\s*(Sayfa başı|Kaynakça:.*|Kaynak:.*)\s*$/i.test(l)).join('\n').trim();
    if (t.length < 2 || /^(←|→|Kaynak|Bu eser|Bu metin)/.test(t) || /kamu malıdır\.?$|telif (hakkı|anlaşma)/i.test(t) || /^[.\s…]+$/.test(t)) continue;
    out.push(t);
  }
  return out;
}
const vkPending = new Map(), sleep = ms => new Promise(r => setTimeout(r, ms));
async function vkParse(page) {
  const url = 'https://tr.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=text%7Clinks&disableeditsection=1&disabletoc=1&redirects=1&maxlag=5&page=' + encodeURIComponent(page);
  let buf;
  for (let k = 0; ; k++) {   // Wikimedia hız sınırı (429): artan beklemeyle 3 kez daha dene
    try { buf = await get(url); break; } catch (e) { if (k >= 3 || !/HTTP (429|503)/.test(e.message)) throw e; await sleep(3000 * (k + 1) ** 2); }
  }
  const j = JSON.parse(buf.toString('utf8'));
  if (j.error) throw new Error(j.error.info || j.error.code);
  return {title: j.parse.title, html: j.parse.text, links: (j.parse.links || []).filter(l => l.ns === 0 && l.exists).map(l => l.title)};
}
async function vikikaynak(page) {
  const safe = page.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 80);
  const file = path.join(CACHE_DIR, 'vk-' + safe + '.txt');
  try { return await fs.promises.readFile(file); } catch (_) {}
  if (vkPending.has(page)) return vkPending.get(page);
  const job = (async () => {
    const top = await vkParse(page);
    let paras = vkParagraphs(top.html);
    // Bölümlere ayrılmış eser: ana sayfa kısaysa "<Eser>/<alt sayfa>" bağlantılarını sırayla izle
    const subs = top.links.filter(t => t.startsWith(top.title + '/'));
    if (subs.length && paras.join('').length < 4000) {
      const order = [...top.html.matchAll(/href="\/wiki\/([^"#?]+)"/g)].map(m => { try { return decodeURIComponent(m[1]).replace(/_/g, ' '); } catch (_) { return ''; } });
      const seq = [...new Set(order.filter(t => subs.includes(t)))].slice(0, 80);
      paras = [];
      for (const t of seq) { await sleep(250); const sp = await vkParse(t); paras.push(t.slice(top.title.length + 1)); paras.push(...vkParagraphs(sp.html)); }
    }
    const body = paras.join('\n\n');
    if (body.length < 800) throw new Error('metin bulunamadı');
    const buf = Buffer.from(body, 'utf8');
    await fs.promises.mkdir(CACHE_DIR, {recursive: true});
    await fs.promises.writeFile(file, buf);
    return buf;
  })();
  vkPending.set(page, job);
  try { return await job; } finally { vkPending.delete(page); }
}

/* ---------- Birlikte okuma odaları: yalnızca bellekte, yerel ağ ---------- */
const ROOM_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // karışan harf/rakam yok (I, L, O, 0, 1)
const ROOM_IDLE_MS = Number(process.env.ROOM_IDLE_MS) || 2 * 3600 * 1000, ROOM_MAX_PEERS = 8, ROOM_MAX = 500, ROOM_BODY_MAX = 2048;
const rooms = new Map();   // kod → {peers: Set<{res, id}>, last, state}
const json = (res, code, obj) => { res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(obj)); };
const sse = (res, obj) => { try { res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch (_) {} };
function newCode() { for (;;) { let c = ''; for (let i = 0; i < 6; i++) c += ROOM_ALPHA[require('crypto').randomInt(ROOM_ALPHA.length)]; if (!rooms.has(c)) return c; } }
function peersMsg(room) { const m = {type: 'peers', n: room.peers.size}; for (const p of room.peers) sse(p.res, m); }
function closeRoom(code) { const r = rooms.get(code); if (!r) return; rooms.delete(code); for (const p of r.peers) { sse(p.res, {type: 'closed'}); p.res.end(); } }
setInterval(() => { const now = Date.now(); for (const [c, r] of rooms) if (now - r.last > ROOM_IDLE_MS) closeRoom(c); }, Math.min(60000, Math.max(100, ROOM_IDLE_MS / 4))).unref();
setInterval(() => { for (const r of rooms.values()) for (const p of r.peers) { try { p.res.write(': ping\n\n'); } catch (_) {} } }, 25000).unref();
function validState(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const okStr = (v, max) => typeof v === 'string' && v.length <= max;
  if (!(okStr(o.bookId, 200) && o.bookId) && !(typeof o.bookId === 'number' && Number.isFinite(o.bookId))) return null;
  if (!Number.isInteger(o.para) || o.para < 0 || o.para > 1e7) return null;
  if (!(o.vid === undefined || o.vid === null || (okStr(o.vid, 64) && /^[\w-]*$/.test(o.vid)))) return null;
  if (!(okStr(o.from, 64) && o.from)) return null;
  return {bookId: o.bookId, para: o.para, vid: o.vid == null ? null : o.vid, from: o.from};
}
function roomApi(req, res, p, qs) {
  if (p === '/api/room' && req.method === 'GET') return json(res, 200, {ok: true, maxPeers: ROOM_MAX_PEERS});
  if (p === '/api/room' && req.method === 'POST') {
    req.resume();
    if (rooms.size >= ROOM_MAX) return json(res, 503, {error: 'Şu an çok fazla oda var, biraz sonra deneyin.'});
    const code = newCode(); rooms.set(code, {peers: new Set(), last: Date.now(), state: null});
    return json(res, 200, {code});
  }
  const m = /^\/api\/room\/([A-Za-z0-9]{6})(\/events|\/state)?$/.exec(p);
  if (!m) return json(res, 404, {error: 'Bulunamadı.'});
  const code = m[1].toUpperCase(), room = rooms.get(code);
  if (!room) { req.resume(); return json(res, 404, {error: 'Oda bulunamadı ya da süresi doldu.'}); }
  if (!m[2] && req.method === 'GET') return json(res, 200, {code, n: room.peers.size, max: ROOM_MAX_PEERS});
  if (m[2] === '/events' && req.method === 'GET') {
    if (room.peers.size >= ROOM_MAX_PEERS) return json(res, 409, {error: 'Oda dolu (en çok ' + ROOM_MAX_PEERS + ' kişi).'});
    const id = String(new URLSearchParams(qs).get('id') || '').slice(0, 64);
    res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'});
    res.write('retry: 3000\n\n');
    const peer = {res, id}; room.peers.add(peer); room.last = Date.now();
    peersMsg(room);
    if (room.state && room.state.from !== id) sse(res, Object.assign({type: 'state'}, room.state));
    req.on('close', () => { if (room.peers.delete(peer)) { room.last = Date.now(); peersMsg(room); } });
    return;
  }
  if (m[2] === '/state' && req.method === 'POST') {
    let size = 0, chunks = [], over = false;
    const tooBig = () => { res.setHeader('Connection', 'close'); json(res, 413, {error: 'İstek çok büyük (en çok 2 KB).'}); };
    if (Number(req.headers['content-length']) > ROOM_BODY_MAX) { req.resume(); return tooBig(); }
    req.on('data', c => { size += c.length; if (size > ROOM_BODY_MAX) over = true; else chunks.push(c); });
    req.on('end', () => {
      if (over) return tooBig();
      let o; try { o = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return json(res, 400, {error: 'Geçersiz JSON.'}); }
      const s = validState(o); if (!s) return json(res, 400, {error: 'Geçersiz durum alanları.'});
      room.state = s; room.last = Date.now();
      const msg = Object.assign({type: 'state'}, s); let sent = 0;
      for (const peer of room.peers) if (peer.id !== s.from) { sse(peer.res, msg); sent++; }
      json(res, 200, {ok: true, sent});
    });
    return;
  }
  req.resume(); return json(res, 405, {error: 'Yöntem desteklenmiyor.'});
}

http.createServer((req, res) => {
  const [rawPath, qs = ''] = req.url.split('?');
  let p;
  try { p = decodeURIComponent(rawPath); } catch (_) { res.writeHead(400); return res.end(); }

  if (p === '/api/room' || p.startsWith('/api/room/')) return roomApi(req, res, p, qs);

  if (p === '/api/gutenberg') {
    const id = new URLSearchParams(qs).get('id') || '';
    if (!/^\d{1,6}$/.test(id)) { res.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'}); return res.end('Geçersiz kitap numarası.'); }
    return gutenberg(id).then(buf => {
      res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'max-age=86400'});
      res.end(buf);
    }, err => {
      res.writeHead(502, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('Gutenberg\'den alınamadı: ' + err.message);
    });
  }

  if (p === '/api/vikikaynak') {
    const page = (new URLSearchParams(qs).get('page') || '').trim();
    if (!page || page.length > 120 || /[#<>\[\]{}|]/.test(page) || /^[^:]+:/.test(page)) { res.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'}); return res.end('Geçersiz sayfa adı.'); }
    return vikikaynak(page).then(buf => {
      res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'max-age=86400'});
      res.end(buf);
    }, err => {
      res.writeHead(502, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('Vikikaynak\'tan alınamadı: ' + err.message);
    });
  }

  const legacy = p === '/legacy' || p === '/legacy/';
  if (p === '/') p = '/index.html';
  if (legacy) p = '/satir-arasi.html';
  const f = path.join(__dirname, path.normalize(p));
  if (!f.startsWith(__dirname + path.sep) || f.startsWith(CACHE_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); return res.end('Bulunamadı'); }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    if (p === '/satir-arasi.html') res.end(SKELETON + data.toString('utf8') + '</body></html>'); else res.end(data);
  });
}).listen(PORT, process.env.HOST || '127.0.0.1', () => console.log('http://localhost:' + PORT));   // yerel ağ için: HOST=0.0.0.0
