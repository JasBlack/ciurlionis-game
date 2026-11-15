// "Paper Bag": a crumpled kraft bag over the head with a drawn face that blinks, frowns and talks.
import * as THREE from 'three';
import { rng } from './geom.js';

const SIZE = [21, 29, 25];
const CENTRE = [0, 0.4, -2.6];

let cache = null;
function assets() {
  if (cache) return cache;
  const rand = rng(7);
  const box = new THREE.BoxGeometry(...SIZE, 7, 9, 8);
  const p = box.attributes.position;
  // crumple: nudge every vertex a little, the same way wherever faces share a corner
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    let d = seen.get(key);
    if (!d) { d = [(rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9]; seen.set(key, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  box.translate(...CENTRE);
  box.computeVertexNormals();
  cache = {
    box,
    disc: new THREE.CircleGeometry(1, 28),
    bar: new THREE.PlaneGeometry(1, 1),
    paper: new THREE.MeshStandardMaterial({ color: 0xb98f5c, roughness: 0.92, metalness: 0, flatShading: true }),
    ink: new THREE.MeshBasicMaterial({ color: 0x1c1410 }),
  };
  return cache;
}

function create() {
  const a = assets();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(a.box, a.paper));
  const z = CENTRE[2] + SIZE[2] / 2 + 0.55;
  const eyes = [-1, 1].map((sgn) => {
    const m = new THREE.Mesh(a.disc, a.ink);
    m.position.set(sgn * 4.2, 3.2, z);
    root.add(m);
    return m;
  });
  const brows = [-1, 1].map((sgn) => {
    const m = new THREE.Mesh(a.bar, a.ink);
    m.position.set(sgn * 4.2, 6.6, z);
    m.scale.set(4.6, 0.7, 1);
    root.add(m);
    return m;
  });
  const mouth = new THREE.Mesh(a.disc, a.ink);
  mouth.position.set(0, -4.8, z);
  root.add(mouth);

  function update({ blend }) {
    const g = (n) => blend[n] ?? 0;
    eyes.forEach((m, i) => {
      const side = i ? 'Left' : 'Right';
      m.scale.set(1.5, Math.max(0.14, 1.9 * (1 - g(`eyeBlink${side}`)) * (1 + 0.3 * g(`eyeWide${side}`))), 1);
    });
    brows.forEach((m, i) => {
      const side = i ? 'Left' : 'Right', sgn = i ? 1 : -1;
      m.rotation.z = sgn * (0.38 * g(`browDown${side}`) - 0.3 * g('browInnerUp'));
      m.position.y = 6.6 - 0.9 * g(`browDown${side}`) + 1.1 * g(`browOuterUp${side}`);
    });
    const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) / 2;
    mouth.scale.set(2.6 + 1.4 * smile - 1.1 * g('mouthPucker'), 0.28 + 3 * g('jawOpen'), 1);
  }
  update({ blend: {} });
  return { object: root, update, dispose() {} };
}

export const bag = {
  id: 'bag',
  name: 'Paper Bag',
  note: 'Drawn face that blinks and talks',
  swatch: ['#b98f5c', '#1c1410', '#b98f5c'],
  create,
};
