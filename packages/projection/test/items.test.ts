import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '../../store/src/index.ts';
import { Ingestor, defaultAdapters } from '../../ingest/src/index.ts';
import { asOfProjection } from '@drishya/contracts';

let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-items-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });
async function fixture(name: string) { const { recordingId } = await ingest.importSource('codex', resolve('fixtures/synthetic/codex-items', `${name}.jsonl`)); return ingest.projection(recordingId); }

it('places real commands inside the wrapper window and shows only child cards, including 441 recorded passes', async () => {
  const p = await fixture('one-command'), child = p.operations.find(op => op.parentOperationId)!;
  expect(child).toMatchObject({ kind: 'test', tool: 'CommandExecution', durationMs: 1250, status: 'ok', classification: { kind: 'captured' }, detail: { kind: 'test', command: 'pnpm test', exitCode: 0, summary: { passed: 441 } } });
  expect(child.startTime).toBeUndefined();
  expect(p.passages.flatMap(ps => ps.operationIds)).toEqual([child.id]);
  const parent = p.operations.find(op => op.id === child.parentOperationId)!;
  expect(child.startSequence).toBe(parent.startSequence + 1);
  expect(child.endSequence).toBeLessThan(parent.endSequence!);
  expect(p.links).toContainEqual(expect.objectContaining({ from: parent.id, to: child.id, basis: 'deterministic-rule', ruleVersion: 'codex-enclosing-call-v1', explanation: 'Recorded between this call and its output.' }));
  expect(asOfProjection(p, child.endSequence!).operations.find(op => op.id === child.id)?.detail).not.toHaveProperty('summary');
  const three = await fixture('three-commands');
  expect(three.passages.flatMap(ps => ps.operationIds)).toHaveLength(3);
  expect(three.operations.filter(op => op.kind === 'test')).toHaveLength(2);
  expect(three.operations.filter(op => op.parentOperationId).map(op => op.status)).toEqual(['ok', 'ok', 'error']);
});
it('keeps standalone and ambiguous items uncorrelated, and MCP source IDs enrich one operation', async () => {
  const standalone = await fixture('standalone'); expect(standalone.operations).toHaveLength(1); expect(standalone.operations[0]!.parentOperationId).toBeUndefined();
  const ambiguous = await fixture('ambiguous'); expect(ambiguous.operations).toHaveLength(3); expect(ambiguous.operations.every(op => !op.parentOperationId)).toBe(true);
  const mcp = await fixture('mcp-call'); expect(mcp.operations).toHaveLength(1); expect(mcp.operations[0]).toMatchObject({ status: 'ok', durationMs: 500, detail: { kind: 'mcp', readOnlyHint: true } });
  expect(mcp.timeline.filter(it => it.type === 'op-end')).toHaveLength(1);
});
it('resolves exact nested patch paths and retains the script without trusting a reconstructed full file', async () => {
  const p = await fixture('file-change');
  expect(p.operations).toHaveLength(1); expect(p.operations[0]).toMatchObject({ status: 'ok', tool: 'FileChange', detail: { kind: 'edit', hunks: [{ oldStart: 1, newStart: 1 }] } });
  expect(p.operations[0]!.artifactIds.some(id => id.endsWith('_script'))).toBe(true);
  const input = readFileSync(resolve('fixtures/synthetic/codex-items/file-change.jsonl'), 'utf8').replace('"src/a.ts":', '"src/elsewhere.ts":');
  const journal = join(dir, 'mismatch.jsonl'); writeFileSync(journal, input);
  const { recordingId } = await ingest.importSource('codex', journal);
  expect(ingest.projection(recordingId).operations[0]!.status).toBe('unknown');
});
it('keeps image paths as references, web content captured, agent identity honest and unknown shapes metadata-only', async () => {
  for (const name of ['image-view', 'image-generation', 'web-search']) {
    const p = await fixture(name); expect(p.operations).toHaveLength(1);
    expect(JSON.stringify(p)).not.toContain('data:image');
  }
  const p = await fixture('subagent');
  expect(p.agents).toContainEqual(expect.objectContaining({ address: '/root/review', model: 'synthetic-model', effort: 'high', nickname: 'Reviewer' }));
  const unknown = await fixture('unknown'); expect(unknown.operations).toHaveLength(0);
  expect(JSON.stringify(store.observations(unknown.recordingId))).not.toContain('MUST NOT PERSIST');
});
it('rescan adds typed children without duplicate cards or new historical placement from receipt sequence', async () => {
  const journal = resolve('fixtures/synthetic/codex-items/three-commands.jsonl');
  await ingest.close();
  const adapters = defaultAdapters().map(adapter => ({ ...adapter, createParser(context: Parameters<typeof adapter.createParser>[0]) {
    const parser = adapter.createParser(context); return { prime: parser.prime, parse: (record: unknown) => parser.parse(record).filter(o => o.kind !== 'item.completed') };
  } }));
  ingest = new Ingestor(store, adapters);
  const { recordingId } = await ingest.importSource('codex', journal), old = store.observations(recordingId);
  await ingest.close(); ingest = new Ingestor(store);
  expect((await ingest.importSource('codex', journal)).added).toBe(0);
  expect((await ingest.rescan(recordingId)).added).toBe(3);
  expect(store.observations(recordingId).filter(o => o.kind !== 'item.completed')).toEqual(old);
  const p = ingest.projection(recordingId); expect(p.passages.flatMap(ps => ps.operationIds)).toHaveLength(3);
  expect(p.operations.filter(op => op.parentOperationId).every(op => op.endSequence! < p.timeline.length - 1)).toBe(true);
  expect((await ingest.rescan(recordingId)).added).toBe(0);
  expect(ingest.projection(recordingId)).toEqual(p);
});
