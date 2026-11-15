// The space every mask is built in: MediaPipe's canonical face model.
// Units are centimetres. +X is the wearer's left, +Y is up, +Z points out of the face.
// The origin sits inside the head, behind the bridge of the nose, about level with the ear canals.

/** MediaPipe solves the head pose for a camera with this vertical field of view; rendering with the
 *  same camera puts the model back exactly on the landmarks, whatever the real lens was. */
export const FOV_DEG = 63;

/** Where a real face's features are in canonical space (from canonical_face_model.obj). */
export const CANON = {
  noseTip: [0, -1.127, 7.476],
  rightEye: [-3.151, 2.625, 3.466], // the wearer's right: on the left of an unmirrored picture
  leftEye: [3.151, 2.625, 3.466],
  mouth: [0, -4.27, 5.31],
  chin: [0, -9.403, 4.264],
  foreheadTop: [0, 8.262, 4.482],
  earMid: [0, 0.673, -2.436],
  earWidth: 15.33, // ear to ear
};

/** A real head, hair included, as an ellipsoid. Masks that are meant to hide the wearer should contain it. */
export const HEAD_PROXY = { center: [0, 1.6, -3.2], radii: [8.4, 11.6, 10.8] };

/** The outline of the face in the 478-point mesh, in order round the face. */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/** Pose-landmarker indices used for the head when the face itself cannot be tracked. */
export const POSE = { nose: 0, leftEye: 2, rightEye: 5, leftEar: 7, rightEar: 8, mouthLeft: 9, mouthRight: 10, leftShoulder: 11, rightShoulder: 12 };
