// Build an isolated, unpublished CLI package. Development keeps direct TypeScript execution;
// npm installs cannot rely on Node stripping TypeScript inside node_modules or workspace links.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist/package');
const workspace = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version?: string };
const version = workspace.version ?? '0.1.0-alpha.0';
if (!out.startsWith(root + sep)) throw new Error('package output must stay inside the workspace');
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'apps/daemon/src'), { recursive: true });
await build({
  entryPoints: [resolve(root, 'apps/daemon/src/cli.ts'), resolve(root, 'apps/daemon/src/history-worker.ts')],
  outdir: resolve(out, 'apps/daemon/src'),
  entryNames: '[name]',
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
  define: { DRISHYA_PACKAGE_VERSION: JSON.stringify(version) },
});
cpSync(resolve(root, 'apps/ui/dist'), resolve(out, 'apps/ui/dist'), { recursive: true });
cpSync(resolve(root, 'fixtures/synthetic'), resolve(out, 'fixtures/synthetic'), { recursive: true });
cpSync(resolve(root, 'LICENSE'), resolve(out, 'LICENSE'));
writeFileSync(resolve(out, 'package.json'), JSON.stringify({
  name: 'drishya',
  version,
  description: 'Local, read-only live view and replay for coding agents',
  license: 'Apache-2.0',
  repository: { type: 'git', url: 'git+https://github.com/drishya-dev/drishya.git' },
  homepage: 'https://github.com/drishya-dev/drishya#readme',
  bugs: { url: 'https://github.com/drishya-dev/drishya/issues' },
  // SEC-5: provenance links the tarball to the workflow run that built it; `npm publish` must run from CI with id-token.
  publishConfig: { access: 'public', provenance: true },
  type: 'module',
  engines: { node: '>=24 <25' },
  bin: { drishya: './apps/daemon/src/cli.mjs' },
  files: ['apps/daemon/src', 'apps/ui/dist', 'fixtures/synthetic', 'LICENSE', 'BUILD.json', 'SHA256SUMS'],
}, null, 2) + '\n');
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const dirty = spawnSync('git', ['diff', '--quiet', 'HEAD'], { cwd: root });
writeFileSync(resolve(out, 'BUILD.json'), JSON.stringify({ format: 'drishya-build-v1', sourceCommit: revision.status === 0 ? revision.stdout.trim() : null, trackedChanges: dirty.status !== 0, node: process.version, platform: process.platform, arch: process.arch }, null, 2) + '\n');
const sums = readdirSync(out, { recursive: true }).map(String).filter((name) => statSync(resolve(out, name)).isFile()).sort()
  .map((name) => `${createHash('sha256').update(readFileSync(resolve(out, name))).digest('hex')}  ${name.replace(/\\/g, '/')}`);
writeFileSync(resolve(out, 'SHA256SUMS'), sums.join('\n') + '\n');
console.log(`Built isolated CLI package at ${out}`);
