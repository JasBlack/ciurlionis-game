// The finish. The block finishes its picture as oil on canvas, varnished; this is its finish redone for tempera, as
// Čiurlionis worked: matte, the brightest passages rolled off, the darks chalky and never black. No grain is laid
// over the picture (the strokes are its surface) unless uCanvas asks for it. uWash is how one painting gives way to
// the next: light opens from the middle of the picture, as if he had stepped into the ring, until nothing else is left.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';

// The picture is painted at `scale` of the screen's pixels into a picture of its own, and that is laid over the
// whole screen. Making it smaller (to keep the frames coming on a slow machine) never touches the screen's own
// canvas: a canvas that is resized is wiped, and the wiped canvas would be shown for a frame, black.
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
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      // the tooth of the board: a fine, uneven grain, not a weave
      float tooth(vec2 p) {
        return texture(tNoise, p / 23.0).r * 0.55 + texture(tNoise, p / 7.0 + 0.37).g * 0.45;
      }

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        vec2 px = vUv * uSize;
        float k = uSize.y / 1080.0;
        float t = tooth(px / k);
        if (uCanvas > 0.0) {
          float dx = tooth((px + vec2(1.0, 0.0)) / k) - t, dy = tooth((px + vec2(0.0, 1.0)) / k) - t;
          col *= 1.0 + ((0.6 * dx - 0.8 * dy) * 0.55 + (t - 0.5) * 0.07) * uCanvas;
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
    },
    render(world, camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(world, camera);
      renderer.setRenderTarget(null);
      renderer.render(scene, flat);
    },
  };
  return frame;
}
