// Satır Arası — önerilen kitaplar (Project Gutenberg, kamu malı) ve metin indirme.
// Tarayıcıda window.SA_Books, Node'da module.exports olarak kullanılır.
(function (root) {
  'use strict';
  const B = (gid, title, author, mood, blurb) =>
    ({id: 'pg' + gid, gid, title, author, lang: 'en', blurb, mood, cover: 'assets/covers/' + gid + '.jpg'});

  // Her gid sunucu vekili (/api/gutenberg) üzerinden indirilerek doğrulandı.
  const RECOMMENDED = [
    B(11,   'Alice Harikalar Diyarında', 'Lewis Carroll', 'nese', 'Tavşan deliğinden düşen meraklı bir kızın saçma ve neşeli düş dünyası.'),
    B(1661, 'Sherlock Holmes\'un Maceraları', 'Arthur Conan Doyle', 'gizem', 'Baker Sokağı\'nın ünlü dedektifinden on iki ustaca çözülmüş vaka.'),
    B(345,  'Drakula', 'Bram Stoker', 'karanlik', 'Transilvanya\'dan Londra\'ya uzanan, mektuplarla anlatılan gotik bir dehşet.'),
    B(84,   'Frankenstein', 'Mary Shelley', 'huzun', 'Yaratıcısı tarafından terk edilen bir varlığın yalnızlığı ve öfkesi.'),
    B(1342, 'Aşk ve Gurur', 'Jane Austen', 'ask', 'Elizabeth Bennet ile Bay Darcy arasında önyargıyla sınanan bir aşk.'),
    B(120,  'Define Adası', 'Robert Louis Stevenson', 'macera', 'Genç Jim Hawkins\'in korsanlar ve gömülü hazine peşindeki deniz yolculuğu.'),
    B(2701, 'Moby Dick', 'Herman Melville', 'macera', 'Kaptan Ahab\'ın beyaz balinaya duyduğu takıntılı intikam yolculuğu.'),
    B(1260, 'Jane Eyre', 'Charlotte Brontë', 'ask', 'Yetim bir mürebbiyenin Thornfield\'de sırlarla örülü aşkı ve bağımsızlığı.'),
    B(43,   'Dr. Jekyll ile Bay Hyde', 'Robert Louis Stevenson', 'gerilim', 'Saygın bir doktorun içindeki karanlık ikizle giderek gerilen mücadelesi.'),
    B(16,   'Peter Pan', 'J. M. Barrie', 'nese', 'Büyümeyi reddeden çocukla Varolmayan Ülke\'ye uçan neşeli bir yolculuk.'),
    B(289,  'Söğütlerdeki Rüzgâr', 'Kenneth Grahame', 'huzur', 'Köstebek, Su Faresi ve Kurbağa\'nın nehir kıyısındaki dingin dostluğu.'),
    B(1952, 'Sarı Duvar Kâğıdı', 'Charlotte Perkins Gilman', 'gizem', 'Odasına kapatılan bir kadının duvar kâğıdındaki gizemli desenlere saplanışı.')
  ];

  // Türk klasikleri: Vikikaynak'tan (tr.wikisource.org, /api/vikikaynak vekili). Ömer Seyfettin 1920'de öldü → kamu malı.
  // Her sayfa vekilden indirilip temiz paragraf verdiği doğrulandı (2026-11-17). İntibah, Sergüzeşt, Araba Sevdası ve
  // Felâtun Bey ile Râkım Efendi Vikikaynak'ta bulunamadığı için alınmadı. Kapak yok → covers.js tipografik tasarımı.
  const T = (slug, page, title, author, mood, blurb, year) =>
    ({id: 'vk-' + slug, gid: 'tr-' + slug, page, title, author, lang: 'tr', blurb, mood, year, cover: 'assets/covers/tr-' + slug + '.jpg', source: 'vikikaynak'});
  const TURKISH = [
    T('kasagi', 'Kaşağı', 'Kaşağı', 'Ömer Seyfettin', 'huzun', 'Kardeşini kıskanan bir çocuğun söylediği yalan ve ömür boyu süren pişmanlığı.', 1919),
    T('diyet', 'Diyet', 'Diyet', 'Ömer Seyfettin', 'gerilim', 'Ünlü kılıç ustası Koca Ali’nin Hacı Kasap’a borçlandığı diyet ve onurunu geri alışının sarsıcı öyküsü.', 1919),
    T('pembe-incili-kaftan', 'Pembe İncili Kaftan', 'Pembe İncili Kaftan', 'Ömer Seyfettin', 'macera', 'Yoksul ama onurlu Cevrî Çelebi’nin Şah’ın sarayına elçi gidip Osmanlı’nın gururunu koruması.', 1917),
    T('basini-vermeyen-sehit', 'Başını Vermeyen Şehit', 'Başını Vermeyen Şehit', 'Ömer Seyfettin', 'karanlik', 'Zigetvar seferinde küçük Grijgal palangasını tek başına savunan Kuru Kadı’nın efsanesi.', 1917),
    T('forsa', 'Forsa', 'Forsa', 'Ömer Seyfettin', 'macera', 'Yıllarca kürek mahkûmu kalan yaşlı Kara Memiş’in Akdeniz’de özgürlüğe dönüşü.', 1918),
    T('bomba', 'Bomba', 'Bomba', 'Ömer Seyfettin', 'karanlik', 'Komitacıların gölgesindeki bir Makedonya köyünde, bir bombanın ve bir gelinin karanlık öyküsü.', 1910)
  ];

  // Kitabın düz metnini yerel sunucu vekilinden getirir.
  async function fetchText(book) {
    if (book && book.page) {
      const f0 = root.fetch; if (!f0) throw new Error('Bu ortamda fetch yok.');
      let r;
      try { r = await f0('/api/vikikaynak?page=' + encodeURIComponent(book.page)); }
      catch (e) { throw new Error('Eser indirilemedi: ağ bağlantısını ve yerel sunucuyu (node server.js) kontrol edin.'); }
      if (!r.ok) throw new Error('Eser Vikikaynak\'tan indirilemedi (HTTP ' + r.status + ').');
      return r.text();
    }
    const gid = book && (book.gid || String(book.id || '').replace(/^pg/, ''));
    if (!/^\d+$/.test(String(gid))) throw new Error('Geçersiz Gutenberg numarası.');
    const f = root.fetch;
    if (!f) throw new Error('Bu ortamda fetch yok.');
    let res;
    try { res = await f('/api/gutenberg?id=' + gid); }
    catch (e) { throw new Error('Kitap indirilemedi: ağ bağlantısını ve yerel sunucuyu (node server.js) kontrol edin.'); }
    if (!res.ok) throw new Error('Kitap indirilemedi (HTTP ' + res.status + ').');
    return res.text();
  }

  const api = {RECOMMENDED, TURKISH, fetchText};
  root.SA_Books = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
