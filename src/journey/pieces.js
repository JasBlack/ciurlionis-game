// The made things of the journey, each from one of the paintings the film passes through: Rex on his pedestal
// in the sea, the dandelion and the child's shade, the great bird, the ram, the golden cathedral, the horn-harp,
// the king and the child, the salamander, the wall of white figures and its gate, the mountain's spires, altar
// and stair, and the angel with the pearls. All are put together with the kit (src/journey/kit.js).
import * as THREE from 'three';
import { createKit, V } from './kit.js';
import { rng } from './noise.js';
import { heightAt, STAIR } from './land.js';
import { PLACES } from './way.js';

const UP = V(0, 1, 0);
export const M4 = (x, y, z, yaw = 0, s = 1, pitch = 0, roll = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), V(s, s, s));
const WALK = /* glsl */ `
void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
  // legs: fx.w 1 and 2 swing against each other, most at the foot
  if (fx.w > 0.5 && fx.w < 9.0) p.z += sin(uTime * 7.0 + (fx.w > 1.5 ? 3.1416 : 0.0)) * uWalk * uStride * clamp(1.0 - p.y / uHip, 0.0, 1.0);
}`;

export function createPieces(shared, { low = false } = {}) {
  const group = new THREE.Group(), casters = [], colliders = [], things = {};
  const rand = rng(8642);
  const add = (name, kit, { cast = true, matrix = null, scale = 1 } = {}) => {
    const t = kit.build();
    if (matrix) t.setMatrix(matrix, scale);
    group.add(t.group);
    if (cast) { const c = t.caster(); if (c) casters.push(c); }
    things[name] = t;
    return t;
  };
  const light = (seed) => createKit(shared, { seed, additive: true, order: 6, minPx: [3, 6], maxPx: [900, 2000], jitter: 0.2 });

  // --- Rex: a pale crowned figure on a block of gold, far out in the sea, a ring of light behind his head ---
  {
    const R = PLACES.rex, kit = createKit(shared, { seed: 21 });
    const stone = kit.pal([0.99, 0.8, 0.36], [0.94, 0.66, 0.3], [0.7, 0.48, 0.34]);
    const inlay = kit.pal([0.5, 0.62, 0.9], [0.4, 0.5, 0.8], [0.3, 0.36, 0.6]);
    const mint = kit.pal([0.74, 0.9, 0.74], [0.6, 0.8, 0.64], [0.44, 0.62, 0.54]);
    const body = kit.pal([0.99, 0.91, 0.85], [0.9, 0.82, 0.76], [0.66, 0.66, 0.66]);
    const rose = kit.pal([0.98, 0.78, 0.76], [0.9, 0.68, 0.68], [0.62, 0.5, 0.58]);
    const gold = kit.pal([1.0, 0.86, 0.3], [0.96, 0.7, 0.2], [0.7, 0.46, 0.16]);
    const y0 = 2.6;
    const bp = () => (kit.rand() < 0.24 ? rose : kit.rand() < 0.3 ? mint : body);
    kit.fx(0, 1); // flat and pale: he is light more than stone
    kit.box(V(R.x, y0 - 5, R.z), [2.4, 5, 2.4], stone, { dabs: 150, size: [0.4, 1.1], dabPal: () => (kit.rand() < 0.3 ? inlay : stone) });
    for (const sx of [-1, 1]) {
      kit.tube([V(R.x + sx * 0.55, y0, R.z), V(R.x + sx * 0.6, y0 + 2.6, R.z), V(R.x + sx * 0.5, y0 + 5.4, R.z)], [0.42, 0.52, 0.66], body, { dabs: 40, size: [0.3, 1.2], dabPal: bp });
      kit.tube([V(R.x + sx * 1.3, y0 + 8.6, R.z), V(R.x + sx * 1.45, y0 + 6.8, R.z + 0.2), V(R.x + sx * 1.1, y0 + 5.2, R.z + 0.6)], [0.4, 0.34, 0.26], body, { dabs: 22, size: [0.26, 0.9], dabPal: bp });
    }
    kit.tube([V(R.x, y0 + 5.0, R.z), V(R.x, y0 + 6.6, R.z), V(R.x, y0 + 8.4, R.z), V(R.x, y0 + 9.3, R.z), V(R.x, y0 + 9.9, R.z)], [1.0, 1.05, 1.3, 0.9, 0.4], body, { sides: 9, dabs: 90, size: [0.34, 1.3], dabPal: bp });
    kit.ball(V(R.x, y0 + 10.7, R.z), [0.62, 0.8, 0.64], body, { dabs: 30, size: [0.24, 0.5], grain: 'up' });
    kit.fx(0, 2);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 6.283;
      kit.dab(V(R.x + Math.cos(a) * 0.5, y0 + 11.75, R.z + Math.sin(a) * 0.5), V(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35), V(Math.cos(a), 0.3, Math.sin(a)), gold, 0.3, 1.25 + 0.5 * kit.rand());
    }
    add('rex', kit);
    const halo = light(22);
    const glow = halo.pal([0.34, 0.27, 0.1], [0.34, 0.27, 0.1], [0.34, 0.27, 0.1]);
    halo.fx(0, 2);
    for (const [r, n] of [[3.3, 64], [4.7, 84]]) {
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; halo.dab(V(R.x + Math.cos(a) * r, y0 + 10.6 + Math.sin(a) * r, R.z + 0.6), V(-Math.sin(a), Math.cos(a), 0), V(0, 0, -1), glow, 0.34, 1.1); }
    }
    add('rexHalo', halo, { cast: false });
  }

  // --- the dandelion on the hilltop, taller than a child, and the child's shade that sits by it ---
  {
    const D = PLACES.dandelion, y0 = heightAt(D.x, D.z);
    const kit = createKit(shared, {
      seed: 23, minPx: [1.5, 4], uniforms: { uBlow: { value: 0 } }, decl: 'uniform float uBlow;',
      warp: /* glsl */ `
        void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
          // a seed lets go at its own moment and goes down the wind, tumbling
          if (fx.w > 0.5 && fx.w < 9.0) {
            float s = fx.w - 1.0, t = max(uBlow * 1.6 - s * 0.6, 0.0);
            p += vec3(uWind.x, 0.22, uWind.y) * t * t * (5.0 + 9.0 * s) + vec3(sin(t * 7.0 + s * 40.0), cos(t * 5.0 + s * 20.0), sin(t * 6.0 + s * 9.0)) * min(t, 1.0) * 0.5;
          }
        }`,
    });
    const stalk = kit.pal([0.86, 0.8, 0.4], [0.66, 0.62, 0.3], [0.3, 0.32, 0.26]);
    const seed = kit.pal([1, 1, 0.97], [0.93, 0.93, 0.95], [0.72, 0.76, 0.9]);
    const core = kit.pal([0.7, 0.62, 0.5], [0.5, 0.44, 0.38], [0.28, 0.24, 0.26]);
    const C = V(D.x + 0.1, y0 + 1.85, D.z);
    kit.tube([V(D.x, y0 - 0.1, D.z), V(D.x - 0.06, y0 + 0.9, D.z + 0.03), C], [0.04, 0.035, 0.03], stalk, { sides: 5, dabs: 10, size: [0.05, 0.4] });
    kit.ball(C, 0.09, core, { dabs: 8, size: [0.05, 0.06] });
    for (let i = 0; i < 380; i++) {
      const u = kit.rand() * 2 - 1, a = kit.rand() * 6.283, s = Math.sqrt(1 - u * u), n = V(Math.cos(a) * s, u, Math.sin(a) * s), w = 1 + kit.rand();
      kit.fx(0.12, 1, 0, w);
      kit.dab(C.clone().addScaledVector(n, 0.3), n, n, seed, 0.026, 0.5);
      if (i % 2) kit.dab(C.clone().addScaledVector(n, 0.55), V(-n.z, 0.2, n.x), n, seed, 0.07, 0.09);
    }
    add('dandelion', kit, { cast: false });
    things.dandelion.head = C;

    const ghost = createKit(shared, { seed: 24, jitter: 0.15 });
    const shade = ghost.pal([0.7, 0.64, 0.72], [0.6, 0.55, 0.66], [0.46, 0.43, 0.58]);
    const gx = D.x + 1.25, gz = D.z + 0.25, gy = heightAt(gx, gz);
    ghost.fx(0, 1);
    ghost.ball(V(gx, gy + 0.42, gz), [0.27, 0.42, 0.25], shade, { dabs: 24, size: [0.12, 0.26], grain: 'up' });
    ghost.ball(V(gx - 0.04, gy + 1.0, gz), 0.21, shade, { dabs: 16, size: [0.1, 0.18] });
    ghost.tube([V(gx - 0.2, gy + 0.72, gz), V(gx - 0.5, gy + 0.78, gz - 0.05), V(gx - 0.78, gy + 0.9, gz - 0.1)], [0.07, 0.06, 0.05], shade, { sides: 5, dabs: 6, size: [0.06, 0.16] });
    ghost.tube([V(gx + 0.05, gy + 0.2, gz + 0.1), V(gx - 0.45, gy + 0.12, gz + 0.2)], [0.1, 0.07], shade, { sides: 5, dabs: 5, size: [0.08, 0.18] });
    add('ghost', ghost, { cast: false });
  }

  // --- the great bird of the hills ---
  {
    const kit = createKit(shared, { seed: 25, maxPx: [500, 1100], warp: /* glsl */ `
      void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) { p.y += max(abs(p.x) - 1.0, 0.0) * (0.08 + 0.3 * sin(uTime * 2.3)); }` });
    const brown = kit.pal([0.8, 0.64, 0.44], [0.58, 0.44, 0.32], [0.32, 0.24, 0.26]);
    const dark = kit.pal([0.5, 0.38, 0.3], [0.34, 0.26, 0.24], [0.18, 0.14, 0.17]);
    const cream = kit.pal([0.95, 0.86, 0.7], [0.78, 0.66, 0.54], [0.46, 0.38, 0.38]);
    const fp = () => (kit.rand() < 0.3 ? dark : kit.rand() < 0.3 ? cream : brown);
    kit.ball(V(0, 0, 0), [0.95, 0.85, 2.7], brown, { dabs: 60, size: [0.4, 1.0], dabPal: fp });
    kit.ball(V(0, 0.3, 3.0), [0.5, 0.48, 0.72], brown, { dabs: 14, size: [0.2, 0.4] });
    kit.tube([V(0, 0.2, 3.6), V(0, 0.02, 4.15)], [0.16, 0.02], cream, { sides: 5 });
    for (let i = 0; i < 30; i++) { const u = kit.rand() * 2 - 1; kit.dab(V(u * 1.3, 0, -3.1 - 1.7 * kit.rand()), V(u * 0.4, 0, -1), UP, fp(), 0.55, 2.1); }
    for (const sx of [-1, 1]) {
      kit.ball(V(sx * 5.9, 0.2, -0.9), [5.3, 0.14, 1.9], brown, { quat: new THREE.Quaternion().setFromAxisAngle(UP, sx * 0.22), segs: [10, 4] });
      for (let i = 0; i < 130; i++) {
        const u = kit.rand(), tip = u > 0.8, x = sx * (0.9 + u * 10.3), chord = 3.2 - 2.2 * u;
        kit.dab(V(x, 0.3, 0.7 - 0.25 * Math.abs(x) - (kit.rand() - 0.2) * chord), V(tip ? sx * 0.9 : sx * 0.2 * u, 0, tip ? -0.6 : -1), UP, fp(), 0.55, (tip ? 2.6 : 1.5) + 1.1 * kit.rand());
      }
    }
    add('bird', kit, { cast: false });
  }

  // --- the ram: white, long-tailed, with two thin horns of gold as long as a lyre's arms ---
  {
    const kit = createKit(shared, { seed: 26, minPx: [2.5, 5], uniforms: { uWalk: { value: 0 }, uStride: { value: 0.2 }, uHip: { value: 0.9 } }, decl: 'uniform float uWalk; uniform float uStride; uniform float uHip;', warp: WALK });
    const white = kit.pal([0.99, 0.99, 0.96], [0.82, 0.88, 0.95], [0.54, 0.66, 0.86]);
    const blue = kit.pal([0.78, 0.88, 0.98], [0.56, 0.72, 0.94], [0.34, 0.5, 0.82]);
    const gold = kit.pal([1.0, 0.86, 0.34], [0.9, 0.66, 0.2], [0.6, 0.4, 0.2]);
    const eye = kit.pal([0.3, 0.3, 0.2], [0.2, 0.2, 0.16], [0.1, 0.1, 0.12]);
    kit.ball(V(0, 1.05, 0), [0.33, 0.4, 0.82], white, { dabs: 110, size: [0.12, 0.34], dabPal: () => (kit.rand() < 0.25 ? blue : white) });
    kit.tube([V(0, 1.2, 0.6), V(0, 1.55, 0.86), V(0, 1.82, 0.98)], [0.2, 0.15, 0.12], white, { sides: 6, dabs: 26, size: [0.1, 0.26] });
    kit.ball(V(0, 1.88, 1.12), [0.13, 0.15, 0.25], white, { dabs: 14, size: [0.07, 0.14] });
    kit.tube([V(0, 1.84, 1.3), V(0, 1.76, 1.46)], [0.09, 0.06], white, { sides: 5 });
    for (const sx of [-1, 1]) {
      kit.fx(0, 0, 0, 0);
      kit.ball(V(sx * 0.1, 1.93, 1.2), [0.03, 0.04, 0.035], eye, {});
      kit.tube([V(sx * 0.11, 1.95, 1.02), V(sx * 0.26, 1.98, 0.96)], [0.04, 0.015], white, { sides: 4 });
      // horns: up and back in one long sweep
      const horn = [];
      for (let i = 0; i <= 7; i++) { const u = i / 7; horn.push(V(sx * (0.07 + 0.36 * u * u), 2.0 + 1.35 * Math.sin(u * 1.75), 1.05 - 1.75 * u * u)); }
      kit.tube(horn, [0.045, 0.042, 0.038, 0.034, 0.03, 0.025, 0.018, 0.008], gold, { sides: 5, dabs: 16, size: [0.05, 0.3] });
      for (const [z, phase] of [[0.52, sx > 0 ? 1 : 2], [-0.56, sx > 0 ? 2 : 1]]) {
        kit.fx(0, 0, 0, phase);
        kit.tube([V(sx * 0.2, 0.92, z), V(sx * 0.2, 0.45, z + 0.03), V(sx * 0.2, 0, z)], [0.1, 0.065, 0.05], white, { sides: 5, dabs: 12, size: [0.06, 0.24], dabPal: blue });
      }
    }
    kit.fx(0.5);
    const tail = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6; tail.push(V(0.12 * Math.sin(u * 5), 1.15 - 1.0 * u * u, -0.78 - 2.3 * u)); }
    kit.tube(tail, [0.13, 0.15, 0.14, 0.12, 0.09, 0.06, 0.02], blue, { sides: 5, dabs: 50, size: [0.09, 0.5], dabPal: () => (kit.rand() < 0.4 ? white : blue) });
    kit.fx(0);
    add('ram', kit, { cast: false });
  }

  // --- the golden cathedral on its hill across the valley ---
  {
    const C = PLACES.cathedral, y0 = heightAt(C.x, C.z) - 0.5, kit = createKit(shared, { seed: 27, maxPx: [500, 1600] });
    const gold = kit.pal([1.0, 0.86, 0.4], [0.9, 0.68, 0.28], [0.58, 0.44, 0.42]);
    const pale = kit.pal([1.0, 0.94, 0.66], [0.94, 0.8, 0.44], [0.66, 0.54, 0.5]);
    const blue = kit.pal([0.5, 0.56, 0.86], [0.32, 0.34, 0.66], [0.2, 0.2, 0.46]);
    const dome = kit.pal([0.6, 0.72, 0.9], [0.4, 0.5, 0.78], [0.22, 0.28, 0.54]);
    const amber = kit.pal([0.95, 0.72, 0.3], [0.84, 0.58, 0.24], [0.56, 0.4, 0.3]);
    const gp = () => (kit.rand() < 0.3 ? pale : kit.rand() < 0.3 ? amber : gold);
    const arches = (x, y, z0, z1, n, w, h) => {
      for (let i = 0; i < n; i++) {
        const z = z0 + (z1 - z0) * (i + 0.5) / n;
        kit.fx(0, 1, 0, 10);
        kit.dab(V(x, y, z), UP, V(1, 0, 0), blue, w, h);
        kit.fx(0, 1, 0, 14);
        kit.dab(V(x, y + h * 0.48, z), UP, V(1, 0.3, 0), blue, w * 1.15, w * 1.5);
      }
      kit.fx(0, 1);
    };
    kit.fx(0, 1);
    kit.box(V(C.x, y0 + 11, C.z), [13, 11, 22], gold, { dabs: 420, size: [1.2, 3.4], dabPal: gp });
    arches(C.x + 13.3, y0 + 9.5, C.z - 20, C.z + 20, 9, 2.3, 14);
    kit.box(V(C.x - 1, y0 + 27, C.z), [9, 5, 16], gold, { dabs: 160, size: [1.0, 2.6], dabPal: gp });
    arches(C.x + 8.3, y0 + 27, C.z - 14.5, C.z + 14.5, 8, 1.5, 6.5);
    kit.ball(V(C.x - 1, y0 + 33, C.z - 3), [9.5, 8, 9.5], dome, { dabs: 150, size: [0.9, 3.2], grain: 'up', dabPal: () => (kit.rand() < 0.3 ? gold : dome), upper: 0.05 });
    kit.tube([V(C.x - 1, y0 + 40, C.z - 3), V(C.x - 1, y0 + 44, C.z - 3), V(C.x - 1, y0 + 50, C.z - 3)], [1.4, 0.7, 0.1], gold, { sides: 6, dabs: 12, size: [0.5, 2.4] });
    kit.box(V(C.x - 1, y0 + 47.6, C.z - 3), [0.18, 0.18, 1.5], gold, {});
    for (const sz of [-1, 1]) {
      const tz = C.z + sz * 26;
      kit.box(V(C.x + 2, y0 + 17, tz), [5, 17, 5], gold, { dabs: 200, size: [1.0, 3.2], dabPal: gp });
      arches(C.x + 7.3, y0 + 24, tz - 3.4, tz + 3.4, 2, 1.5, 8);
      for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) kit.box(V(C.x + 2 + ax * 4.2, y0 + 35, tz + az * 4.2), [0.8, 1.1, 0.8], pale, { dabs: 4, size: [0.6, 1.4] });
    }
    kit.ball(V(C.x + 4, y0 + 22, C.z + 10), [4.2, 5.2, 4.2], dome, { dabs: 40, size: [0.7, 2.2], grain: 'up', upper: 0.0 });
    kit.fx(0);
    add('cathedral', kit);
  }

  // --- the ram's ledge: beds of sandstone stepping down the cliff under it, and the blocks that lie on top ---
  {
    const L = PLACES.ledge, top = heightAt(L.x, L.z), kit = createKit(shared, { seed: 40, maxPx: [400, 1200], jitter: 0.25 });
    const sand = kit.pal([0.98, 0.82, 0.62], [0.9, 0.68, 0.52], [0.62, 0.45, 0.48]);
    const rosy = kit.pal([0.96, 0.72, 0.6], [0.84, 0.58, 0.5], [0.56, 0.4, 0.46]);
    const sp = () => (kit.rand() < 0.35 ? rosy : sand);
    for (const [dx, y, dz, hx, hy, hz, yaw] of [[-15, -2.6, 0, 7.5, 1.7, 10, 0.12], [-20, -7.2, 1, 7, 1.9, 9, -0.1], [-24, -12.6, -1, 6.5, 2.3, 8.5, 0.06], [-27.5, -19, 0, 6, 2.7, 8, -0.08], [-30, -26, 1, 5.5, 3.2, 7.5, 0.1]]) {
      kit.box(V(L.x + dx, top + y, L.z + dz), [hx, hy, hz], sand, { yaw, dabs: 90, size: [0.5, 2.0], grain: 'level', dabPal: sp });
    }
    for (const [dx, dz, hx, hy, hz, yaw] of [[-5, -7.5, 2.4, 1.3, 1.9, 0.4], [-3.2, -4.2, 1.2, 0.7, 1.2, -0.2]]) {
      kit.box(V(L.x + dx, top + hy - 0.1, L.z + dz), [hx, hy, hz], sand, { yaw, dabs: 40, size: [0.4, 1.2], grain: 'level', dabPal: sp });
      colliders.push({ x: L.x + dx, z: L.z + dz, y: top + hy, box: [hx, hy + 0.5, hz], yaw });
    }
    add('ledge', kit);
  }

  // --- the horn-harp: a pale tower, the ram's great skull at its foot, strings between its horns ---
  {
    const H = PLACES.harp, y0 = heightAt(H.x, H.z);
    const yaw = Math.atan2(16 - H.x, -140 - H.z); // it faces the way he comes
    const kit = createKit(shared, { seed: 28, maxPx: [400, 1000] });
    const tower = kit.pal([0.99, 0.94, 0.72], [0.82, 0.86, 0.9], [0.5, 0.6, 0.86]);
    const bone = kit.pal([0.97, 0.95, 0.87], [0.8, 0.8, 0.82], [0.5, 0.5, 0.64]);
    const horn = kit.pal([0.94, 0.78, 0.42], [0.74, 0.56, 0.3], [0.42, 0.3, 0.28]);
    const hollow = kit.pal([0.2, 0.17, 0.26], [0.14, 0.12, 0.2], [0.08, 0.07, 0.13]);
    const string = kit.pal([0.56, 0.68, 0.96], [0.36, 0.46, 0.84], [0.2, 0.26, 0.62]);
    const yel = kit.pal([1.0, 0.9, 0.5], [0.94, 0.78, 0.36], [0.6, 0.5, 0.4]);
    const cool = kit.pal([0.62, 0.74, 0.97], [0.5, 0.62, 0.9], [0.36, 0.46, 0.78]);
    const veil = kit.pal([0.76, 0.8, 0.94], [0.62, 0.68, 0.88], [0.44, 0.5, 0.74]);
    // the harper: robed, hooded and faceless, as tall as a tower, one hand on the horn
    const rp = () => (kit.rand() < 0.26 ? yel : kit.rand() < 0.4 ? cool : tower);
    kit.fx(0, 1);
    kit.lathe(V(0.2, -1, -3.1), [[3.3, 0], [3.0, 2.5], [2.5, 6.5], [2.0, 10.5], [1.7, 13.5], [1.35, 15.2], [0.7, 16.2]], tower, { sides: 14, dabs: 460, size: [0.5, 2.6], dabPal: rp });
    kit.ball(V(0.2, 16.4, -2.9), [1.2, 1.55, 1.25], tower, { dabs: 70, size: [0.4, 1.2], grain: 'down', dabPal: rp });
    kit.ball(V(0.2, 16.1, -1.95), [0.56, 0.84, 0.3], veil, { dabs: 8, size: [0.3, 0.6], grain: 'down' });
    kit.tube([V(-1.3, 12.8, -2.5), V(-1.6, 11.0, -1.1), V(-0.95, 9.8, -0.1)], [0.72, 0.56, 0.34], tower, { sides: 7, dabs: 44, size: [0.3, 1.0], dabPal: rp });
    kit.fx(0);
    // the ram's skull, grown great, at the harper's feet
    kit.ball(V(0, 2.5, 1.2), [1.3, 1.2, 1.45], bone, { dabs: 80, size: [0.24, 0.66], grain: 'up' });
    kit.tube([V(0, 2.2, 2.0), V(0, 1.2, 2.9), V(0, 0.3, 3.5)], [0.9, 0.62, 0.36], bone, { sides: 8, dabs: 50, size: [0.22, 0.6] });
    for (const sx of [-1, 1]) {
      kit.ball(V(sx * 0.66, 2.65, 2.2), [0.4, 0.46, 0.28], hollow, { dabs: 6, size: [0.22, 0.32] });
      kit.ball(V(sx * 0.15, 0.56, 3.42), [0.09, 0.14, 0.09], hollow, {});
    }
    const right = [V(0.7, 3.3, 0.8), V(0.75, 6, 0.2), V(0.8, 9.5, 0), V(1.0, 12.5, -0.1), V(2.2, 14.6, 0), V(4.2, 15.2, 0.3), V(6.0, 14.0, 0.6)];
    const left = [V(-0.7, 3.3, 0.8), V(-0.75, 6, 0.2), V(-0.8, 9.5, 0), V(-1.1, 12.5, 0.2), V(-2.4, 14.8, 1.0), V(-4.4, 14.6, 2.4), V(-5.6, 11.5, 3.8), V(-5.4, 7.5, 4.8), V(-4.6, 4.2, 5.4), V(-4.0, 2.15, 5.7)];
    kit.fx(0, 1); // the horns are gold against the sun, not dark
    kit.tube(right, [0.34, 0.3, 0.27, 0.23, 0.18, 0.13, 0.05], horn, { sides: 7, dabs: 130, size: [0.12, 0.34], grain: 'round', spread: 0.1 });
    kit.tube(left, [0.34, 0.3, 0.27, 0.23, 0.2, 0.17, 0.14, 0.11, 0.08, 0.04], horn, { sides: 7, dabs: 200, size: [0.12, 0.34], grain: 'round', spread: 0.1 });
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) kit.dab(V(-0.52 + i * 0.13, 4.3 + j * 1.75, 0.15), UP, V(0, 0, 1), string, 0.05, 1.9);
    kit.fx(0);
    const m = M4(H.x, y0, H.z, yaw);
    add('harp', kit, { matrix: m });
    things.harp.tip = left[left.length - 1].clone().applyMatrix4(m);
    colliders.push({ x: H.x + Math.sin(yaw) * -2.6, z: H.z + Math.cos(yaw) * -2.6, y: y0, r: 2.3, h: 4 }, { x: H.x + Math.sin(yaw) * 1.2, z: H.z + Math.cos(yaw) * 1.2, y: y0, r: 1.2, h: 2 });
    const tip = light(29);
    const g = tip.pal([0.5, 0.4, 0.14], [0.5, 0.4, 0.14], [0.5, 0.4, 0.14]);
    tip.fx(0, 2);
    for (const [r, n] of [[0.28, 14], [0.5, 22], [0.75, 30]]) {
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; tip.dab(V(Math.cos(a) * r, Math.sin(a) * r, 0).add(left[left.length - 1]), V(-Math.sin(a), Math.cos(a), 0), V(0, 0, 1), g, 0.07, 0.22); }
    }
    add('hornGlow', tip, { cast: false, matrix: m });
  }

  // --- the king: old, crowned, robed in ochre, seated among the leaves; and the terracotta child at his knee ---
  {
    const K = PLACES.king, y0 = heightAt(K.x, K.z) - 0.1, yaw = Math.atan2(-11 - K.x, -251 - K.z), s = 1.45;
    const kit = createKit(shared, { seed: 30 });
    const robe = kit.pal([0.95, 0.68, 0.3], [0.78, 0.5, 0.24], [0.44, 0.28, 0.26]);
    const green = kit.pal([0.5, 0.7, 0.36], [0.32, 0.52, 0.3], [0.12, 0.28, 0.26]);
    const skin = kit.pal([0.94, 0.72, 0.44], [0.78, 0.54, 0.34], [0.46, 0.3, 0.3]);
    const beard = kit.pal([1, 0.99, 0.95], [0.86, 0.88, 0.94], [0.6, 0.64, 0.82]);
    const gold = kit.pal([1.0, 0.86, 0.3], [0.96, 0.7, 0.2], [0.7, 0.46, 0.16]);
    const fold = kit.pal([0.78, 0.48, 0.2], [0.62, 0.36, 0.16], [0.4, 0.22, 0.14]);
    const ink = kit.pal([0.3, 0.2, 0.16], [0.22, 0.14, 0.12], [0.12, 0.08, 0.08]);
    const snow = kit.pal([0.84, 0.86, 0.94], [0.74, 0.76, 0.88], [0.56, 0.6, 0.78]);
    kit.fx(0, 1); // flat colour, as crayon on card
    const rp = () => (kit.rand() < 0.34 ? fold : robe);
    kit.lathe(V(0, 0, 0), [[1.35, 0], [1.25, 0.5], [1.0, 1.2], [0.78, 1.9], [0.62, 2.3], [0.34, 2.5]], robe, { sides: 12, dabs: 280, size: [0.14, 0.8], dabPal: rp });
    for (const sx of [-1, 1]) {
      kit.ball(V(sx * 0.38, 1.0, 0.82), [0.44, 0.38, 0.62], robe, { dabs: 34, size: [0.14, 0.5], grain: 'up', dabPal: rp });
      kit.tube([V(sx * 0.64, 2.2, 0.15), V(sx * 0.74, 1.65, 0.6), V(sx * 0.36, 1.34, 1.12)], [0.22, 0.19, 0.13], robe, { sides: 6, dabs: 22, size: [0.12, 0.4], dabPal: rp });
      kit.ball(V(sx * 0.32, 1.32, 1.22), [0.11, 0.08, 0.15], skin, { dabs: 3, size: [0.08, 0.14] });
    }
    // the green lining of his robe, down the front between his knees
    kit.ball(V(0, 0.9, 0.86), [0.26, 0.8, 0.22], green, { dabs: 26, size: [0.12, 0.5], grain: 'down' });
    // his head and face
    kit.ball(V(0, 2.84, 0.12), [0.34, 0.4, 0.36], skin, { dabs: 18, size: [0.1, 0.2] });
    kit.tube([V(0, 2.92, 0.46), V(0, 2.76, 0.54)], [0.04, 0.065], skin, { sides: 5 });
    for (const sx of [-1, 1]) {
      kit.dab(V(sx * 0.13, 2.9, 0.46), V(1, 0, 0), V(0, 0, 1), ink, 0.035, 0.11);
      kit.dab(V(sx * 0.14, 2.98, 0.44), V(sx, -0.2, 0), V(0, 0, 1), snow, 0.04, 0.16);
    }
    // his beard: one long white fall from the chin to his lap; his hair down his back
    kit.tube([V(0, 2.68, 0.38), V(0, 2.2, 0.66), V(0, 1.6, 0.86), V(0, 1.1, 0.96)], [0.3, 0.32, 0.22, 0.05], beard, { sides: 8, dabs: 90, size: [0.07, 0.46], dabPal: () => (kit.rand() < 0.3 ? snow : beard) });
    kit.ball(V(0, 2.7, -0.16), [0.42, 0.62, 0.36], beard, { dabs: 46, size: [0.08, 0.42], grain: 'down', dabPal: () => (kit.rand() < 0.3 ? snow : beard) });
    for (const sx of [-1, 1]) kit.dab(V(sx * 0.1, 2.7, 0.5), V(sx, -0.5, 0), V(0, 0, 1), beard, 0.07, 0.24);
    // his crown
    kit.fx(0, 2);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; kit.tube([V(Math.cos(a) * 0.3, 3.12, 0.12 + Math.sin(a) * 0.3), V(Math.cos(a) * 0.44, 3.62 + 0.14 * (i % 2), 0.12 + Math.sin(a) * 0.44)], [0.085, 0.01], gold, { sides: 4, dabs: 2, size: [0.07, 0.32] }); }
    kit.lathe(V(0, 3.06, 0.12), [[0.33, 0], [0.35, 0.16]], gold, { sides: 10, dabs: 12, size: [0.08, 0.12], grain: 'round' });
    kit.fx(0);
    const m = M4(K.x, y0, K.z, yaw, s);
    add('king', kit, { matrix: m, scale: s });
    things.king.yaw = yaw;
    things.king.knee = V(0.2, 0, 1.75).applyMatrix4(m); // where the child stands
    colliders.push({ x: K.x, z: K.z, y: y0, r: 1.9, h: 3 });
    const halo = light(31);
    const g = halo.pal([0.4, 0.32, 0.1], [0.4, 0.32, 0.1], [0.4, 0.32, 0.1]);
    halo.fx(0, 2);
    for (const [r, n] of [[0.75, 30], [1.0, 40]]) for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; halo.dab(V(Math.cos(a) * r, 2.85 + Math.sin(a) * r, -0.15), V(-Math.sin(a), Math.cos(a), 0), V(0, 0, 1), g, 0.07, 0.24); }
    add('kingHalo', halo, { cast: false, matrix: m, scale: s });
    things.kingHalo.show(0);

    // the child: terracotta all over, no higher than his hip. Its right arm is a piece of its own, so that it can
    // be put up into his hand (story.js lays it from the child's shoulder to wherever his hand is).
    const kid = createKit(shared, { seed: 32, minPx: [2.5, 4], jitter: 0.12, uniforms: { uWalk: { value: 0 }, uStride: { value: 0.13 }, uHip: { value: 0.4 } }, decl: 'uniform float uWalk; uniform float uStride; uniform float uHip;', warp: /* glsl */ `
      void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
        if (fx.w > 0.5 && fx.w < 2.5) p.z += sin(uTime * 9.0 + (fx.w > 1.5 ? 3.1416 : 0.0)) * uWalk * uStride * clamp(1.0 - p.y / uHip, 0.0, 1.0);
        else p.y += abs(sin(uTime * 9.0)) * 0.018 * uWalk;
      }` });
    const clay = kid.pal([0.98, 0.6, 0.32], [0.84, 0.42, 0.23], [0.54, 0.24, 0.2]);
    const umber = kid.pal([0.62, 0.32, 0.2], [0.46, 0.22, 0.16], [0.28, 0.13, 0.13]);
    kid.fx(0, 0, 0, 0);
    kid.lathe(V(0, 0, 0), [[0.15, 0.33], [0.135, 0.46], [0.11, 0.6], [0.085, 0.7], [0.05, 0.74]], clay, { sides: 9, dabs: 30, size: [0.06, 0.16] });
    kid.ball(V(0, 0.86, 0.012), [0.122, 0.128, 0.126], clay, { dabs: 16, size: [0.06, 0.09], segs: [12, 8] });
    kid.ball(V(0, 0.905, -0.02), [0.128, 0.1, 0.128], umber, { dabs: 14, size: [0.05, 0.1], grain: 'down' }); // its hair
    for (const sx of [-1, 1]) {
      kid.dab(V(sx * 0.045, 0.865, 0.132), V(0, 1, 0), V(0, 0, 1), umber, 0.02, 0.024);
      kid.fx(0, 0, 0, sx > 0 ? 1 : 2);
      kid.tube([V(sx * 0.062, 0.4, 0), V(sx * 0.066, 0.2, 0.012), V(sx * 0.07, 0.03, 0.02)], [0.062, 0.05, 0.042], clay, { sides: 6, dabs: 8, size: [0.045, 0.13] });
      kid.ball(V(sx * 0.07, 0.03, 0.05), [0.045, 0.03, 0.075], clay, {});
      kid.fx(0, 0, 0, 0);
    }
    // its left arm hangs
    kid.tube([V(0.1, 0.69, 0), V(0.165, 0.53, 0.02), V(0.18, 0.4, 0.05)], [0.045, 0.038, 0.032], clay, { sides: 5, dabs: 6, size: [0.04, 0.12] });
    kid.ball(V(0.182, 0.375, 0.055), 0.04, clay, {});
    add('kid', kid, { cast: false });
    things.kid.shoulder = V(-0.1, 0.69, 0);
    // (the arm: from the origin one unit up y; story.js stretches it between shoulder and hand)
    const arm = createKit(shared, { seed: 132, minPx: [2.5, 4], jitter: 0.12 });
    const clay2 = arm.pal([0.98, 0.6, 0.32], [0.84, 0.42, 0.23], [0.54, 0.24, 0.2]);
    arm.tube([V(0, 0, 0), V(0, 0.5, 0), V(0, 0.94, 0)], [0.045, 0.038, 0.032], clay2, { sides: 5, dabs: 6, size: [0.04, 0.3] });
    arm.ball(V(0, 0.97, 0), [0.04, 0.045, 0.04], clay2, {});
    add('kidArm', arm, { cast: false });
  }

  // --- the salamander, as the film has it: a great smooth orange beast, round-headed, with pale green eyes under
  // lilac lids, two long white tusks, a forked red tongue, white claws, darker spots down its back, and a tail
  // that ends in ribbons of flame. It is all one supple thing: a wave runs down it from head to tail, it bends
  // into its turns and arches as it climbs (uBend, uArch), and its legs paddle in the water and trail in the air.
  {
    const WAVE = { k: 0.5, w: 3.4 };
    const kit = createKit(shared, {
      seed: 33, maxPx: [500, 1200], jitter: 0.13, lift: 0.2,
      uniforms: { uSwim: { value: 0.4 }, uBend: { value: 0 }, uArch: { value: 0 }, uFly: { value: 0 }, uGait: { value: 0 }, uTuck: { value: 0 } },
      decl: 'uniform float uSwim; uniform float uBend; uniform float uArch; uniform float uFly; uniform float uGait; uniform float uTuck;',
      warp: /* glsl */ `
        void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
          // its tongue darts out and in
          if (fx.w > 4.5 && fx.w < 5.5) p.z = 5.7 + (p.z - 5.7) * (0.25 + 0.75 * smoothstep(-0.3, 0.5, sin(uTime * 2.1) + 0.4 * sin(uTime * 6.3)));
          // its legs: paddling (1 and 2 turn about), or laid back along its sides in the air
          if (fx.w > 0.5 && fx.w < 2.5) {
            float ph = uTime * 4.6 + (fx.w > 1.5 ? 3.1416 : 0.0), k = clamp(abs(p.x) - 0.6, 0.0, 1.0);
            p.z += (sin(ph) * 0.55 * uGait - 1.1 * uTuck) * k;
            p.y += (max(cos(ph), 0.0) * 0.22 * uGait + 0.55 * uTuck) * k;
          }
          // the flames at the end of its tail lick about
          if (fx.w > 2.5 && fx.w < 3.5) { p.y += sin(uTime * 5.3 + p.z * 1.1 + p.x * 3.0) * 0.16; p.x += sin(uTime * 4.1 + p.z * 0.9) * 0.12; }
          float z = p.z, s = z - 1.2, behind = max(-s, 0.0);
          // the wave that runs down it: small at the head, wide at the tail
          float ph = z * ${WAVE.k.toFixed(2)} - uTime * ${WAVE.w.toFixed(2)};
          p.x += sin(ph) * (0.1 + 0.105 * behind) * uSwim;
          p.y += sin(ph + 1.3) * (0.05 + 0.062 * behind) * uFly;
          // and the turn it is making: it lies along the curve it flies
          p.x += uBend * s * abs(s) * 0.5 * (s > 0.0 ? 0.5 : 1.0);
          p.y += uArch * s * abs(s) * 0.5 * (s > 0.0 ? 0.4 : 1.0);
        }`,
      tail: /* glsl */ `if (aFx.w > 2.5 && aFx.w < 3.5) d.alive *= 0.7 + 0.3 * sin(uTime * 7.0 + aData.x * 9.0);`,
    });
    const orange = kit.pal([1.0, 0.63, 0.2], [0.98, 0.47, 0.12], [0.76, 0.28, 0.12]);
    const deep = kit.pal([0.94, 0.4, 0.12], [0.84, 0.29, 0.1], [0.58, 0.17, 0.12]);
    const belly = kit.pal([1.0, 0.84, 0.44], [0.99, 0.68, 0.28], [0.84, 0.44, 0.18]);
    const flame = kit.pal([1.0, 0.92, 0.46], [1.0, 0.7, 0.22], [0.96, 0.44, 0.14]);
    const ember = kit.pal([0.98, 0.44, 0.2], [0.88, 0.28, 0.2], [0.62, 0.17, 0.26]);
    const teal = kit.pal([0.8, 0.96, 0.92], [0.56, 0.84, 0.84], [0.3, 0.58, 0.64]);
    const lid = kit.pal([0.86, 0.8, 0.96], [0.72, 0.64, 0.88], [0.5, 0.42, 0.68]);
    const ivory = kit.pal([1, 0.99, 0.94], [0.93, 0.9, 0.86], [0.68, 0.64, 0.7]);
    const red = kit.pal([0.96, 0.26, 0.16], [0.82, 0.15, 0.12], [0.52, 0.08, 0.1]);
    const dark = kit.pal([0.14, 0.1, 0.14], [0.09, 0.07, 0.1], [0.05, 0.04, 0.07]);
    // its back, from the neck to the tip of the tail: [z, height of its middle, girth]
    const SP = [[4.0, 1.0, 0.72], [3.1, 0.98, 0.8], [1.9, 1.0, 1.0], [0.4, 0.98, 1.05], [-1.2, 0.92, 0.95], [-2.6, 0.82, 0.74], [-3.9, 0.74, 0.54], [-5.2, 0.7, 0.38], [-6.4, 0.72, 0.24], [-7.5, 0.76, 0.1]];
    const at = (z) => { let i = 0; while (i < SP.length - 2 && SP[i + 1][0] > z) i++; const a = SP[i], b = SP[i + 1], k = Math.min(1, Math.max(0, (z - a[0]) / (b[0] - a[0]))); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
    const skin = (z, an, out = 1) => { const [y, r] = at(z); return [V(Math.cos(an) * r * out, y + Math.sin(an) * r * out, z), V(Math.cos(an), Math.sin(an), 0)]; };
    kit.fx(0, 0, 1); // its paint lies flat on it: it is smooth-skinned
    kit.tube(SP.map(([z, y]) => V(0, y, z)), SP.map((q) => q[2]), orange, { sides: 14, dabs: 200, size: [0.5, 1.3], spread: 0.1, dabPal: () => (kit.rand() < 0.1 ? deep : orange) });
    // paler underneath
    for (let i = 0; i < 70; i++) { const [q, nn] = skin(4 - 10.6 * kit.rand(), -1.571 + (kit.rand() - 0.5) * 1.5); kit.dab(q, V(0, 0, 1), nn, belly, 0.42, 1.2); }
    // the spots down its back and sides: round touches of a deeper orange
    for (let i = 0; i < 90; i++) {
      const z = 3.6 - 9.8 * kit.rand(), [q, nn] = skin(z, 1.571 + (kit.rand() - 0.5) * 2.5, 1.01), k = 0.16 + 0.26 * kit.rand();
      kit.fx(0, 0, 1, 14);
      kit.dab(q, V(0, 0, 1), nn, deep, k, k);
    }
    kit.fx(0, 0, 1);
    // the head: broad and round, a blunt snout, a paler jaw, the dark of the mouth between
    kit.ball(V(0, 1.14, 4.55), [1.0, 0.82, 1.22], orange, { segs: [14, 9], dabs: 60, size: [0.4, 0.9], spread: 0.2, dabPal: () => (kit.rand() < 0.12 ? deep : orange) });
    kit.ball(V(0, 1.02, 5.5), [0.78, 0.54, 0.84], orange, { segs: [12, 8], dabs: 26, size: [0.34, 0.7], spread: 0.2 });
    kit.ball(V(0, 0.66, 5.3), [0.66, 0.1, 0.9], red, {});
    kit.ball(V(0, 0.5, 5.12), [0.7, 0.24, 0.98], belly, { segs: [12, 6], dabs: 16, size: [0.3, 0.6], spread: 0.2 });
    for (let i = 0; i < 10; i++) { const a = kit.rand() * 6.283, k = 0.14 + 0.16 * kit.rand(); kit.fx(0, 0, 1, 14); kit.dab(V(Math.cos(a) * 0.6, 1.98 - 0.1 * kit.rand(), 4.5 + Math.sin(a) * 0.8), V(0, 0, 1), UP, deep, k, k); }
    kit.fx(0, 0, 1);
    for (const sx of [-1, 1]) {
      // eyes: pale green, the pupil a dark upright seed, a lilac lid over the top
      kit.ball(V(sx * 0.66, 1.56, 4.72), 0.3, teal, { segs: [10, 8], dabs: 6, size: [0.16, 0.2] });
      kit.ball(V(sx * 0.9, 1.58, 4.84), [0.07, 0.17, 0.1], dark, {});
      kit.ball(V(sx * 0.64, 1.7, 4.68), [0.34, 0.2, 0.36], lid, { segs: [10, 6], dabs: 5, size: [0.16, 0.3] });
      kit.dab(V(sx * 0.24, 1.3, 6.26), V(0, 1, 0), V(0, 0.3, 1), dark, 0.06, 0.1); // a nostril
      // tusks: out of the corners of its mouth, down and forward in one long curve
      kit.fx(0, 1, 1);
      kit.tube([V(sx * 0.52, 0.74, 5.72), V(sx * 0.66, 0.3, 5.98), V(sx * 0.76, -0.12, 6.4), V(sx * 0.74, -0.34, 6.96), V(sx * 0.64, -0.28, 7.5)], [0.13, 0.12, 0.095, 0.06, 0.012], ivory, { sides: 6, dabs: 8, size: [0.09, 0.4] });
      kit.fx(0, 0, 1);
      // legs: short and thick, a broad foot, three white claws
      for (const [z, phase] of [[2.3, sx > 0 ? 1 : 2], [-2.1, sx > 0 ? 2 : 1]]) {
        kit.fx(0, 0, 1, phase);
        kit.tube([V(sx * 0.7, 0.8, z), V(sx * 1.4, 0.66, z + 0.14), V(sx * 1.66, 0.12, z + 0.48)], [0.36, 0.28, 0.2], orange, { sides: 7, dabs: 14, size: [0.22, 0.5], spread: 0.15 });
        kit.ball(V(sx * 1.7, 0.08, z + 0.74), [0.3, 0.11, 0.38], orange, { segs: [8, 5], dabs: 3, size: [0.2, 0.3] });
        kit.fx(0, 1, 0, phase);
        for (let i = -1; i <= 1; i++) kit.tube([V(sx * (1.7 + 0.16 * i), 0.07, z + 1.02), V(sx * (1.72 + 0.2 * i), 0.0, z + 1.34)], [0.055, 0.006], ivory, { sides: 4, dabs: 1, size: [0.05, 0.2] });
      }
    }
    // its tongue: red, forked
    kit.fx(0, 0, 0, 5);
    kit.tube([V(0, 0.68, 5.9), V(0.03, 0.58, 6.5), V(0, 0.52, 7.05)], [0.1, 0.08, 0.05], red, { sides: 5, dabs: 4, size: [0.07, 0.3] });
    for (const sx of [-1, 1]) kit.tube([V(0, 0.52, 7.05), V(sx * 0.22, 0.58, 7.6)], [0.045, 0.008], red, { sides: 4, dabs: 1, size: [0.05, 0.3] });
    // the tail's end: ribbons of flame, yellow where they leave it, red and violet at their tips
    const ribbons = low ? 5 : 7;
    for (let j = 0; j < ribbons; j++) {
      const an = (j / ribbons) * 6.283 + 0.4, ox = Math.cos(an) * (1.3 + 1.2 * kit.rand()), oy = Math.sin(an) * (0.9 + 0.7 * kit.rand()) + 0.5, len = 3.2 + 1.6 * kit.rand(), ph = kit.rand() * 6.283;
      for (let i = 0; i < 15; i++) {
        const u = (i + 0.5) / 15, wig = Math.sin(u * 5 + ph) * 0.3 * u;
        const q = V(ox * u * u + wig, 0.76 + oy * u * u + wig * 0.5, -7.1 - len * u);
        kit.fx(0.35, 1, 0, 3);
        kit.dab(q, V(-2 * ox * u - 0.3 * Math.cos(u * 5 + ph), -2 * oy * u, -len).normalize(), UP, u < 0.3 ? flame : u < 0.68 ? (kit.rand() < 0.5 ? flame : orange) : ember, 0.6 * (1 - 0.55 * u), len / 15 * 2.2);
      }
    }
    kit.fx(0.2, 1, 0, 3);
    kit.tube([V(0, 0.76, -7.4), V(0, 0.8, -8.4), V(0, 0.9, -9.8)], [0.14, 0.09, 0.02], flame, { sides: 5, dabs: 14, size: [0.3, 1.0] });
    kit.fx(0);
    add('salamander', kit, { cast: false });
    const sal = things.salamander;
    /** Where he sits, in its own frame, at time t: the wave carries the seat with it (as the shader has it). */
    sal.seat = (t, out = V()) => {
      const z = 1.2, ph = z * WAVE.k - t * WAVE.w, u = sal.uniforms;
      return out.set(Math.sin(ph) * 0.1 * u.uSwim.value, 2.02 + Math.sin(ph + 1.3) * 0.05 * u.uFly.value, z);
    };
    /** How it is moving: swim (the wave), fly (the wave up and down), gait (paddling), tuck (legs laid back), bend, arch. */
    sal.move = ({ swim = 0.4, fly = 0, gait = 0, tuck = 0, bend = 0, arch = 0 } = {}) => {
      const u = sal.uniforms;
      u.uSwim.value = swim; u.uFly.value = fly; u.uGait.value = gait; u.uTuck.value = tuck; u.uBend.value = bend; u.uArch.value = arch;
    };
  }

  // --- the wall along the canal, the white figures hand in hand on top of it, and the gate of light ---
  {
    const cz = PLACES.canalZ, wz = cz - 13, G = PLACES.gate, y0 = 1.0, top = 9.5;
    const kit = createKit(shared, { seed: 34, maxPx: [400, 1200] });
    const sand = kit.pal([0.95, 0.8, 0.5], [0.86, 0.68, 0.42], [0.7, 0.54, 0.4]);
    const deep = kit.pal([0.76, 0.58, 0.32], [0.64, 0.46, 0.28], [0.5, 0.36, 0.3]);
    const white = kit.pal([1, 0.99, 0.95], [0.93, 0.94, 0.97], [0.78, 0.82, 0.93]);
    const figure = (x, z, y, tall, armsUp = 0) => {
      kit.fx(0, 1);
      kit.tube([V(x, y + 0.95 * tall, z), V(x, y + 2.0 * tall, z)], [0.3 * tall, 0.26 * tall], white, { sides: 6, dabs: 4, size: [0.2 * tall, 0.7 * tall] });
      kit.ball(V(x, y + 2.42 * tall, z), 0.25 * tall, white, { segs: [7, 5], dabs: 2, size: [0.2 * tall, 0.24 * tall] });
      for (const sx of [-1, 1]) {
        kit.tube([V(x + sx * 0.14 * tall, y + 1.0 * tall, z), V(x + sx * 0.42 * tall, y, z)], [0.15 * tall, 0.09 * tall], white, { sides: 5, dabs: 2, size: [0.12 * tall, 0.6 * tall] });
        kit.tube([V(x + sx * 0.26 * tall, y + 1.9 * tall, z), V(x + sx * (1.0 - 0.3 * armsUp) * tall, y + (1.55 + 1.5 * armsUp) * tall, z), V(x + sx * (1.62 - 1.0 * armsUp) * tall, y + (1.5 + 2.6 * armsUp) * tall, z)], [0.1 * tall, 0.08 * tall, 0.06 * tall], white, { sides: 5, dabs: 2, size: [0.08 * tall, 0.5 * tall] });
      }
      kit.fx(0);
    };
    for (let x0 = 86; x0 < 240; x0 += 31) {
      const len = 29, cx = x0 + len / 2;
      kit.box(V(cx, (top + y0) / 2 - 1, wz), [len / 2, (top - y0) / 2 + 1, 1.6], sand, { dabs: 150, size: [0.7, 2.2], dabPal: () => (kit.rand() < 0.3 ? deep : sand) });
      for (let i = 0; i < 6; i++) {
        const x = x0 + 2.6 + i * 4.8;
        kit.fx(0, 0, 0, 10 + (i % 2 ? 3 : 7));
        kit.dab(V(x, y0 + 3.4, wz + 1.75), UP, V(0, 0, 1), deep, 1.1, 6.6);
        kit.dab(V(x + 1.6, y0 + 3.4, wz + 1.75), UP, V(0, 0, 1), deep, 0.5, 6.2);
      }
      kit.fx(0);
      colliders.push({ x: cx, z: wz, y: 4, box: [len / 2, 6, 1.7] });
    }
    for (let x = 88; x < 240; x += 3.25) figure(x, wz, top, 1);
    // the gate: two pylons, a taller figure on each, their hands meeting over the way through
    for (const sx of [-1, 1]) {
      kit.box(V(G.x, 5.5, cz + sx * 8), [2.2, 6.5, 2.2], sand, { dabs: 60, size: [0.7, 2.2] });
      figure(G.x, cz + sx * 8, 12, 1.9);
    }
    add('wall', kit);
    const gate = light(35);
    const g = gate.pal([0.3, 0.25, 0.08], [0.3, 0.25, 0.08], [0.3, 0.25, 0.08]);
    gate.fx(0, 2);
    for (let i = 0; i < 46; i++) gate.dab(V(G.x + (gate.rand() - 0.5) * 2, 1 + gate.rand() * 15, cz + (gate.rand() - 0.5) * 4.4), UP, V(1, 0, 0), g, 0.9, 6);
    for (let i = 0; i < 30; i++) { const a = (i / 30) * 6.283; gate.dab(V(G.x, 18.5 + Math.sin(a) * 5, cz + Math.cos(a) * 5), V(0, Math.sin(a), Math.cos(a)), V(1, 0, 0), g, 0.5, 7); }
    add('gateLight', gate, { cast: false });
  }

  // --- the mountain of the offering: spires, the starred altar, the golden stair ---
  {
    const T = PLACES.terrace, S = PLACES.summit, Mt = PLACES.mountain;
    const kit = createKit(shared, { seed: 36, maxPx: [400, 1200] });
    const rock = kit.pal([0.64, 0.56, 0.7], [0.44, 0.37, 0.52], [0.21, 0.17, 0.31]);
    const rock2 = kit.pal([0.74, 0.66, 0.68], [0.54, 0.46, 0.52], [0.27, 0.22, 0.32]);
    const gold = kit.pal([0.98, 0.84, 0.5], [0.84, 0.66, 0.36], [0.52, 0.4, 0.36]);
    const cloth = kit.pal([0.62, 0.48, 0.3], [0.46, 0.34, 0.24], [0.26, 0.19, 0.2]);
    const star = kit.pal([1, 0.92, 0.5], [1, 0.86, 0.4], [0.9, 0.7, 0.3]);
    const teal = kit.pal([0.4, 0.62, 0.62], [0.26, 0.46, 0.5], [0.12, 0.26, 0.34]);
    const spire = (x, z, h) => {
      const y = heightAt(x, z) - 1, r = h * (0.1 + 0.05 * rand()), lean = [(rand() - 0.5) * 0.12 * h, (rand() - 0.5) * 0.12 * h], pal = rand() < 0.3 ? rock2 : rock;
      kit.tube([V(x, y, z), V(x + lean[0] * 0.3, y + h * 0.4, z + lean[1] * 0.3), V(x + lean[0] * 0.7, y + h * 0.78, z + lean[1] * 0.7), V(x + lean[0], y + h, z + lean[1])], [r, r * 0.7, r * 0.34, 0.04], pal, { sides: 6, dabs: 14, size: [h * 0.05, h * 0.2], spread: 0.3 });
    };
    const yawS = Math.atan2(STAIR.dx, STAIR.dz), px = STAIR.dz, pz = -STAIR.dx; // across the stair
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * 6.283 + rand() * 0.2, r = 19 + 13 * rand(), x = T.x + Math.cos(a) * r, z = T.z + Math.sin(a) * r;
      const u = (x - STAIR.ax) * STAIR.dx + (z - STAIR.az) * STAIR.dz, v = Math.abs((x - STAIR.ax) * px + (z - STAIR.az) * pz);
      if (u > -8 && v < 9) continue; // the stair's own ground is left clear
      spire(x, z, 7 + 14 * rand());
    }
    for (let i = 0; i < 150; i++) {
      const a = rand() * 6.283, r = 34 + 105 * Math.sqrt(rand()), x = Mt.x + Math.cos(a) * r, z = Mt.z + Math.sin(a) * r;
      if (Math.hypot(x - T.x, z - T.z) < 32 || heightAt(x, z) < 6) continue;
      const u = (x - STAIR.ax) * STAIR.dx + (z - STAIR.az) * STAIR.dz, v = Math.abs((x - STAIR.ax) * px + (z - STAIR.az) * pz);
      if (u > -4 && u < STAIR.len + 6 && v < 9) continue;
      spire(x, z, 9 + 20 * rand());
    }
    // the altar: two blocks hung with a cloth of stars, one each side of the stair's foot
    for (const sx of [-1, 1]) {
      const cx = STAIR.ax - STAIR.dx * 1.2 + px * sx * 9.6, cz2 = STAIR.az - STAIR.dz * 1.2 + pz * sx * 9.6;
      kit.box(V(cx, T.y + 2.0, cz2), [5.6, 2.8, 1.5], cloth, { yaw: yawS, dabs: 110, size: [0.4, 1.4] });
      kit.box(V(cx, T.y + 4.9, cz2), [5.8, 0.16, 1.7], teal, { yaw: yawS, dabs: 22, size: [0.2, 0.9], grain: 'level' });
      for (let i = 0; i < 46; i++) {
        const a = (rand() - 0.5) * 10.6, hgt = T.y + 0.3 + rand() * 4.2;
        kit.fx(0, 1, 0, 14);
        kit.dab(V(cx + px * a - STAIR.dx * 1.62, hgt, cz2 + pz * a - STAIR.dz * 1.62), UP, V(-STAIR.dx, 0, -STAIR.dz), star, 0.34, 0.3);
      }
      kit.fx(0);
    }
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const u = (i + 0.5) / steps, y = STAIR.y0 + (STAIR.y1 - STAIR.y0) * u;
      kit.box(V(STAIR.ax + STAIR.dx * STAIR.len * u, y - 0.42, STAIR.az + STAIR.dz * STAIR.len * u), [3.5, 0.5, STAIR.len / steps * 0.5 + 0.04], gold, { yaw: yawS, dabs: 9, size: [0.26, 1.1], grain: 'level', top: true });
    }
    add('mountain', kit);
    things.mountain.stairYaw = yawS;

    // smoke: a black column and a white one beside the altar, and the wreath of dark cloud round the mountain's
    // head, with a hole left over the summit
    const smoke = createKit(shared, { seed: 37, cells: [4, 2], minPx: [6, 6], maxPx: [2600, 2600], jitter: 0.18, lift: 0, warp: /* glsl */ `
      void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
        p.x += sin(uTime * 0.21 + p.y * 0.19 + fx.w) * (0.6 + fx.w * 0.5);
        p.z += cos(uTime * 0.17 + p.y * 0.23 + fx.w * 2.0) * (0.6 + fx.w * 0.5);
        p.y += sin(uTime * 0.13 + p.x * 0.05) * 0.5;
      }` });
    const black = smoke.pal([0.4, 0.34, 0.36], [0.24, 0.2, 0.24], [0.12, 0.1, 0.14]);
    const pale = smoke.pal([0.99, 0.94, 0.9], [0.9, 0.8, 0.8], [0.64, 0.56, 0.62]);
    const storm = smoke.pal([0.34, 0.29, 0.31], [0.21, 0.17, 0.2], [0.1, 0.08, 0.11]);
    const brown = smoke.pal([0.42, 0.31, 0.26], [0.27, 0.2, 0.19], [0.14, 0.1, 0.11]);
    // each swell of it has a lighter crown and a darker belly: that is what makes it billow
    const blackHi = smoke.pal([0.58, 0.5, 0.5], [0.4, 0.34, 0.36], [0.24, 0.2, 0.23]);
    const blackLo = smoke.pal([0.2, 0.17, 0.19], [0.13, 0.11, 0.13], [0.07, 0.06, 0.08]);
    const paleHi = smoke.pal([1, 0.99, 0.96], [0.97, 0.92, 0.9], [0.8, 0.72, 0.76]);
    const paleLo = smoke.pal([0.94, 0.8, 0.8], [0.82, 0.66, 0.7], [0.56, 0.46, 0.54]);
    const stormHi = smoke.pal([0.6, 0.5, 0.46], [0.42, 0.34, 0.33], [0.24, 0.19, 0.2]);
    for (const [sx, pal, hi, lo] of [[-1, black, blackHi, blackLo], [1, pale, paleHi, paleLo]]) {
      const bx = STAIR.ax + px * sx * 15, bz = STAIR.az + pz * sx * 15;
      for (let i = 0; i < 90; i++) {
        const u = i / 90, y = T.y + 2 + u * 62, curl = u * 9 + sx, rr = 1.2 + 7 * u, size = 2.4 + 6 * u;
        const c = V(bx + Math.cos(curl) * rr + sx * 9 * u * u, y, bz + Math.sin(curl) * rr);
        const dir = V(Math.cos(curl), 0.5, Math.sin(curl)), nrm = V(-Math.sin(curl), 0.6, Math.cos(curl));
        smoke.fx(0, 0, 0, 1 + 3 * u);
        smoke.dab(c, dir, nrm, pal, size, size * 1.06);
        for (let k = 0; k < 2; k++) {
          const a = rand() * 6.283, o = size * (0.3 + 0.25 * rand());
          smoke.dab(V(c.x + Math.cos(a) * o, c.y + size * (0.28 + 0.2 * rand()), c.z + Math.sin(a) * o), dir, V(0, 1, 0), hi, size * 0.56, size * 0.6);
        }
        const a = rand() * 6.283;
        smoke.dab(V(c.x + Math.cos(a) * size * 0.3, c.y - size * 0.34, c.z + Math.sin(a) * size * 0.3), dir, V(0, -1, 0), lo, size * 0.62, size * 0.6);
      }
    }
    for (let i = 0; i < (low ? 380 : 620); i++) {
      const a = rand() * 6.283, r = 44 + 170 * Math.pow(rand(), 0.8), y = S.y + 14 + 62 * rand() + r * 0.1;
      smoke.fx(0, 0, 0, 2 + 6 * rand());
      smoke.dab(V(S.x + Math.cos(a) * r, y, S.z + Math.sin(a) * r), V(-Math.sin(a), 0.2 * (rand() - 0.5), Math.cos(a)), V(Math.cos(a) * 0.3, rand() < 0.5 ? 1 : -0.6, Math.sin(a) * 0.3), rand() < 0.1 ? pale : rand() < 0.5 ? brown : storm, 15 + 14 * rand(), 16 + 16 * rand());
      if (i % 2 === 0) smoke.dab(V(S.x + Math.cos(a) * r + (rand() - 0.5) * 9, y + 5 + 4 * rand(), S.z + Math.sin(a) * r + (rand() - 0.5) * 9), V(-Math.sin(a), 0, Math.cos(a)), V(0, 1, 0), stormHi, 8 + 6 * rand(), 8 + 6 * rand());
    }
    add('smoke', smoke, { cast: false });

    const pillar = light(38);
    const g = pillar.pal([0.26, 0.2, 0.06], [0.26, 0.2, 0.06], [0.26, 0.2, 0.06]);
    pillar.fx(0, 2);
    for (let i = 0; i < 60; i++) {
      const u = 0.25 + 0.75 * pillar.rand(), a = (pillar.rand() - 0.5) * 5.4;
      pillar.dab(V(STAIR.ax + STAIR.dx * STAIR.len * u + px * a, STAIR.y0 + (STAIR.y1 - STAIR.y0) * u + 10 + 16 * pillar.rand(), STAIR.az + STAIR.dz * STAIR.len * u + pz * a), UP, V(-STAIR.dx, 0, -STAIR.dz), g, 1.1, 18);
    }
    add('stairLight', pillar, { cast: false });
    things.stairLight.show(0);
  }

  // --- the angel: robed in cream, wings of rose and brown, a rope of pearls in her hand ---
  {
    const kit = createKit(shared, { seed: 39, maxPx: [500, 1400], warp: /* glsl */ `
      void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
        if (fx.w > 0.5 && fx.w < 1.5) { float o = max(abs(p.x) - 0.8, 0.0); p.y += o * (0.05 + 0.13 * sin(uTime * 1.2)); p.z -= o * o * 0.012 * (1.0 + sin(uTime * 1.2)); }
        if (fx.w > 1.5 && fx.w < 9.0) p.x += sin(uTime * 0.9 + p.y * 1.3) * 0.12 * (fx.w - 2.0 + 0.3);
      }` });
    const robe = kit.pal([0.99, 0.96, 0.85], [0.92, 0.84, 0.7], [0.64, 0.54, 0.52]);
    const fold = kit.pal([0.86, 0.66, 0.34], [0.66, 0.46, 0.26], [0.4, 0.27, 0.24]);
    const feather = kit.pal([1, 0.93, 0.89], [0.94, 0.8, 0.78], [0.66, 0.54, 0.6]);
    const under = kit.pal([0.62, 0.5, 0.44], [0.46, 0.36, 0.34], [0.26, 0.2, 0.22]);
    const pearl = kit.pal([1, 0.9, 0.93], [0.97, 0.76, 0.84], [0.82, 0.58, 0.7]);
    kit.lathe(V(0, 0, 0), [[1.6, 0], [1.25, 1.5], [0.98, 3.5], [0.86, 5.0], [1.08, 5.9], [0.46, 6.45]], robe, { sides: 12, dabs: 360, size: [0.3, 1.2], dabPal: () => (kit.rand() < 0.14 ? fold : robe) });
    kit.ball(V(0, 7.05, 0.05), [0.42, 0.5, 0.45], robe, { dabs: 26, size: [0.16, 0.3] });
    kit.ball(V(0, 7.35, -0.3), [0.4, 0.3, 0.36], fold, { dabs: 14, size: [0.14, 0.24] });
    const hand = V(-1.55, 4.5, 2.3);
    kit.tube([V(-0.95, 5.8, 0.1), V(-1.35, 5.1, 1.2), hand], [0.3, 0.24, 0.14], robe, { sides: 6, dabs: 24, size: [0.18, 0.5] });
    kit.tube([V(0.95, 5.8, 0.1), V(1.7, 5.3, 0.5), V(2.3, 4.9, 0.9)], [0.3, 0.24, 0.14], robe, { sides: 6, dabs: 24, size: [0.18, 0.5] });
    for (const sx of [-1, 1]) {
      kit.fx(0, 0, 0, 1);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sx * 0.42));
      kit.ball(V(sx * 4.9, 7.6, -0.9), [4.7, 2.3, 0.22], under, { quat: q, segs: [10, 5] });
      for (let i = 0; i < 190; i++) {
        const u = kit.rand(), v = kit.rand(), x = sx * (0.9 + u * 8.6), y = 5.6 + u * 4.2 + (v - 0.55) * (4.2 - 1.6 * u);
        const outer = u > 0.7 || v < 0.3;
        kit.dab(V(x, y, -0.62 - 0.03 * Math.abs(x)), V(sx * (0.25 + 0.5 * u), -1, 0), V(0, 0, 1), kit.rand() < 0.12 ? under : feather, 0.42, (outer ? 2.5 : 1.5) + kit.rand());
        if (i % 3 === 0) kit.dab(V(x, y, -1.15 - 0.03 * Math.abs(x)), V(sx * (0.25 + 0.5 * u), -1, 0), V(0, 0, -1), under, 0.5, 2.2);
      }
    }
    // the pearls: from her hand down in a long fall toward whoever stands before her, and a loop back over her arm
    const beads = (pts, n, sway) => {
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u)), w = u - k;
        kit.fx(0, 2, 0, 14);
        kit.dab(V().lerpVectors(pts[k], pts[k + 1], w), UP, V(0, 0, 1), pearl, 0.36, 0.33);
      }
    };
    // (the long fall comes down almost to the ground before him, where the pearls of light hang at its end)
    const end = V(-0.4, -1.1, 7.8);
    beads([hand, V(-1.5, 3.0, 3.4), V(-1.2, 1.4, 5.2), V(-0.85, 0.2, 6.6), end], 30);
    beads([hand, V(-2.6, 3.6, 1.6), V(-3.6, 4.6, 0.2), V(-3.0, 6.6, -0.6), V(0, 8.6, -0.8), V(3.2, 6.8, -0.4), V(2.3, 4.9, 0.9)], 40);
    kit.fx(0);
    add('angel', kit, { cast: false });
    things.angel.gift = end;
    // where the three pearls of light she gives hang, along the end of the fall
    things.angel.orbs = [end.clone(), V(-0.63, -0.45, 7.2), V(-1.03, 0.8, 5.9)];
    things.angel.show(0);
  }

  return { group, casters, colliders, things };
}
