// Loads MediaPipe's face and pose landmarkers. The wasm runtime and both models are served from this app's own
// folder (scripts/fetch-assets.mjs puts them there); only if a model is missing is it fetched from Google's host.
import { FilesetResolver, FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

const REMOTE = 'https://storage.googleapis.com/mediapipe-models/';
const MODELS = {
  face: ['models/face_landmarker.task', `${REMOTE}face_landmarker/face_landmarker/float16/1/face_landmarker.task`],
  pose: ['models/pose_landmarker_lite.task', `${REMOTE}pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`],
};

async function modelUrl([local, remote]) {
  const url = new URL(local, document.baseURI).href;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const type = res.headers.get('content-type') || '';
    if (res.ok && !type.includes('text/html')) return { url, local: true };
  } catch { /* fall through */ }
  return { url: remote, local: false };
}

function blankCanvas() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  c.getContext('2d').fillRect(0, 0, 64, 64);
  return c;
}

/**
 * @param {{ maxPeople?: number, delegate?: 'GPU' | 'CPU', runningMode?: 'VIDEO' | 'IMAGE' }} opts
 * @returns {Promise<{ face: FaceLandmarker, pose: PoseLandmarker, delegate: string, localModels: boolean }>}
 */
export async function createLandmarkers({ maxPeople = 1, delegate = 'GPU', runningMode = 'VIDEO' } = {}) {
  const fileset = await FilesetResolver.forVisionTasks(new URL('mediapipe/wasm', document.baseURI).href);
  const [faceModel, poseModel] = await Promise.all([modelUrl(MODELS.face), modelUrl(MODELS.pose)]);

  const build = async (which) => {
    // Low thresholds on purpose: a shaky lock on a turned head is better than no lock, because the
    // alternative to a slightly wrong mask is no mask.
    const face = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: faceModel.url, delegate: which },
      runningMode,
      numFaces: maxPeople,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.3,
      minFacePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
    const pose = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: poseModel.url, delegate: which },
      runningMode,
      numPoses: maxPeople,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    // One real inference each, so a graphics delegate that loads but cannot run is found out here.
    const probe = blankCanvas();
    if (runningMode === 'VIDEO') { face.detectForVideo(probe, 1); pose.detectForVideo(probe, 1); } else { face.detect(probe); pose.detect(probe); }
    return { face, pose };
  };

  let made;
  let used = delegate;
  try {
    made = await build(delegate);
  } catch (err) {
    if (delegate === 'CPU') throw err;
    console.warn('[mask-layer] GPU delegate failed, using CPU:', err);
    used = 'CPU';
    made = await build('CPU');
  }
  return { ...made, delegate: used, localModels: faceModel.local && poseModel.local };
}
