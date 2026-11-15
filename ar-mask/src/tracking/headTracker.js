// Follows each head in the picture and never lets go of one without evidence that it has left.
//
// A head is followed in one of three states:
//   FACE  the face mesh is locked: exact pose and expression from 478 landmarks
//   BODY  the face cannot be read (profile, turned away, covered) but the body pose still shows where the head is:
//         the mask follows the nose / ear / shoulder keypoints instead
//   HOLD  nothing is seen this frame: the head coasts a moment on its last velocity, then stays put, still masked
//
// A head is dropped only after HOLD has lasted `holdMs`, or sooner when it was last seen leaving the picture or the
// body tracker reports that nobody is there. It is never dropped because one frame, or ten, failed to track.
import * as THREE from 'three';
import { OneEuro } from './oneEuro.js';
import { FOV_DEG, CANON, POSE } from './canonical.js';

export const FACE = 'face';
export const BODY = 'body';
export const HOLD = 'hold';

const TUNE = {
  [FACE]: { xy: [2.5, 0.12], z: [1.2, 0.05], rot: [2.5, 2.5] },
  [BODY]: { xy: [1.4, 0.06], z: [0.6, 0.02], rot: [0.9, 0.8] },
};

const EAR_MID = new THREE.Vector3(...CANON.earMid);
// The line from between the ears to the tip of the nose dips below the head's forward axis by this much.
const NOSE_DIP = Math.atan2(CANON.earMid[1] - CANON.noseTip[1], CANON.noseTip[2] - CANON.earMid[2]);
const Q_NOSE_DIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -NOSE_DIP);

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

class Track {
  constructor(id, tMs) {
    this.id = id;
    this.state = HOLD;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.scale = 1;
    this.vel = new THREE.Vector3();
    /** Smoothed expression scores by ARKit blendshape name (jawOpen, eyeBlinkLeft, ...). */
    this.blend = {};
    /** The face landmarks of this very frame, unsmoothed; null unless state is FACE. */
    this.landmarks = null;
    /** Head centre and width in picture pixels, unsmoothed: used to match detections and to place the privacy patch. */
    this.cx = 0; this.cy = 0; this.sizePx = 0;
    this.born = tMs;
    this.lastSeen = tMs;
    this.heldMs = 0;
    this.depthK = 1;
    this.snap = true;
    this.fXY = new OneEuro(2);
    this.fZ = new OneEuro(1);
    this.fQ = new OneEuro(4);
    this.fS = new OneEuro(1, { minCutoff: 1 });
  }
}

export class HeadTracker {
  constructor({ face, pose }) {
    this.face = face;
    this.pose = pose;
    this.tracks = [];
    this.maxPeople = 1;
    /** How long a head stays masked with no evidence at all before it is given up, in ms. */
    this.holdMs = 1500;
    /** The same, when the body tracker ran and found nobody in the picture. */
    this.emptyHoldMs = 500;
    /** 'auto': the body tracker runs only when a face is missing. 'always': every frame (export). 'off'. */
    this.poseMode = 'auto';
    this.stats = { faceMs: 0, poseMs: 0, ranPose: false };
    this._nextId = 1;
    this._ts = 10;
    this._lastT = null;
    this._frame = 0;
  }

  async setMaxPeople(n) {
    this.maxPeople = n;
    await this.face.setOptions({ numFaces: n });
    await this.pose.setOptions({ numPoses: n });
  }

  /** Forget everybody (a new source, or a jump in time). */
  reset() {
    this.tracks.length = 0;
    this._lastT = null;
  }

  /**
   * @param {TexImageSource} image the frame, upright and unmirrored
   * @param {number} w  its width in pixels
   * @param {number} h  its height in pixels
   * @param {number} tMs the frame's time in ms on any clock that runs forward
   * @returns {Track[]} every head that should be masked in this frame
   */
  update(image, w, h, tMs) {
    let dt = this._lastT == null ? 1 / 30 : (tMs - this._lastT) / 1000;
    if (!(dt > 0) || dt > 0.5) {
      dt = 1 / 30;
      for (const t of this.tracks) t.snap = true;
    }
    dt = Math.max(dt, 1 / 240);
    this._lastT = tMs;
    this._ts += Math.max(1, Math.round(dt * 1000));
    this._frame++;
    const f = h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV_DEG) / 2);

    // ---- faces
    let t0 = performance.now();
    const fr = this.face.detectForVideo(image, this._ts);
    this.stats.faceMs = performance.now() - t0;
    const dets = [];
    for (let i = 0; i < fr.faceLandmarks.length; i++) {
      const lm = fr.faceLandmarks[i];
      const mat = fr.facialTransformationMatrixes?.[i];
      if (!mat || !lm || lm.length < 468) continue;
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      _m.fromArray(mat.data).decompose(pos, quat, _s);
      if (!Number.isFinite(pos.x + pos.y + pos.z + quat.w) || pos.z > -1) continue;
      const a = lm[234], b = lm[454], c = lm[10], d = lm[152];
      dets.push({
        lm, pos, quat,
        scale: (_s.x + _s.y + _s.z) / 3,
        cx: ((a.x + b.x + c.x + d.x) / 4) * w,
        cy: ((a.y + b.y + c.y + d.y) / 4) * h,
        size: Math.max(Math.hypot((a.x - b.x) * w, (a.y - b.y) * h), 0.85 * Math.hypot((c.x - d.x) * w, (c.y - d.y) * h)),
        blend: fr.faceBlendshapes?.[i]?.categories ?? null,
        used: false,
      });
    }

    // ---- match faces to the heads already followed
    const faceOf = new Map();
    const pairs = [];
    for (const t of this.tracks) {
      for (const d of dets) {
        const cost = Math.hypot(t.cx - d.cx, t.cy - d.cy) / Math.max(t.sizePx, d.size, 1);
        pairs.push({ t, d, cost });
      }
    }
    pairs.sort((p, q) => p.cost - q.cost);
    for (const { t, d, cost } of pairs) {
      if (cost > 1 || d.used || faceOf.has(t)) continue;
      d.used = true;
      faceOf.set(t, d);
    }
    // A face nobody claimed and a head with no face: the same person, further away than expected.
    for (const { t, d } of pairs) {
      if (d.used || faceOf.has(t)) continue;
      d.used = true;
      t.snap = true;
      faceOf.set(t, d);
    }
    for (const d of dets) {
      if (d.used || this.tracks.length >= this.maxPeople * 2) continue;
      const t = new Track(this._nextId++, tMs);
      this.tracks.push(t);
      d.used = true;
      faceOf.set(t, d);
    }

    // ---- bodies, when some head has no face this frame (or always, on request)
    const faceless = this.tracks.filter((t) => !faceOf.has(t));
    let persons = null;
    // With nobody locked the body tracker runs on every frame: it is what catches a head that comes in turned away.
    const wantPose = this.poseMode === 'always' || (this.poseMode === 'auto' && (faceless.length > 0 || dets.length === 0));
    this.stats.ranPose = wantPose;
    if (wantPose) {
      t0 = performance.now();
      const pr = this.pose.detectForVideo(image, this._ts);
      this.stats.poseMs = performance.now() - t0;
      persons = [];
      for (let i = 0; i < pr.landmarks.length; i++) {
        const p = headFromPose(pr.landmarks[i], pr.worldLandmarks[i], w, h);
        if (p) persons.push(p);
      }
      // a body whose head already has a face lock needs nothing more
      for (const p of persons) {
        for (const [, d] of faceOf) {
          if (Math.hypot(p.cx - d.cx, p.cy - d.cy) < 0.9 * Math.max(p.size, d.size)) p.used = true;
        }
      }
    }

    // ---- update every head
    for (const t of this.tracks) {
      const d = faceOf.get(t);
      if (d) {
        this._measure(t, d, FACE, dt);
        t.landmarks = d.lm;
        t.cx = d.cx; t.cy = d.cy; t.sizePx = d.size;
        t.lastSeen = tMs; t.heldMs = 0;
        blendToward(t.blend, d.blend, dt);
        continue;
      }
      t.landmarks = null;
      relax(t.blend, dt);
      let best = null;
      if (persons) {
        for (const p of persons) {
          if (p.used) continue;
          const cost = Math.hypot(t.cx - p.cx, t.cy - p.cy) / Math.max(t.sizePx, p.size, 1);
          if (cost < 1.5 && (!best || cost < best.cost)) best = { p, cost };
        }
      }
      if (best) {
        best.p.used = true;
        this._measure(t, this._bodyPose(t, best.p, w, h, f), BODY, dt);
        t.cx = best.p.cx; t.cy = best.p.cy; t.sizePx = best.p.size;
        t.lastSeen = tMs; t.heldMs = 0;
        continue;
      }
      // nothing seen: coast briefly, then stay
      t.state = HOLD;
      t.heldMs = tMs - t.lastSeen;
      if (t.heldMs < 250) t.pos.addScaledVector(t.vel, dt);
      t.vel.multiplyScalar(Math.exp(-dt / 0.1));
      t.snap = true;
      _v.copy(EAR_MID).multiplyScalar(t.scale).applyQuaternion(t.quat).add(t.pos);
      if (_v.z < -1) {
        t.cx = w / 2 + (f * _v.x) / -_v.z;
        t.cy = h / 2 - (f * _v.y) / -_v.z;
      }
      t.nobodyThere = persons != null && persons.length === 0;
    }

    // ---- a body with no head followed yet: somebody who came in turned away, or whose face never resolved
    if (persons) {
      for (const p of persons) {
        if (p.used || p.vis < 0.5 || this.tracks.length >= this.maxPeople * 2) continue;
        const t = new Track(this._nextId++, tMs);
        this.tracks.push(t);
        this._measure(t, this._bodyPose(t, p, w, h, f), BODY, dt);
        t.cx = p.cx; t.cy = p.cy; t.sizePx = p.size;
      }
    }

    // ---- let go only on evidence, or after the full hold
    this.tracks = this.tracks.filter((t) => {
      if (t.state !== HOLD) return true;
      const m = 0.25 * t.sizePx;
      const left = t.cx < -m || t.cx > w + m || t.cy < -m || t.cy > h + m;
      const limit = left ? 200 : t.nobodyThere ? this.emptyHoldMs : this.holdMs;
      return t.heldMs <= limit;
    });
    return this.tracks;
  }

  /** Head pose from body keypoints, at the depth this head was last known to be. */
  _bodyPose(t, p, w, h, f) {
    let depth = (f * CANON.earWidth) / p.size;
    if (t.state === FACE) {
      // first frame without the face: carry the face's depth over, so the mask does not change size
      _v.copy(EAR_MID).multiplyScalar(t.scale).applyQuaternion(t.quat).add(t.pos);
      t.depthK = THREE.MathUtils.clamp(-_v.z / depth, 0.5, 2);
    }
    depth *= t.depthK;
    const pos = new THREE.Vector3((p.cx - w / 2) * depth / f, -(p.cy - h / 2) * depth / f, -depth);
    pos.sub(_v.copy(EAR_MID).applyQuaternion(p.quat));
    return { pos, quat: p.quat, scale: 1 };
  }

  _measure(t, m, state, dt) {
    const snap = t.snap;
    t.snap = false;
    t.state = state;
    if (snap) {
      t.fXY.reset([m.pos.x, m.pos.y]);
      t.fZ.reset([m.pos.z]);
      t.fQ.reset([m.quat.x, m.quat.y, m.quat.z, m.quat.w]);
      t.fS.reset([m.scale]);
      t.pos.copy(m.pos);
      t.quat.copy(m.quat);
      t.scale = m.scale;
      t.vel.set(0, 0, 0);
      return;
    }
    const tune = TUNE[state];
    [t.fXY.minCutoff, t.fXY.beta] = tune.xy;
    [t.fZ.minCutoff, t.fZ.beta] = tune.z;
    [t.fQ.minCutoff, t.fQ.beta] = tune.rot;
    _prev.copy(t.pos);
    const xy = t.fXY.filter([m.pos.x, m.pos.y], dt);
    const z = t.fZ.filter([m.pos.z], dt);
    t.pos.set(xy[0], xy[1], z[0]);
    // q and -q are the same rotation: stay on the side the filter is on
    const q = m.quat;
    const fq = t.fQ.x;
    const sign = fq[0] * q.x + fq[1] * q.y + fq[2] * q.z + fq[3] * q.w < 0 ? -1 : 1;
    const o = t.fQ.filter([q.x * sign, q.y * sign, q.z * sign, q.w * sign], dt);
    t.quat.set(o[0], o[1], o[2], o[3]).normalize();
    t.scale = t.fS.filter([m.scale], dt)[0];
    t.vel.lerp(_v.subVectors(t.pos, _prev).divideScalar(dt), 0.5);
  }
}

/**
 * Where the head is and which way it faces, from the body pose alone.
 * Works in profile and from behind, where there is no face to track.
 */
function headFromPose(lm, wl, w, h) {
  if (!lm || !wl) return null;
  const px = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const nose = px(POSE.nose), le = px(POSE.leftEar), re = px(POSE.rightEar);
  const cx = (le.x + re.x) / 2, cy = (le.y + re.y) / 2;

  // pixels per metre, from every pair of upper-body points the model is sure of
  const PAIRS = [[7, 8], [0, 7], [0, 8], [2, 5], [9, 10], [11, 12], [7, 11], [8, 12], [0, 11], [0, 12]];
  let num = 0, den = 0;
  for (const [a, b] of PAIRS) {
    const wgt = Math.min(lm[a].visibility ?? 1, lm[b].visibility ?? 1);
    num += wgt * Math.hypot((lm[a].x - lm[b].x) * w, (lm[a].y - lm[b].y) * h);
    den += wgt * Math.hypot(wl[a].x - wl[b].x, wl[a].y - wl[b].y);
  }
  if (!(den > 1e-4) || !(num > 1)) return null;
  const size = (num / den) * (CANON.earWidth / 100);
  if (cx < -size || cx > w + size || cy < -size || cy > h + size) return null;

  // the head's axes from the 3D keypoints (pose world space: x right, y down, z away from the camera)
  const W = (i, out) => out.set(wl[i].x, -wl[i].y, -wl[i].z);
  const L = W(POSE.leftEar, new THREE.Vector3());
  const R = W(POSE.rightEar, new THREE.Vector3());
  const N = W(POSE.nose, new THREE.Vector3());
  _x.subVectors(L, R);
  const quat = new THREE.Quaternion();
  if (_x.lengthSq() > 1e-8) {
    _x.normalize();
    _z.copy(N).sub(L.add(R).multiplyScalar(0.5));
    _z.addScaledVector(_x, -_z.dot(_x));
    if (_z.lengthSq() > 1e-8) {
      _z.normalize();
      _y.crossVectors(_z, _x);
      quat.setFromRotationMatrix(_m.makeBasis(_x, _y, _z)).multiply(Q_NOSE_DIP);
    }
  }
  return { cx, cy, size, quat, vis: (nose.v + le.v + re.v) / 3, used: false };
}

function blendToward(blend, cats, dt) {
  if (!cats) return;
  for (const c of cats) {
    const name = c.categoryName;
    const prev = blend[name];
    if (prev === undefined) { blend[name] = c.score; continue; }
    const tau = name.startsWith('eyeBlink') ? 0.02 : 0.045;
    blend[name] = prev + (c.score - prev) * (1 - Math.exp(-dt / tau));
  }
}

function relax(blend, dt) {
  const k = Math.exp(-dt / 0.25);
  for (const name in blend) blend[name] *= k;
}
