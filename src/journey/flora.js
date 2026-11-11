// What grows on the island that is more than grass: the willows of "Day", the round bushes of the wood, the
// cypress spires in the valley under the ram's ledge, the great leaves and daisies of the king's garden, and the
// lilies on the pond. All of it is made with the kit (src/journey/kit.js): a few plain shapes, and strokes.
import * as THREE from 'three';
import { createKit, V } from './kit.js';
import { noise, rng } from './noise.js';
import { heightAt, landAt, cliffX } from './land.js';
import { PLACES, nearWay } from './way.js';

export function createFlora(shared, { low = false } = {}) {
  const group = new THREE.Group(), casters = [], colliders = [];
  const rand = rng(2468);
  const near = {};
  const wd = (x, z) => nearWay(x, z, near).d;
  const done = (kit) => { const t = kit.build(); group.add(t.group); const c = t.caster(); if (c) casters.push(c); return t; };
  const counts = {};

  // --- willows: a pale trunk, limbs that arch out, and long fronds hanging nearly to the grass ---
  {
    const kit = createKit(shared, { seed: 3, minPx: [3, 8], maxPx: [200, 700] });
    const bark = kit.pal([0.93, 0.8, 0.42], [0.74, 0.58, 0.3], [0.38, 0.3, 0.3]);
    const leaves = [
      kit.pal([0.52, 0.7, 0.4], [0.32, 0.52, 0.36], [0.12, 0.28, 0.32]), kit.pal([0.46, 0.72, 0.64], [0.26, 0.52, 0.52], [0.1, 0.26, 0.38]),
      kit.pal([0.94, 0.82, 0.34], [0.74, 0.62, 0.26], [0.34, 0.34, 0.26]), kit.pal([0.96, 0.64, 0.26], [0.78, 0.46, 0.2], [0.38, 0.24, 0.22]),
    ];
    const willow = (x, z, h, full) => {
      const y0 = heightAt(x, z) - 0.3;
      const lean = [(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12];
      const pts = [], radii = [];
      for (let i = 0; i < 5; i++) { const u = i / 4; pts.push(V(x + lean[0] * u * h, y0 + u * h * 0.62, z + lean[1] * u * h)); radii.push(h * 0.062 * (1 - 0.5 * u) + 0.08); }
      kit.fx(0);
      kit.tube(pts, radii, bark, { sides: 8, dabs: full ? 70 : 30, size: [0.24, 0.8] });
      const top = pts[4], limbs = full ? 8 : 6;
      for (let i = 0; i < limbs; i++) {
        const a = (i / limbs) * Math.PI * 2 + rand() * 0.6, reach = h * (0.32 + 0.16 * rand());
        const out = V(Math.cos(a), 0, Math.sin(a));
        const p0 = pts[2 + (i % 3)].clone(), p3 = top.clone().addScaledVector(out, reach);
        p3.y = y0 + h * (0.82 + 0.16 * rand());
        const p1 = p0.clone().lerp(p3, 0.4).add(V(0, h * 0.14, 0)), p2 = p0.clone().lerp(p3, 0.75).add(V(0, h * 0.1, 0));
        kit.fx(0);
        kit.tube([p0, p1, p2, p3], [radii[3] * 0.6, radii[3] * 0.45, radii[3] * 0.3, 0.05], bark, { sides: 5, dabs: 6, size: [0.12, 0.6] });
        const strands = (full ? 34 : 16) * (low ? 0.6 : 1);
        for (let k = 0; k < strands; k++) {
          const u = 0.3 + 0.75 * rand(), w = 1 - u;
          const p = p1.clone().multiplyScalar(w * w).addScaledVector(p2, 2 * w * u).addScaledVector(p3, u * u);
          p.add(V((rand() - 0.5) * 1.4, (rand() - 0.2) * 0.8, (rand() - 0.5) * 1.4));
          const hang = Math.max(1.2, p.y - heightAt(p.x, p.z) - 0.7 - 1.2 * rand());
          const pal = leaves[rand() < 0.5 ? 0 : rand() < 0.5 ? 1 : rand() < 0.7 ? 2 : 3];
          // a strand is a string of long leaves, each hanging a little its own way
          const pieces = Math.max(3, Math.round(hang / 0.62)), len = hang / pieces;
          const outward = V(p.x - x, 0.2, p.z - z).normalize();
          for (let j = 0; j < pieces; j++) {
            kit.fx(0.25 + 0.75 * (j + 0.5) / pieces);
            const leaf = rand() < 0.22 ? leaves[Math.floor(rand() * 4)] : pal;
            kit.dab(V(p.x + (rand() - 0.5) * 0.3, p.y - (j + 0.5) * len, p.z + (rand() - 0.5) * 0.3), V((rand() - 0.5) * 0.7, -1, (rand() - 0.5) * 0.7), outward, leaf, 0.15 + 0.07 * rand(), len * (1.0 + 0.5 * rand()));
          }
        }
      }
      colliders.push({ x, z, y: y0, r: radii[0] * 1.1, h: 3 });
    };
    const W = PLACES.willows;
    willow(W.x - 9, W.z + 6, 10, true);
    willow(W.x + 9, W.z - 7, 11.5, true);
    for (let gz = 110; gz <= 250; gz += 21) {
      for (let gx = -90; gx <= 150; gx += 21) {
        const x = gx + (rand() - 0.5) * 16, z = gz + (rand() - 0.5) * 16;
        if (Math.abs(landAt(x, z)[1] - 2) > 0.5 || wd(x, z) < 7 || heightAt(x, z) < 2 || Math.hypot(x - W.x, z - W.z) < 26 || rand() > 0.42) continue;
        willow(x, z, 7 + 4 * rand(), false);
      }
    }
    counts.willows = done(kit).dabs;
  }

  // --- the round wood: bushes and small trees painted as domes, their strokes fanning up from the root ---
  {
    const kit = createKit(shared, { seed: 5, minPx: [3, 7], maxPx: [260, 600] });
    const P = [
      kit.pal([0.8, 0.8, 0.32], [0.5, 0.62, 0.3], [0.14, 0.34, 0.38]), kit.pal([0.56, 0.7, 0.36], [0.3, 0.5, 0.36], [0.1, 0.28, 0.38]),
      kit.pal([0.5, 0.68, 0.56], [0.26, 0.46, 0.5], [0.08, 0.22, 0.4]), kit.pal([0.74, 0.72, 0.3], [0.46, 0.5, 0.26], [0.16, 0.26, 0.3]),
    ];
    const trunkPal = kit.pal([0.7, 0.44, 0.3], [0.48, 0.3, 0.26], [0.24, 0.16, 0.22]);
    const lobe = (c, r, pal) => {
      kit.fx(0.12);
      kit.ball(c, [r, r * 0.82, r], pal, { dabs: Math.round(Math.min(150, 22 + 20 * r * r) * (low ? 0.6 : 1)), size: [0.26 + 0.12 * r, 0.5 + 0.22 * r], grain: 'up', spread: 0.7, upper: -0.35, segs: [8, 5] });
    };
    const bush = (x, z, r, tree) => {
      const y0 = heightAt(x, z), pal = P[Math.floor(rand() * 4)];
      let cy = y0 + r * 0.55;
      if (tree) {
        const th = r * (1.0 + 0.8 * rand());
        kit.fx(0);
        kit.tube([V(x, y0 - 0.3, z), V(x + (rand() - 0.5) * 0.6, y0 + th * 0.6, z + (rand() - 0.5) * 0.6), V(x, y0 + th + 0.5, z)], [0.16 + r * 0.06, 0.13 + r * 0.05, 0.1], trunkPal, { sides: 6, dabs: 8, size: [0.14, 0.7] });
        cy = y0 + th + r * 0.6;
      }
      lobe(V(x, cy, z), r, pal);
      const extra = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < extra; i++) {
        const a = rand() * 6.283, rr = r * (0.5 + 0.3 * rand());
        lobe(V(x + Math.cos(a) * r * 0.75, cy - r * 0.2 + rand() * r * 0.3, z + Math.sin(a) * r * 0.75), rr, rand() < 0.75 ? pal : P[Math.floor(rand() * 4)]);
      }
      if (wd(x, z) < 34) colliders.push({ x, z, y: y0, r: tree ? 0.3 + r * 0.08 : r * 0.6, h: 3 });
    };
    const L = PLACES.ledge;
    for (let gz = -76; gz <= 156; gz += 7.5) {
      for (let gx = -112; gx <= 120; gx += 7.5) {
        const x = gx + (rand() - 0.5) * 6.5, z = gz + (rand() - 0.5) * 6.5, m = landAt(x, z);
        if (Math.abs(m[1] - 3) > 0.56 || m[2] > 0.4 || m[3] > 0.2 || wd(x, z) < 3.8 || heightAt(x, z) < 20) continue;
        if (x < cliffX(z) + 5 || Math.hypot(x - L.x, z - L.z) < 19) continue;
        if (noise(x / 26 + 4, z / 26 - 2) < -0.32 || rand() > 0.8) continue;
        const tree = rand() < 0.2;
        bush(x, z, tree ? 2.4 + 2.1 * rand() : 1.1 + 3.2 * Math.pow(rand(), 1.6), tree);
      }
    }
    counts.bushes = done(kit).dabs;
  }

  // --- cypresses: dark spires standing shoulder to shoulder in the valley, the sun on one side of each ---
  {
    const kit = createKit(shared, { seed: 7, minPx: [3, 8], maxPx: [200, 700] });
    const C = [kit.pal([0.66, 0.66, 0.24], [0.14, 0.4, 0.42], [0.05, 0.17, 0.38]), kit.pal([0.52, 0.62, 0.3], [0.1, 0.34, 0.44], [0.04, 0.13, 0.36])];
    const cypress = (x, z, h) => {
      const y0 = heightAt(x, z) - 0.4, pal = C[rand() < 0.6 ? 0 : 1], r = h * (0.085 + 0.03 * rand());
      kit.fx(0.05);
      kit.tube([V(x, y0, z), V(x, y0 + h * 0.12, z), V(x, y0 + h * 0.5, z), V(x, y0 + h * 0.85, z), V(x, y0 + h, z)], [r * 0.7, r, r * 0.8, r * 0.36, 0.03], pal, { sides: 6, dabs: low ? 12 : 20, size: [h * 0.055, h * 0.2], spread: 0.3 });
    };
    const K = PLACES.cathedral;
    for (let gz = -128; gz <= 146; gz += 6.2) {
      for (let gx = -332; gx <= -70; gx += 6.2) {
        const x = gx + (rand() - 0.5) * 5, z = gz + (rand() - 0.5) * 5;
        if (x > cliffX(z) - 9) continue;
        const y = heightAt(x, z);
        if (y < 1.5 || y > 34 || Math.hypot(x - K.x, z - K.z) < 36 || noise(x / 31 + 2, z / 31 + 9) < -0.3) continue;
        cypress(x, z, 12 + 12 * rand());
      }
    }
    for (const [x, z, h] of [[-54, 51, 16], [-47, 57, 13], [-52, 8, 17], [-44, 1, 14], [-36, 46, 12], [-60, 56, 18], [-58, 3, 15]]) {
      cypress(x, z, h);
      colliders.push({ x, z, y: heightAt(x, z), r: 0.6, h: 3 });
    }
    counts.cypress = done(kit).dabs;
  }

  // --- firs on the sunset's hills: dark cones, the side toward the sun gone to gold ---
  {
    const kit = createKit(shared, { seed: 8, minPx: [3, 8], maxPx: [260, 800] });
    const F = [kit.pal([0.9, 0.76, 0.26], [0.2, 0.4, 0.36], [0.05, 0.15, 0.32]), kit.pal([0.74, 0.7, 0.28], [0.14, 0.34, 0.4], [0.04, 0.12, 0.3])];
    const fir = (x, z, h) => {
      const y0 = heightAt(x, z) - 0.4, pal = F[rand() < 0.6 ? 0 : 1], r = h * (0.17 + 0.05 * rand());
      kit.fx(0.05);
      kit.tube([V(x, y0, z), V(x, y0 + h * 0.1, z), V(x, y0 + h * 0.55, z), V(x, y0 + h, z)], [r * 0.5, r, r * 0.5, 0.03], pal, { sides: 7, dabs: low ? 16 : 28, size: [h * 0.07, h * 0.2], spread: 0.6 });
      if (wd(x, z) < 30) colliders.push({ x, z, y: y0, r: 0.4, h: 3 });
    };
    for (let gz = -200; gz <= 10; gz += 9) {
      for (let gx = -110; gx <= 130; gx += 9) {
        const x = gx + (rand() - 0.5) * 8, z = gz + (rand() - 0.5) * 8, m = landAt(x, z);
        if (Math.abs(m[1] - 4) > 0.5 || m[3] > 0.2 || heightAt(x, z) < 3) continue;
        if (wd(x, z) < 9 || noise(x / 34 + 6, z / 34 - 3) < 0.08 || rand() > 0.7) continue;
        if (Math.hypot(x - PLACES.harp.x, z - PLACES.harp.z) < 22) continue;
        fir(x, z, 7 + 8 * rand());
      }
    }
    counts.firs = done(kit).dabs;
  }

  // --- the king's garden: palms, great blades and leaves, red heliconias, and daisies taller than a man ---
  {
    const kit = createKit(shared, { seed: 9, minPx: [3, 8], maxPx: [300, 900], jitter: 0.5 });
    const G = {
      yg: kit.pal([0.82, 0.86, 0.4], [0.6, 0.7, 0.3], [0.16, 0.3, 0.26]), g: kit.pal([0.44, 0.7, 0.4], [0.26, 0.52, 0.34], [0.08, 0.24, 0.3]),
      bg: kit.pal([0.34, 0.62, 0.58], [0.18, 0.44, 0.46], [0.06, 0.2, 0.32]), dk: kit.pal([0.2, 0.42, 0.34], [0.1, 0.28, 0.26], [0.04, 0.13, 0.2]),
      red: kit.pal([0.95, 0.34, 0.2], [0.76, 0.2, 0.16], [0.4, 0.1, 0.18]), or: kit.pal([0.96, 0.66, 0.24], [0.8, 0.46, 0.18], [0.42, 0.22, 0.18]),
      trunk: kit.pal([0.72, 0.44, 0.3], [0.5, 0.3, 0.24], [0.26, 0.16, 0.2]), white: kit.pal([1, 0.99, 0.94], [0.9, 0.92, 0.96], [0.66, 0.7, 0.86]),
      yel: kit.pal([1, 0.86, 0.26], [0.92, 0.68, 0.16], [0.6, 0.4, 0.14]), lite: kit.pal([0.8, 0.88, 0.5], [0.54, 0.72, 0.4], [0.16, 0.36, 0.32]),
    };
    const greens = [G.yg, G.g, G.bg, G.dk];
    // one long leaf from a foot: sway, and which brush mark (3 and 7 are the curved ones)
    const blade = (foot, dir, len, wide, pal, sway, mark = 0) => {
      kit.fx(sway, 1, 0, mark ? 10 + mark : 0); // flat colour, as crayon on card
      kit.dab(foot.clone().addScaledVector(dir, len * 0.5), dir, V(dir.x, 0.4, dir.z).normalize(), pal, wide, len);
    };
    const palm = (x, z) => {
      const y0 = heightAt(x, z), h = 3 + 3.4 * rand(), bend = [(rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9];
      const top = V(x + bend[0], y0 + h, z + bend[1]);
      kit.fx(0);
      kit.tube([V(x, y0 - 0.3, z), V(x + bend[0] * 0.3, y0 + h * 0.5, z + bend[1] * 0.3), top], [0.2, 0.15, 0.12], G.trunk, { sides: 6, dabs: 14, size: [0.2, 0.3], grain: 'round' });
      const fronds = 10 + Math.floor(rand() * 5), pal = rand() < 0.3 ? G.or : greens[Math.floor(rand() * 3)];
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * 6.283 + rand() * 0.4, out = V(Math.cos(a), 0, Math.sin(a));
        let p = top.clone();
        for (const [e, len] of [[0.75, 1.1], [0.15, 1.2], [-0.55, 1.1]]) {
          const dir = out.clone().multiplyScalar(Math.cos(e)).add(V(0, Math.sin(e), 0));
          blade(p, dir, len * (0.85 + 0.4 * rand()), 0.42, rand() < 0.2 ? G.yg : pal, 0.5, e > 0.5 ? 0 : 3);
          p = p.clone().addScaledVector(dir, len * 0.86);
        }
      }
      colliders.push({ x, z, y: y0, r: 0.24, h: 2.5 });
    };
    const rosette = (x, z, big) => {
      const foot = V(x, heightAt(x, z) - 0.05, z), n = 10 + Math.floor(rand() * 7), pal = greens[Math.floor(rand() * 4)];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + rand() * 0.5, e = 0.55 + 0.85 * rand();
        blade(foot, V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)), big * (1.3 + 1.2 * rand()), big * 0.3, rand() < 0.15 ? G.yg : pal, 0.25, rand() < 0.5 ? 7 : 0);
      }
    };
    const leaves = (x, z) => {
      const foot = V(x, heightAt(x, z) - 0.05, z), n = 5 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const a = rand() * 6.283, e = 0.95 + 0.5 * rand();
        blade(foot, V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)), 2.2 + 1.6 * rand(), 0.75, rand() < 0.6 ? G.lite : G.g, 0.3, rand() < 0.5 ? 3 : 0);
      }
    };
    const heliconia = (x, z) => {
      const foot = V(x, heightAt(x, z), z), h = 1.8 + 1.4 * rand(), a = rand() * 6.283, side = V(Math.cos(a), 0, Math.sin(a));
      blade(foot, V(0.05, 1, 0.03).normalize(), h, 0.09, G.g, 0.2);
      for (let i = 0; i < 7; i++) {
        const s = i % 2 ? 1 : -1, y = h * (0.42 + 0.085 * i);
        blade(V(foot.x, foot.y + y, foot.z), side.clone().multiplyScalar(s * 0.85).add(V(0, 0.55, 0)).normalize(), 0.62 - 0.04 * i, 0.24, rand() < 0.25 ? G.or : G.red, 0.25);
      }
      for (let i = 0; i < 3; i++) blade(foot, V(Math.cos(a + 2 + i * 1.7) * 0.5, 0.86, Math.sin(a + 2 + i * 1.7) * 0.5), 1.4 + rand(), 0.4, G.g, 0.3, 3);
    };
    const daisy = (x, z, h) => {
      const foot = V(x, heightAt(x, z), z), a = rand() * 6.283;
      const bend = V(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), head = foot.clone().add(V(bend.x, h, bend.z));
      blade(foot, V(bend.x * 0.25, 1, bend.z * 0.25).normalize(), h * 0.62, 0.07, G.g, 0.15);
      blade(foot.clone().add(V(bend.x * 0.2, h * 0.55, bend.z * 0.2)), V(bend.x * 1.6, 1, bend.z * 1.6).normalize(), h * 0.5, 0.06, G.g, 0.3);
      // the flower looks out and a little up, toward whoever comes
      const face = V(Math.cos(a), 0.55, Math.sin(a)).normalize(), u = V().crossVectors(face, V(0, 1, 0)).normalize(), v = V().crossVectors(u, face);
      const petals = 13, size = 0.3 + 0.1 * h;
      for (let i = 0; i < petals; i++) {
        const t = (i / petals) * 6.283, dir = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
        kit.fx(0.35, 1);
        kit.dab(head.clone().addScaledVector(dir, size * 0.95), dir, face, G.white, size * 0.5, size * 1.5);
      }
      kit.fx(0.35, 1, 0, 14);
      kit.dab(head.clone().addScaledVector(face, 0.03), u, face, G.yel, size * 0.9, size * 0.8);
    };
    const K = PLACES.king;
    for (let gz = -372; gz <= -196; gz += 5.2) {
      for (let gx = -70; gx <= 100; gx += 5.2) {
        const x = gx + (rand() - 0.5) * 4.6, z = gz + (rand() - 0.5) * 4.6, m = landAt(x, z);
        if (m[1] < 4.55 || m[3] > 0.2 || heightAt(x, z) < 0.5 || wd(x, z) < 2.6 || Math.hypot(x - K.x, z - K.z) < 5.5) continue;
        if (Math.hypot(x - PLACES.wake.x, z - PLACES.wake.z) < 3) continue;
        const dense = m[1] < 5.5 ? 0.34 : 0.2;
        if (rand() > dense) continue;
        const t = rand();
        if (t < 0.24) palm(x, z); else if (t < 0.42) rosette(x, z, 0.8 + 0.7 * rand()); else if (t < 0.58) leaves(x, z); else if (t < 0.78) heliconia(x, z); else daisy(x, z, 1.5 + 2 * rand());
      }
    }
    // the daisies that grew round him while he slept, and the tall one by the king
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, r = 3.4 + 1.6 * rand(); daisy(PLACES.wake.x + Math.cos(a) * r, PLACES.wake.z + Math.sin(a) * r, 1.7 + 1.6 * rand()); }
    daisy(K.x + 3.4, K.z + 2.6, 4.4);
    daisy(K.x - 3.6, K.z + 3.0, 3.4);
    // behind them all, as the film has it: tall trees with red trunks and dark heads, and drifts of yellow reed
    G.bark = kit.pal([0.66, 0.28, 0.2], [0.52, 0.2, 0.16], [0.3, 0.12, 0.12]);
    const tree = (x, z) => {
      const y0 = heightAt(x, z), h = 9 + 5 * rand(), lean = [(rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6];
      kit.fx(0, 1);
      kit.tube([V(x, y0 - 0.4, z), V(x + lean[0] * 0.4, y0 + h * 0.5, z + lean[1] * 0.4), V(x + lean[0], y0 + h, z + lean[1])], [0.5, 0.38, 0.26], G.bark, { sides: 7, dabs: 26, size: [0.2, 1.4], dabPal: () => (rand() < 0.4 ? G.trunk : G.bark) });
      const lobes = 5 + Math.floor(rand() * 3);
      for (let i = 0; i < lobes; i++) {
        const a = rand() * 6.283, r = 1.8 + 1.6 * rand(), d = 2.6 * rand();
        kit.fx(0.15, 1);
        kit.ball(V(x + lean[0] + Math.cos(a) * d, y0 + h + (rand() - 0.3) * 2.2, z + lean[1] + Math.sin(a) * d), [r, r * 0.7, r], G.dk, { dabs: 26, size: [0.5, 1.0], dabPal: () => (rand() < 0.35 ? G.bg : G.dk), segs: [8, 5] });
      }
      kit.fx(0);
      colliders.push({ x, z, y: y0, r: 0.6, h: 3 });
    };
    const reeds = (x, z) => {
      const y0 = heightAt(x, z);
      for (let i = 0; i < 12; i++) blade(V(x + (rand() - 0.5) * 3.2, y0, z + (rand() - 0.5) * 3.2), V((rand() - 0.5) * 0.16, 1, (rand() - 0.5) * 0.16).normalize(), 2.6 + 2.4 * rand(), 0.12, rand() < 0.3 ? G.or : G.yel, 0.4);
    };
    for (let gz = -372; gz <= -190; gz += 11) {
      for (let gx = -90; gx <= 110; gx += 11) {
        const x = gx + (rand() - 0.5) * 9, z = gz + (rand() - 0.5) * 9, m = landAt(x, z);
        if (m[1] < 4.6 || m[3] > 0.2 || heightAt(x, z) < 1.2 || wd(x, z) < 16) continue;
        const t = rand();
        if (t < 0.22) tree(x, z); else if (t < 0.72 && noise(x / 30, z / 30 + 5) > -0.1) reeds(x, z);
      }
    }
    counts.garden = done(kit).dabs;
  }

  // --- lilies on the pond and down the canal: pads lying on the water, a few flowers ---
  {
    const kit = createKit(shared, { seed: 11, minPx: [3, 4], maxPx: [900, 900] });
    const pad = [kit.pal([0.52, 0.72, 0.34], [0.32, 0.54, 0.3], [0.1, 0.3, 0.26]), kit.pal([0.4, 0.62, 0.4], [0.22, 0.46, 0.34], [0.07, 0.24, 0.26])];
    const petal = kit.pal([1, 0.97, 0.95], [0.97, 0.82, 0.86], [0.7, 0.6, 0.74]);
    const P = PLACES.pond, cz = PLACES.canalZ;
    const lily = (x, z) => {
      if (heightAt(x, z) > -0.25) return;
      kit.fx(0, 0, 1, 10 + (rand() < 0.5 ? 4 : 5));
      const a = rand() * 6.283, s = 0.9 + 1.0 * rand();
      kit.dab(V(x, 0.03, z), V(Math.cos(a), 0, Math.sin(a)), V(0, 1, 0), pad[rand() < 0.6 ? 0 : 1], s, s * 1.5);
      if (rand() < 0.22) {
        for (let i = 0; i < 6; i++) { const t = i * 1.05; kit.fx(0, 1); kit.dab(V(x + Math.cos(t) * 0.14, 0.2, z + Math.sin(t) * 0.14), V(Math.cos(t) * 0.6, 1, Math.sin(t) * 0.6), V(Math.cos(t), 0.5, Math.sin(t)), petal, 0.13, 0.3); }
      }
    };
    for (let i = 0; i < 260; i++) { const a = rand() * 6.283, r = Math.sqrt(rand()) * 34; lily(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r); }
    for (let i = 0; i < 260; i++) lily(70 + rand() * 190, cz + (rand() - 0.5) * 13);
    counts.lilies = done(kit).dabs;
  }

  return { group, casters, colliders, counts };
}
