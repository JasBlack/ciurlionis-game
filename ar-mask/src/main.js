// Mask Layer: wires the page together. Source (camera or file) -> tracker -> stage -> screen / recorder.
// The look and the shared behaviour (title, theme, slider reset, switches, toast) come from the JAS.BLACK family kit.
import './family.css';
import './mask.css';
import { toast, paintRange } from './family.js';
import * as THREE from 'three';
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
const all = (sel) => [...document.querySelectorAll(sel)];
const els = {
  video: $('video'), out: $('out'), monitor: $('monitor'), empty: $('empty'),
  status: $('status-line'), ledLive: $('led-live'), ledLock: $('led-lock'), ledRec: $('led-rec'),
  mode: $('mode'), pause: $('pause'), guideKey: $('guide-key'), guide: $('guide'), guideClose: $('guide-close'),
  camera: $('camera'), emptyCamera: $('empty-camera'), cameraSelect: $('camera-select'), mirror: $('mirror'),
  fileInput: $('file-input'), masks: $('masks'), importBtn: $('import'), glbInput: $('glb-input'),
  showMask: $('show-mask'), maskHint: $('mask-hint'),
  underlay: $('underlay'), strict: $('strict'), keepAudio: $('keep-audio'),
  exportBusy: $('export-busy'), exportCancel: $('export-cancel'), meter: $('meter'), meterFill: $('meter-fill'), saveNote: $('save-note'),
  fitReset: $('fit-reset'), fitPoints: $('fit-points'), guideHead: $('guide-head'), coverage: $('coverage'),
  margin: $('margin'), marginVal: $('margin-val'), people: $('people'), landmarks: $('landmarks'), engine: $('engine'), look: $('look'),
  scrubrow: $('scrubrow'), scrub: $('scrub'), time: $('time'), duration: $('duration'), sound: $('sound'),
  pins: $('pins'), fitbar: $('fitbar'), fitApply: $('fit-apply'), fitCancel: $('fit-cancel'),
};
const exportKeys = all('[data-do=export]');
const recordKeys = all('[data-do=record]');
const openKeys = all('[data-do=open]');
const fitSliders = all('input[data-fit]');

const stage = new Stage(els.out);
let tracker = null;

// the picture uses the family's own colours: read them from the tokens rather than repeat them
const token = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
stage.setPalette({ accent: token('--accent'), accent2: token('--accent2'), stage: token('--stage') });

const prefs = store.load('prefs', {
  mask: 'satyr', underlay: 'pixelate', margin: 1, strict: true, people: 1, look: 'none', keepAudio: true, showMask: true, mode: 'easy',
});
const fits = store.load('fits', {});
const masks = [satyr, helm, bag];

const state = {
  kind: null, // 'camera' | 'file'
  file: null,
  stream: null,
  tracks: [],
  exporting: false,
  exportText: '',
  calibrating: false,
  recorder: null,
  loop: 0,
  lastFrameAt: 0,
  fps: 0,
  scrubbing: false,
  manual: false,
};

const pressed = (el) => el.getAttribute('aria-pressed') === 'true';
const setPressed = (el, on) => el.setAttribute('aria-pressed', String(!!on));
/** A key that stays on. */
function bindToggle(el, onChange) {
  el.addEventListener('click', () => { setPressed(el, !pressed(el)); onChange(pressed(el)); });
}
/** A segmented switch: family.js moves the light, this reports the choice. */
function bindSeg(el, onChange) {
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) onChange(b.dataset.value); });
}
function setSeg(el, value) {
  for (const b of el.querySelectorAll('button')) setPressed(b, b.dataset.value === value);
}
function savePref(key, value) { prefs[key] = value; store.save('prefs', prefs); }

// ---------------------------------------------------------------- masks and fit

const currentMask = () => masks.find((m) => m.id === prefs.mask) ?? masks[0];
function currentFit() {
  const id = currentMask().id;
  return (fits[id] ??= { ...IDENTITY_FIT });
}
const digits = (el) => (Number(el.step) < 0.1 ? 2 : 1);

function applyFit({ quiet = false } = {}) {
  const fit = currentFit();
  stage.setFit(fit);
  for (const el of fitSliders) {
    const key = el.dataset.fit;
    if (document.activeElement !== el) el.value = fit[key];
    paintRange(el);
    el.closest('.control').querySelector('output').textContent = Number(fit[key]).toFixed(digits(el));
  }
  const gaps = stage.coverageGaps();
  els.coverage.classList.toggle('warn', gaps.length > 0);
  els.coverage.textContent = gaps.length
    ? `at this fit the mask does not reach ${gaps.join(', ')}. the cover under it still hides the face`
    : 'at this fit the mask encloses a real head on every side';
  if (!quiet) store.save('fits', fits);
  redraw();
}

for (const el of fitSliders) {
  el.addEventListener('input', () => { currentFit()[el.dataset.fit] = Number(el.value); applyFit(); });
}

function renderMaskList() {
  els.masks.replaceChildren();
  for (const m of masks) {
    m.thumb ??= stage.thumbnail(m);
    const b = document.createElement('button');
    b.className = 'tile';
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(m.id === currentMask().id));
    const img = document.createElement('img');
    img.src = m.thumb;
    img.alt = '';
    const name = document.createElement('span');
    name.textContent = m.name;
    b.append(img, name);
    if (m.kind === 'glb') {
      const x = document.createElement('i');
      x.className = 'remove';
      x.title = 'remove this mask';
      x.textContent = '×';
      b.append(x);
    }
    b.addEventListener('click', (e) => { if (e.target.classList.contains('remove')) removeMask(m); else selectMask(m.id); });
    els.masks.append(b);
  }
}

function selectMask(id) {
  savePref('mask', id);
  const m = currentMask();
  stage.setMask(m);
  renderMaskList();
  els.maskHint.textContent = m.kind === 'glb'
    ? `${m.note.toLowerCase()}. size and place it in console, under fit`
    : 'or drop a .glb head model anywhere';
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
    setMode('console'); // a model of your own needs fitting, and the fit is in console
    toast(`added ${name}`);
  } catch (err) {
    console.error(err);
    toast(`could not read ${file.name} as a .glb model: ${err.message}`);
  }
}

// ---------------------------------------------------------------- status

function describe() {
  const t = state.tracks;
  const running = !!state.kind && !els.video.paused && !state.exporting && !state.calibrating;
  els.ledLive.classList.toggle('on', running);
  const lost = t.some((x) => x.state === HOLD), body = t.some((x) => x.state === BODY);
  els.ledLock.classList.toggle('on', t.length > 0 && !lost && !state.calibrating);
  els.ledLock.classList.toggle('p', body && !lost);
  els.ledRec.classList.toggle('on', !!state.recorder);

  let text;
  if (state.exporting) text = state.exportText || 'exporting';
  else if (state.calibrating) text = 'fitting · drag the pins onto the mask, then apply';
  else if (!tracker) text = els.status.textContent;
  else if (!state.kind) text = 'ready · open a video or start the camera';
  else {
    const what = !t.length ? 'nobody in frame'
      : lost ? (stage.settings.strict ? 'head lost · picture hidden' : 'head lost · holding the mask')
        : body ? 'following the head from the body'
          : t.length > 1 ? `${t.length} faces locked` : 'face locked';
    text = `${what} · ${state.fps.toFixed(0)} fps · ${stage.w} × ${stage.h}`;
  }
  els.status.textContent = text;
}

// ---------------------------------------------------------------- frames

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
  describe();
  if (state.kind === 'file' && !state.scrubbing) updateScrub();
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

function setMirror(on) {
  stage.settings.mirror = on;
  setPressed(els.mirror, on);
  redraw();
}

function sourceReady(kind) {
  state.kind = kind;
  els.empty.hidden = true;
  els.out.hidden = false;
  els.scrubrow.hidden = kind !== 'file';
  for (const k of exportKeys) k.disabled = kind !== 'file';
  for (const k of recordKeys) k.disabled = false;
  els.pause.disabled = false;
  els.pause.textContent = 'Ⅱ pause';
  els.camera.textContent = kind === 'camera' ? 'stop camera' : 'camera';
  setPressed(els.camera, false);
  setMirror(kind === 'camera'); // a camera is a mirror; a video is as it was filmed
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
    toast(err.name === 'NotAllowedError' ? 'the browser refused the camera. allow it for this page and try again' : 'no camera found');
    stopCamera();
    return;
  }
  els.video.srcObject = state.stream;
  els.video.muted = true;
  await els.video.play().catch(() => {});
  sourceReady('camera');
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  els.cameraSelect.hidden = cams.length < 2;
  const active = state.stream.getVideoTracks()[0]?.getSettings().deviceId;
  els.cameraSelect.replaceChildren(...cams.map((d, i) => new Option((d.label || `camera ${i + 1}`).toLowerCase(), d.deviceId, false, d.deviceId === active)));
}

function stopCamera() {
  stopSource();
  state.kind = null;
  els.empty.hidden = false;
  els.out.hidden = true;
  els.cameraSelect.hidden = true;
  els.scrubrow.hidden = true;
  els.camera.textContent = 'camera';
  els.pause.disabled = true;
  for (const k of [...recordKeys, ...exportKeys]) k.disabled = true;
  describe();
}

async function openFile(file) {
  stopSource();
  state.file = file;
  const v = els.video;
  v.src = URL.createObjectURL(file);
  v.loop = true;
  v.muted = true;
  setPressed(els.sound, false);
  els.cameraSelect.hidden = true;
  try {
    await new Promise((resolve, reject) => {
      v.addEventListener('loadeddata', resolve, { once: true });
      v.addEventListener('error', () => reject(new Error(`this browser cannot play ${file.name}. try an mp4 or webm`)), { once: true });
    });
  } catch (err) {
    stopCamera();
    toast(err.message);
    return;
  }
  sourceReady('file');
  await v.play().catch(() => {});
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function updateScrub() {
  const v = els.video;
  if (!Number.isFinite(v.duration)) return;
  els.scrub.value = String(Math.round((v.currentTime / v.duration) * 1000));
  paintRange(els.scrub);
  els.time.textContent = clock(v.currentTime);
  els.duration.textContent = clock(v.duration);
}

function togglePause() {
  const v = els.video;
  if (!state.kind || state.exporting || state.calibrating) return;
  if (v.paused) { v.play().catch(() => {}); els.pause.textContent = 'Ⅱ pause'; } else { v.pause(); els.pause.textContent = '▶ play'; }
  describe();
}

// ---------------------------------------------------------------- saving

function showRecording(on) {
  for (const k of recordKeys) {
    k.classList.toggle('recording', on);
    k.querySelector('.label').textContent = on ? 'stop' : 'record';
  }
  describe();
}

async function toggleRecord() {
  if (!state.kind || state.exporting) return;
  if (state.recorder) {
    const rec = state.recorder;
    state.recorder = null;
    showRecording(false);
    const res = await rec.stop();
    saveBlob(res.blob, res.filename);
    toast(`saved ${res.filename}`);
    els.saveNote.textContent = `saved ${res.filename}: ${res.seconds.toFixed(1)} s at ${res.fps} frames a second, every frame masked`;
    return;
  }
  try {
    state.recorder = await LiveRecorder.start(els.out);
    showRecording(true);
    els.saveNote.textContent = 'recording the picture as you see it, without sound. press record again to stop';
  } catch (err) {
    toast(err.message);
  }
}

let exportAbort = null;
async function runExport() {
  if (!state.file || state.kind !== 'file' || state.exporting) return;
  if (state.recorder) await toggleRecord();
  const v = els.video;
  const wasPlaying = !v.paused;
  v.pause();
  state.exporting = true;
  state.exportText = 'exporting · reading the file';
  exportAbort = new AbortController();
  els.meter.hidden = false;
  els.exportBusy.hidden = false;
  els.scrubrow.hidden = true;
  els.pause.disabled = true;
  for (const k of [...exportKeys, ...recordKeys]) k.disabled = true;
  describe();
  const started = performance.now();
  try {
    const res = await exportFile(state.file, {
      tracker, stage, keepAudio: pressed(els.keepAudio), signal: exportAbort.signal,
      onProgress: (p, frames) => {
        els.meterFill.style.width = `${(p * 100).toFixed(1)}%`;
        state.exportText = `exporting ${Math.round(p * 100)}% · ${frames} frames`;
        describe();
      },
    });
    saveBlob(res.blob, res.filename);
    const held = res.log.filter((f) => f.hidden).length;
    const body = res.log.filter((f) => f.states.includes(BODY)).length;
    const secs = ((performance.now() - started) / 1000).toFixed(0);
    toast(`saved ${res.filename}`);
    els.saveNote.textContent = `saved ${res.filename}: ${res.frames} frames in ${secs} s, each masked before it was written.`
      + (body ? ` on ${body} the face could not be read and the mask followed the head from the body.` : '')
      + (held ? ` on ${held} a head was lost and the whole picture was hidden.` : '')
      + (pressed(els.keepAudio) && res.hadAudio && !res.audioKept ? ' the sound could not be carried into this file.' : '')
      + ' watch it through before you publish it';
    window.__lastExport = res;
  } catch (err) {
    const cancelled = exportAbort.signal.aborted;
    els.saveNote.textContent = cancelled ? 'export cancelled. nothing was saved' : `export failed: ${err.message}`;
    toast(cancelled ? 'export cancelled' : `export failed: ${err.message}`);
    if (!cancelled) console.error(err);
  } finally {
    state.exporting = false;
    exportAbort = null;
    els.meter.hidden = true;
    els.meterFill.style.width = '0';
    els.exportBusy.hidden = true;
    els.scrubrow.hidden = false;
    els.pause.disabled = false;
    for (const k of [...exportKeys, ...recordKeys]) k.disabled = false;
    state.lastFrameAt = 0;
    if (wasPlaying) v.play().catch(() => {}); else tick();
    describe();
  }
}

// ---------------------------------------------------------------- fit by points

const PIN_KEYS = ['rightEye', 'leftEye', 'mouth'];
const pinAt = {}; // key -> { x, y } as fractions of the picture
let calibSlot = null;
const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

function pictureRect() {
  const r = els.out.getBoundingClientRect(), host = els.monitor.getBoundingClientRect();
  const ar = els.out.width / els.out.height;
  let w = r.width, h = r.height;
  if (w / h > ar) w = h * ar; else h = w / ar;
  return { left: r.left - host.left + (r.width - w) / 2, top: r.top - host.top + (r.height - h) / 2, width: w, height: h, host };
}

function placePins() {
  const rect = pictureRect();
  for (const el of els.pins.children) {
    const a = pinAt[el.dataset.key];
    el.style.left = `${rect.left + a.x * rect.width}px`;
    el.style.top = `${rect.top + a.y * rect.height}px`;
  }
}

function drawCalibration() {
  calibSlot = stage.renderCalibration();
  placePins();
}

function startCalibration() {
  if (state.exporting || state.calibrating) return;
  els.video.pause();
  state.calibrating = true;
  els.pins.hidden = false;
  els.fitbar.hidden = false;
  els.scrubrow.hidden = true;
  els.empty.hidden = true;
  els.out.hidden = false;
  showGuide(false);
  calibSlot = stage.renderCalibration();
  // start each pin where the wearer's own feature is, seen through the mask at its present fit
  for (const key of PIN_KEYS) {
    _v.set(...CANON[key]).applyMatrix4(calibSlot.root.matrix).project(stage.camera);
    pinAt[key] = { x: (_v.x + 1) / 2, y: (1 - _v.y) / 2 };
  }
  placePins();
  describe();
}

function endCalibration(apply) {
  if (!state.calibrating) return;
  if (apply && calibSlot) {
    calibSlot.root.updateMatrixWorld(true);
    const toMask = new THREE.Matrix4().copy(calibSlot.fit.matrixWorld).invert();
    const p = {}, q = {};
    for (const key of PIN_KEYS) {
      const a = pinAt[key];
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
  els.pins.hidden = true;
  els.fitbar.hidden = true;
  els.scrubrow.hidden = state.kind !== 'file';
  els.empty.hidden = !!state.kind;
  els.out.hidden = !state.kind;
  applyFit();
  if (state.kind) els.video.play().catch(() => {});
  els.pause.textContent = 'Ⅱ pause';
  describe();
}

for (const el of els.pins.children) {
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const rect = pictureRect();
      pinAt[el.dataset.key] = {
        x: THREE.MathUtils.clamp((ev.clientX - rect.host.left - rect.left) / rect.width, 0, 1),
        y: THREE.MathUtils.clamp((ev.clientY - rect.host.top - rect.top) / rect.height, 0, 1),
      };
      placePins();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
  });
  // arrow keys nudge a pin, for fine placement and for keyboards
  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.02 : 0.004;
    const a = pinAt[el.dataset.key];
    if (e.key === 'ArrowLeft') a.x -= step; else if (e.key === 'ArrowRight') a.x += step;
    else if (e.key === 'ArrowUp') a.y -= step; else if (e.key === 'ArrowDown') a.y += step; else return;
    e.preventDefault();
    placePins();
  });
}

// ---------------------------------------------------------------- controls

function setMode(mode) {
  document.body.dataset.mode = mode;
  setSeg(els.mode, mode);
  savePref('mode', mode);
  requestAnimationFrame(() => { if (state.calibrating) placePins(); });
}
bindSeg(els.mode, setMode);

function showGuide(on) {
  els.guide.hidden = !on;
  els.guideKey.setAttribute('aria-expanded', String(on));
}
els.guideKey.addEventListener('click', () => showGuide(els.guide.hidden));
els.guideClose.addEventListener('click', () => showGuide(false));

bindSeg(els.underlay, (v) => { stage.settings.underlay = v; savePref('underlay', v); redraw(); });
bindToggle(els.strict, (on) => { stage.settings.strict = on; if (tracker) tracker.failClosed = on; savePref('strict', on); redraw(); });
bindToggle(els.showMask, (on) => { stage.settings.showMask = on; savePref('showMask', on); redraw(); });
bindToggle(els.mirror, (on) => { stage.settings.mirror = on; redraw(); });
bindToggle(els.guideHead, (on) => { stage.settings.showGuide = on; redraw(); });
bindToggle(els.landmarks, (on) => { stage.settings.showLandmarks = on; redraw(); });
bindToggle(els.keepAudio, (on) => savePref('keepAudio', on));
bindToggle(els.sound, (on) => { els.video.muted = !on; });

els.margin.addEventListener('input', () => {
  stage.settings.margin = Number(els.margin.value);
  els.marginVal.textContent = stage.settings.margin.toFixed(2);
  savePref('margin', stage.settings.margin);
  redraw();
});
els.look.addEventListener('input', () => { stage.settings.look = els.look.value; savePref('look', els.look.value); redraw(); });
els.people.addEventListener('change', async () => {
  savePref('people', Number(els.people.value));
  await tracker?.setMaxPeople(prefs.people);
});

for (const b of [els.camera, els.emptyCamera]) b.addEventListener('click', () => (state.kind === 'camera' ? stopCamera() : startCamera()));
for (const b of openKeys) b.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => { if (els.fileInput.files[0]) openFile(els.fileInput.files[0]); els.fileInput.value = ''; });
els.cameraSelect.addEventListener('change', () => startCamera(els.cameraSelect.value));
els.importBtn.addEventListener('click', () => els.glbInput.click());
els.glbInput.addEventListener('change', () => { if (els.glbInput.files[0]) importGlb(els.glbInput.files[0]); els.glbInput.value = ''; });

els.fitReset.addEventListener('click', () => { fits[currentMask().id] = { ...IDENTITY_FIT }; applyFit(); });
els.fitPoints.addEventListener('click', startCalibration);
els.fitApply.addEventListener('click', () => endCalibration(true));
els.fitCancel.addEventListener('click', () => endCalibration(false));

els.pause.addEventListener('click', togglePause);
for (const k of recordKeys) k.addEventListener('click', toggleRecord);
for (const k of exportKeys) k.addEventListener('click', runExport);
els.exportCancel.addEventListener('click', () => exportAbort?.abort());

els.scrub.addEventListener('input', () => {
  const v = els.video;
  state.scrubbing = true;
  if (Number.isFinite(v.duration)) v.currentTime = (Number(els.scrub.value) / 1000) * v.duration;
});
els.scrub.addEventListener('change', () => { state.scrubbing = false; });
// the place in the video is not a setting: a right-click here does nothing rather than jump to the start
els.scrub.addEventListener('contextmenu', (e) => e.preventDefault());
els.video.addEventListener('seeked', () => {
  if (state.manual) return; // a test is stepping the frames itself
  // a jump in time: nobody carries over, and a paused video still needs its new frame masked
  tracker?.reset();
  state.lastFrameAt = 0;
  if (els.video.paused) tick();
});

// drop a video to open it, or a .glb to add it as a mask
window.addEventListener('dragover', (e) => { e.preventDefault(); els.monitor.classList.add('over'); });
window.addEventListener('dragleave', () => els.monitor.classList.remove('over'));
window.addEventListener('drop', (e) => {
  e.preventDefault();
  els.monitor.classList.remove('over');
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  if (!tracker) { toast('the tracker is still loading. drop it again in a moment'); return; }
  if (/\.glb$/i.test(f.name)) importGlb(f); else openFile(f);
});
window.addEventListener('resize', () => { if (state.calibrating) placePins(); });
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if (e.code === 'Space') {
    if (e.target.tagName === 'BUTTON') return; // Space presses the key that has the focus
    e.preventDefault();
    togglePause();
  } else if (key === 'e') runExport();
  else if (key === 'r') toggleRecord();
  else if (key === 'm') { if (state.kind) setMirror(!stage.settings.mirror); }
  else if (key === 'f') document.querySelector('[data-action=fullscreen]').click();
  else if (key === 'escape') { if (state.calibrating) endCalibration(false); else showGuide(false); }
});

// ---------------------------------------------------------------- start

async function init() {
  Object.assign(stage.settings, { underlay: prefs.underlay, margin: prefs.margin, strict: prefs.strict, look: prefs.look, showMask: prefs.showMask });
  setSeg(els.underlay, prefs.underlay);
  setPressed(els.strict, prefs.strict);
  setPressed(els.showMask, prefs.showMask);
  setPressed(els.keepAudio, prefs.keepAudio);
  els.margin.value = prefs.margin;
  paintRange(els.margin);
  els.marginVal.textContent = Number(prefs.margin).toFixed(2);
  els.look.value = prefs.look;
  els.people.value = String(prefs.people);
  setMode(prefs.mode === 'console' ? 'console' : 'easy');

  for (const saved of await store.savedMasks()) {
    try { masks.push(await loadGlbMask(saved.buffer, saved.name, saved.id)); } catch (err) { console.warn('[mask-layer] saved mask unreadable:', saved.name, err); }
  }
  selectMask(currentMask().id);

  try {
    // ?delegate=cpu and ?pose=lite are for testing and for slow machines
    const query = new URLSearchParams(location.search);
    const lm = await createLandmarkers({
      maxPeople: prefs.people,
      delegate: query.get('delegate') === 'cpu' ? 'CPU' : 'GPU',
      pose: query.get('pose') === 'lite' ? 'lite' : 'full',
    });
    tracker = new HeadTracker(lm);
    tracker.maxPeople = prefs.people;
    tracker.failClosed = prefs.strict;
    els.engine.textContent = `tracker: mediapipe on ${lm.delegate.toLowerCase()} · models ${lm.localModels ? 'served from this page' : 'fetched from storage.googleapis.com'}`;
  } catch (err) {
    console.error(err);
    els.status.textContent = 'the tracker did not load. reload the page; if it persists, try chrome or edge';
    els.engine.textContent = String(err.message || err).toLowerCase();
    return;
  }
  for (const b of [...openKeys, els.camera, els.emptyCamera]) b.disabled = false;
  if (!navigator.mediaDevices?.getUserMedia) { els.camera.disabled = true; els.emptyCamera.disabled = true; }
  describe();
  // for the test scripts and for poking at from the console
  window.__maskLayer = { stage, tracker, state, openFile, startCamera, runExport, selectMask, startCalibration, endCalibration, pinAt, createLandmarkers, FACE_OVAL, FACE, BODY, HOLD };
}

init();
