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
import { Player, TUNING } from '../figure/player.js';
import { Input } from '../figure/input.js';
import { Follow } from '../figure/camera.js';
import { noise } from './noise.js';
import { createFrame, STYLES } from './finish.js';
import { createPainter } from './painter.js';
import { createBody } from './body.js';
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
const hud = createHud();
let told = 0;
const say = (value, label) => { told = Math.max(told, value); block.progress(told, label); hud.progress(told, label); };
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

const figureComing = createPainter(shared, () => {}); // (he is fetched while the ground is laid)
// lets the page draw (the bar moves) before the next piece of work; a window in the background is not waited for
let yielded = performance.now();
const turn = () => {
  if (performance.now() - yielded < 80) return Promise.resolve(); // (not too often: each one costs a frame)
  return new Promise((resolve) => {
    const done = () => { yielded = performance.now(); resolve(); };
    requestAnimationFrame(() => setTimeout(done, 0));
    setTimeout(done, 70);
  });
};
await prepareLand((done) => { say(0.03 + 0.37 * done, 'Laying the ground'); return turn(); });
const land = createLand(shared);
lap('land');
say(0.42, 'Planting the island');
await turn();
const far = createFar(shared);
const sky = createSky(shared);
say(0.47, 'Planting the island');
await turn();
const water = createWater(shared, { low });
const ground = createGround(shared, { low });
say(0.52, 'Planting the island');
await turn();
const props = createProps(shared, { low });
say(0.56, 'Casting the shade');
await turn();
for (const c of props.casters) land.shade.add(c);
lap('world');
const mood = createMood(shared);
// the sun sees the whole island: its picture of the shade lays the hills', trees' and towers' shadows down
const shade = createShade(renderer, shared, land.shade, { sun: SUN, size: [4096, 3072], box: [760, 600], centre: [0, 50, 0], back: 1500, near: 500, far: 2700 });
lap('shade');
say(0.6, 'Fetching the painter');
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
const player = new Player({ RAPIER, world: physics, man, animator, spawn, yaw: Math.PI, tuning: { ...TUNING, maxSlopeDeg: 62, stepHeight: 0.42 } });
const follow = new Follow(camera);
follow.yaw = Math.PI;
follow.pitch = 0.0;
follow.lift = 1.15;
follow.side = 0; // (he stands in the middle of the picture, not off to one side: on a phone the offset put him at its edge)
follow.sink = 0.6;
const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
physics.step();
lap('figure');

const frame = createFrame(renderer, shared);
frame.uniforms.uCanvas.value = q.has('canvas') ? +q.get('canvas') : 0; // no grain laid over the picture: the strokes are its surface
frame.uniforms.uBorder.value = q.has('border') ? +q.get('border') : 0; // the picture runs to the edge of the screen
// the finish, after one of his media (?style=0..6, card by default); V tries the next
// (card, the board's tooth under the paint, unless the address asks for another)
frame.uniforms.uStyle.value = q.has('style') ? Math.max(0, Math.min(STYLES.length - 1, Math.round(+q.get('style') || 0))) : 1;
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat || !loaded) return;
  const n = (frame.uniforms.uStyle.value + 1) % STYLES.length;
  frame.uniforms.uStyle.value = n;
  hud.caption('', `Finish ${n} · ${STYLES[n]}  (V for the next)`, 3);
});
// F (or Enter): the whole screen, and back. The same from the little corners at the top right, which come out of the
// dark only when the mouse comes near them.
{
  const root = document.documentElement, fs = document.getElementById('fs');
  const full = () => document.fullscreenElement || document.webkitFullscreenElement;
  const can = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const toggle = () => {
    if (full()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
    else (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root, { navigationUI: 'hide' })?.catch?.(() => {});
  };
  addEventListener('keydown', (e) => {
    if ((e.code !== 'KeyF' && e.code !== 'Enter') || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target?.closest?.('button')) return; // (Enter on the button is the button's own)
    toggle();
  });
  const mark = () => root.classList.toggle('full', !!full());
  document.addEventListener('fullscreenchange', mark); document.addEventListener('webkitfullscreenchange', mark);
  if (fs && can) {
    fs.hidden = false;
    // (a press on it is for it alone: it does not begin the journey, or send him walking)
    fs.addEventListener('pointerdown', (e) => e.stopPropagation());
    fs.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    fs.addEventListener('click', (e) => { e.stopPropagation(); toggle(); fs.blur(); });
    let near = false;
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const n = !document.pointerLockElement && innerWidth - e.clientX < 150 && e.clientY < 150;
      if (n !== near) { near = n; fs.classList.toggle('near', n); }
    });
    document.documentElement.addEventListener('mouseleave', () => { near = false; fs.classList.remove('near'); });
  }
}

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
  walkTo.on = false;
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

const root = new THREE.Vector3();  // where he is, for the eye and the story
const pose = new THREE.Vector3();  // where his feet are drawn: in the water his body turns about his chest
let swim = 0;    // 0 on his feet .. 1 swimming
let stroke = 0;  // 0 treading water .. 1 swimming forward
let strokeU = 0; // the moment of the stroke, 0..1
let riding = 0;
const body = createBody(man, animator);
const hold = { weight: 0, want: 0, target: new THREE.Vector3() }; // his left hand, given to the child
const ctx = {
  THREE, shared, camera, follow, player, animator, man, figure, input, mood, props, hud, reach, hold, body, place, heightAt, landAt, zoneAt, physics,
  flood: false,     // the sea is over the land (the end): he is not set back on the way for being under it
  get swim() { return swim; },
  scripted: null,   // { root: Vector3, yaw, hide } while the story moves him itself
  eye: null,        // { position, target, blend } while the story holds the camera
  zone: null,       // a painting's hour forced on the sky, or null for where he stands
  get time() { return time; },
};
const story = createStory(ctx);
ctx.story = story;

// --- walking where he is sent: a click on the ground (or the sea) is a place to go. He makes for it as if the
// keys were held toward it, running when it is far and walking the last of the way, until he is there, the keys are
// touched, or he has stopped getting nearer (a wall, the edge of the painting) ---
const walkTo = { on: false, x: 0, z: 0, best: Infinity, stall: 0 };
let cursorCheck = 0;
// --- the cursor: a firefly. A small light, cream with a gold heart, four tiny sparks going round it (painted, gold and
// rose, as the sparks a click leaves), and a short tail of fading dabs where the mouse has just been. It is faint where a click would find no ground, and warms toward rose when it points the way to the
// next thing to find. It is drawn by a little loop of its own, so it keeps up with the hand however slowly the picture
// itself is coming. (The system's arrow is kept for fingers and over everything else on the page.) ---
const fly = { el: document.getElementById('cursor'), x: 0, y: 0, on: false, faint: 0, faintGoal: 0, way: 0, wayGoal: 0, trail: [], box: null };
const orb = fly.el; // (updateCursor below only needs to know there is one)
const v3a = new THREE.Vector3(), v3b = new THREE.Vector3();
if (fly.el) {
  const el = renderer.domElement, c = fly.el.getContext('2d');
  const fit = () => { const d = Math.min(2, devicePixelRatio || 1); fly.el.width = Math.round(innerWidth * d); fly.el.height = Math.round(innerHeight * d); fly.d = d; fly.box = null; };
  fit(); addEventListener('resize', fit);
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    fly.x = e.clientX; fly.y = e.clientY; fly.on = true; el.style.cursor = 'none';
    fly.trail.push([e.clientX, e.clientY, performance.now()]);
  });
  el.addEventListener('pointerleave', () => { fly.on = false; });
  // (a click: the sparks flare out from it for a moment, as the spiral winds in on the ground)
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) fly.burst = 1; });
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const CREAM = [255, 244, 220], GOLD = [242, 201, 106], ROSE = [243, 177, 162];
  // (the colours of the click's sparks)
  const SPARK = [250, 204, 107], SPARK_ROSE = [245, 168, 153], AMBER = [214, 140, 52], MADDER = [204, 102, 98];
  const rgba = (v, a) => `rgba(${v[0]},${v[1]},${v[2]},${a})`;
  // the sparks that go round it: tiny painted dashes, gold and one rose, each with a breath of light, circling on a
  // tilted ring, so that they pass behind it and come round in front
  const SPARKS = [
    { r: 14.5, w: 2.0, p: 0.0, rose: false },
    { r: 12.5, w: 2.7, p: 2.3, rose: true },
    { r: 16.5, w: 1.6, p: 4.0, rose: false },
    { r: 11.5, w: 3.2, p: 5.2, rose: false },
  ];
  const TILT = -0.38, FLAT = 0.48; // (the ring leans a little, and is seen from a little above)
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  fly.burst = 0; fly.spin = 0; fly.ox = 0; fly.oy = 0; fly.was = false;
  let last = performance.now();
  const draw = (now) => {
    requestAnimationFrame(draw);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    fly.way += (fly.wayGoal - fly.way) * (1 - Math.exp(-5 * dt));
    fly.faint += (fly.faintGoal - fly.faint) * (1 - Math.exp(-6 * dt));
    fly.burst *= Math.exp(-3.5 * dt);
    fly.spin += dt * (1 + 0.7 * fly.way + 1.5 * fly.burst);
    while (fly.trail.length && now - fly.trail[0][2] > 260) fly.trail.shift();
    if (fly.box) c.clearRect(...fly.box);
    fly.box = null;
    if (!fly.on || document.pointerLockElement) { fly.was = false; return; } // (while a drag holds the mouse, there is no cursor)
    // (the sparks keep a little behind the hand, as fireflies would)
    if (!fly.was) { fly.ox = fly.x; fly.oy = fly.y; fly.was = true; }
    const lag = 1 - Math.exp(-20 * dt);
    fly.ox += (fly.x - fly.ox) * lag; fly.oy += (fly.y - fly.oy) * lag;
    { const lx = fly.ox - fly.x, ly = fly.oy - fly.y, l = Math.hypot(lx, ly), most = 6; if (l > most) { fly.ox = fly.x + lx * most / l; fly.oy = fly.y + ly * most / l; } }
    const d = fly.d, w = fly.way, b = fly.burst, a0 = 1 - 0.6 * fly.faint, t = now / 1000;
    let x0 = Math.min(fly.x, fly.ox), y0 = Math.min(fly.y, fly.oy), x1 = Math.max(fly.x, fly.ox), y1 = Math.max(fly.y, fly.oy);
    c.setTransform(d, 0, 0, d, 0, 0);
    // the tail: small dabs where it has been, fading as they age
    for (const [x, y, at] of fly.trail) {
      const k = 1 - (now - at) / 260;
      c.fillStyle = rgba(mix(GOLD, ROSE, w), a0 * k * (0.55 + 0.3 * w));
      c.beginPath(); c.arc(x, y, 0.7 + 1.3 * k, 0, 6.2832); c.fill();
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    // where each spark is now: on its ring, its depth (behind, -1 .. in front, 1), and which way it is going
    const R = (1 - 0.18 * w) * (1 + 1.1 * b);
    const at = SPARKS.map((k, i) => {
      const a = k.p + fly.spin * k.w, r = k.r * R, ex = Math.cos(a) * r, ey = Math.sin(a) * r * FLAT;
      const vx = -Math.sin(a), vy = Math.cos(a) * FLAT;
      return { k, i, x: fly.ox + ex * ct - ey * st, y: fly.oy + ex * st + ey * ct, z: Math.sin(a), rot: Math.atan2(vx * st + vy * ct, vx * ct - vy * st) };
    });
    const spark = (q) => {
      const tw = 0.75 + 0.25 * Math.sin(t * 5.3 + q.i * 1.9), sz = 1.12 * (0.86 + 0.18 * q.z) * (1 + 0.35 * b);
      const col = mix(q.k.rose ? SPARK_ROSE : SPARK, SPARK_ROSE, 0.75 * w), a = a0 * (0.85 + 0.15 * q.z) * Math.min(1, tw + 0.5 * b);
      // its breath of light
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(col, 0.32 * a);
      c.beginPath(); c.arc(q.x, q.y, 4.4 * sz, 0, 6.2832); c.fill();
      c.fillStyle = rgba(col, 0.3 * a);
      c.beginPath(); c.arc(q.x, q.y, 2.4 * sz, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
      // and the dash itself, painted, with a touch of ink under it so it reads over pale ground
      // (its body, a deeper amber or madder, the colour a painter would give light on a pale ground)
      const deep = mix(q.k.rose ? MADDER : AMBER, MADDER, 0.75 * w);
      c.shadowColor = `rgba(24,18,52,${0.6 * a})`; c.shadowBlur = 1.8 * d; c.shadowOffsetY = 0.5 * d;
      c.fillStyle = rgba(deep, a);
      c.beginPath(); c.ellipse(q.x, q.y, 3.7 * sz, 1.5 * sz, q.rot, 0, 6.2832); c.fill();
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.fillStyle = rgba(col, a);
      c.beginPath(); c.ellipse(q.x + Math.cos(q.rot) * 0.3 * sz, q.y + Math.sin(q.rot) * 0.3 * sz, 3.0 * sz, 1.1 * sz, q.rot, 0, 6.2832); c.fill();
      // (and its bright heart, toward the way it goes)
      c.fillStyle = rgba(CREAM, a * tw);
      c.beginPath(); c.ellipse(q.x + Math.cos(q.rot) * 0.8 * sz, q.y + Math.sin(q.rot) * 0.8 * sz, 2.0 * sz, 0.68 * sz, q.rot, 0, 6.2832); c.fill();
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    };
    for (const q of at) if (q.z < 0) spark(q);
    // its light, breathing a little, and its body, with a soft touch of ink under it to read over pale ground
    c.fillStyle = rgba(mix(GOLD, ROSE, w), a0 * (0.17 + 0.07 * Math.sin(t * 4) + 0.15 * b));
    c.beginPath(); c.arc(fly.x, fly.y, 8.5, 0, 6.2832); c.fill();
    c.shadowColor = 'rgba(24,18,52,0.55)'; c.shadowBlur = 2.6 * d; c.shadowOffsetY = 0.6 * d;
    c.fillStyle = rgba(mix(CREAM, GOLD, w), a0);
    c.beginPath(); c.arc(fly.x, fly.y, 3.6, 0, 6.2832); c.fill();
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.strokeStyle = `rgba(35,26,64,${0.22 * a0})`; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = rgba(mix(GOLD, ROSE, w * 0.7), a0 * 0.9);
    c.beginPath(); c.arc(fly.x, fly.y, 1.5, 0, 6.2832); c.fill();
    for (const q of at) if (q.z >= 0) spark(q);
    c.setTransform(1, 0, 0, 1, 0, 0);
    const m = 16;
    fly.box = [Math.floor((x0 - m) * d), Math.floor((y0 - m) * d), Math.ceil((x1 - x0 + 2 * m) * d), Math.ceil((y1 - y0 + 2 * m) * d)];
  };
  requestAnimationFrame(draw);
}
function updateCursor(inp) {
  const c = inp.cursor;
  if (!orb || !c?.inside || (cursorCheck = (cursorCheck + 1) % 6) !== 0) return;
  const sx = (c.x + 1) / 2 * innerWidth, sy = (c.y + 1) / 2 * innerHeight, goal = story.goal;
  let onWay = false, ground = null;
  if (ctx.scripted) {
    // (flying: does the mouse point at it, near enough?)
    if (goal) { ndc.set(c.x, -c.y); caster.setFromCamera(ndc, camera); onWay = caster.ray.direction.dot(v3a.copy(goal).sub(camera.position).normalize()) > Math.cos(0.17); }
  } else {
    ground = groundUnder(sx, sy);
    if (ground && goal) {
      v3a.set(ground.point.x - root.x, 0, ground.point.z - root.z); v3b.set(goal.x - root.x, 0, goal.z - root.z);
      onWay = v3a.length() > 0.8 && v3b.length() > 0.5 && v3a.normalize().dot(v3b.normalize()) > Math.cos(0.5);
    }
  }
  fly.faintGoal = !ctx.scripted && (!input.clickable || !ground) ? 1 : 0;
  fly.wayGoal = onWay && !story.waiting ? 1 : 0;
}
const caster = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitN = new THREE.Vector3(), hitP = new THREE.Vector3();
/** The ground (or the sea's face) under the screen point (cx, cy), or null if the sky is there. */
function groundUnder(cx, cy, max = 300) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  caster.setFromCamera(ndc, camera);
  const o = caster.ray.origin, d = caster.ray.direction, sea = shared.uSea.value;
  const g = (t) => Math.max(heightAt(o.x + d.x * t, o.z + d.z * t), sea);
  let a = 0, b = 0.25;
  if (o.y <= g(0)) return null;
  while (b < max) {
    if (o.y + d.y * b <= g(b)) {
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (o.y + d.y * m <= g(m)) b = m; else a = m; }
      const x = o.x + d.x * b, z = o.z + d.z * b, h = heightAt(x, z);
      if (h < sea) hitN.set(0, 1, 0);
      else hitN.set(heightAt(x - 0.5, z) - heightAt(x + 0.5, z), 1, heightAt(x, z - 0.5) - heightAt(x, z + 0.5)).normalize();
      return { point: hitP.set(x, Math.max(h, sea), z), normal: hitN };
    }
    a = b;
    b += Math.max(0.2, b * 0.015);
  }
  return null;
}
function sendTo(cx, cy) {
  const hit = groundUnder(cx, cy);
  if (!hit) return;
  Object.assign(walkTo, { on: true, x: hit.point.x, z: hit.point.z, best: Infinity, stall: 0 });
  props.markAt(hit.point, hit.normal, camera.position);
}
/** While he is sent somewhere and nothing else moves him, the keys are held for him toward it. */
function steer(inp, dt) {
  if (!walkTo.on) return;
  if (Math.hypot(inp.move.x, inp.move.y) > 0.05 || ctx.scripted || story.frozen) { walkTo.on = false; return; }
  const dx = walkTo.x - player.feet.x, dz = walkTo.z - player.feet.z, d = Math.hypot(dx, dz);
  if (d < 0.45) { walkTo.on = false; return; }
  if (d < walkTo.best - 0.05) { walkTo.best = d; walkTo.stall = 0; } else if ((walkTo.stall += dt) > 1.3) { walkTo.on = false; return; }
  // (as a stick held that way: the player reads it against the eye's heading)
  const yaw = follow.yaw, ux = dx / d, uz = dz / d, mag = THREE.MathUtils.clamp(d / 5, 0.5, 1);
  inp.move.y = (ux * Math.sin(yaw) + uz * Math.cos(yaw)) * mag;
  inp.move.x = (-ux * Math.cos(yaw) + uz * Math.sin(yaw)) * mag;
  inp.device = 'pad';
}

function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  time += dt;
  const inp = input.read(dt);
  // a click is a place to walk to once the journey has begun and while he is his own master (not on the salamander)
  input.clickable = !story.waiting && !story.frozen && !ctx.scripted;
  if (input.clickable) for (const c of inp.clicks ?? []) sendTo(c.x, c.y);
  // the eye follows the free mouse once the journey has begun (not on the title, nor while the story holds the eye)
  input.follows = !story.waiting && !ctx.eye;
  // the eye does not tilt up and down with the mouse: it keeps the painting's horizon (the wheel steps it back or in).
  // A press dragged up or down is kept for the flight instead, which climbs or stoops by it when there is no mouse.
  // Only with the middle button held does the eye go round him freely, up and over as well; let go, it settles back
  if (inp.orbit) {
    follow.pitch = THREE.MathUtils.clamp(follow.pitch + inp.look.y, -0.35, 1.1);
  } else {
    ctx.climb = THREE.MathUtils.clamp((ctx.climb ?? 0) * Math.exp(-0.5 * dt) + inp.look.y * 2.5, -1, 1);
    follow.pitch += ((ctx.scripted ? 0.3 : 0.04) - follow.pitch) * (1 - Math.exp(-2.2 * dt));
  }
  inp.look.y = 0;
  updateCursor(inp);
  steer(inp, dt);
  if (story.frozen) { inp.move.x = inp.move.y = 0; inp.jump = false; }
  if (swim > 0.5) {
    // swimming is slower than running, and there is no sprinting or jumping in it
    inp.sprint = false; inp.jump = false;
    const m = Math.hypot(inp.move.x, inp.move.y);
    if (m > 0.05) { inp.move.x *= 0.74 / m; inp.move.y *= 0.74 / m; inp.device = 'pad'; }
  }
  if (ctx.scripted) {
    root.copy(ctx.scripted.root);
    player.yaw = ctx.scripted.yaw;
    player.feet.copy(root); player.speed = 0;
  } else {
    player.swimming = swim > 0.5;
    player.update(dt, inp, follow.yaw);
    // into deep water or off the map: he is set back on the way, where he was nearest it
    if ((!ctx.flood && player.feet.y < shared.uSea.value - 2.1) || Math.max(Math.abs(player.feet.x), Math.abs(player.feet.z)) > EXTENT - 8) {
      const n = nearWay(player.feet.x, player.feet.z);
      let best = way[0];
      for (const p of way) if (Math.abs(p.s - n.s) < Math.abs(best.s - n.s)) best = p;
      place(best.x, best.z, player.yaw);
    }
    root.copy(player.visualRoot(dt));
    const depth = shared.uSea.value - root.y;
    swim += ((depth > 1.05 ? 1 : 0) - swim) * (1 - Math.exp(-3.5 * dt));
  }
  if (ctx.scripted) swim = 0;
  // In deep water he swims. Still, he treads it upright with his arms out on the surface (as the film opens);
  // moving, he goes onto his front. Either way his chest rides at the surface and his body turns about it.
  stroke += (THREE.MathUtils.clamp((player.speed - 0.25) / 0.6, 0, 1) - stroke) * (1 - Math.exp(-2.4 * dt));
  strokeU = (strokeU + dt * (0.4 + 0.32 * stroke)) % 1; // (about 1.4 s a stroke, one after another)
  // (in the breaststroke he rises a little as his arms pull in under him, and lies flat again for the glide)
  const ph = (strokeU - 0.28) / 0.42, rise = stroke * (ph > 0 && ph < 1 ? Math.sin(ph * Math.PI) : 0);
  const pitch = swim * (0.12 + stroke * 1.22 - 0.3 * rise);
  const roll = 0;
  pose.copy(root);
  if (swim > 0.01) {
    const sea = shared.uSea.value, h = 1.32, sp = Math.sin(pitch), cp = Math.cos(pitch);
    // (he lifts a little as the kick drives him)
    const chest = sea - 0.03 + 0.035 * Math.sin(time * 2.2) + 0.1 * rise;
    pose.x += (root.x - Math.sin(player.yaw) * h * sp - pose.x) * swim;
    pose.z += (root.z - Math.cos(player.yaw) * h * sp - pose.z) * swim;
    pose.y += (chest - h * cp - pose.y) * swim;
    root.y += (sea - 1.0 - root.y) * swim;
  }
  man.object.position.copy(pose);
  man.object.rotation.set((ctx.scripted?.pitch ?? 0) + pitch, player.yaw, (ctx.scripted?.roll ?? 0) + roll, 'YXZ');
  man.object.updateMatrixWorld(true);
  const local = player.vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -player.yaw);
  const moving = !ctx.scripted;
  // (in the water the clips under the stroke are his standing ones: a run left playing under it had his hips, back
  // and feet still running)
  const inWater = swim > 0.5;
  animator.update(dt, { speed: !moving || inWater ? 0 : player.mode === 'move' ? player.speed : Math.hypot(local.x, local.z), moveAngle: player.moveAngle, grounded: !moving || player.grounded || inWater });
  animator.relaxHands(inWater ? 0 : player.speed);
  animator.uprightTrunk(dt, inWater ? 0 : player.speed, (moving && player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3) * (1 - swim));
  const lookW = moving && (player.mode === 'move' || player.mode === 'idleExtra') ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1) : 0;
  animator.lookToward(dt, camera.getWorldDirection(new THREE.Vector3()), lookW);
  animator.armClearance(dt);
  if (moving && player.mode === 'move' && !player.strafe && !inWater) animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
  else animator.leanInto(dt, 0, 0, 0);
  const onGround = moving && player.grounded && player.mode !== 'jump' && player.mode !== 'air';
  animator.placeFeet(dt, (x, z, from) => player.ground(x, z, from, 1.4), pose.y, onGround ? 1 - swim : 0);
  man.object.updateMatrixWorld(true);
  body.stand(dt, onGround && swim < 0.1 && player.speed < 0.15);
  body.swim(swim, stroke, strokeU, time, pitch, rise);
  riding += ((ctx.scripted?.ride ? 1 : 0) - riding) * (1 - Math.exp(-6 * dt));
  body.ride(riding, time);
  reachOut(dt);
  hold.weight += (hold.want - hold.weight) * (1 - Math.exp(-6 * dt));
  body.hold(hold.weight, hold.target);
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
  shared.uTime.value = time;
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / frame.inner.y; // (its pixels are the picture's, not the screen's)
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
  /** As a click at screen point (x, y): he is sent to the ground there. */
  click(x, y) { sendTo(x, y); },
  /** The picture now on the screen, finished in each style in turn: [dataURL, ...] (for comparing them). */
  finishes(list = STYLES.map((_, i) => i)) {
    const was = frame.uniforms.uStyle.value, out = [];
    for (const n of list) { frame.uniforms.uStyle.value = n; frame.present(); out.push(renderer.domElement.toDataURL('image/png')); }
    frame.uniforms.uStyle.value = was; frame.present();
    return out;
  },
  /** Paints the picture at r pixels a CSS pixel, as the governor would. */
  resolution(r) { setResolution(r); },
  walkTo,
};

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  frame.resize();
});
say(0.66, 'Mixing tempera');
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
  // (the longest wait, and nothing reports how far along it is: the bar creeps so that it is seen to be alive)
  const creep = setInterval(() => say(Math.min(0.9, told + 0.004), 'Mixing tempera'), 120);
  await renderer.compileAsync(scene, camera);
  clearInterval(creep);
  lap('shaders');
  say(0.9, 'Mixing tempera');
}
story.begin(q.get('at'));
for (let i = 0; i < (capture ? 1 : 5); i++) {
  tick(1 / 60);
  if (capture) break;
  await gpuDone();
  say(0.9 + 0.02 * (i + 1), 'First strokes');
  await turn();
}
lap('first frame');

// --- keeping it moving. If frames run long for a while the picture is painted with fewer pixels (never fewer than
// 0.6 a CSS pixel), which is what costs most on a large screen; when frames have been quick for a while it is tried a
// step higher again, and if that can't be held it settles below it. Only the picture the world is painted into
// changes size: the screen's canvas keeps its own, so changing it never shows a wiped (black) canvas. ---
const meter = document.createElement('div');
meter.style.cssText = 'position:fixed;left:12px;top:10px;color:#fff6dd;font:12px/1.4 monospace;text-shadow:0 1px 4px #000;pointer-events:none;display:none';
document.body.appendChild(meter);
if (q.has('fps')) meter.style.display = 'block';
addEventListener('keydown', (e) => { if (e.code === 'F2') meter.style.display = meter.style.display === 'none' ? 'block' : 'none'; });
const fixedRatio = q.has('ratio') ? +q.get('ratio') : null;
if (fixedRatio) { renderer.setPixelRatio(fixedRatio); renderer.setSize(innerWidth, innerHeight); frame.resize(); }
let slow = 0, quick = 0, seen = 0, frames = 0, played = 0, raisedAt = -1e9;
let ceiling = renderer.getPixelRatio(); // the most it is ever painted at (pixels a CSS pixel)
/** Paints the picture at r pixels a CSS pixel (at most the canvas's own). */
function setResolution(r) {
  frame.resize(Math.min(1, r / renderer.getPixelRatio()));
  slow = quick = 0;
}
function govern(dt) {
  if (dt > 0.25) return; // a pause, not a slow frame
  frames++; seen += dt;
  if (seen > 0.5) { meter.textContent = `${Math.round(frames / seen)} fps · ${(renderer.getPixelRatio() * frame.scale).toFixed(2)}x · ${frame.inner.x}x${frame.inner.y}`; frames = 0; seen = 0; }
  // only while it is being played: a window in the background is slowed by the browser, not by the picture
  if (fixedRatio || !document.hasFocus()) { slow = quick = 0; return; }
  played += dt;
  slow = dt > 1 / 40 ? slow + dt : Math.max(0, slow - dt * 2);
  quick = dt < 1 / 52 ? quick + dt : 0;
  const ratio = renderer.getPixelRatio() * frame.scale, set = setResolution;
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
}
loaded = true;
run();
say(1, 'Ready');
if (q.has('clean') || capture) document.getElementById('hint')?.remove();
hud.ready(story.waiting);
block.ready();
window.lab.ready = true;
window.__block = { ready: true, block, timings, set() {} };
