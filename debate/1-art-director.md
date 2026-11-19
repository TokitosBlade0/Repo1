# 1 — Art Director: "Mürekkep Havası" (Ink Weather)

## 1. Concept
**Every book has a weather, and the page shows it in ink:** the whole app is black ink on cool paper, and the only colour on screen at any moment is the current mood, staining one ink-wash plate and one hairline. Memorable because it is nearly monochrome: v1 shows eight hues at once in a canvas strip; v2 shows one, so a mood change is felt.

## 2. Palette
No brand accent. Ink is the UI colour; mood is the accent.

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#EEF0EF` (cool lime-wash, not cream) | `#0F1215` |
| `--paper-2` (bars, sheets) | `#E3E6E5` | `#171B1F` |
| `--ink` (text) | `#15181C` | `#C8CDD0` |
| `--ink-2` (secondary) | `#555C63` | `#8A9299` |
| `--rule` | `#CDD2D1` | `#272D33` |

Mood inks (light / dark):
huzur `#2C7F78` / `#6FC2B6` · hüzün `#3F5F9E` / `#8AA6DC` · gerilim `#B5531B` / `#E79A5A` · karanlık `#5B2A4A` / `#B77FA4` · neşe `#A47C00` / `#E3C24E` · aşk `#B03A5B` / `#EC8CA3` · macera `#4F7422` / `#A6CB61` · gizem `#5A45A0` / `#A995E4`

Tint rules: `--mood` touches only (a) the plate image, (b) a 2px margin rule beside the active paragraph, (c) the current segment of the mood map, (d) the play glyph. Never text colour, never a background behind text. Body text stays `--ink` on `--paper` (≥ 13:1) in every mood.

## 3. Type (all with Turkish glyphs; set `lang="tr"` so uppercase İ/I is correct)
- **Reading:** Source Serif 4, optical size on, 400 / 400 italic / 600. 19px desktop, 17px phone, line-height 1.7, measure 62ch, `hyphens:auto`.
- **Display:** Instrument Serif, italic only — book title, mood name, chapter numerals. Large (clamp 2.4–4.5rem) on the title page, 1.1rem in the player.
- **UI:** Instrument Sans 500, 13px, letter-spacing .02em; labels in sentence case, no all-caps microcopy.
- Numerals: `font-variant-numeric: tabular-nums oldstyle-nums` in reading, lining in UI.

## 4. Layout
**Reading view.** Desktop ≥1100px: two fixed zones. Left 36% is the *plate* — the ink-wash image, full height, bleeding off the left edge, with the mood name set once in Instrument Serif italic at its foot. Right is the text column, plain paper, nothing behind it. Phone: plate becomes a 112px strip under the top bar that collapses to 0 once you scroll one screen; text is full width with 20px gutters. No cards, no shadows, radius 2px maximum, 1px rules only.

**Mood map.** Not a canvas bar on top. A vertical *thread* in the gutter between plate and text: 3px wide, full height, one segment per paragraph in `--rule`, with read segments in their mood ink and a 9px tick at the current position. Tap/drag to jump; hover shows chapter title. Phone: same thread, horizontal, 3px, pinned under the top bar.

**Player.** One 48px line at the bottom, hairline top border: SVG play/pause glyph · mood name (italic) · a single-stroke waveform line · mic glyph · "Ayarlar". Volume, override, atmosphere, own tracks, theme, font size live in one bottom sheet. After 4s of scrolling the top bar and player fade to 25% opacity; any pointer move restores them.

**Opening screen.** A title page, not a dashboard: emblem, "Satır Arası" in Instrument Serif italic, cover plate at right. Three typographic actions as underlined lines — *Dosya aç*, *Metin yapıştır*, *Örnek öyküyü oku* — plus drop-anywhere. Below, the shelf: each saved book is a vertical **spine** 28px wide whose stripes are its mood map (a mood barcode), title set vertically.

## 5. Imagery
All plates are **black ink on pure white**, so one JPEG serves both themes and every tint: light theme `mix-blend-mode:multiply` over paper; dark theme `filter:invert(1)` + `mix-blend-mode:screen`. A `--mood` overlay with `mix-blend-mode:color` at 55% stains it. Opacity 0.9 on the plate (it never sits under text).

Shared style suffix (append to every prompt):
> *Monochrome sumi ink wash and dry-brush on pure white paper, black ink only, no colour, large areas of untouched white, soft bleeding edges, visible paper grain, minimal composition with the subject in the centre third, no text, no border, no frame, no signature, square 1:1.*

1. `huzur.jpg` — A still bay at dawn, one small rowboat at rest, low horizon, two faint hills.
2. `huzun.jpg` — A single bare tree on an empty plain, long rain streaks falling, one bird leaving.
3. `gerilim.jpg` — A steep stairwell seen from above, hard diagonal brush strokes, a door ajar at the bottom.
4. `korku.jpg` — A dense black forest edge, trunks merging into one dark mass, a narrow pale path entering it.
5. `nese.jpg` — Swallows wheeling over rooftops and laundry lines, quick light splashes, lots of white sky.
6. `ask.jpg` — Two herons standing close in shallow water, reeds bending toward each other.
7. `macera.jpg` — A sailing ship leaning into large waves below a mountain coast, energetic sweeping strokes.
8. `gizem.jpg` — A lighthouse almost dissolved in fog, only the lantern and a faint beam defined.
9. `kapak.jpg` — An open book lying flat whose pages lift into a mountain range and drifting clouds.
10. `amblem.jpg` — A single thick horizontal brush stroke with a thin second stroke beneath it, like two lines of text, centred, generous white margin.

Paper grain is an inline SVG `feTurbulence` at 4% opacity, not an image.

## 6. Motion
- Plate change: 4s crossfade, new plate revealed through a radial mask growing from centre (ink soaking in). `--mood` colour: 2.5s linear.
- Active-paragraph rule: slides with a 600ms ease-out; opacity breathes ±15% at the music's chord rate (9–18s per cycle).
- Waveform: one line, 30fps cap, paused when tab hidden.
- **Still, always:** the text column, type size, layout. Nothing parallaxes, nothing bounces, no scroll-triggered reveals.
- `prefers-reduced-motion`: instant swaps, no breathing, waveform replaced by a static line.

## 7. Three unrequested ideas
1. **Sesle mürekkeplenen satır.** In listen mode, unread text sits at `--ink-2`; words darken to `--ink` as the mic hears them. Your voice inks the page — and it doubles as visible proof that recognition is working.
2. **Bölüm ayracı.** Finishing a chapter offers a 360×1080 bookmark rendered on canvas: mood barcode of that chapter, title, date, one sentence you long-pressed. Download as PNG.
3. **Dalıp gitme.** No scroll for 90s: the music thins to a single drone and the plate fades to 40%; the first scroll brings both back over 3s. The app notices you stopped reading and gets out of the way.
