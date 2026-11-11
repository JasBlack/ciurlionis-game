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

  // --- the portal: two rings of gold light standing on the ground, and a shimmer inside them ---
  {
    const kit = createKit(shared, {
      seed: 50, additive: true, order: 6, maxPx: [900, 2400], jitter: 0.15,
      warp: /* glsl */ `
        void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {
          // the shimmer rises; the rings breathe
          if (fx.w > 0.5 && fx.w < 9.0) p.y = 0.3 + mod(p.y + uTime * (0.25 + 0.3 * fx.w), 4.2);
          else p.xy = vec2(0.0, 2.35) + (p.xy - vec2(0.0, 2.35)) * (1.0 + 0.03 * sin(uTime * 1.7 + p.x));
        }`,
    });
    const gold = kit.pal([0.5, 0.39, 0.12], [0.5, 0.39, 0.12], [0.5, 0.39, 0.12]);
    const faint = kit.pal([0.13, 0.11, 0.05], [0.13, 0.11, 0.05], [0.13, 0.11, 0.05]);
    kit.fx(0, 2);
    for (const [r, n, w] of [[2.2, 110, 0.11], [1.82, 84, 0.07], [2.6, 70, 0.05]]) {
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; kit.dab(V(Math.cos(a) * r, 2.35 + Math.sin(a) * r, 0), V(-Math.sin(a), Math.cos(a), 0), V(0, 0, 1), gold, w, 0.3); }
    }
    for (let i = 0; i < 70; i++) {
      const x = (kit.rand() - 0.5) * 3.2, span = Math.sqrt(Math.max(0, 1.75 * 1.75 - x * x));
      kit.fx(0, 2, 0, 0.6 + kit.rand());
      kit.dab(V(x, 2.35 + (kit.rand() * 2 - 1) * span, 0), V(0, 1, 0), V(0, 0, 1), faint, 0.16, 0.9);
    }
    // and a beam standing over it, so that it can be found from far off
    kit.fx(0, 2);
    for (let i = 0; i < 28; i++) kit.dab(V((kit.rand() - 0.5) * 1.5, 6 + i * 1.7 + kit.rand(), 0), V(0, 1, 0), V(0, 0, 1), faint, 0.5, 7);
    const t = kit.build();
    group.add(t.group);
    things.portal = t;
  }

  const sun = shared.uSunDir.value;
  const pulse = new THREE.Color();
  function update(time) {
    // the great bird wheels over the hills; its shadow is laid on the ground where the sun puts it
    const a = time * 0.15, R = 60, bx = -6 + Math.cos(a) * R, bz = 304 + Math.sin(a) * R * 0.8, by = 70 + 4 * Math.sin(time * 0.3);
    const yaw = Math.atan2(-Math.sin(a) * R, Math.cos(a) * R * 0.8);
    things.bird.setMatrix(M4(bx, by, bz, yaw, 1, 0, -0.22));
    let gx = bx, gz = bz;
    for (let i = 0; i < 3; i++) { const t = (by - Math.max(0, heightAt(gx, gz))) / sun.y; gx = bx - sun.x * t; gz = bz - sun.z * t; }
    shared.uBird.value.set(gx, gz, yaw, 1);
    things.portal.uniforms.uTintK.value.copy(pulse.setScalar(0.85 + 0.2 * Math.sin(time * 2.1)));
    things.hornGlow.uniforms.uTintK.value.copy(pulse.setScalar(0.8 + 0.35 * Math.sin(time * 2.6)));
  }
  return {
    group, things, update,
    casters: [...flora.casters, ...pieces.casters],
    colliders: [...flora.colliders, ...pieces.colliders],
    counts: flora.counts,
  };
}
