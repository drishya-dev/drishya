import { expect, it } from 'vitest';
import type { Projection } from '../../packages/contracts/src/index.ts';
import { sinceSnapshot } from '../../packages/scene/src/since.ts';

// SEC-4b: a captured filename such as `__proto__` must stay one recording's data. Statistics are
// keyed by filename; a plain-object accumulator aliased shared prototype state across recordings.
const op = (agent: string, i: number, path: string) => ({
  id: `${agent}-${i}`, agentId: agent, kind: 'edit', status: 'ok', title: 'edit', startSequence: 0, endSequence: 0,
  paths: [{ path, role: 'write', basis: 'captured' }],
  detail: { kind: 'edit', path, hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['+a', '-b'] }], created: false, reconstruction: 'available' },
});
const recording = (agent: string, names: string[]) => {
  const operations = names.map((n, i) => op(agent, i, n));
  const timeline = operations.flatMap((o, i) => [{ type: 'op-start', id: `s${o.id}`, operationId: o.id, sequence: 2 * i + 1, agentId: agent }, { type: 'op-end', id: `e${o.id}`, operationId: o.id, sequence: 2 * i + 2, agentId: agent }]);
  return { operations, timeline, gaps: [], lastSequence: 40, artifacts: [], agents: [] } as unknown as Projection;
};
const NAMES = ['__proto__', 'constructor', 'hasOwnProperty'];

it('keeps hostile filenames out of shared prototype state across recordings', () => {
  const first = sinceSnapshot(recording('one', NAMES), -1);
  sinceSnapshot(recording('one', NAMES), -1);
  const second = sinceSnapshot(recording('two', ['constructor', 'hasOwnProperty']), -1);
  for (const name of NAMES) expect(Object.hasOwn(first.fileStats!, name)).toBe(true);
  expect(second.fileStats!.constructor).toMatchObject({ added: 1, removed: 1, edits: 1 });
  expect(second.fileStats!.hasOwnProperty).toMatchObject({ added: 1, removed: 1, edits: 1 });
  expect(({} as Record<string, unknown>).edits).toBeUndefined();
  expect((Object.prototype as unknown as Record<string, unknown>).added).toBeUndefined();
  expect((Object as unknown as Record<string, unknown>).added).toBeUndefined();
});
