/* Çekirdek testleri. Node'da (tests/run.js) ve tarayıcıda (test.html) aynı dosya çalışır. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory; else root.coreCases = factory;
})(typeof self !== 'undefined' ? self : this, function (Core) {
  const out = [];
  const T = (name, fn) => { try { const r = fn(); out.push({name, ok: r === true, detail: r === true ? '' : String(r)}); } catch (e) { out.push({name, ok: false, detail: 'hata: ' + e.message}); } };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b) || 'beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a);
  const M = Core.MOODS, mi = m => M.indexOf(m);
  const score = (text, mood, lang) => Core.analyze(text, lang).v[mi(mood)];
  const top = (text, lang) => { const a = Core.analyze(text, lang); return a.v[Core.topMood(a.v)] > 0 ? M[Core.topMood(a.v)] : 'yok'; };

  /* Dil ve küçük harf */
  T('dil: Türkçe metin', () => eq(Core.detectLang('Sabah oldu ve bir kuş öttü, çünkü güneş doğmuştu.'), 'tr'));
  T('dil: İngilizce metin', () => eq(Core.detectLang('It was the best of times, and he said that it was not.'), 'en'));
  T('küçük harf: İngilizce NIGHT bozulmaz', () => eq(Core.lower('CHAPTER I. NIGHT', 'en'), 'chapter i. night'));
  T('küçük harf: Türkçe IŞIK', () => eq(Core.lower('IŞIK', 'tr'), 'ışık'));
  T('küçük harf: düzeltme işareti atılır', () => eq(Core.lower('Rüzgâr kâbus', 'tr'), 'rüzgar kabus'));

  /* Kök çakışmaları */
  const no = (w, lang) => Core.matchStem(w, lang) === null || 'eşleşti: ' + JSON.stringify(Core.matchStem(w, lang));
  T('çakışma: kalem ≠ kale', () => no('kalem', 'tr'));
  T('çakışma: sistem ≠ sis', () => no('sistem', 'tr'));
  T('çakışma: yasak ≠ yas', () => no('yasak', 'tr'));
  T('çakışma: pusula ≠ pusu', () => no('pusula', 'tr'));
  T('çakışma: funeral ≠ fun', () => eq(Core.matchStem('funeral', 'en').tag, 'huzun'));
  T('çakışma: window rüzgâr sesi açmaz', () => eq(Core.analyze('He looked out of the window all season.', 'en').amb, [0, 0, 0]));
  T('çakışma: Deniz adı dalga sesi açmaz', () => eq(Core.analyze('O sırada Deniz kapıdan girdi.', 'tr').amb[2], 0));
  T('ortam: deniz ve dalga', () => Core.analyze('Deniz sakindi, dalgalar kıyıya vuruyordu.', 'tr').amb[2] >= 2 || 'dalga sesi bulunamadı');
  T('ortam: yağmur', () => Core.analyze('Dışarıda yağmur yağıyordu.', 'tr').amb[0] >= 1 || 'yağmur bulunamadı');
  T('ek: korkuyordu → karanlık', () => eq(top('Çocuk çok korkuyordu.', 'tr'), 'karanlik'));
  T('ek: öldürdü hüzün değil karanlık', () => eq(Core.matchStem('öldürdü', 'tr').tag, 'karanlik'));

  /* Olumsuzluk */
  for (const s of ['Hiç korkmadı.', 'Artık korkmuyordu.', 'Korkusuz bir çocuktu.', 'Korkmuş değildi.', 'Korkmazdı.'])
    T('olumsuz (TR): ' + s, () => score(s, 'karanlik', 'tr') === 0 || 'puan ' + score(s, 'karanlik', 'tr'));
  for (const s of ['Korkmak istemiyordu ama korktu.', 'Onun korkması boşuna değildi, herkes korktu.'])
    T('olumlu (TR): ' + s, () => score(s, 'karanlik', 'tr') > 0 || 'puan 0');
  T('olumsuz (EN): not afraid', () => score('She was not afraid.', 'karanlik', 'en') === 0 || 'puan > 0');
  T("olumsuz (EN): wasn't sad", () => score("He wasn't sad at all.", 'huzun', 'en') === 0 || 'puan > 0');
  T('olumsuz (EN): fearless', () => score('A fearless girl.', 'karanlik', 'en') === 0 || 'puan > 0');
  T('olumlu (EN): afraid', () => score('She was afraid of the dark.', 'karanlik', 'en') > 0 || 'puan 0');
  T('zıt anlam: huzursuz → gerilim', () => eq(top('İçi huzursuzdu.', 'tr'), 'gerilim'));
  T('zıt anlam: mutsuz → hüzün', () => eq(top('Mutsuz bir adamdı.', 'tr'), 'huzun'));

  /* Şiddet */
  T('şiddet: çok > yalın > biraz', () => {
    const a = score('Çok korktu.', 'karanlik', 'tr'), b = score('Korktu.', 'karanlik', 'tr'), c = score('Biraz korktu.', 'karanlik', 'tr');
    return (a > b && b > c) || [a, b, c].join(' / ');
  });
  T('diyalog: ünlem ve soru tek başına duygu yaratmaz', () => {
    const a = Core.analyze('“Evet!” dedi. “Hayır?” dedi. “Tamam!” dedi. “Olur mu?” dedi.', 'tr');
    return a.v[Core.topMood(a.v)] < Core.NEUTRAL || 'puan ' + a.v[Core.topMood(a.v)];
  });

  /* Örnek öykü: paragraf paragraf beklenen duygu */
  const paras = Core.SAMPLE.blocks.filter(b => !b.h).map(b => b.t);
  const gold = ['huzur', 'nese', 'gizem', 'gizem|gerilim', 'gerilim', 'karanlik', 'gizem', 'huzun', 'ask', 'macera', 'huzur'];
  paras.forEach((p, i) => T('örnek öykü ¶' + (i + 1) + ' → ' + gold[i], () => gold[i].split('|').includes(top(p, 'tr')) || 'gelen ' + top(p, 'tr')));
  T('örnek öykü: sahne çözümleme sonucu', () => {
    const items = []; let brk = false;
    for (const b of Core.SAMPLE.blocks) { if (b.h) { brk = true; continue; } const a = Core.analyze(b.t, 'tr'); items.push({v: a.v, n: a.n, amb: a.amb, brk}); brk = false; }
    const d = Core.decode(items), got = [...d.mood].map(x => M[x]);
    const bad = got.filter((g, i) => !gold[i].split('|').includes(g)).length;
    return bad <= 1 || got.join(',');
  });

  /* Sahne çözümleyici */
  const vec = (m, x) => { const v = new Float32Array(8); if (m >= 0) v[m] = x; return v; };
  const seq = s => Core.decode([...s].map(ch => ({v: ch === '.' ? vec(-1, 0) : vec(ch === 'A' ? 0 : ch === 'B' ? 2 : 5, ch === ch.toLowerCase() ? 0.3 : 0.8), n: 40, amb: [0, 0, 0], brk: false})));
  T('çözümleyici: AABAA titremez', () => eq([...seq('AABAA').mood], [0, 0, 0, 0, 0]));
  T('çözümleyici: AABBB tek geçiş', () => { const m = [...seq('AABBB').mood]; let sw = 0; for (let i = 1; i < m.length; i++) if (m[i] !== m[i - 1]) sw++; return sw === 1 || m.join(''); });
  T('çözümleyici: ipucusuz paragraf nötr ve önceki duyguyu sürdürür', () => {
    const d = seq('AAA....'); return (d.neutral[6] === 1 && d.mood[6] === 0 && d.conf[6] < 0.2) || [...d.neutral].join('') + ' ' + [...d.mood].join('');
  });
  T('çözümleyici: bölüm başında serbest geçiş', () => {
    const it = [...'AAABBB'].map((ch, i) => ({v: vec(ch === 'A' ? 0 : 2, 0.8), n: 40, amb: [0, 0, 0], brk: i === 3}));
    return eq([...Core.decode(it).mood], [0, 0, 0, 2, 2, 2]);
  });

  /* Metin ve kitap tanıma */
  T('Gutenberg: başlık, yazar ve lisansın atılması', () => {
    const g = Core.parseGutenberg('The Project Gutenberg eBook of X\n\nTitle: Dracula\nAuthor: Bram Stoker\nLanguage: English\n\n*** START OF THE PROJECT GUTENBERG EBOOK DRACULA ***\nGövde metni.\n*** END OF THE PROJECT GUTENBERG EBOOK DRACULA ***\nLicense terror horror');
    return (g.title === 'Dracula' && g.author === 'Bram Stoker' && g.lang === 'en' && g.body.trim() === 'Gövde metni.') || JSON.stringify(g);
  });
  T('dosya adı: Yazar - Başlık', () => eq(Core.fromFilename('Sabahattin Ali - Kuyucaklı Yusuf.txt'), {author: 'Sabahattin Ali', title: 'Kuyucaklı Yusuf'}));
  T('ayrıştırma: bölüm başlığı', () => eq(Core.parseText('BÖLÜM 1\n\nBir varmış bir yokmuş.\n\nSonra bitti.').map(b => b.h ? 'h' : 'p').join(''), 'hpp'));
  T('kitap: adlardan tanıma en az iki farklı ad ister', () => eq(Core.identifyBook({title: 'Bir biyografi'}, 'Winston konuştu. Winston yürüdü. Winston Churchill savaşı anlattı. Winston güldü.').known, null));
  T('kitap: 1984 iki addan tanınır', () => eq(Core.identifyBook({title: ''}, 'Winston ekrana baktı. Julia geldi. Winston ile Julia sustu. Okyanusya savaştaydı. Okyanusya hep savaştaydı.').known, '1984'));
  T('kitap: başlıkta "dönüşüm" geçmesi Kafka demek değil', () => eq(Core.identifyBook({title: 'Dijital Dönüşüm Rehberi'}, 'Şirketler değişiyor.').known, null));
  T('kitap: tam başlık tanınır', () => eq(Core.identifyBook({title: 'Suç ve Ceza'}, '').known, 'Suç ve Ceza'));

  /* Hizalayıcı */
  const A = () => new Core.Aligner(paras, 'tr');
  const allWords = paras.map(p => Core.wordsOf(p, 'tr'));
  const total = allWords.reduce((s, w) => s + w.length, 0);
  T('hizalayıcı: kusursuz okuma sona kadar tekdüze ilerler', () => {
    const a = A(); let prev = 0, mono = true;
    for (const ws of allWords) for (const w of ws) { a.hear(w); if (a.cursor < prev) mono = false; prev = a.cursor; }
    return (mono && a.cursor === total) || 'imleç ' + a.cursor + ' / ' + total;
  });
  T('hizalayıcı: %20 bozuk tanımayla yine sona yaklaşır', () => {
    const a = A(); let k = 0;
    for (const ws of allWords) for (const w of ws) { k++; a.hear(k % 5 === 0 ? 'zzz' + k : w); }
    return a.cursor >= total - 6 || 'imleç ' + a.cursor + ' / ' + total;
  });
  T('hizalayıcı: atlanan paragraf 12 kelimede yakalanır', () => {
    const a = A(); for (const w of allWords[0]) a.hear(w);
    const ws = allWords[2].slice(0, 12); for (const w of ws) a.hear(w);
    return a.paraIndex === 2 || 'paragraf ' + a.paraIndex;
  });
  T('hizalayıcı: etkisiz kelime yağmuru imleci oynatmaz', () => {
    const a = A(); for (const w of allWords[0].slice(0, 5)) a.hear(w);
    const c = a.cursor; for (let i = 0; i < 40; i++) a.hear(['ve', 'bir', 'de', 'bu'][i % 4]);
    return a.cursor - c <= 2 || 'kaydı: ' + (a.cursor - c);
  });
  T('hizalayıcı: tekrar gelen ara sonuçlar iki kez ilerletmez', () => {
    const a = A(), ws = allWords[0];
    for (let n = 3; n <= 12; n++) { a.feed(ws.slice(0, n).join(' '), false); a.feed(ws.slice(0, n).join(' '), false); }
    a.feed(ws.slice(0, 12).join(' '), true);
    return a.cursor === 12 || 'imleç ' + a.cursor;
  });
  T('hizalayıcı: elle konum verme', () => { const a = A(); a.seek(5); return a.paraIndex === 5 || 'paragraf ' + a.paraIndex; });

  /* Yardımcılar ve hız */
  T('okuma çizgisi: uçlar', () => eq([Core.readingLine(0), Core.readingLine(1), Core.readingLine(2)], [0.25, 0.75, 0.75]));
  T('kitabın tonu: kararlı', () => eq(Core.tonicFor('Suç ve Ceza'), Core.tonicFor('Suç ve Ceza')));
  T('duygu şeridi: uzunluk ve içerik', () => eq(Core.barcode(Uint8Array.from([0, 0, 2, 2]), [10, 10, 10, 10], 4), '0022'));
  T('hız: 1 MB metin 1,5 saniyenin altında çözümlenir', () => {
    const base = paras.join('\n\n'); let big = []; let size = 0;
    while (size < 1e6) { for (const p of paras) { big.push(p); size += p.length; } }
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now(); const items = big.map(p => { const a = Core.analyze(p, 'tr'); return {v: a.v, n: a.n, amb: a.amb, brk: false}; }); Core.decode(items);
    const ms = Math.round(now() - t0); out.perfMs = ms; out.perfParas = big.length;
    return ms < 1500 || ms + ' ms';
  });
  return out;
});
