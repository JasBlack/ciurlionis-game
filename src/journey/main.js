// Čiurlionis · Kelionė. The painter walks out of the sea and through his own paintings, as in the film: the
// striped hills, the willows, the ram's ledge, the sunset and the horn-harp, the king's garden, the pond, the
// mountain of the offering; then the sea rises and it begins again. Built on Patch's oil-paint block
// (src/oilpaint): everything in the picture is a dab of the brush pinned to the world.
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills)
//   ?quality=low   fewer strokes, for slower machines
//   ?fps           shows frames a second and the resolution the picture is drawn at (also the F2 key)
//   ?ratio=1       holds the resolution there (1 = the screen's own pixels); otherwise it is lowered if frames run long
//   ?at=name       start at a level, without the title: sea, day, sunset, garden, flight, offering (or 1..6)
//   ?canvas=0 ?impasto=0..2 ?border=1    parts of the finish, for comparing (border: bare card round the edge)
import * as THREE from 'three';
import { patchBlock } from 'patch-block';
import recipe from '../../recipe.json';
import RAPIER from '../figure/rapier/rapier.mjs';
import { createShared, WIND } from '../oilpaint/common.js';
import { createLeafSheet } from './brush.js';
import { createShade } from '../oilpaint/shade.js';
import { Animator } from '../figure/animator.js';
import { Player } from '../figure/player.js';
import { Input } from '../figure/input.js';
import { Follow } from '../figure/camera.js';
import { noise } from './noise.js';
import { createFrame } from './finish.js';
import { createPainter } from './painter.js';
import { journeyUniforms } from './paint.js';
import { EXTENT, PLACES, way, nearWay } from './way.js';
import { prepareLand, createLand, heightAt, landAt, zoneAt } from './land.js';
import { createGround } from './ground.js';
import { createWater } from './water.js';
import { createSky } from './sky.js';
import { createFar } from './far.js';
import { createMood } from './mood.js';
import { createProps } from './props.js';
import { createStory } from './story.js';
import { createHud } from './hud.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
const low = (q.get('quality') ?? window.patch?.quality ?? 'high') === 'low';

let shown = true;
let loaded = false;
const block = patchBlock({ ...recipe.block, onSet() {}, onTrigger() {}, onVisible(visible) { shown = visible; if (loaded) run(); } });
const loading = document.getElementById('loading');
let told = 0;
const say = (value, label) => { told = Math.max(told, value); block.progress(told, label); if (loading) loading.textContent = label; };
say(0.03, 'Laying the ground');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, low ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours are paint: written as they are
document.getElementById('view').appendChild(renderer.domElement);

// --- the hour: a sun low in the north-west, ahead of the way and to its left ---
const SUN = new THREE.Vector3(-0.5, 0.53, -0.68).normalize();
const shared = Object.assign(createShared(), journeyUniforms(THREE));
shared.tBrush.value = createLeafSheet();
shared.uSunDir.value.copy(SUN);
shared.uHazeGlow.value.setRGB(0.05, 0.04, 0.02);
shared.uShadeBias.value = 0.0006;
shared.uBounce.value.setRGB(0.07, 0.05, 0.03);
shared.uGlazeAdd.value.setRGB(0.01, 0.015, 0.06); // his shadow is blue, as on the hills of the film
shared.uImpasto.value = q.has('impasto') ? +q.get('impasto') : 0.5; // tempera on card stands lower than oil
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.3, 16000);
lap('start');

const figureComing = createPainter(shared, (done) => say(0.05 + 0.5 * done, 'Fetching the painter'));
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
await prepareLand((done) => { say(0.03 + 0.12 * done, 'Laying the ground'); return turn(); });
const land = createLand(shared);
lap('land');
say(0.16, 'Planting the island');
await turn();
const far = createFar(shared);
const sky = createSky(shared);
const water = createWater(shared, { low });
const ground = createGround(shared, { low });
const props = createProps(shared, { low });
for (const c of props.casters) land.shade.add(c);
lap('world');
const mood = createMood(shared);
// the sun sees the whole island: its picture of the shade lays the hills', trees' and towers' shadows down
const shade = createShade(renderer, shared, land.shade, { sun: SUN, size: [4096, 3072], box: [760, 600], centre: [0, 50, 0], back: 1500, near: 500, far: 2700 });
lap('shade');
say(0.3, 'Fetching the painter');
await turn();
scene.add(sky.group, far.group, water.group, land.mesh, ground.group, props.group);

// where the water is deeper than this he swims: his feet find a floor that is not there
const SWIM_FLOOR = -1.25;
const floorAt = (x, z) => Math.max(heightAt(x, z), SWIM_FLOOR);
await RAPIER.init();
const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
{
  const f = land.heightField();
  for (let i = 0; i < f.heights.length; i++) if (f.heights[i] < SWIM_FLOOR) f.heights[i] = SWIM_FLOOR; // under deep water he treads it
  physics.createCollider(RAPIER.ColliderDesc.heightfield(f.cells, f.cells, f.heights, { x: 2 * f.half, y: 1, z: 2 * f.half }));
  for (const c of props.colliders) {
    if (c.box) physics.createCollider(RAPIER.ColliderDesc.cuboid(c.box[0], c.box[1], c.box[2]).setTranslation(c.x, c.y, c.z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw ?? 0)));
    else physics.createCollider(RAPIER.ColliderDesc.cylinder(c.h ?? 4, c.r).setTranslation(c.x, c.y + (c.h ?? 4) - 0.5, c.z));
  }
}
lap('physics');

const figure = await figureComing;
const { man } = figure;
scene.add(man.object, figure.dabs);
const animator = new Animator(man);
const START = PLACES.start;
const spawn = new THREE.Vector3(START.x, floorAt(START.x, START.z), START.z);
const player = new Player({ RAPIER, world: physics, man, animator, spawn, yaw: Math.PI });
const follow = new Follow(camera);
follow.yaw = Math.PI;
follow.pitch = 0.0;
follow.lift = 1.15;
follow.sink = 0.6;
const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
physics.step();
lap('figure');

const frame = createFrame(renderer, shared);
frame.uniforms.uCanvas.value = q.has('canvas') ? +q.get('canvas') : 1;
frame.uniforms.uBorder.value = q.has('border') ? +q.get('border') : 0; // the picture runs to the edge of the screen
// Enter: the whole screen, and back
addEventListener('keydown', (e) => {
  if (e.code !== 'Enter') return;
  if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {});
});

// the wind, for anything that wants it in JavaScript
const wind = { x: WIND.x, z: WIND.y };
let time = 0;

function place(x, z, yaw) {
  const y = floorAt(x, z), half = player.halfHeight();
  player.body.setTranslation({ x, y: y + player.t.radius + half + 0.05, z }, true);
  physics.propagateModifiedBodyPositionsToColliders();
  player.feet.set(x, y, z); player.prevFeet.copy(player.feet); player.visualY = y;
  player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move'; player.grounded = true;
  player.yaw = player.lastYaw = yaw;
  follow.yaw = yaw; follow.pivot.set(0, 0, 0);
  animator.lock = null; animator.lockOff = null;
  animator.enter(animator.locoState({ strafe: false }), 0.05);
}

// --- reaching out: the right arm is turned toward a point of the world, after the clips have had it ---
const reach = { weight: 0, want: 0, target: new THREE.Vector3() };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), swing = new THREE.Quaternion(), pq = new THREE.Quaternion(), wq = new THREE.Quaternion(), ident = new THREE.Quaternion();
function reachOut(dt) {
  reach.weight += (reach.want - reach.weight) * (1 - Math.exp(-5 * dt));
  if (reach.weight < 0.01) return;
  for (const [bone, child] of [['upperarm_r', 'lowerarm_r'], ['lowerarm_r', 'hand_r']]) {
    const b = man.bones[bone];
    if (!b || !man.bones[child]) return;
    v1.setFromMatrixPosition(man.bones[child].matrixWorld).sub(v2.setFromMatrixPosition(b.matrixWorld)).normalize();
    v2.copy(reach.target).sub(v2).normalize();
    swing.setFromUnitVectors(v1, v2).slerp(ident, 1 - reach.weight);
    b.parent.getWorldQuaternion(pq); b.getWorldQuaternion(wq);
    b.quaternion.copy(pq.invert().multiply(swing.multiply(wq)));
    b.updateMatrixWorld(true);
  }
}

const hud = createHud();
const size = new THREE.Vector2();
const root = new THREE.Vector3();
let swim = 0; // 0 on his feet .. 1 swimming
const ctx = {
  THREE, shared, camera, follow, player, animator, man, figure, input, mood, props, hud, reach, place, heightAt, landAt, zoneAt, physics,
  scripted: null,   // { root: Vector3, yaw, hide } while the story moves him itself
  eye: null,        // { position, target, blend } while the story holds the camera
  zone: null,       // a painting's hour forced on the sky, or null for where he stands
  get time() { return time; },
};
const story = createStory(ctx);
ctx.story = story;

function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  time += dt;
  const inp = input.read(dt);
  if (story.frozen) { inp.move.x = inp.move.y = 0; inp.jump = false; }
  if (swim > 0.5) { inp.sprint = false; inp.jump = false; }
  if (ctx.scripted) {
    root.copy(ctx.scripted.root);
    player.yaw = ctx.scripted.yaw;
    player.feet.copy(root); player.speed = 0;
  } else {
    player.update(dt, inp, follow.yaw);
    // into deep water or off the map: he is set back on the way, where he was nearest it
    if (player.feet.y < shared.uSea.value - 2.1 || Math.max(Math.abs(player.feet.x), Math.abs(player.feet.z)) > EXTENT - 8) {
      const n = nearWay(player.feet.x, player.feet.z);
      let best = way[0];
      for (const p of way) if (Math.abs(p.s - n.s) < Math.abs(best.s - n.s)) best = p;
      place(best.x, best.z, player.yaw);
    }
    root.copy(player.visualRoot(dt));
    // in deep water he lies forward on it and swims: his body comes up to the surface and rides the swell
    const depth = shared.uSea.value - root.y;
    swim += ((depth > 1.0 ? 1 : 0) - swim) * (1 - Math.exp(-4 * dt));
    if (swim > 0.01) root.y += (shared.uSea.value - 0.52 + 0.05 * Math.sin(time * 2.2) - root.y) * swim;
  }
  if (ctx.scripted) swim = 0;
  man.object.position.copy(root);
  man.object.rotation.set((ctx.scripted?.pitch ?? 0) + 1.12 * swim, player.yaw, 0, 'YXZ');
  man.object.updateMatrixWorld(true);
  const local = player.vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -player.yaw);
  const moving = !ctx.scripted;
  animator.update(dt, { speed: !moving ? 0 : player.mode === 'move' ? player.speed : Math.hypot(local.x, local.z), moveAngle: player.moveAngle, grounded: !moving || player.grounded });
  animator.relaxHands(player.speed);
  animator.uprightTrunk(dt, player.speed, moving && player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3);
  const lookW = moving && (player.mode === 'move' || player.mode === 'idleExtra') ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1) : 0;
  animator.lookToward(dt, camera.getWorldDirection(new THREE.Vector3()), lookW);
  animator.armClearance(dt);
  if (moving && player.mode === 'move' && !player.strafe) animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
  else animator.leanInto(dt, 0, 0, 0);
  const onGround = moving && player.grounded && player.mode !== 'jump' && player.mode !== 'air';
  animator.placeFeet(dt, (x, z, from) => player.ground(x, z, from, 1.4), root.y, onGround ? 1 - swim : 0);
  man.object.updateMatrixWorld(true);
  reachOut(dt);
  figure.update();

  follow.update(dt, root, inp.look, inp.zoom, (o, d, max) => {
    let hit = player.castRay(o, d, max);
    if (hit != null && o.y + d.y * hit - heightAt(o.x + d.x * hit, o.z + d.z * hit) < 0.5) hit = null;
    return hit;
  }, (x, z) => Math.max(heightAt(x, z), shared.uSea.value) + 0.35);
  // the story may hold the eye (the first look at Rex, the clouds over the willows, the ride)
  if (ctx.eye && ctx.eye.blend > 0.001) {
    const b = ctx.eye.blend * ctx.eye.blend * (3 - 2 * ctx.eye.blend);
    camera.getWorldDirection(v1).multiplyScalar(8).add(camera.position);
    camera.position.lerp(ctx.eye.position, b);
    camera.lookAt(v1.lerp(ctx.eye.target, b));
  }
  const hide = ctx.scripted?.hide ?? false;
  man.object.visible = figure.dabs.visible = !hide;
  camera.updateMatrixWorld(true);
  renderer.getDrawingBufferSize(size);
  shared.uTime.value = time;
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
  shared.uFocus.value.copy(root);

  story.update(dt, root, inp);
  mood.update(dt, ctx.zone ?? zoneAt(root.x, root.z));
  props.update(time, dt, root, camera);
  ground.follow(camera.position.x, camera.position.z);
  water.follow(camera.position.x, camera.position.z);
  shade.update(scene, root);
  frame.uniforms.uWash.value = hud.wash;
  frame.render(scene, camera);
}

const SPOTS = {
  hills: [-13, 276, -20, 250], willows: [42, 180, 44, 150], ledge: [-44, 34, -80, 30], harp: [16, -128, 25, -152], garden: [9, -212, -18, -257],
  pond: [34, -330, 72, -354], terrace: [PLACES.terrace.x - 4, PLACES.terrace.z - 6, PLACES.summit.x, PLACES.summit.z], summit: [PLACES.summit.x - 3, PLACES.summit.z - 6, PLACES.summit.x, PLACES.summit.z],
};
window.lab = {
  THREE, player, follow, camera, input, animator, figure, shared, frame, renderer, timings, heightAt, landAt, zoneAt, ctx, story, props, mood, PLACES,
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
  setInput(fn) { input.override = fn; },
  /** Puts him at (x, z) on the ground, facing (fx, fz), with the eye behind him. */
  teleport(x, z, fx, fz) { place(x, z, Math.atan2(fx - x, fz - z)); mood.update(0, zoneAt(x, z), 0); tick(1 / 60); },
  /** A fixed view for stills: eye and what it looks at. Call with nothing to go back to following him. */
  view(eye, target) { follow.free = eye ? { position: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null; },
  wait(seconds) { time += seconds; },
  go(name) { const s = SPOTS[name]; if (s) this.teleport(...s); },
};

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  frame.resize();
});
say(0.68, 'Mixing tempera');
function gpuDone() {
  const gl = renderer.getContext();
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve) => {
    const poll = () => {
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(poll, 4);
      gl.deleteSync(sync);
      resolve();
    };
    poll();
  });
}
if (!capture && !q.has('debug')) {
  renderer.debug.checkShaderErrors = false;
  await renderer.compileAsync(scene, camera);
  lap('shaders');
  say(0.86, 'Mixing tempera');
}
story.begin(q.get('at'));
for (let i = 0; i < (capture ? 1 : 5); i++) {
  tick(1 / 60);
  if (capture) break;
  await gpuDone();
  say(0.88 + 0.025 * i, 'First strokes');
  await turn();
}
lap('first frame');

// --- keeping it moving. If frames run long for a while the picture is drawn with fewer pixels (never fewer than
// 0.6 of the screen's), which is what costs most on a large screen; when frames have been quick for a while it is
// tried a step higher again, and if that can't be held it settles below it. ---
const meter = document.createElement('div');
meter.style.cssText = 'position:fixed;left:12px;top:10px;color:#fff6dd;font:12px/1.4 monospace;text-shadow:0 1px 4px #000;pointer-events:none;display:none';
document.body.appendChild(meter);
if (q.has('fps')) meter.style.display = 'block';
addEventListener('keydown', (e) => { if (e.code === 'F2') meter.style.display = meter.style.display === 'none' ? 'block' : 'none'; });
const fixedRatio = q.has('ratio') ? +q.get('ratio') : null;
if (fixedRatio) { renderer.setPixelRatio(fixedRatio); renderer.setSize(innerWidth, innerHeight); frame.resize(); }
let slow = 0, quick = 0, seen = 0, frames = 0, played = 0, raisedAt = -1e9;
let ceiling = renderer.getPixelRatio(); // the most it is ever drawn at
function govern(dt) {
  if (dt > 0.25) return; // a pause, not a slow frame
  frames++; seen += dt;
  if (seen > 0.5) { meter.textContent = `${Math.round(frames / seen)} fps · ${renderer.getPixelRatio().toFixed(2)}x · ${renderer.domElement.width}x${renderer.domElement.height}`; frames = 0; seen = 0; }
  // only while it is being played: a window in the background is slowed by the browser, not by the picture
  if (fixedRatio || !document.hasFocus()) { slow = quick = 0; return; }
  played += dt;
  slow = dt > 1 / 40 ? slow + dt : Math.max(0, slow - dt * 2);
  quick = dt < 1 / 52 ? quick + dt : 0;
  const ratio = renderer.getPixelRatio();
  const set = (r) => { renderer.setPixelRatio(r); renderer.setSize(innerWidth, innerHeight); frame.resize(); slow = quick = 0; };
  if (slow > 1.5 && ratio > 0.6) {
    // (if it had just been raised and could not hold that, it is not raised so far again)
    if (played - raisedAt < 12) ceiling = Math.max(0.6, ratio * 0.9);
    set(Math.max(0.6, ratio * 0.85));
  } else if (quick > 10 && ratio < ceiling - 0.01) {
    set(Math.min(ceiling, ratio * 1.12));
    raisedAt = played;
  }
}

let running = false;
let last = 0;
function run() {
  const want = shown && !capture;
  if (want === running) return;
  running = want;
  last = performance.now();
  renderer.setAnimationLoop(want ? () => { const now = performance.now(), dt = (now - last) / 1000; tick(dt); govern(dt); last = now; } : null);
}
if (!capture) {
  const hint = document.getElementById('hint');
  addEventListener('keydown', (e) => { if (e.code === 'KeyH') hint.classList.toggle('off'); });
  setTimeout(() => hint.classList.add('faded'), 14000);
}
loaded = true;
run();
loading?.remove();
if (q.has('clean') || capture) document.getElementById('hint')?.remove();
block.ready();
window.lab.ready = true;
window.__block = { ready: true, block, timings, set() {} };
