// Seeded random numbers, so ?seed=N always builds the same archipelago
// and the same screenshot scenes. Mulberry32 plus a tiny value-noise helper.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise in [-1, 1] from a seeded grid hash.
export function makeNoise(seed) {
  const rand = createRandom(seed);
  const grid = new Float32Array(64 * 64);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand() * 2 - 1;
  function at(ix, iz) {
    const x = ((ix % 64) + 64) % 64;
    const z = ((iz % 64) + 64) % 64;
    return grid[z * 64 + x];
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function noise(x, z) {
    const ix = Math.floor(x); const iz = Math.floor(z);
    const fx = smooth(x - ix); const fz = smooth(z - iz);
    const a = at(ix, iz); const b = at(ix + 1, iz);
    const c = at(ix, iz + 1); const d = at(ix + 1, iz + 1);
    return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz);
  };
}
