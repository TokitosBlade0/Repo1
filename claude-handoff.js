/* SA_Claude — kitabı okurun kendi Claude hesabına (claude.ai) elle aktarma. API anahtarı yok, ağ isteği yok.
   buildExport(book, {maxChars}) → {parts:[{filename, text, prompt, index, count, from, to}], total}
     Paragraflar 1'den numaralanır (¶1 …); from/to bu numaralardır (1 tabanlı, dahil).
   parseResult(text, book, part?) → {ok, scenes:[{from,to,mood,energy,query,note}], book, coverage, warnings}
   merge(book, results, parsed) → results[i] = {mood, energy, query, scene, source:'claude'} (i 0 tabanlı; scene = sahnenin ilk indeksi) */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require === 'function' ? (() => { try { return require('./core.js'); } catch (_) { return null; } })() : null);
  const MOODS = ['huzur', 'huzun', 'gerilim', 'karanlik', 'nese', 'ask', 'macera', 'gizem'];
  const ENERGY = {huzur: 0.2, huzun: 0.3, gerilim: 0.75, karanlik: 0.45, nese: 0.65, ask: 0.35, macera: 0.75, gizem: 0.4};
  const QUERY = {huzur: 'calm ambient piano', huzun: 'sad emotional piano strings', gerilim: 'suspense tension cinematic',
    karanlik: 'dark ambient horror', nese: 'happy playful whimsical', ask: 'romantic gentle piano',
    macera: 'epic adventure orchestral', gizem: 'mysterious ambient noir'};
  const PROMPT_VERSION = 1, MAX_CHARS = 120000;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const clean = p => String(p == null ? '' : p).replace(/\s+/g, ' ').trim();
  const paras = book => (book && Array.isArray(book.paragraphs)) ? book.paragraphs : [];

  function slug(s) {
    const m = {ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u'};
    const t = String(s || 'kitap').toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => m[c]).normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
    return t || 'kitap';
  }

  // Paragraf sınırında ≤ maxChars'lık aralıklar (1 tabanlı, dahil). Tek başına uzun paragraf kendi parçası olur.
  function splitRanges(book, maxChars) {
    const P = paras(book), lim = Math.max(1000, maxChars || MAX_CHARS), out = [];
    let from = 1, size = 0;
    for (let i = 0; i < P.length; i++) {
      const len = ('¶' + (i + 1) + ' ' + clean(P[i])).length + 2;
      if (size > 0 && size + len > lim) { out.push({from, to: i}); from = i + 1; size = 0; }
      size += len;
    }
    if (P.length) out.push({from, to: P.length});
    return out;
  }

  function buildPrompt(book, r, k, n) {
    const title = clean(book.title) || 'Adsız', author = clean(book.author);
    const multi = n > 1;
    const example = {v: 1, book: {title, author: author || '…', lang: book.lang || 'en', genre: 'roman', coverScene: 'A lone lighthouse on a stormy cliff at dusk'},
      scenes: [{from: r.from, to: r.from + 13, mood: 'huzur', energy: 0.3, query: 'calm piano ambient', note: 'kısa Türkçe açıklama'}]};
    return [
      'Bir okuma uygulaması için kitaba arka plan müziği seçen bir müzik süpervizörüsün.',
      'Ekteki metin dosyasında "' + title + '"' + (author ? ' (' + author + ')' : '') + ' kitabının ¶' + r.from + '–¶' + r.to + ' paragrafları var' +
        (multi ? ' (kitabın ' + n + ' parçasından ' + k + '. parça)' : '') + '. Her paragraf ¶numara ile başlıyor.',
      'Görevin: bu paragrafları sahnelere ayırmak ve her sahneye uygun enstrümantal müzik ruhunu seçmek.',
      '',
      'Kurallar:',
      '- Sahneler ¶' + r.from + ' ile başlar, ¶' + r.to + ' ile biter; sıralı, boşluksuz ve çakışmasızdır: her paragraf tam olarak bir sahnededir.',
      '- from ve to paragraf numaralarıdır (dahil). Tek bir diyalog satırı için sahne değiştirme; bir sahne genellikle 5–60 paragraftır.',
      '- mood yalnızca şu 8 kimlikten biri olmalı, aynen bu yazımla: huzur (sakinlik), huzun (hüzün), gerilim (gerilim/aksiyon), karanlik (karanlık/korku/gotik), nese (neşe/mizah), ask (aşk/şefkat), macera (macera/destansı), gizem (gizem/merak).',
      '- energy: 0 ile 1 arası sayı (0 çok sakin ve yavaş, 1 çok yoğun ve hızlı).',
      '- query: 3–6 kelimelik İngilizce, telifsiz enstrümantal müzik arama ifadesi (ör. "gentle victorian piano waltz"); sanatçı adı ve şarkı sözü yok.',
      '- note: sahneyi anlatan kısa Türkçe not (en fazla 12 kelime).',
      '- book: title, author, lang (iki harfli dil kodu), genre (Türkçe tür adı), coverScene (kitap kapağı için tek cümlelik, İngilizce, görsel bir sahne; yazı içermesin).' +
        (multi ? ' Bu yalnızca bir parça olsa da book alanını doldur.' : ''),
      '',
      'Cevabın YALNIZCA tek bir ```json kod bloğu olsun; öncesinde ya da sonrasında hiçbir açıklama yazma. Biçim:',
      '```json',
      JSON.stringify(example),
      '```'
    ].join('\n');
  }

  function buildExport(book, opts) {
    opts = opts || {};
    const P = paras(book), ranges = splitRanges(book, opts.maxChars), n = ranges.length, base = slug(book && book.title);
    const parts = ranges.map((r, j) => {
      const k = j + 1, lines = [];
      for (let i = r.from; i <= r.to; i++) lines.push('¶' + i + ' ' + clean(P[i - 1]));
      const head = 'SATIR ARASI · ' + (clean(book.title) || 'Adsız') + (book.author ? ' · ' + clean(book.author) : '') +
        ' · ' + (n > 1 ? 'parça ' + k + '/' + n + ' · ' : '') + '¶' + r.from + '–¶' + r.to + ' · istem v' + PROMPT_VERSION;
      return {index: k, count: n, from: r.from, to: r.to,
        filename: base + (n > 1 ? '-parca-' + k + '-' + n : '') + '.txt',
        text: head + '\n\n' + lines.join('\n\n') + '\n',
        prompt: buildPrompt(book || {}, r, k, n)};
    });
    return {parts, total: P.length, version: PROMPT_VERSION};
  }

  /* ---------- Yanıtı ayıkla ---------- */
  function extractJSON(text) {
    const s = String(text || '').replace(/^﻿/, '');
    const blocks = [...s.matchAll(/```(?:json|JSON)?\s*\n?([\s\S]*?)(?:```|$)/g)].map(m => m[1]).filter(b => b.includes('{'));
    const withScenes = blocks.find(b => /"scenes"/.test(b));
    if (withScenes || blocks[0]) return withScenes || blocks[0];
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    return a < 0 ? '' : b > a ? s.slice(a, b + 1) : s.slice(a);
  }
  // Açık kalan parantezleri kapatır (dizgi içini atlar)
  function closers(s) {
    const st = []; let inStr = false, esc = false;
    for (const c of s) {
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') st.push('}'); else if (c === '[') st.push(']');
      else if (c === '}' || c === ']') st.pop();
    }
    return inStr ? null : st.reverse().join('');
  }
  function looseParse(raw) {
    const fix = x => x.replace(/[“”„‟″]/g, '"').replace(/,\s*([}\]])/g, '$1');
    let s = fix(String(raw || '').trim());
    try { return {obj: JSON.parse(s), repaired: false}; } catch (_) { /* onar */ }
    for (let p = s.lastIndexOf('}') + 1, tries = 0; p > 0 && tries < 300; tries++) {      // yarım kalmış yanıt: son tam nesneye kadar kes, kapat
      const cut = s.slice(0, p).replace(/,\s*$/, ''), c = closers(cut);
      if (c != null) try { return {obj: JSON.parse(fix(cut + c)), repaired: true}; } catch (_) { /* geri git */ }
      p = s.lastIndexOf('}', p - 2) + 1;
      if (p <= 0) break;
    }
    return {obj: null, repaired: false};
  }
  const toInt = v => { const n = typeof v === 'number' ? v : parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? Math.round(n) : NaN; };

  function localMood(book, from, to) {
    if (!Core || !Core.analyze) return 'huzur';
    const P = paras(book), txt = P.slice(from - 1, to).join(' ').slice(0, 6000);
    try { const a = Core.analyze(txt, (book && book.lang) || 'en'), mi = Core.topMood(a.v); return a.v[mi] > 0 ? MOODS[mi] : 'huzur'; }
    catch (_) { return 'huzur'; }
  }

  function parseResult(text, book, part) {
    const warnings = [], N = paras(book).length;
    const fail = w => ({ok: false, scenes: [], book: null, coverage: {from: 0, to: 0, covered: 0, filled: 0, total: N, ratio: 0}, warnings: warnings.concat(w)});
    const raw = extractJSON(text);
    if (!raw) return fail('Yanıtta JSON bulunamadı. Claude\'un cevabının tamamını (```json bloğu dahil) yapıştırın.');
    const {obj, repaired} = looseParse(raw);
    if (!obj || typeof obj !== 'object') return fail('JSON okunamadı; yanıt bozuk ya da yarım görünüyor.');
    if (repaired) warnings.push('Yanıt yarım ya da bozuktu; okunabilen kısım onarıldı.');
    if (obj.v != null && obj.v !== PROMPT_VERSION) warnings.push('Beklenmeyen sürüm: v=' + obj.v);
    const arr = Array.isArray(obj.scenes) ? obj.scenes : Array.isArray(obj) ? obj : [];
    const max = N || Infinity;
    let unknown = 0, dropped = 0, scenes = [];
    for (const x of arr) {
      if (!x || typeof x !== 'object') { dropped++; continue; }
      let f = toInt(x.from), t = toInt(x.to);
      if (!Number.isFinite(f) && !Number.isFinite(t)) { dropped++; continue; }
      if (!Number.isFinite(f)) f = t; if (!Number.isFinite(t)) t = f;
      if (t < f) [f, t] = [t, f];
      f = Math.max(1, f); t = Math.min(max, t);
      if (t < f) { dropped++; continue; }
      let mood = typeof x.mood === 'string' ? x.mood.trim().toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/â/g, 'a') : '';
      let local = false;
      if (!MOODS.includes(mood)) { mood = localMood(book, f, t); unknown++; local = true; }
      let e = Number(x.energy);
      if (!Number.isFinite(e)) e = ENERGY[mood]; else if (e > 1 && e <= 10) e /= 10;
      let q = typeof x.query === 'string' ? x.query.replace(/[\r\n"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
      if (!q || local) q = q || QUERY[mood];
      scenes.push({from: f, to: t, mood, energy: +clamp01(e).toFixed(2), query: q, note: clean(x.note).slice(0, 160)});
    }
    if (dropped) warnings.push(dropped + ' geçersiz sahne atlandı.');
    if (unknown) warnings.push(unknown + ' sahnede bilinmeyen duygu vardı; yerel analizle seçildi.');
    if (!scenes.length) return fail('Geçerli sahne bulunamadı.');
    scenes.sort((a, b) => a.from - b.from || a.to - b.to);
    // Çakışmalar: sonraki sahne öncekinin bittiği yerden sonra başlar; tamamen örtülen düşer
    const out = []; let overl = 0;
    for (const s of scenes) {
      const p = out[out.length - 1];
      if (p && s.from <= p.to) { overl++; if (s.to <= p.to) continue; s.from = p.to + 1; }
      out.push(s);
    }
    if (overl) warnings.push(overl + ' sahne çakışması düzeltildi.');
    scenes = out;
    let covered = scenes.reduce((a, s) => a + s.to - s.from + 1, 0), filled = 0, gaps = 0;
    for (let k = 1; k < scenes.length; k++) {           // boşluk → önceki komşu sahneyi uzat
      const gap = scenes[k].from - scenes[k - 1].to - 1;
      if (gap > 0) { gaps++; filled += gap; scenes[k - 1].to = scenes[k].from - 1; }
    }
    if (gaps) warnings.push(gaps + ' boşluk (' + filled + ' paragraf) komşu sahneyle dolduruldu.');
    // Beklenen aralık: verilen parça ya da bu kitabın dışa aktarım parçalarından en çok örtüşeni
    let exp = part && Number.isFinite(+part.from) && Number.isFinite(+part.to) ? {from: +part.from, to: +part.to} : null;
    if (!exp && N) {
      const a = scenes[0].from, b = scenes[scenes.length - 1].to; let best = 0;
      for (const r of splitRanges(book)) { const ov = Math.min(b, r.to) - Math.max(a, r.from) + 1; if (ov > best) { best = ov; exp = r; } }
    }
    if (exp) {
      const first = scenes[0], last = scenes[scenes.length - 1];
      const head = first.from - exp.from, tail = exp.to - last.to;
      if (head > 0) { first.from = exp.from; filled += head; }
      if (tail > 0) { last.to = exp.to; filled += tail; }
      if (head > 0 || tail > 0) warnings.push('Claude ¶' + exp.from + '–¶' + exp.to + ' aralığının ' + (Math.max(0, head) + Math.max(0, tail)) + ' paragrafını atlamış; komşu sahneyle dolduruldu.');
    }
    const span = exp ? exp.to - exp.from + 1 : scenes[scenes.length - 1].to - scenes[0].from + 1;
    const coverage = {from: scenes[0].from, to: scenes[scenes.length - 1].to, covered, filled, total: N,
      ratio: span ? +Math.min(1, covered / span).toFixed(3) : 0,
      bookRatio: N ? +((scenes[scenes.length - 1].to - scenes[0].from + 1) / N).toFixed(3) : 0};
    const b = obj.book && typeof obj.book === 'object' ? obj.book : {};
    const meta = {title: clean(b.title) || (book && book.title) || '', author: clean(b.author) || (book && book.author) || '',
      lang: /^[a-z]{2}$/i.test(clean(b.lang)) ? clean(b.lang).toLowerCase() : (book && book.lang) || '',
      genre: clean(b.genre).slice(0, 60), coverScene: clean(b.coverScene).slice(0, 300)};
    return {ok: true, scenes, book: meta, coverage, warnings};
  }

  function merge(book, results, parsed) {
    const N = paras(book).length;
    const out = Array.isArray(results) ? results : new Array(N).fill(null);
    while (out.length < N) out.push(null);
    if (!parsed || !parsed.ok) return out;
    for (const s of parsed.scenes) {
      const a = Math.max(0, s.from - 1), b = Math.min(N || s.to, s.to);
      for (let i = a; i < b; i++) out[i] = {mood: s.mood, energy: s.energy, query: s.query, scene: a, source: parsed.source || 'claude'};
    }
    return out;
  }

  const api = {buildExport, parseResult, merge, PROMPT_VERSION, MAX_CHARS, _internal: {splitRanges, extractJSON, looseParse, slug}};
  root.SA_Claude = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
