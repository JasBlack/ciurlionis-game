// What his body does that the walking clips do not: standing with his knees over his feet, swimming, sitting
// astride the salamander, and giving a hand to the child. Each is laid over the clips after they have had their
// say, by turning a bone until the next joint lies where it should (in his own frame: x to his left, y up his
// body, z out of his chest), so nothing here depends on how the skeleton's own axes happen to lie.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// One stroke of his swimming, a traditional breaststroke with his head up, as a gentleman swims: as directions his left arm
// and leg pass through, [moment of the stroke 0..1, upper, lower], in the water's frame (x to his left, y up, z the
// way he heads). The right side is its mirror, at the same moment. He glides with his arms out ahead; they sweep
// wide and round in under his chin and shoot forward again, and as they do his knees come down, his heels up behind
// him, and his legs kick round and together into the next glide.
// (stroke follows stroke: the arms are out ahead only for a moment's glide before they sweep again)
const ARMS = [
  [0.0, [0.1, -0.1, 1], [0.04, -0.06, 1]],
  [0.06, [0.22, -0.12, 0.97], [0.18, -0.14, 0.97]],
  [0.3, [0.75, -0.18, 0.62], [0.66, -0.32, 0.68]],
  [0.44, [0.82, -0.42, 0.1], [-0.38, -0.55, 0.74]],
  [0.54, [0.45, -0.72, 0.38], [-0.48, 0.12, 0.87]],
  [0.84, [0.1, -0.1, 1], [0.04, -0.06, 1]],
];
const LEGS = [
  [0.0, [0.06, -0.4, -0.92], [0.03, -0.36, -0.93]],
  [0.38, [0.06, -0.4, -0.92], [0.03, -0.36, -0.93]],
  [0.54, [0.38, -0.86, -0.14], [0.2, 0.45, -0.87]],
  [0.68, [0.46, -0.6, -0.62], [0.66, -0.28, -0.7]],
  [0.84, [0.07, -0.42, -0.9], [0.03, -0.37, -0.93]],
];
// and his feet: pointed back in the glide, turned out and flexed to push the water in the kick
const FEET = [
  [0.0, [0.02, -0.25, -1]],
  [0.42, [0.02, -0.25, -1]],
  [0.54, [0.62, -0.62, 0.3]],
  [0.68, [0.6, -0.7, 0.1]],
  [0.84, [0.02, -0.25, -1]],
];
const key = (keys, u, part, out) => {
  let i = keys.length - 1;
  while (i > 0 && keys[i][0] > u) i--;
  const a = keys[i], b = keys[(i + 1) % keys.length];
  const span = (b[0] > a[0] ? b[0] : b[0] + 1) - a[0], k = smooth(0, 1, (u - a[0]) / span);
  return out.set(a[part][0] + (b[part][0] - a[part][0]) * k, a[part][1] + (b[part][1] - a[part][1]) * k, a[part][2] + (b[part][2] - a[part][2]) * k);
};

export function createBody(man, animator) {
  const B = man.bones, O = man.object;
  const a = V(), b = V(), c = V(), d = V(), e = V(), q = new THREE.Quaternion(), ident = new THREE.Quaternion(), fq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const at = (bone, out) => out.setFromMatrixPosition(bone.matrixWorld);
  /** Turns `bone` until `child` lies along `dir` (the world's, any length), as far as `w` says. */
  function aim(bone, child, dir, w) {
    c.copy(dir).normalize(); // (first: dir may be one of the vectors used below)
    at(B[child], a).sub(at(B[bone], b)).normalize();
    q.setFromUnitVectors(a, c);
    if (w < 1) q.slerp(ident, 1 - w);
    animator.rotateWorldQ(B[bone], q);
  }
  const own = (v) => v.normalize().applyQuaternion(O.quaternion); // from his frame to the world's
  const UP = V(0, 1, 0), heading = new THREE.Quaternion();
  const level = (v) => v.normalize().applyQuaternion(heading);     // from the water's frame (x his left, y up, z ahead)
  const side = (s) => (s === 'l' ? 1 : -1);
  let idle = 0;

  return {
    aim,
    /**
     * Standing still: each knee is brought over the line from hip to foot, facing the way he faces. (The clips
     * that stand him still let his right knee fall in toward the left.) The feet stay where they are.
     */
    stand(dt, still) {
      idle += ((still ? 1 : 0) - idle) * (1 - Math.exp(-(still ? 5 : 12) * dt));
      if (idle < 0.01) return;
      const fwd = d.set(0, 0, 1).applyQuaternion(O.quaternion).clone(), left = d.set(1, 0, 0).applyQuaternion(O.quaternion).clone();
      for (const s of ['l', 'r']) {
        const hip = B[`thigh_${s}`], knee = B[`calf_${s}`], foot = B[`foot_${s}`];
        const H = at(hip, V()), axis = at(foot, V()).sub(H).normalize();
        const k = at(knee, V()).sub(H); k.addScaledVector(axis, -k.dot(axis));
        const bent = k.length();
        if (bent < 0.004) continue;
        k.divideScalar(bent);
        const want = fwd.clone().addScaledVector(left, 0.16 * side(s)); want.addScaledVector(axis, -want.dot(axis)).normalize();
        const angle = clamp(Math.atan2(axis.dot(e.crossVectors(k, want)), k.dot(want)), -1.2, 1.2) * idle * smooth(0.004, 0.03, bent);
        foot.getWorldQuaternion(fq);
        animator.rotateWorld(hip, axis, angle);
        foot.quaternion.copy(foot.parent.getWorldQuaternion(pq).invert().multiply(fq));
        foot.updateMatrixWorld(true);
      }
    },
    /**
     * In the water. w: how far he is swimming at all. stroke: 0 treading it, upright, arms wide on the surface;
     * 1 swimming forward on his front. u: the moment of the stroke (0..1); t: the time, for the idle sculling.
     */
    swim(w, stroke, u, t, pitch = 0, rise = 0) {
      if (w < 0.01) return;
      heading.setFromAxisAngle(UP, O.rotation.y);
      // treading (stroke 0), both sides together, never one leg after the other: his hands scull on the surface
      // and his legs make a slow frog kick under him
      const sc = Math.sin(t * 2.2), kk = 0.5 + 0.5 * Math.sin(t * 2.2 - 0.6);
      for (const s of ['l', 'r']) {
        const sx = side(s);
        const up0 = a.set(0.9, -0.08, 0.32 + 0.22 * sc).clone(), lo0 = a.set(0.78, 0.02, 0.58 + 0.3 * Math.sin(t * 2.2 + 0.7)).clone();
        const th0 = a.set(0.2 + 0.14 * kk, -0.96, 0.18).clone(), ca0 = a.set(0.12 + 0.2 * kk, -0.82, -0.52).clone(), ft0 = a.set(0.3 * kk, -0.6, 0.3).clone();
        const up = key(ARMS, u, 1, V()).lerp(up0, 1 - stroke), lo = key(ARMS, u, 2, V()).lerp(lo0, 1 - stroke);
        const th = key(LEGS, u, 1, V()).lerp(th0, 1 - stroke), ca = key(LEGS, u, 2, V()).lerp(ca0, 1 - stroke), ft = key(FEET, u, 1, V()).lerp(ft0, 1 - stroke);
        for (const v of [up, lo, th, ca, ft]) v.x *= sx;
        aim(`upperarm_${s}`, `lowerarm_${s}`, level(up), w);
        aim(`lowerarm_${s}`, `hand_${s}`, level(lo), w);
        aim(`thigh_${s}`, `calf_${s}`, level(th), w);
        aim(`calf_${s}`, `foot_${s}`, level(ca), w);
        if (B[`ball_${s}`]) aim(`foot_${s}`, `ball_${s}`, level(ft), w);
      }
      // he holds his head up out of the water, to see where he goes, and lifts it a little more to breathe as his
      // arms pull in under him
      const right = d.set(-1, 0, 0).applyQuaternion(heading), lift = (Math.max(0, pitch - 0.08) + 0.18 * rise) * w;
      if (lift > 0.01) for (const [bone, k] of [['spine_03', 0.2], ['neck_01', 0.42], ['Head', 0.4]]) animator.rotateWorld(B[bone], right, lift * k);
    },
    /** Astride: knees out round the creature's back, hands down on its neck. */
    ride(w, t) {
      if (w < 0.01) return;
      for (const s of ['l', 'r']) {
        const sx = side(s), sway = 0.04 * Math.sin(t * 1.7 + sx);
        aim(`thigh_${s}`, `calf_${s}`, own(a.set(sx * 0.86, -0.3, 0.42)), w);
        aim(`calf_${s}`, `foot_${s}`, own(a.set(sx * 0.3, -0.92, -0.22 + sway)), w);
        aim(`upperarm_${s}`, `lowerarm_${s}`, own(a.set(sx * 0.3, -0.72, 0.6)), w);
        aim(`lowerarm_${s}`, `hand_${s}`, own(a.set(-sx * 0.12, -0.62, 0.78)), w);
      }
    },
    /** His left hand goes down to `target` (the world's): the child's hand is in it. */
    hold(w, target) {
      if (w < 0.01) return;
      for (const [bone, child] of [['upperarm_l', 'lowerarm_l'], ['lowerarm_l', 'hand_l']]) aim(bone, child, a.copy(target).sub(at(B[bone], b)), w);
    },
    /** Where a joint is, in the world. */
    joint(name, out = V()) { return at(B[name], out); },
  };
}
