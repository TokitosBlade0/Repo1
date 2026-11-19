# 2 — Sound Designer: the music engine

## 1. What is wrong with v1

- **Scheduling**: `setTimeout` per chord/note/pulse fired at `currentTime`: 10-50 ms jitter; in a hidden tab (1 s throttle) the 66 bpm heartbeat limps and the melody stalls.
- **Voicing**: a mood change calls `chord(5)` on a new root (C3, C2, F3) with no common tones: an audible lurch. No voice leading. Melody is a chord-blind random walk reaching MIDI 101 (2.8 kHz sine pings) in Neşe.
- **Timbre**: two raw detuned saws through a static low-pass = cheap string pad. No filter movement; everything mono.
- **Pulse**: 72→42 Hz sine is inaudible on phone/laptop speakers yet pumps the compressor.
- **Gain staging**: no limiter. Compressor at -18 dB/4:1 is always reducing, so ambience breathes with the pad. Moods not loudness-matched.
- **Reverb**: 4 s white-noise IR, cubic decay, no damping, no pre-delay: metallic hiss and the costliest node. Delay fixed at 0.47 s, unrelated to tempo.
- **Ambience**: one 3 s white-noise loop (audible repeat), sine-LFO "waves", rain without droplets.
- **CPU/GC**: new oscillator + gain per note with 8 s tails; per-chord nodes never disconnected.

## 2. Architecture

**Clock**: one pure `schedule(from, to)` writing events on AudioContext time. Driver: 25 ms timer, 150 ms horizon; when hidden, horizon 2.5 s. The same function drives OfflineAudioContext tests. Randomness: seeded mulberry32.

**Fixed graph, zero allocation after init** (≤26 oscillators):
- Pad: banks A/B × 4 voices × 2 oscillators, always running. Chord change = retune the silent bank, equal-power crossfade 4-8 s.
- Lead: 6-voice pool (carrier + FM modulator), steal the quietest.
- Pulse: 1 voice. Ambience: 5 pre-rendered loops.
- `PeriodicWave` timbres (8-12 partials) instead of raw saw.
- Envelopes: `cancelAndHoldAtTime` then `setTargetAtTime`, attack ≥8 ms. No clicks.

**Gain staging** (dBFS RMS): pad -22, lead peaks -26, pulse -28, ambience -30; per-mood trim calibrated offline to ±1.5 dB. Master → EQ → limiter (`DynamicsCompressor` -6 dB, knee 0, 20:1, 3/250 ms) → tanh `WaveShaper` → out.
**Reverb**: keep `ConvolverNode` (native) with a designed IR: 2.4 s, exponential decay, 20 ms pre-delay, highs decaying 3× faster, decorrelated L/R, rendered once offline. Send band 250 Hz-5 kHz. Phone: 1.4 s. Delay = dotted eighth of mood tempo.

**Mood transitions**: all moods are modes on one per-book tonic, so a change is a modal modulation. Wait for the next chord boundary (≤4 s); hold common tones; other voices move ≤2 semitones; tonic shifts only by 4th/5th through a sus2 pivot. Cutoff, tempo, send glide with τ = 2 s. Lead finishes its phrase. Hysteresis: 2.5 s dwell.

**Intensity i (0-1)**: cutoff × 2^(i-0.5); lead density × (0.6+0.8i); reverb send 0.45-0.15i; pulse above 0.35; 9th added above 0.6; detune +40%. Loudness moves ≤2 dB: intensity is brightness and motion, never volume.

## 3. Mood recipes

Semitone offsets from tonic T (default MIDI, transposed per book).

| Mood | T, mode | Chords | Pad | Lead / pulse |
|---|---|---|---|---|
| Huzur | 48, Lydian pentatonic | [0,7,14,16] [5,12,16,21] [-3,7,12,16] | triangle + octave sine, LP 900, ±5 c, attack 4 s, 14 s/chord | soft bell, stepwise, 1 note/6 s |
| Hüzün | 45, Aeolian | [0,7,14,15] [-4,3,7,12] [-7,0,5,8] [-5,2,7,10] | triangle + 6-partial wave, LP 600, 17 s | "cello", attack 0.4 s, vibrato 4.5 Hz, falling steps, 1/8 s |
| Gerilim | 38, Phrygian | [0,7,13,15] [0,6,12,15] [-2,5,10,13] | 10 partials, ±12 c, LP 450 Q 2, cutoff LFO 0.07 Hz, 10 s | no melody; high tremolo tone; heartbeat 60-76 bpm, 55 Hz sine + 110 Hz triangle |
| Karanlık | 36, Locrian drone | [0,7,13,18] [0,6,11,15] [-1,6,11,14] | sub sine, 1.5 Hz beating pair, breath noise BP 300, 20 s | FM bell ratio 1.41, attack 1.2 s, tritones, 1/15 s |
| Neşe | 53, major | [0,7,12,16] [5,12,19,21] [-5,7,12,14] [-3,4,7,12] | triangle, LP 1500, 8 s | pluck (0.5 s decay), 3-note arpeggios on 84 bpm eighths, ceiling MIDI 84 |
| Aşk | 51, major 7/9 | [0,4,11,14] [-7,4,9,12] [2,9,12,17] [-5,5,9,12] | triangle + sine, ±7 c, LP 1000, 13 s | legato rising 6ths, delayed vibrato, 1/3.5 s |
| Macera | 50, Dorian | [0,7,10,17] [-2,5,10,12] [-7,0,5,9] | 8 partials + sub, LP 1200, 10 s | horn, 4th/5th leaps; soft tom, 6/8 at 96 bpm |
| Gizem | 52, whole-tone | [0,4,8,14] [-2,4,8,14] [0,7,11,15] | triangle, LP 750 Q 4 sweep, 15 s | glass FM ratio 3.5, every 4-9 s, phrases end on 2 or #4 |

## 4. Ambience

Pre-rendered at init: 9-13 s coprime loops, decorrelated stereo, pink/brown noise. Max two at once, 3 s crossfade.

- **Rain**: pink HP 1.5k/LP 8k + 8-25 droplets/s (15 ms bursts, 2-6 kHz). *yağmur, sağanak, çisele; rain, drizzle, downpour.*
- **Wind**: brown, BP 300-900 Hz Q 3 swept by LFOs 0.07 + 0.11 Hz. *rüzgâr, esinti, fırtına, tipi; wind, gale, breeze.*
- **Sea**: brown LP 500 + foam HP 2k; 3 s swell, 6 s retreat. *deniz, dalga, sahil, kıyı; sea, waves, shore, tide.*
- **Fire** (new): brown LP 150 + Poisson crackles 3-10/s. *şömine, ocak, alev, kor; hearth, flames, embers.* Not bare "ateş" (fever, gunfire).
- **Night** (new): 4.2 kHz sine, 30 Hz pulses, 3-pulse chirps, -38 dB. *cırcır böceği, ağustos böceği; crickets, cicadas.*

## 5. Microphone mode

Always: master -6 dB; EQ -9 dB at 1.2 kHz Q 0.7 (speech band); lead muted; ambience -12 dB (broadband noise hurts recognition most); pulse low-passed at 120 Hz; reverb halved. Optional: `getUserMedia({echoCancellation:true})` analyser as voice detector, extra -4 dB while speaking (150 ms attack, 1.2 s release); skip on Android. Hint: "kulaklık önerilir".

## 6. Unrequested ideas

1. **Book key + leitmotif**: hash(title) sets the tonic (±3 semitones) and a 4-note motif that returns in every mood's scale.
2. **Reading-pace tempo**: words/min, 30 s smoothing, scales harmonic rhythm 0.8-1.25×. No scroll for 40 s: thin to drone.
3. **Chapter cadence**: at a heading, plagal IV→I, 4 s near-silence, the next chapter opens with the leitmotif.

## 7. Tests

Engine takes an injected context. Offline, 60 s, 8 moods × i = 0/0.5/1:
- peak < -1 dBFS; RMS -30 to -16; mood spread ≤3 dB; |DC| < 0.001
- no 500 ms window below -60 dBFS after second 5
- clicks: max sample delta < 0.15
- all 56 transitions: RMS deviation ≤3 dB
- node counter on `ctx.create*`: count after 200 mood changes = count after init
- driver ticked at 1 s: no event in the past
- mic mode: 300-3400 Hz energy ≥9 dB lower
- same seed = bit-identical render; 60 s renders in < 3 s
