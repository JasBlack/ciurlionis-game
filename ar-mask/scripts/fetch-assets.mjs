// Puts everything the tracker needs next to the app, so that at run time nothing is fetched from another host:
// the MediaPipe wasm runtime (copied out of node_modules) and the two model files (downloaded once).
import { mkdir, copyFile, stat, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmFrom = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmTo = join(root, 'public/mediapipe/wasm');
const modelsTo = join(root, 'public/models');

const MODELS = {
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'pose_landmarker_lite.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};

const exists = async (p) => { try { return (await stat(p)).size > 0; } catch { return false; } };

await mkdir(wasmTo, { recursive: true });
await mkdir(modelsTo, { recursive: true });

let copied = 0;
for (const name of await readdir(wasmFrom)) {
  if (name.includes('_module_')) continue; // the ES-module build of the runtime is not used
  await copyFile(join(wasmFrom, name), join(wasmTo, name));
  copied++;
}
console.log(`[assets] wasm runtime: ${copied} files -> public/mediapipe/wasm`);

for (const [name, url] of Object.entries(MODELS)) {
  const to = join(modelsTo, name);
  if (await exists(to)) { console.log(`[assets] ${name}: already present`); continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(to, buf);
    console.log(`[assets] ${name}: ${(buf.length / 1e6).toFixed(1)} MB`);
  } catch (err) {
    // Not fatal: the app falls back to loading the model from Google's model host in the browser.
    console.warn(`[assets] could not download ${name} (${err.message}).`);
    console.warn(`         Run "npm run assets" again later, or save ${url}\n         as public/models/${name}`);
  }
}
