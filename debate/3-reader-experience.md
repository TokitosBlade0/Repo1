# 3 — Reader experience & detection (the sceptic)

Position: v1's detection is wrong in ways the reader hears. Fix correctness and stability first. All logic below lives in one DOM-free `Core` block.

## 1. Mood detection

**Failures in `analyze` today**
- Prefix collisions: `kale`→kalem, `sis`→sistem, `yas`→yasak, `fun`→funeral, `still` (adverb); `güzel`/`kalp`/`oyun` fire constantly. Atmosphere is worse: `wind`→window, `sea`→season/search, `deniz`→the name Deniz.
- `toLocaleLowerCase('tr')` on English turns `NIGHT` into `nıght`.
- No negation: "korkmadı", "korkusuz", "not afraid" all score dark. `öld` scores "öldürdü" as melancholy.
- `!`→tension, `?`→mystery: any dialogue page becomes tense-mysterious.
- No length normalisation; a short line ("Evet.") falls back to the book dominant, so music jumps mid-scene. Known-book prior (+1.2) outvotes the text.

**Algorithm**
1. Detect language once (stopwords `ve bir bu için` vs `the and of was` + ğşı); lowercase with that locale; strip circumflex.
2. Lexicon entries `{stem, mood, w:1–3, exact?}`. Stem match only if remainder is ≤ 60% of the word and stem ≥ 4 chars; short/ambiguous ones are `exact`. Phrases beat words: `kalbi çarp`→tension, `nefesini tut`→tension, `gözleri dol`→melancholy.
3. Negation. TR: remainder after stem matches `^m[ae](d|z|m[ıi]ş|y[ae]c|s[ıi]n|d[ae]n)|^m[ıiuü]yor` (not `-mak/-mek/-ması`); `-s[ıiuü]z` suffix; `değil/yok` within 2 tokens after; `hiç`, `ne…ne`. EN: `not, n't, no, never, without, hardly` within 3 tokens before, scope ends at punctuation. Negated hit = −0.5·w, except mapped antonyms (`huzursuz`→tension, `mutsuz`→melancholy).
4. Intensifiers ×1.5 (`çok, pek, son derece, büsbütün, very, utterly, terribly`); diminishers ×0.6 (`biraz, hafifçe, slightly`).
5. Quoted/dash dialogue ×0.6; punctuation bonus capped at 0.3 and only outside quotes.
6. Paragraph score = Σw / √tokens.
7. Scene decoding: triangle kernel ±2 paragraphs weighted by token count, reset at headings, then Viterbi over 9 states (8 moods + **neutral**) with a switch penalty: O(81·N), no flicker. Neutral = evidence below threshold; music keeps the previous mood, thinner.
8. Confidence = margin(top, second) × evidence saturation; drives intensity and dims the chip. Book prior capped at 0.15.

**Lexicon additions**: melancholy `hıçkır, cenaze, tabut, yetim, gurbet / sob, coffin, sigh`; tension `kovala, pusu, tetik, saklan / ambush, gasp, pursu`; dark `hortlak, karabasan, öldür / eerie, haunt, shriek`; joy `kıkırda, düğün, alkış / giggle, grin`; romance `âşık, yâr, kavuş / adore, caress`; adventure `dörtnala, kervan, kalkan / gallop, expedition`; mystery `dedektif, cinayet, şifre / detective, murder, riddle`; calm `sükûnet, ninni / serene, tranquil`.

## 2. Book identification
Sceptic's note: this is delight and a library label, not a mood input.
- Evidence order: epub `dc:title/creator/language` → Gutenberg `Title:/Author:/Language:` (and **strip everything outside `*** START/END OF`**; v1 mood-scores the licence) → `Yazar - Başlık` filename → first short lines.
- Signature names: top capitalised non-sentence-initial tokens, apostrophe suffixes stripped (`Raskolnikov'un`). Match a ~150-title table requiring **≥2 distinct** names (today 3× "Winston" = 1984; any title containing "dönüşüm" = Kafka).
- Show title · author · language · ~hours, the evidence ("adlardan tahmin: Raskolnikov, Sonya") and an edit button. Never overwrite the file's own title with a guess.

## 3. Tracking without a microphone
- Reading line slides from 25% of the viewport at the top to 75% at the end (v1's fixed 40% never reaches the last paragraphs).
- Cached offsets, not `getBoundingClientRect` in a binary search per frame.
- Commit a mood only after dwell ≥ max(1.2 s, 15% of the paragraph's estimated read time); scrolling faster than 1.5 viewports/s = browsing, music frozen.
- Learn WPM from slow-scroll passages (median of last 20, clamp 120–450).
- Tap a paragraph = "buradayım". Optional paced auto-scroll at learned WPM is the only exact signal; off by default.

## 4. Voice follow
**Weaknesses of `hear`**: interims counted by word index, so revised words are lost; any `bir/ve/the` within 12 words drags the pointer forward; only 8 words of the next paragraph are searched, so one skipped paragraph = lost forever; digits ("3" vs "üç") never match; speaker music feeds the recogniser.

**Aligner**: flat token array with keys (first 5 chars, edit distance ≤1 for len ≥5, digit↔word map) and book-level IDF. Feed finals fully; diff interims by common prefix, ignoring the last 2 words. Score the last 6 heard words against window `[cursor−10, cursor+60]`; move only on ≥2 IDF-weighted hits (stopwords ≈ 0). Stalled 8 s → widen to ±3 paragraphs, require a rare trigram. No backward jump beyond a sentence without one. Scroll leads the cursor by ~1.5 s. Restart with backoff, cursor kept. Duck music 8 dB while listening; state plainly that Chrome sends audio to Google.

## 5. Performance
Do not hand-roll a virtual list. 40-paragraph `<section>`s with `content-visibility:auto; contain-intrinsic-size`; first chunk sync, rest in idle batches. Keeps find-in-page and accessibility. Analysis in idle chunks outward from the saved position; moods as `Uint8Array`. Mood map drawn once; only the marker moves. Storage writes debounced.

## 6. Persistence
v1 keeps one book as JSON in localStorage (silent quota failure), keys position by title and writes on every paragraph change. Use IndexedDB `books` keyed by content hash (text + moods); localStorage holds settings and a ≤12-book index `{id,title,author,lang,para,frac,wpm,lastOpened}`, LRU-evicted, versioned. Private mode: session-only with a visible note.

## 7. Features
Build, by value/effort:
1. Mood ribbon of the whole book as the scrubber, chapters marked.
2. "Neden bu müzik?": tap the chip to highlight cue words; one tap to relabel the scene (stored per book).
3. Anticipated transitions: start the crossfade by WPM-estimated time to the next scene boundary, so music arrives with the sentence.
4. Paced auto-scroll + "bölüm sonuna ~6 dk" + sleep timer fading at chapter end.
5. Session card: minutes, paragraphs, mood journey strip.

Cut: per-character leitmotifs (brittle name detection, cluttered music); in-browser ML sentiment model (tens of MB, weak Turkish, kills phones); webcam eye-tracking (inaccurate, creepy).

## 8. Test plan (Node `node --test`, evaluating the `Core` script block)
- `normalize/detectLang`: `"CHAPTER I. NIGHT"` → `night`; TR/EN samples.
- `matchStem`: kalem≠kale, sistem≠sis, window≠wind, season≠sea, yasak≠yas, funeral≠fun; korkuyordu→dark.
- Negation: `korkmadı, korkmuyordu, korkusuz, korkmuş değildi, not afraid, wasn't sad` ≤ 0; `korkmak, korkması` > 0.
- Intensity: `çok korktu` > `korktu` > `biraz korktu`.
- Golden: the 11 sample paragraphs → calm, joy, mystery, mystery|tension, tension, dark, mystery, melancholy, romance, adventure, calm (before smoothing).
- Decoder: `AABAA`→all A; `AABBB`→exactly one switch; "Evet." inherits; cue-free paragraph → neutral, confidence < 0.2.
- `parseGutenberg`, `identifyBook` (Churchill biography ≠ 1984).
- Aligner on scripted transcripts: perfect read is monotonic to the end; 20% garbled still finishes; skipped paragraph recovered within 10 words; stopword spam does not move; replayed interims do not double-advance.
- `readingLine` endpoints, LRU eviction, 1 MB synthetic text analysed < 300 ms.
