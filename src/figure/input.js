// Keyboard, mouse and gamepad, read once a frame into one plain state.
//   move: {x, y} (x right, y forward, length 0..1), walk, sprint, strafe (held),
//   jump (pressed this frame), look: {x, y} (radians this frame), zoom (wheel steps this frame),
//   clicks: [{x, y, aim}] (quick clicks or taps on the picture this frame, in screen pixels; aim: made with the mouse
//   locked, at the aiming mark)
export class Input {
  constructor(el, { pads = true } = {}) {
    this.el = el;
    this.pads = pads; // off in headless checks: this PC's real gamepad shows up in headless browsers too
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, wheel: 0, right: false, drag: false };
    this.walkToggle = false;
    this.pad = { a: false, l3: false, sprint: false };
    this.sensitivity = 0.0022;
    this.override = null; // scripted input for captures
    this.lockable = true;
    // The mouse looks about: a click on the picture locks it to the picture (as games do), and from then on moving it
    // turns the eye; Esc lets it go. With it locked, a click is a place to walk to, at the aiming mark (`aim`, as a
    // fraction of the screen). Without it (a finger, or a browser that will not lock), a quick click or tap is a place
    // to walk to where it lands, and a press dragged looks about. Clicks count only when the game says a click means a
    // place (`clickable`, as it was when the button went down). L locks or frees the mouse as well.
    this.clicks = [];
    this.clickable = false;
    this.press = null;
    this.aim = { x: 0.5, y: 0.66 };
    const typing = () => document.activeElement?.tagName === 'INPUT';
    const locked = () => document.pointerLockElement === el;
    const down = (e) => {
      if (typing()) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'CapsLock') this.walkToggle = !this.walkToggle;
      if (e.code === 'KeyL' && !e.repeat) {
        if (locked()) document.exitPointerLock?.();
        else if (this.lockable) el.requestPointerLock?.()?.catch?.(() => {});
      }
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', () => { this.keys.clear(); this.press = null; el.classList.remove('dragging'); });
    el.addEventListener('mousedown', (e) => { if (e.button === 2) this.mouse.right = true; });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (locked() || this.mouse.right) { this.mouse.x += e.movementX; this.mouse.y += e.movementY; }
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (locked()) {
        if (this.clickable) this.clicks.push({ x: innerWidth * this.aim.x, y: innerHeight * this.aim.y, aim: true });
        return;
      }
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), drag: false, armed: this.clickable };
      el.setPointerCapture?.(e.pointerId);
      // (a mouse click locks it for looking; the place it was clicked on is still walked to)
      if (e.pointerType === 'mouse' && this.lockable) el.requestPointerLock?.()?.catch?.(() => {});
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.press;
      if (!p || e.pointerId !== p.id || locked()) { if (p && locked()) p.drag = false; return; }
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
      strafe: (this.mouse.right && document.pointerLockElement === this.el) || k.has('KeyF'),
      jump: this.pressed.has('Space'),
      look: { x: this.mouse.x * this.sensitivity, y: this.mouse.y * this.sensitivity },
      zoom: this.mouse.wheel,
      device: 'keyboard',
      clicks: this.clicks.splice(0),
    };
    this.mouse.x = this.mouse.y = this.mouse.wheel = 0;
    this.pressed.clear();

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
