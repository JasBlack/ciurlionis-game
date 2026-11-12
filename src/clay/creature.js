// A beast made the way the clay ones are: lumps of coloured clay pressed into a body, and white coils laid over
// it for a skeleton: a beaded spine, ribs, a shoulder blade, leg bones, toes, rings for the eyes and the hips.
// Everything is worked out from a number (the seed); a different number is a different beast.
import * as THREE from 'three';
import { rng, noise3 } from './rand.js';
import { lump, makeField, sampleGrid, skin, pressInto, openness } from './field.js';
import { newPile, coil, pileGeometry } from './coil.js';

const ROOT = 0, CHEST = 1, NECK = 2, HEAD = 3, TAIL = 4; // tail: 4, 5, 6
const LEG = 7; // four legs of three bones each: front left, front right, hind left, hind right
const BONES = 19;
const SIGMA = 0.055;

export function buildCreature(seed) {
  const R = rng(seed * 7919 + 17);
  const q = {
    leg: 0.92 + R() * 0.28,
    len: 0.92 + R() * 0.2,
    girth: 0.92 + R() * 0.2,
    hump: R(),
    head: 0.92 + R() * 0.22,
    droop: R(),
    ribs: 4 + Math.floor(R() * 3),
    horns: R() < 0.65,
    tail: 0.75 + R() * 0.6,
    limb: Math.floor(R() * 3), // what the legs and head are made of: 0 the same as the body, 1 night sky, 2 marbled
    hue: R(),
    collar: R() < 0.7,
  };
  const { leg, len, girth: g, head: hs } = q;
  const yT = 0.2 + 0.78 * leg;

  // ---- the joints
  const H = [1.38 * len, yT + 0.12 - 0.26 * q.droop, 0];
  const muzzle = [H[0] + 0.4 * hs, H[1] - (0.2 + 0.12 * q.droop) * hs, 0];
  const neckA = [0.95 * len, yT + 0.14, 0];
  const joint = [];
  joint[ROOT] = [0, yT, 0];
  joint[CHEST] = [0.2 * len, yT, 0];
  joint[NECK] = neckA;
  joint[HEAD] = H;
  const parent = [-1, ROOT, CHEST, NECK, ROOT, TAIL, TAIL + 1];
  const tailPts = [
    [-1.02 * len, yT + 0.1, 0], [-1.02 * len - 0.2 * q.tail, yT + 0.14, 0.02], [-1.02 * len - 0.42 * q.tail, yT + 0.02, 0.05],
    [-1.02 * len - 0.54 * q.tail, yT - 0.22 * q.tail, 0.06], [-1.02 * len - 0.52 * q.tail, yT - 0.46 * q.tail, 0.02],
  ];
  joint[TAIL] = tailPts[0]; joint[TAIL + 1] = tailPts[1].map((v, i) => (v + tailPts[2][i]) / 2); joint[TAIL + 2] = tailPts[3];
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const front = i < 2, s = i % 2 === 0 ? 1 : -1;
    const top = front ? [0.64 * len, yT - 0.12, s * 0.29 * g] : [-0.7 * len, yT - 0.12, s * 0.27 * g];
    const mid = front ? [0.6 * len, 0.1 + 0.36 * leg, s * 0.3 * g] : [-0.52 * len, 0.1 + 0.39 * leg, s * 0.3 * g];
    const low = front ? [0.64 * len, 0.115, s * 0.3 * g] : [-0.75 * len, 0.12, s * 0.3 * g];
    const b = LEG + i * 3;
    joint[b] = top; joint[b + 1] = mid; joint[b + 2] = low;
    parent[b] = front ? CHEST : ROOT; parent[b + 1] = b; parent[b + 2] = b + 1;
    legs.push({ front, s, top, mid, low, b });
  }

  // ---- the lumps of the body
  const raw = [
    [[0.62 * len, yT + 0.04, 0], null, 0.46 * g, 0, CHEST, 0.82],
    [[0.46 * len, yT + 0.22 + 0.16 * q.hump, 0], null, 0.3 + 0.12 * q.hump, 0, CHEST, 0.72],
    [[0.42 * len, yT - 0.03, 0], [-0.55 * len, yT, 0], 0.42 * g, 0.36 * g, ROOT, 0.85],
    [[-0.72 * len, yT + 0.02, 0], null, 0.4 * g, 0, ROOT, 0.85],
    [neckA, [H[0] - 0.04, H[1] + 0.02, 0], 0.3, 0.22, NECK, 0.85],
    [H, muzzle, 0.25 * hs, 0.15 * hs, HEAD, 0.9],
    [[H[0] + 0.08 * hs, H[1] + 0.1 * hs, 0], null, 0.17 * hs, 0, HEAD, 0.9],
  ];
  for (const L of legs) {
    const fx = L.low[0] + 0.15;
    if (L.front) {
      raw.push([L.top, L.mid, 0.21, 0.105, L.b, 1], [L.mid, L.low, 0.1, 0.075, L.b + 1, 1]);
      raw.push([[L.low[0], 0.078, L.low[2]], [fx, 0.062, L.low[2]], 0.085, 0.065, L.b + 2, 1]);
    } else {
      raw.push([L.top, L.mid, 0.25, 0.115, L.b, 1], [L.mid, L.low, 0.105, 0.07, L.b + 1, 1]);
      raw.push([[L.low[0], 0.078, L.low[2]], [fx, 0.062, L.low[2]], 0.08, 0.065, L.b + 2, 1]);
    }
  }
  const lumps = raw.map(([a, b, ra, rb, bone, zs]) => lump(a, b ?? a, ra, b ? rb : ra, bone, zs));
  const field = makeField(lumps, 0.14, BONES);

  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const [a, b, ra, rb] of raw) for (const p of [a, b ?? a]) for (let i = 0; i < 3; i++) {
    const r = Math.max(ra, rb) + 0.3;
    min[i] = Math.min(min[i], p[i] - r); max[i] = Math.max(max[i], p[i] + r);
  }
  for (const p of tailPts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i] - 0.3); max[i] = Math.max(max[i], p[i] + 0.3); }
  max[1] += 0.5; min[1] = Math.min(min[1], -0.1);
  const grid = sampleGrid(field, min, max, 0.02);
  const body = skin(field, grid);

  // ---- the coils
  const pile = newPile();
  let pieces = 0;
  const up = (P, out) => { field.normal(P.x, P.y, P.z, out); };
  const upY = (P, out) => { out[0] = 0; out[1] = 1; out[2] = 0; };
  const follow = (P, idx, w) => field.weights(P.x, P.y, P.z, SIGMA, idx, w, 0);
  const fixed = (b) => (P, idx, w) => { idx[0] = b; idx[1] = idx[2] = idx[3] = 0; w[0] = 1; w[1] = w[2] = w[3] = 0; };
  const nz = () => R() * 40;
  const rolled = (r, t0 = 1, t1 = 1, k = nz()) => (u) => r * (t0 + (t1 - t0) * u) * (0.9 + 0.2 * noise3(u * 6 + k, k, 0, 3));
  const bone = (r, knob = 0.5, k = nz()) => (u) => r * (1 + knob * (Math.exp(-((u / 0.14) ** 2)) + Math.exp(-(((1 - u) / 0.14) ** 2)))) * (0.94 + 0.12 * noise3(u * 5 + k, k, 0, 3));
  const beaded = (r, beads, t1 = 1, k = nz()) => (u) => r * (1 + (t1 - 1) * u) * (0.8 + 0.34 * Math.abs(Math.sin(Math.PI * u * beads)) ** 0.8) * (0.95 + 0.1 * noise3(u * 9 + k, k, 0, 3));

  // lay a coil along guide points, each dropped onto the skin along its own direction
  const dropped = (guides, r, miss) => {
    const pts = [];
    for (const [g0, d] of guides) {
      const o = [g0[0] + (R() - 0.5) * 0.026, g0[1] + (R() - 0.5) * 0.026, g0[2] + (R() - 0.5) * 0.026]; // no hand lays a true line
      const l = Math.hypot(d[0], d[1], d[2]);
      const dir = [d[0] / l, d[1] / l, d[2] / l];
      const t = field.cast(o, dir, r * 0.42);
      if (t >= 0) pts.push(new THREE.Vector3(o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t));
      else if (miss) pts.push(miss(o));
    }
    return pts;
  };
  const lay = (guides, radius, o = {}) => {
    const pts = dropped(guides, radius(0.5), o.miss);
    if (pts.length < 2) return;
    coil(pile, pts, { radius, up: o.up ?? up, rig: o.rig ?? follow, closed: o.closed, piece: ++pieces, press: o.press, crown: o.crown, sides: o.sides });
  };
  const line = (a, b, n, dirOf) => Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    return [p, dirOf(p, t)];
  });
  const down = () => [0, -1, 0];

  // spine, from the rump over the hump and down the neck
  lay(line([-0.97 * len, 3, 0], [H[0] - 0.07, 3, 0], 22, down), beaded(0.078, 17, 0.85));

  // ribs
  for (let i = 0; i < q.ribs; i++) {
    const f = i / (q.ribs - 1);
    const x = (0.4 - 0.72 * f) * len;
    const end = (146 - 26 * f) * (Math.PI / 180), start = 13 * (Math.PI / 180);
    for (const s of [1, -1]) {
      const guides = [];
      for (let j = 0; j < 10; j++) {
        const t = j / 9, a = start + (end - start) * t;
        const px = x - 0.13 * t - 0.05 * Math.sin(t * Math.PI);
        guides.push([[px, yT + 1.6 * Math.cos(a), s * 1.6 * Math.sin(a)], [0, -Math.cos(a), -s * Math.sin(a)]]);
      }
      lay(guides, rolled(0.066, 1.05, 0.72));
    }
  }

  for (const L of legs) {
    const { s, top, mid, low, b } = L;
    const inward = () => [0, 0, -s];
    const out = 1.3 * s;
    if (L.front) {
      // shoulder blade: a flattened paddle
      lay(line([0.5 * len, yT + 0.34 + 0.1 * q.hump, out], [top[0] + 0.01, top[1] + 0.02, out], 6, (p) => [0, -0.25 * (p[1] - yT), -s]),
        (u) => 0.13 * (1 - 0.4 * u) * (0.92 + 0.16 * noise3(u * 4, seed, s, 5)), { press: 0.42, crown: 0.5, sides: 14 });
    } else {
      // hip: a ring
      const guides = [];
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2;
        guides.push([[top[0] - 0.02 + 0.2 * Math.cos(a), top[1] + 0.1 + 0.19 * Math.sin(a), out], inward()]);
      }
      lay(guides, rolled(0.06), { closed: true });
    }
    lay(line([top[0], top[1] - 0.04, out], [mid[0], mid[1] + 0.03, out], 4, inward), bone(L.front ? 0.07 : 0.076), { rig: fixed(b) });
    lay(line([mid[0], mid[1] - 0.05, out], [low[0], low[1] + 0.03, out], 4, inward), bone(0.058, 0.45), { rig: fixed(b + 1) });
    // toes, draped over the foot and out onto the ground
    for (let j = -1; j <= 1; j++) {
      const a = [low[0] + 0.105, 0.3, low[2] + j * 0.05], e = [low[0] + 0.36 - Math.abs(j) * 0.035, 0.3, low[2] + j * 0.14];
      lay(line(a, e, 6, down), bone(0.04, 0.3), { rig: fixed(b + 2), miss: (o) => new THREE.Vector3(o[0], 0.034, o[2]), up: upY, crown: 1 });
    }
  }

  // the skull: a ridge down the nose, a jaw line and a ring for the eye on each side
  const hx = (t) => [H[0] + (muzzle[0] - H[0]) * t, H[1] + (muzzle[1] - H[1]) * t];
  const hr = (t) => (0.25 + (0.15 - 0.25) * t) * hs;
  lay(Array.from({ length: 8 }, (_, i) => { const t = 0.02 + (i / 7) * 1.06; const [x, y] = hx(t); return [[x, y + 2, 0], [0, -1, 0]]; }), rolled(0.056, 1, 0.7), { rig: fixed(HEAD) });
  for (const s of [1, -1]) {
    lay(Array.from({ length: 7 }, (_, i) => { const t = -0.05 + (i / 6) * 1.0; const [x, y] = hx(t); return [[x, y - 0.6 * hr(t), s * 1.2], [0, 0, -s]]; }), rolled(0.05, 1.1, 0.75), { rig: fixed(HEAD) });
    const [ex, ey] = hx(0.2);
    const ring = [];
    for (let j = 0; j < 10; j++) { const a = (j / 10) * Math.PI * 2; ring.push([[ex + 0.1 * hs * Math.cos(a), ey + 0.05 * hs + 0.095 * hs * Math.sin(a), s * 1.2], [0, 0, -s]]); }
    lay(ring, rolled(0.04), { closed: true, rig: fixed(HEAD) });
    if (q.horns) {
      const pts = [[H[0] + 0.03, H[1] + 0.19 * hs, s * 0.12], [H[0] - 0.05, H[1] + 0.35 * hs, s * 0.26], [H[0] + 0.02, H[1] + 0.5 * hs, s * 0.31], [H[0] + 0.12, H[1] + 0.59 * hs, s * 0.27]];
      coil(pile, pts.map((p) => new THREE.Vector3(...p)), { radius: rolled(0.06, 1, 0.34), up: (P, o) => { o[0] = 0; o[1] = 0; o[2] = s; }, rig: fixed(HEAD), piece: ++pieces, press: 1, crown: 1 });
    }
  }

  // a coil wound once round the neck
  if (q.collar) {
    const c = [neckA[0] + (H[0] - neckA[0]) * 0.42, neckA[1] + (H[1] - neckA[1]) * 0.42];
    const ax = new THREE.Vector3(H[0] - neckA[0], H[1] - neckA[1], 0).normalize();
    const e1 = new THREE.Vector3(-ax.y, ax.x, 0), e2 = new THREE.Vector3(0, 0, 1);
    const guides = [];
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * Math.PI * 2;
      const o = [c[0] + 1.2 * (Math.cos(a) * e1.x), c[1] + 1.2 * (Math.cos(a) * e1.y), 1.2 * Math.sin(a)];
      guides.push([o, [c[0] - o[0], c[1] - o[1], -o[2]]]);
    }
    lay(guides, rolled(0.064), { closed: true });
  }

  // the tail, standing free
  coil(pile, tailPts.map((p) => new THREE.Vector3(...p)), {
    radius: beaded(0.07, 10, 0.5), up: upY, piece: ++pieces, press: 1, crown: 1,
    rig: (P, idx, w, u) => {
      const f = Math.min(2.999, u * 3), i = Math.floor(f), t = f - i;
      idx[0] = TAIL + i; idx[1] = TAIL + Math.min(2, i + 1); idx[2] = idx[3] = 0;
      w[0] = 1 - t; w[1] = t; w[2] = w[3] = 0;
    },
  });

  // ---- creases: the coils are pressed into a copy of the grid and every point asks how open it is
  for (const [a, b, ra, rb] of pile.spans) pressInto(grid, a, b, ra, rb);
  const shade = (pos, nor) => {
    const ao = new Float32Array(pos.length / 3);
    for (let i = 0; i < ao.length; i++) ao[i] = openness(grid, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
    return ao;
  };

  // ---- the flesh
  const count = body.position.length / 3;
  const sIdx = new Uint16Array(count * 4), sW = new Float32Array(count * 4), limb = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    field.weights(body.position[i * 3], body.position[i * 3 + 1], body.position[i * 3 + 2], SIGMA, sIdx, sW, i * 4);
    let l = 0;
    for (let k = 0; k < 4; k++) if (sIdx[i * 4 + k] >= LEG || sIdx[i * 4 + k] === HEAD) l += sW[i * 4 + k];
    limb[i] = l;
  }
  const flesh = new THREE.BufferGeometry();
  flesh.setAttribute('position', new THREE.BufferAttribute(body.position, 3));
  flesh.setAttribute('normal', new THREE.BufferAttribute(body.normal, 3));
  flesh.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4));
  flesh.setAttribute('skinWeight', new THREE.BufferAttribute(sW, 4));
  flesh.setAttribute('aPiece', new THREE.BufferAttribute(limb, 1));
  flesh.setAttribute('aOpen', new THREE.BufferAttribute(shade(body.position, body.normal), 1));
  flesh.setIndex(new THREE.BufferAttribute(body.index, 1));

  const coils = pileGeometry(pile);
  coils.setAttribute('aOpen', new THREE.BufferAttribute(shade(pile.position, pile.normal), 1));

  // ---- the bones it moves by
  const bones = joint.map(() => new THREE.Bone());
  for (let i = 0; i < BONES; i++) {
    const p = parent[i];
    if (p < 0) bones[i].position.set(...joint[i]);
    else { bones[i].position.set(joint[i][0] - joint[p][0], joint[i][1] - joint[p][1], joint[i][2] - joint[p][2]); bones[p].add(bones[i]); }
  }
  const rest = bones.map((b) => b.position.clone());
  bones[ROOT].updateMatrixWorld(true); // the skeleton remembers this stance as the one the clay was shaped in
  const skeleton = new THREE.Skeleton(bones);

  // How it stands at time t (seconds); `frame` only feeds the small errors a hand makes between exposures.
  function pose(t, frame, slip = 1) {
    const wob = (k) => (noise3(frame * 0.731 + k * 3.17, k, 0, 9) - 0.5) * 0.016 * slip;
    const s = Math.sin;
    for (let i = 0; i < BONES; i++) { bones[i].rotation.set(0, 0, 0); bones[i].position.copy(rest[i]); bones[i].scale.setScalar(1); }
    // one front foot lifted and set down, now and then
    const cyc = (t % 6.4) / 1.5;
    const lift = cyc < 1 ? Math.sin(Math.PI * cyc) ** 2 : 0;
    const land = cyc >= 1 && cyc < 1.25 ? Math.sin(Math.PI * (cyc - 1) * 4) : 0;
    bones[ROOT].position.y += 0.008 * s(t * 2.0) - 0.012 * land;
    bones[ROOT].position.x += 0.012 * s(t * 0.5);
    bones[ROOT].rotation.x = 0.018 * s(t * 0.6) - 0.03 * lift;
    bones[ROOT].rotation.z = -0.012 * lift;
    bones[CHEST].scale.setScalar(1 + 0.014 * s(t * 2.0));
    bones[CHEST].rotation.z = 0.012 * s(t * 2.0 + 0.6) + 0.03 * lift;
    bones[NECK].rotation.y = 0.24 * s(t * 0.47) + wob(1);
    bones[NECK].rotation.z = 0.07 * s(t * 0.83 + 1) + 0.05 * lift + wob(2);
    bones[HEAD].rotation.y = 0.2 * s(t * 0.47 - 0.7) + wob(3);
    bones[HEAD].rotation.z = -0.05 + 0.1 * s(t * 1.13) + wob(4);
    bones[HEAD].rotation.x = 0.09 * s(t * 0.71) + wob(5);
    for (let i = 0; i < 3; i++) {
      bones[TAIL + i].rotation.y = 0.3 * s(t * 2.2 - i * 0.9) + wob(6 + i);
      bones[TAIL + i].rotation.z = 0.09 * s(t * 1.3 - i * 1.1);
    }
    bones[LEG].rotation.z = 0.9 * lift;
    bones[LEG + 1].rotation.z = -1.9 * lift;
    bones[LEG + 2].rotation.z = 1.0 * lift;
  }

  return {
    q, flesh, coils, bones, skeleton, pose,
    count: { flesh: count, coils: pile.position.length / 3, pieces },
    glow: [[0.35 * len, yT - 0.05, 0], [-0.45 * len, yT - 0.02, 0]],
    focus: [0.3 * len, yT * 0.82, 0],
  };
}
