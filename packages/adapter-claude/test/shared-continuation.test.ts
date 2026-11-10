import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { claudeContinuation } from '../src/continuation.ts';

// CONTENT-21: a journal that copies the tail of an earlier one, uuid for uuid, with no compact boundary row.
let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-continuation-')); });
afterEach(() => { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });
const id = (prefix: string, n: number) => `${prefix}${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`;
const row = (uuid: string, session: string) => JSON.stringify({ type: 'user', uuid, sessionId: session, timestamp: '2026-11-01T00:00:00Z', message: { role: 'user', content: 'x' } });
const write = (name: string, ids: string[], session = name) => { const path = join(dir, name + '.jsonl'); writeFileSync(path, ids.map(uuid => row(uuid, session)).join('\n') + '\n'); return path; };
const own = (prefix: string, from: number, to: number) => Array.from({ length: to - from }, (_, i) => id(prefix, from + i));

it('links a journal whose leading entries were copied from exactly one earlier journal, by shared uuids alone', async () => {
  const earlier = write('a', own('a', 0, 600)), unrelated = write('z', own('z', 0, 50));
  const child = write('b', [...own('a', 450, 600), ...own('b', 0, 100)], 'b-restamped');
  const link = await claudeContinuation(child, [earlier, child, unrelated]);
  expect(link).toMatchObject({ status: 'linked', basis: 'shared-entry-uuids', parentPath: earlier, sharedMessageRecords: 150 });
});

it('does not link an unrelated journal, a different project folder, or an earlier journal that is itself the copy', async () => {
  const a = write('a', own('a', 0, 100)), z = write('z', own('z', 0, 100));
  expect(await claudeContinuation(z, [a, z])).toBeUndefined();
  const other = mkdtempSync(join(tmpdir(), 'drishya-continuation-other-'));
  try {
    const elsewhere = join(other, 'e.jsonl'); writeFileSync(elsewhere, own('a', 0, 100).map(uuid => row(uuid, 'e')).join('\n') + '\n');
    expect(await claudeContinuation(write('c', own('a', 50, 100)), [elsewhere])).toBeUndefined();
  } finally { rmSync(other, { recursive: true, force: true }); }
  // The earlier journal never starts with entries the later one holds, so the pair is not linked the other way round.
  const child = write('b', [...own('a', 50, 100), ...own('b', 0, 10)]);
  expect(await claudeContinuation(a, [a, child])).toBeUndefined();
});

it('keeps a sibling copy of the same tail from competing, and records no link between two full copies', async () => {
  const origin = write('a', own('a', 0, 500));
  const sibling = write('s', [...own('a', 300, 500), ...own('s', 0, 20)]);
  const child = write('b', [...own('a', 300, 500), ...own('b', 0, 20)]);
  expect(await claudeContinuation(child, [origin, sibling, child])).toMatchObject({ status: 'linked', parentPath: origin });
  const fork = write('f', own('a', 0, 500));
  expect(await claudeContinuation(fork, [origin, fork])).toBeUndefined();
});
