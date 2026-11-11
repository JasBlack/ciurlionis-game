// The island as it is painted. The ground is laid in short strokes that lie flat on it, the block's steady ground:
// every stroke belongs to one small square for good, and distance only chooses which are drawn. What colour a
// stroke is, and which way it runs, comes from the painting it lies in (src/journey/paint.js). Over it, the flicks
// of whatever grows there: gold grass on the shore, long grass under the willows, fronds in the garden, reeds by
// the pond. Nothing grows on the striped hills or the mountain: they are colour alone.
import * as THREE from 'three';
import { groundRings } from '../oilpaint/ground.js';
import { JOURNEY } from './paint.js';

const carpet = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(0.0, true, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, sub * 3.0 + 1.0);
  vec4 q = hash4(cell + 31.7, sub + 11.0);
  // set down side by side, not scattered: each keeps near the middle of its own square
  vec2 xz = (cell + 0.5 + (r.xy - 0.5) * 0.62) * uCell0;
  float lod;
  d.alive = ringGrow(distance(xz, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  float h = heightAt(xz);
  if (h < uSea + 0.02 || max(abs(xz.x), abs(xz.y)) > uExtent) { d.alive = 0.0; return; }
  vec3 P = vec3(xz.x, h, xz.y);
  vec3 Nn = normalAt(xz);
  vec4 m = texture(tLand, landUv(xz));
  Paint g = groundPaint(P, Nn, m, lightOn(P, Nn), r, q);
  d.dir = g.dir;
  d.pos = P;
  d.size = uCell0 * vec2(0.86 + 0.28 * r.z, (1.75 + 0.6 * q.x) * g.len) * lod;
  d.c1 = hazed(jitter(g.c1, r.wzy, g.jit), P);
  d.c2 = hazed(jitter(g.c2, q.wzy, g.jit * 1.2), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = g.zone == 1 ? 0.0 : 1.0;
  d.lie = 1.0;
  d.nrm = Nn;
  d.height = (0.03 + 0.07 * q.z) * pow(lod, 0.35);
  d.glaze = 1.0;
}
`;

const growth = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(40.0, false, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, 40.0);
  vec4 q = hash4(cell + 17.3, 51.0);
  vec4 f = hash4(cell + sub * 7.7 + 3.1, sub * 13.0 + 3.0);
  vec2 foot = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(foot, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  vec4 m = texture(tLand, landUv(foot));
  int zone = zoneAt(m, r.w);
  float h0 = heightAt(foot);
  if (h0 < uSea + 0.05 || zone == 1 || zone >= 7 || max(abs(foot.x), abs(foot.y)) > uExtent) { d.alive = 0.0; return; }
  float drift = smoothstep(0.4, 0.7, texture(tNoise, foot / 37.0).a);
  bool reed = zone == 6 && h0 < 1.3;
  float chance = zone == 0 ? 0.25 + 0.4 * drift : zone == 2 ? 0.45 + 0.4 * drift : zone == 3 ? (0.1 + 0.5 * drift) * (1.0 - m.b)
    : zone == 4 ? 0.03 + 0.1 * drift : zone == 5 ? 0.02 + 0.05 * drift : reed ? 0.9 : 0.25 * drift;
  if (q.x > chance * (1.0 - m.r)) { d.alive = 0.0; return; }
  // a broad frond, a reed, or a blade of grass
  bool frond = zone == 5 || (zone == 3 && q.z > 0.5);
  float big = min(pow(lod, 0.6), 2.2);
  float a = (sub + f.x) / 6.0 * TAU + r.z * TAU;
  vec2 fan = vec2(cos(a), sin(a));
  vec2 xz = foot + fan * (frond ? 0.1 : 0.03) * big;
  vec3 P = vec3(xz.x, heightAt(xz), xz.y);
  float gust = gustAt(xz);
  float lit = lightOn(P + vec3(0.0, 0.3, 0.0), vec3(0.0, 1.0, 0.0)) * figSunAt(P + vec3(0.0, 0.3, 0.0));
  int kind = int(3.0 * fract(q.y * 3.7 + floor(texture(tNoise, foot / 14.0).r * 3.0) * 0.33));
  int kk = kind;
  if (zone == 0) kk = kind == 2 ? 3 : kind;
  else if (zone == 3) kk = kind == 0 ? 1 : kind;
  else if (zone == 4) kk = kind == 2 ? 1 : kind;
  else if (zone == 5) kk = kind == 2 ? 0 : kind;
  else if (zone == 6) kk = kind == 0 ? 1 : kind;
  vec3 c = zc(zone, kk, lit, f.w) * 1.1;
  if (zone == 5 && kind == 2) c = paint3(vec3(0.34, 0.62, 0.58), vec3(0.18, 0.44, 0.46), vec3(0.06, 0.2, 0.32), lit, f.w);
  if (zone == 5 && f.w > 0.92) c = paint3(vec3(0.92, 0.32, 0.2), vec3(0.72, 0.2, 0.16), vec3(0.34, 0.1, 0.18), lit, f.x);
  if (zone == 4) c = mix(vec3(0.1, 0.22, 0.5), vec3(0.84, 0.6, 0.2), step(0.8, f.w) * 0.7);
  float tall = zone == 2 ? mix(0.5, 0.95, f.z) : zone == 5 ? mix(0.7, 1.5, f.z) : reed ? mix(1.1, 2.0, f.z) : mix(0.3, 0.6, f.z);
  float sway = sin(uTime * (1.6 + f.z) + f.w * 40.0) * (0.04 + 0.1 * gust);
  vec2 lean = fan * (frond ? 0.9 + 1.2 * f.y : reed ? 0.05 + 0.12 * f.y : 0.14 + 0.4 * f.y) + uWind.xy * (0.08 + 0.6 * gust + sway);
  d.dir = normalize(vec3(lean.x, 1.0, lean.y));
  d.pos = P - vec3(0.0, 0.02, 0.0);
  d.size = vec2((frond ? 0.2 : reed ? 0.055 : 0.042) * big * (0.8 + 0.5 * f.x), tall);
  d.cell = frond ? (f.x > 0.5 ? 3.0 : 7.0) : floor(f.y * 2.99);
  d.c1 = hazed(jitter(c, f.zwx, 0.5), P);
  d.c2 = hazed(jitter(c * 1.2, f.xzy, 0.7), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37 + 0.5;
  d.base = 1.0;
  d.lift = 0.25;
}
`;

export function createGround(shared, { low = false } = {}) {
  const carpetRings = groundRings(shared, { head: JOURNEY, body: carpet, per: 1, n: low ? 160 : 224, cell0: 0.15, levels: 7, minPx: [5, 9], maxPx: [4000, 4000], cells: [0, 8] });
  const growthRings = groundRings(shared, { head: JOURNEY, body: growth, per: 6, n: low ? 72 : 96, cell0: 0.42, levels: 4, minPx: [2.5, 12], maxPx: [60, 420], cells: [0, 4] });
  const group = new THREE.Group();
  group.add(carpetRings.group, growthRings.group);
  return { group, follow(x, z) { carpetRings.follow(x, z); growthRings.follow(x, z); } };
}
