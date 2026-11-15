# Mask Layer (mask.jas.black)

One of the JAS.BLACK tools. Covers faces in a video file or a live camera with a tracked 3D mask, in the browser.
In-app title MASK LAYER; on cards and jas.black it is Mask. Version in `<body data-version>` (shown only while the
title is hovered).

For now this is the folder `ar-mask/` in `JasBlack/ciurlionis-game`. It shares nothing with the game. It is meant
to become `JasBlack/mask`: put the contents of this folder at the top of that repository.

## Stack

- Vite 8, plain JavaScript modules, no framework. three.js for the masks.
- MediaPipe Tasks Vision (`@mediapipe/tasks-vision`): face landmarker (478 points, 52 blendshapes, head pose),
  pose landmarker (full), and a second face landmarker in image mode for the zoom pass.
- Mediabunny for reading and writing video through WebCodecs (export and record). Not MediaRecorder.
- Nothing loads from another host at run time. The MediaPipe wasm runtime and both models are copied or
  downloaded into `public/` by `scripts/fetch-assets.mjs` on `npm install`; fonts are in `src/fonts/`.

## Commands

```bash
npm install        # also runs scripts/fetch-assets.mjs (wasm runtime + models into public/)
npm run dev        # http://localhost:5420
npm run build      # dist/
npm run preview    # serves dist/ on http://localhost:5421 (the tests use this)
node scripts/make-icons.mjs    # the six icon files from public/favicon.svg (needs Playwright)
```

## Folder map

```
index.html                    the page: head (titles, link preview, icons), top bar, left column, stage, right column
src/main.js                   wiring: sources, controls, status line and lights, fit by points
src/family.css                kit/family.css from the JAS.BLACK blueprint, unchanged. Tokens and shared components
src/family.js                 kit/family.js as a module (one difference, noted at the top of the file)
src/mask.css                  what this tool adds: fonts, mask tiles, toggle keys, pins, panels on the stage
src/tracking/landmarkers.js   loads the three MediaPipe landmarkers from this app's own files
src/tracking/headTracker.js   the three states (face / body / hold), the zoom pass, smoothing, when to let go
src/tracking/canonical.js     the head space masks are built in (cm; +X wearer's left, +Y up, +Z out of the face)
src/render/stage.js           frame copy -> cover -> 3D masks -> finished picture; mask thumbnails; fit preview
src/masks/                    satyr.js, helm.js, bag.js (made in code), glb.js (imported models), geom.js
src/export/exporter.js        frame-by-frame export, live recorder, both constant frame rate
src/storage.js                localStorage under mask-v1.*, imported .glb files in IndexedDB
public/                       icons, og.jpg, site.webmanifest, LICENSES/, .nojekyll (+ mediapipe/, models/: not in git)
design/                       the jas.black card (1920 x 1008), the picture on it, a loop, the card generator entry
tests/                        Playwright scripts, see below
.github/workflows/pages.yml   builds and publishes to GitHub Pages. Inert until this folder is its own repository
```

## Design

Built on the JAS.BLACK family blueprint: console layout (top bar; left column 268 px; stage; right column
282 px), tokens from `family.css`, Archivo 800 for the title only, IBM Plex Mono for the rest.

- No `easy | console` switch and no numbered steps: the owner asked for the full console only, with plain panel
  titles. Both columns always show. Do not put them back.

- Do not add colours. Everything in `mask.css` uses the family's tokens; the two literals it has (`#0b0b0c` text
  on green, the LED glow) are the same ones `family.css` uses for those parts.
- Colours drawn into the picture (tracking points green, head outline and pins violet, the fit preview's ground)
  are read from the tokens in `main.js` and handed to the stage with `setPalette`.
- Text that sits on the dot grid has `.on-grid`. Panels on the stage (opening card, guide, fit bar) are `.panel`s,
  so they follow the theme while the stage stays dark.
- Toggles are `.key.toggle` with `aria-pressed`: an LED in the key, lit while on.
- Right-click resets a slider to the `value=""` in the markup (the tool's default), not to what was saved.
  That is the one change from the kit's `family.js`: this tool restores saved settings into its sliders on load.
  The scrubber is exempt (its position is not a setting).
- Icon: `public/favicon.svg` is the master. Change it, run `scripts/make-icons.mjs`, and add `?v=2` to the icon
  links in `index.html`.
- Card: made with the blueprint's `cards/generator/make-card.js` from `design/card-entry.json` and
  `design/card-picture-960x1008.jpg` (the mask, rendered by the tool). `public/og.jpg` is the 1200 x 630 result.

## Deployment

GitHub Pages through `.github/workflows/pages.yml` (Settings, Pages, Source "GitHub Actions"), custom domain
`mask.jas.black` (`CNAME`), DNS `CNAME mask -> jasblack.github.io`, Enforce HTTPS on (camera and WebCodecs need a
secure context). On CI a model that cannot be downloaded fails the build.

Still to do on jas.black (repo `jas-black`, not reachable from here): the entry in `site/content.js`, the card
as `site/tools/media/mask.webp`, the icon in `site/tools/icons/`, and the loop from `design/`.

## Tests

All need `npm run build`, `npm run preview`, and Playwright with Chromium available to Node.

- `tests/leak.mjs <video> <out> [fps] [stride] [pose] [mask] [people] [strict]`: the one that matters. Steps a
  video through the app frame by frame; a second, memoryless face detector says where the faces really are; every
  pixel inside each real face outline is compared between source and result. Saves a picture of every frame that
  was not face-locked, for a person to look through (the judging detector cannot see a profile either).
- `tests/export.mjs <video> <out file>`: exports and saves. Check the result with ffprobe (frames in = frames out).
- `tests/camera.mjs <camera.y4m> <out>`: live path with Chromium's fake camera, mirror, record.
- `tests/ui.mjs <video> <glb> <out>`: import a `.glb`, fit by points, right-click slider reset, phone width.
- `tests/smoke.mjs`, `tests/make-test-glb.mjs`: pictures of the page; a small model with three shape keys.

## Status

Works (checked in headless Chromium, software rendering, on public sample footage):

- Face lock, body fallback in profile and turned away, zoom pass for small faces, hold and whole-picture hide.
  Single person: no dropped mask and no face pixels shown across 528 frames of head turns, also with two of every
  three frames skipped.
- Export: H.264 MP4, constant frame rate, frames in = frames out, sound carried over.
- Record: H.264 MP4 at a constant 30 frames a second.
- `.glb` import with ARKit shape keys, fit by points, fit sliders and reset, light and dark, phone width.

Known limits:

- A head never detected cannot be covered: people a few pixels tall in the distance are bare until about 10 px.
- Several people: the body tracker follows one body at a time; two people turned away at once trip the hide.
- Record has no sound. Export holds the whole output in memory, so very long videos may not fit.
- The Iridescent Satyr is made in code from the character sheet: a stand-in until the sculpt exists as a `.glb`.

Unverified:

- A real camera and a real graphics card (so no real-time frame rate has been measured), Safari, phones.
- The Pages workflow has not run: it cannot until the repository exists.

## Gotchas

- MediaPipe's face detector is short-range: a face under about a fifth of the frame is not found in the whole
  picture. That is why `_zoomIn` exists. Do not remove it to save time; it only runs for heads that are not locked.
- The head pose from a zoomed crop was solved for a camera that sees only the crop. `_zoomIn` converts it: depth
  by the ratio of picture heights, offset by where the crop sits, rotation by the angle between the two lines of
  sight. Skipping the rotation tilts masks near the frame edges.
- MediaPipe needs timestamps that only go up. The tracker keeps its own clock (`_ts`); never feed it media time.
- A seek resets the tracker (nobody carries over a jump in time). Tests that step frames by seeking must set
  `state.manual = true`, or every frame is tracked from scratch and the test measures the wrong thing.
- A body may reclaim a lost head only within reach for how long it has been lost. Without that limit one mask
  hops between two people as the body tracker alternates between them.
- With `failClosed` (the hide-picture key) a lost head is not let go on a timer while anybody is in the picture.
- Dark, glossy three.js materials with iridescence render as chrome. The mask's dark parts have their own
  material with none.
- The hair cap of the satyr is laid out meridian by meridian down to the hairline, so its edge is smooth. Cutting
  triangles out of a sphere by a threshold gives a stepped edge.
- `renderer.setSize` is changed and put back by `Stage.thumbnail`; call it only between frames.
- The exporter sets `frameRate` (constant frame rate out). For a steady source that is frame for frame; for a
  variable one frames are repeated or left out to keep the rate. Every frame that is written is masked either way.
