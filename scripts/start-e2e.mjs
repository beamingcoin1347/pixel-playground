// E2E start: serves the built client exactly like production, but under NODE_ENV=test so the
// deterministic /api/test/seed endpoint stays mounted. Playwright needs seeded secrets and bot
// moves to be flake-free; static serving keys off the presence of client/dist, not NODE_ENV.
process.env.NODE_ENV = 'test';
await import(new URL('../server/src/index.js', import.meta.url));
