// The flesh as a distance field: lumps of clay (a ball, or a ball rolled out so that it is thicker at one end)
// pressed into one another until they join. From the field come the skin that is drawn, the way a coil is laid
// against it, which bone each part of it follows, and how dark it is in the creases.

// One lump: a segment a..b swept by a ball whose radius goes from ra to rb. `zs` flattens it sideways.
export function lump(a, b, ra, rb, bone, zs = 1) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = (b[2] - a[2]) / zs;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb;
  return { ax: a[0], ay: a[1], az: a[2] / zs, bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: l2 > 1e-9 ? 1 / l2 : 0, ra, rb, bone, iz: 1 / zs };
}

function lumpDistance(c, px, py, pz) {
  const x = px - c.ax, y = py - c.ay, z = pz * c.iz - c.az;
  if (c.l2 < 1e-9) return Math.sqrt(x * x + y * y + z * z) - c.ra;
  const yy = x * c.bax + y * c.bay + z * c.baz;
  const zz = yy - c.l2;
  const qx = x * c.l2 - c.bax * yy, qy = y * c.l2 - c.bay * yy, qz = z * c.l2 - c.baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * c.l2, z2 = zz * zz * c.l2;
  const k = Math.sign(c.rr) * c.rr * c.rr * x2;
  if (Math.sign(zz) * c.a2 * z2 > k) return Math.sqrt(x2 + z2) * c.il2 - c.rb;
  if (Math.sign(yy) * c.a2 * y2 < k) return Math.sqrt(x2 + y2) * c.il2 - c.ra;
  return (Math.sqrt(x2 * c.a2 * c.il2) + yy * c.rr) * c.il2 - c.ra;
}

// The lumps joined, with a soft fillet of width k where two meet.
export function makeField(lumps, k, boneCount) {
  const n = lumps.length;
  const each = new Float32Array(n);
  const perBone = new Float32Array(boneCount);

  function at(x, y, z) {
    let d = 1e9;
    for (let i = 0; i < n; i++) {
      const di = lumpDistance(lumps[i], x, y, z);
      each[i] = di;
      const h = Math.max(k - Math.abs(d - di), 0) / k;
      d = Math.min(d, di) - h * h * k * 0.25;
    }
    return d;
  }

  const E = 0.003;
  function normal(x, y, z, out) {
    const gx = at(x + E, y, z) - at(x - E, y, z);
    const gy = at(x, y + E, z) - at(x, y - E, z);
    const gz = at(x, y, z + E) - at(x, y, z - E);
    const l = Math.hypot(gx, gy, gz) || 1;
    out[0] = gx / l; out[1] = gy / l; out[2] = gz / l;
    return l / (2 * E); // how fast the field changes here, 1 for a true distance
  }

  // Walk from o along d until the skin (or `lift` above it) is met. Returns the distance walked.
  function cast(o, d, lift = 0) {
    let t = 0;
    for (let i = 0; i < 90; i++) {
      const v = at(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) - lift;
      if (v < 0.0008) break;
      t += v * 0.7;
      if (t > 20) return -1;
    }
    return t;
  }

  // Which bones a point of the flesh follows, up to four, by how near each bone's lumps are.
  function weights(x, y, z, sigma, idx, w, o) {
    at(x, y, z);
    perBone.fill(1e9);
    for (let i = 0; i < n; i++) if (each[i] < perBone[lumps[i].bone]) perBone[lumps[i].bone] = each[i];
    let dmin = 1e9;
    for (let b = 0; b < boneCount; b++) if (perBone[b] < dmin) dmin = perBone[b];
    let sum = 0;
    for (let s = 0; s < 4; s++) {
      let best = -1, bd = 1e9;
      for (let b = 0; b < boneCount; b++) if (perBone[b] < bd) { bd = perBone[b]; best = b; }
      const ww = best < 0 ? 0 : Math.exp(-(bd - dmin) / sigma);
      idx[o + s] = best < 0 ? 0 : best;
      w[o + s] = ww < 0.02 ? 0 : ww;
      sum += w[o + s];
      if (best >= 0) perBone[best] = 1e9;
    }
    for (let s = 0; s < 4; s++) w[o + s] /= sum;
  }

  return { at, normal, cast, weights, lumps };
}

// The field sampled on a grid of step h over a box, coarse blocks far from the skin filled without looking closer.
export function sampleGrid(field, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const v = new Float32Array(nx * ny * nz);
  const B = 4, far = h * (B * 0.87 + 1) * 1.45;
  for (let bz = 0; bz < nz; bz += B) for (let by = 0; by < ny; by += B) for (let bx = 0; bx < nx; bx += B) {
    const c = field.at(min[0] + (bx + B / 2) * h, min[1] + (by + B / 2) * h, min[2] + (bz + B / 2) * h);
    const fill = Math.abs(c) > far;
    for (let z = bz; z < Math.min(bz + B, nz); z++) for (let y = by; y < Math.min(by + B, ny); y++) for (let x = bx; x < Math.min(bx + B, nx); x++) {
      v[x + nx * (y + ny * z)] = fill ? c : field.at(min[0] + x * h, min[1] + y * h, min[2] + z * h);
    }
  }
  return { v, nx, ny, nz, min, h };
}

// A skin drawn over the grid where the field crosses zero ("surface nets"): one point in every cell the skin
// passes through, joined to its neighbours, then each point slid exactly onto the skin.
export function skin(field, grid) {
  const { v, nx, ny, nz, min, h } = grid;
  const cell = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [], tri = [];
  const g = new Float32Array(8);
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let mask = 0;
    for (let i = 0; i < 8; i++) {
      const s = v[(x + (i & 1)) + nx * ((y + ((i >> 1) & 1)) + ny * (z + ((i >> 2) & 1)))];
      g[i] = s;
      if (s < 0) mask |= 1 << i;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (let e = 0; e < 24; e += 2) {
      const i0 = EDGES[e], i1 = EDGES[e + 1];
      if (((mask >> i0) & 1) === ((mask >> i1) & 1)) continue;
      const t = g[i0] / (g[i0] - g[i1]);
      sx += (i0 & 1) + ((i1 & 1) - (i0 & 1)) * t;
      sy += ((i0 >> 1) & 1) + (((i1 >> 1) & 1) - ((i0 >> 1) & 1)) * t;
      sz += ((i0 >> 2) & 1) + (((i1 >> 2) & 1) - ((i0 >> 2) & 1)) * t;
      cnt++;
    }
    cell[x + nx * (y + ny * z)] = pos.length / 3;
    pos.push(min[0] + (x + sx / cnt) * h, min[1] + (y + sy / cnt) * h, min[2] + (z + sz / cnt) * h);
  }
  const step = [1, nx, nx * ny];
  const dim = [nx, ny, nz];
  const p = [0, 0, 0];
  for (p[2] = 1; p[2] < nz - 1; p[2]++) for (p[1] = 1; p[1] < ny - 1; p[1]++) for (p[0] = 1; p[0] < nx - 1; p[0]++) {
    const at = p[0] + nx * (p[1] + ny * p[2]);
    const in0 = v[at] < 0;
    for (let a = 0; a < 3; a++) {
      if (p[a] + 1 >= dim[a]) continue;
      if ((v[at + step[a]] < 0) === in0) continue;
      const u = step[(a + 1) % 3], w = step[(a + 2) % 3];
      const c0 = cell[at], c1 = cell[at - u], c2 = cell[at - u - w], c3 = cell[at - w];
      if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) continue;
      if (in0) tri.push(c0, c1, c2, c0, c2, c3); else tri.push(c0, c2, c1, c0, c3, c2);
    }
  }
  const position = new Float32Array(pos), normal = new Float32Array(pos.length);
  const n = [0, 0, 0];
  for (let i = 0; i < position.length; i += 3) {
    for (let it = 0; it < 3; it++) {
      const d = field.at(position[i], position[i + 1], position[i + 2]);
      const rate = field.normal(position[i], position[i + 1], position[i + 2], n);
      const s = d / Math.max(rate, 0.5);
      position[i] -= n[0] * s; position[i + 1] -= n[1] * s; position[i + 2] -= n[2] * s;
    }
    field.normal(position[i], position[i + 1], position[i + 2], n);
    normal[i] = n[0]; normal[i + 1] = n[1]; normal[i + 2] = n[2];
  }
  return { position, normal, index: new Uint32Array(tri) };
}

// Press a rolled piece (a run of balls from p to q) into a copy of the grid, so creases beside it can be found.
export function pressInto(grid, p, q, rp, rq) {
  const { v, nx, ny, nz, min, h } = grid;
  const R = Math.max(rp, rq) + 0.13;
  const x0 = Math.max(0, Math.floor((Math.min(p[0], q[0]) - R - min[0]) / h)), x1 = Math.min(nx - 1, Math.ceil((Math.max(p[0], q[0]) + R - min[0]) / h));
  const y0 = Math.max(0, Math.floor((Math.min(p[1], q[1]) - R - min[1]) / h)), y1 = Math.min(ny - 1, Math.ceil((Math.max(p[1], q[1]) + R - min[1]) / h));
  const z0 = Math.max(0, Math.floor((Math.min(p[2], q[2]) - R - min[2]) / h)), z1 = Math.min(nz - 1, Math.ceil((Math.max(p[2], q[2]) + R - min[2]) / h));
  const bx = q[0] - p[0], by = q[1] - p[1], bz = q[2] - p[2];
  const l2 = bx * bx + by * by + bz * bz || 1e-9;
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ax = min[0] + x * h - p[0], ay = min[1] + y * h - p[1], az = min[2] + z * h - p[2];
    const t = Math.min(1, Math.max(0, (ax * bx + ay * by + az * bz) / l2));
    const d = Math.hypot(ax - bx * t, ay - by * t, az - bz * t) - (rp + (rq - rp) * t);
    const i = x + nx * (y + ny * z);
    if (d < v[i]) v[i] = d;
  }
}

function gridAt(grid, x, y, z) {
  const { v, nx, ny, nz, min, h } = grid;
  const fx = (x - min[0]) / h, fy = (y - min[1]) / h, fz = (z - min[2]) / h;
  if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return 1;
  const ix = fx | 0, iy = fy | 0, iz = fz | 0;
  const tx = fx - ix, ty = fy - iy, tz = fz - iz;
  const i = ix + nx * (iy + ny * iz), j = i + nx * ny;
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(v[i], v[i + 1], tx), l(v[i + nx], v[i + nx + 1], tx), ty),
    l(l(v[j], v[j + 1], tx), l(v[j + nx], v[j + nx + 1], tx), ty),
    tz,
  );
}

// How open a point of a surface is: 1 on a brow, less down in a crease or where two pieces meet. The ground counts.
const REACH = [0.03, 0.07, 0.13, 0.22];
export function openness(grid, x, y, z, nx, ny, nz) {
  let shut = 0, w = 1;
  for (const r of REACH) {
    const py = y + ny * r;
    const d = Math.min(gridAt(grid, x + nx * r, py, z + nz * r), py + 0.01);
    shut += w * Math.max(0, r - d) / r;
    w *= 0.75;
  }
  return Math.max(0.06, 1 - shut * 0.34); // a square corner comes out near a half
}
