# 4 — Rebuttal: Art Director

## (a) Weakest points

**Sound designer**
1. **The recipe table contradicts the transition rule.** "One per-book tonic" versus eight different T values (36–53), plus sus2 pivots and ≤2-semitone leading across 56 transitions. Instead: one tonic, eight modes, retune the silent bank to nearest pitches, crossfade at the chord boundary.
2. **The test suite is bigger than the engine.** Bit-identical renders and 56 transition renders will eat the sitting. Keep three: peak < -1 dBFS, max sample delta, node count after 200 changes.
3. **Five pre-rendered stereo loops at init.** 9–13 s each is roughly 20 MB of floats and a frozen first tap on a phone. Ship rain, wind, sea; render each lazily on first keyword. Also drop the `getUserMedia` voice detector: a second mic prompt for 4 dB.

**Reader experience**
1. **The aligner is the riskiest item in the build**, for an optional, Chrome-only feature: IDF, edit distance, digit maps, trigram recovery. Instead: finals plus prefix-diffed interims, move on ≥2 non-stopword hits in the window, and tap-a-paragraph as the recovery path.
2. **The 150-title table** is data entry for a label. Use epub/Gutenberg metadata and filename only; keep the Gutenberg licence strip.
3. **Features 3–5 are a pile with no screen.** Anticipated transitions hang on a learned WPM that is wrong half the time; auto-scroll, sleep timer and session card each need controls. Build 1 and 2 only.

## (b) Conflicts and resolutions

- **Gutter thread vs. whole-book ribbon scrubber.** Same object. I yield on "read segments only": unread segments show their mood ink at 30% opacity, read at 100%, chapters as 1px notches. Drawn once, marker moves.
- **Cue-word highlight vs. "no colour behind text".** Cue words get a 1px `--mood` underline, never a background. Tapping the mood name in the player triggers it; relabel is a row of eight words in the same sheet.
- **Voice inking vs. performance.** Do not span-wrap the book. Wrap words only in the active paragraph, driven by the aligner cursor; unwrap on leave.
- **Ducking: 8 dB (reader) vs. -6 dB plus speech-band EQ (sound).** Take the sound designer's fixed profile, no detector. The mic glyph filled in `--mood` is the only "listening" indicator.
- **Three idle behaviours** (my 90 s, sound's 40 s, reader's browse-freeze). One timer: 60 s without scroll thins to drone and dims the plate; fast scroll freezes mood. One code path.
- **Neutral state needs a look.** Mood name drops to `--ink-2`, plate tint falls to 20%. No extra chip.
- **Chapter end: cadence vs. sleep timer vs. bookmark.** Keep only the cadence; it needs no UI.

## (c) Concessions

- Radial "ink soak" mask: cut. Plain 3 s opacity crossfade.
- Rule "breathing" at chord rate: invisible at 9–18 s and couples UI to the engine. Cut.
- Chapter bookmark PNG: cut.
- Vertical spine titles: illegible at 28px. Shelf becomes plain rows with a 4px mood barcode under each title.
- Plate at 36% is greedy: 30%, hidden below 1100px in favour of the strip.
- Invert plus screen for dark theme is untested; fallback is plain opacity 0.5.

## Build this
1. Ink-on-paper palette, one mood colour on screen.
2. Stem matcher with exact flags, negation, √tokens normalisation, plus its tests.
3. Scene smoothing with neutral state and switch penalty.
4. Lookahead scheduler, fixed node graph, limiter.
5. One tonic, eight modes, bank crossfade at chord boundary.
6. Gutter thread as full-book scrubber.
7. Text column 62ch, Source Serif 4, `lang="tr"`.
8. Sectioned `content-visibility` rendering, cached offsets, sliding reading line.
9. 48px player plus one settings sheet.
10. Left plate with tinted ink-wash images, plain crossfade.
11. Simple aligner, fixed mic duck, inked active paragraph.
12. "Neden bu müzik?" underline plus relabel.

## Cut this
1. Voice-leading rules, leitmotif, pace tempo.
2. 150-title identification table.
3. Auto-scroll, sleep timer, session card, bookmark.
4. Anticipated transitions.
5. Fire and night ambience; voice detector.
6. Radial mask, breathing rule, spine shelf.
