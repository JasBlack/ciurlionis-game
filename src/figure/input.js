// Keyboard, mouse and gamepad, read once a frame into one plain state.
//   move: {x, y} (x right, y forward, length 0..1), walk, sprint, strafe (held),
//   jump (pressed this frame), look: {x, y} (radians this frame), zoom (wheel steps this frame),
//   clicks: [{x, y}] (quick clicks or taps on the picture this frame, in screen pixels),
//   cursor: {x, y, inside} (where the mouse is over the picture, -1..1 each way, y down), orbit (middle button held)
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
export class Input {
  constructor(el, { pads = true } = {}) {
    this.el = el;
    this.pads = pads; // off in headless checks: this PC's real gamepad shows up in headless browsers too
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, wheel: 0, right: false, middle: false, drag: false };
    this.walkToggle = false;
    this.pad = { a: false, l3: false, sprint: false };
    this.sensitivity = 0.0022;
    this.override = null; // scripted input for captures
    // The mouse stays free over the picture, and the eye follows it: it leans toward the side the mouse is on (as
    // far as `lean` radians at the edge), and with the mouse at the very edge it keeps turning that way. It never
    // tilts up or down with it. A quick click (or tap) is a place to walk to, where it lands; pressed and dragged,
    // either button (or a finger) looks about directly. Clicks count only when the game says a click means a place
    // (`clickable`, as it was when the button went down); the eye follows the mouse only while `follows` is set.
    this.clicks = [];
    this.clickable = false;
    this.follows = false;
    this.lean = 0.3;
    this.cursor = { x: 0, y: 0, inside: false };
    this.leaned = 0;
    this.press = null;
    const typing = () => document.activeElement?.tagName === 'INPUT';
    const down = (e) => {
      if (typing()) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'CapsLock') this.walkToggle = !this.walkToggle;
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', () => { this.keys.clear(); this.press = null; this.cursor.inside = false; this.mouse.middle = this.mouse.right = false; el.classList.remove('dragging'); });
    // (the middle button, held, takes the eye round him: all the way round, and up and over)
    el.addEventListener('mousedown', (e) => { if (e.button === 2) this.mouse.right = true; if (e.button === 1) { this.mouse.middle = true; e.preventDefault(); } });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.mouse.right = false; if (e.button === 1) this.mouse.middle = false; });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => { if (this.mouse.right || this.mouse.middle) { this.mouse.x += e.movementX; this.mouse.y += e.movementY; } });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.cursor.inside = false; });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), drag: false, armed: this.clickable };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') Object.assign(this.cursor, { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1, inside: true });
      const p = this.press;
      if (!p || e.pointerId !== p.id) return;
      if (!p.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 7) { p.drag = true; el.classList.add('dragging'); }
      if (p.drag && !this.mouse.right) { this.mouse.x += e.clientX - p.lx; this.mouse.y += e.clientY - p.ly; }
      p.lx = e.clientX; p.ly = e.clientY;
    });
    const release = (e) => {
      const p = this.press;
      if (!p || e.pointerId !== p.id) return;
      this.press = null;
      el.classList.remove('dragging');
      if (e.type === 'pointerup' && !p.drag && p.armed && performance.now() - p.t < 700) this.clicks.push({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  read(dt) {
    if (this.override) return this.override(dt);
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const s = {
      move: { x, y },
      walk: this.walkToggle !== (k.has('AltLeft') || k.has('AltRight')),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      strafe: k.has('KeyF'),
      jump: this.pressed.has('Space'),
      look: { x: this.mouse.x * this.sensitivity, y: this.mouse.y * this.sensitivity },
      zoom: this.mouse.wheel,
      device: 'keyboard',
      clicks: this.clicks.splice(0),
      cursor: { ...this.cursor },
      orbit: this.mouse.middle,
    };
    this.mouse.x = this.mouse.y = this.mouse.wheel = 0;
    this.pressed.clear();
    // the eye follows the free mouse: a lean toward its side (given back as it comes back to the middle), and a
    // steady turn while it is held at the very edge. (Not while a press is dragged: that looks about by itself.)
    const c = this.cursor, steer = this.follows && c.inside && !(this.press?.drag) && !this.mouse.right && !this.mouse.middle;
    const want = steer ? Math.sign(c.x) * Math.pow(Math.min(1, Math.abs(c.x)), 1.4) * this.lean : 0;
    const leaned = damp(this.leaned, want, 5, dt);
    s.look.x += leaned - this.leaned;
    this.leaned = leaned;
    if (steer) { const edge = Math.min(1, Math.max(0, (Math.abs(c.x) - 0.84) / 0.14)); s.look.x += Math.sign(c.x) * Math.pow(edge, 1.5) * 1.2 * dt; }

    // gamepad: left stick moves (its tilt sets the speed), right stick looks, L3 sprints,
    // A jumps, LT strafes, d-pad up/down zooms
    const pad = this.pads ? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected) : null;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * (Math.abs(v) - 0.15) / 0.85);
      let px = dz(pad.axes[0] ?? 0), py = -dz(pad.axes[1] ?? 0);
      const pl = Math.hypot(px, py);
      if (pl > 1) { px /= pl; py /= pl; }
      const btn = (i) => !!pad.buttons[i]?.pressed;
      if (pl > 0.01) { s.move = { x: px, y: py }; s.device = 'pad'; s.walk = false; }
      const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
      s.look.x += rx * Math.abs(rx) * 3.2 * dt;
      s.look.y += ry * Math.abs(ry) * 2.2 * dt;
      if (btn(10) && !this.pad.l3) this.pad.sprint = !this.pad.sprint;
      if (pl < 0.2) this.pad.sprint = false;
      if (this.pad.sprint || btn(5)) s.sprint = true;
      if (btn(0) && !this.pad.a) s.jump = true;
      if ((pad.buttons[6]?.value ?? 0) > 0.4) s.strafe = true;
      if (btn(12)) s.zoom -= 4 * dt;
      if (btn(13)) s.zoom += 4 * dt;
      this.pad.a = btn(0); this.pad.l3 = btn(10);
      if (rx || ry || pl > 0.01 || btn(0)) s.device = 'pad';
    }
    return s;
  }
}
