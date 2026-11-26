// Small deterministic randomness: a seeded generator so a staged scene or a
// gust pattern comes out the same on every run, plus a smooth value-noise
// field the terrain and the storm gusts are shaped from.

/** mulberry32: a tiny seeded PRNG with a 2^32 period, plenty for one game world. */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    pick(list) {
      return list[Math.floor(next() * list.length) % list.length];
    },
  };
}

/** A hash of integer lattice coordinates, steady for a given world seed. */
export function latticeHash(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise over the lattice: rolling shapes, no hard edges, in 0..1. */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = latticeHash(ix, iz, seed);
  const b = latticeHash(ix + 1, iz, seed);
  const c = latticeHash(ix, iz + 1, seed);
  const d = latticeHash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Two octaves of value noise, in 0..1: broad swells with a finer ripple on top. */
export function rollingNoise(x, z, seed) {
  return valueNoise(x, z, seed) * 0.68 + valueNoise(x * 2.7 + 31.7, z * 2.7 + 11.3, seed + 7) * 0.32;
}
