import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite on 5173 proxies /api to Express on 4100. Never 4000 - that port belongs to the
// local model router proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
