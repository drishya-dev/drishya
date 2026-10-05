// Build an isolated, unpublished CLI package. Development keeps direct TypeScript execution;
// npm installs cannot rely on Node stripping TypeScript inside node_modules or workspace links.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist/package');
if (!out.startsWith(root + sep)) throw new Error('package output must stay inside the workspace');
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'apps/daemon/src'), { recursive: true });
await build({
  entryPoints: [resolve(root, 'apps/daemon/src/cli.ts')],
  outdir: resolve(out, 'apps/daemon/src'),
  entryNames: 'cli',
  // Keep chunks beside the entry: the source's import.meta.url-relative UI/fixture paths
  // intentionally resolve from apps/daemon/src in both checkout and installed package.
  chunkNames: '[name]-[hash]',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  splitting: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  packages: 'bundle',
  legalComments: 'none',
});
cpSync(resolve(root, 'apps/ui/dist'), resolve(out, 'apps/ui/dist'), { recursive: true });
cpSync(resolve(root, 'fixtures/synthetic'), resolve(out, 'fixtures/synthetic'), { recursive: true });
cpSync(resolve(root, 'LICENSE'), resolve(out, 'LICENSE'));
const workspace = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version?: string };
writeFileSync(resolve(out, 'package.json'), JSON.stringify({
  name: '@drishya-dev/cli',
  version: workspace.version ?? '0.1.0-alpha.0',
  description: 'Local, read-only live view and replay for coding agents',
  license: 'Apache-2.0',
  type: 'module',
  engines: { node: '>=24 <25' },
  bin: { drishya: './apps/daemon/src/cli.mjs' },
  files: ['apps/daemon/src', 'apps/ui/dist', 'fixtures/synthetic', 'LICENSE'],
}, null, 2) + '\n');
console.log(`Built isolated CLI package at ${out}`);
