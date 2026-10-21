import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { asOfProjection } from '@drishya/contracts';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';
import { fileEvidence } from '../../scene/src/file-evidence.ts';

let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-notices-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

// DATA-6 (review125 S5): "changed outside the agent" notices, never attributed to a person.
it('keeps harness notices of outside changes, folds identical repeats and never stores protected snippets', async () => {
  const t = '2026-10-21T00:00:00Z', session = 'notices', base = { timestamp: t, cwd: dir, sessionId: session };
  const notice = (uuid: string, file: string, snippet: string) => ({ ...base, type: 'attachment', uuid, attachment: { type: 'edited_text_file', filename: join(dir, file), snippet } });
  const rows = [
    { ...base, type: 'user', uuid: 'p1', message: { role: 'user', content: 'Tidy the cart' } },
    notice('n1', 'src/cart.ts', '3\texport const total = 3;'),
    notice('n2', 'src/cart.ts', '3\texport const total = 3;'),
    notice('n3', '.env', '1\tSECRET=abc'),
    { ...base, type: 'assistant', uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'I see the total changed.' }] } },
    notice('n4', 'src/cart.ts', '3\texport const total = 4;'),
  ];
  const source = join(dir, `${session}.jsonl`);
  writeFileSync(source, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const p = ingest.projection((await ingest.importSource('claude-code', source)).recordingId);

  expect(p.notices?.map((n) => [n.path, n.repeats, n.snippet])).toEqual([
    ['src/cart.ts', 1, '3\texport const total = 3;'],
    ['.env', 0, '[OMITTED: content of a protected file]'],
    ['src/cart.ts', 0, '3\texport const total = 4;'],
  ]);
  expect(JSON.stringify(store.observations(p.recordingId))).not.toContain('SECRET=abc');
  expect(p.timeline.filter((i) => i.type === 'notice')).toHaveLength(3);
  expect(p.passages.flatMap((ps) => ps.noticeIds ?? [])).toEqual(p.notices!.map((n) => n.id));
  expect(fileEvidence(p, ['src/cart.ts'])[0]).toMatchObject({ path: 'src/cart.ts', outside: 2 });
  // Replay: before the last notice is applied, only the first two exist.
  const step = p.timeline.findIndex((i) => i.type === 'notice' && i.noticeId === p.notices![2]!.id);
  expect(asOfProjection(p, step).notices?.map((n) => n.path)).toEqual(['src/cart.ts', '.env']);
});
