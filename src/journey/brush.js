// The marks of the film's brush. The block's own sheet is a loaded bristle brush that runs dry; the film's hills
// are laid in something cleaner: small leaf-shaped touches, pointed at both ends, set down side by side like
// scales, each a little lighter along its middle. This sheet has the block's layout (4 x 2 cells; r how thick the
// paint stands, g where there is paint, b a slow streak for the second colour), so it can stand in for it:
//   0 1 2  leaves, each a little different      3 7  leaves with a curve to them (a comma)
//   4 5    round soft touches (clouds, pads, pearls, stars)      6  a long slim leaf
import * as THREE from 'three';
import { BRUSH_COLS, BRUSH_ROWS } from '../oilpaint/brush.js';

const CW = 128, CH = 256;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (t) => t * t * (3 - 2 * t);
const n1 = (x, seed) => { const i = Math.floor(x), f = smooth(x - i); return hash(i + seed * 57.3) * (1 - f) + hash(i + 1 + seed * 57.3) * f; };
const n2 = (x, y, seed) => {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  const h = (a, b) => hash(a * 1.31 + b * 91.7 + seed * 13.9);
  return (h(i, j) * (1 - fx) + h(i + 1, j) * fx) * (1 - fy) + (h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx) * fy;
};
const sstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

// kind 0 a leaf, 1 a round touch, 2 a curved leaf, 3 a long slim leaf
function mark(u, v, seed, kind) {
  if (kind === 1) {
    const r = Math.hypot(u / 0.8, (v - 0.5) / 0.46);
    const edge = 1 + (n1(Math.atan2(v - 0.5, u) * 1.6 + 9, seed) - 0.5) * 0.16;
    const alpha = 1 - sstep(edge - 0.14, edge, r);
    const height = alpha * (0.42 + 0.2 * (1 - r * r) + 0.12 * n2(u * 4, v * 6, seed) + 0.12 * sstep(0.55, 0.95, r));
    return [height, alpha, n2(u * 2.4, v * 1.6, seed + 20)];
  }
  const bend = kind === 2 ? (seed % 2 ? 0.42 : -0.42) : (hash(seed * 3.1) - 0.5) * 0.14;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  // pointed at both ends, widest a little below the middle, where the brush touched down
  const t = Math.min(1, Math.max(0, v));
  const shape = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.86)), 0.72);
  const half = (kind === 3 ? 0.42 : 0.72) * shape * (1 + (n1(v * 5, seed + 1) - 0.5) * 0.08) + 0.001;
  const a = Math.abs(ub + (n1(v * 4, seed + 3) - 0.5) * 0.05);
  const alpha = (1 - sstep(half - 0.1, half, a)) * sstep(0.02, 0.07, v) * (1 - sstep(0.93, 0.98, v));
  const rib = 1 - Math.min(1, a / Math.max(half, 0.05));
  const furrow = n1(ub * 9 + n1(v * 2.2, seed + 12), seed + 33);
  const height = alpha * (0.34 + 0.26 * rib + 0.1 * furrow + 0.14 * (1 - sstep(0.05, 0.4, v)) + 0.08 * n2(ub * 3, v * 6, seed + 14));
  return [Math.min(1, height), alpha, n2(ub * 3.0, v * 1.2, seed + 20) * 0.7 + 0.3 * (1 - rib)];
}

export function createLeafSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 0, 0, 2, 1, 1, 3, 2];
  for (let cell = 0; cell < 8; cell++) {
    const cx = cell % BRUSH_COLS, cy = Math.floor(cell / BRUSH_COLS);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const u = ((x + 0.5) / CW) * 2 - 1, v = (y + 0.5) / CH;
        const m = 0.9;
        const [h, a, s] = Math.abs(u) > m || v < 0.04 || v > 0.96 ? [0, 0, 0.5] : mark(u / m, (v - 0.04) / 0.92, cell * 7 + 1, kinds[cell]);
        const i = ((cx * CW + x) + (cy * CH + y) * W) * 4;
        data[i] = Math.round(h * 255);
        data[i + 1] = Math.round(a * 255);
        data[i + 2] = Math.round(s * 255);
        data[i + 3] = 255;
      }
    }
  }
  const t = new THREE.DataTexture(data, W, H);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
