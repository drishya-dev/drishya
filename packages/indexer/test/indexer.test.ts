import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildGraph, graphFromPaths, jsImports, layout, pythonImports, resolveJs, resolvePython } from '../src/index.ts';

const shop = fileURLToPath(new URL('../../../fixtures/synthetic/workspace/shop', import.meta.url));

describe('import extraction', () => {
  it('finds static, re-export, dynamic and require imports', () => {
    const src = `import a from './a';\nimport type { B } from "../b.ts";\nexport * from './c';\nconst d = await import('./d');\nconst e = require('e');\n// import nope from './commented'`;
    expect(jsImports(src)).toEqual(['./a', '../b.ts', './c', './d', 'e']);
  });

  it('finds python imports, relative and absolute', () => {
    expect(pythonImports('from .models import User\nfrom . import utils, db\nimport os, app.core\n')).toEqual(['.models', '.utils', '.db', 'os', 'app.core']);
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
