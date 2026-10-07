import { expect, test } from 'vitest';
import { testTiles } from '../src/lib/test-tiles.ts';
const summary = { framework: 'node', passed: 2, failed: 1, skipped: 0, failures: [], passing: [], basis: 'derived' as const };
test('only complete flat captured TAP can locate a failure by runner index', () => {
  const result = testTiles(summary, 'TAP version 13\nok 1 - alpha\nnot ok 2 - beta\nok 3 - gamma\n1..3');
  expect(result.ordered).toBe(true);
  expect(result.tiles[1]).toEqual({ index: 2, state: 'failed', name: 'beta' });
  for (const text of ['ok 1 - alpha', 'ok 1 - alpha\nnot ok 1 - beta\nok 3 - gamma', '    ok 1 - child\nok 1 - alpha\nnot ok 2 - beta\nok 3 - gamma']) {
    expect(testTiles(summary, text).ordered).toBe(false);
    expect(testTiles(summary, text).tiles.every(tile => tile.index === undefined)).toBe(true);
  }
});
test('large summary stays bounded and preserves rare failed and skipped tiles', () => {
  const result = testTiles({ ...summary, passed: 100_000, failed: 1, skipped: 2 });
  expect(result.tiles).toHaveLength(83);
  expect(result.remaining).toBe(99_920);
  expect(result.tiles.filter(tile => tile.state === 'failed')).toHaveLength(1);
});
