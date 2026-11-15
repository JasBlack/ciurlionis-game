# Mask Layer

Cover your face in any video or live feed with a tracked 3D mask, so you can publish real footage without
showing who you are. It runs entirely in the browser: the video never leaves your computer.

One of the JAS.BLACK tools, meant to live at [mask.jas.black](https://mask.jas.black). For now it is a folder in
the game's repository; it shares nothing with the game and is ready to be a repository of its own (see
"Publish it").

## Use it

Everything is on one screen: what goes in and out on the left, the picture in the middle, the fine controls on
the right.

On the left:

- **Source.** `open video`, or drop a video anywhere on the page, or start the `camera`. `mirror` flips the
  picture left to right (on for a camera, off for a video).
- **Mask.** Pick one of the three, or drop a `.glb` head model on the page to add your own. Your own masks are
  remembered in this browser. `show mask` off leaves only the cover.
- **Cover.** What hides the face itself under the mask: `pixels`, `paint`, `blur` or `none`. With a cover on, a
  gap in a mask (an open mouth, a thin model, a poor fit) shows the cover, never skin. `hide picture if a head is
  lost` hides everything whenever a head that was just there cannot be found.
- **Save.** `export video` writes the file again with a mask on every frame and carries the sound over (turn
  `keep sound` off if your voice matters). `record` saves the picture as you see it, without sound. Both write
  MP4 (H.264) at a constant frame rate.

On the right:

- **Fit.** Size, place, turn and stretch of the mask, remembered per mask. Right-click a slider to put it back.
  `fit by points` shows three pins where your own eyes and mouth sit behind the mask; drag each onto that part of
  the mask and it is resized and moved to match. `head outline` draws a wire head, to see whether the mask
  encloses it.
- **Tracking.** How far the cover reaches past the face, how many people to cover, and the tracking points.
- **Picture.** A look for the whole picture.

The lights by the title: `live` is a source running; `lock` is green while the face is tracked and violet while
the mask is following the head from the body (in profile, or turned away); `rec` is recording. The green line
under the picture says the same in words.

Keys: `Space` pause, `E` export, `R` record, `M` mirror, `F` full screen. `guide` in the top bar is the short
version of this section; the key beside it switches light and dark.

## Why the mask does not flicker off

Filter apps lose the face when you turn, and for the frames it takes to find you again the mask is gone. Five
things prevent that here.

1. **A frame is never shown before its mask.** Each video frame is copied once. The tracker reads that copy and
   the picture is composed from that same copy. If tracking is slow the picture is late, but it is never a frame
   ahead of its mask. Export goes further: it decodes the file one frame at a time and waits for each, so a slow
   computer only makes the export take longer.
2. **A second tracker takes over when the face cannot be read.** In profile or turned away there is no face mesh
   to find. The body-pose tracker still knows where the nose, ears and shoulders are, and the mask follows those
   (the `lock` light turns violet).
3. **Small faces are looked at again, enlarged.** The face tracker cannot see a face much smaller than a fifth
   of the frame. For every head it has not locked, the app crops in on that head and runs the face mesh on the
   enlarged crop, so a face across a room still gets a full lock, with expression.
4. **Losing track is not a reason to remove a mask.** With no evidence at all the mask coasts briefly on its last
   velocity and then stays where it was. A head is let go when it was last seen leaving the picture, or when the
   body tracker reports the picture empty of people; otherwise it is kept.
5. **When it is blind, it hides everything.** With `hide picture if a head is lost` on (the default), any
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
  `keep sound` off if your voice matters.
- **Watch every export through once before publishing it.** The note under Save says after an export on how
  many frames the mask fell back to body tracking or the picture was hidden; those are the places to look.

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

## Run it yourself

```bash
npm install
```

```bash
npm run dev
```

Then open `http://localhost:5420` in Chrome or Edge. `npm install` also copies the tracker's runtime out of
`node_modules` and downloads its two model files (about 13 MB) into `public/`, once. `npm run build` writes the
static site to `dist/`. The camera needs `https://` or `localhost`.

## Publish it

It is a static site with no server side. Published, it still does all its work in the visitor's browser: the
page, the tracker and the models are downloaded once (about 28 MB, then cached), and no video goes back.

GitHub Pages gives one site and one address per repository, so `mask.jas.black` needs a repository of its own,
`JasBlack/mask`, like the other tools:

1. Create the empty repository and put the contents of this folder at its top (not the folder itself). The
   workflow in `.github/workflows/pages.yml` and the `CNAME` file come with it.
2. In the repository: Settings, Pages, Source "GitHub Actions". Custom domain `mask.jas.black`, and once the
   certificate is issued, Enforce HTTPS (the camera needs it).
3. At the DNS host for `jas.black`: a `CNAME` record for `mask` pointing at `jasblack.github.io`.
4. Push to `main`. The workflow installs, downloads the models, builds and publishes.

For the card on jas.black, `design/` has the 1920 x 1008 card, the picture on it, a short loop of the mask
turning, and the entry for the card generator.

`CLAUDE.md` has the rest: the stack, where everything is, the tests, what is and is not verified.

MIT licence. Fonts: Archivo and IBM Plex Mono, SIL Open Font License (`public/LICENSES/`).
