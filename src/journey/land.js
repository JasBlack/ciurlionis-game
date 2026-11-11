// The island: one piece of ground that holds every painting the way passes through. The same heights are used by
// the picture (a map the shaders read), by his feet (a height field for the physics) and by everything planted.
// A second map says what each spot is: r the worn way, g which painting (zone / 8), b bare rock, a the mountain
// (0.5) and its red summit (1).
import * as THREE from 'three';
import { COMMON, LAND_RES } from '../oilpaint/common.js';
import { noise } from './noise.js';
import { JOURNEY } from './paint.js';
import { EXTENT, PLACES, nearWay, zoneOfT } from './way.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);

const M = PLACES.mountain, T = PLACES.terrace, S = PLACES.summit, L = PLACES.ledge;
// the golden stair: from the terrace's upper edge to the rim of the summit
const sd = Math.hypot(S.x - T.x, S.z - T.z), sx = (S.x - T.x) / sd, sz = (S.z - T.z) / sd;
export const STAIR = { ax: T.x + sx * 14, az: T.z + sz * 14, bx: S.x - sx * 15, bz: S.z - sz * 15, y0: T.y, y1: S.y, dx: sx, dz: sz, len: sd - 29, half: 3.6 };
/** The line the cliff west of the wood runs along, at each z. */
export const cliffX = (z) => -66 - 10 * noise(z / 35, 1.5) - 12 * Math.exp(-(((z - L.z) / 13) ** 2));

function rawHeight(x, z, wd, t, H, out) {
  const zone = zoneOfT(t);
  const tri = (c) => Math.max(0, 1 - Math.abs(zone - c));
  const low = sstep(4.6, 5.4, zone);
  let base = (13 + 9 * noise(x / 150 + 1.3, z / 150 - 0.7) + 4.5 * noise(x / 60 + 5, z / 60)) * (1 - 0.6 * low) - 2 * low;
  const relief = 17 * noise(x / 46 + 7, z / 46 + 2) * tri(1) + 5 * noise(x / 40 + 2, z / 40 - 3) * tri(2) + 6 * noise(x / 30 + 9, z / 30) * tri(3)
    + 13 * noise(x / 85 + 3, z / 85 - 5) * tri(4) + 1.6 * noise(x / 25, z / 25 + 4) * low;
  const k = Math.exp(-((wd / 60) ** 2));
  let h = base * (1 - k) + H * k + relief * (1 - 0.6 * Math.exp(-((wd / 10) ** 2)));
  h += 0.22 * noise(x / 9, z / 9) * sstep(1.5, 6, wd) - 0.18 * Math.exp(-(wd * wd) / 3);

  // the valley of cypresses west of the wood, under a cliff of sandstone; the cathedral's hill across it
  const cx = cliffX(z);
  const V = sstep(cx, cx - 20, x) * sstep(150, 92, z) * sstep(-132, -72, z);
  h += (11 + 2.5 * noise(x / 40, z / 40 + 8) - h) * V;
  const cd = Math.hypot(x - PLACES.cathedral.x, z - PLACES.cathedral.z);
  h += 46 * Math.exp(-((cd / 50) ** 2)) * sstep(0, 0.6, V + 0.4);
  if (cd < 30) h += (57 - h) * sstep(30, 20, cd); // a level top for it to stand on
  // the slab the ram stands on
  const ld = Math.hypot(x - L.x, z - L.z);
  h += (47.3 - h) * sstep(15, 8, ld);

  // the lowland of the pond and the canal that runs east from it to the gate
  const cz = PLACES.canalZ;
  const lowK = sstep(70, 30, Math.abs(z - cz)) * sstep(30, 52, x) * sstep(300, 264, x);
  h += (1.5 + 0.7 * noise(x / 20, z / 20) - h) * lowK * 0.9;
  const pd = Math.hypot(x - PLACES.pond.x, z - PLACES.pond.z) + 3 * noise(x / 9, z / 9);
  h += (-1.7 - h) * sstep(34, 24, pd);
  h += (-1.6 - h) * sstep(11, 6.5, Math.abs(z - cz)) * sstep(64, 74, x) * sstep(264, 252, x);

  // the mountain of the offering: a purple massif, a terrace for the altar, the stair, a flat red summit
  const md = Math.hypot(x - M.x, z - M.z);
  const mr = md * (1 + 0.16 * noise(x / 60 + 4, z / 60) + 0.06 * noise(x / 21, z / 21 + 3));
  let mh = M.top * (1 - Math.pow(Math.min(1.25, mr / M.r), 1.6));
  mh += 20 * Math.max(0, noise(x / 23 + 11, z / 23 - 4) - 0.25) * sstep(150, 70, md) * sstep(30, 52, md);
  h = smax(h, mh, 10);
  h += (S.y - h) * sstep(25, 16, md);
  const td = Math.hypot(x - T.x, z - T.z);
  h += (T.y - h) * sstep(25, 15, td);
  const u = ((x - STAIR.ax) * sx + (z - STAIR.az) * sz) / STAIR.len, v = Math.abs(-(x - STAIR.ax) * sz + (z - STAIR.az) * sx);
  if (u > -0.1 && u < 1.1 && v < 6) h += (STAIR.y0 + (STAIR.y1 - STAIR.y0) * Math.min(1, Math.max(0, u)) - h) * sstep(5.6, 3.8, v);

  // the sea: a long shelving beach on the south, where he comes out of it; steeper everywhere else
  const edge = EXTENT - Math.pow(x * x * x * x + z * z * z * z, 0.25) - 26;
  const south = 441 - z + 9 * noise(x / 70, 3.3);
  h = smin(h, 2.0 * edge, 12);
  // (only the shore itself shelves: a little way inland the land is free to rise)
  h = smin(h, south < 30 ? 0.085 * south : 2.55 + (south - 30) * 1.5, 1.2);
  out[0] = Math.max(h, -7);
  out[1] = 0.5 * sstep(M.r * 1.04, M.r * 0.84, mr) + 0.5 * sstep(23, 16, md);
  return out[0];
}

// --- maps ------------------------------------------------------------------------------------------------------
const N = LAND_RES;
const heights = new Float32Array(N * N);
const land = new Uint8Array(N * N * 4);
const at = (i) => -EXTENT + (i / (N - 1)) * 2 * EXTENT;

/** Works the maps out; stops every few rows for `pause(done 0..1)` so the page can breathe. */
export async function prepareLand(pause) {
  // the way is looked for coarsely everywhere, and exactly only near it
  const C = 257, cw = new Float32Array(C * C), ct = new Float32Array(C * C), cH = new Float32Array(C * C), cc = new Uint8Array(C * C);
  const near = {};
  for (let j = 0; j < C; j++) {
    if (pause && j % 32 === 0) await pause(0.3 * j / C);
    for (let i = 0; i < C; i++) {
      nearWay(-EXTENT + (i / (C - 1)) * 2 * EXTENT, -EXTENT + (j / (C - 1)) * 2 * EXTENT, near);
      const k = i + j * C;
      cw[k] = near.d; ct[k] = near.t; cH[k] = near.H; cc[k] = near.canal ? 1 : 0;
    }
  }
  const out = [0, 0];
  const ways = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    if (pause && j % 24 === 0) await pause(0.3 + 0.5 * j / N);
    const z = at(j), fj = (j / (N - 1)) * (C - 1), j0 = Math.min(C - 2, Math.floor(fj)), tj = fj - j0;
    for (let i = 0; i < N; i++) {
      const x = at(i), fi = (i / (N - 1)) * (C - 1), i0 = Math.min(C - 2, Math.floor(fi)), ti = fi - i0;
      const a = i0 + j0 * C, b = a + 1, c = a + C, d = c + 1;
      const mix4 = (m) => (m[a] + (m[b] - m[a]) * ti) * (1 - tj) + (m[c] + (m[d] - m[c]) * ti) * tj;
      let wd = mix4(cw), t = ct[ti < 0.5 ? (tj < 0.5 ? a : c) : (tj < 0.5 ? b : d)], H = mix4(cH), canal = cc[a] + cc[b] + cc[c] + cc[d] > 0;
      if (wd < 46) { nearWay(x, z, near); wd = near.d; t = near.t; H = near.H; canal = near.canal; }
      const k = i + j * N;
      heights[k] = rawHeight(x, z, wd, t, H, out);
      ways[k] = canal ? 99 : wd;
      land[k * 4 + 1] = Math.round(255 * zoneOfT(t) / 8);
      land[k * 4 + 3] = Math.round(255 * out[1]);
    }
  }
  for (let j = 0; j < N; j++) {
    if (pause && j % 64 === 0) await pause(0.8 + 0.2 * j / N);
    for (let i = 0; i < N; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(N - 1, j + 1);
      const hx = (heights[i1 + j * N] - heights[i0 + j * N]) / (i1 - i0), hz = (heights[i + j1 * N] - heights[i + j0 * N]) / (j1 - j0);
      const ny = 1 / Math.sqrt(1 + hx * hx + hz * hz);
      const k = (i + j * N) * 4, x = at(i), z = at(j);
      const ragged = noise(x * 0.9, z * 0.9) * 0.35 + noise(x * 0.23, z * 0.23) * 0.5;
      land[k] = Math.round(255 * (1 - sstep(0.9, 2.3, ways[i + j * N] + ragged)));
      // rock: wherever the ground is too steep to hold anything, the ram's slab, and outcrops through the wood
      const slab = sstep(17, 11, Math.hypot(x - L.x, z - L.z));
      const outcrop = sstep(0.42, 0.56, noise(x / 19 + 3, z / 19 - 7)) * sstep(95, 40, Math.hypot(x - L.x, z - L.z));
      land[k + 2] = Math.round(255 * Math.max(sstep(0.8, 0.7, ny + 0.06 * noise(x / 7, z / 7)), slab, outcrop));
    }
  }
}

/** Height of the ground at (x, z), read from the same map the picture uses. */
export function heightAt(x, z) {
  const fx = Math.min(N - 1.001, Math.max(0, ((x + EXTENT) / (2 * EXTENT)) * (N - 1)));
  const fz = Math.min(N - 1.001, Math.max(0, ((z + EXTENT) / (2 * EXTENT)) * (N - 1)));
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const a = heights[i + j * N], b = heights[i + 1 + j * N], c = heights[i + (j + 1) * N], d = heights[i + 1 + (j + 1) * N];
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
/** What the map says at (x, z): [way, zone 0..6, rock, mountain 0 / 0.5 / 1]. */
export function landAt(x, z) {
  const i = Math.min(N - 1, Math.max(0, Math.round(((x + EXTENT) / (2 * EXTENT)) * (N - 1))));
  const j = Math.min(N - 1, Math.max(0, Math.round(((z + EXTENT) / (2 * EXTENT)) * (N - 1))));
  const k = (i + j * N) * 4;
  return [land[k] / 255, land[k + 1] / 255 * 8, land[k + 2] / 255, land[k + 3] / 255];
}
export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = 1.2;
  return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}
/** The painting a spot stands in, 0..8 (7 the mountain, 8 its summit). */
export function zoneAt(x, z) {
  const m = landAt(x, z);
  return m[3] > 0.75 ? 8 : m[3] > 0.25 ? 7 : m[1];
}

export function createLand(shared) {
  const tHeight = new THREE.DataTexture(heights, N, N, THREE.RedFormat, THREE.FloatType);
  tHeight.minFilter = tHeight.magFilter = THREE.LinearFilter;
  tHeight.needsUpdate = true;
  const tLand = new THREE.DataTexture(land, N, N);
  tLand.minFilter = tLand.magFilter = THREE.LinearFilter;
  tLand.needsUpdate = true;
  shared.tHeight.value = tHeight;
  shared.tLand.value = tLand;
  shared.uExtent.value = EXTENT;

  // the ground itself carries the underpainting: the same mixes as the strokes laid over it, a little deeper, so
  // that what shows between them is paint too. It lies just under the true ground.
  const seg = 512;
  const geometry = new THREE.PlaneGeometry(2 * EXTENT, 2 * EXTENT, seg, seg);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) - 0.05);
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${JOURNEY}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() {
        vec4 m = texture(tLand, landUv(vWorld.xz));
        vec3 Nn = normalAt(vWorld.xz);
        // near the eye it is asked square by ragged square, so that it is in touches; far off, point by point
        float near = 1.0 - smoothstep(25.0, 110.0, distance(vWorld, cameraPosition));
        vec4 n = texture(tNoise, vWorld.xz / 3.1);
        vec2 sq = mix(vWorld.xz, floor(vWorld.xz / 0.5 + (n.rg - 0.5) * 1.8) * 0.5, near);
        vec3 P = vec3(sq.x, vWorld.y, sq.y);
        vec4 r = texture(tNoise, sq / 7.0), q = texture(tNoise, sq / 5.0 + 0.31);
        Paint g = groundPaint(P, Nn, m, lightOn(P, Nn), r, q);
        outC = vec4(hazed(g.c1 * 0.88, vWorld), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // the same ground again, for the sun to see: the hills' own shade
  const caster = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  caster.frustumCulled = false;
  const shade = new THREE.Scene();
  shade.add(caster);

  /** Heights for the physics: `cells` squares a side over the whole map, column by column. */
  function heightField(cells = 512, half = EXTENT) {
    const out = new Float32Array((cells + 1) * (cells + 1));
    for (let col = 0; col <= cells; col++) {
      for (let row = 0; row <= cells; row++) {
        out[row + col * (cells + 1)] = heightAt(-half + (col / cells) * 2 * half, -half + (row / cells) * 2 * half);
      }
    }
    return { heights: out, cells, half };
  }
  return { mesh, shade, heightField };
}
