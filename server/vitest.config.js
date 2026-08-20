import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // The leaderboard is a single JSON file and the session store is module-level state, so
    // test files must not run concurrently against them.
    fileParallelism: false,
  },
});
