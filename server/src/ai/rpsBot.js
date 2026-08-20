// Rock-Paper-Scissors bot: random for the first three rounds, then it reads the player's
// most-frequent throw and counters it. Ties in the frequency count break by THROWS order,
// which keeps seeded games reproducible.

import { THROWS } from '../engines/rps.js';

const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
export const WARMUP_ROUNDS = 3;

export function chooseThrow(state, rng) {
  const seen = state.history.p1;
  if (seen.length < WARMUP_ROUNDS) {
    return THROWS[Math.floor(rng() * THROWS.length)];
  }

  const counts = new Map();
  for (const t of seen) counts.set(t, (counts.get(t) ?? 0) + 1);

  let favourite = THROWS[0];
  let best = -1;
  for (const t of THROWS) {
    const n = counts.get(t) ?? 0;
    if (n > best) {
      best = n;
      favourite = t;
    }
  }
  return COUNTER[favourite];
}
