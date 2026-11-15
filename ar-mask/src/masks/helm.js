// "Chrome Helm": a closed mirror helmet. The simplest full cover: one shell, a dark visor, and two rows of lights
// that blink and speak with the wearer.
import * as THREE from 'three';

const C = [0, 1.6, -2.4];
const R = [10.3, 13.2, 12.3];

let cache = null;
function assets() {
  if (cache) return cache;
  const shell = new THREE.SphereGeometry(1, 48, 36);
  shell.scale(...R).translate(...C);
  // neck guard: a short flared collar under the shell
  const collar = new THREE.CylinderGeometry(8.6, 9.8, 8, 40, 1, true);
  collar.translate(C[0], -11.5, C[2] + 0.8);
  // visor: a band of the sphere across the eyes, just proud of the shell
  const visor = new THREE.SphereGeometry(1.012, 40, 12, (90 - 78) * Math.PI / 180, 156 * Math.PI / 180, 62 * Math.PI / 180, 34 * Math.PI / 180);
  visor.scale(...R).translate(...C);
  cache = {
    shell, collar, visor,
    bar: new THREE.BoxGeometry(1, 1, 0.3),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd6daea, metalness: 1, roughness: 0.1, envMapIntensity: 1.3, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x07070d, metalness: 0.7, roughness: 0.06, clearcoat: 1 }),
    eyeLight: new THREE.MeshBasicMaterial({ color: 0x8ff6ff }),
    voice: new THREE.MeshBasicMaterial({ color: 0xff8ad8 }),
  };
  return cache;
}

function frontZ(x, y, lift) {
  const k = 1 - (x / R[0]) ** 2 - ((y - C[1]) / R[1]) ** 2;
  return C[2] + R[2] * Math.sqrt(Math.max(k, 0.001)) + lift;
}

function create() {
  const a = assets();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(a.shell, a.chrome), new THREE.Mesh(a.collar, a.chrome), new THREE.Mesh(a.visor, a.glass));
  const eyes = [-1, 1].map((sgn) => {
    const m = new THREE.Mesh(a.bar, a.eyeLight);
    m.position.set(sgn * 3.6, 3.1, frontZ(sgn * 3.6, 3.1, 0.3));
    m.rotation.y = sgn * 0.33;
    root.add(m);
    return m;
  });
  const bars = [];
  for (let i = -3; i <= 3; i++) {
    const m = new THREE.Mesh(a.bar, a.voice);
    m.position.set(i * 0.95, -4.4, frontZ(i * 0.95, -4.4, 0.2));
    root.add(m);
    bars.push(m);
  }
  function update({ time, blend }) {
    const open = blend.jawOpen ?? 0;
    eyes.forEach((m, i) => {
      const blink = blend[i ? 'eyeBlinkLeft' : 'eyeBlinkRight'] ?? 0;
      m.scale.set(3.2, Math.max(0.12, 0.9 * (1 - blink)), 1);
    });
    bars.forEach((m, i) => {
      const wave = 0.5 + 0.5 * Math.sin(time * 9 + i * 1.3);
      m.scale.set(0.5, 0.25 + open * (1.2 + 2.6 * wave) * (1 - Math.abs(i - 3) / 5), 1);
    });
  }
  update({ time: 0, blend: {} });
  return { object: root, update, dispose() {} };
}

export const helm = {
  id: 'helm',
  name: 'Chrome Helm',
  note: 'Closed mirror helmet',
  swatch: ['#d6daea', '#07070d', '#8ff6ff'],
  create,
};
