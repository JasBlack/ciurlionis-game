// Small geometry helpers for the built-in masks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _p = new THREE.Vector3();

/**
 * A tube along a smooth curve through `points`, whose radius changes along its length.
 * @param {THREE.Vector3[]} points
 * @param {{ radius: (t: number) => number, radial?: number, segments?: number, color?: THREE.Color | ((t: number) => THREE.Color) }} o
 */
export function taperedTube(points, { radius, radial = 8, segments = 24, color = null }) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const frames = curve.computeFrenetFrames(segments, false);
  const pos = [], nor = [], col = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, _p);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = Math.max(radius(t), 0.001);
    const c = color ? (typeof color === 'function' ? color(t) : color) : null;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(_p.x + r * nx, _p.y + r * ny, _p.z + r * nz);
      nor.push(nx, ny, nz);
      if (c) col.push(c.r, c.g, c.b);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + ring;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (c0(color)) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.userData.curve = curve;
  geo.userData.frames = frames;
  return geo;
}
const c0 = (c) => c != null;

/** Give a stock geometry one flat vertex colour and drop its uvs, so it can be merged with tubes. */
export function tint(geo, color) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  return geo;
}

/** Merge geometries that all carry position, normal and colour. Disposes the parts. */
export function merge(parts) {
  for (const g of parts) if (g.attributes.uv) g.deleteAttribute('uv');
  const out = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return out;
}

/** A damped spring toward zero that is pushed by the head's motion: follow-through for beards and horns. */
export class Sway {
  constructor(stiffness = 60, damping = 9) {
    this.k = stiffness; this.c = damping;
    this.x = 0; this.v = 0;
  }
  step(push, dt) {
    if (dt <= 0) return this.x;
    const h = Math.min(dt, 1 / 30);
    this.v += (-this.k * this.x - this.c * this.v + push) * h;
    this.x += this.v * h;
    this.x = THREE.MathUtils.clamp(this.x, -0.6, 0.6);
    return this.x;
  }
}

/** A seeded random number generator (mulberry32), so a mask looks the same every time it is built. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
