# 5 — Rebuttal: Sound Designer

## A. Weakest points

**Art Director**
1. *Rule "breathes at the chord rate"* and the *30 fps waveform* need an `AnalyserNode` plus rAF competing with the audio thread on phones, for decoration. Instead: the engine emits `onChord(time, dur)` and CSS runs one transition per event. The waveform becomes a static stroke scaled by `intensity`.
2. *All audio controls in one bottom sheet.* Volume two taps deep is wrong for an app that makes sound unprompted. Player line: play, volume, mood chip (tap = override), mic; play/pause never fades.
3. *"Dalıp gitme" fades the plate and thins the music together.* A reader stuck on a hard sentence is punished twice. Music thins; the plate stays.

**Reader Experience**
1. *"Confidence drives intensity."* Certainty is not emotion: a confidently calm paragraph would get the brightest filter. Two fields.
2. *Anticipated transitions from learned WPM.* Scroll-derived WPM is noisy; early music is worse than late. Instead send a `next` hint; the engine only pre-tunes its silent pad bank and commits when the detector does.
3. *"Duck 8 dB" plus the full aligner.* A flat duck leaves ambience noise in the speech band; my mic profile (speech-band EQ, lead off, ambience -12 dB) replaces it. Trigram recovery and edit distance are a second project.

## B. Conflicts and resolutions

- **Double dwell.** Detector dwell + my 2.5 s hysteresis + "wait for chord boundary" (my chords last 8-20 s, so my "≤4 s" was false) = up to 20 s lag. The detector alone owns stability; the engine has no hysteresis and starts the crossfade on the next 2 s grid step.
- **Neutral.** Not a ninth recipe: keep the last mood's mode, mute lead and pulse, pad only.
- **Low confidence.** Scales lead density and crossfade time (8 s at 0.2, 4 s at 0.8). Never brightness.
- **Idle: 90 s (AD) vs 40 s (mine) vs pace tempo.** One rule: 60 s without scroll → pad only over 8 s, back in 3 s. `browsing` freezes the music. Pace tempo is dropped.
- **Plate 4 s vs pad 4-8 s.** The UI fades on `onMood`, not on the detector, so eye and ear move together.

**Interface** (detector → engine, on change only, max 4 Hz; engine samples it on its 25 ms tick):

```js
engine.set({ mood,        // 0-7, last non-neutral
  neutral,                // bool
  intensity,              // 0-1 evidence strength
  confidence,             // 0-1 margin
  next,                   // {mood, etaSec} | null
  ambience,               // up to 2 ids
  idle, browsing, mic })  // bools
engine.onMood(mood, fadeSec); engine.onChord(time, dur);
```

## C. Concessions

Over-engineered in my round 1: sus2-pivot voice leading across 56 transitions (one tonic for all moods; the bank crossfade hides the rest), eight bespoke lead instruments (three: bell, pluck, bowed), leitmotif, chapter cadence, mic voice detector, fire and night ambience, the transition test matrix. Keep the clock, fixed graph, limiter, designed IR, loudness trims: those you hear.

## Build this
1. Lookahead scheduler on audio time, seeded RNG.
2. Fixed node graph, two pad banks, equal-power crossfade.
3. Limiter + per-mood loudness trim.
4. The `engine.set` interface; detector owns stability.
5. Stem/negation lexicon with collision tests.
6. Viterbi with neutral state.
7. Neutral and idle = pad only.
8. Ink-on-paper palette, one mood colour.
9. Player line: play, volume, mood chip, mic.
10. Mood thread as scrubber.
11. Mic profile instead of flat duck.
12. Offline tests: peak, clicks, node count, determinism.

## Cut this
1. Analyser waveform, audio-synced breathing.
2. WPM-timed transitions, pace tempo.
3. Leitmotif, chapter cadence, sus2 pivots.
4. Trigram recovery, edit distance.
5. Bookmark PNG, session card.
6. Fire/night ambience, mic voice detector.
