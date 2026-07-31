# Bible reader — scroll-play video plate (locked recipe)

**Status:** Working on Desktop Chrome (2026-07-28)  
**Product:** DiscipleSpaces  
**AnimateStudio job:** `untitled-job-ms407yaf` (cross animation)  
**Live pattern:** muted cross MP4 behind Bible chapter text; timeline scrubbed by scroll  

**Launcher pattern (agents / all animated sites):**  
`$LAUNCHER/skills/animated-site/references/scroll-play-video-plate.md`  

This document is the **project dogfood SSOT** for how the plate was made to work. Desk agents follow the launcher reference; keep both in sync when the recipe changes. Do not “simplify” the layout rules without re-testing Chrome sticky + seek.

---

## What the operator wanted

1. **Not** a looping background that always plays.  
2. **Scroll-play:** as the reader scrolls the passage, the video advances; when scroll stops, the frame freezes.  
3. **Stretch to passage length:** short chapter or long chapter — full video (through zoomed woodgrain end frame) maps across the **whole reading surface**.  
4. **Next / Prev chapter** → jump to top of page and reset the plate.

---

## Files (do not scatter)

| Role | Path |
|------|------|
| Component | `src/components/BibleReaderVideoBg.tsx` |
| Styles | `src/index.css` (`.bible-reader*`, `.bible-reader-video-bg*`) |
| Mount + chapter chrome | `src/pages/Bible.tsx` |
| Asset | `public/media/crossanimation1-web.mp4` |
| SW cache bust | `public/sw.js` (`SHELL_CACHE` bump when shell/media strategy changes) |
| Master + web encode | AnimateStudio job `source/crossanimation1.mp4` + `source/web/crossanimation1-web.mp4` |

**Public URL constant:** `BIBLE_CROSS_VIDEO_SRC` (include `?v=scrubN` when re-encoding so CDN/SW cannot pin a stale file).

---

## The bug that looked like “video doesn’t scrub”

### Symptom

Plate moved or showed for the **first screen or two**, then seemed frozen / gone. Full chapter scroll never reached woodgrain.

### Root cause (Chrome)

```text
position: sticky is DISABLED if ANY ancestor has overflow: hidden
(including Tailwind class overflow-hidden on the <article>).
```

The Bible reader article had `overflow-hidden` for rounded clipping. That killed sticky for the plate. The video only lived in the first viewport of the card; after a couple of scrolls it left the viewport — **not** a pure seek/math failure.

### Lock-in rule

While the video plate is active:

- Article: **`overflow-visible`** (not `overflow-hidden`).  
- CSS: `.bible-reader--with-video { overflow: visible !important; }`  
- Reduced-motion only: `overflow-hidden` is OK (no sticky plate).

**Never** put `overflow-hidden` on:

- `.bible-reader` when `--with-video`  
- `.bible-reader-video-bg` (the absolute full-height host)

Clip the **pin** only: `.bible-reader-video-bg__pin { overflow: hidden; }` — that wrapper is the sticky element’s own box, not an ancestor scrollport that breaks stickiness.

---

## Layout recipe (must keep this structure)

```text
article.bible-reader.bible-reader--with-video   ← position:relative; overflow:VISIBLE
  div.bible-reader-video-bg                     ← position:absolute; inset:0; NO overflow:hidden
    div.bible-reader-video-bg__pin              ← position:sticky; top:0; height:100dvh
      video.bible-reader-video-bg__media
      div.bible-reader-video-bg__scrim
  div.bible-reader__content                     ← position:relative; z-index:1  (MEASURE THIS)
    … header + verses …
```

| Layer | Why |
|-------|-----|
| Absolute host full article height | Sticky needs a tall containing block that scrolls with the chapter |
| Sticky pin `100dvh` | One viewport plate stays in view for the **whole** chapter scroll |
| Content measured for progress | Verses load async; height must track `.bible-reader__content`, not the sticky media |

---

## Timeline / progress recipe

**Map scroll through the content block → `video.currentTime`.**

- **Progress 0:** content top at reading band (under sticky app header).  
- **Progress 1:** content bottom at bottom band (above tab bar) → last frame (woodgrain).  
- Formula (long chapter):

  ```text
  usable     = viewH - topInset - bottomInset
  scrollable = contentHeight - usable
  along      = topInset - content.getBoundingClientRect().top
  progress   = clamp01(along / scrollable)
  currentTime = progress * duration
  ```

- **Insets:** measure sticky `header` bottom + `nav[aria-label="Main"]` top (fallbacks 56 / 72).  
- **Remeasure:** `ResizeObserver` + `MutationObserver` when verses mount (async chapter load stretches the timeline).  
- **No free-run `play()` loop** for timeline — free-run overshoots; idle snap then “reverts a frame.”  
- **Seek queue:** wait for `seeked` (or short timeout) so Chrome doesn’t drop rapid `currentTime` sets.

---

## Media encode recipe (scrub-safe)

Remote progressive MP4s with sparse keyframes **look** stuck mid-scrub even when JS is correct.

| Setting | Why |
|---------|-----|
| **All I-frames** (`-g 1 -bf 0`, every frame keyframe) | Random-access seek lands on real frames end-to-end |
| **Muted, no audio** | Background plate; operator “must not: audio” |
| **`+faststart`** | moov at front for web |
| **Blob URL after `fetch`** | Full file in memory → reliable seek (range-request seeks often stall after early frames) |
| **Query bust `?v=scrubN`** | Force clients past CDN/old encode |

Example encode (from master):

```bash
ffmpeg -y -i source/crossanimation1.mp4 -an \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline \
  -vf "scale=720:-2" -preset fast -crf 28 \
  -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
  -x264-params "keyint=1:min-keyint=1:scenecut=0" \
  -movflags +faststart \
  public/media/crossanimation1-web.mp4
```

Then bump `?v=scrubN` in `BIBLE_CROSS_VIDEO_SRC` and redeploy.

---

## Chapter change recipe

In `Bible.tsx`:

1. **`passageKey={\`${bibleVersion}-${bookId}-${chapter}\`}`** on `BibleReaderVideoBg` → remount / reset plate.  
2. **Next / Prev** call `scrollBibleToTop()` (`window.scrollTo(0)` + `readerTopRef.scrollIntoView`).  

Without (1)+(2), the plate stays mid-timeline on a new chapter.

---

## Reduced motion / a11y

- `usePrefersReducedMotion` → component returns `null`.  
- CSS `@media (prefers-reduced-motion: reduce)` hides `.bible-reader-video-bg`.  
- Always `muted` / `volume = 0` / no controls.  
- `aria-hidden` on the plate (decorative).

---

## Deploy / cache

- Pages project: `disciple-spaces` (`npm run build` via Node 20 + `vite build` if full `tsc` hangs).  
- Bump `SHELL_CACHE` in `public/sw.js` when shell or media strategy changes.  
- `/media/` fetch: network / no sticky stale encode.  
- Hard refresh once after deploy if SW was old.

---

## Regression checklist (before shipping plate changes)

- [ ] No `overflow-hidden` on `.bible-reader` when video active  
- [ ] Sticky pin is `100dvh`, host is absolute full section height, **host has no overflow:hidden**  
- [ ] Progress uses `.bible-reader__content` height + ResizeObserver  
- [ ] Encode is all-I-frame (or proven scrub-safe) + blob load  
- [ ] Desktop Chrome: long chapter — plate **stays in view** to last verse and ends on woodgrain  
- [ ] Next chapter → top of page + plate at frame ~0  
- [ ] `prefers-reduced-motion: reduce` → no plate  

---

## What failed earlier (do not reintroduce)

| Approach | Why it failed |
|----------|----------------|
| Autoplay + loop | Operator wanted scroll-timed, not ambient loop |
| Free-run `play()` + rate + idle snap to progress | Overshoot then frame “revert” on stop |
| Progress = card flying through full viewport (`height + viewH`) | Burned most of the clip before reading started |
| Sparse keyframe web encode | Seeks stuck on early frames |
| Remote URL seek only (no blob) | Chrome range seeks incomplete |
| `overflow-hidden` on article “for rounded corners” | **Killed sticky** — plate only first screen |

---

## One-line ADR

**Muted all-I-frame MP4, blob-loaded, sticky viewport pin inside overflow-visible reader, `currentTime` hard-locked to content-scroll progress so full passage ≡ full clip.**

*Locked 2026-07-28 after Chrome validation on deploy `bb18e955` / subsequent ships.*
