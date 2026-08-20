import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gamesRouter } from './routes/games.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { testRouter } from './routes/test.js';

const DIST = fileURLToPath(new URL('../../client/dist/', import.meta.url));

export function createApp({ serveClient = true } = {}) {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV ?? 'development' });
  });

  app.use('/api/games', gamesRouter);
  app.use('/api/leaderboard', leaderboardRouter);

  // Deterministic-seed and reset endpoints exist only outside production.
  if (!isProduction) app.use('/api/test', testRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'unknown API endpoint' }));

  // Static serving keys off the build actually existing rather than off NODE_ENV, so the
  // e2e harness can serve the real bundle while keeping the test endpoints mounted.
  if (serveClient && existsSync(DIST)) {
    app.use(express.static(DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(DIST, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[api] unhandled error:', err);
    res.status(status).json({ error: err.message ?? 'internal error' });
  });

  return app;
}
