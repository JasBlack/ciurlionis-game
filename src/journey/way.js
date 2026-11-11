// The way through the island, taken from the film: out of the sea under Rex, up the striped hills to the
// dandelion, down to the willows, through the round wood to the ram's ledge, into the sunset to the horn-harp,
// the night garden and its king, the lily pond, and (carried) to the mountain of the offering.
// Everything else is placed against these points. North is -z; he walks north.
export const EXTENT = 512;

// [x, z, height of the ground there]
const WAY = [
  [0, 456, -0.8], [0, 432, 0.5], [-18, 385, 9], [14, 330, 22], [-12, 275, 38], [24, 225, 25], [44, 172, 31], [22, 122, 27],
  [-22, 78, 33], [-48, 30, 47], [-30, -30, 37], [6, -92, 31], [22, -150, 30], [10, -205, 17], [-12, -252, 9], [12, -300, 4], [40, -338, 0.8],
];
// which painting the ground belongs to, by how far along the control points it is (see ZONE below)
const ZONE_KEYS = [[0, 0], [1.75, 0], [2.1, 1], [4.6, 1], [5.0, 2], [6.7, 2], [7.1, 3], [9.6, 3], [10.0, 4], [12.6, 4], [13.0, 5], [15.3, 5], [15.7, 6], [16, 6]];
export const ZONE = { SHORE: 0, HILLS: 1, WILLOWS: 2, WOOD: 3, SUNSET: 4, GARDEN: 5, POND: 6, MOUNTAIN: 7, SUMMIT: 8 };

export const PLACES = {
  start: { x: 0, z: 453 },
  rex: { x: 5, z: 506 },
  dandelion: { x: -13, z: 268 },
  willows: { x: 44, z: 172 },
  ledge: { x: -64, z: 30 },
  cathedral: { x: -268, z: 48 },
  harp: { x: 25, z: -152 },
  wake: { x: 9, z: -212 },
  king: { x: -18, z: -257 },
  pond: { x: 72, z: -354 },
  shore: { x: 40, z: -338 },
  canalZ: -354,
  gate: { x: 252, z: -354 },
  mountain: { x: 360, z: -120, r: 150, top: 150 },
  terrace: { x: 336, z: -171, y: 121 },
  summit: { x: 360, z: -120, y: 143 },
};

const keyed = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const k = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k * k * (3 - 2 * k);
    }
  }
  return keys[keys.length - 1][1];
};

// samples along the way: x, z, t (control index, fractional), H, s (metres from the start)
const PER = 24;
const samples = [];
{
  const at = (i) => WAY[Math.max(0, Math.min(WAY.length - 1, i))];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < WAY.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < PER; k++) {
      const t = k / PER;
      samples.push({ x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t), t: i + t, H: p1[2] + (p2[2] - p1[2]) * t * t * (3 - 2 * t) });
    }
  }
  const last = WAY[WAY.length - 1];
  samples.push({ x: last[0], z: last[1], t: WAY.length - 1, H: last[2] });
  let s = 0;
  samples.forEach((p, i) => { if (i) s += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z); p.s = s; });
}
export const way = samples;
export const WAY_LENGTH = samples[samples.length - 1].s;
// the bank of the canal: low ground east of the pond, all of it the pond's painting
const canal = [];
for (let x = 48; x <= 262; x += 6) canal.push({ x, z: PLACES.canalZ + 16, t: 16, H: 1.7, s: WAY_LENGTH });

/** Nearest point of the way (or the canal bank) to (x, z): { d, t, H, s }. */
export function nearWay(x, z, out = {}) {
  let best = Infinity, bi = 0, bk = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i], b = samples[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const d = (x - a.x - dx * k) ** 2 + (z - a.z - dz * k) ** 2;
    if (d < best) { best = d; bi = i; bk = k; }
  }
  const a = samples[bi], b = samples[bi + 1];
  out.canal = false; out.d = Math.sqrt(best); out.t = a.t + (b.t - a.t) * bk; out.H = a.H + (b.H - a.H) * bk; out.s = a.s + (b.s - a.s) * bk;
  for (const c of canal) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < out.d - 6) { out.d = d; out.t = c.t; out.H = c.H; out.s = c.s; out.canal = true; }
  }
  return out;
}
/** The painting (0..6) a point along the way belongs to, as a number that slides from one to the next. */
export const zoneOfT = (t) => keyed(ZONE_KEYS, t);
/** Where the way is after s metres: { x, z, yaw } (yaw: the way he would face walking it). */
export function wayAt(s, out = {}) {
  s = Math.max(0, Math.min(WAY_LENGTH, s));
  let i = 0;
  while (i < samples.length - 2 && samples[i + 1].s < s) i++;
  const a = samples[i], b = samples[i + 1], k = (s - a.s) / Math.max(1e-6, b.s - a.s);
  out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k; out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return out;
}
/** s of the sample nearest a place. */
export function sNear(x, z) { return nearWay(x, z).s; }
