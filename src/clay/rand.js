// Numbers that look thrown but come back the same for the same seed.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(x, y, z, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 974711)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// smooth noise in 0..1
export function noise3(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(lattice(ix, iy, iz, s), lattice(ix + 1, iy, iz, s), fx), l(lattice(ix, iy + 1, iz, s), lattice(ix + 1, iy + 1, iz, s), fx), fy),
    l(l(lattice(ix, iy, iz + 1, s), lattice(ix + 1, iy, iz + 1, s), fx), l(lattice(ix, iy + 1, iz + 1, s), lattice(ix + 1, iy + 1, iz + 1, s), fx), fy),
    fz,
  );
}
