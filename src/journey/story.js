// The journey as a game: six paintings, each a level of its own. In each, three pearls of light are to be found;
// when he has them a ring of light opens, and the ring is the way into the next. He swims ashore under Rex and
// climbs the striped hills; walks through the willows and the round wood to the ram's ledge; follows the violet
// way into the sunset to the horn-harp; wakes in the kings' garden, where the child takes his hand, and goes down
// to the pond; rides the salamander down the canal, through the gate, and flies it up to the mountain; and climbs
// the golden stair to the angel, who gives him the pearls strung. Then the sea rises over the mountain, he swims,
// and it begins again. If he is long without finding a pearl, sparks leave him and drift the way it lies.
import * as THREE from 'three';
import { PLACES } from './way.js';
import { heightAt, landAt, STAIR } from './land.js';
import { M4 } from './pieces.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const facing = (x, z, fx, fz) => Math.atan2(fx - x, fz - z);
const SAL = 0.86;      // how large the salamander is
const KID = 1.0;       // and the child
const HINT_AFTER = 24; // seconds without a pearl before the sparks show the way

export function createStory(ctx) {
  const { shared, hud, props, follow, player } = ctx;
  const T = props.things, P = PLACES;
  const sea = () => shared.uSea.value;
  const groundAt = (x, z) => Math.max(heightAt(x, z), sea());
  const stairYaw = Math.atan2(STAIR.dx, STAIR.dz);
  const D = P.dandelion, K = T.king.knee, Tr = P.terrace, S = P.summit;

  // start: where he stands and what he faces. ok: what the land map says of ground that belongs to the level.
  // pearls: [x, z, how high over the ground or the water, size]; in the flight the third number is the height itself.
  const LEVELS = [
    {
      id: 'sea', title: 'I · Jūra', sub: 'The Sea — find the three pearls of light, and a ring will open on the hilltop', opened: 'The ring of light opens on the hilltop',
      start: [3, 492, 3, 400], ok: (m) => m[3] < 0.2 && m[1] < 1.75,
      pearls: [[-5, 472, 0.9], [26, 336, 1.3], [D.x + 0.1, D.z, 2.9]],
    },
    {
      id: 'day', title: 'II · Diena', sub: 'Day — three pearls: between the willows, in the round wood, on the ram’s ledge', opened: 'The ring opens at the cliff’s edge, beyond the ram',
      start: [22, 230, 44, 172], ok: (m) => m[3] < 0.2 && m[1] > 1.25 && m[1] < 3.75,
      pearls: [[44, 172, 1.3], [2, 100, 1.3], [-61, 27, 1.3]],
    },
    {
      id: 'sunset', title: 'III · Saulėlydis', sub: 'Sunset — three pearls along the violet way, to the harp of horns', opened: 'The ring opens at the tip of the horn',
      start: [-30, -32, 6, -92], ok: (m) => m[3] < 0.2 && m[1] > 3.25 && m[1] < 4.75,
      pearls: [[-12, -62, 1.3], [-8, -118, 1.3], [17, -144, 1.3]],
    },
    {
      id: 'garden', title: 'IV · Karalių pasaka', sub: 'The Tale of the Kings — three pearls in the garden; the old king keeps one', opened: 'The ring opens down at the pond',
      start: [P.wake.x, P.wake.z, P.king.x, P.king.z], ok: (m) => m[3] < 0.2 && m[1] > 4.25,
      pearls: [[24, -226, 1.3], [K.x, K.z, 1.5], [6, -296, 1.3]],
    },
    {
      id: 'flight', title: 'V · Salamandra', sub: 'The Salamander — down the canal and through the gate; catch the pearls as it flies', opened: 'The great ring opens on the mountain', flight: true,
      pearls: [[226, P.canalZ, 1.6, 2.4], [312, P.canalZ, 15, 3], [350, -268, 86, 3]],
    },
    {
      id: 'offering', title: 'VI · Auka', sub: 'The Offering — three pearls, up the golden stair', opened: 'The cloud opens: the angel is coming down',
      start: [Tr.x - 3, Tr.z - 5, STAIR.ax, STAIR.az], ok: (m) => m[3] > 0.2,
      pearls: [[Tr.x + STAIR.dz * 12, Tr.z - STAIR.dx * 12, 1.3], [STAIR.ax + STAIR.dx * STAIR.len * 0.5, STAIR.az + STAIR.dz * STAIR.len * 0.5, 1.5], [S.x - STAIR.dx * 5, S.z - STAIR.dz * 5, 1.4]],
    },
  ];
  // where each level's ring of light stands: [x, base y, z, yaw, scale]
  const ring = (n) => {
    if (n === 0) return [-8.5, heightAt(-8.5, 262.5), 262.5, 0.5, 1];
    if (n === 1) return [-75, heightAt(-75, 30), 30, Math.PI / 2, 1.1];
    if (n === 2) { const t = T.harp.tip; return [t.x, t.y - 2.35, t.z, facing(t.x, t.z, 16, -140), 1]; }
    if (n === 3) return [47, Math.max(0, heightAt(47, -342.5)) - 0.2, -342.5, 1.0, 1.1];
    if (n === 4) return [Tr.x - 0.42 * 26, Tr.y + 3, Tr.z - 0.91 * 26, 0.43, 3.2];
    return null;
  };

  let level = -1, phase = 'boot', clock = 0, washGoal = 0, washRate = 1, after = null, started = false, frozen = false;
  let portal = null; // { centre: Vector3, reach }
  let got = 0, open = 0, idle = 0, hint = 0;
  const pearls = [0, 1, 2].map(() => ({ pos: V(), k: 1, got: false, t: 0 }));
  const lastGood = V(), tmp = V(), tmp2 = V(), up = V();
  const fl = { pos: V(), yaw: Math.PI / 2, pitch: 0, speed: 0, air: false, t: 0, turn: 0, climb: 0, bank: 0 };
  const kid = { pos: V(), yaw: 0, follows: false, speed: 0, near: false, hand: V() };
  const angel = { t: 0, called: false, here: false, given: false, gift: V() };
  const dandelion = { blow: 0, going: false };
  const finale = { on: false, t: 0, base: 0, swum: 0, told: false };
  const morph = { on: false, t: 0, at: V(58, 0, -350) }; // at the pond: the child becomes the salamander
  let audio = null, bells = null;

  function music() {
    if (audio) return;
    audio = new Audio('./audio/journey.m4a');
    audio.loop = true;
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && audio) audio.muted = !audio.muted; });
  /** A small bell, a step higher for each pearl; three together when the ring opens. */
  function bell(n) {
    if (audio?.muted || !started) return;
    try {
      bells ??= new (window.AudioContext || window.webkitAudioContext)();
      const now = bells.currentTime;
      [[523.25], [659.25], [783.99], [523.25, 783.99, 1046.5]][n].forEach((f, i) => {
        for (const [mult, gain] of [[1, 0.1], [2.01, 0.035], [3.02, 0.014]]) {
          const o = bells.createOscillator(), g = bells.createGain(), t0 = now + i * 0.16;
          o.type = 'sine'; o.frequency.value = f * mult;
          g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
          o.connect(g).connect(bells.destination); o.start(t0); o.stop(t0 + 2.5);
        }
      });
    } catch { /* no sound: nothing depends on it */ }
  }

  /** The card comes back through the paint, `fn` happens behind it, and the paint returns. */
  function transit(fn, out = 1.5, back = 2.0) {
    phase = 'transit';
    washGoal = 1; washRate = 1 / out;
    after = () => { fn(); washGoal = 0; washRate = 1 / back; after = () => { phase = 'play'; }; };
  }

  function enter(n) {
    level = n;
    const L = LEVELS[n];
    ctx.scripted = null; ctx.zone = null; ctx.flood = false;
    ctx.hold.want = 0; ctx.reach.want = 0;
    shared.uSea.value = 0;
    Object.assign(finale, { on: false, t: 0, base: 0, swum: 0, told: false });
    morph.on = false; morph.t = 0;
    Object.assign(angel, { t: 0, called: false, here: false, given: false });
    T.angel.show(0);
    T.smoke.show(n >= 4 ? 1 : 0);
    T.stairLight.show(n >= 4 ? 1 : 0);
    T.salamander.show(n >= 4 ? 1 : 0);
    T.kid.show(n === 3 ? 1 : 0);
    T.kidArm.show(n === 3 ? 1 : 0);
    T.kingHalo.show(0);
    T.ram.show(n === 1 ? 1 : 0);
    T.ghost.show(n === 0 ? 1 : 0);
    Object.assign(kid, { follows: false, speed: 0, yaw: T.king.yaw, near: false });
    kid.pos.copy(T.king.knee);
    Object.assign(dandelion, { blow: 0, going: false });
    T.dandelion.uniforms.uBlow.value = 0;
    // the pearls of this painting, and its ring, shut until he has them
    got = 0; open = 0; idle = 0; hint = 0;
    L.pearls.forEach((q, i) => {
      const pl = pearls[i];
      pl.got = false; pl.t = 0; pl.k = q[3] ?? 1;
      pl.pos.set(q[0], L.flight ? q[2] : groundAt(q[0], q[1]) + q[2], q[1]);
      T.pearls[i].set(pl.pos.x, pl.pos.y, pl.pos.z, pl.k);
      T.pearls[i].show(1);
    });
    T.motes.show(0);
    const r = ring(n);
    if (r) {
      T.portal.setMatrix(M4(r[0], r[1], r[2], r[3], r[4]), r[4]);
      portal = { centre: V(r[0], r[1] + 2.35 * r[4], r[2]), reach: r[4] };
    } else portal = null;
    T.portal.show(0);
    follow.want = L.flight ? 10.5 : 6.4;
    let x, z;
    if (L.flight) {
      Object.assign(fl, { yaw: Math.PI / 2, pitch: 0, speed: 0, air: false, t: 0, turn: 0, climb: 0, bank: 0 });
      fl.pos.set(62, 0.12, P.canalZ);
      follow.yaw = fl.yaw; follow.pitch = 0.3; follow.pivot.set(0, 0, 0);
      ctx.scripted = { root: V(), yaw: fl.yaw, pitch: 0, roll: 0, hide: false, ride: true };
      x = fl.pos.x; z = fl.pos.z;
      fly(0, { move: { x: 0, y: 0 } });
    } else {
      [x, z] = L.start;
      ctx.place(x, z, facing(x, z, L.start[2], L.start[3]));
      follow.pitch = 0.04;
      if (n === 5) { T.salamander.setMatrix(M4(Tr.x - 13, Tr.y + 0.1, Tr.z + 3, 0.4, SAL), SAL); T.salamander.move({ swim: 0.1 }); }
    }
    lastGood.set(x, 0, z);
    ctx.mood.update(0, ctx.zoneAt(x, z), 0);
    if (started) { hud.caption(L.title, L.sub, 11); hud.pearls(0, 3); }
  }
  const next = () => { const to = level + 1; transit(() => enter(to)); };

  /** The pearls: taken when he comes to them. Returns the nearest one still to be found, or null. */
  function gather(dt, from, flying) {
    let near = null, nd = Infinity;
    pearls.forEach((pl, i) => {
      if (pl.got) {
        // taken, it rises, swells and is gone
        if (pl.t < 1) {
          pl.t = Math.min(1, pl.t + dt / 0.8);
          T.pearls[i].set(pl.pos.x, pl.pos.y + 1.8 * pl.k * pl.t * pl.t, pl.pos.z, pl.k * (1 + 1.5 * pl.t));
          T.pearls[i].show(1 - pl.t);
        }
        return;
      }
      const flat = Math.hypot(from.x - pl.pos.x, from.z - pl.pos.z), dy = Math.abs(from.y + (flying ? 1 : 1.1) - pl.pos.y);
      if (flat < (flying ? 6 : 1.9) && dy < (flying ? 7 : 4)) {
        pl.got = true; got++; idle = 0;
        hud.pearls(got, 3);
        bell(got === 3 ? 3 : got - 1);
        if (got === 3) hud.caption('', LEVELS[level].opened, 7);
        return;
      }
      const d = Math.hypot(flat, dy);
      if (d < nd) { nd = d; near = pl; }
    });
    return near;
  }

  // --- the salamander: it swims the canal by itself, and beyond the gate it goes where he looks ---
  function fly(dt, inp) {
    fl.t += dt;
    const boost = inp.move.y > 0.3 ? 1.5 : inp.move.y < -0.3 ? 0.55 : 1;
    const yaw0 = fl.yaw, pitch0 = fl.pitch, steer = P.canalZ + 3.4 * clamp(inp.move.x, -1, 1);
    if (!fl.air) {
      fl.speed = damp(fl.speed, 9 * boost, 1.5, dt);
      fl.pos.x += fl.speed * dt;
      fl.pos.z = damp(fl.pos.z, steer, 2, dt);
      fl.pos.y = sea() + 0.1;
      if (fl.pos.x > P.gate.x + 8) {
        fl.air = true; fl.t = 0;
        hud.caption('', 'It flies where you look · W faster · S slower', 8);
      }
    } else {
      fl.speed = damp(fl.speed, 17 * boost, 1.2, dt);
      fl.yaw += wrap(follow.yaw - fl.yaw) * Math.min(1, 1.9 * dt);
      const want = clamp(-(follow.pitch - 0.3) * 1.3 + (fl.t < 3.5 ? 0.4 : 0), -0.7, 0.75); // at first it rises by itself
      fl.pitch = damp(fl.pitch, want, 2.2, dt);
      const cp = Math.cos(fl.pitch);
      fl.pos.x += Math.sin(fl.yaw) * cp * fl.speed * dt;
      fl.pos.z += Math.cos(fl.yaw) * cp * fl.speed * dt;
      fl.pos.y += Math.sin(fl.pitch) * fl.speed * dt;
      const floor = groundAt(fl.pos.x, fl.pos.z) + 1.2;
      if (fl.pos.y < floor) { fl.pos.y = floor; fl.pitch = Math.max(fl.pitch, 0); }
      fl.pos.y = Math.min(fl.pos.y, 235);
      fl.pos.x = clamp(fl.pos.x, -495, 495); fl.pos.z = clamp(fl.pos.z, -495, 495);
    }
    // how it is turning: it lies along the curve it flies, arches as it climbs or stoops, and banks into the turn
    if (dt > 0) {
      fl.turn = damp(fl.turn, wrap(fl.yaw - yaw0) / dt, 2.5, dt);
      fl.climb = damp(fl.climb, (fl.pitch - pitch0) / dt, 2.5, dt);
    }
    const sp = Math.max(fl.speed, 5), airK = fl.air ? Math.min(1, fl.t / 1.6) : 0;
    fl.bank = damp(fl.bank, fl.air ? clamp(-fl.turn * 0.6, -0.55, 0.55) * airK : clamp((steer - fl.pos.z) * 0.06, -0.2, 0.2), 3, dt);
    T.salamander.move({ swim: fl.air ? 0.8 : 1, fly: airK, gait: 1 - airK, tuck: airK, bend: clamp(fl.turn / sp, -0.035, 0.035), arch: clamp(fl.climb / sp, -0.02, 0.02) });
    const heave = fl.air ? 0.35 * Math.sin(ctx.time * 1.7) : 0.06 * Math.sin(ctx.time * 3.4);
    const m = M4(fl.pos.x, fl.pos.y + heave, fl.pos.z, fl.yaw, SAL, -fl.pitch * 0.9, fl.bank);
    T.salamander.setMatrix(m, SAL);
    // he sits astride its shoulders, and goes as it goes
    T.salamander.seat(ctx.time, tmp).applyMatrix4(m);
    up.set(0, 1, 0).transformDirection(m);
    ctx.scripted.root.copy(tmp).addScaledVector(up, -0.9);
    ctx.scripted.yaw = fl.yaw;
    ctx.scripted.pitch = -fl.pitch * 0.9 + 0.1;
    ctx.scripted.roll = fl.bank;
  }

  /** A matrix that lays a thing made one unit up y from `a` to `b`, `k` thick. */
  const link = (a, b, k, out = new THREE.Matrix4()) => {
    const y = V().copy(b).sub(a), x = V(y.z, 0, -y.x);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize().multiplyScalar(k);
    const z = V().crossVectors(x, y).normalize().multiplyScalar(k);
    return out.makeBasis(x, y, z).setPosition(a);
  };
  const armMatrix = new THREE.Matrix4(), shoulder = V();

  const story = {
    get frozen() { return frozen || phase === 'transit'; },
    /** True while the title is up and a click is waited for. */
    get waiting() { return !started; },
    get level() { return level; },
    /** For looking at it from a console: where things stand. */
    get state() { return { level, phase, got, open, hint, idle, pearls: pearls.map((q) => [+q.pos.x.toFixed(1), +q.pos.y.toFixed(1), +q.pos.z.toFixed(1), q.got]), portal: portal?.centre.toArray().map((v) => +v.toFixed(1)), fl, finale, angel, kid }; },
    enter,
    /** at: a level's id or number to start there (no title); otherwise the journey from its beginning. */
    begin(at) {
      const i = LEVELS.findIndex((l, k) => l.id === at || String(k + 1) === at);
      if (i >= 0) { started = true; enter(i); phase = 'play'; return; }
      enter(0);
      phase = 'play';
      // the first look: him in the sea with Rex behind him, as the film opens
      frozen = true;
      // (they stand to the right of the picture: the title is written on its left)
      ctx.eye = { position: V(-2.5, 2.3, 478), target: V(P.rex.x + 8.7, 5.5, P.rex.z), blend: 1 };
      const go = () => {
        if (started) return;
        started = true; frozen = false;
        hud.begin();
        hud.caption(LEVELS[0].title, LEVELS[0].sub, 11);
        hud.pearls(got, 3);
        music();
        removeEventListener('pointerdown', go); removeEventListener('keydown', go);
      };
      addEventListener('pointerdown', go); addEventListener('keydown', go);
    },
    update(dt, root, inp) {
      clock += dt;
      // the card
      const w = hud.wash;
      hud.wash = w < washGoal ? Math.min(washGoal, w + washRate * dt) : Math.max(washGoal, w - washRate * dt);
      if (after && hud.wash === washGoal) { const f = after; after = null; f(); }
      if (ctx.eye && started) { ctx.eye.blend -= dt / 4; if (ctx.eye.blend <= 0) ctx.eye = null; }
      if (level < 0) return;
      const L = LEVELS[level];
      if (!audio && started && (inp.move.x || inp.move.y)) music();

      if (level === 0) {
        // the dandelion lets its seeds go as he comes up to it, and the child's shade goes with them
        if (!dandelion.going && Math.hypot(root.x - D.x, root.z - D.z) < 4.2) dandelion.going = true;
        if (dandelion.going && dandelion.blow < 6) {
          dandelion.blow += dt * 0.4;
          T.dandelion.uniforms.uBlow.value = dandelion.blow;
          T.ghost.show(Math.max(0, 1 - dandelion.blow * 0.45));
        }
      } else if (level === 1) {
        // the ram paces its slab, out to the edge and back, stepping as it goes
        const a = clock * 0.1, u = 0.5 + 0.5 * Math.sin(a), x = -56 - 15 * u, z = 35 - 5.5 * u;
        const going = Math.cos(a) > 0, walk = Math.min(1, Math.abs(Math.cos(a)) * 3);
        T.ram.setMatrix(M4(x, heightAt(x, z) + 0.03 * walk * Math.abs(Math.sin(clock * 7)), z, facing(0, 0, going ? -15 : 15, going ? -5.5 : 5.5), 1.3, 0.02 * walk * Math.sin(clock * 7)), 1.3);
        T.ram.uniforms.uWalk.value = walk;
      } else if (level === 3) {
        // the child waits at the king's knee; once met it takes his left hand, and walks at his side
        const kp = kid.pos, fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
        if (morph.on) {
          // it lets go, runs down into the pond and sinks, and where it sank the salamander rises and grows
          morph.t += dt;
          const d = Math.hypot(morph.at.x - kp.x, morph.at.z - kp.z);
          if (d > 0.1) { const v = Math.min(d * 3, 6); kp.x += (morph.at.x - kp.x) / d * v * dt; kp.z += (morph.at.z - kp.z) / d * v * dt; kid.yaw = Math.atan2(morph.at.x - kp.x, morph.at.z - kp.z); }
          kid.speed = damp(kid.speed, d > 0.3 ? 3 : 0, 6, dt);
          const there = 1 - clamp((morph.t - 1.4) / 1.0, 0, 1);
          T.kid.show(there); T.kidArm.show(there);
          const grow = clamp((morph.t - 1.8) / 2.6, 0, 1), g = grow * grow * (3 - 2 * grow), sc = 0.1 + (SAL - 0.1) * g;
          T.salamander.show(clamp((morph.t - 1.7) / 0.6, 0, 1));
          T.salamander.setMatrix(M4(morph.at.x, 0.1 - 0.6 * (1 - g), morph.at.z, Math.PI / 2 + 1.2 * (1 - g), sc), sc);
          T.salamander.move({ swim: 0.5 + 0.5 * (1 - g), gait: 0.6 });
          if (morph.t > 5.2) { morph.on = false; frozen = false; next(); }
        } else if (!kid.follows) {
          if (Math.hypot(root.x - kp.x, root.z - kp.z) < 3.4) {
            kid.follows = true;
            T.kingHalo.show(1);
            hud.caption('', 'The child takes your hand', 6);
          }
        } else {
          // at his left side, half a step behind
          const tx = root.x + fz * 0.46 - fx * 0.14, tz = root.z - fx * 0.46 - fz * 0.14;
          const d = Math.hypot(tx - kp.x, tz - kp.z), v = Math.min(d * 11, 9.5);
          if (d > 0.01) { const step = Math.min(v * dt, d); kp.x += (tx - kp.x) / d * step; kp.z += (tz - kp.z) / d * step; }
          kid.yaw += wrap((d > 0.6 ? Math.atan2(tx - kp.x, tz - kp.z) : player.yaw) - kid.yaw) * Math.min(1, 9 * dt);
          kid.speed = damp(kid.speed, Math.max(v, d < 0.6 ? player.speed : 0), 8, dt);
          kid.near = d < 0.75;
        }
        kp.y = groundAt(kp.x, kp.z);
        const km = M4(kp.x, kp.y, kp.z, kid.yaw, KID);
        T.kid.setMatrix(km, KID);
        T.kid.uniforms.uWalk.value = Math.min(1, kid.speed / 1.1);
        // its arm: up into his hand while they walk together, hanging at its side otherwise
        shoulder.copy(T.kid.shoulder).applyMatrix4(km);
        const holding = kid.follows && !morph.on && kid.near && ctx.swim < 0.3;
        ctx.hold.want = holding ? 1 : 0;
        if (holding) {
          const hx = root.x - shoulder.x, hz = root.z - shoulder.z, hl = Math.hypot(hx, hz) || 1;
          ctx.hold.target.set(shoulder.x + (hx / hl) * 0.15, shoulder.y + 0.2, shoulder.z + (hz / hl) * 0.15);
        }
        const held = ctx.hold.weight;
        ctx.body.joint('hand_l', tmp);
        tmp2.set(-0.17, 0.4, 0.05).applyMatrix4(km);
        kid.hand.copy(tmp2).lerp(tmp, held * held * (3 - 2 * held));
        T.kidArm.setMatrix(link(shoulder, kid.hand, KID, armMatrix), KID);
      } else if (level === 4) {
        if (phase === 'play') fly(dt, inp);
      } else if (level === 5) {
        // when he has the three pearls the cloud opens, and the angel comes down flying with the rope of them
        const ax = S.x + STAIR.dx * 6, az = S.z + STAIR.dz * 6;
        if (!angel.called && got >= 3) { angel.called = true; T.angel.show(1); }
        if (angel.called) {
          angel.t = Math.min(1, angel.t + dt / 9);
          // (she wheels down out of the cloud on her wings, and stands up in the air before him)
          const e = 1 - Math.pow(1 - angel.t, 3), air = 1 - e, turn = air * 5.2;
          const y = S.y + 2.4 + 52 * air + 0.35 * Math.sin(clock * 0.9);
          const x = ax + Math.sin(turn) * 26 * air, z = az + Math.cos(turn) * 26 * air;
          const m = M4(x, y, z, stairYaw + Math.PI + turn * 0.8, 1, 1.05 * Math.min(1, air * 2.2), 0.3 * Math.sin(turn) * air);
          T.angel.setMatrix(m, 1);
          angel.gift.copy(T.angel.gift).applyMatrix4(m);
          angel.here = angel.t > 0.94;
          if (angel.here && !angel.given) {
            const d = Math.hypot(root.x - angel.gift.x, root.z - angel.gift.z);
            ctx.reach.want = d < 5 ? 1 : 0;
            ctx.reach.target.copy(angel.gift);
            if (d < 2.3) {
              angel.given = true;
              bell(3);
              hud.caption('Perlai', 'The pearls are yours. The sea is rising.', 9);
              Object.assign(finale, { on: true, t: 0, base: root.y, swum: 0, told: false });
            }
          }
        }
        if (finale.on) {
          // the angel goes; the sea comes up over the mountain and lifts him; he swims; and it all begins again
          finale.t += dt;
          T.angel.show(Math.max(0, 1 - finale.t / 5));
          if (finale.t > 3) ctx.reach.want = 0;
          const k = clamp((finale.t - 3) / 15, 0, 1);
          shared.uSea.value = (finale.base + 2.4) * k * k * (3 - 2 * k) + (k >= 1 ? (finale.t - 18) * 0.25 : 0);
          ctx.zone = 0; ctx.flood = true;
          if (ctx.swim > 0.6) {
            finale.swum += dt;
            if (!finale.told) { finale.told = true; hud.caption('', 'The sea has the mountain. Swim.', 6); }
          }
          if (phase === 'play' && finale.swum > 7) transit(() => enter(0), 3, 3);
        }
      }

      const playing = phase === 'play' && started && !frozen;
      const from = level === 4 ? fl.pos : root;
      // the pearls, and the sparks that show where the next lies when he has been long without one
      const near = gather(dt, from, level === 4);
      if (got >= 3 && portal && open < 1) { open = Math.min(1, open + dt / 1.8); T.portal.show(open); }
      if (playing && !finale.on) idle += dt;
      const goal = near ? near.pos : portal ? portal.centre : level === 5 && !angel.given ? tmp.set(S.x + STAIR.dx * 6, S.y + 2, S.z + STAIR.dz * 6) : null;
      hint = damp(hint, playing && goal && idle > (level === 4 ? 14 : HINT_AFTER) ? 1 : 0, 1.2, dt);
      T.motes.show(hint > 0.02 ? hint : 0);
      if (hint > 0.02 && goal) {
        const u = T.motes.uniforms, far = level === 4;
        u.uFrom.value.set(from.x, from.y + (far ? 1.5 : 0.1), from.z);
        u.uTo.value.copy(goal);
        u.uReach.value = far ? 46 : 15;
        u.uSizeK.value = far ? 3 : 1;
      }

      // the ring of light, once it stands
      if (phase === 'play' && portal && open > 0.9 && started && !morph.on) {
        const flat = Math.hypot(from.x - portal.centre.x, from.z - portal.centre.z);
        // (flown at, the ring is forgiving: anywhere near it will do)
        const d = level === 4 ? Math.max(flat, Math.abs(from.y - portal.centre.y) * 0.6) : flat;
        if (level !== 4) {
          ctx.reach.want = flat < 4.5 ? 1 : 0;
          ctx.reach.target.copy(portal.centre);
        }
        if (d < (level === 4 ? 3 : 1.25) * portal.reach) {
          ctx.reach.want = 0;
          if (level === 3) {
            // at the pond he stops, and watches what the child does
            morph.on = true; morph.t = 0; frozen = true;
            if (!kid.follows) { kid.follows = true; kid.pos.set(root.x + 1, 0, root.z + 0.5); }
            T.kid.show(1); T.kidArm.show(1);
            hud.caption('', 'The child lets go, runs down into the water — and comes up a salamander', 7);
          } else next();
        }
      }
      // the edge of the painting: he is not let past it
      if (phase === 'play' && L.ok && !ctx.scripted && !finale.on) {
        // (off the mountain's shoulder there is no way back up: he is set on the terrace again)
        const fallen = level === 5 && root.y < Tr.y - 7;
        if (L.ok(landAt(root.x, root.z)) && !fallen) lastGood.copy(root);
        else if (level === 5) { const yaw = follow.yaw; ctx.place(L.start[0], L.start[1], player.yaw); follow.yaw = yaw; }
        else { const yaw = follow.yaw; ctx.place(lastGood.x, lastGood.z, player.yaw); follow.yaw = yaw; }
      }
    },
  };
  return story;
}
