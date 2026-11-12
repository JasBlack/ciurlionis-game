// A coil: clay rolled between the palms and laid down. A round section carried along a curve, a little uneven in
// thickness, pressed flatter on the side it lies on, and closed with a rounded end.
import * as THREE from 'three';

export function newPile() {
  return { position: [], normal: [], index: [], skinIndex: [], skinWeight: [], piece: [], spans: [] };
}

const P = new THREE.Vector3(), T = new THREE.Vector3(), U = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();

// points: the curve it follows. o.radius(u) its thickness along 0..1. o.up(p, out): which way is "away from what it
// lies on" at a point. o.rig(p, idx, w): which bones a section follows. o.closed: a ring.
export function coil(pile, points, o) {
  const closed = !!o.closed;
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  curve.arcLengthDivisions = Math.max(60, points.length * 12);
  const L = curve.getLength();
  const sides = o.sides ?? 12;
  const radius = o.radius;
  const press = o.press ?? 0.72; // how flat the underside is
  const crown = o.crown ?? 0.94; // and the top
  const r0 = radius(0), r1 = radius(1);
  const stepLen = o.step ?? Math.max(0.012, Math.min(r0, r1) * 0.42);

  // where the sections are: [distance along, scale of the section, lean of the normal along the curve]
  const rings = [];
  if (closed) {
    const n = Math.max(8, Math.round(L / stepLen));
    for (let i = 0; i < n; i++) rings.push([(L * i) / n, 1, 0, -1]);
  } else {
    const C = 5;
    for (let j = 0; j < C; j++) { const f = (Math.PI / 2) * (1 - j / C); rings.push([r0 * (1 - Math.sin(f)), Math.cos(f), -Math.sin(f), r0]); }
    const body = Math.max(1, Math.round((L - r0 - r1) / stepLen));
    for (let i = 0; i <= body; i++) rings.push([r0 + ((L - r0 - r1) * i) / body, 1, 0, -1]);
    for (let j = C - 1; j >= 0; j--) { const f = (Math.PI / 2) * (1 - j / C); rings.push([L - r1 * (1 - Math.sin(f)), Math.cos(f), Math.sin(f), r1]); }
  }

  const base = pile.position.length / 3;
  const idx = [0, 0, 0, 0], w = [0, 0, 0, 0];
  const up = [0, 1, 0];
  for (const [s, scale, lean, capR] of rings) {
    const u = Math.min(1, Math.max(0, s / L));
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T);
    o.up(P, up);
    U.set(up[0], up[1], up[2]);
    B.crossVectors(T, U);
    if (B.lengthSq() < 1e-6) B.set(T.y, -T.x, 0);
    B.normalize();
    N.crossVectors(B, T);
    const r = (capR > 0 ? capR : radius(u)) * scale;
    o.rig(P, idx, w, u);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const flat = sn < 0 ? press : crown;
      pile.position.push(P.x + r * (c * B.x + flat * sn * N.x), P.y + r * (c * B.y + flat * sn * N.y), P.z + r * (c * B.z + flat * sn * N.z));
      let nx = c * B.x + (sn / flat) * N.x, ny = c * B.y + (sn / flat) * N.y, nz = c * B.z + (sn / flat) * N.z;
      const nl = Math.hypot(nx, ny, nz);
      const side = Math.sqrt(Math.max(0, 1 - lean * lean)) / nl;
      nx = nx * side + T.x * lean; ny = ny * side + T.y * lean; nz = nz * side + T.z * lean;
      pile.normal.push(nx, ny, nz);
      pile.skinIndex.push(idx[0], idx[1], idx[2], idx[3]);
      pile.skinWeight.push(w[0], w[1], w[2], w[3]);
      pile.piece.push(o.piece ?? 0);
    }
  }
  const count = rings.length;
  const last = closed ? count : count - 1;
  for (let i = 0; i < last; i++) {
    const i2 = (i + 1) % count;
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const a = base + i * sides + k, b = base + i * sides + k2, c = base + i2 * sides + k, d = base + i2 * sides + k2;
      pile.index.push(a, c, b, b, c, d);
    }
  }
  // remembered as a run of balls, for finding the creases beside it
  const cuts = Math.max(2, Math.round(L / 0.04));
  let prev = null, prevR = 0;
  for (let i = 0; i <= (closed ? cuts : cuts); i++) {
    const u = i / cuts;
    curve.getPointAt(closed ? u % 1 : u, P);
    const here = [P.x, P.y, P.z], r = radius(u) * 0.9;
    if (prev) pile.spans.push([prev, here, prevR, r]);
    prev = here; prevR = r;
  }
}

export function pileGeometry(pile) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pile.position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pile.normal, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(pile.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pile.skinWeight, 4));
  g.setAttribute('aPiece', new THREE.Float32BufferAttribute(pile.piece, 1));
  g.setIndex(pile.index);
  return g;
}
