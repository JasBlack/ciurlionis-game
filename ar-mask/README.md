# Mask Layer

Cover your face in live camera or recorded video with a tracked 3D mask, so you can publish real footage without
showing who you are. It runs entirely in the browser: the video never leaves your computer, and after the first
install it makes no network requests at all.

This folder is a separate app. It shares nothing with the game in the rest of the repository and can be moved to a
repository of its own as it is.

## Run it

```bash
cd ar-mask
```

```bash
npm install
```

```bash
npm run dev
```

Then open `http://localhost:5420` in Chrome or Edge. `npm install` also copies the tracker's runtime out of
`node_modules` and downloads its two model files (about 13 MB) into `public/`, once.

`npm run build` writes a static site to `dist/` that can be served from any folder of any web server. The camera
needs `https://` or `localhost`.

## Host it

It is a static site with no server side, so it can be published on GitHub Pages like any other. Hosted, it still
does all its work in the visitor's browser: the page, the tracker and the models are downloaded once (about 28 MB,
then cached), and no video goes back.

GitHub Pages gives one site and one address per repository, so `mask.jas.black` needs a repository of its own:

1. Create an empty repository and put the contents of this folder at its top (not the folder itself). The
   workflow in `.github/workflows/pages.yml` and the `CNAME` file come with it.
2. In the repository: Settings, Pages, Source "GitHub Actions". Custom domain `mask.jas.black`, and once the
   certificate is issued, Enforce HTTPS.
3. At the DNS host for `jas.black`: a `CNAME` record for `mask` pointing at `jasblack.github.io`.
4. Push to `main`. The workflow installs, downloads the models, builds and publishes.

## What it does

- **Source**: your camera, or a video file dropped on the page.
- **Masks**: three built in, and any `.glb` head model you drop on the page. Imported models are remembered in
  this browser.
- **Fit**: size, position, rotation and stretch per mask, remembered per mask. "Fit by points" shows where your own
  eyes and mouth sit behind the mask as three dots; drag them onto the mask's eyes and mouth and it is resized and
  moved to match. "Show the outline of a real head" draws a wire head so you can see whether the mask encloses it.
- **Privacy patch**: under every mask the face itself is pixelated, painted out or blurred, so a gap in a mask
  (an open mouth, a thin model, a poor fit) shows blocks, never skin.
- **Save**: *Export video* re-renders a video file frame by frame. *Record* captures the picture as it plays.

## Why the mask does not flicker off

Filter apps lose the face when you turn, and for the frames it takes to find you again the mask is gone. Five
things prevent that here.

1. **A frame is never shown before its mask.** Each video frame is copied once. The tracker reads that copy and
   the picture is composed from that same copy. If tracking is slow the picture is late, but it is never a frame
   ahead of its mask. Export goes further: it decodes the file one frame at a time and waits for each, so a slow
   computer only makes the export take longer.
2. **A second tracker takes over when the face cannot be read.** In profile or turned away there is no face mesh
   to find. The body-pose tracker still knows where the nose, ears and shoulders are, and the mask follows those
   (state "Following head from body").
3. **Small faces are looked at again, enlarged.** The face tracker cannot see a face much smaller than a fifth
   of the frame. For every head it has not locked, the app crops in on that head and runs the face mesh on the
   enlarged crop, so a face across a room still gets a full lock, with expression.
4. **Losing track is not a reason to remove a mask.** With no evidence at all the mask coasts briefly on its last
   velocity and then stays where it was. A head is let go when it was last seen leaving the picture, or when the
   body tracker reports the picture empty of people; otherwise it is kept.
5. **When it is blind, it hides everything.** With "Hide the whole picture if a head is lost" on (the default), any
   frame in which a head that was just there cannot be located is pixelated from edge to edge, and it stays that
   way for as long as anybody is still in the picture, because "not detected" is not "not there". With it off,
   a lost head keeps its mask and a widening patch for 1.5 s and is then let go.

The masks are also closed shells larger than a real head, so there is no angle from which the wearer shows past
the edge.

### What it cannot promise

- A face that has never been detected cannot be covered. Someone only a few pixels tall in the distance, entering
  at the very edge of the frame, or in near darkness may be visible for the frames before either tracker picks
  them up. In testing, people walking in from the far end of a corridor were uncovered until their heads were
  about 10 pixels across.
- More than one person works best when faces are visible: the body tracker tends to follow one body at a time,
  so two people who both turn away at once will often trip the whole-picture hide.
- It hides the head. Voice, body, clothes, tattoos, the room and the file's metadata still identify people. Turn
  off "Keep the sound when exporting" if your voice matters.
- **Watch every export through once before publishing it.** The status line after an export says on how many
  frames the mask fell back to body tracking or the picture was hidden; those are the places to look.

## Making masks

A mask is a 3D model of a head in `.glb` format. Three levels, each building on the last:

| | What you make | What you get |
|---|---|---|
| 1 | A head model, closed, a little larger than a real head | Follows the head at every angle. Enough to hide a face. |
| 2 | The same, with shape keys named like Apple's ARKit face shapes | It blinks, talks and frowns with you. |
| 3 | The same, with an idle animation in the file | Hair, tentacles and so on move on their own (the first animation in the file loops). |

A flat picture wrapped onto the face (the classic "face paint" filter) is deliberately not offered: it keeps the
shape of your face and disappears in profile, so it does not hide anyone.

### From a character sheet to a mask

1. **Head-only views.** Image-to-3D tools want the head large and square-on: front, side and back, neutral
   expression, plain background, at least 1024 px. A full-body turnaround leaves the head too small. An image-edit
   model can produce these from one good render of the head.
2. **Image to 3D.** Hunyuan3D, Tripo, Meshy and Rodin all take one or several views and return a textured mesh.
3. **Clean up in Blender.**
   - Keep the head (and beard, horns, hair); cut below the chin. Close any holes: what is open shows the wearer.
   - Face it down the +Y axis in Blender's front view (so it faces +Z in the exported glTF), upright.
   - Aim for under 100,000 triangles and 2K textures; it is drawn every frame.
   - Size does not matter: on import the model is scaled to head size, and Fit does the rest.
4. **Expressions (optional).** Add shape keys with these exact names; the tracker reports the same 52 and any
   that are missing are simply not animated. The ones that carry most of a performance:
   `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `browDownLeft`, `browDownRight`, `browInnerUp`,
   `browOuterUpLeft`, `browOuterUpRight`, `mouthSmileLeft`, `mouthSmileRight`, `mouthFunnel`, `mouthPucker`,
   `eyeSquintLeft`, `eyeSquintRight`, `eyeWideLeft`, `eyeWideRight`.
   Left and right are the wearer's. `eyeBlink_L`, `EyeBlinkLeft` and `blendShape1.eyeBlink_L` are all understood.
   An expression sheet is the sculpting reference: each drawn expression is a mix of a few of these shapes.
5. **Export** as glTF Binary (`.glb`) with shape keys included, and drop the file on the page.

### Built-in masks

They are generated in code (`src/masks/`), in the same head space an imported model lands in, and are the place
to look for how a mask is driven by expression.

- **Iridescent Satyr** (`satyr.js`): a procedural stand-in for the character sheet, until the sculpt exists.
- **Chrome Helm** (`helm.js`): the simplest closed cover.
- **Paper Bag** (`bag.js`): a drawn face that blinks and talks.

## How it is put together

```
src/tracking/landmarkers.js   loads MediaPipe face + pose landmarkers from this app's own files
src/tracking/headTracker.js   the three states (face / body / hold), the zoom pass, smoothing, when to let go
src/tracking/canonical.js     the head space masks are built in (cm; +X wearer's left, +Y up, +Z out of the face)
src/render/stage.js           frame copy -> privacy patch -> 3D masks -> finished picture
src/masks/                    built-in masks and the .glb loader
src/export/exporter.js        frame-by-frame file export and live recording (Mediabunny, WebCodecs)
src/main.js                   the page: sources, controls, fit by points
```

## Tests

`tests/leak.mjs` is the one that matters. It steps a video through the app a frame at a time and asks a second,
memoryless face detector where the faces really are in each frame; then it compares every pixel inside each real
face outline between the source frame and the finished picture. A pixel that is unchanged is a pixel of real face
that was shown.

```bash
npm run build && npm run preview
```

```bash
node tests/leak.mjs path/to/video.mp4 test-out/run1 30
```

The arguments are the video, an output folder and the video's frame rate; then, all optional and in this order, a
stride (3 = use every third frame, as a slow computer would), `auto` or `always` for the body tracker, a mask id,
the number of people to cover, and `on` to test with the whole-picture hide as shipped (`off`, the default, tests
the masks and patches on their own). It saves a picture of every frame that was not face-locked, because the
detector that judges the frames cannot see a face in profile either: those are for a person to look through.
It needs Playwright with Chromium available to Node.

The other scripts in `tests/` open a video and save pictures (`smoke.mjs`), run an export and save the file
(`export.mjs`), drive the camera path with a fake camera (`camera.mjs`), and walk through importing a `.glb` and
fitting it by points (`ui.mjs`, with `make-test-glb.mjs` to write a model to import).
