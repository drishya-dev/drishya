import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { buildGraph } from '../src/index.ts';

const afterStat = vi.hoisted(() => new Map<string, () => void>());

// A benign edit between discovery and parsing, without relying on the scheduler.
vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...fs,
    stat: async (path: string) => {
      const metadata = await fs.stat(path);
      afterStat.get(path)?.();
      return metadata;
    },
  };
});

it('keeps a file as a node when an edit puts it over the import read limit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'drishya-index-read-limit-'));
  const source = join(root, 'src', 'a.ts');
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(source, "import './b';");
    writeFileSync(join(root, 'src', 'b.ts'), 'export {};');
    afterStat.set(source, () => writeFileSync(source, "import './b';\n// " + 'é'.repeat(30)));
    const graph = await buildGraph(root, { maxFileBytes: 60 });
    expect(graph.nodes.find(({ path }) => path === 'src/a.ts')).toMatchObject({ path: 'src/a.ts', lines: undefined });
    expect(graph.edges).toEqual([]);
    expect(graph.stats.parsed).toBe(1);
  } finally {
    afterStat.delete(source);
    rmSync(root, { recursive: true, force: true });
  }
});
