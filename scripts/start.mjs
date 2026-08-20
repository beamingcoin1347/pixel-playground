// Production start: Express serves the built client from client/dist on port 4100.
// The test-only /api/test/* routes are NOT mounted here (NODE_ENV === 'production').
process.env.NODE_ENV = 'production';
await import(new URL('../server/src/index.js', import.meta.url));
