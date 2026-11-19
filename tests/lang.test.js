// Kitap dili tanıma testleri: node tests/lang.test.js  (bağımlılık yok)
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const Core = require(path.join(W, 'core.js'));
const Books = require(path.join(W, 'books.js'));

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + (e && e.message)); } };

/* Örnek metinler (bu test için yazıldı) */
const TR = [
  'Sabah erkenden kalktım ve pencereyi açtım. Sokak hâlâ sessizdi, yalnızca karşı evin önünde bir kedi güneşleniyordu.',
  'Annem mutfakta çay demliyordu; ben de masaya oturup dünden kalan mektubu bir kez daha okudum. Ne yazdığını tam anlayamamıştım.',
  'Kardeşim içeri girdiğinde yüzü bembeyazdı. “Bir şey mi oldu?” diye sordum ama cevap vermedi, sadece başını salladı.',
  'O gün akşama kadar kimseyle konuşmadık. Herkes kendi odasına çekilmiş, sanki evin içinde görünmez bir duvar örülmüştü.',
  'Gece yarısı kapı çalındı. Babam yavaşça kalktı, ışığı yakmadan koridora yürüdü ve kapıyı araladı; dışarıda kimse yoktu.',
  'Ertesi sabah olanları anlatmaya karar verdim, çünkü bu sırrı daha fazla taşıyamayacağımı biliyordum. Yine de korkuyordum.',
  'Şehrin kenarındaki eski köprüye vardığımızda yağmur başlamıştı. Islak taşların üstünde ayak seslerimiz yankılanıyordu.',
  'Bunu sana neden anlattığımı bilmiyorum belki de anlatacak başka kimsem olmadığı için. Ama artık geri dönüş yok, değil mi?'
];
const EN = [
  'It was late in the evening when the old man came down the hill, and he walked slowly because the road was wet with rain.',
  'She had never seen the house before, but she knew at once that something in it was waiting for her, quiet and patient.',
  'They talked for hours about the war and the years that followed, and neither of them said what they were really thinking.',
  'When the letter finally arrived, he read it twice, folded it carefully and put it in the pocket of his coat without a word.',
  'The children ran along the shore, laughing at the waves, while their mother watched them from the top of the dunes.',
  'There was nothing to be done now; the ship had left the harbour and the men who could have stopped it were all asleep.',
  'I remember the smell of the kitchen that winter, the bread and the smoke, and the way my father would hum as he worked.',
  'If you had asked me then whether I was happy, I would have said yes, and I would have believed it with all my heart.'
];
const book = (ps, n) => { const out = []; for (let i = 0; i < n; i++) out.push(ps[i % ps.length]); return out.join('\n\n'); };
const ascii = s => s.replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ı/g, 'i').replace(/İ/g, 'I')
  .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ü/g, 'u').replace(/Ü/g, 'U').replace(/â/g, 'a');
const mojibake = s => Buffer.from(s, 'utf8').toString('latin1').replace(/[\u0080-\u009f]/g, c => ({'\u009f': 'Ÿ', '\u009e': 'ž', '\u0080': '€', '\u0099': '™', '\u009c': 'œ'}[c] || c));
const FRONT = 'Copyright © 2005 by the author. All rights reserved. No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or by any means without the prior written permission of the publisher.\n\n' +
  'This is a work of fiction. Names, characters, places and incidents are the products of the author\'s imagination and any resemblance to actual persons, living or dead, is entirely coincidental.\n\n' +
  'Printed in Turkey. First edition. Cover design and typesetting by the publisher, with thanks to everyone who helped along the way.\n\n';

test('Türkçe metin → tr', () => assert.strictEqual(Core.detectLang(book(TR, 40)), 'tr'));
test('tek paragraf Türkçe → tr', () => assert.strictEqual(Core.detectLang(TR[1]), 'tr'));
test('harfleri ASCII\'ye indirilmiş Türkçe → tr', () => assert.strictEqual(Core.detectLang(ascii(book(TR, 40))), 'tr'));
test('bozuk kodlanmış (mojibake) Türkçe → tr', () => { const m = mojibake(book(TR, 40)); assert(/Ã§|Ä±|ÅŸ/.test(m)); assert.strictEqual(Core.detectLang(m), 'tr'); });
test('mojibake onarımı (Latin-1 ve 1252 okuması)', () => {
  const s = 'Çok güzel bir şey, ışık ve İstanbul. Öğle güneşi.';
  assert.strictEqual(Core.repairMojibake(Buffer.from(s, 'utf8').toString('latin1')), s);
  assert.strictEqual(Core.repairMojibake(mojibake(s)), s);
});
test('düzgün metne dokunulmaz', () => assert.strictEqual(Core.repairMojibake(TR[0]), TR[0]));
test('mojibake onarımı (1252)', () => assert.strictEqual(Core.repairMojibake(mojibake('Çok güzel bir şey, ışık ve İstanbul. Öğle güneşi.')), 'Çok güzel bir şey, ışık ve İstanbul. Öğle güneşi.'));
test('İngilizce künye/telif başlıklı Türkçe kitap → tr', () => assert.strictEqual(Core.detectLang(FRONT + FRONT + book(TR, 60)), 'tr'));
test('İngilizce künyeli Türkçe kitap, üst veri "en" olsa da → tr', () => assert.strictEqual(Core.detectLang(FRONT + book(TR, 60), {hint: 'en'}), 'tr'));
test('büyük İ ile başlayan sözcükler İngilizce "i" sayılmaz', () => assert.strictEqual(Core.detectLang(book(['İşte İstanbul. İki insan İçeri girdi, İyi akşamlar dedi; İlk kez İnanmıştı.'], 30)), 'tr'));
test('paragraf dizisi de kabul edilir', () => assert.strictEqual(Core.detectLang(Array.from({length: 50}, (_, i) => TR[i % TR.length])), 'tr'));
test('İngilizce metin → en', () => assert.strictEqual(Core.detectLang(book(EN, 40)), 'en'));
test('tek paragraf İngilizce → en', () => assert.strictEqual(Core.detectLang(EN[2]), 'en'));
test('İngilizce kitap, Türkçe önsözle → en', () => assert.strictEqual(Core.detectLang(book(TR, 3) + '\n\n' + book(EN, 60)), 'en'));
test('belirsiz/boş metin → arayüz dili (tr), ipucu varsa ipucu', () => {
  assert.strictEqual(Core.detectLang('12 34 56 — …'), 'tr');
  assert.strictEqual(Core.detectLang('12 34 56 — …', {hint: 'en'}), 'en');
  assert.strictEqual(Core.detectLang(''), 'tr');
});
test('detectLangInfo güven bildirir', () => { const i = Core.detectLangInfo(book(TR, 40)); assert(i.sure && i.lang === 'tr'); assert(typeof Core.LANG_V === 'number' && Core.LANG_V >= 2); });

/* Yerelde önbelleğe alınmış gerçek kitaplar (varsa): her biri kendi diline */
let real = 0;
for (const rec of (Books.RECOMMENDED || []).concat(Books.TURKISH || [])) {
  const f = rec.page ? path.join(W, 'cache', 'vk-' + rec.page.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 80) + '.txt') : path.join(W, 'cache', 'pg' + rec.gid + '.txt');
  if (!fs.existsSync(f) || !rec.lang) continue;
  const body = Core.parseGutenberg(fs.readFileSync(f, 'utf8')).body;
  real++;
  test('gerçek kitap: ' + rec.title + ' → ' + rec.lang, () => {
    assert.strictEqual(Core.detectLang(body), rec.lang);
    assert.strictEqual(Core.detectLang(ascii(body)), rec.lang);
  });
}

console.log('\n' + pass + ' / ' + (pass + fail) + ' test geçti' + (real ? ' (' + real + ' gerçek kitap)' : ''));
process.exit(fail ? 1 : 0);
