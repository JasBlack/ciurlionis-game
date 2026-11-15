// A mask loaded from a .glb file: any head model, placed over the wearer's head.
// If its meshes carry ARKit-named blendshapes (jawOpen, eyeBlinkLeft, browDownRight, ... the 52 names Apple's
// face tracking uses, and MediaPipe reports the same), they are driven by the wearer's expression.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const SIDED = ['browDown', 'browOuterUp', 'cheekSquint', 'eyeBlink', 'eyeLookDown', 'eyeLookIn', 'eyeLookOut', 'eyeLookUp',
  'eyeSquint', 'eyeWide', 'jaw', 'mouth', 'mouthDimple', 'mouthFrown', 'mouthLowerDown', 'mouthPress', 'mouthSmile',
  'mouthStretch', 'mouthUpperUp', 'noseSneer'];
const ARKIT = new Set([
  ...SIDED.flatMap((n) => [`${n}Left`, `${n}Right`]),
  'browInnerUp', 'cheekPuff', 'jawForward', 'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthRollLower',
  'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper', 'tongueOut',
].map((n) => n.toLowerCase()));

/** eyeBlinkLeft, EyeBlink_L, blendShape1.eyeBlink_L, eye_blink_left ... all become "eyeblinkleft". */
function shapeKey(name) {
  const s = name.slice(name.lastIndexOf('.') + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ARKIT.has(s)) return s;
  if (s.endsWith('l') && ARKIT.has(`${s.slice(0, -1)}left`)) return `${s.slice(0, -1)}left`;
  if (s.endsWith('r') && ARKIT.has(`${s.slice(0, -1)}right`)) return `${s.slice(0, -1)}right`;
  return s;
}

/**
 * @param {ArrayBuffer} buffer the .glb file
 * @param {string} name shown in the mask list
 * @param {string} id a stable id (fit settings are remembered under it)
 */
export async function loadGlbMask(buffer, name, id) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  const template = gltf.scene;
  template.updateMatrixWorld(true);

  // Bring the model to head size and centre it on the head. glTF is metres, +Y up, facing +Z, which is the
  // way a head should face here too; the fit controls take it from there.
  const box = new THREE.Box3().setFromObject(template);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const k = 24 / Math.cbrt(Math.max(size.x * size.y * size.z, 1e-9));
  const holder = new THREE.Group();
  holder.scale.setScalar(k);
  holder.position.set(-centre.x * k, 1.6 - centre.y * k, -2.4 - centre.z * k);
  holder.add(template);

  let shapes = 0;
  const names = new Set();
  template.traverse((o) => {
    if (o.isMesh && o.morphTargetDictionary) {
      for (const n of Object.keys(o.morphTargetDictionary)) { if (ARKIT.has(shapeKey(n))) names.add(shapeKey(n)); }
    }
    if (o.isMesh) o.frustumCulled = false;
  });
  shapes = names.size;

  function create() {
    const object = cloneSkinned(holder);
    const targets = [];
    object.traverse((o) => {
      if (!o.isMesh || !o.morphTargetDictionary) return;
      const map = {};
      for (const [n, i] of Object.entries(o.morphTargetDictionary)) map[shapeKey(n)] = i;
      targets.push({ mesh: o, map });
    });
    const mixer = gltf.animations.length ? new THREE.AnimationMixer(object) : null;
    if (mixer) mixer.clipAction(gltf.animations[0]).play();
    function update({ dt, blend }) {
      mixer?.update(dt);
      for (const { mesh, map } of targets) {
        for (const name in blend) {
          const i = map[name.toLowerCase()];
          if (i !== undefined) mesh.morphTargetInfluences[i] = blend[name];
        }
      }
    }
    return { object, update, dispose() { mixer?.stopAllAction(); } };
  }

  return {
    id, name, kind: 'glb',
    note: shapes ? `${shapes} expression shapes found` : 'No expression shapes: follows the head only',
    swatch: ['#9aa3c7', '#4b4f6b', '#9aa3c7'],
    create,
  };
}
