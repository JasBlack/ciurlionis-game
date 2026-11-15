// "Iridescent Satyr": a procedural stand-in for the character on the reference sheet, built from code so the
// app has a full-head, expressive mask before the real sculpt exists. Pearlescent skin, glossy dark tentacle hair,
// ram-curl tentacle horns with suckers, black dome eyes ringed in amber, pale tentacle moustache, streaked beard.
//
// Everything is in canonical face space (cm, +X wearer's left, +Y up, +Z out of the face) and the shell is
// larger than a real head on every side, so no angle shows the wearer.
import * as THREE from 'three';
import { taperedTube, tint, merge, Sway, rng, smooth } from './geom.js';

const C = [0, 1.6, -2.4]; // centre of the head shell
const R = [10, 13, 12]; // its radii
const D2R = Math.PI / 180;

const col = (hex) => new THREE.Color(hex);
const SKIN = col(0x7f86ea), SKIN_LIGHT = col(0xaab2f7), HAIR = col(0x231a2b), HAIR_HI = col(0x47385c);
const CYAN = col(0x55e8d6), YELLOW = col(0xf4ea62), ORANGE = col(0xff9638);
const PEARL = col(0xefeafc), LIME = col(0xb6f074), PINK = col(0xf279c2), TEAL = col(0x52dccb), VIOLET = col(0x8f6fe0);

const jawTaper = (y) => 1 - 0.14 * smooth(-0.25, -0.95, (y - C[1]) / R[1]);
/** Front surface of the shell at (x, y), pushed out by `lift`. */
function on(x, y, lift = 0) {
  const k = 1 - (x / (R[0] * jawTaper(y))) ** 2 - ((y - C[1]) / R[1]) ** 2;
  return new THREE.Vector3(x, y, C[2] + R[2] * Math.sqrt(Math.max(k, 0.0004)) + lift);
}
function normalAt(p) {
  return new THREE.Vector3((p.x - C[0]) / R[0] ** 2, (p.y - C[1]) / R[1] ** 2, (p.z - C[2]) / R[2] ** 2).normalize();
}

function rainbow(t, out) {
  return t < 0.5 ? out.copy(CYAN).lerp(YELLOW, t * 2) : out.copy(YELLOW).lerp(ORANGE, t * 2 - 1);
}

function buildShell() {
  const g = new THREE.SphereGeometry(1, 64, 44);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const hair = new Float32Array(p.count);
  const c = new THREE.Color(), r = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const Y = C[1] + p.getY(i) * R[1];
    const X = C[0] + p.getX(i) * R[0] * jawTaper(Y);
    const Z = C[2] + p.getZ(i) * R[2];
    p.setXYZ(i, X, Y, Z);
    // hair: above a brow line that dips at the centre, and everything behind the ears
    const brow = 4.7 + 0.05 * X * X + 0.45 * Math.min(Math.abs(X), 2.4);
    hair[i] = Math.max(smooth(brow - 0.5, brow + 0.5, Y), smooth(1.2, -1.6, Z) * smooth(-10.5, -8.5, Y));
    // skin: periwinkle, lighter down the middle, a spectrum across the cheeks (stronger on the wearer's left)
    c.copy(SKIN).lerp(SKIN_LIGHT, smooth(4.5, 0, Math.abs(X)) * 0.5);
    const cheek = smooth(2.2, 5, Math.abs(X)) * smooth(-7, -2.5, Y) * smooth(6, 2.5, Y) * (X > 0 ? 0.9 : 0.45);
    if (cheek > 0) c.lerp(rainbow(smooth(2.5, 9, Math.abs(X)), r), cheek);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();

  // the hair is its own skin-tight cap just outside the shell, so it can have its own, duller surface
  const cap = g.clone();
  const cp = cap.attributes.position, cc = cap.attributes.color;
  for (let i = 0; i < cp.count; i++) {
    cp.setXYZ(i, C[0] + (cp.getX(i) - C[0]) * 1.022, C[1] + (cp.getY(i) - C[1]) * 1.022, C[2] + (cp.getZ(i) - C[2]) * 1.022);
    cc.setXYZ(i, HAIR.r, HAIR.g, HAIR.b);
  }
  const src = g.index.array, keep = [];
  for (let i = 0; i < src.length; i += 3) {
    if (hair[src[i]] > 0.5 && hair[src[i + 1]] > 0.5 && hair[src[i + 2]] > 0.5) keep.push(src[i], src[i + 1], src[i + 2]);
  }
  cap.setIndex(keep);
  return { skin: g, cap };
}

/** A point on the skull, `lift` above the shell: `el` runs from the forehead (0) over the top (90) to the nape (180),
 *  `az` leans it toward the wearer's left (+) or right (-). */
function skull(el, az, lift) {
  const e = el * D2R, a = az * D2R;
  const dx = Math.sin(e) * Math.sin(a), dy = Math.sin(e) * Math.cos(a), dz = Math.cos(e);
  return new THREE.Vector3(C[0] + dx * (R[0] + lift), C[1] + dy * (R[1] + lift), C[2] + dz * (R[2] + lift));
}

function buildHair(rand) {
  const parts = [];
  const c = new THREE.Color();
  const N = 15;
  for (let k = 0; k < N; k++) {
    const az0 = -82 + (164 * k) / (N - 1);
    const el0 = 30 + 16 * Math.abs(az0) / 82 + rand() * 4;
    const wob = (rand() - 0.5) * 14, ph = rand() * 6.28;
    const pts = [];
    for (let i = 0; i <= 9; i++) {
      const u = i / 9;
      pts.push(skull(el0 + (168 - el0) * u, az0 * (1 - 0.2 * u) + wob * Math.sin(u * 5 + ph) * u, 0.25 + 0.5 * Math.sin(Math.PI * u)));
    }
    const streak = rand();
    const base = c.copy(HAIR).lerp(HAIR_HI, rand() * 0.6).clone();
    const tipC = streak < 0.18 ? VIOLET : streak < 0.3 ? LIME : streak < 0.4 ? PINK : base;
    const thick = 1.05 + rand() * 0.55;
    parts.push(taperedTube(pts, {
      radial: 8, segments: 30,
      radius: (t) => 0.3 + thick * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.06)) ** 0.7,
      color: (t) => new THREE.Color().copy(base).lerp(tipC, smooth(0.25, 0.6, t) * smooth(0.95, 0.6, t) * 0.75),
    }));
  }
  // small curled tips standing up along the crown
  for (const az of [-46, -23, 0, 22, 44]) {
    const b = skull(72 + rand() * 10, az + (rand() - 0.5) * 8, 0);
    const n = normalAt(b);
    const side = new THREE.Vector3(Math.sign(az || 1) * 0.8, 0.2, -0.55).normalize();
    const h = 2.6 + rand() * 1.6;
    const pts = [
      b.clone().addScaledVector(n, -0.6),
      b.clone().addScaledVector(n, h * 0.5),
      b.clone().addScaledVector(n, h).addScaledVector(side, 0.7),
      b.clone().addScaledVector(n, h * 1.18).addScaledVector(side, 1.8),
      b.clone().addScaledVector(n, h * 0.95).addScaledVector(side, 2.6),
      b.clone().addScaledVector(n, h * 0.6).addScaledVector(side, 2.3),
    ];
    parts.push(taperedTube(pts, { radial: 7, segments: 22, radius: (t) => 0.62 * (1 - t) ** 0.8 + 0.07, color: HAIR }));
  }
  return parts;
}

function hornCurve(sgn) {
  const e1 = new THREE.Vector3(sgn, 0, 0.22).normalize();
  const centre = new THREE.Vector3(sgn * 13.4, 6.4, -2.2);
  const at = (u) => {
    const a = (180 - 405 * u) * D2R;
    const rad = 4.7 * (1 - u) ** 0.9 + 0.95;
    return centre.clone().addScaledVector(e1, Math.cos(a) * rad).add(new THREE.Vector3(0, Math.sin(a) * rad, 5.5 * u * u));
  };
  const radius = (u) => 2.45 * (1 - u) ** 0.8 + 0.2;
  return { at, radius, centre };
}

function buildHorns() {
  const parts = [], suckers = [];
  const c = new THREE.Color();
  for (const sgn of [-1, 1]) {
    const { at, radius, centre } = hornCurve(sgn);
    const pts = [];
    for (let i = 0; i <= 26; i++) pts.push(at(i / 26));
    parts.push(taperedTube(pts, {
      radial: 12, segments: 64, radius,
      color: (t) => new THREE.Color().copy(HAIR).lerp(c.set(0x7a6a8c), smooth(0.2, 1, t) * 0.8),
    }));
    for (let i = 0; i < 16; i++) {
      const u = 0.2 + 0.74 * (i / 15);
      const p = at(u), r = radius(u);
      const inward = centre.clone().add(new THREE.Vector3(0, 0, 5.5 * u * u)).sub(p).normalize();
      suckers.push({ pos: p.addScaledVector(inward, r * 0.86), size: 0.16 + r * 0.24 });
    }
  }
  return { parts, suckers };
}

function buildMoustache(sgn) {
  const xs = [0.3, 2.6, 5.0, 6.8, 7.6, 7.5, 6.7, 6.1];
  const ys = sgn > 0 ? [-2.5, -3.2, -4.6, -5.4, -3.9, -1.6, -0.2, -1.2] : [-2.5, -3.2, -4.6, -5.6, -4.7, -3.2, -2.4, -3.1];
  const lifts = [0.5, 0.9, 1.0, 1.1, 1.3, 1.6, 2.0, 2.5];
  const pts = xs.map((x, i) => on(sgn * x, ys[i], lifts[i]));
  const radius = (t) => 1.08 * (1 - t) ** 0.75 + 0.13;
  const geo = taperedTube(pts, {
    radial: 10, segments: 44, radius,
    color: (t) => new THREE.Color().copy(PEARL).lerp(sgn > 0 ? ORANGE : SKIN_LIGHT, smooth(0.45, 1, t) * 0.55),
  });
  const curve = geo.userData.curve;
  const suckers = [];
  for (let i = 0; i < 11; i++) {
    const u = 0.14 + 0.8 * (i / 10);
    const p = curve.getPointAt(u);
    suckers.push({ pos: p.addScaledVector(normalAt(p), radius(u) * 0.9), size: 0.12 + radius(u) * 0.22 });
  }
  return { geo, suckers, pivot: on(sgn * 0.8, -2.6, 0) };
}

function buildBeard(rand) {
  const chin = [], sides = [];
  const palette = [[HAIR, 0.58], [HAIR_HI, 0.12], [PINK, 0.08], [LIME, 0.08], [TEAL, 0.07], [PEARL, 0.07]];
  const pick = () => {
    let x = rand();
    for (const [c, w] of palette) { if ((x -= w) <= 0) return c; }
    return HAIR;
  };
  for (let row = 0; row < 4; row++) {
    const n = 21 - row;
    for (let k = 0; k < n; k++) {
      const s = -1 + (2 * (k + rand() * 0.6 - 0.3)) / (n - 1);
      const as = Math.min(1, Math.abs(s));
      const th = s * 102 * D2R;
      const y = Math.max(-10.6, -6.4 + 9.2 * as ** 1.7 - row * 1.5 + (rand() - 0.5) * 0.7);
      const k2 = Math.sqrt(Math.max(0.06, 1 - ((y - C[1]) / R[1]) ** 2)) * (1 - 0.05 * row);
      const root = new THREE.Vector3(R[0] * jawTaper(y) * k2 * Math.sin(th), y, C[2] + R[2] * k2 * Math.cos(th) + 0.25);
      const out = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
      const lat = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
      const len = (16.5 - 10 * as ** 1.3) * (0.8 + 0.35 * rand()) - row * 0.7;
      const amp = 0.45 + rand() * 0.6, freq = 1.4 + rand() * 1.2, ph = rand() * 6.28;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const p = root.clone();
        p.y -= len * u;
        p.addScaledVector(out, 1.9 * Math.sin(Math.PI * u * 0.85) - 0.5 * u);
        p.addScaledVector(lat, amp * Math.sin(6.28 * freq * u + ph) * Math.sqrt(u));
        p.x *= 1 - 0.28 * u * u;
        pts.push(p);
      }
      const base = 0.5 + rand() * 0.38;
      const c = pick();
      const dark = new THREE.Color().copy(HAIR).lerp(c, 0.35);
      const geo = taperedTube(pts, {
        radial: 6, segments: 14,
        radius: (t) => base * (1 - t) ** 0.6 * (0.7 + 0.3 * Math.sin(Math.PI * t)) + 0.08,
        color: (t) => new THREE.Color().copy(dark).lerp(c, smooth(0.05, 0.5, t)),
      });
      (as < 0.5 ? chin : sides).push(geo);
    }
  }
  // a solid core behind the strands, so nothing shows between them
  const core = new THREE.SphereGeometry(1, 20, 14);
  core.scale(6.4, 8.2, 4.3).translate(0, -12.4, 2.2);
  chin.push(tint(core, new THREE.Color().copy(HAIR).multiplyScalar(0.8)));
  return { chin, sides };
}

let cache = null;
function assets() {
  if (cache) return cache;
  const rand = rng(20261115);
  const nose = new THREE.SphereGeometry(1, 20, 14);
  nose.scale(1.55, 2.7, 1.5);
  const nosePos = on(0, 0.6, 0.05);
  nose.translate(nosePos.x, nosePos.y, nosePos.z);
  const horns = buildHorns();
  const shell = buildShell();
  const headSkin = merge([shell.skin, tint(nose, SKIN_LIGHT)]);
  const headDark = merge([shell.cap, ...buildHair(rand), ...horns.parts]);
  const beard = buildBeard(rand);
  const jawPivot = new THREE.Vector3(0, 0.6, -2.4);
  const chin = merge(beard.chin).translate(-jawPivot.x, -jawPivot.y, -jawPivot.z);

  // pearl skin: a soft thin-film sheen over a saturated base. Dark parts get far less of it, or they turn to chrome.
  const pearl = { roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, iridescence: 0.6, iridescenceIOR: 1.5, iridescenceThicknessRange: [200, 480], envMapIntensity: 0.7 };
  cache = {
    headSkin, headDark, chin, sides: merge(beard.sides), jawPivot, hornSuckers: horns.suckers,
    stache: [buildMoustache(-1), buildMoustache(1)],
    eyeGeo: new THREE.SphereGeometry(2.4, 28, 20),
    ringGeo: new THREE.TorusGeometry(2.3, 0.2, 10, 40),
    lidGeo: new THREE.SphereGeometry(2.56, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mouthGeo: new THREE.SphereGeometry(1, 20, 14),
    suckerGeo: new THREE.IcosahedronGeometry(1, 1),
    iri: new THREE.MeshPhysicalMaterial({ vertexColors: true, ...pearl }),
    dark: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.46, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.4 }),
    skin: new THREE.MeshPhysicalMaterial({ color: SKIN, ...pearl }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x050409, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffa52e, emissive: 0xb65a00, emissiveIntensity: 0.55, roughness: 0.35 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x120a22, roughness: 0.6 }),
    suckLilac: new THREE.MeshPhysicalMaterial({ color: 0xc3b0f4, roughness: 0.3, clearcoat: 1, iridescence: 0.5, envMapIntensity: 0.7 }),
    suckPearl: new THREE.MeshPhysicalMaterial({ color: 0xfbf6ff, roughness: 0.25, clearcoat: 1, iridescence: 0.5, envMapIntensity: 0.7 }),
  };
  cache.browGeo = [-1, 1].map((sgn) => {
    const pivot = on(sgn * 4.4, 6.0, 0.6);
    const geo = taperedTube([on(sgn * 1.2, 5.2, 0.5), on(sgn * 4.4, 6.25, 0.8), on(sgn * 7.6, 5.8, 0.55)], {
      radial: 8, segments: 14, radius: (t) => 1.0 - 0.45 * t, color: HAIR,
    }).translate(-pivot.x, -pivot.y, -pivot.z);
    return { geo, pivot };
  });
  return cache;
}

function suckerMesh(a, list, material, offset) {
  const mesh = new THREE.InstancedMesh(a.suckerGeo, material, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach((it, i) => {
    p.copy(it.pos);
    if (offset) p.sub(offset);
    mesh.setMatrixAt(i, m.compose(p, q, s.setScalar(it.size)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function create() {
  const a = assets();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(a.headSkin, a.iri), new THREE.Mesh(a.headDark, a.dark), suckerMesh(a, a.hornSuckers, a.suckLilac));

  const eyes = [-1, 1].map((sgn) => {
    const centre = on(sgn * 4.45, 3.0, -0.75);
    const g = new THREE.Group();
    g.position.copy(centre);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalAt(centre));
    const ring = new THREE.Mesh(a.ringGeo, a.amber);
    ring.position.z = 0.72;
    const upper = new THREE.Mesh(a.lidGeo, a.skin);
    const lower = new THREE.Mesh(a.lidGeo, a.skin);
    lower.scale.y = -1;
    g.add(new THREE.Mesh(a.eyeGeo, a.eye), ring, upper, lower);
    root.add(g);
    return { upper, lower };
  });

  const brows = a.browGeo.map(({ geo, pivot }) => {
    const m = new THREE.Mesh(geo, a.dark);
    m.position.copy(pivot);
    root.add(m);
    return { mesh: m, y: pivot.y };
  });

  const mouth = new THREE.Mesh(a.mouthGeo, a.mouth);
  mouth.position.copy(on(0, -5.2, -0.05));
  root.add(mouth);

  const staches = a.stache.map(({ geo, suckers, pivot }, i) => {
    const g = new THREE.Group();
    g.position.copy(pivot);
    const tube = new THREE.Mesh(geo, a.iri);
    tube.position.copy(pivot).negate();
    g.add(tube, suckerMesh(a, suckers, a.suckPearl, pivot));
    root.add(g);
    return { g, sgn: i ? 1 : -1, sway: new Sway(70, 8) };
  });

  const beard = new THREE.Group();
  const jaw = new THREE.Group();
  jaw.position.copy(a.jawPivot);
  jaw.add(new THREE.Mesh(a.chin, a.dark));
  beard.add(new THREE.Mesh(a.sides, a.dark), jaw);
  root.add(beard);
  const swayX = new Sway(45, 7), swayZ = new Sway(45, 7);

  const b = (blend, name) => blend[name] ?? 0;
  function update({ dt, time, blend, angVel }) {
    // lids: the upper one comes down with a blink, the lower one rises with a squint
    eyes.forEach((e, i) => {
      const side = i ? 'Left' : 'Right';
      const blink = b(blend, `eyeBlink${side}`), squint = b(blend, `eyeSquint${side}`), wide = b(blend, `eyeWide${side}`);
      e.upper.rotation.x = (-52 - 14 * wide + 122 * Math.min(1, blink * 1.15) + 12 * squint) * D2R;
      e.lower.rotation.x = -(-58 + 30 * squint + 40 * blink) * D2R;
    });
    brows.forEach((br, i) => {
      const side = i ? 'Left' : 'Right', sgn = i ? 1 : -1;
      const down = b(blend, `browDown${side}`), up = b(blend, `browOuterUp${side}`), inner = b(blend, 'browInnerUp');
      br.mesh.rotation.z = sgn * (0.34 * down - 0.26 * inner + 0.1 * up);
      br.mesh.position.y = br.y - 0.75 * down + 0.8 * up + 0.35 * inner;
    });
    const open = b(blend, 'jawOpen');
    const pucker = Math.max(b(blend, 'mouthPucker'), b(blend, 'mouthFunnel'));
    const smile = (b(blend, 'mouthSmileLeft') + b(blend, 'mouthSmileRight')) / 2;
    mouth.scale.set(2.3 * (1 - 0.35 * pucker + 0.25 * smile), 0.2 + 2.1 * open, 0.9);
    mouth.position.y = -5.2 - 0.9 * open;
    jaw.rotation.x = 0.2 * open;
    // follow-through: the beard and moustache lag behind a turning head and settle
    beard.rotation.x = swayX.step(-angVel.x * 9, dt) * 0.22;
    beard.rotation.z = swayZ.step((angVel.z - angVel.y * 0.6) * 9, dt) * 0.22;
    staches.forEach((s, i) => {
      const idle = Math.sin(time * 1.4 + i * 1.9) * 0.035;
      s.g.rotation.z = s.sgn * (idle + 0.12 * smile - 0.1 * open) + s.sway.step(angVel.z * 12, dt) * 0.2;
    });
  }
  update({ dt: 0, time: 0, blend: {}, angVel: new THREE.Vector3() });
  return { object: root, update, dispose() {} };
}

export const satyr = {
  id: 'satyr',
  name: 'Iridescent Satyr',
  note: 'Procedural stand-in for the character sheet',
  swatch: ['#7f86ea', '#33283a', '#ff9638'],
  create,
};
