// The finish. The block finishes its picture as oil on canvas, varnished; this is its finish redone for tempera, as
// Čiurlionis worked: matte, the brightest passages rolled off, the darks chalky and never black. No grain is laid
// over the picture (the strokes are its surface) unless uCanvas asks for it. uStyle chooses among finishes after
// his media (card, tempera, pastel, watercolour, his luminous haze, a brushed canvas), for comparing. uWash is how one painting gives way to
// the next: light opens from the middle of the picture, as if he had stepped into the ring, until nothing else is left.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';

// The picture is painted at `scale` of the screen's pixels into a picture of its own, and that is laid over the
// whole screen. Making it smaller (to keep the frames coming on a slow machine) never touches the screen's own
// canvas: a canvas that is resized is wiped, and the wiped canvas would be shown for a frame, black.
/** The finishes, by number (uStyle). */
export const STYLES = ['Plain', 'Card', 'Tempera', 'Pastel', 'Watercolour', 'Haze', 'Brushed'];

export function createFrame(renderer, shared, { samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const inner = size.clone();
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { samples, depthBuffer: true, generateMipmaps: false });
  target.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;

  const uniforms = {
    ...shared,
    tColor: { value: target.texture },
    uCanvas: { value: 1 },
    uBorder: { value: 1 },
    uWash: { value: 0 },
    uSize: { value: size.clone() },
    uInner: { value: size.clone() },
    uStyle: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D tColor;
      uniform float uCanvas;
      uniform float uBorder;
      uniform float uWash;
      uniform vec2 uSize;
      uniform vec2 uInner;  // the size the picture was painted at
      uniform float uStyle; // which finish: 0 plain, 1 card, 2 tempera, 3 pastel, 4 watercolour, 5 haze, 6 brushed
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      // the tooth of the board: a fine, uneven grain, not a weave
      float tooth(vec2 p) {
        return texture(tNoise, p / 23.0).r * 0.55 + texture(tNoise, p / 7.0 + 0.37).g * 0.45;
      }
      // laid paper for pastel: a coarser tooth, its fibres running mostly one way
      float paper(vec2 p) {
        return texture(tNoise, p * vec2(1.0, 0.55) / 9.0).b * 0.5 + texture(tNoise, p / 3.6 + 0.21).r * 0.3 + texture(tNoise, p / 41.0).g * 0.2;
      }
      vec3 tc(vec2 uv) { return texture(tColor, uv).rgb; }
      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      // a soft ring of samples r painted pixels out (n of them), for washes and glows
      vec3 ring(vec2 uv, float r, float turn) {
        vec2 t = r / uInner;
        vec3 a = vec3(0.0);
        for (int i = 0; i < 8; i++) { float an = (float(i) + turn) * 0.7854; a += tc(uv + vec2(cos(an), sin(an)) * t); }
        return a / 8.0;
      }
      // Kuwahara: of the four quarters round a point, the colour of the one that varies least. Flat passages stay
      // flat and edges stay sharp, as where a loaded brush has laid one colour beside another
      vec3 kuwahara(vec2 uv, float r) {
        vec2 t = r / uInner;
        vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0), s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
        for (int j = -3; j <= 3; j++) {
          for (int i = -3; i <= 3; i++) {
            vec3 c = tc(uv + vec2(float(i), float(j)) * t), c2 = c * c;
            if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
            if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
            if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
            if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
          }
        }
        m0 /= 16.0; m1 /= 16.0; m2 /= 16.0; m3 /= 16.0;
        vec3 v0 = abs(s0 / 16.0 - m0 * m0), v1 = abs(s1 / 16.0 - m1 * m1), v2 = abs(s2 / 16.0 - m2 * m2), v3 = abs(s3 / 16.0 - m3 * m3);
        float a0 = v0.r + v0.g + v0.b, a1 = v1.r + v1.g + v1.b, a2 = v2.r + v2.g + v2.b, a3 = v3.r + v3.g + v3.b;
        vec3 best = m0; float bv = a0;
        if (a1 < bv) { bv = a1; best = m1; }
        if (a2 < bv) { bv = a2; best = m2; }
        if (a3 < bv) { best = m3; }
        return best;
      }
      // a stroke laid along the way the picture's edges run (across flat passages, the way of a slow hand)
      vec3 brushed(vec2 uv, vec2 px, float k) {
        vec2 t = 1.0 / uInner;
        float l00 = luma(tc(uv + t * vec2(-1.5, -1.5))), l10 = luma(tc(uv + t * vec2(0.0, -1.5))), l20 = luma(tc(uv + t * vec2(1.5, -1.5)));
        float l01 = luma(tc(uv + t * vec2(-1.5, 0.0))), l21 = luma(tc(uv + t * vec2(1.5, 0.0)));
        float l02 = luma(tc(uv + t * vec2(-1.5, 1.5))), l12 = luma(tc(uv + t * vec2(0.0, 1.5))), l22 = luma(tc(uv + t * vec2(1.5, 1.5)));
        vec2 g = vec2(l20 + 2.0 * l21 + l22 - l00 - 2.0 * l01 - l02, l02 + 2.0 * l12 + l22 - l00 - 2.0 * l10 - l20);
        float a = (texture(tNoise, px / (310.0 * k)).r * 1.4 + texture(tNoise, px / (90.0 * k)).g * 0.4) * 6.2832;
        vec2 dir = normalize(mix(vec2(cos(a), sin(a)), normalize(vec2(-g.y, g.x) + 1e-5), smoothstep(0.03, 0.2, length(g))));
        vec3 acc = vec3(0.0); float w = 0.0;
        for (int i = -7; i <= 7; i++) { float fi = float(i), wi = 1.0 - abs(fi) / 8.0; acc += tc(uv + dir * t * fi * 1.7) * wi; w += wi; }
        // and the bristles: fine streaks running the way the stroke runs
        vec2 sp = px / k, sd = vec2(dir.x, -dir.y);
        float bristle = texture(tNoise, vec2(dot(sp, sd) / 46.0, dot(sp, vec2(-sd.y, sd.x)) / 2.2)).r;
        return acc / w * (0.93 + 0.14 * bristle);
      }

      void main() {
        int st = int(uStyle + 0.5);
        vec2 px = vUv * uSize;
        float k = uSize.y / 1080.0;
        float t = tooth(px / k);
        vec3 col;
        float grain = uCanvas;
        if (st == 2) {
          // tempera: each passage laid flat with a loaded brush, on the board's tooth
          col = kuwahara(vUv, 1.0);
          grain = max(grain, 0.7);
        } else if (st == 3) {
          // pastel: soft chalk on laid paper, which shows through in the pits of its tooth
          col = mix(tc(vUv), ring(vUv, 1.2, 0.5), 0.55);
          float p = paper(px / k), skip = smoothstep(0.56, 0.3, p + (luma(col) - 0.5) * 0.3);
          col = mix(col, vec3(0.93, 0.89, 0.8), skip * 0.36);
          col = col * 0.93 + 0.05;
        } else if (st == 4) {
          // watercolour: thin washes that bleed a little into each other, the pigment gathering at their edges and
          // settling in the paper's grain
          vec3 c = tc(vUv), b = ring(vUv, 1.6, 0.0), bb = ring(vUv, 4.5, 0.5);
          col = mix(b, c, 0.55);
          float edge = clamp(length(c - bb) * 3.0, 0.0, 1.0);
          col = mix(col, col * col * 1.15, edge * 0.65);
          float gr = texture(tNoise, px / (2.6 * k)).g * 0.6 + texture(tNoise, px / (11.0 * k)).b * 0.4;
          col *= 1.0 - (gr - 0.5) * 0.24 * (1.0 - luma(col));
          col *= 0.94 + 0.12 * paper(px / k);
          col = mix(col, vec3(0.98, 0.96, 0.91), 0.12);
        } else if (st == 5) {
          // haze: his luminous mist. Soft focus, the lights blooming, the shadows gone blue-violet and the lights to
          // cream, the contrast drawn in
          vec3 c = tc(vUv), g1 = ring(vUv, 7.0, 0.0), g2 = ring(vUv, 18.0, 0.5);
          vec3 glow = (g1 + g2) * 0.5;
          col = mix(c, glow, 0.28) + max(glow - 0.62, 0.0) * 0.7;
          float L = luma(col);
          col = mix(col, col * mix(vec3(0.66, 0.68, 1.18), vec3(1.08, 1.02, 0.88), smoothstep(0.2, 0.85, L)), 0.5);
          col = mix(vec3(0.55, 0.53, 0.58), col, 0.86);
          grain = max(grain, 0.45);
        } else if (st == 6) {
          // brushed: every touch drawn out along the way the forms run, on canvas
          col = brushed(vUv, px, k);
          grain = max(grain, 0.85);
        } else {
          col = tc(vUv);
          if (st == 1) grain = max(grain, 1.0);
        }
        if (grain > 0.0) {
          float dx = tooth((px + vec2(1.0, 0.0)) / k) - t, dy = tooth((px + vec2(0.0, 1.0)) / k) - t;
          col *= 1.0 + ((0.6 * dx - 0.8 * dy) * 0.55 + (t - 0.5) * 0.07) * grain;
          // (on the card the lightest passages take a little of its warmth)
          if (st == 1) col = mix(col, col * vec3(1.02, 0.99, 0.93), smoothstep(0.55, 0.95, luma(col)));
        }
        // matte: the brightest passages roll off toward the white of the card, the darks are lifted and chalky
        vec3 over = max(col - 0.84, 0.0);
        col = min(col, 0.84) + over / (1.0 + over * 5.0);
        col = col * 0.95 + vec3(0.04, 0.036, 0.046);

        if (uBorder > 0.0) {
          // bare card round the edge, for those who ask for it
          vec3 card = vec3(0.905, 0.85, 0.725) * (0.96 + 0.08 * t);
          vec2 e = min(vUv, 1.0 - vUv) * uSize / k;
          float rag = texture(tNoise, px / (260.0 * k)).r * 26.0 + texture(tNoise, px / (41.0 * k) + 0.2).g * 10.0;
          col = mix(col, card, (1.0 - smoothstep(0.0, 5.0, min(e.x, e.y) - (7.0 + rag) * uBorder)) * 0.94);
        }
        // the light that takes the picture, from its middle outward, its edge uneven as a wash's is
        if (uWash > 0.0) {
          vec2 c = (vUv - 0.5) * vec2(uSize.x / uSize.y, 1.0);
          float n = texture(tNoise, vUv * 0.31 + 0.1).a * 0.65 + texture(tNoise, vUv * 1.3).r * 0.35;
          float gone = smoothstep(0.0, 0.5, uWash * 2.1 - (length(c) * 0.75 + n * 0.55));
          vec3 light = mix(vec3(1.0, 0.86, 0.56), vec3(1.0, 0.975, 0.9), smoothstep(0.15, 0.95, gone));
          col = mix(col, light, gone);
        }
        outC = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const flat = new THREE.Camera();

  const frame = {
    target,
    uniforms,
    /** How much of the screen's resolution the picture is painted at (0..1). */
    scale: 1,
    /** The size, in pixels, it is painted at. */
    inner,
    resize(scale = frame.scale) {
      frame.scale = scale;
      renderer.getDrawingBufferSize(size);
      inner.set(Math.max(1, Math.round(size.x * scale)), Math.max(1, Math.round(size.y * scale)));
      if (target.width !== inner.x || target.height !== inner.y) target.setSize(inner.x, inner.y);
      uniforms.uSize.value.copy(size);
      uniforms.uInner.value.copy(inner);
    },
    render(world, camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(world, camera);
      frame.present();
    },
    /** Lays the picture last painted over the screen, finished (again, if the finish has changed). */
    present() {
      renderer.setRenderTarget(null);
      renderer.render(scene, flat);
    },
  };
  return frame;
}
