import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '../ui/node_modules/@vitejs/plugin-react/dist/index.js';

// SITE-1: a static site. `base` stays '/' for a custom domain; set SITE_BASE=/drishya/ for a github.io project page.
// demo.html mounts the real Drishya app (from apps/ui) on the synthetic sample, for the laptop.
const here = fileURLToPath(new URL('.', import.meta.url));
const ui = resolve(here, '../ui/node_modules');
export default {
  base: process.env.SITE_BASE ?? '/',
  plugins: [react()],
  resolve: { alias: { react: resolve(ui, 'react'), 'react-dom': resolve(ui, 'react-dom'), zustand: resolve(ui, 'zustand') } },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { main: resolve(here, 'index.html'), demo: resolve(here, 'demo.html') } } },
  server: { port: 5180, fs: { allow: [resolve(here, '../..')] } },
};
