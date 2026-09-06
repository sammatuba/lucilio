import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Client root is src/client; the Express server (src/server) is the unified
// entrypoint — in dev, /api is proxied to it; in prod, the server serves this build.
export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: { outDir: '../../dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5175',
      '/dev': 'http://localhost:5175',
    },
  },
});
