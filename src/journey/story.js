// The journey as a game: six paintings, each a level of its own, each left by a ring of light that opens on the
// next. He swims ashore under Rex and climbs the striped hills; walks through the willows and the round wood to
// the ram's ledge; follows the violet way into the sunset to the horn-harp; wakes in the kings' garden, where the
// child joins him, and goes down to the pond; rides the salamander down the canal, through the gate, and flies it
// up to the mountain; and climbs the golden stair to the angel, who gives him the pearls. Then the sea rises, and
// it begins again.
import * as THREE from 'three';
import { PLACES } from './way.js';
import { heightAt, landAt, STAIR } from './land.js';
import { M4 } from './pieces.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const facing = (x, z, fx, fz) => Math.atan2(fx - x, fz - z);

export function createStory(ctx) {
  const { shared, hud, props, follow, player } = ctx;
  const T = props.things, P = PLACES;
  const sea = () => shared.uSea.value;
  const groundAt = (x, z) => Math.max(heightAt(x, z), sea());
  const stairYaw = Math.atan2(STAIR.dx, STAIR.dz);

  // start: where he stands and what he faces. ok: what the land map says of ground that belongs to the level.
  const LEVELS = [
    { id: 'sea', title: 'I · Jūra', sub: 'The Sea — swim ashore, and climb the hills to the ring of light', start: [3, 492, 3, 400], ok: (m) => m[3] < 0.2 && m[1] < 1.75 },
    { id: 'day', title: 'II · Diena', sub: 'Day — past the willows and through the round wood, to the ram’s ledge', start: [22, 230, 44, 172], ok: (m) => m[3] < 0.2 && m[1] > 1.25 && m[1] < 3.75 },
    { id: 'sunset', title: 'III · Saulėlydis', sub: 'Sunset — the violet way leads to the harp of horns', start: [-30, -32, 6, -92], ok: (m) => m[3] < 0.2 && m[1] > 3.25 && m[1] < 4.75 },
    { id: 'garden', title: 'IV · Karalių pasaka', sub: 'The Tale of the Kings — find the old king, then go down to the pond', start: [P.wake.x, P.wake.z, P.king.x, P.king.z], ok: (m) => m[3] < 0.2 && m[1] > 4.25 },
    { id: 'flight', title: 'V · Salamandra', sub: 'The Salamander — down the canal, through the gate of light', flight: true },
    { id: 'offering', title: 'VI · Auka', sub: 'The Offering — climb the golden stair', start: [P.terrace.x - 3, P.terrace.z - 5, STAIR.ax, STAIR.az], ok: (m) => m[3] > 0.2 },
  ];
  // where each level's ring of light stands: [x, base y, z, yaw, scale]
  const ring = (n) => {
    if (n === 0) return [-8.5, heightAt(-8.5, 262.5), 262.5, 0.5, 1];
    if (n === 1) return [-75, heightAt(-75, 30), 30, Math.PI / 2, 1.1];
    if (n === 2) { const t = T.harp.tip; return [t.x, t.y - 2.35, t.z, facing(t.x, t.z, 16, -140), 1]; }
    if (n === 3) return [47, Math.max(0, heightAt(47, -342.5)) - 0.2, -342.5, 1.0, 1.1];
    if (n === 4) return [P.terrace.x - 0.42 * 26, P.terrace.y + 3, P.terrace.z - 0.91 * 26, 0.43, 3.2];
    return null;
  };

  let level = -1, phase = 'boot', clock = 0, pearls = 0, washGoal = 0, washRate = 1, after = null, started = false, frozen = false;
  let portal = null; // { centre: Vector3, reach }
  const lastGood = V();
  const fl = { pos: V(), yaw: Math.PI / 2, pitch: 0, speed: 0, air: false, t: 0 };
  const kid = { pos: V(), yaw: 0, follows: false, speed: 0 };
  const angel = { t: 0, called: false, here: false, given: false, gift: V() };
  const dandelion = { blow: 0, going: false };
  const finale = { on: false, t: 0 };
  const morph = { on: false, t: 0, at: V(58, 0, -350) }; // at the pond: the child becomes the salamander
  let audio = null;

  function music() {
    if (audio) return;
    audio = new Audio('./audio/journey.m4a');
    audio.loop = true;
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && audio) audio.muted = !audio.muted; });

  /** The card comes back through the paint, `fn` happens behind it, and the paint returns. */
  function transit(fn, out = 1.5, back = 2.0) {
    phase = 'transit';
    washGoal = 1; washRate = 1 / out;
    after = () => { fn(); washGoal = 0; washRate = 1 / back; after = () => { phase = 'play'; }; };
  }

  function enter(n) {
    level = n;
    const L = LEVELS[n];
    ctx.scripted = null; ctx.zone = null;
    shared.uSea.value = 0;
    finale.on = false; finale.t = 0;
    morph.on = false; morph.t = 0;
    Object.assign(angel, { t: 0, called: false, here: false, given: false });
    T.angel.show(0);
    T.smoke.show(n >= 4 ? 1 : 0);
    T.stairLight.show(n >= 4 ? 1 : 0);
    T.salamander.show(n >= 4 ? 1 : 0);
    T.kid.show(n === 3 ? 1 : 0);
    T.kingHalo.show(0);
    T.ram.show(n === 1 ? 1 : 0);
    T.ghost.show(n === 0 ? 1 : 0);
    Object.assign(kid, { follows: false, speed: 0, yaw: T.king.yaw });
    kid.pos.copy(T.king.knee);
    Object.assign(dandelion, { blow: 0, going: false });
    T.dandelion.uniforms.uBlow.value = 0;
    const r = ring(n);
    if (r) {
      T.portal.show(1);
      T.portal.setMatrix(M4(r[0], r[1], r[2], r[3], r[4]), r[4]);
      portal = { centre: V(r[0], r[1] + 2.35 * r[4], r[2]), reach: r[4] };
    } else { T.portal.show(0); portal = null; }
    follow.want = L.flight ? 11.5 : 6.4;
    let x, z;
    if (L.flight) {
      fl.pos.set(62, 0.12, P.canalZ); fl.yaw = Math.PI / 2; fl.pitch = 0; fl.speed = 0; fl.air = false; fl.t = 0;
      follow.yaw = fl.yaw; follow.pitch = 0.14; follow.pivot.set(0, 0, 0);
      ctx.scripted = { root: V(), yaw: fl.yaw, pitch: 0, hide: false };
      x = fl.pos.x; z = fl.pos.z;
      fly(0, { move: { x: 0, y: 0 } });
    } else {
      [x, z] = L.start;
      ctx.place(x, z, facing(x, z, L.start[2], L.start[3]));
      follow.pitch = 0.04;
      if (n === 5) { T.salamander.setMatrix(M4(P.terrace.x - 11.5, P.terrace.y + 0.1, P.terrace.z + 2, 0.4, 1.3), 1.3); T.salamander.uniforms.uSwim.value = 0.12; }
    }
    lastGood.set(x, 0, z);
    ctx.mood.update(0, ctx.zoneAt(x, z), 0);
    hud.caption(L.title, L.sub, 10);
    hud.pearls(pearls, LEVELS.length);
  }
  function next() {
    pearls = Math.max(pearls, level + 1);
    hud.pearls(pearls, LEVELS.length);
    const to = level + 1;
    transit(() => enter(to));
  }

  // --- the salamander: it swims the canal by itself, and beyond the gate it goes where he looks ---
  function fly(dt, inp) {
    fl.t += dt;
    const boost = inp.move.y > 0.3 ? 1.5 : inp.move.y < -0.3 ? 0.55 : 1;
    if (!fl.air) {
      fl.speed = damp(fl.speed, 9 * boost, 1.5, dt);
      fl.pos.x += fl.speed * dt;
      fl.pos.z = damp(fl.pos.z, P.canalZ + 3.4 * clamp(inp.move.x, -1, 1), 2, dt);
      fl.pos.y = sea() + 0.1;
      if (fl.pos.x > P.gate.x + 8) {
        fl.air = true; fl.t = 0;
        hud.caption('', 'It flies where you look · W faster · S slower — to the ring of light on the mountain', 9);
      }
    } else {
      fl.speed = damp(fl.speed, 17 * boost, 1.2, dt);
      fl.yaw += wrap(follow.yaw - fl.yaw) * Math.min(1, 2.2 * dt);
      const want = clamp(-(follow.pitch - 0.14) * 1.3 + (fl.t < 3.5 ? 0.4 : 0), -0.7, 0.75); // at first it rises by itself
      fl.pitch = damp(fl.pitch, want, 2.5, dt);
      const cp = Math.cos(fl.pitch);
      fl.pos.x += Math.sin(fl.yaw) * cp * fl.speed * dt;
      fl.pos.z += Math.cos(fl.yaw) * cp * fl.speed * dt;
      fl.pos.y += Math.sin(fl.pitch) * fl.speed * dt;
      const floor = groundAt(fl.pos.x, fl.pos.z) + 0.6;
      if (fl.pos.y < floor) { fl.pos.y = floor; fl.pitch = Math.max(fl.pitch, 0); }
      fl.pos.y = Math.min(fl.pos.y, 235);
      fl.pos.x = clamp(fl.pos.x, -495, 495); fl.pos.z = clamp(fl.pos.z, -495, 495);
    }
    const s = 1.3, m = M4(fl.pos.x, fl.pos.y, fl.pos.z, fl.yaw, s, -fl.pitch * 0.8);
    T.salamander.setMatrix(m, s);
    T.salamander.uniforms.uSwim.value = fl.air ? 0.55 : 1;
    ctx.scripted.root.copy(T.salamander.seat).applyMatrix4(m);
    ctx.scripted.yaw = fl.yaw;
    ctx.scripted.pitch = -fl.pitch * 0.5;
  }

  const story = {
    get frozen() { return frozen || phase === 'transit'; },
    get level() { return level; },
    enter,
    /** at: a level's id or number to start there (no title); otherwise the journey from its beginning. */
    begin(at) {
      const i = LEVELS.findIndex((l, k) => l.id === at || String(k + 1) === at);
      if (i >= 0) { started = true; pearls = i; enter(i); phase = 'play'; return; }
      enter(0);
      phase = 'play';
      // the first look: him in the sea with Rex behind him, as the film opens
      frozen = true;
      hud.title(true);
      ctx.eye = { position: V(-2.5, 2.3, 478), target: V(P.rex.x - 1, 5.6, P.rex.z), blend: 1 };
      const go = () => {
        if (started) return;
        started = true; frozen = false;
        hud.title(false);
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
        const D = P.dandelion;
        if (!dandelion.going && Math.hypot(root.x - D.x, root.z - D.z) < 4.2) dandelion.going = true;
        if (dandelion.going && dandelion.blow < 6) {
          dandelion.blow += dt * 0.4;
          T.dandelion.uniforms.uBlow.value = dandelion.blow;
          T.ghost.show(Math.max(0, 1 - dandelion.blow * 0.45));
        }
      } else if (level === 1) {
        // the ram paces its slab, out to the edge and back
        const a = clock * 0.1, u = 0.5 + 0.5 * Math.sin(a), x = -56 - 15 * u, z = 35 - 5.5 * u;
        const going = Math.cos(a) > 0;
        T.ram.setMatrix(M4(x, heightAt(x, z), z, facing(0, 0, going ? -15 : 15, going ? -5.5 : 5.5), 1.3), 1.3);
        T.ram.uniforms.uWalk.value = Math.min(1, Math.abs(Math.cos(a)) * 3);
      } else if (level === 3) {
        // the child waits at the king's knee; once met, it walks at his side
        const kp = kid.pos;
        if (morph.on) {
          // it runs down into the pond, sinks, and where it sank the salamander rises and grows
          morph.t += dt;
          const d = Math.hypot(morph.at.x - kp.x, morph.at.z - kp.z);
          if (d > 0.1) { const v = Math.min(d * 3, 6); kp.x += (morph.at.x - kp.x) / d * v * dt; kp.z += (morph.at.z - kp.z) / d * v * dt; kid.yaw = Math.atan2(morph.at.x - kp.x, morph.at.z - kp.z); }
          kid.speed = damp(kid.speed, d > 0.3 ? 3 : 0, 6, dt);
          T.kid.show(1 - clamp((morph.t - 1.4) / 1.0, 0, 1));
          const grow = clamp((morph.t - 1.8) / 2.2, 0, 1), g = grow * grow * (3 - 2 * grow), sc = 0.12 + 1.18 * g;
          T.salamander.show(clamp((morph.t - 1.7) / 0.6, 0, 1));
          T.salamander.setMatrix(M4(morph.at.x, 0.1 - 0.5 * (1 - g), morph.at.z, Math.PI / 2, sc), sc);
          T.salamander.uniforms.uSwim.value = 0.7;
          if (morph.t > 4.6) { morph.on = false; frozen = false; next(); }
        } else if (!kid.follows) {
          if (Math.hypot(root.x - kp.x, root.z - kp.z) < 3.4) {
            kid.follows = true;
            T.kingHalo.show(1);
            hud.caption('', 'The child takes your hand. Go down to the pond.', 7);
          }
        } else {
          const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
          const tx = root.x - fz * 0.8 - fx * 0.25, tz = root.z + fx * 0.8 - fz * 0.25;
          const d = Math.hypot(tx - kp.x, tz - kp.z), v = Math.min(d * 3.2, 7);
          if (d > 0.05) { kp.x += (tx - kp.x) / d * v * dt; kp.z += (tz - kp.z) / d * v * dt; kid.yaw += wrap((d > 0.4 ? Math.atan2(tx - kp.x, tz - kp.z) : player.yaw) - kid.yaw) * Math.min(1, 8 * dt); }
          kid.speed = damp(kid.speed, v, 6, dt);
        }
        kp.y = groundAt(kp.x, kp.z);
        T.kid.setMatrix(M4(kp.x, kp.y, kp.z, kid.yaw, 1.15), 1.15);
        T.kid.uniforms.uWalk.value = Math.min(1, kid.speed / 1.4);
      } else if (level === 4) {
        if (phase === 'play') fly(dt, inp);
      } else if (level === 5) {
        // on the summit the cloud opens and the angel comes down with the pearls
        const S = P.summit, ax = S.x + STAIR.dx * 6, az = S.z + STAIR.dz * 6;
        if (!angel.called && Math.hypot(root.x - S.x, root.z - S.z) < 21) {
          angel.called = true;
          T.angel.show(1);
          hud.caption('', 'Auka — the angel comes down with the pearls', 7);
        }
        if (angel.called) {
          angel.t = Math.min(1, angel.t + dt / 7);
          const e = 1 - Math.pow(1 - angel.t, 3), y = S.y + 2.4 + 48 * (1 - e) + 0.35 * Math.sin(clock * 0.9);
          const m = M4(ax, y, az, stairYaw + Math.PI, 1);
          T.angel.setMatrix(m, 1);
          angel.gift.copy(T.angel.gift).applyMatrix4(m);
          angel.here = angel.t > 0.92;
          if (angel.here && !angel.given) {
            const d = Math.hypot(root.x - angel.gift.x, root.z - angel.gift.z);
            ctx.reach.want = d < 5 ? 1 : 0;
            ctx.reach.target.copy(angel.gift);
            if (d < 2.3) {
              angel.given = true;
              pearls = LEVELS.length;
              hud.pearls(pearls, LEVELS.length);
              hud.caption('Perlai', 'The pearls are yours. The sea is rising.', 9);
              finale.on = true; finale.t = 0;
            }
          }
        }
        if (finale.on) {
          // the angel goes, the sea comes up over the mountain, and it all begins again
          finale.t += dt;
          T.angel.show(Math.max(0, 1 - finale.t / 5));
          if (finale.t > 3) ctx.reach.want = 0;
          const k = clamp((finale.t - 3) / 22, 0, 1);
          shared.uSea.value = (root.y + 1.3) * k * k * (3 - 2 * k) + (k >= 1 ? (finale.t - 25) * 0.5 : 0);
          ctx.zone = 0;
          if (phase === 'play' && shared.uSea.value > root.y + 1.1) transit(() => enter(0), 3, 3);
        }
      }

      // the ring of light
      if (phase === 'play' && portal && started && !morph.on) {
        const from = level === 4 ? fl.pos : root;
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
            T.kid.show(1);
            hud.caption('', 'The child runs down into the water — and comes up a salamander', 6);
          } else next();
        }
      }
      // the edge of the painting: he is not let past it
      if (phase === 'play' && L.ok && !ctx.scripted) {
        // (off the mountain's shoulder there is no way back up: he is set on the terrace again)
        const fallen = level === 5 && !finale.on && root.y < P.terrace.y - 7;
        if (L.ok(landAt(root.x, root.z)) && !fallen) lastGood.copy(root);
        else if (level === 5) { const yaw = follow.yaw; ctx.place(L.start[0], L.start[1], player.yaw); follow.yaw = yaw; }
        else { const yaw = follow.yaw; ctx.place(lastGood.x, lastGood.z, player.yaw); follow.yaw = yaw; }
      }
    },
  };
  return story;
}
