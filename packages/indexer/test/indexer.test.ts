import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGraph, graphFromPaths, isIndexableFile, jsImports, layout, probeGeneration, pythonImports, resolveJs, resolvePython } from '../src/index.ts';

const shop = fileURLToPath(new URL('../../../fixtures/synthetic/workspace/shop', import.meta.url));

describe('import extraction', () => {
  it('finds static, re-export, dynamic and require imports', () => {
    const src = `import a from './a';\nimport type { B } from "../b.ts";\nexport * from './c';\nconst d = await import('./d');\nconst e = require('e');\n// import nope from './commented'`;
    expect(jsImports(src)).toEqual(['./a', '../b.ts', './c', './d', 'e']);
  });

  it('ignores block and standalone line comments when reading imports', () => {
    const src = [
      '/* import privateFile from "./ignored"; */',
      'import /* type information */ thing from "./thing";',
      '  // import anotherFile from "./also-ignored";',
      '',
      'export { thing } from "./public";',
    ].join('\n');
    expect(jsImports(src)).toEqual(['./thing', './public']);
  });

  it('finds python imports, relative and absolute', () => {
    expect(pythonImports('from .models import User\nfrom . import utils, db\nfrom ..shared.models import Product\nfrom .. import services as svc\nimport os, app.core\n')).toEqual(['.models', '.utils', '.db', '..shared.models', '..services', 'os', 'app.core']);
  });

  it('resolves with explicit rules and never invents a target', () => {
    const known = new Set(['src/a.ts', 'src/lib/index.ts', 'app/core.py', 'app/__init__.py', 'app/models.py']);
    expect(resolveJs('./a.js', 'src/x.ts', known)).toBe('src/a.ts');
    expect(resolveJs('./lib', 'src/x.ts', known)).toBe('src/lib/index.ts');
    expect(resolveJs('./missing', 'src/x.ts', known)).toBeUndefined();
    expect(resolveJs('react', 'src/x.ts', known)).toBe('external');
    expect(resolveJs('@/a', 'src/x.ts', known, [{ prefix: '@/', targets: ['src/'] }])).toBe('src/a.ts');
    expect(resolvePython('.models', 'app/views.py', known)).toBe('app/models.py');
    expect(resolvePython('app.core', 'main.py', known)).toBe('app/core.py');
    expect(resolvePython('os', 'main.py', known)).toBe('external');
  });
});

describe('graph', () => {
  it('maps the synthetic repository with every import resolved', async () => {
    const g = await buildGraph(shop, { now: () => 'fixed' });
    expect(g.temporal).toBe('current');
    expect(g.stats.unresolved).toBe(0);
    expect(g.edges).toContainEqual(expect.objectContaining({ from: 'src/checkout/index.ts', to: 'src/checkout/guard.ts', basis: 'deterministic-rule' }));
    expect(g.nodes.every((n) => n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1)).toBe(true);
  });

  it('resolves commented jsconfig aliases with a small source-file limit', async () => {
    const root = mkdtempSync(join(tmpdir(), 'drishya-index-alias-'));
    try {
      const config = join(root, 'jsconfig.json');
      const jsonc = [
        '{',
        '  /* Workspace alias */',
        '  "compilerOptions": {',
        '    // Keep source imports short.',
        '    "paths": { "@/*": ["./src/*"], },',
        '  },',
        '}',
      ].join('\n');
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src', 'main.ts'), "import '@/hero';");
      writeFileSync(join(root, 'src', 'hero.ts'), 'export {};');
      writeFileSync(config, jsonc);
      const graph = await buildGraph(root, { maxFileBytes: 32 });
      expect(graph.nodes.some(({ path }) => path === 'jsconfig.json')).toBe(false);
      expect(graph.edges).toContainEqual(expect.objectContaining({ from: 'src/main.ts', to: 'src/hero.ts' }));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('lays out deterministically', async () => {
    const a = await buildGraph(shop, { now: () => 'fixed' });
    const b = await buildGraph(shop, { now: () => 'fixed' });
    expect(a.nodes).toEqual(b.nodes);
    expect(a.generation).toBe(b.generation);
    const files = [{ path: 'z/a.ts', bytes: 1 }, { path: 'a/b.ts', bytes: 1 }];
    expect(layout(files, [])).toEqual(layout([...files].reverse(), []));
  });

  it('labels a files-only map honestly', () => {
    expect(graphFromPaths(['a.ts']).temporal).toBe('recording-files-only');
  });
});

// B2: graph freshness is checked cheaply (walk and stat only, no parsing) against the generation a
// map was built at, and protected files are never opened while looking for imports.
describe('graph freshness and scope', () => {
  it('keeps private local caches out of both the graph and freshness generation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishya-index-cache-'));
    try {
      mkdirSync(join(dir, '.local'));
      writeFileSync(join(dir, 'main.ts'), 'export const main = 1;');
      writeFileSync(join(dir, '.local', 'private.ts'), 'export const privateCache = 1;');
      const graph = await buildGraph(dir, { now: () => 'fixed' });
      expect(graph.nodes.map(n => n.path)).toEqual(['main.ts']);
      writeFileSync(join(dir, '.local', 'private.ts'), 'export const privateCache = 200;');
      expect(await probeGeneration(dir)).toBe(graph.generation);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('probes the same generation a full build produces, and notices an edit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishya-graph-'));
    try {
      writeFileSync(join(dir, 'a.ts'), "import { b } from './b';\n");
      writeFileSync(join(dir, 'b.ts'), 'export const b = 1;\n');
      const g = await buildGraph(dir);
      expect(await probeGeneration(dir)).toBe(g.generation);
      writeFileSync(join(dir, 'b.ts'), 'export const b = 2; // changed\n');
      utimesSync(join(dir, 'b.ts'), new Date(), new Date(Date.now() + 5000));
      expect(await probeGeneration(dir)).not.toBe(g.generation);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never reads a protected file for imports, even one with a source extension', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishya-graph-'));
    try {
      writeFileSync(join(dir, 'a.ts'), 'export const a = 1;\n');
      writeFileSync(join(dir, '.env.js'), "import { a } from './a';\nexport const KEY = 'hunter3hunter3';\n");
      const g = await buildGraph(dir);
      expect(g.edges.filter((e) => e.from === '.env.js')).toHaveLength(0);
      expect(g.nodes.find((n) => n.path === '.env.js')?.lines).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// INDEX-1: a directory with its own `.git` (an agent worktree, a submodule, a nested clone) is another checkout, not this
// workspace. Walking into it filled the file cap with copies of the project.
describe('nested checkouts', () => {
  const nested = (dir: string, name: string, git: 'file' | 'dir') => {
    const root = join(dir, name);
    mkdirSync(join(root, 'src'), { recursive: true });
    if (git === 'file') writeFileSync(join(root, '.git'), 'gitdir: /elsewhere/.git/worktrees/x\n');
    else mkdirSync(join(root, '.git'));
    writeFileSync(join(root, 'src', 'copy.ts'), 'export const copy = 1;\n');
  };

  it('leaves out nested checkouts, whether .git is a file or a directory, even under a hidden folder, and says so', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishya-nested-'));
    try {
      mkdirSync(join(dir, '.git'));
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'src', 'own.ts'), 'export const own = 1;\n');
      nested(dir, '.claude/worktrees/agent-a', 'file');
      nested(dir, 'vendored-clone', 'dir');
      const g = await buildGraph(dir);
      expect(g.nodes.map((n) => n.path)).toEqual(['src/own.ts']);
      expect(g.stats.nestedCheckouts).toBe(2);
      expect(g.truncated).toBe(false);
      expect(await isIndexableFile(dir, 'src/own.ts')).toBe(true);
      expect(await isIndexableFile(dir, '.claude/worktrees/agent-a/src/copy.ts')).toBe(false);
      expect(await isIndexableFile(dir, 'vendored-clone/src/copy.ts')).toBe(false);
      const quiet = mkdtempSync(join(tmpdir(), 'drishya-nested-none-'));
      try {
        writeFileSync(join(quiet, 'a.ts'), 'export const a = 1;\n');
        expect((await buildGraph(quiet)).stats.nestedCheckouts).toBeUndefined();
      } finally {
        rmSync(quiet, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not let copies of the project use up the file cap', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishya-nested-cap-'));
    try {
      for (let i = 0; i < 12; i++) nested(dir, `.claude/worktrees/w${i}`, 'file');
      mkdirSync(join(dir, 'src'));
      for (let i = 0; i < 5; i++) writeFileSync(join(dir, 'src', `f${i}.ts`), `export const f${i} = ${i};\n`);
      const g = await buildGraph(dir, { maxFiles: 8 });
      expect(g.nodes).toHaveLength(5);
      expect(g.truncated).toBe(false);
      expect(g.stats.nestedCheckouts).toBe(12);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
