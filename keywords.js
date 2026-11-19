/* Satır Arası — anahtar sözcük ön taraması (Gemini'ye yalnızca gereken cümleler gitsin).
   Tarayıcıda window.SA_Keywords, Node'da module.exports. DOM'a dokunmaz; Core'un kök eşleştiricisini (matchStem),
   belirteçleyicisini (tokenize), çözümleyicisini (analyze: olumsuzluk + yoğunlaştırıcı) ve sahne çözücüsünü (decode) kullanır.

   Sözlük kaynakları (el ile seçilmiş, dosyalar kopyalanmadı; yalnızca kategori eşlemesi ve örnek sözcük türleri):
   - NRC Word-Emotion Association Lexicon (EmoLex), Mohammad & Turney 2013 — 8 duygu: anger, anticipation, disgust, fear,
     joy, sadness, surprise, trust. Eşleme: fear/disgust → karanlik, anger/fear(eylem) → gerilim, sadness → huzun,
     joy → nese, trust(+sevgi) → ask, anticipation(+yolculuk) → macera, surprise(+bilinmezlik) → gizem, trust(+dinginlik) → huzur.
     https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm
   - TREMO (Toçoğlu & Alpkoçak, DEÜ) ve "Lexicon-based emotion analysis in Turkish" (Turk J Elec Eng & Comp Sci 27(2), 2019) —
     Ekman'ın 6 duygusu (mutluluk, korku, öfke, üzüntü, tiksinme, şaşkınlık); Türkçe kök seçimi bu kategorilere göre.
   - Sahne değişimi ipuçları (birden, gece, fırtına, öldü, öptü …): anlatı bilimi/sahne geçişi sezgisi, elle derlendi.
   Biçim Core ile aynıdır: "kök" önek eşleşir, "=kelime" yalnızca tam, ":n" ağırlık. */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require === 'function' ? require('./core.js') : null);
  const MOODS = Core.MOODS;

  /* ---------- Ek sözlük (Core.LEX'te olmayan kökler; yalnızca cümle seçimi ve belirsizlik sinyali için) ---------- */
  const EXTRA = {
    tr: {
      huzur: 'dinlendi:2 sessizlik:2 sükunet:3 ferah:2 ılıklık asude:3 hoşnut:2 memnun:2 =kuşlar çiçek çimen gölge:0.5 kumsal tefekkür:2 süzül uyukla ninnisi sakinle:2 durgun:2 avunt:2 =rahat:2 dinç pürüzsüz',
      huzun: 'dertli:2 =dert:2 acı:2 acıyla:2 kırgın:2 hüsran:3 ıstırap:3 perişan:2 inle:2 yas:2 gamlı:3 =gam:2 ah:0.5 sızı:2 vefat:3 kaybettik:2 ayrıl:2 ölmüştü:2 yetimhane:2 kimsesiz:3 öksüz:2 terk:2 hıçkırık:3',
      gerilim: 'kaçın:2 fırla:2 sıçra:2 yakala:2 boğuş:3 itiş:2 kurşun:2 ateş:1 nişan:1 yaral:2 vurul:2 kovul tehlikeli:3 dehşete:2 soluk:1 nefes:1 haykır:2 imdat:3 yetiş:1 öfke:2 hiddet:3 kızgın:2 tokat:2 yumruk:2 hançer:2',
      karanlik: 'iğrenç:3 tiksin:3 kokuşmuş:3 leş:2 kan:1 kanlar:2 cesed:3 mezara:2 cin:0.5 =cinler:2 büyücü:2 büyü:1 lanetli:3 korkunç:3 dehşetli:3 kâbus:3 karanlığ:3 geceyarısı:2 ürkütücü:3 vahşi:2 kurt:1 baykuş:2 çığlık:2',
      nese: 'neşeli:3 şen:1 gülümse:2 güleç:2 tebessüm:2 kahkahay:3 eğlence:2 =eğlenceli:3 şakacı:2 zıpla:2 coşku:3 sevinç:3 mutluluk:3 bayram:2 kutla:2 oyna:1 tatlı:0.5 komik:2 gırgır:3',
      ask: 'aşkı:3 aşkım:3 sevgilisi:3 nişanl:2 evlen:2 düğün:1 gelin:1 damat:1 yüreği:1 hayran:2 meftun:3 vurgun:3 özlediği:2 kavuşma:2 dudak:2 =buse:3 sevişme:3 maşuk:3 yar:0.5 sevdalı:3 gözlerine:1',
      macera: 'yolculuk:2 sefere:2 akın:2 akıncı:3 sipahi:2 yeniçeri:2 =kılıcı:2 mızrak:2 kalkan:1 atıl:2 dörtnal:3 dağlar:1 ufuk:1 keşfet:2 hazine:3 korsan:3 ada:0.5 tayfa:2 limana:1 fethet:2 =zafer:3 cenk:3 gaza:2',
      gizem: 'esrarengiz:3 gizemli:3 meçhul:3 bilinmez:2 sırlı:3 tılsım:3 kayıp:1 iz:0.5 izler:1 şüpheli:3 kuşku:2 kuşkulan:2 dedikodu:1 fısıltı:2 saklı:2 gizlice:2 muamma:3 bilmece:3 casus:3 hafiye:3 tuhaflık:2'
    },
    en: {
      huzur: 'serenity:3 stillness:2 tranquility:3 tranquillity:3 repose:2 leisure:2 rested:2 soothe:2 soothing:2 calmly:2 peacefully:3 harmony:2 sunlit:2 blossom:1 orchard:1 cottage:1 restful:3 bliss:2 contentment:3 placidly:2 lull:2',
      huzun: 'mourning:3 bereaved:3 bereavement:3 anguish:3 heartache:3 woe:3 woeful:3 grieving:3 tearful:3 sorrowing:3 desolation:3 lonesome:2 bleak:2 regretted:2 remorse:2 sorrows:3 widowed:2 deceased:2 perished:2 lost:0.5 mourned:3 sighed:1',
      gerilim: 'struggled:2 grappled:3 dashed:2 sprang:2 leapt:2 screamed:3 shouted:2 yelled:2 gunshot:3 bullet:2 wound:2 wounded:2 stabbed:3 strangle:3 menace:3 menacing:3 threatened:3 anger:2 angry:2 wrath:3 enraged:3 seize:2 snatched:2',
      karanlik: 'disgust:3 disgusted:3 disgusting:3 revolting:3 putrid:3 decay:2 decayed:2 corpse:3 carcass:3 graveyard:3 churchyard:2 phantom:3 spectre:3 specter:3 wraith:3 witch:2 sorcery:3 unholy:3 abyss:2 blackness:3 horrified:3 shudder:3 shuddered:3 ghoul:3',
      nese: 'laughed:3 laughing:3 rejoice:3 rejoiced:3 delighted:3 joyous:3 joyful:3 gleeful:3 glee:3 mirth:3 merrily:3 festive:2 feast:1 celebrate:2 celebration:2 jovial:3 hilarious:3 tease:1 teased:1 whimsical:2 gaiety:3',
      ask: 'kissed:3 kisses:3 embraces:2 lovingly:3 enamoured:3 enamored:3 infatuated:3 betrothed:3 wedding:2 bride:2 bridegroom:2 longing:2 yearning:2 flirt:2 courting:3 sweethearts:3 heartfelt:2 amorous:3 wooed:3 woo:2',
      macera: 'voyage:3 voyages:3 sailed:2 galloped:3 raid:2 conquest:3 conquer:3 campaign:1 warrior:3 warriors:3 knight:2 knights:2 spear:2 shield:1 musket:1 frontier:2 wilderness:2 jungle:2 mountains:1 horizon:1 discovered:1 discovery:2',
      gizem: 'secretly:2 secrets:2 conceal:2 concealed:2 hidden:2 mysteriously:3 uncanny:3 unexplained:3 unaccountable:2 enigmatic:3 cryptic:3 riddles:3 sleuth:3 culprit:3 alibi:3 footprints:2 footprint:2 clues:3 suspected:2 suspicious:2 spy:2'
    }
  };
  /* Sahne değişimi ipuçları: duygudan bağımsız, cümleyi “sınır adayı” yapar */
  const CUES = {
    tr: 'birden aniden ansızın =derken =sonunda ertesi =gece =gecesi geceleyin =akşam akşamüstü =sabah sabahleyin şafak tanyeri fırtına öldü =ölü öptü vuruldu patladı uyandı bayıldı kaçtı =kapı =kapıyı =çığlık yıllar =oysa =meğer',
    en: 'sudden suddenly =night midnight dawn =morning =evening storm died =dead death kiss kissed shot exploded awoke awakened fainted fled scream screamed =door =meanwhile =later =years =hours =till =until'
  };

  // Core.buildIndex dışa açık değil; aynı biçimde küçük bir dizin kurup Core.matchStem'e veriyoruz.
  function buildIndex(table, tags) {
    const idx = new Map();
    for (const tag of tags) for (const raw of String(table[tag] || '').split(/\s+/)) {
      if (!raw) continue;
      let s = raw, w = 1, exact = false;
      const c = s.indexOf(':'); if (c > 0) { w = +s.slice(c + 1); s = s.slice(0, c); }
      if (s[0] === '=') { exact = true; s = s.slice(1); }
      if (s.length < 4) exact = exact || s.length < 3;
      s = Core.lower(s, 'tr');
      const k = s.slice(0, 3);
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push({s, tag, w, exact});
    }
    for (const l of idx.values()) l.sort((a, b) => b.s.length - a.s.length);
    return idx;
  }
  const XIDX = {tr: buildIndex(EXTRA.tr, MOODS), en: buildIndex(EXTRA.en, MOODS)};
  const CIDX = {tr: buildIndex({cue: CUES.tr}, ['cue']), en: buildIndex({cue: CUES.en}, ['cue'])};
  const NEG_TR = /^.{0,2}?(m[ae](d[ıi]|z|m[ıi]ş|y[ae]c|s[ıi]n|d[ae]n)|m[ıiuü]yor|s[ıiuü]z)/;   // Core ile aynı
  const NEG_EN = new Set(['not', 'no', 'never', 'without', 'hardly', 'neither', 'nor', 'cannot']);

  /* ---------- Cümle bölücü (TR/EN): kısaltmalar, baş harfler, tırnaklar, üç nokta ---------- */
  const ABBR = new Set(('mr mrs ms dr st jr sr prof gen col capt lt sgt rev hon messrs mme mlle vs etc e.g i.e no vol ch fig ' +
    'bkz vb vs yy yrd doç sn hz av alb yzb bnb kur müd böl s sy nr çev haz yay ord öğr gör').split(' '));
  const END = /[.!?…]+["'”’»)\]]*(?=\s|$)/g;
  function splitSentences(text) {
    const t = String(text || ''), out = [];
    let a = 0, m;
    END.lastIndex = 0;
    while ((m = END.exec(t))) {
      const b = m.index + m[0].length;
      const pm = m[0];
      if (pm[0] === '.' && pm.length === 1 || pm === '.”' || pm === '."') {
        const before = t.slice(Math.max(a, m.index - 12), m.index).match(/([\p{L}.]+)$/u);
        const w = before ? before[1].toLocaleLowerCase('tr') : '';
        if (w && (ABBR.has(w) || ABBR.has(w.replace(/\.$/, '')) || /^\p{L}$/u.test(w) || /^(\p{L}\.)+\p{L}$/u.test(w))) continue;   // Mr. / J. / e.g.
      }
      let n = b; while (n < t.length && /\s/.test(t[n])) n++;
      if (n < t.length) {
        const c = t[n];
        if (c !== c.toLocaleUpperCase('tr') && /\p{L}/u.test(c)) continue;   // küçük harfle sürüyor: “… dedi ve”, “3. bölüm”
        if (/\d/.test(t[m.index - 1] || '') && pm === '.' && /\d/.test(c)) continue;   // 3.14
      }
      const s = t.slice(a, b).trim();
      if (s) out.push({s, a, b});
      a = n;
    }
    const rest = t.slice(a).trim();
    if (rest) out.push({s: rest, a, b: t.length});
    return out;
  }

  /* ---------- Tarama ---------- */
  const r2 = x => Math.round(x * 100) / 100;
  // Bir paragrafın ek-sözlük ve ipucu isabetleri (konumlu); olumsuzluk Core ile aynı kurallarla
  function extraHits(text, lang) {
    const toks = Core.tokenize(text, lang), hits = [];
    let n = 0, lastNeg = -99;
    for (const t of toks) {
      if (t.p) { lastNeg = -99; continue; }
      n++;
      const w = t.w;
      if (lang === 'en' && (t.nt || NEG_EN.has(w))) { lastNeg = n; continue; }
      if (w.length < 3) continue;
      const h = Core.matchStem(w, lang, XIDX[lang]);
      if (h && h.w > 0) {
        const neg = lang === 'tr' ? NEG_TR.test(w.slice(h.len)) : (n - lastNeg <= 3 || h.less);
        if (!neg) hits.push({w, m: h.tag, wt: h.w, i: t.i});
      }
      if (!t.cap || lang === 'en') { const c = Core.matchStem(w, lang, CIDX[lang]); if (c) hits.push({w, m: null, wt: 0, i: t.i, cue: true}); }
    }
    return hits;
  }
  let coreW = new Map();
  function coreWeight(w, lang) {
    const k = lang + w; let v = coreW.get(k);
    if (v === undefined) { const h = Core.matchStem(w, lang); v = h ? h.w : 1; if (coreW.size > 50000) coreW = new Map(); coreW.set(k, v); }
    return v;
  }

  /* scan(paragraphs, lang) → {paras:[{hits:[{s, idx, moods, cue, kw}], localMood, confidence, neutral, n, len, xm}], ms, sig}
     localMood/confidence: Core.analyze vektörleri + Core.decode (kayan pencere + histerezis + ada yumuşatma). */
  function scan(paragraphs, lang, o) {
    o = o || {};
    lang = lang || 'en';
    const t0 = nowMs();
    const N = paragraphs.length, items = new Array(N), raw = new Array(N);
    for (let i = 0; i < N; i++) {
      const text = String(paragraphs[i] || '');
      const a = Core.analyze(text, lang);
      items[i] = {v: a.v, n: a.n, amb: a.amb, brk: i === 0};
      raw[i] = {a, text};
    }
    const dec = N ? Core.decode(items) : {mood: [], conf: [], neutral: []};
    const paras = new Array(N);
    for (let i = 0; i < N; i++) {
      const {a, text} = raw[i];
      const core = a.cues.filter(c => !c.neg);
      const ex = core.length || text.length >= 40 ? extraHits(text, lang) : [];
      const xv = new Float32Array(8);
      for (const h of ex) if (h.m) xv[MOODS.indexOf(h.m)] += h.wt;
      let hits = [];
      if (core.length || ex.length) {
        const sents = splitSentences(text);
        const per = sents.map((x, idx) => ({s: x.s, idx, moods: {}, cue: false, kw: [], sc: 0, a: x.a, b: x.b}));
        const at = i0 => { let k = 0; while (k < per.length - 1 && i0 >= per[k].b) k++; return per[k]; };
        for (const c of core) { const p = at(c.i), wt = coreWeight(c.w, lang); p.moods[c.m] = r2((p.moods[c.m] || 0) + wt); p.sc += wt; if (p.kw.length < 4) p.kw.push(c.w); }
        for (const h of ex) {
          const p = at(h.i);
          if (h.cue) { p.cue = true; p.sc += 0.75; if (p.kw.length < 4 && !p.kw.includes(h.w)) p.kw.push(h.w); continue; }
          p.moods[h.m] = r2((p.moods[h.m] || 0) + h.wt); p.sc += h.wt; if (p.kw.length < 4 && !p.kw.includes(h.w)) p.kw.push(h.w);
        }
        hits = per.filter(p => p.sc > 0).map(p => ({s: p.s, idx: p.idx, moods: p.moods, cue: p.cue, kw: p.kw, sc: r2(p.sc)}));
      }
      let xm = -1, xs = 0; for (let m = 0; m < 8; m++) if (xv[m] > xs) { xs = xv[m]; xm = m; }
      paras[i] = {hits, localMood: MOODS[dec.mood[i]], confidence: r2(dec.conf[i]), neutral: !!dec.neutral[i], n: a.n, len: text.length,
        xm: xs >= 2 ? MOODS[xm] : null, top: MOODS[Core.topMood(a.v)], strength: r2(a.v[Core.topMood(a.v)])};
    }
    return {paras, lang, ms: Math.round((nowMs() - t0) * 10) / 10};
  }
  const nowMs = () => (root.performance && root.performance.now ? root.performance.now() : Date.now());

  /* ---------- Kitap başına önbellek (bellek + localStorage özeti) ---------- */
  function signature(paragraphs) {
    let h = 2166136261;
    const step = Math.max(1, Math.floor(paragraphs.length / 64));
    const feed = s => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } };
    feed(String(paragraphs.length));
    for (let i = 0; i < paragraphs.length; i += step) { const p = String(paragraphs[i] || ''); feed(p.length + p.slice(0, 40) + p.slice(-40)); }
    return (h >>> 0).toString(36);
  }
  const memo = new Map();
  const LS = 'sa:kw:';
  function scanBook(paragraphs, lang) {
    const sig = 'v1' + lang + signature(paragraphs);
    if (memo.has(sig)) return memo.get(sig);
    const r = scan(paragraphs, lang);
    r.sig = sig;
    memo.set(sig, r); if (memo.size > 4) memo.delete(memo.keys().next().value);
    try {   // yalnızca küçük özet (yerel duygu/güven); tam isabetler gerektiğinde yeniden taranır
      const ls = root.localStorage;
      if (ls) ls.setItem(LS + sig, JSON.stringify({t: Date.now(), m: r.paras.map(p => MOODS.indexOf(p.localMood) + '' + Math.round(p.confidence * 9)).join('')}));
    } catch (_) { /* kota / gizli kip */ }
    return r;
  }
  function cachedSummary(paragraphs, lang) {
    try { const v = JSON.parse(root.localStorage.getItem(LS + 'v1' + lang + signature(paragraphs))); return v ? v.m : null; } catch (_) { return null; }
  }

  /* ---------- Seçim politikası ----------
     select(sc, start, end, o) → {send:[{p, lines:[{id, s, kw}]}], local:[p], inherit:[p], chars, tokens}
     - kısa (<40 harf) ya da hiç isabet yok → komşudan devral (0 jeton)
     - güven ≥ conf ve sınır adayı değil ve ek sözlük çelişmiyor → yerel (0 jeton)
     - kalan (belirsiz/sınır) → en çok 1 (sınırda 2) isabetli cümle, ≤220 harf; istek başına üst sınır capTokens */
  // maxSendFrac: pencere paragraflarının en çok %30'u gider (öncelik sırasıyla); minPri: sınır olmayan adaylarda yalnızca gerçekten
  // belirsiz olanlar (güven < 0.30 ya da ek sözlük çelişkisi) gider. 18 kitapta: tasarruf %74.0 → %76.3, en düşük kitap (Drakula) %72.6,
  // gönderilmeyenlerde uyum %89.4 → %89.5. Aynı/neredeyse aynı cümle bir pencerede yalnızca bir kez gider.
  const OPT = {conf: 0.42, maxLen: 220, capTokens: 2500, minChars: 40, maxSendFrac: 0.3, minPri: 0.7};
  const trim = (s, n) => { s = s.replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
  function lineOf(p, h, maxLen) { return 'p' + p + '.' + h.idx + '|' + trim(h.s, maxLen).replace(/\|/g, '/') + '|k:' + h.kw.slice(0, 2).join(','); }
  function select(sc, start, end, o) {
    o = Object.assign({}, OPT, o || {});
    const P = sc.paras, send = [], local = [], inherit = [];
    let chars = 0;
    const cand = [];
    for (let p = start; p < end; p++) {
      const x = P[p]; if (!x) continue;
      if (x.len < o.minChars || !x.hits.length) { inherit.push(p); continue; }
      const prev = P[p - 1], next = P[p + 1];
      const boundary = !!(prev && prev.localMood !== x.localMood) || !!(next && next.localMood !== x.localMood && x.hits.some(h => h.cue));
      const clash = !!(x.xm && x.xm !== x.localMood && x.xm !== x.top);
      if ((x.confidence >= o.conf || x.neutral) && !boundary && !clash) { local.push(p); continue; }   // nötr: sahnenin süren havası
      // öncelik: sınır > çelişki > düşük güven; aynı grupta güveni düşük olan önce
      cand.push({p, pri: (boundary ? 2 : 0) + (clash ? 1 : 0) + (1 - x.confidence), boundary});
    }
    cand.sort((a, b) => b.pri - a.pri);
    const budget = o.capTokens * 4 - (o.overhead || 700);
    const maxSend = o.maxSendFrac ? Math.max(1, Math.ceil((end - start) * o.maxSendFrac)) : Infinity;   // pencere başına üst sınır
    const chosen = new Set(), seenS = new Set();
    const norm = s => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 90);
    for (const c of cand) {
      const x = P[c.p];
      // aynı (ya da neredeyse aynı) cümle bu pencerede zaten gittiyse yeniden gönderme
      const hs = x.hits.filter(h => !seenS.has(norm(h.s))).sort((a, b) => b.sc - a.sc || a.idx - b.idx).slice(0, c.boundary ? 2 : 1).sort((a, b) => a.idx - b.idx);
      if (!hs.length || send.length >= maxSend || (!c.boundary && c.pri < o.minPri)) { local.push(c.p); continue; }
      const lines = hs.map(h => ({id: 'p' + c.p + '.' + h.idx, s: lineOf(c.p, h, o.maxLen), kw: h.kw}));
      const len = lines.reduce((a, l) => a + l.s.length + 1, 0);
      if (chars + len > budget) { local.push(c.p); continue; }   // bütçe doldu: yerel karar
      for (const h of hs) seenS.add(norm(h.s));
      chars += len; chosen.add(c.p); send.push({p: c.p, lines});
    }
    send.sort((a, b) => a.p - b.p); local.sort((a, b) => a - b);
    return {send, local, inherit, chars, tokens: Math.ceil(chars / 4), sentences: send.reduce((a, s) => a + s.lines.length, 0)};
  }

  /* resolve(sc, start, end, sel, answers) → [{p, mood, intensity, via}] for start..end
     answers: Map p → {mood, intensity}. via: 'gemini' | 'yerel' | 'komşu' */
  function resolve(sc, start, end, sel, answers) {
    const P = sc.paras, out = new Array(end - start).fill(null);
    const inh = new Set(sel.inherit);
    for (let p = start; p < end; p++) {
      if (inh.has(p)) continue;
      const a = answers && answers.get(p);
      if (a && MOODS.includes(a.mood)) out[p - start] = {p, mood: a.mood, intensity: a.intensity, via: 'gemini'};
      else if (P[p]) out[p - start] = {p, mood: P[p].localMood, intensity: null, via: 'yerel'};
    }
    // Devralma: önce önceki (aynı sahnede kalır), yoksa sonraki çözülmüş paragraf; hiç yoksa yerel karar
    let last = null;
    for (let k = 0; k < out.length; k++) {
      if (out[k]) { last = out[k]; continue; }
      const p = start + k;
      let src = last;
      if (!src) for (let j = k + 1; j < out.length && !src; j++) if (out[j]) src = out[j];
      out[k] = src ? {p, mood: src.mood, intensity: src.intensity, via: 'komşu'} : {p, mood: P[p] ? P[p].localMood : 'huzur', intensity: null, via: 'komşu'};
    }
    return out;
  }

  /* Gemini isteği (cümle kipi): kısa sistem istemi, satır biçimi p<paragraf>.<cümle>|<cümle>|k:<sözcükler> */
  const SYSTEM = 'Pick background-music mood per paragraph id from its key sentence(s). Moods: huzur=calm, huzun=sad, gerilim=tension/action, karanlik=dark/horror, nese=joy/humour, ask=love, macera=adventure, gizem=mystery. intensity 0-1. One item per p (the number after "p"). k: are hint words only.';
  const SCHEMA = {type: 'OBJECT', required: ['items'], properties: {items: {type: 'ARRAY', items: {type: 'OBJECT', required: ['p', 'mood', 'intensity'],
    properties: {p: {type: 'INTEGER'}, mood: {type: 'STRING', enum: MOODS}, intensity: {type: 'NUMBER'}}}}}};
  function promptText(book, sel, ctxMood) {
    return 'Book "' + String(book.title || 'Untitled').slice(0, 60) + '" (' + (book.lang || 'en') + ')' + (ctxMood ? ', prior mood ' + ctxMood : '') + ':\n' +
      sel.send.map(s => s.lines.map(l => l.s).join('\n')).join('\n');
  }
  // Seçimi istek başına üst sınıra göre parçala
  function chunks(sel, capTokens) {
    const cap = (capTokens || OPT.capTokens) * 4 - SYSTEM.length - 120, out = [];
    let cur = [], len = 0;
    for (const s of sel.send) {
      const l = s.lines.reduce((a, x) => a + x.s.length + 1, 0);
      if (cur.length && len + l > cap) { out.push(cur); cur = []; len = 0; }
      cur.push(s); len += l;
    }
    if (cur.length) out.push(cur);
    return out.map(send => ({send, sentences: send.reduce((a, s) => a + s.lines.length, 0)}));
  }
  function parseAnswers(obj, ids) {
    const want = new Set(ids), out = new Map();
    const arr = Array.isArray(obj) ? obj : obj && Array.isArray(obj.items) ? obj.items : [];
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue;
      const p = typeof x.p === 'string' ? parseInt(x.p.replace(/^p/, ''), 10) : x.p;
      if (!Number.isInteger(p) || !want.has(p) || out.has(p) || !MOODS.includes(x.mood)) continue;
      let it = Number(x.intensity); if (!isFinite(it)) it = null; else { if (it > 1 && it <= 10) it /= 10; it = Math.max(0, Math.min(1, it)); }
      out.set(p, {mood: x.mood, intensity: it});
    }
    return out;
  }
  const estTokens = s => Math.ceil(String(s || '').length / 4);

  const api = {MOODS, EXTRA, CUES, OPT, SYSTEM, SCHEMA, splitSentences, scan, scanBook, cachedSummary, select, resolve, promptText, chunks, parseAnswers, estTokens, signature, extraHits};
  root.SA_Keywords = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
