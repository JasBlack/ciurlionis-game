// The sea round the island, and the pond and canal inside it: all one water, at one height (uSea), which at the
// end rises over everything. A plain wash first; over it, level strokes that give back the sky in broken colour,
// the block's steady ground again so that they never swim as the eye moves; then a sheet that only leaves a
// depth, so that whatever is under the water is hidden by it.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { groundRings } from '../oilpaint/ground.js';
import { JOURNEY } from './paint.js';

export const WATER = /* glsl */ `
// Water gives back the sky it faces, and its own depth where the eye looks down into it.
vec3 waterPaint(vec3 P, vec3 wobble) {
  vec3 v = normalize(P - cameraPosition);
  vec3 up = normalize(vec3(v.x, abs(v.y) + 0.04, v.z) + wobble);
  up.y = abs(up.y);
  float graze = pow(1.0 - clamp(-v.y, 0.0, 1.0), 3.0);
  return mix(uWaterDeep, skyColour(up), (0.3 + 0.7 * graze) * uMirror);
}
`;

const strokes = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(7.0, true, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, sub * 3.0 + 5.0);
  vec4 q = hash4(cell + 13.7, sub + 23.0);
  vec2 xz = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(xz, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  if (max(abs(xz.x), abs(xz.y)) < uExtent && heightAt(xz) > uSea + 0.04) { d.alive = 0.0; return; }
  vec3 P = vec3(xz.x, uSea, xz.y);
  // long across the line of sight, thin along it
  vec2 qv = normalize(xz - cameraPosition.xz + 1e-4);
  vec3 along = normalize(vec3(-qv.y, 0.0, qv.x) + vec3(q.x - 0.5, 0.0, q.y - 0.5) * 0.35);
  vec2 size = uCell0 * vec2(1.05 + 0.7 * r.z, 3.2 + 2.8 * r.w) * lod;
  float swell = (dot(xz, vec2(0.6, -0.8)) / 23.0 - uTime * 0.25 + q.z * 0.35) * TAU;
  P += along * sin(swell) * size.y * 0.3;
  size.y *= 1.0 + 0.25 * cos(swell);
  vec3 c = waterPaint(P, (vec3(r.x - 0.5, (r.y - 0.5) * 0.5, r.z - 0.5) + 0.5 * vec3(sin(swell + r.x * 9.0), 0.0, cos(swell * 0.7 + r.y * 9.0))) * 0.22);
  // broken colour, as he laid the sea: flecks of the sky's rose and gold among the blues, and a few dark ones
  if (q.w > 0.9) c = mix(c, uSkyA, 0.6);
  else if (q.w < 0.09) c = mix(c, uSkyLow, 0.6);
  else if (q.w < 0.2) c = mix(c, uWaterDeep * 0.8, 0.5);
  c *= 0.82 + 0.36 * q.x;
  d.dir = along;
  d.pos = P;
  d.size = size;
  d.c1 = hazed(jitter(c, r.yzw, 0.4), P);
  d.c2 = hazed(jitter(c * 1.15 + 0.03, q.yzw, 0.4), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37 + 0.25;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = vec3(0.0, 1.0, 0.0);
  d.height = (0.02 + 0.05 * q.z) * pow(lod, 0.35);
}
`;

export function createWater(shared, { low = false } = {}) {
  const group = new THREE.Group();
  const disc = new THREE.CircleGeometry(9000, 96).rotateX(-Math.PI / 2);
  const wash = new THREE.Mesh(disc, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uSea;
      out vec3 vWorld;
      void main() { vWorld = vec3(position.x, uSea, position.z); gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${JOURNEY}
      ${WATER}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(hazed(waterPaint(vWorld, vec3(0.0)) * 0.94, vWorld), 1.0); }`,
  }));
  wash.frustumCulled = false;
  wash.renderOrder = -6.3;
  group.add(wash);

  const rings = groundRings(shared, { head: JOURNEY + WATER, body: strokes, per: 1, n: low ? 112 : 144, cell0: 0.3, levels: 8, minPx: [4, 9], maxPx: [4000, 4000], cells: [0, 3] });
  // laid in their turn over the wash, with no depth asked or left: the land is painted over them
  rings.group.traverse((o) => {
    if (!o.isMesh) return;
    o.material.depthTest = false;
    o.material.depthWrite = false;
    o.renderOrder = -6.1;
  });
  group.add(rings.group);

  // the sheet that leaves only a depth
  const sheet = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ colorWrite: false }));
  sheet.frustumCulled = false;
  sheet.renderOrder = -5.9;
  group.add(sheet);

  return {
    group,
    follow(x, z) { rings.follow(x, z); sheet.position.y = shared.uSea.value; },
  };
}
