import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {interfaceCssLengths} from './scale-lengths.ts';

const sourceDir = fileURLToPath(new URL('./src/', import.meta.url)).replace(/\\/g, '/');

/** Unlayered on purpose: CodeMirror injects its own unlayered styles at runtime, which would otherwise beat every app rule written for the editor. */
const unlayered = ['/src/components/draft-editor.css'];
const clarityDir = fileURLToPath(new URL('./src/clarity/', import.meta.url)).replace(/\\/g, '/');

/**
 * CLARITY-1: every stylesheet outside `src/clarity/` is wrapped in `@layer legacy`, so Clarity's `@layer clarity`
 * rules beat them whatever their specificity. `src/clarity/layers.css` (the first import in main.tsx) declares
 * `@layer legacy, clarity;`, which fixes the order for dev and for the extracted production chunks alike.
 * Within the one `legacy` layer, order and specificity behave exactly as they did unlayered, so Modern is unchanged.
 */
export function legacyLayer(): Plugin {
  return {
    name: 'drishya-legacy-layer',
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?')[0]!.replace(/\\/g, '/');
      if (!path.endsWith('.css') || path.startsWith(clarityDir) || path.includes('/node_modules/') || unlayered.some(file => path.endsWith(file))) return null;
      // `@import` must precede other rules, and nothing here uses it; fail loudly if that ever changes.
      if (/^\s*@(import|charset)\b/m.test(code)) throw new Error(`${path}: @import/@charset cannot be wrapped in @layer legacy`);
      return { code: `@layer legacy {\n${code}\n}`, map: null };
    },
  };
}

// In development the UI runs on :5173 and forwards API calls to the daemon (`drishya serve --dev`).
export default defineConfig({
  plugins: [legacyLayer(), react()],
  css: { postcss: { plugins: [{
    postcssPlugin: 'drishya-interface-lengths',
    Declaration(declaration: {prop:string;value:string;source?:{input:{file?:string}}}) {
      const file=declaration.source?.input.file?.replace(/\\/g,'/');
      if(!file?.startsWith(sourceDir)||file.startsWith(clarityDir))return;
      // Preserve the fixed reference rem rather than the browser's default font.
      if(declaration.prop==='font-size'&&declaration.value.includes('--ui-scale'))return;
      declaration.value=interfaceCssLengths(declaration.value);
    },
  }] } },
  server: {
    proxy: { '/v1': { target: 'http://127.0.0.1:7878', changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (!id.includes('@codemirror') && !id.includes('@lezer')) {
              return 'vendor';
            }
          }
        },
      },
    },
  },
});
