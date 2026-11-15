// Draws one finished frame: the video frame that was analysed, a privacy patch over each head, the 3D masks.
//
// The order matters for the promise the app makes. The frame is copied once into `frame`; the tracker reads that
// copy, and the picture is composed from that same copy. So a mask can never be late for its frame, and no frame
// reaches the screen or a recording before its masks are on it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FOV_DEG, FACE_OVAL, HEAD_PROXY, CANON } from '../tracking/canonical.js';
import { FACE, HOLD } from '../tracking/headTracker.js';

export const LOOKS = {
  none: 'none',
  mono: 'grayscale(1) contrast(1.08)',
  noir: 'grayscale(1) contrast(1.45) brightness(0.92)',
  warm: 'sepia(0.28) saturate(1.25) hue-rotate(-8deg)',
  cool: 'saturate(1.1) hue-rotate(14deg) brightness(1.03)',
  vivid: 'saturate(1.6) contrast(1.08)',
};

export const IDENTITY_FIT = Object.freeze({ scale: 1, x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, sx: 1, sy: 1, sz: 1 });

const _q = new THREE.Quaternion();
const _qPrev = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();

export class Stage {
  /** @param {HTMLCanvasElement} out the canvas the finished picture is drawn on */
  constructor(out) {
    this.out = out;
    this.octx = out.getContext('2d', { alpha: false });
    this.frame = document.createElement('canvas');
    this.fctx = this.frame.getContext('2d', { alpha: false });
    this.tiny = document.createElement('canvas');
    this.tctx = this.tiny.getContext('2d', { alpha: false });
    this.w = 0;
    this.h = 0;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.gl = this.renderer.domElement;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.85;
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(-30, 60, 80);
    this.scene.add(key, new THREE.HemisphereLight(0xdfe6ff, 0x2a2238, 0.35));

    this.camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 4000);

    this.settings = {
      underlay: 'pixelate', // 'pixelate' | 'solid' | 'blur' | 'off'
      underlayColor: '#0b0b0c',
      margin: 1,
      strict: true,
      mirror: false,
      look: 'none',
      showGuide: false,
      showLandmarks: false,
      showMask: true,
    };
    this.fit = { ...IDENTITY_FIT };
    this.maskDef = null;
    this.slots = new Map(); // track id -> slot
    /** Colours drawn into the picture. The page hands over the family's tokens with setPalette(). */
    this.palette = { accent: '#39ff88', accent2: '#b36bff', stage: '#0b0b0c' };
    this.time = 0;
    /** What the last frame did, for the status line and for tests. */
    this.report = { heads: 0, hidden: false };
  }

  /** @param {{ accent: string, accent2: string, stage: string }} palette green, violet and the stage colour */
  setPalette(palette) {
    this.palette = { ...this.palette, ...Object.fromEntries(Object.entries(palette).filter(([, v]) => v)) };
    this.settings.underlayColor = this.palette.stage;
    for (const slot of this.slots.values()) slot.guide.material.color.set(this.palette.accent2);
  }

  /**
   * A small picture of a mask on its own, for the list of masks.
   * @returns {string} a PNG data URL with a clear background
   */
  thumbnail(def, size = 176) {
    const made = def.create();
    made.update?.({ dt: 0, time: 0, blend: {}, state: FACE, angVel: _v.set(0, 0, 0) });
    const holder = new THREE.Group();
    holder.add(made.object);
    holder.rotation.y = -0.35; // a little to one side, so horns and depth show
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const centre = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(28, 1, 1, 4000);
    const dist = (Math.max(span.x, span.y) / 2 / Math.tan((14 * Math.PI) / 180)) * 1.08 + span.z / 2;
    cam.position.set(centre.x, centre.y + dist * 0.06, centre.z + dist);
    cam.lookAt(centre);
    const hidden = [...this.slots.values()].map((slot) => slot.root).filter((root) => root.visible);
    for (const root of hidden) root.visible = false;
    this.scene.add(holder);
    this.renderer.setSize(size, size, false);
    this.renderer.render(this.scene, cam);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    out.getContext('2d').drawImage(this.gl, 0, 0);
    this.scene.remove(holder);
    for (const root of hidden) root.visible = true;
    made.dispose?.();
    this.renderer.setSize(this.w || this.out.width, this.h || this.out.height, false);
    return out.toDataURL('image/png');
  }

  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.frame.width = w; this.frame.height = h;
    this.out.width = w; this.out.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Copy the source's current picture. Everything after this works from the copy. */
  captureFrame(source, w, h) {
    this.setSize(w, h);
    this.fctx.drawImage(source, 0, 0, w, h);
  }

  /** The same, for a source that draws itself (a decoded frame during export). */
  captureVia(draw, w, h) {
    this.setSize(w, h);
    draw(this.fctx);
  }

  setMask(def) {
    for (const slot of this.slots.values()) this._dropSlot(slot);
    this.slots.clear();
    this.maskDef = def;
    this._maskBox = null;
  }

  setFit(fit) {
    this.fit = { ...IDENTITY_FIT, ...fit };
    for (const slot of this.slots.values()) this._applyFit(slot);
  }

  _applyFit(slot) {
    const f = this.fit;
    const d = Math.PI / 180;
    slot.fit.position.set(f.x, f.y, f.z);
    slot.fit.rotation.set(f.pitch * d, f.yaw * d, f.roll * d, 'YXZ');
    slot.fit.scale.set(f.scale * f.sx, f.scale * f.sy, f.scale * f.sz);
  }

  _slot(id) {
    let slot = this.slots.get(id);
    if (slot) return slot;
    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    const fit = new THREE.Group();
    root.add(fit);
    const mask = this.maskDef ? this.maskDef.create() : null;
    if (mask) fit.add(mask.object);
    const guide = makeGuide(this.palette.accent2);
    root.add(guide);
    this.scene.add(root);
    slot = { root, fit, mask, guide, lastQuat: null, angVel: new THREE.Vector3() };
    this._applyFit(slot);
    this.slots.set(id, slot);
    return slot;
  }

  _dropSlot(slot) {
    this.scene.remove(slot.root);
    slot.mask?.dispose?.();
    slot.guide.geometry.dispose();
    slot.guide.material.dispose();
  }

  /**
   * Compose and draw the frame last captured.
   * @param {import('../tracking/headTracker.js').Track[]} tracks
   * @param {number} dt seconds since the previous frame (0 to redraw the same moment)
   */
  render(tracks, dt = 0) {
    const { w, h, octx, settings } = this;
    if (!w) return;
    this.time += dt;

    // ---- 3D: one mask per head
    const live = new Set();
    for (const t of tracks) {
      live.add(t.id);
      const slot = this._slot(t.id);
      slot.root.matrix.compose(t.pos, t.quat, _s.setScalar(t.scale));
      slot.root.matrixWorldNeedsUpdate = true;
      slot.fit.visible = settings.showMask;
      slot.guide.visible = settings.showGuide;
      // how fast the head is turning, in its own axes: the masks use it for follow-through
      if (slot.lastQuat && dt > 0) {
        _q.copy(_qPrev.copy(slot.lastQuat).invert()).multiply(t.quat);
        if (_q.w < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
        _v.set(_q.x, _q.y, _q.z).multiplyScalar(2 / dt);
        slot.angVel.lerp(_v, 0.35);
      }
      (slot.lastQuat ??= new THREE.Quaternion()).copy(t.quat);
      slot.mask?.update?.({ dt, time: this.time, blend: t.blend, state: t.state, angVel: slot.angVel });
    }
    for (const [id, slot] of this.slots) {
      if (!live.has(id)) { this._dropSlot(slot); this.slots.delete(id); }
    }
    this.renderer.render(this.scene, this.camera);

    // ---- 2D: frame, privacy patches, masks
    octx.save();
    if (settings.mirror) octx.setTransform(-1, 0, 0, 1, w, 0);
    const look = LOOKS[settings.look] ?? 'none';
    if (look !== 'none') octx.filter = look;
    octx.drawImage(this.frame, 0, 0);
    octx.filter = 'none';

    // Blind on a head that was just there: hide the whole picture rather than guess.
    const blind = settings.strict && tracks.some((t) => t.state === HOLD);
    if (blind) this._pixelate(0, 0, w, h, Math.max(24, Math.round(Math.max(w, h) / 22)));

    if (settings.underlay !== 'off' && !blind) {
      for (const t of tracks) this._patch(t);
    }
    octx.drawImage(this.gl, 0, 0, w, h);

    if (settings.showLandmarks) {
      octx.fillStyle = this.palette.accent;
      for (const t of tracks) {
        if (!t.landmarks) continue;
        for (const p of t.landmarks) octx.fillRect(p.x * w - 1, p.y * h - 1, 2, 2);
      }
    }
    octx.restore();
    this.report.heads = tracks.length;
    this.report.hidden = blind;
  }

  /** The region of the picture that must not show the real head, as a path on the output context. */
  _patchPath(t) {
    const { w, h, octx } = this;
    const m = this.settings.margin;
    octx.beginPath();
    if (t.state === FACE && t.landmarks) {
      let cx = 0, cy = 0;
      for (const i of FACE_OVAL) { cx += t.landmarks[i].x; cy += t.landmarks[i].y; }
      cx = (cx / FACE_OVAL.length) * w;
      cy = (cy / FACE_OVAL.length) * h;
      const k = 1.16 * m;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let n = 0; n < FACE_OVAL.length; n++) {
        const p = t.landmarks[FACE_OVAL[n]];
        const x = cx + (p.x * w - cx) * k;
        const y = cy + (p.y * h - cy) * k;
        if (n) octx.lineTo(x, y); else octx.moveTo(x, y);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      octx.closePath();
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, size: t.sizePx };
    }
    // no face to outline: a generous oval where the head is, wider the longer it has gone unseen
    const grow = t.state === HOLD ? Math.min(2.2, 1 + t.heldMs / 600) : 1;
    const rx = 0.5 * t.sizePx * 1.65 * m * grow;
    const ry = rx * 1.25;
    octx.ellipse(t.cx, t.cy, rx, ry, 0, 0, Math.PI * 2);
    return { x: t.cx - rx, y: t.cy - ry, w: rx * 2, h: ry * 2, size: t.sizePx };
  }

  _patch(t) {
    const { octx, settings } = this;
    octx.save();
    const box = this._patchPath(t);
    octx.clip();
    if (settings.underlay === 'solid') {
      octx.fillStyle = settings.underlayColor;
      octx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    } else if (settings.underlay === 'blur') {
      octx.filter = `blur(${Math.max(8, Math.round(box.size / 5))}px)`;
      octx.drawImage(this.frame, 0, 0);
      octx.filter = 'none';
    } else {
      // about six blocks across a face: nothing of it survives
      this._pixelate(box.x, box.y, box.w, box.h, Math.max(10, Math.round(box.size / 6)));
    }
    octx.restore();
  }

  _pixelate(x, y, w, h, block) {
    const { octx, tiny, tctx } = this;
    x = Math.max(0, Math.floor(x / block) * block);
    y = Math.max(0, Math.floor(y / block) * block);
    w = Math.min(this.w - x, Math.ceil(w / block + 1) * block);
    h = Math.min(this.h - y, Math.ceil(h / block + 1) * block);
    if (w <= 0 || h <= 0) return;
    const tw = Math.max(1, Math.round(w / block));
    const th = Math.max(1, Math.round(h / block));
    if (tiny.width < tw) tiny.width = tw;
    if (tiny.height < th) tiny.height = th;
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(this.frame, x, y, w, h, 0, 0, tw, th);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(tiny, 0, 0, tw, th, x, y, w, h);
    octx.imageSmoothingEnabled = true;
  }

  /**
   * The mask alone, facing the viewer, for fitting by points.
   * @returns {{ matrix: THREE.Matrix4 }} the pose the mask was drawn in
   */
  renderCalibration() {
    const { octx } = this;
    if (!this.w) this.setSize(960, 720);
    const { w, h } = this;
    const slot = this._slot('calibration');
    slot.root.matrix.makeTranslation(0, 3, -50);
    slot.root.matrixWorldNeedsUpdate = true;
    slot.fit.visible = true;
    slot.guide.visible = true;
    slot.mask?.update?.({ dt: 0, time: this.time, blend: {}, state: FACE, angVel: _v.set(0, 0, 0) });
    for (const [id, other] of this.slots) other.root.visible = id === 'calibration';
    this.renderer.render(this.scene, this.camera);
    for (const other of this.slots.values()) other.root.visible = true;
    octx.save();
    octx.fillStyle = this.palette.stage;
    octx.fillRect(0, 0, w, h);
    octx.drawImage(this.gl, 0, 0, w, h);
    octx.restore();
    return slot;
  }

  endCalibration() {
    const slot = this.slots.get('calibration');
    if (slot) { this._dropSlot(slot); this.slots.delete('calibration'); }
  }

  /** Does the fitted mask reach round a real head? A list of the sides where it falls short. */
  coverageGaps() {
    if (!this.maskDef) return [];
    if (!this._maskBox) {
      // the mask's own extent, measured once per mask
      const probe = this.maskDef.create();
      probe.object.updateMatrixWorld(true);
      this._maskBox = new THREE.Box3().setFromObject(probe.object);
      probe.dispose?.();
    }
    const f = this.fit, d = Math.PI / 180;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(f.x, f.y, f.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(f.pitch * d, f.yaw * d, f.roll * d, 'YXZ')),
      new THREE.Vector3(f.scale * f.sx, f.scale * f.sy, f.scale * f.sz),
    );
    const box = this._maskBox.clone().applyMatrix4(m);
    const [cx, cy, cz] = HEAD_PROXY.center;
    const [rx, ry, rz] = HEAD_PROXY.radii;
    const gaps = [];
    if (box.max.x < cx + rx || box.min.x > cx - rx) gaps.push('the sides');
    if (box.max.y < cy + ry) gaps.push('the top');
    if (box.min.y > CANON.chin[1]) gaps.push('the chin');
    if (box.max.z < CANON.noseTip[2]) gaps.push('the nose');
    if (box.min.z > cz - rz) gaps.push('the back');
    return gaps;
  }
}

function makeGuide(color) {
  const geo = new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 14, 10));
  const guide = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, depthTest: false }));
  guide.position.set(...HEAD_PROXY.center);
  guide.scale.set(...HEAD_PROXY.radii);
  guide.renderOrder = 10;
  guide.visible = false;
  return guide;
}
