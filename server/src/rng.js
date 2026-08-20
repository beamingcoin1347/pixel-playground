// Seedable PRNG (mulberry32). Every session carries its own generator so that a seeded
// session produces identical secrets and bot moves on every run - this is what makes the
// Playwright suite deterministic. Never use Math.random() in engines or bots.

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

export function rngPick(rng, list) {
  if (!list.length) throw new Error('rngPick: empty list');
  return list[rngInt(rng, list.length)];
}

/** Fisher-Yates using the supplied rng. Returns a new array. */
export function rngShuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
