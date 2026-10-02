import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the UI runs on :5173 and forwards API calls to the daemon (`drishya serve --dev`).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/v1': { target: 'http://127.0.0.1:7878', changeOrigin: true } },
  },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 800 },
});
