// Clay study: one beast on a black table, lit like a photograph of a small thing and moved like stop motion:
// twelve poses a second, each one held, the surface handled a little between exposures.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildCreature } from './creature.js';
import { clay, whiteClay, bodyClay, tableCard } from './material.js';

const $ = (id) => document.getElementById(id);
const ask = new URLSearchParams(location.search);
const still = ask.has('still') ? Number(ask.get('still')) : null; // hold one moment, for looking closely
const plain = ask.has('plain'); // no lens, bloom or grain
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PER_SECOND = 12;

function start() {
  const canvas = $('stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: plain, powerPreference: 'high-performance' });
  } catch (e) {
    $('wait').textContent = 'This needs WebGL 2, which this browser or device is not giving the page.';
    return;
  }
  // sharp, but never more than about four million points of picture: every one of them is worked out
  const ratio = (w = innerWidth, h = innerHeight) => (ask.has('ratio') ? Number(ask.get('ratio')) : Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.2e6 / Math.max(1, w * h))));
  renderer.setPixelRatio(ratio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = softboxes(renderer);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 90);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.4;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.492;

  // ---- light: one large soft source high on the left, a cool edge from behind, very little else
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-3.2, 6.2, 4.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 22 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 5;
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(3.5, 3.2, -5);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.3);
  scene.add(key, key.target, rim, hemi);
  const WHITE = { key: new THREE.Color(1.0, 0.95, 0.88), rim: new THREE.Color(0.62, 0.72, 1.0), sky: new THREE.Color(0.55, 0.58, 0.7) };
  const UV = { key: new THREE.Color(0.5, 0.44, 1.0), rim: new THREE.Color(0.85, 0.3, 1.0), sky: new THREE.Color(0.25, 0.15, 0.7) };

  const table = new THREE.Mesh(new THREE.CircleGeometry(16, 72), tableCard());
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  // ---- the lens: a long one, close, so the far end of the beast goes soft
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setPixelRatio(ratio());
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.0035, maxblur: 0.0065 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.1, 0.7, 1);
  const grain = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTick: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTick; varying vec2 vUv;
      float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 px = gl_FragCoord.xy + uTick * vec2(37., 91.);
        float n = h(px) + h(px + 17.3) - 1.;
        float l = dot(c.rgb, vec3(.3, .6, .1));
        c.rgb += n * .028 * (1. - .6 * l);
        vec2 v = vUv - .5;
        c.rgb *= 1. - .42 * smoothstep(.25, .95, dot(v, v) * 2.4);
        gl_FragColor = c;
      }`,
  });
  if (!plain) { composer.addPass(bokeh); composer.addPass(bloom); }
  composer.addPass(new OutputPass());
  if (!plain) composer.addPass(grain);

  // ---- the beast
  const white = whiteClay(), bodyMat = bodyClay();
  const glowLights = [new THREE.PointLight(0xffffff, 0, 3.4, 1.6), new THREE.PointLight(0xffffff, 0, 3.4, 1.6)];
  let beast = null;
  const focusPoint = new THREE.Vector3(0.3, 0.8, 0);

  function shape(seed) {
    if (beast) {
      scene.remove(beast.group);
      beast.made.flesh.dispose(); beast.made.coils.dispose(); beast.made.skeleton.dispose();
    }
    const made = buildCreature(seed);
    const group = new THREE.Group();
    const flesh = new THREE.SkinnedMesh(made.flesh, bodyMat), coils = new THREE.SkinnedMesh(made.coils, white);
    group.add(made.bones[0], flesh, coils);
    group.updateMatrixWorld(true);
    for (const m of [flesh, coils]) {
      m.bind(made.skeleton, new THREE.Matrix4());
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
    }
    const root = made.bones[0];
    glowLights.forEach((l, i) => {
      l.position.set(made.glow[i][0] - root.position.x, made.glow[i][1] - root.position.y, 0);
      root.add(l);
    });
    scene.add(group);
    clay.uSeed.value = (seed * 0.6180339) % 1;
    clay.uHue.value = (made.q.hue - 0.5) * 1.5;
    clay.uLimb.value = made.q.limb;
    // the colour its glow throws on the table follows the clay's turn of hue
    const turn = (c) => c.applyAxisAngle(new THREE.Vector3(1, 1, 1).normalize(), clay.uHue.value);
    const a = turn(new THREE.Vector3(1, 0.1, 0.45)), b = turn(new THREE.Vector3(0.1, 0.3, 1));
    glowLights[0].color.setRGB(Math.max(a.x, 0), Math.max(a.y, 0), Math.max(a.z, 0));
    glowLights[1].color.setRGB(Math.max(b.x, 0), Math.max(b.y, 0), Math.max(b.z, 0));
    focusPoint.set(...made.focus);
    key.target.position.copy(focusPoint);
    beast = { group, made, seed };
    $('caption').textContent = `Beast no. ${seed} · ${made.count.pieces} coils · ${Math.round((made.flesh.index.count + made.coils.index.count) / 3000)} thousand facets`;
  }

  // ---- where the camera stands
  function stand() {
    const aspect = camera.aspect;
    const tall = aspect < 1;
    const dist = Math.min(22, Math.max(8.6, (tall ? 3.0 : 4.4) / (0.4617 * aspect)));
    const az = tall ? 1.0 : 0.5, el = 0.2;
    controls.target.copy(focusPoint);
    camera.position.set(focusPoint.x + dist * Math.sin(az) * Math.cos(el), focusPoint.y + dist * Math.sin(el), focusPoint.z + dist * Math.cos(az) * Math.cos(el));
    controls.update();
  }

  // ---- studio light or blacklight, and the way between
  let glow = ask.has('glow') ? 1 : 0, glowAim = glow;
  function relight(g) {
    const mix = THREE.MathUtils.lerp;
    clay.uGlow.value = g;
    key.color.lerpColors(WHITE.key, UV.key, g); key.intensity = mix(4.4, 1.7, g);
    rim.color.lerpColors(WHITE.rim, UV.rim, g); rim.intensity = mix(1.5, 0.7, g);
    hemi.color.lerpColors(WHITE.sky, UV.sky, g); hemi.intensity = mix(0.3, 0.14, g);
    scene.environmentIntensity = mix(0.85, 0.1, g);
    bloom.strength = mix(0.1, 0.3, g); bloom.threshold = mix(1.0, 0.72, g);
    for (const l of glowLights) l.intensity = 1.5 * g;
  }

  let dirty = true;
  function fit() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setPixelRatio(ratio(w, h));
    composer.setPixelRatio(ratio(w, h));
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const was = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    bokeh.uniforms.aspect.value = camera.aspect;
    if (Math.abs(was - camera.aspect) > 0.2 && !touched) stand();
    dirty = true;
  }

  // ---- time: held poses, or smooth, to compare
  let twos = !ask.has('smooth');
  let touched = false, idleAt = 0, heldFrame = -1, last = performance.now(), clock = 0;
  controls.addEventListener('change', () => { dirty = true; });
  controls.addEventListener('start', () => { touched = true; idleAt = Infinity; });
  controls.addEventListener('end', () => { idleAt = performance.now() + 5000; });

  function expose(t, frame, dt) {
    beast.made.pose(t, frame, twos ? 1 : 0);
    clay.uBoil.value = frame;
    clay.uBoilAmp.value = twos && !calm ? 1 : 0;
    grain.uniforms.uTick.value = frame % 64;
    if (!calm && performance.now() > idleAt - 1 && still === null) {
      // the camera creeps round on its own, a step with each exposure
      const a = 0.055 * dt;
      const p = camera.position.clone().sub(controls.target);
      p.applyAxisAngle(THREE.Object3D.DEFAULT_UP, a);
      camera.position.copy(controls.target).add(p);
    }
    dirty = true;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (still === null) clock += dt;
    const t = still ?? clock;
    const f = Math.floor(t * PER_SECOND);
    if (twos) { if (f !== heldFrame) { heldFrame = f; expose(f / PER_SECOND, f, 1 / PER_SECOND); } }
    else if (still === null || heldFrame !== f) { heldFrame = f; expose(t, f, dt); }
    if (glow !== glowAim) { glow = Math.abs(glowAim - glow) < 0.02 ? glowAim : glow + (glowAim - glow) * Math.min(1, dt * 5); relight(glow); dirty = true; }
    controls.update();
    if (!dirty) return;
    dirty = false;
    bokeh.uniforms.focus.value = camera.position.distanceTo(controls.target);
    composer.render();
    if (!study.ready) { study.ready = true; $('wait').hidden = true; }
  }

  // ---- the controls
  const reshape = (seed) => {
    $('wait').hidden = false; $('wait').textContent = 'Shaping the clay…';
    setTimeout(() => { shape(seed); if (!touched) stand(); heldFrame = -1; dirty = true; $('wait').hidden = true; }, 30);
  };
  $('reseed').addEventListener('click', () => reshape(1 + Math.floor(Math.random() * 998)));
  $('blacklight').addEventListener('change', (e) => { glowAim = e.target.checked ? 1 : 0; });
  $('twos').addEventListener('change', (e) => { twos = e.target.checked; heldFrame = -1; });
  $('prints').addEventListener('change', (e) => { clay.uPrints.value = e.target.checked ? 1 : 0; dirty = true; });
  $('blacklight').checked = glow > 0.5; $('twos').checked = twos; $('prints').checked = true;

  const study = { ready: false, shape: reshape, camera, controls, clay, redraw: () => { dirty = true; } };
  window.clayStudy = study;

  shape(ask.has('seed') ? Number(ask.get('seed')) : 44);
  relight(glow);
  fit();
  stand();
  if (ask.has('az')) { // a chosen standpoint: az and el in degrees, d the distance
    const az = (Number(ask.get('az')) * Math.PI) / 180, el = (Number(ask.get('el') ?? 12) * Math.PI) / 180, d = Number(ask.get('d') ?? 9);
    camera.position.set(focusPoint.x + d * Math.sin(az) * Math.cos(el), focusPoint.y + d * Math.sin(el), focusPoint.z + d * Math.cos(az) * Math.cos(el));
    controls.update(); touched = true; idleAt = Infinity;
  }
  new ResizeObserver(fit).observe(canvas);
  requestAnimationFrame(frame);
}

// A photographer's softboxes, as the only surroundings the clay has to reflect.
function softboxes(renderer) {
  const room = new THREE.Scene();
  const box = (w, h, color, power, at) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  box(7, 7, 0xfff0dc, 7, [-5, 7, 5]);
  box(3, 8, 0xb8ccff, 3, [8, 2, -3]);
  box(9, 2, 0xffffff, 1.2, [0, 4, -9]);
  box(14, 14, 0x16161c, 1, [0, -5, 0]);
  const pm = new THREE.PMREMGenerator(renderer);
  const texture = pm.fromScene(room, 0.035).texture;
  pm.dispose();
  return texture;
}

start();
