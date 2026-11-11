// The card. The block finishes its picture as oil on canvas, varnished; this is its finish redone for tempera on
// card, as Čiurlionis worked: matte, the darks chalky and never black, the tooth of the board under thin paint,
// and the bare card left round the edge where the brush stopped. uWash lets the card come back through the
// paint, in patches, until nothing else is left: it is how one part of the journey gives way to another.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';

export function createFrame(renderer, shared, { samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
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

        vec3 card = vec3(0.905, 0.85, 0.725) * (0.96 + 0.08 * t);
        // the bare card round the edge
        vec2 e = min(vUv, 1.0 - vUv) * uSize / k;
        float rag = texture(tNoise, px / (260.0 * k)).r * 26.0 + texture(tNoise, px / (41.0 * k) + 0.2).g * 10.0;
        float bare = uBorder > 0.0 ? 1.0 - smoothstep(0.0, 5.0, min(e.x, e.y) - (7.0 + rag) * uBorder) : 0.0;
        // and the card coming back through the paint
        float n = texture(tNoise, px / (460.0 * k)).a * 0.6 + texture(tNoise, px / (67.0 * k)).r * 0.4;
        float gone = smoothstep(n - 0.12, n + 0.12, uWash * 1.3 - 0.15);
        col = mix(col, card, max(bare * 0.94, gone));
        outC = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const flat = new THREE.Camera();

  return {
    target,
    uniforms,
    resize() {
      renderer.getDrawingBufferSize(size);
      target.setSize(size.x, size.y);
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
}
