// Mask Layer: wires the page together. Source (camera or file) -> tracker -> stage -> screen / recorder.
import * as THREE from 'three';
import './styles.css';
import { createLandmarkers } from './tracking/landmarkers.js';
import { HeadTracker, FACE, BODY, HOLD } from './tracking/headTracker.js';
import { CANON, FACE_OVAL } from './tracking/canonical.js';
import { Stage, IDENTITY_FIT } from './render/stage.js';
import { satyr } from './masks/satyr.js';
import { helm } from './masks/helm.js';
import { bag } from './masks/bag.js';
import { loadGlbMask } from './masks/glb.js';
import { exportFile, LiveRecorder, saveBlob } from './export/exporter.js';
import * as store from './storage.js';

const $ = (id) => document.getElementById(id);
const els = {
  video: $('video'), out: $('out'), stage: $('stage'), empty: $('empty'),
  chipState: $('chip-state'), chipPerf: $('chip-perf'),
  camera: $('camera'), file: $('file'), emptyCamera: $('empty-camera'), emptyFile: $('empty-file'),
  fileInput: $('file-input'), cameraField: $('camera-field'), cameraSelect: $('camera-select'), mirror: $('mirror'),
  masks: $('masks'), importBtn: $('import'), glbInput: $('glb-input'), showMask: $('show-mask'), maskHint: $('mask-hint'),
  sliders: $('sliders'), fitPoints: $('fit-points'), fitReset: $('fit-reset'), guide: $('guide'), coverage: $('coverage'),
  underlay: $('underlay'), margin: $('margin'), strict: $('strict'), people: $('people'), look: $('look'),
  record: $('record'), exportBtn: $('export'), keepAudio: $('keep-audio'),
  progress: $('progress'), progressFill: $('progress-fill'), progressText: $('progress-text'), exportCancel: $('export-cancel'),
  saveNote: $('save-note'), landmarks: $('landmarks'), engine: $('engine'),
  transport: $('transport'), play: $('play'), scrub: $('scrub'), time: $('time'), sound: $('sound'),
  anchors: $('anchors'), calibBar: $('calib-bar'), calibApply: $('calib-apply'), calibCancel: $('calib-cancel'),
};

const stage = new Stage(els.out);
let tracker = null;

const prefs = store.load('prefs', {
  mask: 'satyr', underlay: 'pixelate', margin: 1, strict: true, people: 1, look: 'none', keepAudio: true, showMask: true,
});
const fits = store.load('fits', {});
const masks = [satyr, helm, bag];

const state = {
  kind: null, // 'camera' | 'file'
  file: null,
  stream: null,
  tracks: [],
  exporting: false,
  calibrating: false,
  recorder: null,
  loop: 0,
  lastFrameAt: 0,
  fps: 0,
  scrubbing: false,
  manual: false,
};

// ---------------------------------------------------------------- masks and fit

const SLIDERS = [
  ['scale', 'Size', 0.6, 1.8, 0.01],
  ['x', 'Left / right', -8, 8, 0.1],
  ['y', 'Up / down', -8, 8, 0.1],
  ['z', 'Forward', -8, 8, 0.1],
  ['pitch', 'Nod', -40, 40, 0.5],
  ['yaw', 'Turn', -40, 40, 0.5],
  ['roll', 'Lean', -40, 40, 0.5],
  ['sx', 'Width', 0.6, 1.6, 0.01],
  ['sy', 'Height', 0.6, 1.6, 0.01],
  ['sz', 'Depth', 0.6, 1.6, 0.01],
];
const sliderEls = {};
for (const [key, label, min, max, step] of SLIDERS) {
  const row = document.createElement('label');
  row.className = 'slider';
  row.innerHTML = `<span>${label}</span><input type="range" id="fit-${key}" min="${min}" max="${max}" step="${step}" /><output></output>`;
  const input = row.querySelector('input'), output = row.querySelector('output');
  input.addEventListener('input', () => {
    currentFit()[key] = Number(input.value);
    output.textContent = Number(input.value).toFixed(step < 0.1 ? 2 : 1);
    applyFit();
  });
  sliderEls[key] = { input, output, step };
  els.sliders.append(row);
}

const currentMask = () => masks.find((m) => m.id === prefs.mask) ?? masks[0];
function currentFit() {
  const id = currentMask().id;
  return (fits[id] ??= { ...IDENTITY_FIT });
}

function applyFit({ quiet = false } = {}) {
  const fit = currentFit();
  stage.setFit(fit);
  for (const [key, { input, output, step }] of Object.entries(sliderEls)) {
    if (document.activeElement !== input) input.value = fit[key];
    output.textContent = Number(fit[key]).toFixed(step < 0.1 ? 2 : 1);
  }
  const gaps = stage.coverageGaps();
  els.coverage.classList.toggle('warn', gaps.length > 0);
  els.coverage.textContent = gaps.length
    ? `At this fit the mask does not reach ${gaps.join(', ')}. The privacy patch still covers the face.`
    : 'At this fit the mask encloses a real head on every side.';
  if (!quiet) store.save('fits', fits);
  redraw();
}

function renderMaskList() {
  els.masks.replaceChildren();
  for (const m of masks) {
    const b = document.createElement('button');
    b.className = 'mask';
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(m.id === currentMask().id));
    const [c1, c2, c3] = m.swatch;
    b.innerHTML = `<i class="sw" style="background: radial-gradient(circle at 35% 30%, ${c3} 0 12%, ${c1} 13% 55%, ${c2} 56%)"></i>
      <span><b></b><small></small></span>${m.kind === 'glb' ? '<span class="x" title="Remove this mask">✕</span>' : ''}`;
    b.querySelector('b').textContent = m.name;
    b.querySelector('small').textContent = m.note;
    b.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) removeMask(m); else selectMask(m.id);
    });
    els.masks.append(b);
  }
}

function selectMask(id) {
  prefs.mask = id;
  store.save('prefs', prefs);
  stage.setMask(currentMask());
  renderMaskList();
  els.maskHint.textContent = currentMask().kind === 'glb'
    ? 'Imported model. Open Fit to size and place it; “Fit by points” lines its eyes and mouth up with yours.'
    : '';
  applyFit({ quiet: true });
}

async function removeMask(m) {
  masks.splice(masks.indexOf(m), 1);
  delete fits[m.id];
  store.save('fits', fits);
  await store.forgetMask(m.id);
  if (prefs.mask === m.id) selectMask('satyr'); else renderMaskList();
}

async function importGlb(file) {
  try {
    const buffer = await file.arrayBuffer();
    const name = file.name.replace(/\.glb$/i, '');
    const id = `glb-${name}-${file.size}`;
    if (!masks.some((m) => m.id === id)) {
      masks.push(await loadGlbMask(buffer.slice(0), name, id));
      await store.keepMask({ id, name, buffer });
    }
    selectMask(id);
    $('fit-group').open = true;
  } catch (err) {
    console.error(err);
    els.maskHint.textContent = `Could not read ${file.name} as a .glb model (${err.message}).`;
  }
}

// ---------------------------------------------------------------- frames

function setChip(stateName, text) {
  els.chipState.dataset.state = stateName;
  els.chipState.textContent = text;
}

function describe(tracks) {
  if (state.exporting) return setChip('busy', 'Exporting');
  if (state.calibrating) return setChip('busy', 'Fitting');
  if (!state.kind) return setChip('idle', 'Ready');
  if (!tracks.length) return setChip('idle', 'Nobody in frame');
  if (tracks.some((t) => t.state === HOLD)) return setChip('hold', stage.settings.strict ? 'Head lost: picture hidden' : 'Head lost: holding mask');
  if (tracks.some((t) => t.state === BODY)) return setChip('body', 'Following head from body');
  return setChip('face', tracks.length > 1 ? `${tracks.length} faces locked` : 'Face locked');
}

/** One frame: copy it, track it, mask it, show it. Nothing is shown before the last step. */
function tick() {
  const v = els.video;
  if (!tracker || state.exporting || state.calibrating || v.readyState < 2 || !v.videoWidth) return;
  const now = performance.now();
  let w = v.videoWidth, h = v.videoHeight;
  const cap = 1280 / Math.max(w, h);
  if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
  stage.captureFrame(v, w, h);
  const dt = state.lastFrameAt ? Math.min(0.25, (now - state.lastFrameAt) / 1000) : 0;
  state.tracks = tracker.update(stage.frame, w, h, now);
  stage.render(state.tracks, dt);
  state.recorder?.frame(now);

  if (state.lastFrameAt) state.fps += (1000 / (now - state.lastFrameAt) - state.fps) * 0.1;
  state.lastFrameAt = now;
  describe(state.tracks);
  els.chipPerf.hidden = false;
  els.chipPerf.textContent = `${state.fps.toFixed(0)} fps · ${(performance.now() - now).toFixed(0)} ms`;
  if (state.kind === 'file' && !state.scrubbing) updateTransport();
}

function redraw() {
  if (state.calibrating) { drawCalibration(); return; }
  if (state.exporting || !state.kind) return;
  stage.render(state.tracks, 0);
}

function startLoop() {
  const id = ++state.loop;
  const v = els.video;
  let lastTime = -1;
  const step = () => {
    if (id !== state.loop) return;
    if (v.requestVideoFrameCallback) {
      tick();
      v.requestVideoFrameCallback(step);
    } else {
      if (v.currentTime !== lastTime || state.kind === 'camera') { lastTime = v.currentTime; tick(); }
      requestAnimationFrame(step);
    }
  };
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
}

// ---------------------------------------------------------------- sources

function stopSource() {
  state.loop++;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.removeAttribute('src');
  els.video.srcObject = null;
  state.tracks = [];
  state.lastFrameAt = 0;
  tracker?.reset();
}

function sourceReady(kind) {
  state.kind = kind;
  els.empty.hidden = true;
  els.transport.hidden = kind !== 'file';
  els.exportBtn.disabled = kind !== 'file';
  els.record.disabled = false;
  els.camera.textContent = kind === 'camera' ? 'Stop camera' : 'Start camera';
  stage.settings.mirror = els.mirror.checked = kind === 'camera';
  startLoop();
}

async function startCamera(deviceId) {
  stopSource();
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) },
    });
  } catch (err) {
    setChip('hold', err.name === 'NotAllowedError' ? 'Camera permission refused' : 'No camera available');
    return;
  }
  els.video.srcObject = state.stream;
  els.video.muted = true;
  await els.video.play().catch(() => {});
  sourceReady('camera');
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  els.cameraField.hidden = cams.length < 2;
  const active = state.stream.getVideoTracks()[0]?.getSettings().deviceId;
  els.cameraSelect.replaceChildren(...cams.map((d, i) => new Option(d.label || `Camera ${i + 1}`, d.deviceId, false, d.deviceId === active)));
}

function stopCamera() {
  stopSource();
  state.kind = null;
  els.empty.hidden = false;
  els.cameraField.hidden = true;
  els.camera.textContent = 'Start camera';
  els.record.disabled = true;
  describe([]);
  els.chipPerf.hidden = true;
}

async function openFile(file) {
  stopSource();
  state.file = file;
  const v = els.video;
  v.src = URL.createObjectURL(file);
  v.loop = true;
  v.muted = true;
  els.sound.textContent = 'Sound off';
  els.cameraField.hidden = true;
  try {
    await new Promise((resolve, reject) => {
      v.addEventListener('loadeddata', resolve, { once: true });
      v.addEventListener('error', () => reject(new Error('This browser cannot play that video file.')), { once: true });
    });
  } catch (err) {
    state.kind = null;
    setChip('hold', err.message);
    return;
  }
  sourceReady('file');
  await v.play().catch(() => {});
  els.play.textContent = '❚❚';
  els.saveNote.textContent = 'Export reads the file frame by frame, so every frame is masked however slow the computer is.';
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function updateTransport() {
  const v = els.video;
  if (!Number.isFinite(v.duration)) return;
  els.scrub.value = String(Math.round((v.currentTime / v.duration) * 1000));
  els.time.textContent = `${clock(v.currentTime)} / ${clock(v.duration)}`;
}

// ---------------------------------------------------------------- saving

async function toggleRecord() {
  if (state.recorder) {
    const rec = state.recorder;
    state.recorder = null;
    els.record.textContent = 'Record';
    els.record.classList.remove('on');
    const res = await rec.stop();
    saveBlob(res.blob, res.filename);
    els.saveNote.textContent = `Saved ${res.filename}: ${res.frames} frames${res.skipped ? `, ${res.skipped} left out because the encoder was busy (all saved frames are masked)` : ''}.`;
    return;
  }
  try {
    state.recorder = await LiveRecorder.start(els.out);
    els.record.textContent = 'Stop recording';
    els.record.classList.add('on');
    els.saveNote.textContent = 'Recording the picture as you see it. No sound is recorded.';
  } catch (err) {
    els.saveNote.textContent = err.message;
  }
}

let exportAbort = null;
async function runExport() {
  if (!state.file || state.exporting) return;
  if (state.recorder) await toggleRecord();
  const v = els.video;
  const wasPlaying = !v.paused;
  v.pause();
  state.exporting = true;
  exportAbort = new AbortController();
  els.progress.hidden = false;
  els.exportBtn.disabled = true;
  els.record.disabled = true;
  els.transport.hidden = true;
  describe([]);
  const started = performance.now();
  try {
    const res = await exportFile(state.file, {
      tracker, stage, keepAudio: els.keepAudio.checked, signal: exportAbort.signal,
      onProgress: (p, frames) => {
        els.progressFill.style.width = `${(p * 100).toFixed(1)}%`;
        els.progressText.textContent = `${Math.round(p * 100)}% · ${frames} frames`;
      },
    });
    saveBlob(res.blob, res.filename);
    const held = res.log.filter((f) => f.hidden).length;
    const body = res.log.filter((f) => f.states.includes(BODY)).length;
    const secs = ((performance.now() - started) / 1000).toFixed(0);
    els.saveNote.textContent = `Saved ${res.filename}: ${res.frames} frames in ${secs} s, every one masked before it was written.`
      + (body ? ` On ${body} the face could not be read and the mask followed the head from the body.` : '')
      + (held ? ` On ${held} the head was lost and the whole picture was hidden.` : '')
      + (els.keepAudio.checked && !res.audioKept ? ' The sound could not be carried into this file format.' : '');
    window.__lastExport = res;
  } catch (err) {
    els.saveNote.textContent = exportAbort.signal.aborted ? 'Export cancelled.' : `Export failed: ${err.message}`;
    if (!exportAbort.signal.aborted) console.error(err);
  } finally {
    state.exporting = false;
    exportAbort = null;
    els.progress.hidden = true;
    els.progressFill.style.width = '0';
    els.exportBtn.disabled = false;
    els.record.disabled = false;
    els.transport.hidden = false;
    state.lastFrameAt = 0;
    if (wasPlaying) v.play().catch(() => {}); else tick();
  }
}

// ---------------------------------------------------------------- fit by points

const ANCHOR_KEYS = ['rightEye', 'leftEye', 'mouth'];
const anchorAt = {}; // key -> { x, y } as fractions of the picture
let calibSlot = null;
const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

function pictureRect() {
  const r = els.out.getBoundingClientRect(), host = els.stage.getBoundingClientRect();
  const ar = els.out.width / els.out.height;
  let w = r.width, h = r.height;
  if (w / h > ar) w = h * ar; else h = w / ar;
  return { left: r.left - host.left + (r.width - w) / 2, top: r.top - host.top + (r.height - h) / 2, width: w, height: h };
}

function placeAnchors() {
  const rect = pictureRect();
  for (const el of els.anchors.children) {
    const a = anchorAt[el.dataset.key];
    el.style.left = `${rect.left + a.x * rect.width}px`;
    el.style.top = `${rect.top + a.y * rect.height}px`;
  }
}

function drawCalibration() {
  calibSlot = stage.renderCalibration();
  placeAnchors();
}

function startCalibration() {
  if (state.exporting) return;
  els.video.pause();
  state.calibrating = true;
  els.anchors.hidden = false;
  els.calibBar.hidden = false;
  els.transport.hidden = true;
  els.empty.hidden = true;
  calibSlot = stage.renderCalibration();
  // start each dot where the wearer's own feature is, seen through the mask at its present fit
  for (const key of ANCHOR_KEYS) {
    _v.set(...CANON[key]).applyMatrix4(calibSlot.root.matrix).project(stage.camera);
    anchorAt[key] = { x: (_v.x + 1) / 2, y: (1 - _v.y) / 2 };
  }
  placeAnchors();
  describe([]);
}

function endCalibration(apply) {
  if (apply && calibSlot) {
    calibSlot.root.updateMatrixWorld(true);
    const toMask = new THREE.Matrix4().copy(calibSlot.fit.matrixWorld).invert();
    const toHead = new THREE.Matrix4().copy(calibSlot.root.matrix).invert();
    const p = {}, q = {};
    for (const key of ANCHOR_KEYS) {
      const a = anchorAt[key];
      _ray.setFromCamera(new THREE.Vector2(a.x * 2 - 1, 1 - a.y * 2), stage.camera);
      const hit = _ray.intersectObject(calibSlot.fit, true)[0];
      const world = hit ? hit.point.clone() : (() => {
        // off the mask: take the point at the depth of the real feature
        const target = new THREE.Vector3(...CANON[key]).applyMatrix4(calibSlot.root.matrix);
        const k = (target.z - _ray.ray.origin.z) / _ray.ray.direction.z;
        return _ray.ray.at(k, new THREE.Vector3());
      })();
      p[key] = world.clone().applyMatrix4(toMask); // the mask's own feature, before any fit
      q[key] = new THREE.Vector3(...CANON[key]); // where that feature is on a real face
      void toHead;
    }
    // New fit = offset + R * (scale * stretch) * p. Keep the user's rotation and stretch; solve size and offset.
    const fit = currentFit();
    const d = Math.PI / 180;
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(fit.pitch * d, fit.yaw * d, fit.roll * d, 'YXZ'));
    const shaped = (v) => v.clone().multiply(new THREE.Vector3(fit.sx, fit.sy, fit.sz)).applyQuaternion(rot);
    const eyeSpan = shaped(p.leftEye).distanceTo(shaped(p.rightEye));
    if (eyeSpan > 1e-4) {
      const s = q.leftEye.distanceTo(q.rightEye) / eyeSpan;
      const pm = shaped(p.leftEye).add(shaped(p.rightEye)).add(shaped(p.mouth)).multiplyScalar(s / 3);
      const qm = q.leftEye.clone().add(q.rightEye).add(q.mouth).multiplyScalar(1 / 3);
      fit.scale = Number(s.toFixed(3));
      fit.x = Number((qm.x - pm.x).toFixed(2));
      fit.y = Number((qm.y - pm.y).toFixed(2));
      fit.z = Number((qm.z - pm.z).toFixed(2));
    }
  }
  state.calibrating = false;
  calibSlot = null;
  stage.endCalibration();
  els.anchors.hidden = true;
  els.calibBar.hidden = true;
  els.transport.hidden = state.kind !== 'file';
  els.empty.hidden = !!state.kind;
  applyFit();
  describe(state.tracks);
  if (state.kind === 'file') els.video.play().catch(() => {});
}

for (const el of els.anchors.children) {
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const rect = pictureRect(), host = els.stage.getBoundingClientRect();
      anchorAt[el.dataset.key] = {
        x: THREE.MathUtils.clamp((ev.clientX - host.left - rect.left) / rect.width, 0, 1),
        y: THREE.MathUtils.clamp((ev.clientY - host.top - rect.top) / rect.height, 0, 1),
      };
      placeAnchors();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
  });
  // arrow keys nudge a dot, for fine placement and for keyboards
  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.02 : 0.004;
    const a = anchorAt[el.dataset.key];
    if (e.key === 'ArrowLeft') a.x -= step; else if (e.key === 'ArrowRight') a.x += step;
    else if (e.key === 'ArrowUp') a.y -= step; else if (e.key === 'ArrowDown') a.y += step; else return;
    e.preventDefault();
    placeAnchors();
  });
}

// ---------------------------------------------------------------- controls

function bindSetting(el, key, read = (e) => e.value) {
  el.addEventListener('input', () => {
    stage.settings[key] = read(el);
    if (key in prefs) { prefs[key] = stage.settings[key]; store.save('prefs', prefs); }
    redraw();
  });
}
bindSetting(els.underlay, 'underlay');
bindSetting(els.margin, 'margin', (e) => Number(e.value));
bindSetting(els.strict, 'strict', (e) => e.checked);
bindSetting(els.look, 'look');
bindSetting(els.mirror, 'mirror', (e) => e.checked);
bindSetting(els.guide, 'showGuide', (e) => e.checked);
bindSetting(els.landmarks, 'showLandmarks', (e) => e.checked);
bindSetting(els.showMask, 'showMask', (e) => e.checked);

els.people.addEventListener('change', async () => {
  prefs.people = Number(els.people.value);
  store.save('prefs', prefs);
  await tracker?.setMaxPeople(prefs.people);
});
els.keepAudio.addEventListener('change', () => { prefs.keepAudio = els.keepAudio.checked; store.save('prefs', prefs); });

for (const b of [els.camera, els.emptyCamera]) b.addEventListener('click', () => (state.kind === 'camera' ? stopCamera() : startCamera()));
for (const b of [els.file, els.emptyFile]) b.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => { if (els.fileInput.files[0]) openFile(els.fileInput.files[0]); els.fileInput.value = ''; });
els.cameraSelect.addEventListener('change', () => startCamera(els.cameraSelect.value));
els.importBtn.addEventListener('click', () => els.glbInput.click());
els.glbInput.addEventListener('change', () => { if (els.glbInput.files[0]) importGlb(els.glbInput.files[0]); els.glbInput.value = ''; });

els.fitReset.addEventListener('click', () => { fits[currentMask().id] = { ...IDENTITY_FIT }; applyFit(); });
els.fitPoints.addEventListener('click', startCalibration);
els.calibApply.addEventListener('click', () => endCalibration(true));
els.calibCancel.addEventListener('click', () => endCalibration(false));

els.record.addEventListener('click', toggleRecord);
els.exportBtn.addEventListener('click', runExport);
els.exportCancel.addEventListener('click', () => exportAbort?.abort());

els.play.addEventListener('click', () => {
  const v = els.video;
  if (v.paused) { v.play(); els.play.textContent = '❚❚'; } else { v.pause(); els.play.textContent = '▶'; }
});
els.sound.addEventListener('click', () => {
  els.video.muted = !els.video.muted;
  els.sound.textContent = els.video.muted ? 'Sound off' : 'Sound on';
  els.sound.setAttribute('aria-pressed', String(!els.video.muted));
});
els.scrub.addEventListener('input', () => {
  const v = els.video;
  state.scrubbing = true;
  if (Number.isFinite(v.duration)) v.currentTime = (Number(els.scrub.value) / 1000) * v.duration;
});
els.scrub.addEventListener('change', () => { state.scrubbing = false; });
els.video.addEventListener('seeked', () => {
  if (state.manual) return; // a test is stepping the frames itself
  // a jump in time: nobody carries over, and a paused video still needs its new frame masked
  tracker?.reset();
  state.lastFrameAt = 0;
  if (els.video.paused) tick();
});

// drop a video to open it, or a .glb to add it as a mask
window.addEventListener('dragover', (e) => { e.preventDefault(); els.stage.classList.add('over'); });
window.addEventListener('dragleave', () => els.stage.classList.remove('over'));
window.addEventListener('drop', (e) => {
  e.preventDefault();
  els.stage.classList.remove('over');
  const f = e.dataTransfer?.files?.[0];
  if (!f || !tracker) return;
  if (/\.glb$/i.test(f.name)) importGlb(f); else openFile(f);
});
window.addEventListener('resize', () => { if (state.calibrating) placeAnchors(); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && state.kind === 'file' && !/^(INPUT|SELECT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) {
    e.preventDefault();
    els.play.click();
  }
});

// ---------------------------------------------------------------- start

async function init() {
  Object.assign(stage.settings, { underlay: prefs.underlay, margin: prefs.margin, strict: prefs.strict, look: prefs.look, showMask: prefs.showMask });
  els.underlay.value = prefs.underlay;
  els.margin.value = prefs.margin;
  els.strict.checked = prefs.strict;
  els.look.value = prefs.look;
  els.people.value = String(prefs.people);
  els.keepAudio.checked = prefs.keepAudio;
  els.showMask.checked = prefs.showMask;

  for (const saved of await store.savedMasks()) {
    try { masks.push(await loadGlbMask(saved.buffer, saved.name, saved.id)); } catch (err) { console.warn('[mask-layer] saved mask unreadable:', saved.name, err); }
  }
  selectMask(currentMask().id);

  try {
    const delegate = new URLSearchParams(location.search).get('delegate') === 'cpu' ? 'CPU' : 'GPU';
    const lm = await createLandmarkers({ maxPeople: prefs.people, delegate });
    tracker = new HeadTracker(lm);
    tracker.maxPeople = prefs.people;
    els.engine.textContent = `Tracker: MediaPipe on ${lm.delegate}. Models: ${lm.localModels ? 'served from this app' : 'fetched from storage.googleapis.com (run “npm run assets” to keep them local)'}.`;
  } catch (err) {
    console.error(err);
    setChip('hold', 'Tracker failed to load');
    els.engine.textContent = String(err.message || err);
    return;
  }
  for (const b of [els.camera, els.file, els.emptyCamera, els.emptyFile]) b.disabled = false;
  if (!navigator.mediaDevices?.getUserMedia) { els.camera.disabled = true; els.emptyCamera.disabled = true; }
  describe([]);
  // for the test scripts and for poking at from the console
  window.__maskLayer = { stage, tracker, state, openFile, startCamera, runExport, selectMask, startCalibration, endCalibration, anchorAt, createLandmarkers, FACE_OVAL };
}

init();
