# Čiurlionis · Kelionė

A walk through the paintings of M. K. Čiurlionis, as a game. The painter swims out of the sea, and travels through
six landscapes taken from a short film about him. In each, three pearls of light are to be found; when he has them
a ring of light opens, and the ring is the way into the next. If he is long without finding one, sparks leave him
and drift the way it lies.

It runs in the browser (three.js, WebGL2). Everything in the picture is a stroke of paint pinned to the world,
drawn with Patch's [oil paint block](https://patch.gg/blendi/oil-paint), restyled toward tempera on card.

## Play

```bash
npm install
npm run dev
```

Then open `http://localhost:5410`. Use Chrome or Edge with a real graphics card.

| | |
|---|---|
| Move the mouse | look: the view leans toward the side the mouse is on, and keeps turning while it is at the edge |
| Click (or tap) the ground or the sea | walk or swim there; sparks wind in to the spot |
| Drag (either button, or a finger) | turn the view directly |
| The mouse, on the salamander in the air | it flies toward it: to the sides to turn, up to climb, down to dive |
| A D, on the salamander in the air | turn (it also flies where you look) |
| V | try the next finish (plain, card, tempera, pastel, watercolour, haze, brushed) |
| W A S D | swim, walk; on the salamander W is faster, S slower |
| Shift | run |
| Space | jump |
| Mouse wheel | step the eye back or in |
| Enter | full screen |
| M | music on / off |
| F2 | frames a second and render resolution |
| H | hide the hint |

## The six levels

| | Level | What is there | The three pearls | How you leave |
|---|---|---|---|---|
| I | Jūra (The Sea) | Rex on his pedestal, the striped hills, the great bird, the dandelion | on the water, on a hillside, over the dandelion | ring of light on the hilltop |
| II | Diena (Day) | willows, figures in the clouds, the round wood, the ram's ledge, the golden cathedral | between the willows, in the wood, on the ledge | ring at the cliff's edge |
| III | Saulėlydis (Sunset) | the violet way, firs, the harp of horns and its harper | along the way, and at the harp | ring at the horn's tip |
| IV | Karalių pasaka (The Tale of the Kings) | the night garden, the old king, the child who takes his hand | in the garden, at the king's knee, on the way down | ring at the pond, where the child becomes the salamander |
| V | Salamandra (The Salamander) | the canal, the wall of white figures, the gate of light, then free flight | on the canal, beyond the gate, high toward the mountain | the great ring on the mountain |
| VI | Auka (The Offering) | spires, the starred altar, the golden stair, the angel with the pearls | on the terrace, on the stair, at the summit | the angel gives him the pearls: the sea rises, he swims, and it begins again |

## Address options

Add these after the address, for example `http://localhost:5410/?at=garden&fps`.

| Option | What it does |
|---|---|
| `at=sea` `day` `sunset` `garden` `flight` `offering` (or `1`..`6`) | start at that level, without the title |
| `fps` | show frames a second (same as F2) |
| `quality=low` | fewer strokes, for slower machines |
| `ratio=1` | hold the render resolution (otherwise it is lowered if frames run long) |
| `border=1` | bare card round the edge of the picture |
| `style=0..6` | the finish: 0 plain, 1 card (the default), 2 tempera, 3 pastel, 4 watercolour, 5 haze, 6 brushed (V cycles them in play) |
| `canvas=1`, `impasto=0..2` | parts of the finish, for comparing (`canvas=1` lays a board's grain over the picture) |
| `debug` | check shaders for errors while loading |

## Build and host

```bash
npm run build
```

The game is then in `dist/`, with every path relative, so it can be served from any folder.

To put it on GitHub Pages: in the repository's Settings → Pages, set **Source** to **GitHub Actions**. The workflow in
`.github/workflows/pages.yml` then builds and publishes it on every push to `main`.

It must not be **Deploy from a branch**: that serves the source files as they are, which a browser cannot run (the
code imports `three` by name and has to be bundled first). The sign of it is a title page whose loading bar never
moves, with `Failed to resolve module specifier "three"` in the browser's console.

## What is where

| | |
|---|---|
| `src/journey/` | the game: `main.js` (the loop, and walking where a click sends him), `story.js` (levels, portals, the flight, the finale), `way.js` and `land.js` (the island), `paint.js` and `mood.js` (palettes and each level's hour), `ground.js`, `water.js`, `sky.js`, `far.js` (what the world is painted with), `kit.js` (shapes with strokes on them), `flora.js` and `pieces.js` (what stands on the island), `props.js` (the ring of light, the pearls, the sparks, the ring that marks a click), `painter.js` (the figure), `body.js` (how he stands, swims, rides and gives his hand), `brush.js` and `finish.js` (the look), `hud.js` (title, loading bar, captions) |
| `src/oilpaint/` | Patch's oil paint block, unchanged: the dab, the brush, the steady ground, shade, the canvas |
| `src/figure/` | Patch's starter man and his movement, with the Rapier physics it uses |
| `public/figure/` | the figure and his animation clips |
| `public/audio/journey.m4a` | the soundtrack, taken from the film |
| `ciurionlis_character_sheet.png` | the character sheet the figure was painted to |

For testing in a console: `lab.story.enter(0..5)` jumps to a level, `lab.teleport(x, z, faceX, faceZ)` moves him,
`lab.step(1/30, n)` advances n frames, `lab.view(eye, target)` holds the camera.

## Not in this repository

- The film itself (`*.mp4`, about 350 MB): too large for GitHub, and ignored by `.gitignore`.
- `vendor/oil-paint`, the untouched clone of the block the game was started from. To fetch it again:
  `git clone https://git.patch.gg/blendi/oil-paint.git vendor/oil-paint`

## Credits and licences

| Part | From | Licence |
|---|---|---|
| `src/oilpaint/`, and the parts of `src/figure/` written for it | Oil paint, a block by Patch ([patch.gg/blendi/oil-paint](https://patch.gg/blendi/oil-paint)), release 1.1.1 | MIT, see `LICENSE-oil-paint.txt` |
| `public/figure/starter-man.glb` | Patch's starter man, a MakeHuman figure | CC0 1.0 |
| `public/figure/starter-man-clips.glb` | Quaternius' Universal Animation Library, and Patch's own clips | CC0 1.0 |
| `src/figure/rapier/` | Rapier 0.21.0 by Dimforge | Apache-2.0, see `src/figure/rapier/LICENSE` |
| three.js 0.186.1 | npm | MIT |
| `lib/patch-block.js` | Patch's block helper | Patch's |
| `public/fonts/` | Cormorant Garamond, by Christian Thalmann (the Cormorant Project), via Fontsource | SIL Open Font License 1.1, see `public/LICENSES/OFL-1.1-Cormorant-Garamond.txt` |

The full list for the block is in `LICENCE-NOTES-oil-paint.md`.

The game's own code (`src/journey/`), the soundtrack and the character sheet belong to the film's author. No licence
has been chosen for them yet.
