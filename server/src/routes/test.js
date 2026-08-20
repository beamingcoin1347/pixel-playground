// Test-only routes. app.js mounts this router ONLY when NODE_ENV !== 'production',
// so a production server has no way to pin the rng or wipe the board.

import { Router } from 'express';
import { setSeed, currentSeed, reset } from '../sessions.js';
import { resetBoard } from '../leaderboard.js';

export const testRouter = Router();

// Pin the seed used by every subsequently created session, making secrets and bot moves
// deterministic. Pass { seed: null } to go back to random seeding.
testRouter.post('/seed', (req, res) => {
  const { seed } = req.body ?? {};
  if (seed !== null && seed !== undefined && !Number.isInteger(seed)) {
    return res.status(400).json({ error: 'seed must be an integer or null' });
  }
  res.json({ seed: setSeed(seed ?? null) });
});

testRouter.get('/seed', (_req, res) => {
  res.json({ seed: currentSeed() });
});

testRouter.post('/reset', async (_req, res, next) => {
  try {
    reset();
    await resetBoard();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
