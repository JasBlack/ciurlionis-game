// Everything that stands on the island: what grows (src/journey/flora.js), the made things of each painting
// (src/journey/pieces.js), and the ring of light that is the way from one painting into the next.
import * as THREE from 'three';
import { createFlora } from './flora.js';
import { createPieces, M4 } from './pieces.js';
import { createKit, V } from './kit.js';
import { heightAt } from './land.js';

export function createProps(shared, opts = {}) {
  const flora = createFlora(shared, opts), pieces = createPieces(shared, opts);
  const group = new THREE.Group();
  group.add(flora.group, pieces.group);
  const things = pieces.things;

  // --- the ring of light: a round door, as his suns are painted: a disc of pale light, rings turning about it
  // each its own way, rays standing out of it, and sparks drawn in toward its middle ---
  {
    const kit = createKit(shared, {
      seed: 50, additive: true, order: 6, minPx: [2.5, 5], maxPx: [900, 2400], jitter: 0.12,
      warp: /* glsl */ `
        void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
          vec2 c = vec2(0.0, 2.35);
          if (fx.w > 0.5 && fx.w < 4.5) {
            // 1, 2: rings, turning against each other. 3: the rays, breathing. 4: sparks spiralling in (p.z: its own moment)
            float a = uTime * (fx.w < 1.5 ? 0.22 : fx.w < 2.5 ? -0.34 : fx.w < 3.5 ? 0.06 : 0.8);
            vec2 q = p.xy - c;
            if (fx.w > 3.5) { float u = fract(uTime * 0.22 + p.z); q *= 1.0 - 0.9 * u; a += u * 2.4; p.z = 0.0; }
            if (fx.w > 2.5 && fx.w < 3.5) q *= 1.0 + 0.07 * sin(uTime * 1.6 + atan(q.y, q.x) * 5.0);
            float cs = cos(a), sn = sin(a);
            p.xy = c + vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
            d.xy = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
          }
        }`,
      tail: /* glsl */ `if (aFx.w > 3.5 && aFx.w < 4.5) d.alive *= sin(3.1416 * fract(uTime * 0.22 + aPos.z)); if (aFx.w > 4.5 && aFx.w < 5.5) d.alive *= 0.8 + 0.2 * sin(uTime * 2.3 + aData.x);`,
    });
    const flat = (c) => kit.pal(c, c, c);
    const gold = flat([0.62, 0.46, 0.14]), pale = flat([0.17, 0.14, 0.07]), white = flat([0.22, 0.2, 0.13]), rose = flat([0.3, 0.14, 0.12]), faint = flat([0.1, 0.085, 0.04]);
    const N = V(0, 0, 1), R = 2.2;
    // the disc: soft round touches, more of them toward the middle
    for (let i = 0; i < 170; i++) {
      const r = R * 0.94 * Math.pow(kit.rand(), 0.7), a = kit.rand() * 6.283;
      kit.fx(0, 2, 0, 5);
      kit.dab(V(Math.cos(a) * r, 2.35 + Math.sin(a) * r, 0), V(-Math.sin(a), Math.cos(a), 0), N, r < 0.9 ? white : pale, 0.5, 0.62);
    }
    // the rings
    for (const [r, n, w, turn, pal] of [[R, 96, 0.2, 1, gold], [R * 0.8, 60, 0.08, 2, gold], [R * 1.16, 54, 0.05, 2, rose], [R * 0.52, 30, 0.05, 1, pale]]) {
      kit.fx(0, 2, 0, turn);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; kit.dab(V(Math.cos(a) * r, 2.35 + Math.sin(a) * r, 0), V(-Math.sin(a), Math.cos(a), 0), N, pal, w, r * 6.4 / n * 1.5); }
    }
    // the rays: long and short by turns
    kit.fx(0, 2, 0, 3);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * 6.283, long = i % 2 ? 0.55 : 1.1, r = R * 1.22 + long * 0.5;
      kit.dab(V(Math.cos(a) * r, 2.35 + Math.sin(a) * r, 0), V(Math.cos(a), Math.sin(a), 0), N, i % 4 === 0 ? rose : gold, 0.13, long);
    }
    // the sparks
    kit.fx(0, 2, 0, 4);
    for (let i = 0; i < 46; i++) { const a = kit.rand() * 6.283, r = R * 1.5; kit.dab(V(Math.cos(a) * r, 2.35 + Math.sin(a) * r, kit.rand()), V(-Math.sin(a), Math.cos(a), 0), N, gold, 0.07, 0.3); }
    // and a beam standing over it, so that it can be found from far off
    kit.fx(0, 2);
    for (let i = 0; i < 26; i++) kit.dab(V((kit.rand() - 0.5) * 1.1, 6.2 + i * 1.8 + kit.rand(), 0), V(0, 1, 0), N, faint, 0.42, 7);
    const t = kit.build();
    group.add(t.group);
    things.portal = t;
  }

  // --- the pearls of light, three to a painting: a pearl, a shell of sparks turning about it, a thread of light
  // above it. They are what he gathers; the angel's rope is strung with them ---
  things.pearls = [];
  // (as many as the longest course has: the flight round the mountain)
  for (let i = 0; i < 15; i++) {
    const bead = createKit(shared, {
      seed: 60 + i, minPx: [3, 4], maxPx: [500, 500], cells: [4, 2], jitter: 0.05, lift: 0.5, uniforms: { uPhase: { value: i * 2.1 } }, decl: 'uniform float uPhase;',
      warp: /* glsl */ `void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) { p.y += 0.1 * sin(uTime * 1.5 + uPhase); }`,
    });
    const pearl = bead.pal([1, 0.95, 0.95], [0.99, 0.82, 0.87], [0.9, 0.66, 0.78]), shine = bead.pal([1, 1, 1], [1, 1, 1], [1, 0.96, 0.96]);
    bead.fx(0, 2);
    bead.ball(V(0, 0, 0), 0.24, pearl, { dabs: 10, size: [0.24, 0.24], segs: [12, 8] });
    bead.dab(V(-0.09, 0.1, 0.21), V(0, 1, 0), V(0, 0, 1), shine, 0.11, 0.11);
    const glow = createKit(shared, {
      seed: 70 + i, additive: true, order: 6, minPx: [2, 4], maxPx: [700, 1800], jitter: 0.1, uniforms: { uPhase: { value: i * 2.1 } }, decl: 'uniform float uPhase;',
      warp: /* glsl */ `
        void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
          if (fx.w > 0.5 && fx.w < 1.5) {
            float a = uTime * 0.7 + uPhase, cs = cos(a), sn = sin(a);
            p.xz = vec2(p.x * cs - p.z * sn, p.x * sn + p.z * cs); d.xz = vec2(d.x * cs - d.z * sn, d.x * sn + d.z * cs);
          }
          if (fx.w < 1.5) p.y += 0.1 * sin(uTime * 1.5 + uPhase);
        }`,
      tail: /* glsl */ `d.alive *= 0.75 + 0.25 * sin(uTime * 2.6 + aData.x);`,
    });
    const g1 = glow.pal([0.62, 0.44, 0.2], [0.62, 0.44, 0.2], [0.62, 0.44, 0.2]), g2 = glow.pal([0.46, 0.22, 0.26], [0.46, 0.22, 0.26], [0.46, 0.22, 0.26]), g3 = glow.pal([0.15, 0.12, 0.07], [0.15, 0.12, 0.07], [0.15, 0.12, 0.07]);
    glow.fx(0, 2, 0, 1);
    glow.ball(V(0, 0, 0), 0.62, g1, { solid: false, dabs: 40, size: [0.07, 0.28], dabPal: () => (glow.rand() < 0.35 ? g2 : g1), spread: 0.6 });
    glow.fx(0, 2, 0, 0);
    glow.ball(V(0, 0, 0), 0.34, g3, { solid: false, dabs: 12, size: [0.7, 0.7] });
    for (let k = 0; k < 9; k++) glow.dab(V(0, 1.2 + k * 0.95, 0), V(0, 1, 0), V(0, 0, 1), g3, 0.16 - 0.012 * k, 1.5);
    const b = bead.build(), g = glow.build();
    group.add(b.group, g.group);
    things.pearls.push({
      show(v) { b.show(v); g.show(v); },
      /** Where it floats (the world's), and how large. */
      set(x, y, z, k = 1) { const m = M4(x, y, z, 0, k); b.setMatrix(m, k); g.setMatrix(m, k); },
    });
    things.pearls[i].show(0);
  }

  // --- the hint: when he has been long without finding one, sparks leave him and drift the way it lies ---
  {
    const kit = createKit(shared, {
      seed: 80, additive: true, order: 6, minPx: [2.5, 4], maxPx: [300, 500], cells: [4, 2], jitter: 0.1,
      uniforms: { uFrom: { value: new THREE.Vector3() }, uTo: { value: new THREE.Vector3(0, 0, 1) }, uReach: { value: 15 } }, decl: 'uniform vec3 uFrom; uniform vec3 uTo; uniform float uReach;',
      warp: /* glsl */ `
        void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
          float s = fx.w, u = fract(s * 7.31 + uTime * 0.13);
          vec3 dir = uTo - uFrom;
          float len = length(dir);
          dir /= max(len, 0.001);
          vec3 side = normalize(cross(dir, vec3(0.0, 1.0, 0.0)) + vec3(0.0001, 0.0, 0.0));
          float arc = sin(u * 3.1416), k = uReach / 15.0;
          p = uFrom + dir * (0.5 + u * min(len, uReach)) + (side * sin(u * 8.0 + s * 40.0) * 0.5 * arc + vec3(0.0, 1.0 + 0.6 * arc + 0.22 * sin(u * 13.0 + s * 20.0), 0.0)) * k;
          d = dir + vec3(0.0, 0.4 * cos(u * 13.0 + s * 20.0), 0.0);
        }`,
      tail: /* glsl */ `d.alive *= sin(3.1416 * fract(aFx.w * 7.31 + uTime * 0.13));`,
    });
    const a = kit.pal([0.5, 0.38, 0.16], [0.5, 0.38, 0.16], [0.5, 0.38, 0.16]), b = kit.pal([0.4, 0.22, 0.22], [0.4, 0.22, 0.22], [0.4, 0.22, 0.22]);
    for (let i = 0; i < 44; i++) { kit.fx(0, 2, 0, (i + 0.5) / 44); kit.dab(V(0, 0, 0), V(0, 0, 1), V(0, 1, 0), i % 3 ? a : b, 0.13, 0.13 + 0.2 * kit.rand()); }
    const t = kit.build();
    t.show(0);
    group.add(t.group);
    things.motes = t;
  }

  // --- where a click sends him: a ring of light laid on the ground, that shrinks to the spot and is gone. It is
  // drawn over everything (it is a sign for the eye, not a thing in the painting), and larger the farther off it is ---
  {
    const kit = createKit(shared, { seed: 90, additive: true, order: 7, minPx: [2, 3], maxPx: [500, 1200], cells: [4, 2], jitter: 0.06 });
    const flat = (c) => kit.pal(c, c, c);
    const gold = flat([0.56, 0.42, 0.17]), rose = flat([0.36, 0.18, 0.15]), pale = flat([0.3, 0.25, 0.14]);
    const UP = V(0, 1, 0);
    kit.fx(0, 2);
    for (let i = 0; i < 44; i++) { const a = (i / 44) * 6.283; kit.dab(V(Math.cos(a), 0, Math.sin(a)), V(-Math.sin(a), 0, Math.cos(a)), UP, gold, 0.07, 0.24); }
    for (let i = 0; i < 30; i++) { const a = ((i + 0.5) / 30) * 6.283; kit.dab(V(Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74), V(-Math.sin(a), 0, Math.cos(a)), UP, rose, 0.045, 0.2); }
    for (let i = 0; i < 3; i++) kit.dab(V(0, 0, 0), V(Math.cos(i), 0, Math.sin(i)), UP, pale, 0.16, 0.2);
    const t = kit.build();
    t.strokes.material.depthTest = false;
    t.show(0);
    group.add(t.group);
    things.mark = t;
    // and inside the light, a thin ring of gold paint, which shows on pale ground where light alone would not
    const ink = createKit(shared, { seed: 91, order: 8, minPx: [2.6, 5], maxPx: [300, 800], cells: [4, 2], jitter: 0.08, lift: 0 });
    const g = ink.pal([0.98, 0.6, 0.16], [0.98, 0.6, 0.16], [0.98, 0.6, 0.16]), w = ink.pal([1, 0.9, 0.62], [1, 0.9, 0.62], [1, 0.9, 0.62]);
    ink.fx(0, 2);
    for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.283; ink.dab(V(Math.cos(a) * 0.96, 0, Math.sin(a) * 0.96), V(-Math.sin(a), 0, Math.cos(a)), UP, i % 5 ? g : w, 0.085, 0.27); }
    const r = ink.build();
    r.strokes.material.depthTest = false; r.strokes.material.depthWrite = false;
    r.show(0);
    group.add(r.group);
    things.markRing = r;
  }
  // (the ring stands tilted up toward the eye from the ground it marks, its lower edge on the spot, as the halos of
  // the paintings stand: so it reads as a round halo from near or far, high or low, and shrinks into the spot)
  const mark = { t: -1, size: 1, p: new THREE.Vector3(), up: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), s: new THREE.Vector3(), c: new THREE.Vector3() };
  /** A click has sent him to p (lying on ground whose normal is n), seen from `eye`. */
  function markAt(p, n, eye) {
    mark.t = 0;
    mark.p.copy(p);
    const toEye = eye.clone().sub(p).normalize(), face = n.clone().multiplyScalar(0.45).add(toEye).normalize();
    mark.q.setFromUnitVectors(V(0, 1, 0), face);
    // (which way is up in the ring's own plane: from its centre to the spot is down)
    mark.up.copy(n).addScaledVector(face, -n.dot(face)).normalize();
    mark.size = THREE.MathUtils.clamp(eye.distanceTo(p) / 8, 0.8, 10);
    things.mark.show(1); things.markRing.show(1);
  }
  function updateMark(dt) {
    if (mark.t < 0) return;
    mark.t += dt;
    const u = mark.t / 1.1;
    if (u >= 1) { mark.t = -1; things.mark.show(0); things.markRing.show(0); return; }
    const e = 1 - Math.pow(1 - u, 3), k = mark.size * (1.0 - 0.86 * e);
    mark.c.copy(mark.p).addScaledVector(mark.up, k * 0.92 + 0.04);
    mark.m.compose(mark.c, mark.q, mark.s.setScalar(k));
    // (the strokes thin less than the ring shrinks, so that it stays a ring of light and not a speck)
    const sk = mark.size * (1 - 0.5 * e);
    things.mark.setMatrix(mark.m, sk);
    things.markRing.setMatrix(mark.m, sk);
    const fade = Math.min(1, u / 0.06) * (1 - THREE.MathUtils.smoothstep(u, 0.4, 1));
    things.mark.uniforms.uTintK.value.setScalar(fade * 1.2);
    things.markRing.show(Math.max(0.005, fade));
  }

  const sun = shared.uSunDir.value;
  const pulse = new THREE.Color();
  function update(time, dt = 0) {
    updateMark(dt);
    // the great bird wheels over the hills; its shadow is laid on the ground where the sun puts it
    const a = time * 0.15, R = 60, bx = -6 + Math.cos(a) * R, bz = 304 + Math.sin(a) * R * 0.8, by = 70 + 4 * Math.sin(time * 0.3);
    const yaw = Math.atan2(-Math.sin(a) * R, Math.cos(a) * R * 0.8);
    things.bird.setMatrix(M4(bx, by, bz, yaw, 1, 0, -0.22));
    let gx = bx, gz = bz;
    for (let i = 0; i < 3; i++) { const t = (by - Math.max(0, heightAt(gx, gz))) / sun.y; gx = bx - sun.x * t; gz = bz - sun.z * t; }
    shared.uBird.value.set(gx, gz, yaw, 1);
    things.portal.uniforms.uTintK.value.copy(pulse.setScalar(0.9 + 0.14 * Math.sin(time * 1.9)));
    things.hornGlow.uniforms.uTintK.value.copy(pulse.setScalar(0.8 + 0.35 * Math.sin(time * 2.6)));
  }
  return {
    group, things, update, markAt,
    casters: [...flora.casters, ...pieces.casters],
    colliders: [...flora.colliders, ...pieces.colliders],
    counts: flora.counts,
  };
}
