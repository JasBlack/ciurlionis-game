// The hour of each painting: its sky, its air, what the water holds, what light is in the sky. He walks from one
// into the next, and everything here slides from the one set to the other as he goes.
import * as THREE from 'three';

const MOODS = [
  { // 0 the sea under Rex: rose, primrose and pale blue
    high: [0.5, 0.74, 0.88], low: [0.99, 0.9, 0.62], a: [0.95, 0.74, 0.76], b: [0.7, 0.78, 0.9], haze: [0.94, 0.87, 0.72], hazeSun: [1.0, 0.92, 0.7],
    dens: 0.0011, air: [0, 0, 0, 0], mirror: 0.5, water: [0.13, 0.3, 0.68], tint: [1, 1, 1], range: [0.66, 0.62, 0.8], glaze: [0.42, 0.46, 0.8],
  },
  { // 1 the striped hills: peach under a clear blue
    high: [0.56, 0.73, 0.9], low: [0.97, 0.82, 0.72], a: [0.96, 0.72, 0.64], b: [0.74, 0.8, 0.92], haze: [0.9, 0.81, 0.77], hazeSun: [1.0, 0.86, 0.7],
    dens: 0.001, air: [0, 0, 0.12, 0], mirror: 0.6, water: [0.16, 0.3, 0.66], tint: [1, 1, 1], range: [0.64, 0.6, 0.8], glaze: [0.36, 0.42, 0.86],
  },
  { // 2 the willows: a grey blue afternoon piled with cloud
    high: [0.58, 0.71, 0.82], low: [0.92, 0.89, 0.8], a: [0.97, 0.94, 0.86], b: [0.7, 0.76, 0.86], haze: [0.88, 0.87, 0.81], hazeSun: [0.98, 0.94, 0.8],
    dens: 0.0012, air: [0, 0, 1, 0], water: [0.26, 0.38, 0.56], tint: [1, 1, 1], range: [0.64, 0.66, 0.78], glaze: [0.4, 0.5, 0.7],
  },
  { // 3 the round wood and the cathedral: deep clear blue, the first gold rays
    high: [0.38, 0.63, 0.88], low: [0.8, 0.8, 0.85], a: [0.72, 0.68, 0.86], b: [0.98, 0.88, 0.56], haze: [0.74, 0.76, 0.87], hazeSun: [0.98, 0.9, 0.66],
    dens: 0.001, air: [0.4, 0, 0.15, 0], water: [0.14, 0.3, 0.56], tint: [1, 1, 1], range: [0.66, 0.6, 0.82], glaze: [0.4, 0.42, 0.74],
  },
  { // 4 the sunset: orange under teal, the land gone to blue
    high: [0.15, 0.45, 0.62], low: [0.98, 0.6, 0.12], a: [1.0, 0.78, 0.2], b: [0.2, 0.62, 0.66], haze: [0.5, 0.4, 0.44], hazeSun: [1.0, 0.62, 0.16],
    dens: 0.0012, air: [1, 0, 0, 0], water: [0.08, 0.16, 0.44], tint: [0.9, 0.8, 0.86], range: [0.2, 0.28, 0.56], glaze: [0.3, 0.3, 0.7],
  },
  { // 5 the night garden: ultramarine, a crescent, gold stars
    high: [0.17, 0.23, 0.66], low: [0.42, 0.48, 0.88], a: [0.28, 0.34, 0.8], b: [0.56, 0.5, 0.86], haze: [0.44, 0.5, 0.8], hazeSun: [0.56, 0.58, 0.86],
    dens: 0.0014, air: [0, 1, 0, 0], water: [0.08, 0.14, 0.36], tint: [0.86, 0.9, 1.04], range: [0.26, 0.3, 0.6], glaze: [0.36, 0.4, 0.74],
  },
  { // 6 the lily pond: a clear morning
    high: [0.32, 0.59, 0.88], low: [0.72, 0.84, 0.92], a: [0.56, 0.74, 0.92], b: [0.86, 0.9, 0.92], haze: [0.7, 0.8, 0.88], hazeSun: [0.9, 0.92, 0.86],
    dens: 0.001, air: [0, 0, 0.3, 0], mirror: 0.36, water: [0.03, 0.13, 0.13], tint: [1, 1, 1], range: [0.56, 0.62, 0.8], glaze: [0.4, 0.46, 0.7],
  },
  { // 7 the mountain: smoke, violet grey, a bone-coloured light
    high: [0.36, 0.33, 0.42], low: [0.68, 0.63, 0.61], a: [0.3, 0.26, 0.3], b: [0.8, 0.72, 0.7], haze: [0.6, 0.56, 0.58], hazeSun: [0.76, 0.7, 0.66],
    dens: 0.0015, air: [0, 0, 0, 1], water: [0.26, 0.26, 0.38], tint: [0.92, 0.9, 0.94], range: [0.44, 0.42, 0.52], glaze: [0.42, 0.36, 0.5],
  },
  { // 8 the summit, as the cloud opens
    high: [0.44, 0.4, 0.5], low: [0.74, 0.68, 0.64], a: [0.34, 0.3, 0.34], b: [0.86, 0.78, 0.74], haze: [0.64, 0.6, 0.62], hazeSun: [0.82, 0.76, 0.7],
    dens: 0.0013, air: [0, 0, 0, 1], water: [0.3, 0.3, 0.46], tint: [0.96, 0.93, 0.95], range: [0.48, 0.46, 0.56], glaze: [0.44, 0.36, 0.5],
  },
];
const KEYS = ['high', 'low', 'a', 'b', 'haze', 'hazeSun', 'air', 'water', 'tint', 'range', 'glaze'];

export function createMood(shared) {
  const now = structuredClone(MOODS[0]);
  const want = structuredClone(MOODS[0]);
  now.mirror = want.mirror = MOODS[0].mirror ?? 1;
  function apply() {
    shared.uSkyHigh.value.setRGB(...now.high);
    shared.uSkyLow.value.setRGB(...now.low);
    shared.uSkyA.value.setRGB(...now.a);
    shared.uSkyB.value.setRGB(...now.b);
    shared.uHaze.value.setRGB(...now.haze);
    shared.uHazeSun.value.setRGB(...now.hazeSun);
    shared.uHazeDensity.value = now.dens;
    shared.uMirror.value = now.mirror;
    shared.uAir.value.set(...now.air);
    shared.uWaterDeep.value.setRGB(...now.water);
    shared.uTint.value.setRGB(...now.tint);
    shared.uRange?.value.setRGB(...now.range);
    shared.uGlazeMul.value.setRGB(...now.glaze);
  }
  return {
    now,
    /** zone: the painting he stands in, 0..8 (it may lie between two). rate 0 sets it at once. */
    update(dt, zone, rate = 0.6) {
      const z = THREE.MathUtils.clamp(zone, 0, MOODS.length - 1), i = Math.min(MOODS.length - 2, Math.floor(z)), k = z - i;
      const A = MOODS[i], B = MOODS[i + 1];
      const t = rate > 0 ? 1 - Math.exp(-rate * dt) : 1;
      for (const key of KEYS) for (let c = 0; c < A[key].length; c++) {
        want[key][c] = A[key][c] + (B[key][c] - A[key][c]) * k;
        now[key][c] += (want[key][c] - now[key][c]) * t;
      }
      want.dens = A.dens + (B.dens - A.dens) * k;
      now.dens += (want.dens - now.dens) * t;
      // how much of the sky the water gives back: the pond is dark, the sea is not
      want.mirror = (A.mirror ?? 1) + ((B.mirror ?? 1) - (A.mirror ?? 1)) * k;
      now.mirror += (want.mirror - now.mirror) * t;
      apply();
    },
  };
}
