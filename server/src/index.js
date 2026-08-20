import { createApp } from './app.js';

// 4100, never 4000 - port 4000 is reserved for the local model router proxy.
const PORT = Number(process.env.PORT ?? 4100);

const app = createApp();

app.listen(PORT, () => {
  const env = process.env.NODE_ENV ?? 'development';
  console.log(`Pixel Playground API listening on http://localhost:${PORT}  [${env}]`);
  if (env !== 'production') console.log('  test routes mounted at /api/test (seed, reset)');
});
