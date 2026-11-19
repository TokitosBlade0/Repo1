/* Satır Arası — birlikte okuma odası istemcisi (server.js /api/room).
   window.SA_Room = { available, ready, create()→Promise<kod>, join(kod, onEvent)→Promise, send(durum), leave() }
   onEvent şu olayları alır: {type:'peers', n}, {type:'state', bookId, para, vid, from}, {type:'error', message}, {type:'closed'}. */
(function (root) {
'use strict';
const API = '/api/room', THROTTLE_MS = 500, CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;
const ERR = {
  off: 'Birlikte okuma için yerel sunucu gerekli (node server.js).',
  net: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.',
  code: 'Oda kodu geçersiz: 6 harf/rakam olmalı.',
  missing: 'Oda bulunamadı ya da süresi doldu.',
  full: 'Oda dolu (en çok 8 kişi).',
  lost: 'Oda bağlantısı koptu, yeniden deneniyor…',
  gone: 'Oda kapandı.'
};
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const id = rid();
let es = null, code = null, handler = null, retry = 0, retryTimer = null, lastSend = 0, pendingState = null, sendTimer = null;

const R = {
  available: false, id,
  get code() { return code; },
  ready: null,
  async create() {
    if (!(await R.ready)) throw new Error(ERR.off);
    let r; try { r = await fetch(API, {method: 'POST'}); } catch (_) { throw new Error(ERR.net); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.code) throw new Error(j.error || ERR.net);
    return j.code;
  },
  async join(c, onEvent) {
    if (!(await R.ready)) throw new Error(ERR.off);
    c = String(c || '').trim().toUpperCase();
    if (!CODE_RE.test(c)) throw new Error(ERR.code);
    R.leave();
    await check(c);
    code = c; handler = typeof onEvent === 'function' ? onEvent : () => {}; retry = 0;
    return new Promise((resolve, reject) => open(resolve, reject));
  },
  send(state) {
    if (!code || !state) return;
    pendingState = state;
    const wait = lastSend + THROTTLE_MS - Date.now();
    if (wait <= 0) flush(); else if (!sendTimer) sendTimer = setTimeout(flush, wait);
  },
  leave() {
    if (es) { es.onopen = es.onmessage = es.onerror = null; es.close(); }
    es = null; code = null; handler = null; pendingState = null;
    clearTimeout(retryTimer); clearTimeout(sendTimer); retryTimer = sendTimer = null;
  }
};

async function check(c) {
  let r; try { r = await fetch(API + '/' + c, {cache: 'no-store'}); } catch (_) { throw new Error(ERR.net); }
  if (r.status === 404) throw new Error(ERR.missing);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ERR.net);
  if (j.n >= (j.max || 8)) throw new Error(ERR.full);
}
function emit(e) { try { if (handler) handler(e); } catch (err) { if (root.console) console.error(err); } }
function open(resolve, reject) {
  const c = code, src = new EventSource(API + '/' + c + '/events?id=' + encodeURIComponent(id));
  es = src; let opened = false;
  src.onopen = () => { opened = true; retry = 0; if (resolve) { resolve(); resolve = reject = null; } };
  src.onmessage = (m) => {
    let e; try { e = JSON.parse(m.data); } catch (_) { return; }
    if (!e || typeof e.type !== 'string') return;
    if (e.type === 'closed') { emit({type: 'closed'}); emit({type: 'error', message: ERR.gone}); R.leave(); return; }
    if (e.type === 'state' && e.from === id) return;
    emit(e);
  };
  src.onerror = () => {
    if (es !== src) return;
    if (src.readyState !== 2) { if (opened) emit({type: 'error', message: ERR.lost}); return; }   // tarayıcı kendisi yeniden bağlanıyor
    src.onopen = src.onmessage = src.onerror = null; es = null;                                  // kapandı: elle yeniden bağlan
    if (opened) emit({type: 'error', message: ERR.lost});
    reconnect(c, resolve, reject);
  };
}
function reconnect(c, resolve, reject) {      // üstel geri çekilme; oda yoksa/doluysa vazgeç
  const fail = (msg) => {
    if (reject) { reject(new Error(msg)); R.leave(); return; }
    emit({type: 'error', message: msg}); emit({type: 'closed'}); R.leave();
  };
  if (retry >= (reject ? 2 : 8)) return fail(ERR.net);           // ilk katılımda uzun bekletme
  const delay = Math.min(30000, 1000 * Math.pow(2, retry++));
  retryTimer = setTimeout(() => {
    if (code !== c) return;
    check(c).then(() => { if (code === c) open(resolve, reject); },
      (err) => { if (code !== c) return; if (err.message === ERR.net) reconnect(c, resolve, reject); else fail(err.message); });
  }, delay);
}
function flush() {
  clearTimeout(sendTimer); sendTimer = null;
  if (!code || !pendingState) return;
  const s = pendingState; pendingState = null; lastSend = Date.now();
  const body = {bookId: s.bookId, para: s.para, vid: s.vid == null ? null : s.vid, from: id};
  fetch(API + '/' + code + '/state', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).catch(() => {});
}

R.ready = (typeof fetch === 'function' && typeof root.EventSource === 'function' && root.location && /^https?:$/.test(root.location.protocol)
  ? fetch(API, {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(j => !!(j && j.ok), () => false)
  : Promise.resolve(false)).then(ok => (R.available = ok));
root.SA_Room = R;
if (typeof module === 'object' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
