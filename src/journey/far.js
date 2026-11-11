// Across the water: two ranges of far hills, the lavender ones that close the film's sea. Each is a wall of
// underpainting with strokes scattered over it, laid in a fixed order (far, then near) with no depth, as the
// block's far things are: at that distance a depth can't tell two strokes apart.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { noise, rng } from './noise.js';
import { JOURNEY } from './paint.js';

const RINGS = [
  { r: 2500, top: 360, seed: 3.1, count: 26000 },
  { r: 4400, top: 760, seed: 11.7, count: 22000 },
];
function crest(k, az, broad = false) {
  const o = RINGS[k], c = Math.cos(az), s = Math.sin(az);
  let n = 0.45 + 0.55 * noise(c * 2.2 + o.seed, s * 2.2) + 0.28 * noise(c * 6.5, s * 6.5 + o.seed);
  if (!broad) n += 0.1 * noise(c * 17 + o.seed, s * 17);
  // the south is left open: there the sea runs out to the sky behind Rex
  const open = 0.12 + 0.88 * Math.min(1, Math.max(0, (1.25 - Math.cos(az - Math.PI)) / 0.9));
  return o.top * open * Math.min(1.4, Math.max(0.1, n));
}

const RANGE = /* glsl */ `
uniform vec3 uRange;
// far hills are nearly the air's own colour: their light sides a little warm, their shaded sides a little blue
vec3 rangePaint(float lit, float far_, vec3 P) {
  vec3 air = skyColour(normalize(vec3(P.x, 0.02 * length(P.xz), P.z)));
  vec3 c = mix(uRange * vec3(0.84, 0.88, 1.06), uRange * vec3(1.1, 1.04, 0.96), lit);
  return mix(c, air, 0.16 + 0.22 * far_);
}
`;

export function createFar(shared) {
  const group = new THREE.Group();
  const rand = rng(7373);
  shared.uRange = { value: new THREE.Color(0.62, 0.58, 0.78) };
  const lay = (mesh, order) => {
    mesh.material.depthTest = false;
    mesh.material.depthWrite = false;
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const SEG = 540;
  RINGS.forEach((o, k) => {
    const order = -7.0 - 0.3 * k;
    const wall = new THREE.BufferGeometry();
    const p = new Float32Array((SEG + 1) * 2 * 3), index = [];
    for (let i = 0; i <= SEG; i++) {
      const az = (i / SEG) * Math.PI * 2, x = Math.sin(az) * o.r, z = -Math.cos(az) * o.r;
      p.set([x, -20, z, x, crest(k, az), z], i * 6);
      if (i < SEG) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    wall.setAttribute('position', new THREE.BufferAttribute(p, 3));
    wall.setIndex(index);
    lay(new THREE.Mesh(wall, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: shared,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        out vec3 vWorld;
        void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${COMMON}
        ${JOURNEY}
        ${RANGE}
        in vec3 vWorld;
        layout(location = 0) out vec4 outC;
        void main() { outC = vec4(rangePaint(0.4, ${k}.0, vWorld) * 0.97, 1.0); }`,
    })), order);

    const pos = new Float32Array(o.count * 3), nrm = new Float32Array(o.count * 3), data = new Float32Array(o.count * 4);
    for (let i = 0; i < o.count; i++) {
      const az = rand() * Math.PI * 2, top = crest(k, az), t = Math.pow(rand(), 0.8);
      const e = 0.012;
      const fall = (crest(k, az + 3 * e, true) - crest(k, az - 3 * e, true)) / (6 * e * o.r);
      const sx = Math.sin(az), cz = -Math.cos(az), tx = Math.cos(az), tz = Math.sin(az);
      const lean = fall * 1.7 + 0.2 * noise(az * 38 + k * 9, t * 3.5) + (rand() - 0.5) * 0.12;
      const rr = o.r - 40 - 60 * rand();
      pos.set([sx * rr, t * top, cz * rr], i * 3);
      const len = Math.hypot(0.75, lean, 0.55);
      nrm.set([(-sx * 0.75 - tx * lean) / len, 0.55 / len, (-cz * 0.75 - tz * lean) / len], i * 3);
      data.set([rand() * 1000, t, top, o.r], i * 4);
    }
    lay(dabMesh(dabGeometry(o.count, { aPos: [pos, 3], aNrm: [nrm, 3], aData: [data, 4] }), dabMaterial(shared, {
      head: JOURNEY + RANGE + /* glsl */ `in vec3 aPos; in vec3 aNrm; in vec4 aData;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aData.x);
          vec3 Nn = normalize(aNrm);
          float x = clamp(dot(Nn, uSunDir) * 1.5 + 0.3, 0.0, 1.0);
          vec3 c = rangePaint(step(0.5, x + (r.y - 0.5) * 0.3), ${k}.0, aPos);
          vec3 side = normalize(cross(Nn, vec3(0.0, 1.0, 0.0)));
          d.dir = normalize(side + vec3(0.0, (r.w - 0.5) * 0.5, 0.0));
          d.pos = aPos;
          d.size = aData.w * vec2(0.009 + 0.006 * r.z, 0.03 + 0.03 * r.w);
          d.c1 = jitter(c, r.yzw, 0.12);
          d.c2 = c * 1.04;
          d.seed = aData.x;
          d.turnabout = 1.0;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.4 } },
      minPx: [4, 8], maxPx: [200, 500], cells: [0, 8],
    })), order + 0.1);
  });
  return { group };
}
