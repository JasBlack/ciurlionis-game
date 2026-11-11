// The painter himself, as the film's character sheet has him: a slate-grey three-piece suit, a stand collar and a
// navy bow, white cuffs, black shoes, a round head of brown curls, an auburn moustache, colour in his cheeks.
// He is the block's wanderer (Patch's starter man) without the hat and cloak. The film paints him smoothly, so
// here the body's own shape does most of the work, softly lit in two tones, and the strokes on it are small, keep
// inside his outline and vary little. The starter man wears short sleeves, so his forearms are painted as sleeves
// down to a white cuff. His hair is a few rounded masses on the head with curls laid over them; moustache, brows,
// collar, bow, shirt front, lapels and buttons are strokes alone, carried by the bones of head, neck and chest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { loadMan } from '../figure/man.js';
import { pinDabs } from './pins.js';
import { rng } from './noise.js';

// Where his hair begins, as a height on the head he was made with, at (x, z): low on the nape, over the tops of the
// ears and down a little in front of them, and across the forehead, which is high on his right, where his hair is
// parted, and lower on his left, where the wave comes over (as in his portrait). The same line is used three times:
// the scalp above it is painted as hair, the cap of hair sinks into the head below it, and no curl is laid under it.
const NAPE = 1.655, EAR = 1.762, BROW = 1.822, PART = -0.034;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hairLine = (x, z) => {
  let h = NAPE + (EAR - NAPE) * sstep(-0.06, -0.005, z);
  h -= 0.056 * sstep(0.058, 0.074, Math.abs(x)) * sstep(-0.004, 0.012, z) * (1 - sstep(0.03, 0.045, z));
  const brow = BROW + 0.018 * (1 - sstep(-0.06, 0.02, x)) - 0.006 * sstep(0, 0.05, x);
  return h + (brow - h) * sstep(0.035, 0.07, z);
};
// How wide the jacket stands open at each height of his chest (the lapels' edge), for the paint and for the strokes.
const opening = (y) => 0.026 + 0.064 * Math.min(1, Math.max(0, (y - 1.18) / 0.32));
const HAIRLINE_GLSL = /* glsl */ `
float hairLine(float x, float z) {
  float h = mix(${NAPE}, ${EAR}, smoothstep(-0.06, -0.005, z));
  h -= 0.056 * smoothstep(0.058, 0.074, abs(x)) * smoothstep(-0.004, 0.012, z) * (1.0 - smoothstep(0.03, 0.045, z));
  float brow = ${BROW} + 0.018 * (1.0 - smoothstep(-0.06, 0.02, x)) - 0.006 * smoothstep(0.0, 0.05, x);
  return mix(h, brow, smoothstep(0.035, 0.07, z));
}`;

const PAINT_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uL; uniform vec3 uM; uniform vec3 uS;
uniform vec3 uL2; uniform vec3 uM2; uniform vec3 uS2;
uniform vec3 uL3; uniform vec3 uM3; uniform vec3 uS3;
uniform float uScalp; // on his skin: 1 paints the scalp as hair and the neck as a stand collar
uniform float uFront; // on his suit: 1 paints the shirt front, the waistcoat and the lapels' edges
uniform float uEye;   // on his eyes: 1 paints the iris and the pupil
uniform vec2 uSleeve; // on his skin: from where to where along the arm it is sleeve; then a cuff
uniform vec3 uTint;
uniform float uGrain;
uniform float uSoft;  // how far the light is evened out: cloth in the film is two quiet tones, never black
in vec3 vWorld; in vec3 vN; in vec3 vBind;
layout(location = 0) out vec4 outC;
${HAIRLINE_GLSL}
void main() {
  vec3 Nn = normalize(vN);
  if (!gl_FrontFacing) Nn = -Nn;
  float n = texture(tNoise, vBind.xy * uGrain + vBind.z * 1.7).r;
  float m = texture(tNoise, vBind.yx * uGrain * 0.31 + 0.4).g;
  float lit = uSoft + (1.0 - uSoft) * sunAt(vWorld + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
  float ax = abs(vBind.x);
  vec3 c = paint3(uL, uM, uS, lit, n);
  if (uSleeve.y > 0.0 && ax > uSleeve.x && vBind.y < 1.56) {
    if (ax < uSleeve.y) c = paint3(uL2, uM2, uS2, lit, n);
    else if (ax < uSleeve.y + 0.028) c = paint3(vec3(0.99, 0.98, 0.95), vec3(0.86, 0.87, 0.93), vec3(0.6, 0.63, 0.78), lit, n);
  }
  if (uScalp > 0.5) {
    // no skin shows under his hair: the scalp itself is hair above the hairline
    if (vBind.y > hairLine(vBind.x, vBind.z) + (n - 0.5) * 0.01) c = paint3(uL3, uM3, uS3, lit, n);
    // his collar: linen standing up round the neck from the jacket to just under the jaw, one piece with the shirt
    else if (ax < 0.1 && vBind.y > 1.5 && vBind.y < 1.614 - 0.018 * smoothstep(0.02, 0.07, vBind.z)) c = paint3(vec3(0.99, 0.98, 0.95), vec3(0.88, 0.89, 0.94), vec3(0.66, 0.69, 0.82), lit, n);
    else if (vBind.y > 1.6) {
      // his face, modelled in colour as the film paints it: blood in the cheeks, the nose and the ears, warm shade
      // in the hollows of the eyes and down the sides of the face, the lower lip, the shadow under it
      vec2 f = vec2(ax, vBind.y);
      float front = smoothstep(0.02, 0.06, vBind.z);
      vec2 q = (f - vec2(0.05, 1.697)) / vec2(0.024, 0.02);
      c = mix(c, c * vec3(1.0, 0.7, 0.66) + vec3(0.05, 0.0, 0.0), 0.62 * exp(-dot(q, q)) * front);
      q = (f - vec2(0.0, 1.704)) / vec2(0.015, 0.013);
      c = mix(c, c * vec3(1.0, 0.78, 0.72), 0.5 * exp(-dot(q, q)) * front);
      q = (f - vec2(0.031, 1.741)) / vec2(0.021, 0.012);
      c = mix(c, c * vec3(0.82, 0.62, 0.58), 0.55 * exp(-dot(q, q)) * front);
      q = (f - vec2(0.0, 1.661)) / vec2(0.019, 0.0055);
      c = mix(c, vec3(0.8, 0.42, 0.38) * (0.62 + 0.38 * lit), 0.7 * exp(-dot(q, q)) * front);
      q = (f - vec2(0.0, 1.649)) / vec2(0.024, 0.005);
      c *= 1.0 - 0.16 * exp(-dot(q, q)) * front;
      c = mix(c, c * vec3(0.9, 0.74, 0.7), 0.5 * smoothstep(0.05, 0.08, ax) * front);
      if (ax > 0.076 && vBind.y > 1.685 && vBind.y < 1.765) c = mix(c, c * vec3(1.0, 0.7, 0.66), 0.6);
    }
  }
  if (uEye > 0.5 && vBind.z > 0.0905) {
    // grey-blue, a dark ring round it, the pupil; the lid's shade across the top
    float r = length(vec2(ax - 0.031, vBind.y - 1.7352));
    if (r < 0.0027) c = vec3(0.07, 0.07, 0.1);
    else if (r < 0.0064) c = mix(vec3(0.5, 0.6, 0.68), vec3(0.3, 0.4, 0.5), smoothstep(0.003, 0.0064, r));
    else if (r < 0.0073) c = vec3(0.2, 0.25, 0.33);
    c *= 1.0 - 0.3 * smoothstep(1.7375, 1.7455, vBind.y);
  }
  if (uFront > 0.5 && vBind.z > 0.04) {
    // the front of him: the shirt in the V of the waistcoat, the waistcoat in the opening of the jacket, the
    // lapels lighter beside it, a dark line at each edge and where the jacket closes
    float y = vBind.y, e = (n - 0.5) * 0.005;
    float vs = 0.05 * clamp((y - 1.42) / 0.16, 0.0, 1.0);
    float vl = 0.026 + 0.064 * clamp((y - 1.18) / 0.32, 0.0, 1.0);
    if (y > 1.42 && ax < vs + e) c = paint3(vec3(0.99, 0.98, 0.95), vec3(0.88, 0.89, 0.94), vec3(0.66, 0.69, 0.82), lit, n);
    else if (y > 1.18 && ax < vl + e) c *= 0.88;
    else if (y > 1.18 && ax < vl + 0.034) c *= 1.08;
    if (y > 1.18 && abs(ax - vl) < 0.0032) c *= 0.62;
    if (y > 1.42 && vs > 0.006 && abs(ax - vs) < 0.0024) c *= 0.8;
    if (y <= 1.18 && y > 0.93 && abs(vBind.x - 0.01 - (1.18 - y) * 0.1) < 0.003) c *= 0.64;
  }
  c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
  c *= 0.93 + 0.14 * m;
  if (!gl_FrontFacing) c *= 0.7;
  outC = vec4(hazed(c * uTint, vWorld), 1.0);
}
`;
const SKINNED_VERT = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  out vec3 vWorld; out vec3 vN; out vec3 vBind;
  void main() {
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 w = modelMatrix * vec4(transformed, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * objectNormal);
    vBind = position;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const PLAIN_VERT = /* glsl */ `
  out vec3 vWorld; out vec3 vN; out vec3 vBind;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vBind = position;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SLEEVE = [0.3, 0.768]; // in the pose he was made in (arms straight out): metres from his middle

function paint(shared, [L, M, S], { grain = 2.2, sleeve = null, scalp = null, front = false, eye = false, soft = 0.4, skinned = true } = {}) {
  const col = (c) => ({ value: new THREE.Color(...c) });
  const [L2, M2, S2] = sleeve ?? [L, M, S];
  const [L3, M3, S3] = scalp ?? [L, M, S];
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: {
      ...shared, uL: col(L), uM: col(M), uS: col(S), uL2: col(L2), uM2: col(M2), uS2: col(S2),
      uL3: col(L3), uM3: col(M3), uS3: col(S3), uScalp: { value: scalp ? 1 : 0 }, uFront: { value: front ? 1 : 0 }, uEye: { value: eye ? 1 : 0 },
      uSleeve: { value: new THREE.Vector2(...(sleeve ? SLEEVE : [0, 0])) }, uGrain: { value: grain }, uSoft: { value: soft },
    },
    vertexShader: skinned ? SKINNED_VERT : PLAIN_VERT,
    fragmentShader: PAINT_FRAG,
  });
}

// light, half-tone, shade: taken from the character sheet
export const CLOTHES = {
  JACKET: [[0.47, 0.49, 0.56], [0.34, 0.36, 0.43], [0.22, 0.23, 0.31]],
  TROUSERS: [[0.45, 0.47, 0.54], [0.32, 0.34, 0.41], [0.2, 0.21, 0.29]],
  SKIN: [[1.0, 0.84, 0.68], [0.93, 0.68, 0.53], [0.66, 0.44, 0.42]],
  SHOES: [[0.2, 0.2, 0.25], [0.1, 0.1, 0.14], [0.04, 0.04, 0.07]],
  HAIR: [[0.37, 0.26, 0.17], [0.25, 0.17, 0.12], [0.15, 0.1, 0.085]],
  HAIRLIGHT: [[0.6, 0.43, 0.26], [0.47, 0.33, 0.2], [0.32, 0.22, 0.15]],
  EYES: [[0.95, 0.93, 0.9], [0.84, 0.8, 0.78], [0.6, 0.56, 0.58]],
  LINEN: [[0.99, 0.98, 0.95], [0.88, 0.89, 0.94], [0.64, 0.67, 0.8]],
  BOW: [[0.2, 0.25, 0.42], [0.11, 0.14, 0.28], [0.05, 0.06, 0.16]],
  MOUSTACHE: [[0.6, 0.36, 0.18], [0.45, 0.25, 0.12], [0.28, 0.15, 0.09]],
  LAPEL: [[0.56, 0.58, 0.65], [0.42, 0.44, 0.51], [0.28, 0.3, 0.38]],
  SEAM: [[0.3, 0.31, 0.38], [0.22, 0.23, 0.3], [0.14, 0.15, 0.21]],
  CHEEK: [[1.0, 0.75, 0.66], [0.96, 0.64, 0.56], [0.72, 0.46, 0.44]],
  CONTOUR: [[0.9, 0.64, 0.5], [0.8, 0.52, 0.42], [0.56, 0.36, 0.36]],
  DARK: [[0.2, 0.14, 0.11], [0.14, 0.1, 0.08], [0.08, 0.06, 0.06]],
};

export async function createPainter(shared, onProgress) {
  const { JACKET, TROUSERS, SKIN, SHOES, HAIR, HAIRLIGHT, EYES, LINEN, BOW, MOUSTACHE, LAPEL, SEAM, CHEEK, DARK, CONTOUR } = CLOTHES;
  const man = await loadMan({ base: './figure/', onProgress });
  for (const mesh of man.meshes) {
    const name = mesh.name + ' ' + (mesh.material?.name ?? '');
    if (/eyebrow|eyelash|short01/.test(name)) { mesh.visible = false; continue; }
    mesh.material = /casualsuit/.test(name) ? paint(shared, JACKET, { grain: 2.6, front: true })
      : /shoes/.test(name) ? paint(shared, SHOES, { soft: 0.2 })
      : /high-poly/.test(name) ? paint(shared, EYES, { soft: 0.7, eye: true })
      : paint(shared, SKIN, { sleeve: JACKET, scalp: HAIR, soft: 0.5 });
    mesh.layers.enable(1);
    mesh.frustumCulled = false;
  }
  const dabs = new THREE.Group();
  man.object.updateMatrixWorld(true);
  const rand = rng(1875);
  /** Hangs a thing made in the pose he was made in (y up from his feet, z out of his chest) on one of his bones. */
  const hang = (bone, object) => {
    man.object.add(object);
    object.updateMatrixWorld(true);
    man.bones[bone].attach(object);
    return object;
  };

  // --- his hair: one cap over the whole scalp, with rounded masses of curls standing on it. Below the hairline the
  // cap sinks into his head, so it is joined to him all the way round and nothing shows between ---
  const CAP = { c: [0, 1.762, -0.006], r: [0.092, 0.1, 0.112] };
  // (swept up and back from a parting on his right, PART; the wave on his left rolls forward over the temple; the
  // masses at the sides come down over the tops of his ears and a little in front of them)
  const LUMPS = [
    [0.004, 1.852, -0.004, 0.056], [0.008, 1.852, 0.03, 0.045], [-0.05, 1.846, 0.014, 0.042], [0.05, 1.842, 0.03, 0.046],
    [-0.022, 1.85, 0.044, 0.028], [0.042, 1.836, 0.058, 0.033],
    [-0.078, 1.812, 0.0, 0.046], [0.081, 1.806, 0.008, 0.05], [-0.086, 1.772, -0.01, 0.04], [0.088, 1.772, -0.008, 0.042],
    [-0.079, 1.752, 0.02, 0.021], [0.08, 1.752, 0.021, 0.022],
    [0, 1.822, -0.07, 0.056], [-0.048, 1.784, -0.086, 0.048], [0.048, 1.784, -0.086, 0.048], [0, 1.744, -0.09, 0.044],
    // (and at the back it comes down over the nape, longer than it was)
    [0, 1.708, -0.084, 0.038], [-0.038, 1.716, -0.079, 0.034], [0.038, 1.716, -0.079, 0.034], [0, 1.68, -0.074, 0.03],
  ];
  {
    const cap = new THREE.SphereGeometry(1, 30, 22), cp = cap.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const n = [cp.getX(i), cp.getY(i), cp.getZ(i)];
      const at = (k) => n.map((v, j) => CAP.c[j] + v * CAP.r[j] * k);
      let p = at(1);
      const under = hairLine(p[0], p[2]) - p[1];
      if (under > 0) p = at(1 - 0.34 * sstep(0, 0.03, under));
      cp.setXYZ(i, ...p);
    }
    cap.computeVertexNormals();
    const hair = new THREE.Mesh(mergeGeometries([cap, ...LUMPS.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 10, 8).translate(x, y, z))]), paint(shared, HAIR, { skinned: false, grain: 9 }));
    hair.layers.enable(1);
    hair.frustumCulled = false;
    hang('Head', hair);
  }

  // --- strokes carried by a bone: each is [x, y, z, dx, dy, dz, nx, ny, nz, across, along, palette] ---
  // (10: his brows, the deep brown of his hair, not black)
  const BROWS = [[0.4, 0.27, 0.18], [0.3, 0.2, 0.14], [0.19, 0.12, 0.1]];
  const PAL = [HAIR, MOUSTACHE, LINEN, BOW, LAPEL, SEAM, CHEEK, DARK, CONTOUR, HAIRLIGHT, BROWS];
  const list = (k) => PAL.map((p) => `vec3(${p[k].map((x) => x.toFixed(3))})`).join(', ');
  function carried(bone, strokes, { minPx = [2, 2.6], cells = [0, 3], lift = 0.4, edge = -0.2, jitter = 0.14 } = {}) {
    const holder = hang(bone, new THREE.Object3D());
    const n = strokes.length, pos = new Float32Array(n * 3), dir = new Float32Array(n * 3), nrm = new Float32Array(n * 3), data = new Float32Array(n * 4);
    strokes.forEach((s, i) => { pos.set(s.slice(0, 3), i * 3); dir.set(s.slice(3, 6), i * 3); nrm.set(s.slice(6, 9), i * 3); data.set([s[9], s[10], s[11], i * 7.31 + 1], i * 4); });
    dabs.add(dabMesh(dabGeometry(n, { aPos: [pos, 3], aDir: [dir, 3], aNrm: [nrm, 3], aData: [data, 4] }), dabMaterial(shared, {
      head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm; in vec4 aData; uniform mat4 uHold; uniform vec3 uTint;
        const vec3 P_L[${PAL.length}] = vec3[${PAL.length}](${list(0)}); const vec3 P_M[${PAL.length}] = vec3[${PAL.length}](${list(1)}); const vec3 P_S[${PAL.length}] = vec3[${PAL.length}](${list(2)});`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aData.w);
          vec3 P = (uHold * vec4(aPos, 1.0)).xyz;
          vec3 Nn = normalize(mat3(uHold) * aNrm);
          if (dot(Nn, normalize(cameraPosition - P)) < ${edge.toFixed(2)}) { d.alive = 0.0; return; }
          int k = int(aData.z + 0.5);
          float lit = 0.45 + 0.55 * sunAt(P + Nn * 0.1) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
          vec3 c = jitter(paint3(P_L[k], P_M[k], P_S[k], lit, r.x), r.yzw, ${jitter.toFixed(2)}) * uTint;
          d.pos = P; d.dir = mat3(uHold) * aDir;
          d.size = aData.xy * (0.92 + 0.16 * r.y);
          d.turnabout = 1.0;
          d.c1 = hazed(c, P); d.c2 = hazed(c * 1.1, P);
          d.seed = aData.w; d.lift = ${lift.toFixed(2)};
        }`,
      uniforms: { uHold: { value: holder.matrixWorld } },
      minPx, maxPx: [200, 400], cells,
    }), 5));
  }

  // waves: curved strokes that leave the parting and roll out over the ears and back, turning as they go, the
  // lighter ones on their crests
  const curls = [], lights = [];
  const curl = (p, n) => {
    if (p[1] < hairLine(p[0], p[2]) + 0.006) return; // none below the hairline
    const sx = p[0] < PART ? -1 : 1, top = p[2] > 0.02 && p[1] > 1.825;
    const flow = top ? [sx * 0.35, 0.1, -0.9] : [sx * 0.7, -0.45, -0.55];
    const dn = flow[0] * n[0] + flow[1] * n[1] + flow[2] * n[2];
    let t = flow.map((v, j) => v - n[j] * dn);
    const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
    const a = 0.55 * Math.sin(p[1] * 95 + p[2] * 60 + Math.abs(p[0]) * 45) + (rand() - 0.5) * 0.35, ca = Math.cos(a), sa = Math.sin(a);
    t = t.map((v, j) => v * ca + b[j] * sa);
    const light = rand() < 0.14;
    (light ? lights : curls).push([...p, ...t, ...n, light ? 0.014 + 0.005 * rand() : 0.024 + 0.01 * rand(), light ? 0.04 + 0.016 * rand() : 0.045 + 0.022 * rand(), light ? 9 : 0]);
  };
  const ball = () => { const u = rand() * 2 - 1, a = rand() * Math.PI * 2, q = Math.sqrt(1 - u * u); return [Math.cos(a) * q, u, Math.sin(a) * q]; };
  const inCap = (p) => Math.hypot(...p.map((v, j) => (v - CAP.c[j]) / CAP.r[j])) < 1;
  for (let k = 0; k < 380; k++) {
    const n = ball(), l = Math.hypot(n[0] / CAP.r[0], n[1] / CAP.r[1], n[2] / CAP.r[2]);
    curl(n.map((v, j) => CAP.c[j] + v * CAP.r[j]), [n[0] / CAP.r[0] / l, n[1] / CAP.r[1] / l, n[2] / CAP.r[2] / l]);
  }
  for (const [li, [cx, cy, cz, r]] of LUMPS.entries()) {
    for (let k = 0; k < 34; k++) {
      const n = ball(), p = [cx + n[0] * r, cy + n[1] * r, cz + n[2] * r];
      if (inCap(p) || LUMPS.some(([ox, oy, oz, or], oi) => oi !== li && Math.hypot(p[0] - ox, p[1] - oy, p[2] - oz) < or * 0.94)) continue;
      curl(p, n);
    }
  }
  carried('Head', lights, { cells: [3, 1], lift: 0.3, edge: -0.1, jitter: 0.12 });
  carried('Head', curls, { cells: [3, 1], lift: 0.08, edge: -0.12, jitter: 0.18 });

  // the face: the moustache (broad under the nose, turning down and then a little up at its ends), brows, the
  // line of each upper lid
  const face = [];
  for (const sx of [-1, 1]) {
    // the moustache: thick under the nose, out past the corners of the mouth, its ends turned up
    face.push([sx * 0.017, 1.68, 0.129, sx, -0.2, -0.12, 0, 0.1, 1, 0.036, 0.05, 1]);
    face.push([sx * 0.041, 1.672, 0.118, sx, -0.16, -0.4, sx * 0.3, 0.1, 1, 0.032, 0.05, 1]);
    face.push([sx * 0.061, 1.671, 0.1, sx, 0.22, -0.65, sx * 0.5, 0, 1, 0.022, 0.036, 1]);
    face.push([sx * 0.072, 1.682, 0.087, sx * 0.4, 1, -0.4, sx * 0.7, 0, 1, 0.012, 0.022, 1]);
    // each brow one unbroken stroke of deep brown, heavy and nearly level, as in his portrait: thickest at its inner
    // end, rising a little over the eye and thinning toward the temple
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, x = 0.011 + 0.049 * u, y = 1.7518 + 0.0058 * Math.sin(u * Math.PI * 0.85) - 0.0012 * u, z = 0.1165 - 0.375 * x;
      const dy = (0.0058 * Math.PI * 0.85 * Math.cos(u * Math.PI * 0.85) - 0.0012) / 0.049;
      face.push([sx * x, y, z, sx, dy, -0.375, sx * 0.35 * u, 0.2, 1, 0.0142 - 0.0055 * u, 0.017, 10]);
    }
    // the crease of the upper lid: only a little warm shade lying on the eye, so it is not read as a second brow
    face.push([sx * 0.031, 1.7432, 0.1015, sx, 0, -0.08, 0, 0, 1, 0.0034, 0.024, 8]);
  }
  face.push([0, 1.684, 0.131, 1, 0, 0, 0, 0.1, 1, 0.022, 0.03, 1]);
  face.push([0.011, 1.722, 0.122, 0.12, -1, 0.35, 0.6, 0, 1, 0.007, 0.04, 8], [0, 1.698, 0.126, 1, 0, 0, 0, -0.4, 1, 0.007, 0.026, 8]);
  carried('Head', face, { lift: 0.5, edge: 0.12 });

  // the bow at his throat: two wings and a knot, lying on the shirt (collar and shirt front are painted on him)
  carried('neck_01', [-1, 1].map((sx) => [sx * 0.037, 1.55, 0.086, sx, 0.1, 0, 0, 0, 1, 0.042, 0.064, 3]), { lift: 0.5, edge: 0.05 });
  carried('neck_01', [[0, 1.55, 0.093, 0, 1, 0, 0, 0, 1, 0.022, 0.024, 3]], { cells: [4, 2], lift: 0.6, edge: 0.05 });
  // and the waistcoat's buttons
  carried('spine_03', [1.375, 1.315, 1.255, 1.195].map((y) => [0, y, 0.178, 1, 0, 0, 0, 0, 1, 0.012, 0.012, 5]), { cells: [4, 2], lift: 0.5, minPx: [1.6, 1.6], edge: 0.1 });

  // --- paint on the body itself: small strokes down the cloth, kept inside his outline and close in colour ---
  const partOf = (re) => man.meshes.find((m) => re.test(m.name));
  const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(1, 0, 0), FWD = new THREE.Vector3(0, 0, 1);
  const parts = [];
  const suit = partOf(/casualsuit/), skin = partOf(/generic/), shoes = partOf(/shoes/);
  if (suit) parts.push({ mesh: suit, count: 760, accept: (p) => !(p.z > 0.04 && p.y > 1.15 && Math.abs(p.x) < opening(p.y) + 0.045), style: (p) => ({ pal: p.y < 0.9 ? 1 : 0, size: p.y > 1.4 ? [0.02, 0.04] : [0.026, 0.07], dir: Math.abs(p.x) > 0.22 && p.y > 1.3 ? OUT : UP }) });
  // of his skin, only the sleeves (which are skin on this model), the cuffs and the hands are stroked: his face
  // and his collar are left smooth
  if (skin) parts.push({
    mesh: skin, count: 300, accept: (p) => Math.abs(p.x) > 0.3,
    style: (p) => {
      const ax = Math.abs(p.x);
      if (ax > SLEEVE[1] + 0.028) return { pal: 2, size: [0.016, 0.03], dir: OUT };
      if (ax > SLEEVE[1]) return { pal: 4, size: [0.022, 0.028], dir: FWD };
      if (ax > 0.3) return { pal: 0, size: [0.03, 0.09], dir: OUT };
      return { pal: 2, size: [0.02, 0.04], dir: UP };
    },
  });
  if (shoes) parts.push({ mesh: shoes, count: 60, style: () => ({ pal: 3, size: [0.035, 0.075], dir: FWD }) });
  const bodyDabs = pinDabs(shared, [JACKET, TROUSERS, SKIN, SHOES, LINEN], parts, { edge: 0.34, jitter: 0.09, soft: 0.4, lift: 0.15, cells: [0, 3], minPx: [2, 3.2] });
  dabs.add(bodyDabs.mesh);

  return { man, dabs, update() { bodyDabs.update(); } };
}
