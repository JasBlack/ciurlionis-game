// The sky over the island. It is one sky that changes with the painting he stands in: a pale wash with level
// streaks, fair-weather cumulus over the willows, the red sun on the horizon with its fan of rays, and at night a
// crescent moon and gold stars. How much of each shows is uAir (x rays, y night, z cloud, w storm), which the
// journey sets from where he is.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { rng } from './noise.js';
import { JOURNEY } from './paint.js';

export const MOON = new THREE.Vector3(-0.37, 0.4, -0.84).normalize(); // it stands over the king, as he is first seen

export function createSky(shared) {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      out vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${JOURNEY}
      in vec3 vDir;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(skyColour(normalize(vDir)) * 0.97, 1.0); }`,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);
  const rand = rng(515);
  const flat = { depthTest: false, depthWrite: false };

  // --- the wash, in level strokes ---
  {
    const count = 5200, dirs = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, y = -0.06 + Math.pow(rand(), 1.4) * 1.06, r = Math.sqrt(Math.max(0, 1 - y * y));
      dirs.set([Math.cos(a) * r, y, Math.sin(a) * r, rand() * 1000], i * 4);
    }
    group.add(dabMesh(dabGeometry(count, { aDir: [dirs, 4] }), dabMaterial(shared, {
      head: JOURNEY + /* glsl */ `in vec4 aDir;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aDir.w);
          vec3 v = normalize(aDir.xyz);
          d.pos = cameraPosition + v * 800.0;
          vec3 level = normalize(cross(vec3(0.0, 1.0, 0.0), v));
          d.dir = normalize(level + vec3(0.0, (r.x - 0.5) * 0.22, 0.0));
          d.size = vec2(26.0 + 22.0 * r.y, 110.0 + 110.0 * r.z);
          // the film's skies are smooth: the strokes only breathe a little over the wash
          vec3 c = skyColour(v);
          d.c1 = jitter(c, r.yzw, 0.05);
          d.c2 = jitter(c * 1.015, r.wxy, 0.07);
          d.seed = aDir.w;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.08 } },
      minPx: [10, 20], maxPx: [900, 1800], cells: [0, 3], ...flat,
    }), -9));
  }

  // --- gold stars and the crescent moon ---
  {
    const count = 900, stars = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, y = 0.05 + rand() * 0.95, r = Math.sqrt(Math.max(0, 1 - y * y));
      stars.set([Math.cos(a) * r, y, Math.sin(a) * r, rand() * 1000], i * 4);
    }
    group.add(dabMesh(dabGeometry(count, { aDir: [stars, 4] }), dabMaterial(shared, {
      head: JOURNEY + /* glsl */ `in vec4 aDir; uniform vec3 uMoon;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aDir.w);
          int id = gl_InstanceID;
          // the last two touches are the moon: a disc of pale gold, and a disc of sky laid over all but its edge
          bool moon = id >= ${count - 2};
          vec3 v = normalize(aDir.xyz);
          if (moon) {
            vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), uMoon));
            v = id == ${count - 1} ? normalize(uMoon + side * 0.03 + vec3(0.0, 0.012, 0.0)) : uMoon;
          }
          float big = r.x * r.x * r.x;
          d.alive = uAir.y * (moon ? 1.0 : step(r.y, uAir.y));
          if (d.alive <= 0.01) { d.alive = 0.0; return; }
          d.pos = cameraPosition + v * 800.0;
          d.dir = vec3(0.0, 1.0, 0.0);
          d.spin = r.z * TAU;
          d.size = moon ? vec2(id == ${count - 1} ? 88.0 : 96.0) : vec2(800.0 * (0.003 + 0.007 * big));
          float waver = 0.8 + 0.2 * sin(uTime * (1.5 + 4.0 * r.y) + r.w * 60.0);
          vec3 c = mix(vec3(1.0, 0.88, 0.5), vec3(1.0, 0.96, 0.8), step(0.7, r.w)) * (0.7 + 0.3 * big) * waver;
          d.c1 = moon ? (id == ${count - 1} ? skyColour(v) : vec3(1.0, 0.93, 0.6)) : mix(skyColour(v), c, smoothstep(0.03, 0.2, v.y));
          d.c2 = d.c1;
          d.seed = aDir.w;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.2 }, uMoon: { value: MOON } },
      minPx: [2.6, 2.6], maxPx: [400, 400], cells: [4, 2], ...flat,
    }), -8.6));
  }

  // --- the red sun and its rays ---
  {
    const count = 460, data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) data.set([rand() * Math.PI * 2, rand(), rand(), rand() * 1000], i * 4);
    group.add(dabMesh(dabGeometry(count, { aR: [data, 4] }), dabMaterial(shared, {
      head: JOURNEY + /* glsl */ `in vec4 aR;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aR.w);
          bool disc = gl_InstanceID == ${count - 1};
          vec3 S = normalize(uSunsetDir);
          vec3 R = normalize(cross(vec3(0.0, 1.0, 0.0), S)), U = cross(S, R);
          if (disc) { d.alive = 0.0; return; }
          // a ray: it starts a little way out from the sun and runs straight out from it
          float th = aR.x, len = radians(mix(14.0, 62.0, aR.z)), rho = radians(mix(4.0, 30.0, aR.y * aR.y)) + len * 0.5;
          vec3 out_ = R * cos(th) + U * sin(th);
          vec3 v = normalize(S * cos(rho) + out_ * sin(rho));
          // (before the sunset there are only a few of them, and those pale)
          d.alive = smoothstep(r.y * 0.9 + 0.1, r.y * 0.9 + 0.3, uAir.x) * smoothstep(-0.12, 0.02, v.y);
          if (d.alive <= 0.0) return;
          d.pos = cameraPosition + v * 800.0;
          d.dir = normalize(-S * sin(rho) + out_ * cos(rho));
          d.size = vec2(20.0 + 46.0 * r.z, 800.0 * len);
          // warm rays and cool ones turn about, and all cool toward the far sky
          float warm = step(0.42, fract(th * 2.9 + r.x * 0.2)) * (1.0 - smoothstep(0.5, 1.15, rho));
          vec3 c = mix(mix(vec3(0.16, 0.62, 0.66), vec3(0.42, 0.72, 0.62), r.w), mix(vec3(1.0, 0.62, 0.12), vec3(1.0, 0.84, 0.3), r.w), warm);
          vec3 sky = skyColour(v);
          float body = uAir.x * (0.35 + 0.5 * r.x) * (1.0 - smoothstep(0.7, 1.4, rho));
          d.c1 = mix(sky, jitter(c, r.yzx, 0.25), body);
          d.c2 = mix(sky, c * 1.15, body);
          d.seed = aR.w;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.6 } },
      minPx: [4, 10], maxPx: [900, 2600], cells: [0, 3], ...flat,
    }), -8.4));
  }

  // the sun itself: laid after the far hills, so that it stands in front of them and behind the island's own
  group.add(dabMesh(dabGeometry(1), dabMaterial(shared, {
    head: JOURNEY,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        d.alive = smoothstep(0.5, 0.85, uAir.x);
        d.pos = cameraPosition + normalize(uSunsetDir) * 800.0;
        d.dir = vec3(0.0, 1.0, 0.0);
        d.size = vec2(175.0, 160.0);
        d.cell = 4.0;
        d.c1 = vec3(0.92, 0.2, 0.1); d.c2 = vec3(0.99, 0.44, 0.12);
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.3 } },
    minPx: [10, 10], maxPx: [900, 900], cells: [4, 2], ...flat,
  }), -6.6));

  // --- fair-weather cumulus: heaps of cream with lavender under them ---
  {
    const list = [];
    for (let k = 0; k < 16; k++) {
      const az = (k / 16) * Math.PI * 2 + rand() * 0.3, low = 0.07 + 0.1 * rand(), wide = 0.16 + 0.2 * rand(), tall = 0.09 + 0.1 * rand(), puffs = 46 + Math.floor(rand() * 40);
      for (let i = 0; i < puffs; i++) {
        const u = rand() * 2 - 1, top = Math.sqrt(1 - u * u) * (0.55 + 0.45 * Math.abs(Math.sin(u * 5 + k))), v = rand() * top;
        list.push([az + u * wide, low + v * tall, v / Math.max(top, 0.01), k * 37 + rand() * 36, v]);
      }
    }
    list.sort((a, b) => a[4] - b[4]); // the tops are laid last, over what is under them
    const count = list.length, data = new Float32Array(count * 4);
    list.forEach((c, i) => data.set(c.slice(0, 4), i * 4));
    group.add(dabMesh(dabGeometry(count, { aC: [data, 4] }), dabMaterial(shared, {
      head: JOURNEY + /* glsl */ `in vec4 aC;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aC.w);
          float heap = fract(floor(aC.w / 37.0) * 0.618 + 0.11) * 0.8;
          d.alive = smoothstep(heap, heap + 0.02, uAir.z);
          if (d.alive <= 0.0) return;
          float az = aC.x + uTime * 0.0015, el = aC.y;
          vec3 v = normalize(vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el)));
          d.pos = cameraPosition + v * 800.0;
          d.dir = normalize(cross(vec3(0.0, 1.0, 0.0), v) + vec3(0.0, (r.z - 0.5) * 0.8, 0.0));
          d.size = vec2(52.0 + 40.0 * r.y, 70.0 + 60.0 * r.w);
          vec3 c = mix(vec3(0.74, 0.76, 0.9), vec3(1.0, 0.97, 0.88), smoothstep(0.1, 0.6, aC.z + (r.x - 0.5) * 0.3));
          c = mix(skyColour(v), c, 0.9);
          d.c1 = jitter(c, r.yzw, 0.08);
          d.c2 = c * 1.03;
          d.seed = aC.w;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.55 } },
      minPx: [10, 12], maxPx: [900, 1200], cells: [4, 2], ...flat,
    }), -8.2));
  }
  // --- figures in the clouds: what he sees in the sky over the willows, as the film has them. Each is a heap of
  // cumulus of its own with a figure in it, drawn in a few strokes: a ship, a giant lying on his back, an open
  // hand reaching down, a woman's head in profile ---
  {
    // each stroke, in degrees of sky about its figure's middle: [right, up, across, along, lean from upright, kind]
    // kinds: 0 a puff of cloud, 1 a sail, 2 a thin cool line, 3 the hull, 4 a long shade, 5 a round shade,
    //        6 a long pale shape, 7 a round pale shape, 8 a thin warm line, 9 a puff of cloud in shadow
    const heap = (n, wide, tall, low, kind = 0) => {
      const out = [];
      for (let i = 0; i < n; i++) { const u = rand() * 2 - 1, v = rand(); out.push([u * wide, low + v * tall * Math.sqrt(1 - u * u * 0.8), 4.6 + 3 * rand(), 5.5 + 3.5 * rand(), 90, kind]); }
      return out;
    };
    const ship = heap(46, 15, 15, -5);
    for (const x of [-3.4, 0, 3.4]) {
      ship.push([x, 1.4, 0.16, 8.6 - Math.abs(x) * 0.4, 0, 2]);
      ship.push([x + 0.9, -0.4, 2.3, 3.3, -6, 1], [x + 0.8, 2.6, 1.8, 2.6, -6, 1], [x + 0.6, 4.9 - Math.abs(x) * 0.2, 1.2, 1.8, -6, 1]);
    }
    ship.push([6.6, 0.4, 1.3, 4.6, -52, 1], [5.6, 1.4, 1.0, 3.6, -44, 1], [-5.6, 0.2, 1.5, 3.8, 20, 1], [0.3, -3.1, 1.3, 11.5, 90, 3], [7.4, -2.4, 0.2, 3.4, -68, 2]);
    // the giant of "Day": on his back in the cloud, an arm under his head, one knee up
    const giant = [...heap(52, 17, 13, -6),
      [-7.6, 1.3, 2.3, 2.5, 0, 5], [-9.4, 2.3, 1.2, 3.4, -40, 4], [-3.2, 0.2, 2.7, 7.6, 90, 4], [1.3, 0.0, 2.5, 3.8, 90, 4],
      [3.7, 1.3, 1.7, 4.8, 55, 4], [6.3, 0.9, 1.3, 4.6, -60, 4], [5.0, -0.9, 1.3, 7.2, 90, 4], [8.6, -0.7, 0.9, 1.9, 55, 4], [8.5, -1.1, 1.0, 1.6, 90, 4]];
    // the hand: palm, four fingers, a thumb, the wrist going down into the cloud
    const hand = [...heap(42, 13, 9, -12, 9),
      [0.2, -6.6, 4.4, 5, 0, 6], [0, -1, 6.4, 6.8, 0, 7], [-3.4, 5.2, 1.8, 6.4, -12, 6], [-1.2, 6.4, 1.8, 7.4, -4, 6], [1.1, 6.2, 1.8, 7.2, 4, 6], [3.2, 5.0, 1.7, 6.2, 13, 6],
      [5.9, 0.4, 2.0, 5.8, 62, 6], [-2.3, 3.4, 0.14, 3.0, -8, 8], [0, 3.8, 0.14, 3.4, 0, 8], [2.2, 3.4, 0.14, 3.0, 9, 8], [0.4, -1.2, 0.14, 3.6, 70, 8], [3.6, 0.6, 0.14, 3.0, 40, 8]];
    // the woman's head, looking away to the left, her hair piled up behind
    const lady = [...heap(44, 14, 9, -10, 9),
      [1.6, 4.6, 4.2, 4.4, 0, 5], [2.6, 2.6, 3.4, 4.0, 0, 5], [0.2, 5.6, 3.4, 3.0, 0, 5], [4.4, 4.2, 2.2, 2.4, 0, 5],
      [0.9, -0.9, 2.0, 3.8, 14, 6], [-0.2, 2.8, 3.8, 5.0, -8, 7], [-2.3, 2.9, 0.9, 1.9, 75, 6], [-1.9, 1.5, 0.7, 1.2, 80, 6], [-1.2, 0.5, 1.5, 2.0, 90, 6],
      [-1.2, 4.0, 0.16, 1.6, 80, 8], [-1.2, 3.4, 0.14, 0.9, 86, 8], [0.3, 0.6, 0.14, 2.6, 60, 8]];
    // the figures are drawn larger than they were first set down (the heaps, the first n strokes of each, are left)
    const grow = (f, n, k, wide) => f.forEach((st, j) => { if (j < n) return; st[0] *= k; st[1] *= k; st[3] *= k; if (st[5] !== 8 && st[5] !== 2) st[2] *= k * wide; });
    grow(giant, 52, 1.1, 1.7);
    grow(hand, 42, 1.2, 1.3);
    grow(lady, 44, 1.9, 1.0);
    // where each stands in the sky (bearing east of north, height), radians
    const AT = [[-0.42, 0.37], [0.6, 0.36], [-1.5, 0.4], [1.72, 0.4]];
    const all = [ship, giant, hand, lady];
    const count = all.reduce((n, f) => n + f.length, 0), a = new Float32Array(count * 4), b = new Float32Array(count * 4);
    let i = 0;
    all.forEach((f, fi) => f.forEach((k) => { a.set([k[0], k[1], k[2], k[3]], i * 4); b.set([k[4], k[5], rand() * 1000, fi], i * 4); i++; }));
    group.add(dabMesh(dabGeometry(count, { aS: [a, 4], aT: [b, 4] }), dabMaterial(shared, {
      head: JOURNEY + /* glsl */ `in vec4 aS; in vec4 aT;
        const vec2 AT[4] = vec2[4](${AT.map((p) => `vec2(${p[0]}, ${p[1]})`).join(', ')});`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aT.z);
          // they are only there on a day piled with cloud
          d.alive = smoothstep(0.7, 0.95, uAir.z);
          if (d.alive <= 0.0) return;
          vec2 at = AT[int(aT.w + 0.5)];
          float az = at.x + radians(aS.x) + uTime * 0.0015, el = at.y + radians(aS.y);
          vec3 v = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
          vec3 right = normalize(vec3(cos(az), 0.0, sin(az))), up = normalize(cross(right, v));
          float lean = radians(aT.x);
          d.pos = cameraPosition + v * 800.0;
          d.dir = up * cos(lean) + right * sin(lean);
          d.size = 800.0 * radians(aS.zw);
          int kind = int(aT.y + 0.5);
          float hgt = smoothstep(-6.0, 3.0, aS.y + (r.x - 0.5) * 4.0);
          vec3 c = kind == 0 ? mix(vec3(0.78, 0.8, 0.92), vec3(1.0, 0.97, 0.88), hgt)
            : kind == 9 ? mix(vec3(0.68, 0.72, 0.9), vec3(0.86, 0.87, 0.96), hgt)
            : kind == 1 ? mix(vec3(0.93, 0.95, 1.0), vec3(0.78, 0.84, 0.97), r.y * 0.7)
            : kind == 2 ? vec3(0.4, 0.47, 0.7)
            : kind == 3 ? vec3(0.4, 0.52, 0.8)
            : kind <= 5 ? vec3(0.58, 0.64, 0.88)
            : kind <= 7 ? vec3(1.0, 0.96, 0.87)
            : vec3(0.62, 0.48, 0.42);
          d.c1 = jitter(c, r.yzw, 0.05);
          d.c2 = kind == 1 ? vec3(0.62, 0.7, 0.92) : kind == 4 || kind == 5 ? vec3(0.68, 0.72, 0.92) : kind == 6 || kind == 7 ? vec3(0.98, 0.86, 0.8) : c * 1.04;
          bool roundish = kind == 0 || kind == 9 || kind == 5 || kind == 7;
          bool slim = kind == 2 || kind == 3 || kind == 8;
          d.cell = roundish ? 4.0 + floor(r.z * 1.99) : slim ? 6.0 : floor(r.z * 2.99);
          d.seed = aT.z;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.5 } },
      minPx: [2, 3], maxPx: [900, 1400], cells: [0, 8], ...flat,
    }), -8.1));
  }
  return { group };
}
