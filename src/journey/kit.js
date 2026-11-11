// A kit for the made things of the journey: statues, trees, the ram, the harp, the king, the angel. A thing is
// put together from a few plain shapes (pipes, balls, boxes, turned shapes). Each shape is kept as a solid, which
// carries the underpainting, hides the far side and throws shade, and has strokes scattered over it that run
// along its grain. Colours are palettes of three mixes, as everywhere in the block.
//
//   const kit = createKit(shared, { seed });
//   const gold = kit.pal([light], [half-tone], [shade]);
//   kit.tube(points, radii, gold, { dabs: 40, size: [0.2, 0.6] });
//   const thing = kit.build();   scene.add(thing.group);   thing.setMatrix(m);   thing.show(0..1);
//
// A kit built about the origin can be moved as one piece (setMatrix), and bent as it goes by `warp`, a piece of
// GLSL that is given every point before it is placed.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { rng } from './noise.js';

const UP = new THREE.Vector3(0, 1, 0);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createKit(shared, { seed = 1, warp = '', decl = '', uniforms = {}, additive = false, order = 3, minPx = [3, 6], maxPx = [300, 700], cells = [0, 8], jitter = 0.4, lift = 0.3 } = {}) {
  const rand = rng(seed * 7919 + 13);
  const pals = [];
  const S = { position: [], normal: [], data: [], fx: [], index: [] };
  const D = { pos: [], dir: [], nrm: [], data: [], fx: [] };
  let fx = [0, 0, 0, 0]; // sway in the wind, glow (1 unlit, 2 unlit and out of the mist), lies flat, and one number for warp
  const a = V(), b = V(), c = V(), n = V(), t = V();

  const vert = (p, nn, pal) => { S.position.push(p.x, p.y, p.z); S.normal.push(nn.x, nn.y, nn.z); S.data.push(pal); S.fx.push(...fx); return S.position.length / 3 - 1; };
  const kit = {
    rand,
    /** A palette: light, half-tone, shade. Returns its number. */
    pal(L, M, Sh) { pals.push([L, M, Sh]); return pals.length - 1; },
    /** What is added from here on: sway (0..1), glow (0, 1, 2), lie (0, 1), w (anything, for warp; 10 + n picks brush mark n). */
    fx(sway = 0, glow = 0, lie = 0, w = 0) { fx = [sway, glow, lie, w]; return kit; },
    /** One stroke: where, the way it runs, the way its surface faces, palette, across, along. */
    dab(p, dir, nrm, pal, across, along) {
      D.pos.push(p.x, p.y, p.z); D.dir.push(dir.x, dir.y, dir.z); D.nrm.push(nrm.x, nrm.y, nrm.z);
      D.data.push(rand() * 1000, across, along, pal); D.fx.push(...fx);
    },
    /** A pipe through pts with radii; strokes run along it ('along') or round it ('round'). */
    tube(pts, radii, pal, { sides = 7, dabs = 0, size = [0.1, 0.3], grain = 'along', solid = true, dabPal = pal, spread = 0.25 } = {}) {
      const frames = [];
      let ref = V(1, 0, 0.3).normalize();
      for (let i = 0; i < pts.length; i++) {
        t.copy(pts[Math.min(i + 1, pts.length - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
        if (Math.abs(ref.dot(t)) > 0.95) ref = V(0, 0.3, 1).normalize();
        const nn = ref.clone().addScaledVector(t, -ref.dot(t)).normalize();
        ref = nn.clone();
        frames.push({ t: t.clone(), n: nn, b: V().crossVectors(t, nn) });
      }
      if (solid) {
        const base = S.position.length / 3;
        for (let i = 0; i < pts.length; i++) {
          const f = frames[i];
          for (let s = 0; s < sides; s++) {
            const an = (s / sides) * Math.PI * 2;
            n.copy(f.n).multiplyScalar(Math.cos(an)).addScaledVector(f.b, Math.sin(an));
            vert(a.copy(pts[i]).addScaledVector(n, radii[i]), n, pal);
          }
        }
        for (let i = 0; i < pts.length - 1; i++) {
          for (let s = 0; s < sides; s++) {
            const p0 = base + i * sides + s, p1 = base + i * sides + ((s + 1) % sides);
            S.index.push(p0, p1, p0 + sides, p1, p1 + sides, p0 + sides);
          }
        }
      }
      for (let k = 0; k < dabs; k++) {
        const u = rand() * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), w = u - i, an = rand() * Math.PI * 2;
        const f = frames[i], r = radii[i] + (radii[i + 1] - radii[i]) * w;
        n.copy(f.n).multiplyScalar(Math.cos(an)).addScaledVector(f.b, Math.sin(an));
        a.lerpVectors(pts[i], pts[i + 1], w).addScaledVector(n, r);
        b.copy(grain === 'round' ? c.crossVectors(f.t, n) : f.t).add(c.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(spread));
        kit.dab(a, b, n, typeof dabPal === 'function' ? dabPal() : dabPal, size[0] * (0.8 + 0.4 * rand()), size[1] * (0.75 + 0.5 * rand()));
      }
    },
    /** A ball (or egg) of radii r at c; strokes run round it ('round'), up it ('up'), down ('down') or stand out of it ('out'). */
    ball(cn, r, pal, { dabs = 0, size = [0.1, 0.3], grain = 'round', solid = true, quat = null, dabPal = pal, spread = 0.35, segs = [10, 7], upper = -1, reach = 1 } = {}) {
      const rr = Array.isArray(r) ? r : [r, r, r];
      const place = (dir, out, nOut) => {
        out.set(dir.x * rr[0], dir.y * rr[1], dir.z * rr[2]);
        nOut.set(dir.x / rr[0], dir.y / rr[1], dir.z / rr[2]).normalize();
        if (quat) { out.applyQuaternion(quat); nOut.applyQuaternion(quat); }
        out.add(cn);
      };
      if (solid) {
        const [W, H] = segs, base = S.position.length / 3;
        for (let j = 0; j <= H; j++) {
          const ph = (j / H) * Math.PI;
          for (let i = 0; i <= W; i++) {
            const th = (i / W) * Math.PI * 2;
            place(t.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)), a, n);
            vert(a, n, pal);
          }
        }
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const p0 = base + j * (W + 1) + i; S.index.push(p0, p0 + 1, p0 + W + 1, p0 + 1, p0 + W + 2, p0 + W + 1); }
      }
      for (let k = 0; k < dabs; k++) {
        const y = upper + (1 - upper) * rand(), an = rand() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - y * y));
        place(t.set(Math.cos(an) * s, y, Math.sin(an) * s), a, n);
        if (grain === 'out') { b.copy(n); a.sub(cn).multiplyScalar(reach).add(cn); }
        else if (grain === 'round') b.crossVectors(UP, n);
        else b.copy(UP).addScaledVector(n, -n.y).multiplyScalar(grain === 'down' ? -1 : 1);
        if (b.lengthSq() < 1e-4) b.set(1, 0, 0);
        b.normalize().add(c.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(spread));
        kit.dab(a, b, n, typeof dabPal === 'function' ? dabPal() : dabPal, size[0] * (0.8 + 0.4 * rand()), size[1] * (0.75 + 0.5 * rand()));
      }
    },
    /** A box of half-sizes h at c, turned yaw about the upright; strokes run up its sides ('up') or along them ('level'). */
    box(cn, h, pal, { yaw = 0, dabs = 0, size = [0.2, 0.6], grain = 'up', solid = true, dabPal = pal, spread = 0.15, top = true } = {}) {
      const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
      const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const areas = faces.map((f) => 4 * (f[0] ? h[1] * h[2] : f[1] ? h[0] * h[2] : h[0] * h[1]) * (f[1] && !top ? 0 : 1));
      const total = areas.reduce((s, x) => s + x, 0);
      const point = (f, u, v, out) => {
        // u, v in -1..1 across the face
        if (f[0]) out.set(f[0] * h[0], v * h[1], u * h[2]); else if (f[1]) out.set(u * h[0], f[1] * h[1], v * h[2]); else out.set(u * h[0], v * h[1], f[2] * h[2]);
        return out.applyQuaternion(q).add(cn);
      };
      if (solid) {
        for (const f of faces) {
          n.set(...f).applyQuaternion(q);
          const i0 = vert(point(f, -1, -1, a), n, pal), i1 = vert(point(f, 1, -1, a), n, pal), i2 = vert(point(f, 1, 1, a), n, pal), i3 = vert(point(f, -1, 1, a), n, pal);
          S.index.push(i0, i1, i2, i0, i2, i3);
        }
      }
      for (let k = 0; k < dabs; k++) {
        let pick = rand() * total, fi = 0;
        while (fi < 5 && pick > areas[fi]) { pick -= areas[fi]; fi++; }
        const f = faces[fi];
        point(f, rand() * 2 - 1, rand() * 2 - 1, a);
        n.set(...f).applyQuaternion(q);
        b.set(f[1] || grain === 'level' ? 1 : 0, f[1] || grain === 'level' ? 0 : 1, 0);
        if (grain === 'level' && f[0]) b.set(0, 0, 1);
        b.applyQuaternion(q).add(c.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(spread));
        kit.dab(a, b, n, typeof dabPal === 'function' ? dabPal() : dabPal, size[0] * (0.8 + 0.4 * rand()), size[1] * (0.75 + 0.5 * rand()));
      }
    },
    /** A turned shape: profile [[radius, height], ...] spun about the upright through c. */
    lathe(cn, profile, pal, { sides = 12, dabs = 0, size = [0.2, 0.6], grain = 'up', solid = true, dabPal = pal, spread = 0.2 } = {}) {
      const slope = (i) => {
        const p0 = profile[Math.max(0, i - 1)], p1 = profile[Math.min(profile.length - 1, i + 1)];
        const dr = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dr, dy) || 1;
        return [dy / l, -dr / l]; // the outward normal, in (radial, up)
      };
      if (solid) {
        const base = S.position.length / 3;
        for (let i = 0; i < profile.length; i++) {
          const [nr, ny] = slope(i);
          for (let s = 0; s <= sides; s++) {
            const an = (s / sides) * Math.PI * 2;
            vert(a.set(Math.cos(an) * profile[i][0], profile[i][1], Math.sin(an) * profile[i][0]).add(cn), n.set(Math.cos(an) * nr, ny, Math.sin(an) * nr), pal);
          }
        }
        for (let i = 0; i < profile.length - 1; i++) for (let s = 0; s < sides; s++) { const p0 = base + i * (sides + 1) + s; S.index.push(p0, p0 + sides + 1, p0 + 1, p0 + 1, p0 + sides + 1, p0 + sides + 2); }
      }
      for (let k = 0; k < dabs; k++) {
        const u = rand() * (profile.length - 1), i = Math.min(profile.length - 2, Math.floor(u)), w = u - i, an = rand() * Math.PI * 2;
        const r = profile[i][0] + (profile[i + 1][0] - profile[i][0]) * w, y = profile[i][1] + (profile[i + 1][1] - profile[i][1]) * w;
        const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1], l = Math.hypot(dr, dy) || 1;
        a.set(Math.cos(an) * r, y, Math.sin(an) * r).add(cn);
        n.set(Math.cos(an) * dy / l, -dr / l, Math.sin(an) * dy / l);
        if (grain === 'round') b.set(-Math.sin(an), 0, Math.cos(an)); else b.set(Math.cos(an) * dr / l, dy / l, Math.sin(an) * dr / l);
        b.add(c.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(spread));
        kit.dab(a, b, n, typeof dabPal === 'function' ? dabPal() : dabPal, size[0] * (0.8 + 0.4 * rand()), size[1] * (0.75 + 0.5 * rand()));
      }
    },
    get dabCount() { return D.data.length / 4; },

    build() {
      const group = new THREE.Group();
      const count = pals.length || 1;
      const arr = (name, k) => `const vec3 ${name}[${count}] = vec3[${count}](${(pals.length ? pals : [[[1, 1, 1], [0.5, 0.5, 0.5], [0.2, 0.2, 0.2]]]).map((p) => `vec3(${p[k].map((x) => x.toFixed(3)).join(', ')})`).join(', ')});`;
      const PALS = `${arr('K_L', 0)}\n${arr('K_M', 1)}\n${arr('K_S', 2)}`;
      const WARP = `uniform float uShow; uniform vec3 uTintK; ${decl}\n${warp || 'void warp(inout vec3 p, inout vec3 n, inout vec3 d, vec4 fx) {}'}`;
      const U = { uModel: { value: new THREE.Matrix4() }, uShow: { value: 1 }, uTintK: { value: new THREE.Color(1, 1, 1) }, uSizeK: { value: 1 }, ...uniforms };
      let solid = null, strokes = null;
      if (S.index.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(S.position, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(S.normal, 3));
        g.setAttribute('aPal', new THREE.Float32BufferAttribute(S.data, 1));
        g.setAttribute('aFx', new THREE.Float32BufferAttribute(S.fx, 4));
        g.setIndex(S.index);
        solid = new THREE.Mesh(g, new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms: { ...shared, ...U },
          side: THREE.DoubleSide,
          vertexShader: /* glsl */ `
            ${COMMON}
            ${WARP}
            in float aPal; in vec4 aFx;
            out vec3 vWorld; out vec3 vN; out vec3 vBind; out float vPal; out float vGlow;
            void main() {
              vec3 lp = position, ln = normal, ld = vec3(0.0, 1.0, 0.0);
              warp(lp, ln, ld, aFx);
              vec4 w = modelMatrix * vec4(lp, 1.0);
              vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * ln); vBind = position; vPal = aPal; vGlow = aFx.y;
              gl_Position = projectionMatrix * viewMatrix * w;
            }`,
          fragmentShader: /* glsl */ `
            ${COMMON}
            uniform float uShow; uniform vec3 uTintK;
            ${PALS}
            in vec3 vWorld; in vec3 vN; in vec3 vBind; in float vPal; in float vGlow;
            layout(location = 0) out vec4 outC;
            void main() {
              // a thing that is going is eaten away in patches, like paint scraped off
              if (uShow < texture(tNoise, gl_FragCoord.xy / 90.0).r * 0.98 + 0.01) discard;
              vec3 Nn = normalize(vN);
              if (!gl_FrontFacing) Nn = -Nn;
              int k = int(vPal + 0.5);
              float g = texture(tNoise, vBind.xy * 0.7 + vBind.z * 0.9).r, m = texture(tNoise, vBind.zy * 0.23 + 0.4).g;
              float lit = vGlow > 0.5 ? 1.0 : sunAt(vWorld + Nn * 0.3) * clamp(dot(Nn, uSunDir) * 0.9 + 0.45, 0.0, 1.0);
              vec3 c = paint3(K_L[k], K_M[k], K_S[k], lit, g) * (0.86 + 0.2 * m) * uTintK;
              outC = vec4(vGlow > 1.5 ? c : hazed(c, vWorld), 1.0);
            }`,
        }));
        solid.frustumCulled = false;
        solid.matrixAutoUpdate = false;
        if (!additive) group.add(solid);
      }
      const nd = D.data.length / 4;
      if (nd) {
        const geometry = dabGeometry(nd, { aPos: [new Float32Array(D.pos), 3], aDir: [new Float32Array(D.dir), 3], aNrm: [new Float32Array(D.nrm), 3], aData: [new Float32Array(D.data), 4], aFx: [new Float32Array(D.fx), 4] });
        strokes = dabMesh(geometry, dabMaterial(shared, {
          head: `in vec3 aPos; in vec3 aDir; in vec3 aNrm; in vec4 aData; in vec4 aFx; uniform mat4 uModel; uniform float uSizeK;\n${WARP}\n${PALS}`,
          body: /* glsl */ `
            void makeDab(inout Dab d) {
              d.alive = uShow;
              if (uShow <= 0.004) { d.alive = 0.0; return; }
              vec4 r = hash4(aData.x);
              vec3 lp = aPos, ln = aNrm, ld = aDir;
              warp(lp, ln, ld, aFx);
              vec3 P = (uModel * vec4(lp, 1.0)).xyz;
              vec3 Nn = normalize(mat3(uModel) * ln);
              if (aFx.x > 0.0) {
                float g = gustAt(P.xz);
                P.xz += uWind.xy * (g * 0.5 + sin(uTime * (1.1 + r.x) + r.y * 30.0) * (0.05 + 0.16 * g)) * aFx.x;
                P.y += sin(uTime * (1.7 + r.z) + r.w * 30.0) * (0.03 + 0.08 * g) * aFx.x;
              }
              int k = int(aData.w + 0.5);
              float lit = aFx.y > 0.5 ? 1.0 : sunAt(P + Nn * 0.5) * clamp(dot(Nn, uSunDir) * 0.9 + 0.45, 0.0, 1.0);
              vec3 c = jitter(paint3(K_L[k], K_M[k], K_S[k], lit, r.x), r.yzw, ${jitter.toFixed(2)}) * uTintK;
              d.pos = P;
              d.dir = mat3(uModel) * ld;
              d.size = aData.yz * (0.85 + 0.3 * r.y) * uSizeK;
              bool bare = aFx.y > 1.5;
              d.c1 = bare ? c : hazed(c, P);
              d.c2 = bare ? c * 1.12 : hazed(jitter(c * 1.18, r.wxy, ${jitter.toFixed(2)}), P);
              d.seed = aData.x;
              d.lift = ${lift.toFixed(2)};
              d.turnabout = 1.0;
              if (aFx.w > 9.5) d.cell = aFx.w - 10.0;
              if (aFx.z > 0.5) { d.lie = 1.0; d.nrm = Nn; d.height = 0.04 + 0.05 * r.z; }
            }`,
          uniforms: U, minPx, maxPx, cells, depthWrite: !additive,
        }), order);
        if (additive) { strokes.material.blending = THREE.AdditiveBlending; strokes.material.alphaToCoverage = false; }
        group.add(strokes);
      }
      const thing = {
        group, solid, strokes, uniforms: U, dabs: nd,
        /** Moves the whole thing: m is a Matrix4; k is how much larger it makes it (for the strokes' size). */
        setMatrix(m, k = 1) {
          U.uModel.value.copy(m); U.uSizeK.value = k;
          if (solid) { solid.matrix.copy(m); solid.matrixWorldNeedsUpdate = true; }
        },
        /** 0 gone .. 1 whole. */
        show(v) { U.uShow.value = v; group.visible = v > 0.004; },
        /** The same shape for the sun to see, so that it throws shade. Only for things that keep still. */
        caster() {
          if (!solid) return null;
          const m = new THREE.Mesh(solid.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
          m.frustumCulled = false; m.matrixAutoUpdate = false; m.matrix.copy(U.uModel.value);
          return m;
        },
      };
      return thing;
    },
  };
  return kit;
}
