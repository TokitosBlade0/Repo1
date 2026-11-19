# 7 — Karar (tartışmanın sonucu)

Üç ajanın "Build this" listelerinde ortak çıkanlar yapılacak, üçünün de "Cut this" dediği şeyler atılacak.

## Yapılacak
1. **Mürekkep ve kâğıt**: ekranda tek renk o anki duygu; metnin arkasında asla renk ya da görsel yok.
2. **Sol levha** (masaüstü %30, telefonda üst şerit): Gemini'de üretilen siyah-beyaz mürekkep görselleri, duygu rengiyle boyanır, düz opaklık geçişi.
3. **İplik**: kitabın tamamının duygu haritası; okunmuş kısım tam, okunmamış kısım %30 mürekkep; kaydırma çubuğu olarak çalışır.
4. **Çekirdek (core.js, DOM'suz, Node'da test edilir)**: dil algılama, kök eşleştirme (çakışma korumalı), Türkçe/İngilizce olumsuzluk, pekiştirici/azaltıcı, √kelime normalizasyonu.
5. **Sahne yumuşatma**: ±2 paragraf çekirdek + tek bir histerezis + nötr durum. Kararlılığın tek sahibi çekirdek.
6. **Müzik motoru (engine.js)**: ses saatine göre ileri bakan zamanlayıcı, sabit düğüm grafiği, iki ped bankası arası geçiş, sınırlayıcı, tasarlanmış yankı.
7. **Tek tonik, sekiz mod**: kitabın tonu başlığından türetilir; duygu değişimi modal geçiştir. Nötr ve dalgınlık = yalnızca ped.
8. **Arayüz sözleşmesi**: `engine.set({mood, neutral, intensity, confidence, ambience, idle, browsing, mic})`; motor `onMood` ile geri bildirir, görsel ve renk onunla birlikte değişir.
9. **Okuma takibi**: kayan okuma çizgisi (%25→%75), bekleme süresi dolunca karar, hızlı kaydırmada müzik donar.
10. **Sesle takip**: sade hizalayıcı (önek anahtarları, etkisiz kelime ağırlığı, iki-isabet kuralı, genişleyen pencere), sabit mikrofon karışımı, yalnızca etkin paragrafta kelime işaretleme.
11. **"Neden bu müzik?"**: ipucu kelimelerinin altını çizer, sahneyi elle yeniden etiketletir.
12. **Performans**: 40 paragraflık `content-visibility` bölümleri; iki aşamalı konum bulma.

## Atılacak
Sesle grileşen metin, solan çubuklar, nefes alan çizgi, radyal maske, yer imi PNG'si, mikrofon analizörü, okuma hızına göre tempo, leitmotif, Viterbi, IndexedDB, 150 kitaplık tablo, WPM'e göre erken geçiş, oturum kartı.

## Benim eklediklerim
- Her kitap bir **ön sayfa** ile açılır: kapak görseli, başlık, yazar, dil, okuma süresi, tür tahmini, kitabın tonu ve tüm kitabın duygu şeridi.
- **Bölüm başı**: başlık geçilince akor dizisi baştan başlar ve tonikte tek bir yumuşak çan çalar.
- **Test alanı** (`test.html`): çekirdek testleri, hizalayıcı senaryoları, çevrimdışı ses ölçümleri (tepe, RMS, tıkırtı, sessizlik, düğüm sızıntısı) ve 1 MB'lık metin hız ölçümü tek sayfada.
