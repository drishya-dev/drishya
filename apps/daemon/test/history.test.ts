import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compose } from '@drishya/scene';
import { App } from '../src/app.ts';
import { BlobStore } from '@drishya/store';

let app: App | undefined;
let dir: string;
afterEach(async () => { await app?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

describe('worker-owned history pages', () => {
  it('pages a prompt-only chapter by captured turn step with no fabricated material', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-prompt-only-'));
    const journal = join(dir, 'rollout.jsonl');
    const timestamp = '2026-10-07T00:00:00Z';
    const rows: unknown[] = [{ timestamp, type: 'session_meta', payload: { id: 'prompt-only-reader', cwd: dir } }];
    for (let i = 0; i < 75; i++) rows.push({ timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `Unanswered prompt ${i}` }] } });
    (await import('node:fs')).writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    app = new App(join(dir, 'data'));
    const { recordingId } = await app.ingest.importSource('codex', journal);
    const latest = await app.history.page(recordingId, { count: 1 });
    expect(latest.scene.passages).toHaveLength(75);
    const target = latest.scene.passages[20]!;
    expect(target.unloaded).toBe(true);
    const page = await app.history.page(recordingId, { count: 1, promptStep: target.turnStep! + 1 });
    expect(page.loadedPassageIds).toEqual([target.id]);
    expect(page.scene.passages[20]).toMatchObject({ turnPrompt: 'Unanswered prompt 20' });
    expect(page.scene.passages[20]!.unloaded).toBeUndefined();
    expect(page.projection.operations).toEqual([]);
    expect(page.projection.prose).toEqual([]);
  });
  it('keeps the requested operation inside a one-passage window',async()=>{
    dir=mkdtempSync(join(tmpdir(),'drishya-one-passage-'));app=new App(join(dir,'data'));
    const journal=join(dir,'rollout.jsonl');copyFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'),journal);
    const {recordingId}=await app.ingest.importSource('codex',journal),full=app.projection(recordingId),scene=compose(full,{step:full.timeline.length});
    const target=scene.passages.findIndex((passage,index)=>index>0&&passage.ops.length>0),id=scene.passages[target]!.ops[0]!.id;
    const page=await app.history.page(recordingId,{selectedOperationId:id,count:1});
    expect(page.projection.operations.some(op=>op.id===id)).toBe(true);expect(page.loadedPassageIds).toEqual([scene.passages[target]!.id]);expect(page.scene.step).toBe(full.timeline.length);
  });

  it('locates an older captured prompt without rewinding or loading the whole recording', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-prompts-'));
    const journal = join(dir, 'rollout.jsonl');
    const timestamp = '2026-10-07T00:00:00Z';
    const rows = [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'prompt-reader', cwd: '/home/dev/shop' } })];
    for (let i = 0; i < 70; i++) {
      rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{type:'input_text',text:`Prompt chapter ${i}${i === 1 ? ' synthetic long label'.repeat(100) : ''}`}] } }));
      rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{type:'output_text',text:`Captured response ${i}`}] } }));
    }
    (await import('node:fs')).writeFileSync(journal, rows.join('\n') + '\n');
    app = new App(join(dir, 'data'));
    const { recordingId } = await app.ingest.importSource('codex', journal);
    const latest = await app.history.page(recordingId, { count: 2 });
    // Navigation spans older unloaded chapters without loading their responses.
    const chapters = latest.scene.passages.filter(p => p.turnPrompt);
    expect(chapters).toHaveLength(70);
    expect(chapters[0]!.turnPrompt).toBe('Prompt chapter 0');
    expect(chapters[0]!.unloaded).toBe(true);
    expect(chapters[1]!.turnPrompt).toHaveLength(241);
    expect(chapters[1]!.turnPrompt).toMatch(/…$/);
    expect(chapters.at(-1)!.turnPrompt).toBe('Prompt chapter 69');
    const turn = latest.markers.find(m => m.type === 'turn')!;
    const earlier = await app.history.page(recordingId, { count: 2, promptStep: turn.step });
    expect(earlier.scene.total).toBe(latest.scene.total);
    expect(earlier.scene.step).toBe(latest.scene.step);
    expect(earlier.projection.prose.some(p => p.text === 'Captured response 0')).toBe(true);
    expect(earlier.loadedPassageIds).toHaveLength(2);
    const overview=await app.history.reviewInsights(recordingId,3);expect(overview.promptCount).toBe(70);expect(overview.prompts).toHaveLength(10);expect(overview.prompts.at(-1)!.ordinal).toBe(1);
    expect(earlier.projection.prose.length).toBeLessThan(70);
  });
  it('counts the whole session since a reading mark while bounding digest previews', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-since-'));
    const journal = join(dir, 'rollout.jsonl');
    const timestamp = '2026-10-05T00:00:00Z';
    const rows = [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'since-worker', cwd: '/home/dev/shop' } })];
    for (let i = 0; i < 70; i++) {
      rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: `call-${i}`, arguments: JSON.stringify({ cmd: 'npm test' }) } }));
      rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: `call-${i}`, output: '1 passed' } }));
    }
    (await import('node:fs')).writeFileSync(journal, rows.join('\n') + '\n');
    app = new App(join(dir, 'data'));
    const { recordingId } = await app.ingest.importSource('codex', journal);
    const page = await app.history.page(recordingId, { count: 1 });
    const digest = await app.history.since(recordingId, -1);
    expect(digest.newSteps).toBe(page.scene.total);
    expect(digest.counts.tests).toBe(70);
    const commands=await app.history.commands(recordingId,{});
    const insights=await app.history.reviewInsights(recordingId);expect(insights.findings.find(f=>f.kind==='repeated-command')!.count).toBe(70);expect(insights.facts.counts.tests).toBe(70);
    expect(commands.total).toBe(70);expect(commands.items).toHaveLength(25);
    expect(commands.items.every(row=>row.command==='npm test')).toBe(true);
    const older=await app.history.commands(recordingId,{cursor:commands.older});
    expect(older.items).toHaveLength(25);expect(new Set([...commands.items,...older.items].map(row=>row.id)).size).toBe(50);

    expect(digest.tests).toHaveLength(20);
    const next = await app.history.since(recordingId, -1, 1);
    const last = await app.history.since(recordingId, -1, 3);
    expect(next.counts.tests).toBe(70);
    expect(next.tests).toHaveLength(20);
    expect(last.tests).toHaveLength(10);
    expect(new Set([...digest.tests, ...next.tests].map(item => item.operationId)).size).toBe(40);
    expect((await app.history.since(recordingId, -1, 4)).tests).toHaveLength(0);
    expect(page.projection.operations.length).toBeLessThan(70);
    expect((await app.history.since(recordingId, digest.through)).newSteps).toBe(0);
  });
  it('bounds long prose passages and keeps complete text and command inputs readable', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-'));
    const journal = join(dir, 'rollout.jsonl');
    const timestamp = '2026-10-05T00:00:00Z';
    const text = 'Invented captured content.\n'.repeat(1000);
    const rows = [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'long-text', cwd: '/home/dev/shop' } })];
    for (let i = 0; i < 33; i++) rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } }));
    rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'long-input', arguments: JSON.stringify({ cmd: text }) } }));
    rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'After invocation.' }] } }));
    (await import('node:fs')).writeFileSync(journal, rows.join('\n') + '\n');
    app = new App(join(dir, 'data'));
    const { recordingId } = await app.ingest.importSource('codex', journal);
    const page = await app.history.page(recordingId, { count: 1, start: 0 });
    expect(page.projection.prose).toHaveLength(16);
    expect(page.projection.prose.every((pr) => pr.text.length <= 4096 && pr.truncated)).toBe(true);
    const pr = page.projection.prose[0]!;
    expect((await app.history.artifact(recordingId, `art_${pr.id}_prose`, 0, 1001)).text).toBe(text);
    const last = await app.history.page(recordingId, { step: page.scene.total, selectedOperationId: `${recordingId}.long-input` });
    const op = last.projection.operations.find((op) => op.id.endsWith('.long-input'))!;
    expect(op.detail.kind === 'shell' && op.detail.command.length <= 4096).toBe(true);
    expect(op.artifactIds).toContain(`art_${op.id}_input`);
    expect((await app.history.page(recordingId, { step: op.startSequence + 1, selectedOperationId: op.id })).projection.operations.find((item) => item.id === op.id)?.artifactIds).toContain(`art_${op.id}_input`);
    expect((await app.history.artifact(recordingId, `art_${op.id}_input`, 0, 1001)).text).toBe(text);
  });
  it('removes derived orphans while retaining shared snapshots and original sources', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-'));
    const first = join(dir, 'first.jsonl');
    const second = join(dir, 'second.jsonl');
    copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), first);
    copyFileSync(first, second);
    app = new App(join(dir, 'data'));
    const a = (await app.ingest.importSource('claude-code', first)).recordingId;
    const b = (await app.ingest.importSource('claude-code', second)).recordingId;
    await app.history.page(a);
    const page = await app.history.page(b);
    const artifact = page.projection.artifacts.find((item) => item.blob)!;
    const before = await app.history.artifact(b, artifact.id, 0, 100);
    const derived = new BlobStore(join(dir, 'data/history/blobs'));
    const orphan = derived.put('invented unreferenced cache file');
    await app.forget(a);
    expect(derived.has(orphan.sha)).toBe(false);
    expect((await app.history.artifact(b, artifact.id, 0, 100)).text).toBe(before.text);
    expect(app.store.getRecording(b)).toBeDefined();
    // The harness journal is an independent file; forgetting never deletes it.
    expect((await import('node:fs')).existsSync(first)).toBe(true);
  });
  it('returns bounded material with the same complete scene and historical visibility', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-'));
    const journal = join(dir, 'session.jsonl');
    copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
    app = new App(join(dir, 'data'));
    const { recordingId } = await app.ingest.importSource('claude-code', journal);
    const full = app.projection(recordingId);
    const page = await app.history.page(recordingId, { start: 0, count: 1 });
    expect(page.scene.total).toBe(full.timeline.length);
    expect(page.loadedPassageIds).toHaveLength(1);
    expect(page.scene.passages.map((ps) => ps.id)).toEqual(compose(full, { step: full.timeline.length }).passages.map((ps) => ps.id));
    expect(page.projection.operations.length).toBeLessThan(full.operations.length);
    const op = full.operations.find((item) => item.endSequence !== undefined)!;
    const before = await app.history.page(recordingId, { step: op.startSequence + 1, selectedOperationId: op.id });
    const pending = before.projection.operations.find((item) => item.id === op.id)!;
    expect(pending.status).toBe('running');
    expect(pending.artifactIds).toEqual([]);
    expect(await app.history.marker(recordingId, 0, ['edit'], 1)).toBeGreaterThan(0);
    expect((await app.history.page(recordingId, { start: 0, count: 1, selectedOperationId: full.operations.at(-1)!.id })).start).toBe(0);
    await app.history.close();
    await app.close();
    app = new App(join(dir, 'data'));
    const restored = await app.history.page(recordingId, { start: 0, count: 1 });
    expect(restored.projection).toEqual(page.projection);
    expect(restored.revisions).toEqual(page.revisions);
  });

  it('matches a fresh reduction after append, completion, and an out-of-order arrival', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-'));
    const journal = join(dir, 'session.jsonl');
    copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
    app = new App(join(dir, 'data'));
    const { recordingId } = await app.ingest.importSource('claude-code', journal);
    const initial = await app.history.page(recordingId, { count: 64 });
    const append = async (record: unknown) => {
      appendFileSync(journal, JSON.stringify(record) + '\n');
      await app!.ingest.sync(recordingId);
      const fresh = app!.projection(recordingId);
      const actual = await app!.history.page(recordingId, { count: 64 });
      expect(actual.projection.operations).toEqual(fresh.operations);
      const evidence = new Set([...actual.projection.operations.flatMap((op) => op.observationIds), ...actual.projection.prose.flatMap((pr) => pr.observationIds)]);
      const operationIds = new Set(actual.projection.operations.map((op) => op.id));
      expect(actual.projection.links).toEqual(fresh.links.filter((link) => operationIds.has(link.from) || operationIds.has(link.to) || link.sourceObservationIds.some((id) => evidence.has(id))));
      expect(actual.scene).toEqual(compose(fresh, { step: fresh.timeline.length }));
    };
    await append({ type: 'assistant', timestamp: '2026-12-01T00:00:00Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'append-test', name: 'Bash', input: { command: 'echo bounded' } }] } });
    await append({ type: 'user', timestamp: '2026-12-01T00:00:01Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'append-test', content: 'bounded' }] } });
    await append({ type: 'assistant', timestamp: '2026-01-01T00:00:00Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Late captured explanation.' }] } });
    expect(initial.projection.operations).toHaveLength(app.projection(recordingId).operations.length - 1);
    const orphan = app.store.blobs.put('captured source remains separate');
    await app.forget(recordingId);
    expect(app.store.blobs.has(orphan.sha)).toBe(true);
    await expect(app.history.page(recordingId)).rejects.toThrow('Recording not found');
  });
});
