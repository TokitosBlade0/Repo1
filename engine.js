/* Satır Arası — müzik motoru.
   Sequencer: saf, ses saatine göre olay üretir (Node'da test edilir).
   create(ctx): olayları sabit bir Web Audio düğüm grafiğine uygular. Hiç ses dosyası yok. */
(function (root, factory) {
  const E = factory();
  if (typeof module === 'object' && module.exports) module.exports = E; else root.Engine = E;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* Sekiz duygu = tek tonik üzerinde sekiz mod. Akorlar tonikten yarım ses uzaklıkları. */
const RECIPES = [
  {id: 'huzur',    chords: [[0, 7, 14, 16], [5, 12, 16, 21], [-3, 7, 12, 16]],                 scale: [0, 2, 4, 7, 9],         wave: 'soft', cutoff: 900,  det: 5,  dur: 14, lead: 'bell',  every: 6,   dir: 0,  pulse: 0,  trim: 1},
  {id: 'huzun',    chords: [[0, 7, 14, 15], [-4, 3, 7, 12], [-7, 0, 5, 8], [-5, 2, 7, 10]],    scale: [0, 2, 3, 5, 7, 8, 10],  wave: 'warm', cutoff: 620,  det: 7,  dur: 17, lead: 'bow',   every: 8,   dir: -1, pulse: 0,  trim: 1},
  {id: 'gerilim',  chords: [[0, 7, 13, 15], [0, 6, 12, 15], [-2, 5, 10, 13]],                  scale: [0, 1, 3, 7, 8],         wave: 'rich', cutoff: 460,  det: 12, dur: 10, lead: null,    every: 0,   dir: 0,  pulse: 66, trim: 1},
  {id: 'karanlik', chords: [[-12, 7, 13, 18], [-12, 6, 11, 15], [-13, 6, 11, 14]],             scale: [0, 1, 6, 7, 10],        wave: 'rich', cutoff: 380,  det: 16, dur: 20, lead: 'glass', every: 15,  dir: 0,  pulse: 0,  trim: 1},
  {id: 'nese',     chords: [[0, 7, 12, 16], [5, 12, 19, 21], [-5, 7, 12, 14], [-3, 4, 7, 12]], scale: [0, 2, 4, 7, 9, 11],     wave: 'soft', cutoff: 1500, det: 5,  dur: 8,  lead: 'pluck', every: 2.6, dir: 0,  pulse: 0,  trim: 1, arp: true},
  {id: 'ask',      chords: [[0, 4, 11, 14], [-7, 4, 9, 12], [2, 9, 12, 17], [-5, 5, 9, 12]],   scale: [0, 2, 4, 7, 9, 11],     wave: 'warm', cutoff: 1000, det: 7,  dur: 13, lead: 'bow',   every: 3.8, dir: 1,  pulse: 0,  trim: 1},
  {id: 'macera',   chords: [[0, 7, 10, 17], [-2, 5, 10, 12], [-7, 0, 5, 9]],                   scale: [0, 2, 3, 5, 7, 9, 10],  wave: 'rich', cutoff: 1200, det: 7,  dur: 10, lead: 'pluck', every: 3.2, dir: 0,  pulse: 48, trim: 1},
  {id: 'gizem',    chords: [[0, 4, 8, 14], [-2, 4, 8, 14], [0, 7, 11, 15]],                    scale: [0, 2, 4, 6, 8, 10],     wave: 'soft', cutoff: 750,  det: 9,  dur: 15, lead: 'glass', every: 6,   dir: 0,  pulse: 0,  trim: 1}
];
/* Çevrimdışı ölçümle ayarlanan ses yüksekliği düzeltmeleri (hedef: duygular arası fark ≤ 3 dB). */
const TRIM = [0.92, 1.48, 1.46, 1.9, 0.98, 1.5, 1.53, 0.89];

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

class Sequencer {
  constructor(seed) {
    this.rng = mulberry32(seed || 1);
    this.state = {mood: 0, neutral: false, intensity: 0.5, confidence: 0.5, idle: false, browsing: false, mic: false};
    this.reset(0);
  }
  reset(now) { this.engMood = -1; this.chordIx = 0; this.nextChord = now; this.nextLead = now + 2.5; this.nextPulse = now + 1; this.lastSwitch = -99; this.step = 3; this.arp = 0; this.bell = false; }
  set(st, now) {
    Object.assign(this.state, st);
    if (!this.state.browsing && this.engMood >= 0 && this.state.mood !== this.engMood) {
      const at = Math.max(now + 0.05, this.lastSwitch + 5);        // geçişler arası en az 5 sn
      if (at < this.nextChord) this.nextChord = at;
    }
  }
  chapter(now) { this.bell = true; this.chordIx = 0; }
  /* [from, to) aralığındaki olayları üretir; hiçbir olay from'dan önce olmaz. */
  advance(from, to) {
    const ev = [], s = this.state, r = this.rng;
    if (this.bell && this.engMood >= 0) { this.bell = false; ev.push({t: from, kind: 'note', inst: 'bell', semi: 12, vel: 0.9}); }
    for (let guard = 0; guard < 400; guard++) {
      const tc = this.nextChord, tl = this.nextLead, tp = this.nextPulse, first = Math.min(tc, tl, tp);
      if (first >= to) break;
      const t = Math.max(first, from);
      if (first === tc) {
        const want = (s.browsing && this.engMood >= 0) ? this.engMood : s.mood;
        const changed = want !== this.engMood;
        if (changed) { this.chordIx = 0; this.lastSwitch = t; this.engMood = want; }
        const R = RECIPES[want], chord = R.chords[this.chordIx % R.chords.length];
        this.chordIx++;
        const fade = changed ? Math.max(4, Math.min(8, 8 - 5 * s.confidence)) : 5;
        ev.push({t, kind: 'chord', mood: want, changed, chord, fade, dur: R.dur, intensity: s.intensity});
        this.nextChord = t + R.dur * (0.9 + 0.2 * r());
      } else if (first === tl) {
        const R = RECIPES[Math.max(0, this.engMood)];
        const quiet = this.engMood < 0 || s.neutral || s.idle || s.mic || !R.lead;
        if (quiet) { this.nextLead = t + 1; continue; }
        const L = R.scale.length, span = L * 2 - 1;
        const vel = 0.55 + 0.45 * s.intensity;
        if (R.arp) {                                    // neşe: akor seslerinden üçlü arpej
          const ch = R.chords[(this.chordIx + R.chords.length - 1) % R.chords.length], up = r() < 0.6;
          for (let k = 0; k < 3; k++) ev.push({t: t + k * 0.357, kind: 'note', inst: R.lead, semi: ch[up ? k + 1 : 3 - k] + 12, vel: vel * (1 - k * 0.12)});
        } else {
          const d = r() < 0.7 ? (r() < 0.5 + 0.3 * R.dir ? 1 : -1) : (r() < 0.5 ? 2 : -2);
          this.step = Math.max(0, Math.min(span, this.step + d));
          const semi = R.scale[this.step % L] + 12 * Math.floor(this.step / L) + (R.lead === 'bow' ? 12 : 24);
          ev.push({t, kind: 'note', inst: R.lead, semi, vel});
        }
        const density = (0.6 + 0.8 * s.intensity) * (s.confidence < 0.3 ? 0.6 : 1);
        this.nextLead = t + R.every / density * (0.7 + 0.6 * r());
      } else {
        const R = RECIPES[Math.max(0, this.engMood)];
        if (this.engMood >= 0 && R.pulse && s.intensity > 0.35 && !s.neutral && !s.idle) {
          ev.push({t, kind: 'pulse', mood: this.engMood, vel: 0.5 + 0.5 * s.intensity});
          if (R.id === 'gerilim') ev.push({t: t + 0.27, kind: 'pulse', mood: this.engMood, vel: 0.3 + 0.3 * s.intensity});
          this.nextPulse = t + 60 / R.pulse;
        } else this.nextPulse = t + 1;
      }
    }
    return ev;
  }
}

/* ---------- Sıralayıcı testleri (Node ve tarayıcı) ---------- */
function selfTest() {
  const out = [], T = (name, fn) => { try { const r = fn(); out.push({name, ok: r === true, detail: r === true ? '' : String(r)}); } catch (e) { out.push({name, ok: false, detail: 'hata: ' + e.message}); } };
  const run = (seed, script, step) => { const q = new Sequencer(seed), all = []; let bad = 0;
    for (let t = 0; t < 120; t += step) { if (script) script(q, t); for (const e of q.advance(t, t + step)) { if (e.t < t - 1e-9) bad++; all.push(e); } }
    return {all, bad}; };
  T('sıralayıcı: aynı tohum aynı müziği üretir', () => JSON.stringify(run(7, null, 0.15).all) === JSON.stringify(run(7, null, 0.15).all) || 'farklı');
  T('sıralayıcı: 1 sn aralıkla çalışsa da geçmişe olay yazmaz', () => { const r = run(3, (q, t) => { if (Math.abs(t - 30) < 0.5) q.set({mood: 4, intensity: 0.8}, t); }, 1); return r.bad === 0 || r.bad + ' geç olay'; });
  T('sıralayıcı: duygu değişimi 5,2 sn içinde başlar', () => {
    const q = new Sequencer(1); q.advance(0, 20); q.set({mood: 5}, 20);
    const e = q.advance(20, 40).find(x => x.kind === 'chord' && x.changed);
    return (e && e.t - 20 <= 5.2 && e.mood === 5) || (e ? 'gecikme ' + (e.t - 20).toFixed(2) : 'geçiş yok');
  });
  T('sıralayıcı: hızlı değişimlerde geçişler arası en az 5 sn', () => {
    const r = run(5, (q, t) => q.set({mood: Math.floor(t * 2) % 8}, t), 0.25), c = r.all.filter(e => e.kind === 'chord' && e.changed);
    let min = 99; for (let i = 1; i < c.length; i++) min = Math.min(min, c[i].t - c[i - 1].t);
    return min >= 4.99 || 'en kısa aralık ' + min.toFixed(2);
  });
  T('sıralayıcı: nötr ve dalgın durumda yalnızca ped', () => {
    for (const st of [{neutral: true}, {idle: true}]) { const r = run(2, (q, t) => { if (t === 0) q.set(Object.assign({mood: 4, intensity: 0.9}, st), 0); }, 0.15); if (r.all.some(e => e.kind !== 'chord')) return JSON.stringify(st) + ' sırasında nota var'; }
    return true;
  });
  T('sıralayıcı: hızlı kaydırmada duygu donar', () => {
    const q = new Sequencer(1); q.advance(0, 10); q.set({mood: 6, browsing: true}, 10);
    return !q.advance(10, 60).some(e => e.kind === 'chord' && e.mood === 6) || 'donmadı';
  });
  T('sıralayıcı: mikrofon açıkken ezgi susar', () => { const r = run(2, (q, t) => { if (t === 0) q.set({mood: 4, mic: true}, 0); }, 0.15); return !r.all.some(e => e.kind === 'note') || 'nota var'; });
  T('sıralayıcı: nota yoğunluğu her duyguda makul', () => {
    for (let m = 0; m < 8; m++) { const r = run(9, (q, t) => { if (t === 0) q.set({mood: m, intensity: 0.6, confidence: 0.7}, 0); }, 0.15);
      const n = r.all.filter(e => e.kind === 'note').length / 2;          // dakikadaki nota
      if (n > 80) return RECIPES[m].id + ': dakikada ' + n + ' nota'; if (RECIPES[m].lead && n < 2) return RECIPES[m].id + ': çok seyrek (' + n + ')'; }
    return true;
  });
  T('sıralayıcı: bölüm başında tonikte çan', () => { const q = new Sequencer(1); q.advance(0, 5); q.chapter(5); const e = q.advance(5, 5.2)[0]; return (e && e.inst === 'bell' && e.semi === 12) || 'çan yok'; });
  return out;
}

/* ---------- Ses grafiği ---------- */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const WAVES = {soft: [1, 0.22, 0.09, 0.03], warm: [1, 0.5, 0.3, 0.18, 0.1, 0.05], rich: [1, 0.55, 0.38, 0.28, 0.21, 0.16, 0.12, 0.09, 0.07, 0.05]};
const PAD_LEVEL = {soft: 0.085, warm: 0.062, rich: 0.05};

function makeIR(ctx, rng, secs) {            // tasarlanmış oda: 20 ms ön gecikme, tizler daha hızlı söner
  const sr = ctx.sampleRate, len = Math.floor(sr * secs), pre = Math.floor(sr * 0.02), buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let y = 0;
    for (let i = pre; i < len; i++) { const t = (i - pre) / sr, a = 0.85 * Math.exp(-t * 2.2) + 0.06; y += a * ((rng() * 2 - 1) - y); d[i] = y * Math.exp(-t * 6.9 / secs); } }
  return buf;
}
function seam(d, n) { const L = d.length; for (let i = 0; i < n; i++) { const k = i / n; d[L - n + i] = d[L - n + i] * (1 - k) + d[i] * k; } }
function makeAmb(ctx, id, rng) {
  const sr = ctx.sampleRate, secs = id === 'rain' ? 10 : id === 'wind' ? 11 : 9, len = Math.floor(sr * secs), buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let b = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = rng() * 2 - 1, t = i / sr;
      if (id === 'rain') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
      else { b = 0.992 * b + w * 0.06;
        if (id === 'wind') d[i] = b * (0.55 + 0.3 * Math.sin(2 * Math.PI * t / secs + c) + 0.15 * Math.sin(2 * Math.PI * 3 * t / secs));
        else { const ph = t / secs, env = ph < 0.33 ? Math.pow(Math.sin(ph / 0.33 * Math.PI / 2), 2) : Math.pow(Math.cos((ph - 0.33) / 0.67 * Math.PI / 2), 2); d[i] = b * (0.25 + 0.75 * env) + w * 0.035 * env * env; } }
    }
    if (id === 'rain') for (let k = 0; k < secs * 14; k++) {          // tek tek damlalar
      const at = Math.floor(rng() * (len - 600)), f = 2000 + rng() * 4000, amp = 0.05 + rng() * 0.12;
      for (let i = 0; i < 500; i++) d[at + i] += amp * Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (sr * 0.004));
    }
    seam(d, Math.floor(sr * 0.25));
  }
  return buf;
}
const AMB_CFG = {rain: {f: [['highpass', 1500], ['lowpass', 8000]], lvl: 0.5}, wind: {f: [['bandpass', 520, 0.8]], lvl: 2.2}, sea: {f: [['lowpass', 900]], lvl: 1.5}};

/* ---------- Sahne sesleri: müziğin altında sessiz bir katman (en çok ~-30 dBFS) ---------- */
const SCENE_PEAK = 0.0316;                       // -30 dBFS tepe
const SCENE_LVL = {rain: 0.55, wind: 1, sea: 0.9, fire: 0.9, hooves: 0.85, crowd: 0.7};
const SCENE_FADE = 2;
function normalize(buf, peak) {
  let m = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > m) m = a; } }
  if (m > 0) { const k = (peak || 1) / m; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
  return buf;
}
function renderScene(ctx, id, rng) {
  if (AMB_CFG[id]) return normalize(makeAmb(ctx, id, rng));
  const sr = ctx.sampleRate, TAU = 2 * Math.PI;
  if (id === 'fire') {                           // alçak uğultu + rastgele çıtırtılar
    const secs = 9, len = Math.floor(sr * secs), buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let b = 0, lp = 0, m = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; b = 0.996 * b + (rng() * 2 - 1) * 0.04; lp += 0.05 * (b - lp);
        d[i] = lp * (0.75 + 0.25 * Math.sin(TAU * 2 * t / secs + c * 1.7)); m = Math.max(m, Math.abs(d[i])); }
      if (m > 0) for (let i = 0; i < len; i++) d[i] *= 0.3 / m;
      seam(d, Math.floor(sr * 0.25));
      const n = Math.floor(secs * 7), span = Math.floor(sr * 0.03);
      for (let k = 0; k < n; k++) {
        let at = Math.floor(rng() * len); const burst = rng() < 0.3 ? 2 + Math.floor(rng() * 3) : 1;
        for (let j = 0; j < burst; j++) {
          const amp = 0.15 + 0.55 * rng() * rng(), dec = sr * (0.0006 + rng() * 0.0025); let prev = 0;
          for (let i = 0; i < span; i++) { const w = rng() * 2 - 1; d[(at + i) % len] += amp * (w - prev) * 0.5 * Math.exp(-i / dec); prev = w; }
          at += Math.floor(sr * (0.01 + rng() * 0.05));
        }
      }
    }
    return normalize(buf);
  }
  if (id === 'hooves') {                         // ~2,2 Hz süzülmüş toynak vuruşları, hafif swing
    const beat = 1 / 2.2, nb = 16, len = Math.round(sr * beat * nb), buf = ctx.createBuffer(2, len, sr), dl = buf.getChannelData(0), dr = buf.getChannelData(1);
    const span = Math.floor(sr * 0.2);
    for (let k = 0; k < nb; k++) {
      const t0 = k * beat + (k % 2 ? 0.035 : 0) + (rng() - 0.5) * 0.008, at = Math.floor(t0 * sr);
      const amp = (k % 2 ? 0.72 : 1) * (0.85 + 0.15 * rng()), f0 = 90 + rng() * 30, p = 0.5 + (rng() - 0.5) * 0.3;
      let ph = 0, nz = 0;
      for (let i = 0; i < span; i++) { const t = i / sr; ph += TAU * f0 * (1 + 1.2 * Math.exp(-t / 0.012)) / sr; nz += 0.12 * ((rng() * 2 - 1) - nz);
        const s = amp * (Math.sin(ph) * Math.exp(-t / 0.04) + 0.8 * nz * Math.exp(-t / 0.01)), j = (at + i) % len;
        dl[j] += s * (1 - p) * 2; dr[j] += s * p * 2; }
    }
    for (const d of [dl, dr]) { let lp = 0; for (let i = 0; i < len; i++) { lp += 0.35 * (d[i] - lp); d[i] = lp + (rng() * 2 - 1) * 0.004; } }
    return normalize(buf);
  }
  if (id === 'crowd') {                          // birkaç modüle gürültü formantından bant geçiren uğultu
    const secs = 10, len = Math.floor(sr * secs), buf = ctx.createBuffer(2, len, sr), dl = buf.getChannelData(0), dr = buf.getChannelData(1);
    for (let v = 0; v < 7; v++) {
      const f0 = 350 + rng() * 2000, fm = (1 + Math.floor(rng() * 3)) / secs, syl = 3 + rng() * 3, slow = (1 + Math.floor(rng() * 3)) / secs;
      const p1 = rng() * TAU, p2 = rng() * TAU, p3 = rng() * TAU, pan = 0.2 + 0.6 * rng(), Q = 3 + rng() * 3;
      let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        if (i % 32 === 0) { const f = Math.min(sr * 0.45, f0 * (1 + 0.25 * Math.sin(TAU * fm * t + p1))), w0 = TAU * f / sr, al = Math.sin(w0) / (2 * Q), a0 = 1 + al;
          b0 = al / a0; b1 = 0; b2 = -al / a0; a1 = -2 * Math.cos(w0) / a0; a2 = (1 - al) / a0; }
        const x = rng() * 2 - 1, y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y;
        const s = Math.sin(TAU * syl * t + p2), env = s > 0 ? s * s : 0, s2 = y * env * (0.55 + 0.45 * Math.sin(TAU * slow * t + p3));
        dl[i] += s2 * (1 - pan); dr[i] += s2 * pan;
      }
    }
    for (const d of [dl, dr]) { let lp = 0, hp = 0; for (let i = 0; i < len; i++) { hp += 0.03 * (d[i] - hp); lp += 0.5 * ((d[i] - hp) - lp); d[i] = lp; } seam(d, Math.floor(sr * 0.25)); }
    return normalize(buf);
  }
  return null;
}
const sceneCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function sceneBuffer(ctx, id, rng) {                // döngü yalnızca ilk gerektiğinde üretilir, bağlam başına bir kez
  let m = sceneCache && sceneCache.get(ctx); if (!m) { m = {}; if (sceneCache) sceneCache.set(ctx, m); }
  return m[id] || (m[id] = renderScene(ctx, id, rng));
}
function sceneLayer(ctx, out, rng) {
  let cur = null, curId = null, live = 0;
  return {
    get id() { return curId; }, get live() { return live; },
    set(id) {
      id = SCENE_LVL[id] ? id : null; if (id === curId) return;
      const t = ctx.currentTime;
      if (cur) { const g = cur.g.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + SCENE_FADE); cur.src.stop(t + SCENE_FADE + 0.05); }
      cur = null; curId = id;
      if (!id) return;
      const buf = sceneBuffer(ctx, id, rng), src = ctx.createBufferSource(), list = [src]; src.buffer = buf; src.loop = true; let n = src;
      for (const [ty, f, q] of (AMB_CFG[id] ? AMB_CFG[id].f : [])) { const b = ctx.createBiquadFilter(); b.type = ty; b.frequency.value = f; if (q) b.Q.value = q; n.connect(b); n = b; list.push(b); }
      const g = ctx.createGain(); g.gain.value = 0; n.connect(g); g.connect(out); list.push(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(SCENE_PEAK * SCENE_LVL[id], t + SCENE_FADE);
      live += list.length; let done = false;
      src.onended = () => { if (done) return; done = true; list.forEach(x => x.disconnect()); live -= list.length; };
      src.start(t, rng() * (buf.duration || 0));
      cur = {src, g};
    }
  };
}
/* YouTube müziği çalarken (sentez motoru kapalı) kullanılan hafif, bağımsız sahne katmanı. */
function ambience(ctx) {
  const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
  const L = sceneLayer(ctx, out, mulberry32(4242));
  return {
    get id() { return L.id; }, get live() { return L.live; },
    scene(id) { if (id && ctx.state === 'suspended' && ctx.resume) ctx.resume(); L.set(id); },
    volume(v) { v = Math.max(0, Math.min(1, +v || 0)); out.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }
  };
}

function create(ctx, opt) {
  opt = opt || {};
  const rng = mulberry32((opt.seed || 1) * 7919), seq = new Sequencer(opt.seed || 1);
  let tonic = opt.tonic || 45, nodes = 0, volume = opt.volume === undefined ? 0.6 : opt.volume, playing = false, timer = null, schedT = 0;
  const mk = (fn, ...a) => { nodes++; return ctx[fn](...a); };
  const G = v => { const g = mk('createGain'); g.gain.value = v; return g; };
  const F = (type, f, q) => { const b = mk('createBiquadFilter'); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const pan = p => { if (!ctx.createStereoPanner) return G(1); const n = mk('createStereoPanner'); n.pan.value = p; return n; };
  const waves = {}; for (const k in WAVES) { const im = new Float32Array(WAVES[k].length + 1); WAVES[k].forEach((v, i) => im[i + 1] = v); waves[k] = ctx.createPeriodicWave(new Float32Array(im.length), im); }

  // Ana zincir: toplam → konuşma bandı EQ → ses düzeyi → sınırlayıcı → çıkış
  const sum = G(1), eq = F('peaking', 1200, 0.7), vol = G(0), lim = mk('createDynamicsCompressor');
  eq.gain.value = 0; lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
  sum.connect(eq); eq.connect(vol); vol.connect(lim); lim.connect(ctx.destination);
  const synth = G(1); synth.connect(sum);
  const send = G(1), conv = mk('createConvolver'), wet = G(0.55);
  conv.buffer = makeIR(ctx, rng, opt.small ? 1.4 : 2.4);
  const sHp = F('highpass', 250), sLp = F('lowpass', 5000);
  send.connect(sHp); sHp.connect(sLp); sLp.connect(conv); conv.connect(wet); wet.connect(synth);

  // Ped: iki banka × 4 ses × 2 osilatör, hep çalışır; akor değişimi = sessiz bankayı akortla, geçiş yap
  const padSend = G(0.4); padSend.connect(send);
  const banks = [0, 1].map(() => {
    const g = G(0), lp = F('lowpass', 800, 0.4); lp.connect(g); g.connect(synth); g.connect(padSend);
    const voices = [0, 1, 2, 3].map(i => { const vg = G(0), p = pan([-0.35, 0.3, -0.15, 0.4][i]); vg.connect(p); p.connect(lp);
      const os = [0, 1].map(() => { const o = mk('createOscillator'); o.setPeriodicWave(waves.soft); o.frequency.value = 110; o.connect(vg); o.start(); return o; });
      return {vg, os}; });
    return {g, lp, voices};
  });
  let curBank = 0;

  // Ezgi: 4 FM sesi (çan, cam, tel) + 2 yaylı ses; havuzdan sırayla
  const leadBus = G(1), leadSend = G(0.8); leadBus.connect(synth); leadBus.connect(leadSend); leadSend.connect(send);
  const mkLead = (type, i) => { const car = mk('createOscillator'), mod = mk('createOscillator'), mg = G(0), g = G(0), p = pan([-0.25, 0.25, -0.1, 0.1][i % 4]);
    car.type = type; car.frequency.value = 440; mod.frequency.value = 440; mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(p); p.connect(leadBus); car.start(); mod.start();
    return {car, mod, mg, g}; };
  const fmV = [0, 1, 2, 3].map(i => mkLead('sine', i)), bowV = [0, 1].map(i => mkLead('triangle', i));
  let fmI = 0, bowI = 0;

  // Nabız: 55 Hz sinüs + 110 Hz üçgen (küçük hoparlörde de duyulsun)
  const pg = G(0), pLp = F('lowpass', 220); pg.connect(pLp); pLp.connect(synth);
  const pOs = [['sine', 55], ['triangle', 110]].map(([ty, f]) => { const o = mk('createOscillator'); o.type = ty; o.frequency.value = f; const og = G(ty === 'sine' ? 1 : 0.35); o.connect(og); og.connect(pg); o.start(); return o; });

  const ambBus = G(1); ambBus.connect(sum);
  const amb = {}, custom = {}; let cSrc = null, cGain = null, cMood = -1, st = {ambience: [], mic: false}, engMood = -1;
  const sceneBus = G(1); sceneBus.connect(sum);
  const fixedNodes = nodes;
  const scenes = sceneLayer(ctx, sceneBus, mulberry32((opt.seed || 1) * 104729));
  let fadeUntil = 0, lastMotif = -99, beatOrigin = 0, motifLive = 0;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function bellNote(m, t, gain) {                 // yumuşak çan: oran 2 FM, hızla sönen indeks
    const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2; mg.gain.value = 0; g.gain.value = 0;
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(leadBus);
    mg.gain.setValueAtTime(f * 0.9, t); mg.gain.setTargetAtTime(0, t, 0.4);
    g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(gain, t, 0.006); g.gain.setTargetAtTime(0, t + 0.03, 0.9);
    motifLive += 4; let done = false;
    car.onended = () => { if (done) return; done = true; [car, mod, mg, g].forEach(x => x.disconnect()); motifLive -= 4; };
    car.start(t); mod.start(t); car.stop(t + 5); mod.stop(t + 5);
  }

  function applyChord(e) {
    const R = RECIPES[e.mood], b = banks[curBank ^ 1], old = banks[curBank], t = e.t, tau = e.fade / 4;
    b.lp.frequency.setTargetAtTime(R.cutoff * Math.pow(2, e.intensity - 0.5), t, 0.8);
    b.voices.forEach((v, i) => { const f = mtof(tonic + e.chord[i]);
      v.os.forEach((o, k) => { o.setPeriodicWave(waves[R.wave]); o.frequency.setTargetAtTime(f, t, 0.02); o.detune.setTargetAtTime((k ? 1 : -1) * R.det * (e.intensity > 0.6 ? 1.4 : 1), t, 0.1); });
      v.vg.gain.setTargetAtTime(PAD_LEVEL[R.wave] / (1 + i * 0.3), t, 0.05); });
    b.g.gain.setTargetAtTime(TRIM[e.mood], t, tau); old.g.gain.setTargetAtTime(0, t, tau);
    curBank ^= 1;
    if (e.changed) { engMood = e.mood; syncExtras(t); }
    if (!opt.offline) { const ms = Math.max(0, (t - ctx.currentTime) * 1000);
      if (e.changed && api.onMood) setTimeout(() => api.onMood(e.mood, e.fade), ms);
      if (api.onChord) setTimeout(() => api.onChord(e.dur), ms); }
  }
  function applyNote(e) {
    const f = mtof(tonic + e.semi), t = e.t, bow = e.inst === 'bow', v = bow ? bowV[bowI++ % 2] : fmV[fmI++ % 4];
    const P = {bell: [2, 1.2, 0.25, 0.004, 0.012, 1.0, 0.085], glass: [3.5, 0.8, 0.6, 0.2, 0.6, 1.6, 0.05], pluck: [1, 0.6, 0.08, 0.002, 0.006, 0.28, 0.075]}[e.inst];
    v.car.frequency.setValueAtTime(f, t); v.g.gain.cancelScheduledValues(t); v.mg.gain.cancelScheduledValues(t);
    if (bow) { v.mod.frequency.setValueAtTime(4.8, t); v.mg.gain.setValueAtTime(0, t); v.mg.gain.setTargetAtTime(f * 0.006, t + 0.35, 0.3);
      v.g.gain.setTargetAtTime(0.06 * e.vel * TRIM[Math.max(0, engMood)], t, 0.15); v.g.gain.setTargetAtTime(0, t + 2.2, 0.5); }
    else { v.mod.frequency.setValueAtTime(f * P[0], t); v.mg.gain.setValueAtTime(f * P[1], t); v.mg.gain.setTargetAtTime(0, t, P[2]);
      v.g.gain.setTargetAtTime(P[6] * e.vel, t, P[3]); v.g.gain.setTargetAtTime(0, t + P[4], P[5]); }
  }
  function applyPulse(e) {
    const t = e.t, hi = RECIPES[e.mood].id === 'macera';
    pOs[0].frequency.setValueAtTime(hi ? 73 : 55, t); pOs[1].frequency.setValueAtTime(hi ? 146 : 110, t);
    pg.gain.cancelScheduledValues(t); pg.gain.setTargetAtTime(0.22 * e.vel, t, 0.004); pg.gain.setTargetAtTime(0, t + 0.035, hi ? 0.11 : 0.07);
  }
  function apply(evs) { for (const e of evs) { if (e.kind === 'chord') applyChord(e); else if (e.kind === 'note') applyNote(e); else applyPulse(e); } }

  function syncExtras(t) {
    t = t === undefined ? ctx.currentTime : t;
    const want = st.ambience || [];
    for (const id of want) if (!amb[id] && AMB_CFG[id]) {             // ortam sesi ilk gerektiğinde üretilir
      const src = mk('createBufferSource'); src.buffer = makeAmb(ctx, id, rng); src.loop = true; let n = src;
      for (const [ty, f, q] of AMB_CFG[id].f) { const b = F(ty, f, q); n.connect(b); n = b; }
      const g = G(0); n.connect(g); g.connect(ambBus); src.start(); amb[id] = g;
    }
    for (const id in amb) amb[id].gain.setTargetAtTime(playing && want.includes(id) ? AMB_CFG[id].lvl * 0.05 * (st.mic ? 0.25 : 1) : 0, t, 1.2);
    eq.gain.setTargetAtTime(st.mic ? -9 : 0, t, 0.3); wet.gain.setTargetAtTime(st.mic ? 0.28 : 0.55, t, 0.3);
    if (playing && t >= fadeUntil) vol.gain.setTargetAtTime(volume * (st.mic ? 0.5 : 1), t, 0.3);
    const cm = playing && engMood >= 0 && custom[engMood] ? engMood : -1;   // kullanıcının kendi parçası
    if (cm !== cMood) {
      if (cSrc) { cGain.gain.setTargetAtTime(0, t, 1.2); cSrc.stop(t + 7); cSrc = null; }
      cMood = cm;
      if (cm >= 0) { cSrc = ctx.createBufferSource(); cSrc.buffer = custom[cm]; cSrc.loop = true; cGain = ctx.createGain(); cGain.gain.value = 0; cSrc.connect(cGain); cGain.connect(sum); cSrc.start(t); cGain.gain.setTargetAtTime(0.7, t, 1.5); }
      synth.gain.setTargetAtTime(cm >= 0 ? 0 : 1, t, 1.5);
    }
  }
  function tick() {
    const now = ctx.currentTime, to = now + ((typeof document !== 'undefined' && document.hidden) ? 2.5 : 0.15), from = Math.max(schedT, now);
    if (to > from) { apply(seq.advance(from, to)); schedT = to; }
  }
  const api = {
    onMood: null, onChord: null, seq,
    get playing() { return playing; }, get nodes() { return nodes; }, get fixedNodes() { return fixedNodes; }, get mood() { return engMood; },
    get sceneId() { return scenes.id; }, get liveExtra() { return scenes.live + motifLive; },
    async start() { if (playing) return; await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 1500))]); if (ctx.state !== 'running') throw new Error('ses başlatılamadı'); playing = true; schedT = ctx.currentTime; beatOrigin = ctx.currentTime; fadeUntil = 0; if (seq.engMood < 0) seq.reset(ctx.currentTime + 0.05);
      vol.gain.cancelScheduledValues(ctx.currentTime); vol.gain.setTargetAtTime(volume * (st.mic ? 0.5 : 1), ctx.currentTime, 0.6); syncExtras(); tick(); timer = setInterval(tick, 25); },
    stop() { if (!playing) return; playing = false; clearInterval(timer); if (fadeUntil > ctx.currentTime) { vol.gain.cancelScheduledValues(ctx.currentTime); vol.gain.setValueAtTime(vol.gain.value, ctx.currentTime); } fadeUntil = 0;
      vol.gain.setTargetAtTime(0, ctx.currentTime, 0.25); syncExtras(); setTimeout(() => { if (!playing && ctx.suspend) ctx.suspend(); }, 1500); },
    set(s) { st = Object.assign(st, s); seq.set(s, ctx.currentTime); if (playing || opt.offline) syncExtras(); },
    chapter() { seq.chapter(ctx.currentTime); },
    volume(v) { volume = v; if (fadeUntil > ctx.currentTime) { vol.gain.cancelScheduledValues(ctx.currentTime); vol.gain.setValueAtTime(vol.gain.value, ctx.currentTime); } fadeUntil = 0;
      if (playing) vol.gain.setTargetAtTime(v * (st.mic ? 0.5 : 1), ctx.currentTime, 0.08); },
    /* Uyku zamanlayıcısı: ana ses düzeyini doğrusal olarak vol'e (0..1) götürür; 0'da sıralayıcı çalışmaya devam eder. */
    fadeTo(v, seconds) {
      v = clamp(+v || 0, 0, 1); const s = Math.max(0.05, +seconds || 0), t = ctx.currentTime; volume = v; fadeUntil = t + s;
      if (!playing) return;
      vol.gain.cancelScheduledValues(t); vol.gain.setValueAtTime(vol.gain.value, t); vol.gain.linearRampToValueAtTime(v * (st.mic ? 0.5 : 1), t + s);
    },
    /* Müziğin altında sahne sesi: 'rain','wind','sea','fire','hooves','crowd' ya da null; 2 sn çapraz geçiş. */
    scene(id) { scenes.set(id); },
    /* 3–4 notalık motif (kitap toniğinden yarım ses uzaklıkları); bir sonraki vuruşa hizalanır, 6 sn içinde ikincisi yok sayılır.
       Çalınca başlangıç zamanını, yok sayılınca false döndürür. */
    motif(notes, o) {
      if (!playing || !Array.isArray(notes) || notes.length < 3 || notes.length > 4 || !notes.every(n => typeof n === 'number' && isFinite(n))) return false;
      const now = ctx.currentTime; if (now - lastMotif < 6) return false;
      lastMotif = now;
      const R = RECIPES[Math.max(0, engMood)], beat = R.pulse ? 60 / R.pulse : 60 / 72, step = beat >= 0.7 ? beat / 2 : beat;
      const t0 = beatOrigin + Math.ceil((now + 0.03 - beatOrigin) / beat) * beat;
      const g = 0.07 * clamp(o && typeof o.gain === 'number' ? o.gain : 1, 0, 2) * (st.mic ? 0.4 : 1);
      notes.forEach((n, i) => bellNote(tonic + 24 + clamp(Math.round(n), -24, 24), t0 + i * step, g * (i === notes.length - 1 ? 1 : 0.85)));
      return t0;
    },
    tonic(m) { tonic = m; },
    setCustom(mood, buf) { if (buf) custom[mood] = buf; else delete custom[mood]; syncExtras(); },
    /* Çevrimdışı test: olayları t anına kadar grafiğe yazar. */
    advanceTo(t) { if (!playing) { playing = true; beatOrigin = ctx.currentTime; vol.gain.value = volume; syncExtras(0); } apply(seq.advance(schedT, t)); schedT = t; }
  };
  return api;
}

return {RECIPES, TRIM, Sequencer, selfTest, create, mulberry32, ambience, SCENES: Object.keys(SCENE_LVL), SCENE_PEAK, renderScene};
});
