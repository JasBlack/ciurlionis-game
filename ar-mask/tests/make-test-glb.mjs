// Writes a small test mask: an egg-shaped head with dark eyes and a red mouth painted on, and three ARKit-named
// shape keys (jawOpen, eyeBlink_L, eyeBlink_R). Used to test .glb import, expression mapping and fit by points.
//   node tests/make-test-glb.mjs out.glb
import { writeFile } from 'node:fs/promises';

const W = 48, H = 32;
const pos = [], nor = [], col = [], idx = [], jaw = [], blinkL = [], blinkR = [];
const R = [0.085, 0.115, 0.1]; // metres, as glTF expects
const eyes = [[-0.032, 0.02], [0.032, 0.02]];
for (let j = 0; j <= H; j++) {
  const v = j / H, phi = v * Math.PI;
  for (let i = 0; i <= W; i++) {
    const u = i / W, th = u * Math.PI * 2;
    const n = [Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th)];
    const p = [n[0] * R[0], n[1] * R[1], n[2] * R[2]];
    pos.push(...p);
    const nl = Math.hypot(n[0] / R[0], n[1] / R[1], n[2] / R[2]);
    nor.push(n[0] / R[0] / nl, n[1] / R[1] / nl, n[2] / R[2] / nl);
    const front = p[2] > 0;
    const dEye = eyes.map(([ex, ey]) => Math.hypot(p[0] - ex, p[1] - ey));
    const mouth = front && Math.abs(p[0]) < 0.03 && Math.abs(p[1] + 0.05) < 0.008;
    if (front && Math.min(...dEye) < 0.014) col.push(0.02, 0.02, 0.05);
    else if (mouth) col.push(0.8, 0.1, 0.15);
    else col.push(0.35, 0.75, 0.6);
    jaw.push(0, p[1] < -0.04 ? -0.035 * Math.min(1, (-0.04 - p[1]) / 0.03) : 0, 0);
    blinkR.push(0, front && dEye[0] < 0.02 ? -0.012 : 0, 0); // the wearer's right eye is at -x
    blinkL.push(0, front && dEye[1] < 0.02 ? -0.012 : 0, 0);
  }
}
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const a = j * (W + 1) + i, b = a + W + 1;
  idx.push(a, b, a + 1, b, b + 1, a + 1);
}

const chunks = [], views = [], accessors = [];
let offset = 0;
function add(arr, Type, type, componentType, target, minmax) {
  const buf = Buffer.from(new Type(arr).buffer);
  const pad = (4 - (buf.length % 4)) % 4;
  views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
  chunks.push(buf, Buffer.alloc(pad));
  offset += buf.length + pad;
  const n = type === 'SCALAR' ? 1 : 3;
  const acc = { bufferView: views.length - 1, componentType, count: arr.length / n, type };
  if (minmax) {
    acc.min = [0, 1, 2].map((k) => Math.min(...arr.filter((_, q) => q % 3 === k)));
    acc.max = [0, 1, 2].map((k) => Math.max(...arr.filter((_, q) => q % 3 === k)));
  }
  accessors.push(acc);
  return accessors.length - 1;
}
const aPos = add(pos, Float32Array, 'VEC3', 5126, 34962, true);
const aNor = add(nor, Float32Array, 'VEC3', 5126, 34962);
const aCol = add(col, Float32Array, 'VEC3', 5126, 34962);
const aIdx = add(idx, Uint16Array, 'SCALAR', 5123, 34963);
const targets = [jaw, blinkL, blinkR].map((t) => ({ POSITION: add(t, Float32Array, 'VEC3', 5126, 34962, true) }));
const bin = Buffer.concat(chunks);

const json = {
  asset: { version: '2.0', generator: 'mask-layer test' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'TestHead' }],
  meshes: [{
    name: 'TestHead',
    primitives: [{ attributes: { POSITION: aPos, NORMAL: aNor, COLOR_0: aCol }, indices: aIdx, material: 0, targets }],
    weights: [0, 0, 0],
    extras: { targetNames: ['jawOpen', 'eyeBlink_L', 'eyeBlink_R'] },
  }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
  buffers: [{ byteLength: bin.length }], bufferViews: views, accessors,
};
let jb = Buffer.from(JSON.stringify(json));
jb = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
await writeFile(process.argv[2] ?? 'test-head.glb', Buffer.concat([head, jh, jb, bh, bin]));
console.log('wrote', process.argv[2] ?? 'test-head.glb');
