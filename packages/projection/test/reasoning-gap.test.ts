import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';

let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-gap-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

// CONTENT-9: reasoning recorded without text folds to one line per turn; saved text stays as it was.
it('folds textless reasoning to one line per turn and keeps saved thinking', async () => {
  const t = '2026-10-21T00:00:00Z', session = 'gaps', base = { timestamp: t, cwd: dir, sessionId: session };
  const think = (uuid: string, content: unknown[]) => ({ ...base, type: 'assistant', uuid, message: { id: uuid, role: 'assistant', model: 'm', content } });
  const rows = [
    { ...base, type: 'user', uuid: 'p1', message: { role: 'user', content: 'First prompt' } },
    think('a1', [{ type: 'thinking', thinking: '', signature: 's' }]),
    think('a2', [{ type: 'thinking', thinking: 'Saved words.', signature: 's' }]),
    think('a3', [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'Done.' }]),
    { ...base, type: 'user', uuid: 'p2', message: { role: 'user', content: 'Second prompt' } },
    think('b1', [{ type: 'text', text: 'No reasoning block here.' }]),
    { ...base, type: 'user', uuid: 'p3', message: { role: 'user', content: 'Third prompt' } },
    think('c1', [{ type: 'thinking', thinking: '', signature: 's' }]),
  ];
  const source = join(dir, `${session}.jsonl`);
  writeFileSync(source, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const p = ingest.projection((await ingest.importSource('claude-code', source)).recordingId);
  const reasoning = p.prose.filter((pr) => pr.role === 'reasoning');
  expect(reasoning.map((pr) => [pr.exposure, pr.text, pr.count, pr.reason])).toEqual([
    ['none', '', 2, 'signature-only'],
    ['full', 'Saved words.', undefined, undefined],
    ['none', '', 1, 'signature-only'],
  ]);
  expect(reasoning[0]!.observationIds).toHaveLength(2);
  // The second turn recorded no reasoning block, so it has no line.
  const turns = p.timeline.filter((item) => item.type === 'turn').map((item) => item.id);
  const gapTurns = p.timeline.reduce<string[]>((acc, item, i) => {
    if (item.type === 'prose' && reasoning.some((pr) => pr.exposure === 'none' && pr.id === item.proseId)) acc.push(p.timeline.slice(0, i).filter((x) => x.type === 'turn').at(-1)!.id);
    return acc;
  }, []);
  expect(gapTurns).toEqual([turns[0], turns[2]]);
});
