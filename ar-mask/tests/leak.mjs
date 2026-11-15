// The test that matters: does a face ever show through?
//
// Steps a video through the app one frame at a time, the way the live loop would see it, and for every frame asks
// a second, independent face detector (no memory of earlier frames) where the faces really are. Every pixel inside
// each real face outline is then compared between the source frame and the finished picture: a pixel that is
// unchanged is a pixel of real face that was shown.
//
//   node tests/leak.mjs <video> <out folder> [fps=12] [stride=1] [pose=auto|always] [mask=satyr] [maxFrames]
//
// stride > 1 skips source frames, as a slow computer would: harder tracking, same promise.
// Needs "npm run build" and "npm run preview" (port 5421).
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');

const [video, outDir, fps = '12', stride = '1', pose = 'auto', mask = 'satyr', maxFrames = '100000'] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5421/?delegate=cpu');
await page.waitForFunction(() => window.__maskLayer, null, { timeout: 120000 });
await page.evaluate((id) => window.__maskLayer.selectMask(id), mask);
await page.setInputFiles('#file-input', video);
await page.waitForFunction(() => window.__maskLayer.state.kind === 'file', null, { timeout: 30000 });

const result = await page.evaluate(async ({ fps, stride, pose, maxFrames }) => {
  const { stage, tracker, state, createLandmarkers, FACE_OVAL } = window.__maskLayer;
  const v = document.getElementById('video');
  v.pause();
  state.loop++; // stop the live loop: this test drives the frames itself
  state.manual = true;
  tracker.reset();
  tracker.poseMode = pose;
  Object.assign(stage.settings, { underlay: 'solid', underlayColor: '#ff00ff', strict: false, mirror: false, look: 'none' });
  const truth = await createLandmarkers({ maxPeople: 4, delegate: 'CPU', runningMode: 'IMAGE' });
  const seek = (t) => new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = t; });
  const w = v.videoWidth, h = v.videoHeight;
  const total = Math.min(maxFrames, Math.floor(v.duration * fps));
  const frames = [], shots = [];
  const t0 = performance.now();
  let lastShot = -99;
  for (let i = 0, n = 0; i < total; i += stride, n++) {
    await seek((i + 0.5) / fps);
    stage.captureFrame(v, w, h);
    const tracks = tracker.update(stage.frame, w, h, t0 + (i * 1000) / fps);
    stage.render(tracks, stride / fps);
    const real = truth.face.detect(stage.frame).faceLandmarks;
    let worst = 0;
    for (const lm of real) {
      const pts = FACE_OVAL.map((k) => [lm[k].x * w, lm[k].y * h]);
      const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])))), x1 = Math.min(w, Math.ceil(Math.max(...pts.map((p) => p[0]))));
      const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])))), y1 = Math.min(h, Math.ceil(Math.max(...pts.map((p) => p[1]))));
      if (x1 - x0 < 4 || y1 - y0 < 4) continue;
      const path = new Path2D();
      pts.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      const a = stage.fctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const b = stage.octx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let inside = 0, same = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (!stage.octx.isPointInPath(path, x + 0.5, y + 0.5)) continue;
          inside++;
          const o = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
          if (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]) < 6) same++;
        }
      }
      if (inside) worst = Math.max(worst, same / inside);
    }
    const states = tracks.map((t) => t.state);
    frames.push({ i, states, real: real.length, shown: Number(worst.toFixed(4)) });
    // keep pictures of the frames worth a human look: anything shown, and a sample of the frames with no face lock
    const odd = worst > 0.002 || states.some((s) => s !== 'face') || (real.length === 0 && states.length === 0);
    if (shots.length < 60 && ((worst > 0.002) || (odd && n - lastShot >= 4))) {
      lastShot = n;
      shots.push({ i, states: states.join('+') || 'none', shown: worst, url: stage.out.toDataURL('image/jpeg', 0.8) });
    }
  }
  return { frames, shots, w, h, total };
}, { fps: Number(fps), stride: Number(stride), pose, maxFrames: Number(maxFrames) });

for (const s of result.shots) {
  await writeFile(`${outDir}/f${String(s.i).padStart(4, '0')}-${s.states}${s.shown > 0.002 ? '-SHOWN' : ''}.jpg`, Buffer.from(s.url.split(',')[1], 'base64'));
}
const f = result.frames;
const count = (fn) => f.filter(fn).length;
const summary = {
  video, fps: Number(fps), stride: Number(stride), pose, frames: f.length,
  faceLocked: count((x) => x.states.includes('face')),
  bodyFollowed: count((x) => x.states.includes('body') && !x.states.includes('face')),
  holding: count((x) => x.states.includes('hold') && !x.states.includes('face') && !x.states.includes('body')),
  noMask: count((x) => x.states.length === 0),
  framesWithARealFaceFound: count((x) => x.real > 0),
  framesWhereRealFaceWasShown: count((x) => x.shown > 0.002),
  worstShownFraction: Math.max(0, ...f.map((x) => x.shown)),
  realFaceButNoMask: f.filter((x) => x.real > 0 && x.states.length === 0).map((x) => x.i),
  // a mask that goes away and comes back within two seconds was dropped, not finished with
  maskDropouts: f.filter((x, n) => x.states.length === 0 && f.slice(Math.max(0, n - 24), n).some((y) => y.states.length) && f.slice(n + 1, n + 25).some((y) => y.states.length)).map((x) => x.i),
  shownFrames: f.filter((x) => x.shown > 0.002).map((x) => [x.i, x.shown, x.states.join('+')]),
};
await writeFile(`${outDir}/frames.json`, JSON.stringify(f));
await writeFile(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
