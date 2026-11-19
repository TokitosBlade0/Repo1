# 6 — Rebuttal: reader experience

## Art Director: three risks
1. **Bars fade to 25%, restored by "pointer move".** Phones have no pointer move; 25% controls are unreadable. Instead: hide on scroll down, show on scroll up or tap.
2. **Voice-inked words.** Greying unread text lowers contrast book-wide; per-word spans on 1 MB mean ~170k nodes. Instead: text stays `--ink`; wrap words only in the active paragraph, underline up to the aligner's committed cursor.
3. **Blend + invert + radial mask + full-page `feTurbulence` + breathing rule.** Repaint cost on phones, motion beside the text. Instead: opacity crossfade, grain on the plate only, static rule. Web fonts may fail in a sandbox and shift cached offsets: system-serif fallback, re-measure on `document.fonts.ready`.

## Sound Designer: three risks
1. **Stacked latency.** 2.5 s dwell + chord boundary (≤4 s) + 4-8 s crossfade, plus my dwell: music lands ~10 s late. Instead: Core owns the only hysteresis; the engine starts within 1 s, finishes in 4 s.
2. **"No scroll for 40 s = drone."** One phone screen takes about 60 s to read. Instead: idle = 2× estimated reading time of the visible text, minimum 120 s.
3. **Init weight and a second mic consumer.** 26 oscillators, a convolver and five pre-rendered stereo loops before the first note; `getUserMedia` beside SpeechRecognition means a second prompt and fails in a sandbox. Instead: render loops lazily, halve pad oscillators on phones, cut the analyser. Node has no `OfflineAudioContext`: test the pure `schedule()` event list there, loudness and clicks in an in-page self-test.

## Conflicts and resolutions
- **Neutral state** (mine) has no ink or recipe: keep the previous mood's colour and recipe at intensity 0.2.
- **Mood map**: Art colours only read segments; a scrubber needs the road ahead. Art's thread on one canvas, unread segments at 30% mood ink, 44px hit area.
- **Idle**: 40 s (Sound) vs 90 s (Art): one Core event.
- **Mic ducking**: my flat 8 dB vs Sound's speech-band EQ: Sound's.
- **Naming**: `korku.jpg` vs "karanlık": one list of eight ids shared by Core, engine and CSS.
- **Intensity**: Sound's `i` is my confidence. Core emits `{mood, i}`; nothing else crosses.

## Concessions
- **Viterbi → kernel smoothing plus hysteresis**: switch only when a challenger wins two consecutive paragraphs or leads by 2×. Passes the same `AABAA` tests.
- **IndexedDB → localStorage**: settings plus a 12-book position index by content hash; text kept only for the last book if it fits (try/catch), otherwise the reader reopens the file. Moods are recomputed, not stored.
- **Aligner**: drop edit distance and trigram recovery; keep prefix keys, stopword weighting, the two-hit rule, the widened window.
- **Drop** WPM learning (fixed 200 wpm, adjustable), anticipated transitions, session card, the 150-title table.

## Build this
1. Lexicon matcher with stem limits, negation and language detection, tested in Node.
2. Kernel smoothing, one hysteresis in Core, neutral state.
3. Chunked sections with `content-visibility`, cached offsets, idle analysis.
4. Sliding reading line, dwell commit, fast-scroll freeze.
5. Lookahead scheduler on a fixed, allocation-free graph.
6. Shared-tonic modes with voice-led transitions.
7. Limiter and per-mood loudness trim.
8. Ink palette: mood is the only colour, never behind text.
9. Thread mood map as scrubber.
10. One-line player, one settings sheet.
11. Voice follow: simplified aligner, Sound's mic mix, button hidden when unsupported.
12. "Neden bu müzik?" cue highlight.

## Cut this
1. Greyed unread text and book-wide word spans.
2. Fading bars, breathing rule, radial mask.
3. Bookmark PNG download.
4. Mic analyser ducking.
5. Reading-pace tempo and leitmotif.
6. Viterbi, IndexedDB, book-title table.
