/* Satır Arası — hizmet çalışanı (çevrimdışı okuma).
   Uygulama kabuğu: ağ öncelikli (çevrimiçiyken hep güncel kod), ağ yoksa önbellek.
   Kapaklar, görseller, hazır analizler ve yazı tipleri: önbellek öncelikli.
   /api/*: ağ öncelikli; yalnızca GET yanıtları önbelleğe yedeklenir (açılmış kitapların metni zaten IndexedDB'de). */
'use strict';
const V = 'sa-v4', SHELL = 'sa-shell-' + V, RUN = 'sa-run-' + V, API = 'sa-api-' + V;
const SHELL_FILES = ['./', 'index.html', 'styles.css', 'core.js', 'books.js', 'keywords.js', 'gemini.js', 'music.js', 'covers.js', 'engine.js', 'claude-handoff.js', 'room.js', 'ui.js',
  'manifest.webmanifest', 'assets/icon.svg', 'assets/emblem.jpg', 'assets/bg-library.jpg', 'assets/paper.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_FILES.map(f => c.add(new Request(f, {cache: 'reload'})).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sa-') && ![SHELL, RUN, API].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (name, req, res) => { if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(name).then(ca => ca.put(req, c)).catch(() => {}); } return res; };
async function networkFirst(req, name) {
  try { return put(name, req, await fetch(req)); }
  catch (err) { const hit = await caches.match(req, {ignoreSearch: name === SHELL}); if (hit) return hit; if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; } throw err; }
}
async function cacheFirst(req, name) {
  const hit = await caches.match(req); if (hit) return hit;
  return put(name, req, await fetch(req));
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                                   // POST (oda, analiz) doğrudan ağa
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) {
      if (/\/events$/.test(url.pathname) || url.pathname.startsWith('/api/room')) return;   // SSE/oda: önbelleğe alma
      e.respondWith(networkFirst(req, API)); return;
    }
    if (/^\/(assets|img|ink)\//.test(url.pathname) || /\.(jpg|jpeg|png|webp|svg)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req, RUN)); return; }
    e.respondWith(networkFirst(req, SHELL)); return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname)) e.respondWith(cacheFirst(req, RUN));
});
