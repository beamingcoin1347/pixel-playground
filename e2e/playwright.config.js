import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  // The server holds session state and a single JSON leaderboard, and tests pin the rng seed,
  // so they must not run concurrently.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4100',
    // Matches the CSS escape hatch in styles.css - no transitions to race against.
    reducedMotion: 'reduce',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // start-e2e serves the built client but keeps NODE_ENV=test so /api/test/* stays mounted.
    command: 'node scripts/start-e2e.mjs',
    cwd: repoRoot,
    url: 'http://localhost:4100/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
