/* Satır Arası — çekirdek. DOM'a dokunmaz; tarayıcıda window.Core, Node'da module.exports. */
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C; else root.Core = C;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const MOODS = ['huzur', 'huzun', 'gerilim', 'karanlik', 'nese', 'ask', 'macera', 'gizem'];
const INFO = {
  huzur:   {ad: 'Huzur',    tur: 'sakin anlatı'},
  huzun:   {ad: 'Hüzün',    tur: 'dram'},
  gerilim: {ad: 'Gerilim',  tur: 'gerilim'},
  karanlik:{ad: 'Karanlık', tur: 'gotik / korku'},
  nese:    {ad: 'Neşe',     tur: 'neşeli anlatı'},
  ask:     {ad: 'Aşk',      tur: 'aşk romanı'},
  macera:  {ad: 'Macera',   tur: 'macera'},
  gizem:   {ad: 'Gizem',    tur: 'gizem / polisiye'}
};
const AMBS = ['rain', 'wind', 'sea'];
const AMB_AD = {rain: 'yağmur', wind: 'rüzgâr', sea: 'dalga'};

/* ---------- Dil ---------- */
const TR_STOP = new Set('ve bir bu da de için ile ama gibi çok daha ne o ben sen biz mi mı mu mü ki her şey kadar sonra önce diye en ya hem ise olan olarak var yok değil bana ona onu beni seni bunu şu onun ben bir de ki ya veya fakat çünkü eğer bile hiç böyle şöyle öyle artık yine hep hem'.split(' '));
const EN_STOP = new Set('the and of to a in was he she it that his her with as had for at on is but not you i they be by this from were which have an so me my him said all there when what would their one no we been or if are them then into out up could did do than its who now'.split(' '));
/* Dil tanıma (sürüm LANG_V; eski sürümle saklanan kitap dili açılışta yeniden tanınır).
   Kitabın baştan sona yayılmış örneklerinde TR/EN durak sözcükleri + ekler + Türkçe harfler puanlanır;
   harfleri ASCII'ye indirilmiş ("cok guzel") ve bozuk kodlanmış ("Ã§ok gÃ¼zel") Türkçe de tanınır.
   Kanıt belirsizse opts.hint (dosya üst verisi), o da yoksa opts.fallback (arayüz Türkçe → 'tr'). */
const LANG_V = 2;
const MOJI = {'Ã§': 'ç', 'Ã‡': 'Ç', 'Ä±': 'ı', 'Ä°': 'İ', 'ÄŸ': 'ğ', 'Äž': 'Ğ', 'Ã¶': 'ö', 'Ã–': 'Ö', 'Ã¼': 'ü', 'Ãœ': 'Ü',
  'ÅŸ': 'ş', 'Åž': 'Ş', 'Ã¢': 'â', 'Ã®': 'î', 'Ã»': 'û', 'Ã©': 'é', 'â€™': '’', 'â€œ': '“', 'â€': '”', 'Ã‚': 'Â',
  // Latin-1 okumasında 0x80–0x9F denetim karakteri olarak kalanlar
  'Ã\u0087': 'Ç', 'Ã\u0096': 'Ö', 'Ã\u009c': 'Ü', 'Ä\u009f': 'ğ', 'Ä\u009e': 'Ğ', 'Å\u009f': 'ş', 'Å\u009e': 'Ş', 'Ã\u0082': 'Â'};
const MOJI_RE = new RegExp(Object.keys(MOJI).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
// UTF-8 metnin Latin-1/1252/1254 diye okunmasıyla oluşan bozukluğu onarır (yalnızca belirgin bozukluk varsa)
function repairMojibake(s) {
  const n = (s.match(/Ã[§‡¶–¼œ¢®»©\u0087\u0096\u009c]|Ä[±°Ÿž\u009e\u009f]|Å[Ÿž\u009e\u009f]/g) || []).length;
  return n >= 3 && n * 400 >= Math.min(s.length, 200000) / 50 ? s.replace(MOJI_RE, m => MOJI[m]) : s;
}
const foldTr = s => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/̇/g, '')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[âà]/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
const TR_FOLD = new Set([...TR_STOP].map(foldTr).concat('simdi kendi icinde gore bile oldu olur oldugu gene biraz hala sanki nasil neden niye cunku hepsi baska bizim sizin onlar bunlar seyler mi degilim yani tamam evet hayir'.split(' ')));
const EN_FOLD = new Set([...EN_STOP].filter(w => !TR_FOLD.has(w)).concat('your what about will just know like very been more some only over such these those should because'.split(' ')));
const LTR_SUF = /(iyor|iyordu|uyor|uyordu|yordu|yorum|yorsun|miyor|misti|mistir|mustu|mis|mus|acak|ecek|acagim|ecegim|mak|mek|maya|meye|madan|meden|larin|lerin|lari|leri|lar|ler|ndan|nden|inda|inde|siz|suz|sizlik|lik|luk|dir|dur|tir|tur|digi|dugu|tigi|dim|dik|tim|tik|sin|sun|yla|yle)$/;
const LEN_SUF = /(ing|tion|sion|ed|ly|ness|ment|ould|ight|ful|less|ous)$/;
function langScore(s) {
  s = repairMojibake(s);
  let tr = Math.min(40, (s.match(/[ğşıİĞŞ]/g) || []).length * 0.6 + (s.match(/[çöüÇÖÜ]/g) || []).length * 0.25), en = 0;
  const ws = foldTr(s).match(/[a-z]+/g) || [];
  for (const w of ws) {
    if (TR_FOLD.has(w)) tr++; else if (EN_FOLD.has(w)) en++;
    else if (w.length >= 5) { if (LTR_SUF.test(w)) tr += 0.4; else if (LEN_SUF.test(w)) en += 0.4; }
    if (/^(th|wh)/.test(w) || /(ck|ght|oo|ee)/.test(w)) en += 0.15;   // İngilizce harf öbekleri
  }
  return {tr, en, n: ws.length};
}
// Metinden (ya da paragraf dizisinden) baş/orta/son'a yayılmış örnekler; kısa satırlar (başlık, künye) atlanır
function langSamples(text, k, size) {
  const lines = (Array.isArray(text) ? text : String(text || '').split(/\n+/)).map(x => String(x).trim()).filter(x => x.length >= 40);
  const out = [];
  if (lines.length >= k * 2) {
    for (let j = 0; j < k; j++) {
      let i = Math.floor((j + 0.5) * lines.length / k), s = '';
      while (i < lines.length && s.length < size) s += lines[i++] + '\n';
      out.push(s);
    }
  } else {
    const s = lines.length ? lines.join('\n') : String(Array.isArray(text) ? text.join('\n') : text || '');
    const step = Math.max(size, Math.floor(s.length / k));
    for (let p = 0; p < s.length && out.length < k; p += step) out.push(s.slice(p, p + size));
  }
  return out;
}
function detectLangInfo(text, opts) {
  opts = opts || {};
  const fb = opts.fallback === 'en' ? 'en' : 'tr', hint = opts.hint === 'en' || opts.hint === 'tr' ? opts.hint : '';
  let votes = 0, TR = 0, EN = 0;
  for (const smp of langSamples(text, opts.samples || 9, opts.size || 2500)) {
    const r = langScore(smp), t = r.tr + r.en; if (t < 4) continue;
    TR += r.tr; EN += r.en; votes += (r.tr - r.en) / t;   // örnek başına -1..1 oy: tek bir İngilizce künye sayfası kitabı çeviremez
  }
  const tot = TR + EN, share = tot ? TR / tot : 0.5;
  let lang, sure;
  if (tot < 6) { lang = hint || fb; sure = false; }
  else if (votes > 0.5 && share > 0.4) { lang = 'tr'; sure = share > 0.55; }
  else if (votes < -0.5 && share < 0.6) { lang = 'en'; sure = share < 0.45; }
  else { lang = hint || fb; sure = false; }
  if (!sure && hint && lang !== hint && Math.abs(share - 0.5) < 0.15) lang = hint;
  return {lang, sure, share, votes};
}
function detectLang(text, opts) { return detectLangInfo(text, opts).lang; }
function lower(s, lang) {
  s = lang === 'tr' ? s.toLocaleLowerCase('tr') : s.toLowerCase();
  return s.replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u').replace(/i̇/g, 'i');
}

/* ---------- Sözlük ----------
   "kök" = önek eşleşir (TR: kök ≥ 4 harf, ek ≤ 9 harf; EN: kök + bilinen ek).
   "=kelime" = yalnızca tam eşleşme. ":n" = ağırlık. */
const LEX = {
  tr: {
    huzur: 'sakin:2 huzur:3 sessiz dingin:2 sükun:2 yavaşça hafif ılık uyku uyudu uyuyor dinlen yumuşa bahçe =çay =sabah esinti serin tatlı güneş ninni:2 rahatla:2 =huzurlu:3',
    huzun: 'hüzün:3 üzgün:2 üzül:2 üzünt:2 ağla:2 ağlıyor:2 gözyaş:3 yalnız:2 özle:2 özlem:2 kayıp kaybet veda:2 keder:3 mezar =yas =yasa:0 ölüm:2 öldü ölmüş hasret:2 =elem yorgun boşluk pişman:2 hıçkır:3 cenaze:3 tabut:2 yetim:2 gurbet:2 matem:3 ayrılı:2 sızla mutsuz:3 umutsuz:3 çaresiz:2',
    gerilim: 'gergin:2 gerili:2 tehlike:3 koştu koşar koşmaya koşuyor aniden:2 birden çığlı:3 bağır:2 silah:2 bıçak:2 tabanca:2 takip panik:3 acele tehdit:3 kavga:2 vurdu saldır:3 kaçtı kaçmak kaçıyor kaçmal kovala:2 =pusu:2 =pusuya:2 =pusuda:2 tetik:2 saklan huzursuz:3 telaş:2 endişe:2 kaygı:2 ürkü heyecan patla:2 çarpıyor zorlu',
    karanlik: 'karanlı:3 korku:3 kork:2 dehşet:3 ürper:3 kanlı:2 ceset:3 hayalet:3 kabus:3 lanet:2 şeytan:2 mezarlık:3 titre uğursuz:3 iblis:2 canavar:2 çürü:2 hortlak:3 karabasan:3 öldür:2 =ölü ölüler vahşet:3 ürkünç:3 tekinsiz:3 zifiri:3 gölge',
    nese: 'güldü:2 gülüyor:2 gülüm:2 gülüş:2 gülerek:2 güler kahkaha:3 neşe:3 mutlu:3 sevin:2 =şaka:2 şakası:2 şakala:2 eğlen:2 bayram:2 =dans dansed şarkı =oyun keyif:2 şenlik:3 kıkırda:2 düğün:2 alkış:2',
    ask: '=aşk:3 =aşkı:3 =aşkın:3 =aşka:3 =aşkla:3 =aşktan:3 aşık:3 sevgi:2 sevda:3 sevdi:2 seviyor:2 sevgili:3 öptü:3 öpüc:3 öpüş:3 =kalp:0.5 kalbi:0.5 sarıl:2 yanak bakış tutku:3 kavuş:2 =güzel:0.5 şefkat:2 okşa:2 gönül:2 sevmek',
    macera: 'savaş:2 kılıç:2 =ordu ordular zafer:2 yolculu:2 =sefer kahraman:3 cesur:2 cesaret:2 düşman:2 =kale =kaleye =kalenin =kalesi =kaleyi =gemi gemiy gemin gemici gemile yelken:2 keşfe:2 keşif:2 macera:3 hücum:2 harita:2 dümen:2 dörtnala:3 kervan:2 serüven:3 fetih:2',
    gizem: 'gizem:3 sırr:2 sırlar:2 =sır:2 esrar:3 tuhaf:2 garip:2 acayip:2 merak:2 ipucu:3 şüphe:2 fısıl:2 gizli:2 bilinme:2 anahtar mektup =sis =sisin =sisli =sisi =siste =sisten mühür dedektif:3 cinayet:3 şifre:2 muamma:3 kayboldu:2'
  },
  en: {
    huzur: 'calm:2 quiet peace:3 peaceful:3 gentle gently soft tranquil:3 serene:3 sleep slept rest warm morning garden breeze lullaby:2 placid:2 meadow pleasant comfort:2 comfortable cosy:2 cozy:2 contented:2 content:0.5 sunshine:2 sunny drowsy:2 dreamy:2 picnic:2 river:0.5 stroll:2 smooth hush:2 idle',
    huzun: 'sad:2 sadness:3 sorrow:3 grief:3 griev:2 tear wept:2 weep:2 cry cried crying lonely:2 loneliness:3 alone mourn:3 loss farewell:2 regret:2 melancholy:3 died death:2 sob:2 sobbed:2 sobbing:2 coffin:2 sigh funeral:3 misery:2 despair:3 mournful:3 weeping:2 tears:2 wretched:2 unhappy:2 sorrowful:3 heartbroken:3 forlorn:3 desolate:3 grieved:2 widow:2 orphan:2 lament:3 pity:2 miserable:2 gloomy:2 dying:2 buried:2 parting:2',
    gerilim: 'danger:3 sudden:2 scream:3 shout:2 gun knife:2 chase:2 chased:2 chasing:2 panic:3 threat:3 attack:3 hurry hurried fled:2 escape:2 escaped:2 ambush:3 gasp:2 pursue:2 pursued:2 pursuit:2 tense:2 anxious:2 alarm:2 trembled trembling struggle:2 seized:2 rushed:2 terrible:2 violent:2 fury:2 furious:2 rage:2 harpoon:2 pistol:2 cutlass:2 musket:2 fight:2 fought:2 blow:0.5 desperate:2 frantic:3 breathless:2 alarmed:2 dreadful:2 shot:2 fired:0.5',
    karanlik: 'dark:2 darkness:3 fear:3 afraid:3 terror:3 terrified:3 horror:3 horrible:2 blood:2 corpse:3 ghost:3 nightmare:3 curse:2 cursed:2 dread:3 shadow grave eerie:3 haunt:3 shriek:3 monster:2 demon:2 evil:2 rotting:2 gloom:2 vampire:3 undead:3 wolves:2 howl:2 howling:3 coffin:2 tomb:3 crypt:3 sinister:3 hideous:3 ghastly:3 grim:2 fiend:3 wretch:2 creature:2 madness:3 insane:2 lunatic:2 bat:0.5 midnight:2 skull:2 gothic:2 horrid:2 loathsome:3 deformed:2 wallpaper:1',
    nese: 'laugh:2 laughter:3 smile:2 smiled:2 smiling:2 joy:3 happy:3 happily:3 happiness:3 cheer:2 delight:3 merry:3 dance danced dancing giggle:2 giggled:2 grin:2 grinned:2 glad:2 =fun jolly:3 cheerful:3 cheerfully:3 amused:2 amusing:2 amusement:2 funny:2 playful:2 frolic:3 hooray:3 hurrah:3 joke:2 jest:2 chuckle:2 chuckled:2 beam:0.5 beamed:2 gay:0.5 nonsense:1 silly:2',
    ask: 'love:3 loved:3 loving:2 lover:3 kiss:3 heart:0.5 embrace:2 embraced:2 beloved:3 darling:3 passion:3 tender:2 adore:3 adored:3 caress:3 romance:3 romantic:3 sweetheart:3 marry:2 married:2 marriage:2 affection:3 devoted:2 admire:2 admiration:2 courtship:3 proposal:2 propose:2 suitor:3 engaged:1 attachment:2 tenderness:3 cherish:3 sweet:0.5 fond:2 handsome:1 charming:2 blush:2 blushed:2',
    macera: 'battle:3 sword:2 army:2 victory:3 hero:3 heroes:3 brave:2 bravely:2 enemy:2 enemies:2 castle:2 voyage:3 quest:3 adventure:3 journey:2 gallop:2 expedition:3 sail sailed sailing ship explore:2 explored:2 treasure:2 island:2 pirate:3 pirates:3 buccaneer:3 captain:1 crew:1 mast:2 deck:1 whale:2 whaling:3 harpooneer:2 schooner:3 maroon:2 marooned:3 cave:1 adventurer:3 explorer:3 daring:2 bold:1 fierce:1 lagoon:2 mermaid:2 hunt:2',
    gizem: 'mystery:3 mysterious:3 secret:2 strange:2 strangely:2 curious:2 clue:3 suspect:2 suspicion:2 whisper:2 hidden:2 unknown:2 puzzle:2 fog foggy detective:3 murder:3 riddle:3 vanished:2 disappear:2 inspector:3 crime:3 criminal:2 deduce:3 deduction:3 investigate:3 investigation:3 evidence:2 problem:1 baffled:3 inexplicable:3 peculiar:2 singular:2 enigma:3 cipher:3 queer:1 odd:1 wonder:1 wondered:1 puzzled:2 disguise:2 doubt:1'
  }
};
const AMB_LEX = {
  tr: {rain: 'yağmur sağanak çisele çisen', wind: 'rüzgar fırtına =tipi', sea: 'deniz dalga =sahil sahild sahile =kıyı kıyıya kıyıda okyanus'},
  en: {rain: 'rain rainy raining drizzle downpour', wind: 'wind windy gale storm stormy', sea: '=sea =seas wave waves shore ocean tide'}
};
const EN_SUF = new Set(['', 's', 'es', 'ed', 'd', 'ing', 'ly', 'y', 'ful', 'fully', 'ness', 'ous', 'er', 'est', 'ish', 'en', 'ened', 'ier', 'ily', 'less', 'lessly']);
const NEG_TR = /^.{0,2}?(m[ae](d[ıi]|z|m[ıi]ş|y[ae]c|s[ıi]n|d[ae]n)|m[ıiuü]yor|s[ıiuü]z)/;
const NEG_EN = new Set(['not', 'no', 'never', 'without', 'hardly', 'neither', 'nor', 'cannot']);
const INTENS = new Set(['çok', 'pek', 'büsbütün', 'fazlasıyla', 'müthiş', 'very', 'utterly', 'terribly', 'extremely', 'deeply']);
const DIMIN = new Set(['biraz', 'hafifçe', 'azıcık', 'slightly', 'somewhat', 'little']);

function buildIndex(table, tags) {
  const idx = new Map();
  for (const tag of tags) for (const raw of table[tag].split(' ')) {
    let s = raw, w = 1, exact = false;
    const c = s.indexOf(':'); if (c > 0) { w = +s.slice(c + 1); s = s.slice(0, c); }
    if (s[0] === '=') { exact = true; s = s.slice(1); }
    if (s.length < 4) exact = exact || s.length < 3;
    const k = s.slice(0, 3);
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push({s, tag, w, exact});
  }
  for (const l of idx.values()) l.sort((a, b) => b.s.length - a.s.length);
  return idx;
}
const IDX = {tr: buildIndex(LEX.tr, MOODS), en: buildIndex(LEX.en, MOODS)};
const AIDX = {tr: buildIndex(AMB_LEX.tr, AMBS), en: buildIndex(AMB_LEX.en, AMBS)};

/* En uzun eşleşen kökü döndürür. */
function matchStem(w, lang, idx) {
  const l = (idx || IDX[lang]).get(w.slice(0, 3)); if (!l) return null;
  for (const e of l) {
    if (w === e.s) return {tag: e.tag, w: e.w, len: e.s.length, less: false};
    if (e.exact || !w.startsWith(e.s)) continue;
    const rest = w.slice(e.s.length);
    if (lang === 'tr') { if (e.s.length >= 4 && rest.length <= 9) return {tag: e.tag, w: e.w, len: e.s.length, less: false}; }
    else if (EN_SUF.has(rest)) return {tag: e.tag, w: e.w, len: e.s.length, less: rest.startsWith('less')};
  }
  return null;
}

const TOK = /[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû0-9]+(?:'[A-Za-zÇĞİÖŞÜçğıöşüâîû]+)?|[.,;:!?…]/g;
function tokenize(text, lang) {
  const out = []; let m, start = true;
  TOK.lastIndex = 0;
  const src = text.replace(/[’‘`´]/g, "'");
  while ((m = TOK.exec(src))) {
    const raw = m[0];
    if (/^[.,;:!?…]$/.test(raw)) { out.push({p: raw}); if (raw !== ',' && raw !== ';' && raw !== ':') start = true; continue; }
    let w = lower(raw, lang), nt = false;
    const a = w.indexOf("'");
    if (a > 0) { if (lang === 'en' && w.endsWith("n't")) nt = true; w = w.slice(0, a); }
    out.push({w, nt, cap: raw[0] !== raw[0].toLowerCase() && !start, i: m.index, len: raw.length});
    start = false;
  }
  return out;
}

/* Bir paragrafın duygu vektörü, ortam sesleri ve ipucu kelimeleri. */
function analyze(text, lang) {
  lang = lang || detectLang(text);
  const v = new Float32Array(8), amb = [0, 0, 0], cues = [];
  const toks = tokenize(text, lang);
  let n = 0, ex = 0, q = 0, lastNeg = -99, mult = 1, last = null;
  for (const t of toks) {
    if (t.p) { if (t.p === '!') ex++; else if (t.p === '?') q++; lastNeg = -99; mult = 1; continue; }
    n++;
    const w = t.w;
    if (lang === 'en' && (t.nt || NEG_EN.has(w))) { lastNeg = n; continue; }
    if (lang === 'tr' && (w.startsWith('değil') || w === 'yok' || w === 'yoktu')) {
      if (last && n - last.n <= 2 && !last.neg) { v[last.mi] -= 1.5 * last.c; last.neg = true; last.cue.neg = true; }
      continue;
    }
    if (INTENS.has(w)) { mult = 1.5; continue; }
    if (DIMIN.has(w)) { mult = 0.6; continue; }
    if (w.length >= 3) {
      const h = matchStem(w, lang);
      if (h && h.w > 0) {
        const neg = lang === 'tr' ? NEG_TR.test(w.slice(h.len)) : (n - lastNeg <= 3 || h.less);
        const c = h.w * mult, mi = MOODS.indexOf(h.tag);
        v[mi] += neg ? -0.5 * c : c;
        const cue = {w, m: h.tag, neg, i: t.i, len: t.len};
        cues.push(cue); last = {n, mi, c, neg, cue};
      }
      if (!t.cap) { const a = matchStem(w, lang, AIDX[lang]); if (a) amb[AMBS.indexOf(a.tag)]++; }
    }
    mult = 1;
  }
  const k = Math.sqrt(Math.max(n, 10));
  for (let i = 0; i < 8; i++) v[i] = Math.max(0, v[i]) / k;
  v[2] += Math.min(0.12, 0.04 * ex);
  v[7] += Math.min(0.12, 0.04 * q);
  return {v, amb, n, cues};
}
function topMood(v) { let b = 0; for (let i = 1; i < 8; i++) if (v[i] > v[b]) b = i; return b; }

/* ---------- Sahne çözümleme: çekirdek yumuşatma + tek histerezis + nötr durum ---------- */
const NEUTRAL = 0.2, KERN = [0.15, 0.4, 1, 0.4, 0.15];
function decode(items) {             // items: [{v, n, amb, brk}]
  const N = items.length, S = new Array(N);
  const prof = new Float32Array(8);
  for (const it of items) for (let m = 0; m < 8; m++) prof[m] += it.v[m] * Math.sqrt(it.n || 1);
  let tot = 0; for (let m = 0; m < 8; m++) tot += prof[m];
  if (tot > 0) for (let m = 0; m < 8; m++) prof[m] /= tot;
  const dominant = topMood(prof);
  for (let i = 0; i < N; i++) {
    const s = new Float32Array(8); let ws = 0;
    for (let d = -2; d <= 2; d++) {
      const j = i + d; if (j < 0 || j >= N) continue;
      let cut = false;                                    // bölüm başlığını aşma
      if (d < 0) { for (let x = j + 1; x <= i; x++) if (items[x].brk) cut = true; }
      else if (d > 0) { for (let x = i + 1; x <= j; x++) if (items[x].brk) cut = true; }
      if (cut) continue;
      const wt = KERN[d + 2] * (d === 0 ? 1 : Math.min(1, items[j].n / 20 + 0.2));
      for (let m = 0; m < 8; m++) s[m] += wt * items[j].v[m];
      ws += wt;
    }
    for (let m = 0; m < 8; m++) s[m] = s[m] / ws + 0.02 * prof[m];
    S[i] = s;
  }
  const mood = new Uint8Array(N), neutral = new Uint8Array(N), inten = new Float32Array(N), conf = new Float32Array(N), amb = new Int8Array(N);
  let cur = -1;
  for (let i = 0; i < N; i++) {
    const s = S[i], top = topMood(s);
    if (items[i].brk) cur = -1;
    let second = 0; for (let m = 0; m < 8; m++) if (m !== top && s[m] > second) second = s[m];
    if (s[top] < NEUTRAL) {
      neutral[i] = 1; mood[i] = cur >= 0 ? cur : dominant; inten[i] = 0.2; conf[i] = 0.1;
    } else {
      if (cur < 0 || top === cur) cur = top;
      else if (s[top] >= 1.5 * s[cur] || (topMood(items[i].v) === top && items[i].v[top] >= 1.5 * NEUTRAL) || (i + 1 < N && !items[i + 1].brk && topMood(S[i + 1]) === top)) cur = top;
      mood[i] = cur;
      inten[i] = Math.min(1, 0.25 + s[cur] * 0.7);
      conf[i] = Math.min(1, (s[top] - second) / s[top]) * Math.min(1, s[top] / 0.6);
    }
    let a = -1, av = 0.99;
    for (let k = 0; k < 3; k++) { const x = items[i].amb[k] + (i > 0 && !items[i].brk ? 0.5 * items[i - 1].amb[k] : 0); if (x > av) { av = x; a = k; } }
    amb[i] = a;
  }
  // Ada yumuşatma: aynı duygulu iki komşu arasında kalan ≤2 paragraflık zayıf ada (bölüm sınırı yoksa) komşu duyguya katılır
  for (let i = 1; i < N - 1; i++) {
    if (mood[i] === mood[i - 1] || items[i].brk) continue;
    let j = i; while (j < N && mood[j] === mood[i] && !(j > i && items[j].brk)) j++;
    if (j < N && j - i <= 2 && mood[j] === mood[i - 1] && !items[j].brk) {
      let weak = true; for (let k = i; k < j; k++) if (conf[k] > 0.5 && items[k].n >= 25) weak = false;
      if (weak) for (let k = i; k < j; k++) { mood[k] = mood[i - 1]; inten[k] = Math.min(inten[k], inten[i - 1]); }
    }
    i = j - 1;
  }
  return {mood, neutral, inten, conf, amb, dominant, profile: prof};
}

/* ---------- Metin ayrıştırma ve kitap tanıma ---------- */
function parseGutenberg(raw) {
  const out = {title: '', author: '', lang: '', body: raw};
  const head = raw.slice(0, 6000);
  if (!/project gutenberg/i.test(head)) return out;
  const g = re => { const m = head.match(re); return m ? m[1].trim() : ''; };
  out.title = g(/^Title:\s*(.+)$/m); out.author = g(/^Author:\s*(.+)$/m);
  const l = g(/^Language:\s*(.+)$/m).toLowerCase();
  out.lang = l.startsWith('turk') ? 'tr' : l.startsWith('eng') ? 'en' : '';
  const s = raw.search(/\*\*\*\s*START OF.*?\*\*\*/i), e = raw.search(/\*\*\*\s*END OF/i);
  if (s >= 0) { const after = raw.indexOf('\n', s); out.body = raw.slice(after + 1, e > s ? e : undefined); }
  return out;
}
function parseText(raw) {
  raw = raw.replace(/\r\n?/g, '\n');
  let parts = raw.split(/\n\s*\n+/);
  if (raw.length / Math.max(1, parts.length) > 1800) parts = raw.split(/\n+/);
  const blocks = [];
  for (let p of parts) {
    p = p.replace(/\s+/g, ' ').trim(); if (!p) continue;
    const head = p.length < 70 && !/[.!?…:;,”"]$/.test(p) &&
      (/^(bölüm|kısım|chapter|part|kitap|book)\b/i.test(p) || /^[IVXLC\d]+\.?(\s|$)/.test(p) || (p === p.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(p)));
    blocks.push(head ? {h: 1, t: p} : {t: p});
  }
  return blocks;
}
function fromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const m = base.match(/^(.+?)\s+-\s+(.+)$/);
  return m ? {author: m[1].trim(), title: m[2].trim()} : {author: '', title: base};
}
const KNOWN = [
  ['Suç ve Ceza', 'Dostoyevski', ['suç ve ceza', 'crime and punishment'], ['raskolnikov', 'razumihin', 'porfiri', 'sonya', 'svidrigaylov', 'razumikhin', 'porfiry']],
  ['Küçük Prens', 'Saint-Exupéry', ['küçük prens', 'little prince', 'petit prince'], ['baobab', 'asteroid', 'tilki']],
  ['Sherlock Holmes', 'Arthur Conan Doyle', ['sherlock holmes', 'baskerville'], ['holmes', 'watson', 'lestrade', 'moriarty']],
  ['Dracula', 'Bram Stoker', ['dracula', 'drakula'], ['dracula', 'drakula', 'harker', 'helsing', 'mina']],
  ['Frankenstein', 'Mary Shelley', ['frankenstein'], ['frankenstein', 'clerval', 'walton']],
  ['Yüzüklerin Efendisi / Hobbit', 'J.R.R. Tolkien', ['yüzüklerin efendisi', 'lord of the rings', 'hobbit'], ['frodo', 'gandalf', 'bilbo', 'mordor', 'aragorn']],
  ['Harry Potter', 'J.K. Rowling', ['harry potter'], ['hogwarts', 'hermione', 'dumbledore', 'voldemort']],
  ['Aşk ve Gurur', 'Jane Austen', ['aşk ve gurur', 'gurur ve önyargı', 'pride and prejudice'], ['darcy', 'bennet', 'pemberley', 'bingley']],
  ['Sefiller', 'Victor Hugo', ['sefiller', 'les misérables', 'les miserables'], ['valjean', 'javert', 'cosette', 'fantine']],
  ['1984', 'George Orwell', ['1984', 'bin dokuz yüz seksen dört'], ['winston', 'julia', 'okyanusya', 'oceania', "o'brien", 'goldstein']],
  ['Simyacı', 'Paulo Coelho', ['simyacı', 'the alchemist'], ['santiago', 'melkisedek', 'melchizedek', 'fatima']],
  ['Kürk Mantolu Madonna', 'Sabahattin Ali', ['kürk mantolu madonna'], ['raif', 'maria', 'puder']],
  ['Tutunamayanlar', 'Oğuz Atay', ['tutunamayanlar'], ['selim', 'turgut', 'özben', 'süleyman']],
  ['Çalıkuşu', 'Reşat Nuri Güntekin', ['çalıkuşu'], ['feride', 'kamran', 'munise']],
  ['İnce Memed', 'Yaşar Kemal', ['ince memed'], ['memed', 'hatçe', 'abdi']],
  ['Don Kişot', 'Cervantes', ['don kişot', 'don quixote', 'don quijote'], ['sancho', 'rocinante', 'dulcinea', 'quixote']],
  ['Moby Dick', 'Herman Melville', ['moby dick', 'moby-dick'], ['ahab', 'ishmael', 'pequod', 'queequeg', 'starbuck']],
  ['Dönüşüm', 'Franz Kafka', ['dönüşüm', 'the metamorphosis', 'die verwandlung'], ['gregor', 'samsa', 'grete']],
  ['Alice Harikalar Diyarında', 'Lewis Carroll', ['alice harikalar', "alice's adventures", 'alice in wonderland'], ['alice', 'cheshire', 'hatter', 'dinah']],
  ['Uğultulu Tepeler', 'Emily Brontë', ['uğultulu tepeler', 'wuthering heights'], ['heathcliff', 'catherine', 'linton', 'earnshaw']],
  ['Jane Eyre', 'Charlotte Brontë', ['jane eyre'], ['rochester', 'thornfield', 'eyre']],
  ['Monte Kristo Kontu', 'Alexandre Dumas', ['monte kristo', 'monte cristo'], ['dantes', 'dantès', 'villefort', 'danglars', 'mercedes']],
  ['Anna Karenina', 'Tolstoy', ['anna karenina'], ['karenin', 'vronski', 'vronsky', 'levin', 'kitty']],
  ['Hayvan Çiftliği', 'George Orwell', ['hayvan çiftliği', 'animal farm'], ['napoleon', 'snowball', 'boxer', 'squealer']],
  ['Saatleri Ayarlama Enstitüsü', 'Ahmet Hamdi Tanpınar', ['saatleri ayarlama'], ['hayri', 'irdal', 'halit', 'ayarcı']],
  ['Aşk-ı Memnu', 'Halid Ziya Uşaklıgil', ['aşk-ı memnu', 'aşkı memnu'], ['bihter', 'behlül', 'nihal', 'adnan']]
];
function identifyBook(meta, text) {   // meta: {title, author, filename}
  const title = (meta.title || '').trim();
  const tl = lower(title, 'tr');
  for (const [t, a, titles] of KNOWN)
    for (const x of titles) if (x.includes(' ') || x.includes('-') ? tl.includes(x) : tl === x)
      return {title: title || t, author: meta.author || a, known: t, evidence: 'başlıktan tanındı'};
  const body = lower(text.slice(0, 400000), 'tr');
  let best = null;
  for (const [t, a, , names] of KNOWN) {
    const found = [];
    for (const nm of names) {
      let c = 0, at = body.indexOf(nm);
      while (at >= 0 && c < 2) { c++; at = body.indexOf(nm, at + nm.length); }
      if (c >= 2) found.push(nm);
    }
    if (found.length >= 2 && (!best || found.length > best.found.length)) best = {t, a, found};
  }
  if (best) return {title: title || best.t, author: meta.author || best.a, known: best.t,
    evidence: 'adlardan tahmin: ' + best.found.slice(0, 3).map(x => x[0].toLocaleUpperCase('tr') + x.slice(1)).join(', ')};
  return {title: title || 'Adsız metin', author: meta.author || '', known: null, evidence: ''};
}

/* ---------- Sesle takip hizalayıcısı ---------- */
const DIGITS = {'0': 'sıfır', '1': 'bir', '2': 'iki', '3': 'üç', '4': 'dört', '5': 'beş', '6': 'altı', '7': 'yedi', '8': 'sekiz', '9': 'dokuz', '10': 'on'};
function key(w) { return (DIGITS[w] || w).slice(0, 5); }
function wordsOf(text, lang) { return tokenize(text, lang).filter(t => !t.p).map(t => t.w); }

class Aligner {
  constructor(paras, lang) {             // paras: [metin]
    this.lang = lang; this.keys = []; this.para = []; this.start = []; this.wt = [];
    const freq = new Map();
    paras.forEach((t, pi) => {
      this.start.push(this.keys.length);
      for (const w of wordsOf(t, lang)) { const k = key(w); this.keys.push(k); this.para.push(pi); freq.set(k, (freq.get(k) || 0) + 1); }
    });
    this.start.push(this.keys.length);
    const N = this.keys.length, stop = lang === 'tr' ? TR_STOP : EN_STOP, lim = Math.max(3, N * 0.004);
    this.weightOf = k => (k.length < 3 || stop.has(k) || (freq.get(k) || 0) > lim) ? 0 : 1;
    this.cursor = 0; this.recent = []; this.miss = 0; this.done = 0; this.prev = [];
  }
  seek(pi) { this.cursor = this.start[Math.max(0, Math.min(pi, this.start.length - 2))]; this.recent = []; this.miss = 0; }
  get paraIndex() { return this.para[Math.min(this.cursor, this.keys.length - 1)] || 0; }
  get frac() { const p = this.paraIndex, a = this.start[p], b = this.start[p + 1]; return b > a ? (this.cursor - a) / (b - a) : 0; }
  get wordInPara() { return this.cursor - this.start[this.paraIndex]; }

  /* Tanıyıcıdan gelen bir sonucu besler. Ara sonuçlarda son iki kelime kararsız sayılır. */
  feed(transcript, isFinal) {
    const ws = wordsOf(transcript, this.lang);
    let same = 0; while (same < ws.length && same < this.prev.length && ws[same] === this.prev[same]) same++;
    if (same < this.done) this.done = same;            // tanıyıcı eski kelimeleri düzeltti
    const upto = isFinal ? ws.length : Math.max(this.done, ws.length - 2);
    for (let i = this.done; i < upto; i++) this.hear(ws[i]);
    this.done = upto; this.prev = ws;
    if (isFinal) { this.done = 0; this.prev = []; }
    return this.cursor;
  }
  hear(w) {
    const k = key(w), K = this.keys, c = this.cursor, N = K.length;
    if (c >= N) return;
    if (K[c] === k) { this.cursor = c + 1; this.miss = 0; this._push(k); return; }   // sıradaki kelime
    const wt = this.weightOf(k);
    if (!wt) return;                                                            // etkisiz kelime tek başına ilerletmez
    const wide = this.miss >= 8;
    const lo = Math.max(0, c - (wide ? 400 : 10)), hi = Math.min(N, c + (wide ? 400 : 60));
    let best = -1, bestScore = 0;
    for (let p = lo; p < hi; p++) {
      if (K[p] !== k) continue;
      let conf = 0;                                    // önceki duyulanlardan kaçı hemen öncesinde geçiyor
      for (const r of this.recent) { for (let x = Math.max(0, p - 8); x < p; x++) if (K[x] === r) { conf++; break; } }
      const near = p >= c && p <= c + 3;
      const need = wide ? 2 : (p < c ? 2 : near ? 0 : 1);
      if (conf < need) continue;
      const score = conf * 10 + (near ? 5 : 0) - Math.abs(p - c) / 100;
      if (best < 0 || score > bestScore) { best = p; bestScore = score; }
    }
    if (best >= 0) { this.cursor = best + 1; this.miss = 0; } else this.miss++;
    this._push(k);
  }
  _push(k) { if (this.weightOf(k)) { this.recent.push(k); if (this.recent.length > 5) this.recent.shift(); } }
}

/* ---------- Küçük yardımcılar ---------- */
function hashText(s) { let h = 5381; const n = Math.min(s.length, 30000); for (let i = 0; i < n; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }
const NOTE_AD = ['La', 'Si bemol', 'Si', 'Do', 'Do diyez', 'Re'];
function tonicFor(title) { let h = 0; for (const ch of title || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0; const i = h % 6; return {midi: 45 + i, ad: NOTE_AD[i]}; }
function readingLine(frac) { return 0.25 + 0.5 * Math.max(0, Math.min(1, frac)); }
function barcode(mood, lens, k) {     // kitabın duygu şeridi: k haneli dizge
  const N = mood.length; let tot = 0; for (let i = 0; i < N; i++) tot += lens[i];
  let out = '', i = 0, acc = 0;
  for (let b = 0; b < k; b++) {
    const end = tot * (b + 1) / k, cnt = new Float32Array(8);
    while (i < N && acc + lens[i] / 2 <= end) { cnt[mood[i]] += lens[i]; acc += lens[i]; i++; }
    out += cnt.some(x => x > 0) ? topMood(cnt) : (out ? out[out.length - 1] : (N ? mood[0] : 0));
  }
  return out;
}

/* ---------- Sesli okuma: komutlar, sesin enerjisi, kararlı değişim kapısı ---------- */
const VOICE_CMDS = [
  ['next', ['müziği değiştir', 'muziği değiştir', 'müzik değiştir', 'başka müzik', 'başka bir müzik', 'sonraki şarkı', 'next song', 'next track', 'change the music', 'change music', 'another song']],
  ['stop', ['müziği durdur', 'müzik durdur', 'müziği kapat', 'stop music', 'stop the music', 'pause music', 'pause the music']],
  ['play', ['müziği başlat', 'müzik başlat', 'müziği aç', 'play music', 'play the music', 'start music', 'start the music', 'resume music']],
  ['up', ['sesi aç', 'sesi yükselt', 'sesi artır', 'volume up', 'louder', 'turn it up']],
  ['down', ['sesi kıs', 'sesi azalt', 'sesi düşür', 'volume down', 'quieter', 'turn it down']]
];
/* Dökümdeki ilk komutu bulur; komut ifadesi metinden çıkarılır (hizalayıcıya gitmesin). */
function voiceCommand(text) {
  const t = lower(String(text || ''), 'tr').replace(/[.,;:!?…"'“”]/g, ' ').replace(/\s+/g, ' ').trim();
  let hit = null;
  for (const [cmd, phrases] of VOICE_CMDS) for (const p of phrases) {
    const at = (' ' + t + ' ').indexOf(' ' + p + ' ');
    if (at >= 0 && (!hit || at < hit.at)) hit = {cmd, at, p};
  }
  if (!hit) return {cmd: null, rest: t};
  const rest = (t.slice(0, hit.at) + ' ' + t.slice(hit.at + hit.p.length)).replace(/\s+/g, ' ').trim();
  return {cmd: hit.cmd, rest, phrase: hit.p};
}
/* Okuma sesinin enerjisi 0..1: yüksek ses (dBFS) ve hız (kelime/dk). Sakin ve yavaş → düşük; hızlı ve yüksek → yüksek. */
function voiceEnergy(db, wpm) {
  const loud = Math.max(0, Math.min(1, ((isFinite(db) ? db : -60) + 50) / 30));      // −50 dB → 0, −20 dB → 1
  const pace = wpm > 0 ? Math.max(0, Math.min(1, (wpm - 90) / 90)) : 0.4;            // 90 k/dk → 0, 180 → 1
  return +(0.5 * loud + 0.5 * pace).toFixed(3);
}
/* Kapı: enerji en az `delta` kadar kayıp `hold` ms boyunca kaymış kalırsa ve son değişimden `gap` ms geçtiyse yeni değeri verir. */
class VoiceGate {
  constructor(o) { o = o || {}; this.delta = o.delta || 0.22; this.hold = o.hold || 8000; this.gap = o.gap || 20000; this.base = null; this.since = 0; this.last = -Infinity; }
  push(e, t) {
    if (this.base == null) { this.base = e; return null; }
    if (Math.abs(e - this.base) < this.delta) { this.since = 0; return null; }
    if (!this.since) this.since = t;
    if (t - this.since < this.hold || t - this.last < this.gap) return null;
    this.base = e; this.since = 0; this.last = t;
    return e;
  }
}

const SAMPLE = {title: 'Fener Bekçisinin Kızı', author: 'Örnek öykü', sample: true, blocks: [
 {h: 1, t: 'I. Sabah'},
 {t: 'Sabah, fenerin taş basamaklarına ılık bir ışık gibi yayıldı. Deniz sakindi; dalgalar kıyıya yavaşça, neredeyse sessizce dokunuyordu. Defne çayını pencerenin önüne koydu ve bahçedeki incir ağacının gölgesinin duvarda ağır ağır yer değiştirmesini izledi. Adada her şey dingin, her şey yerli yerindeydi.'},
 {t: 'Öğleye doğru balıkçı Rıfkı’nın teknesi iskeleye yanaştı. Çocuklar kahkahalarla koşup halatı yakaladılar; biri şarkı söylemeye başladı, ötekiler de gülerek ona katıldı. Rıfkı her zamanki şakasını yaptı: “Fener bu gece de yanacak mı, yoksa ay mı nöbet tutacak?” Defne güldü. Bugün içinde tarifsiz bir neşe, çocukça bir sevinç vardı.'},
 {t: 'Teknenin getirdiği çuvalların arasından bir de mektup çıktı. Zarfın üstünde ne gönderenin adı vardı ne de bir pul; yalnızca tuhaf, eski bir mühür. Defne zarfı merakla çevirdi. İçinden paslı küçük bir anahtar ve tek satırlık bir not düştü: “Babanın sakladığı sır, fenerin altındadır.” Kim yazmıştı bunu? Ve neden şimdi?'},
 {h: 1, t: 'II. Fırtına'},
 {t: 'Akşama doğru rüzgâr döndü. Ufukta kurşun rengi bulutlar toplandı, ilk yağmur damlaları cama vurmaya başladı. Defne fenerin camlarını kapatırken anahtarı avucunda sıkıyordu; içindeki şüphe, havayla birlikte ağırlaşıyordu. Fırtına geliyordu.'},
 {t: 'Birden aşağıdan bir gürültü geldi. Kapı! Biri kapıyı zorluyordu. Defne nefesini tuttu; kalbi hızla çarpıyordu. Merdivenlerde ayak sesleri yükseldi, aniden lamba söndü. “Kim var orada?” diye bağırdı. Cevap yok. Panikle geri çekildi, eli duvardaki demir kancayı aradı. Tehlike artık kapının hemen ardındaydı!'},
 {t: 'Kilerin kapağını kaldırıp karanlığa indi. Aşağısı soğuktu; duvarlardan su sızıyor, bir yerlerde bir şey tıkırdıyordu. Mumun titrek ışığında gölgeler uzayıp kısaldı. Defne ürperdi. Sanki bu taş odada yıllardır biri bekliyormuş gibi bir dehşet çöktü üstüne; her adımda korkusu büyüyor, karanlık biraz daha koyulaşıyordu.'},
 {t: 'Anahtar, köşedeki sandığın kilidine uydu. İçinde gizli bir defter vardı: babasının el yazısı. Sayfalar bilinmeyen bir gemiden, sisin içinde kaybolan esrarlı bir yolcudan söz ediyordu. Defne satırları fısıltıyla okudu; her cümle yeni bir sırrın ipucunu veriyordu.'},
 {h: 1, t: 'III. Defter'},
 {t: 'Son sayfayı okurken gözyaşlarını tutamadı. Babası o gece, kimsenin kurtarmaya yanaşmadığı birini kurtarmak için açılmış ve bir daha dönmemişti. Defne yıllarca yalnız büyümüştü; şimdi o yalnızlığın, o sessiz kederin nedenini öğreniyordu. Ağladı. Özlem, eski bir yara gibi yeniden sızladı; veda bile edememişlerdi.'},
 {t: 'Deftere bir fotoğraf iliştirilmişti: annesiyle babası, fenerin önünde. Babası annesine öyle bir sevgiyle bakıyordu ki Defne o bakışı kendi kalbinde hissetti. Arkasına şunu yazmıştı: “Sevgilim, ışığı senin için yakıyorum; her gece, sana dönebileyim diye.” Aşk, demek ki bir feneri yıllarca yanık tutabiliyordu.'},
 {t: 'Şafakta Defne kararını vermişti. Babasının haritasını aldı, tekneyi iskeleden çözdü ve yelkeni açtı. Sular kayığı bir düşman gibi dövüyordu; o ise dümeni cesaretle tutuyordu. Bu artık bir yolculuktu: sisin ardındaki o gemiyi bulacak, yarım kalmış bir kahramanlığı tamamlayacaktı. Macera, tam da korkunun bittiği yerde başlıyordu.'},
 {t: 'Öğleye doğru hava yumuşadı. Deniz yeniden sakinleşti, güneş suyun üstünde ılık ve hafif bir yol çizdi. Defne dümeni bıraktı, arkasına yaslandı. Uzakta, adanın tepesinde fener sessizce duruyordu. İlk kez huzur içinde nefes aldı.'}
]};

/* Karakter adları (yerel sezgi): sık geçen, cümle başı olmayan büyük harfli sözcükler.
   Gemi/yer adları elenir: çoğunlukla "the/a/gemi/ship" ardından gelen ya da hiç konuşma fiiliyle anılmayan sık adlar. */
const CHAR_STOP = new Set('The And But Then When What Where Who Why How This That There Their They She Her His Him You Your Our Yes No Not Now Oh Mr Mrs Miss Sir Lady Lord God Chapter Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December English French London Bir Bu Şu Ve Ama Fakat Sonra Ne Kim Nasıl Evet Hayır Bey Hanım Efendi Allah Tanrı Bölüm'.split(' '));
const CHAR_ART = /(?:^|[^\p{L}])(?:the|a|an|gemi(?:si)?|ship|brig|schooner|vessel)\s+$/iu;
const CHAR_SPEECH = /(?:^|[^\p{L}])(said|says|asked|replied|cried|answered|whispered|shouted|exclaimed|continued|returned|dedi|diyordu|diye|sordu|bağırdı|yanıtladı|fısıldadı|söyledi|haykırdı)(?![\p{L}])/iu;
function findChars(texts) {
  const up = new Map(), low = new Map(), art = new Map(), talk = new Map(), re = /\p{L}[\p{L}'’]{2,}/gu, src = texts.slice(0, 5000);
  const inc = (mp, k) => mp.set(k, (mp.get(k) || 0) + 1);
  for (const t of src) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(t))) {
      const w = m[0].replace(/['’].*$/, ''), c = w.charAt(0);
      if (c === c.toLowerCase()) { inc(low, w.toLocaleLowerCase('tr')); continue; }
      const before = t.slice(Math.max(0, m.index - 3), m.index);
      if (m.index === 0 || /[.!?…:“"«—–-]\s*$/.test(before) || CHAR_STOP.has(w) || w === w.toUpperCase()) continue;
      inc(up, w);
      if (CHAR_ART.test(t.slice(Math.max(0, m.index - 12), m.index))) inc(art, w);
      if (CHAR_SPEECH.test(t.slice(Math.max(0, m.index - 40), m.index + w.length + 40))) inc(talk, w);
    }
  }
  const top = [...up].filter(([w, n]) => n >= 6 && (low.get(w.toLocaleLowerCase('tr')) || 0) < n / 3
    && (art.get(w) || 0) < n * 0.3                       // "the Pequod", "gemi Hispaniola"
    && !(n >= 20 && !(talk.get(w) || 0)))                 // sık geçip hiç konuşmayan → yer/gemi
    .sort((a, b) => b[1] - a[1]).slice(0, 9);
  const all = src.join('\n');
  const solo = top.filter(([w, n]) => !top.some(([o]) => o !== w && (all.split(w + ' ' + o).length - 1) > n * 0.4));
  return solo.slice(0, 5).map(([name, n]) => ({name, n}));
}

/* Okuma hedefi: gün anahtarı (yerel tarih) ve seri hesabı. days = {'YYYY-MM-DD': saniye} */
function dayKey(d) { d = d ? new Date(d) : new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function goalStats(days, goalMin, now) {
  days = days || {}; const need = Math.max(1, goalMin || 20) * 60, t = now ? new Date(now) : new Date();
  const today = days[dayKey(t)] || 0, met = k => (days[k] || 0) >= need;
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12);
  if (!met(dayKey(d))) d.setDate(d.getDate() - 1);           // bugün henüz dolmadıysa seri dünden sayılır
  let streak = 0; while (met(dayKey(d)) && streak < 3660) { streak++; d.setDate(d.getDate() - 1); }
  return {today, need, frac: Math.min(1, today / need), streak, done: today >= need};
}

// "Kaldığın yerde ne oluyordu?": son okunan paragraflardan yerel, çıkarımsal özet.
// Cümle puanı = adı geçen karakterler + duygu ipucu sözcükleri + konum (sona yakın olan daha önemli);
// çok kısa/uzun cümleler ve konuşma parçaları cezalı. Dönüş: metin sırasıyla en çok k cümle.
function recap(texts, upto, opts) {
  opts = opts || {};
  const span = opts.span || 30, k = opts.k || 3, lang = opts.lang || 'tr';
  const end = Math.max(0, Math.min(texts.length, (upto | 0) + 1)), from = Math.max(0, end - span);
  if (end <= from) return [];
  const chars = (opts.chars || findChars(texts.slice(Math.max(0, end - 400), end))).map(c => lower(c.name || c, lang));
  const cand = [];
  for (let p = from; p < end; p++) {
    const sents = String(texts[p]).match(/[^.!?…]+[.!?…]+["'”’»]*|[^.!?…]+$/g) || [];
    for (const raw of sents) {
      const s = raw.trim(), len = s.length;
      if (len < 40 || len > 320) continue;
      const lw = lower(s, lang), a = analyze(s, lang);
      let sc = 0;
      for (const c of chars) if (c && lw.includes(c)) sc += 1.2;
      sc += Math.min(2, a.cues.filter(c => !c.neg).length * 0.5);
      sc += 1.5 * (p - from + 1) / (end - from);
      if (/^["“'‘«—-]/.test(s)) sc -= 0.6;
      if (len < 70) sc -= 0.3;
      cand.push({s, p, sc});
    }
  }
  return cand.sort((x, y) => y.sc - x.sc).slice(0, k).sort((x, y) => x.p - y.p).map(c => ({text: c.s, para: c.p}));
}

return {recap, MOODS, INFO, AMBS, AMB_AD, detectLang, detectLangInfo, repairMojibake, LANG_V,lower, tokenize, matchStem, analyze, topMood, decode,
  parseGutenberg, parseText, fromFilename, identifyBook, Aligner, wordsOf, hashText, voiceCommand, voiceEnergy, VoiceGate, tonicFor, readingLine, barcode, SAMPLE, NEUTRAL, findChars, dayKey, goalStats};
});
