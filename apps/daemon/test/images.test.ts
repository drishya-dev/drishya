import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES } from '@drishya/privacy';
import { App } from '../src/app.ts';
import { readImage } from '../src/images.ts';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let dir: string, app: App;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-images-')); app = new App(join(dir, 'data')); });
afterEach(async () => { await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

// CONTENT-1 (D7): inline images in tool results are kept once, referenced by hash and served only to their recording.
it('keeps inline result images once, serves them by hash to their own recording, and records why others were not kept', async () => {
  const write = (session: string, rows: unknown[]) => { const path = join(dir, `${session}.jsonl`); writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); return path; };
  const base = (session: string) => ({ timestamp: '2026-10-21T00:00:00Z', cwd: dir, sessionId: session });
  const image = (data: string) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
  const huge = Buffer.concat([Buffer.from(PNG_1x1, 'base64'), Buffer.alloc(MAX_IMAGE_BYTES)]).toString('base64');
  const rows = [
    { ...base('a'), type: 'user', uuid: 'p', message: { role: 'user', content: 'Look at the logo' } },
    { ...base('a'), type: 'assistant', uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [
      { type: 'tool_use', id: 'read1', name: 'Read', input: { file_path: join(dir, 'logo.png') } },
      { type: 'tool_use', id: 'shot1', name: 'mcp__browser__screenshot', input: {} },
      { type: 'tool_use', id: 'shot2', name: 'mcp__browser__screenshot', input: {} },
    ] } },
    { ...base('a'), type: 'user', uuid: 'r1', toolUseResult: { type: 'image', file: { base64: PNG_1x1, type: 'image/png', originalSize: 70, dimensions: { originalWidth: 1, originalHeight: 1, displayWidth: 1, displayHeight: 1 } } },
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read1', content: [image(PNG_1x1)] }] } },
    { ...base('a'), type: 'user', uuid: 'r2', toolUseResult: [{ type: 'text', text: 'Took a screenshot' }, image(PNG_1x1)],
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'shot1', content: [{ type: 'text', text: 'Took a screenshot' }, image(PNG_1x1)] }] } },
    { ...base('a'), type: 'user', uuid: 'r3', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'shot2', content: [image(huge), image(Buffer.from('not an image').toString('base64'))] }] } },
  ];
  const { recordingId } = await app.ingest.importSource('claude-code', write('a', rows));
  const p = app.projection(recordingId), op = (id: string) => p.operations.find((o) => o.id === `${recordingId}.${id}`)!;

  const read = op('read1').images!;
  expect(read).toEqual([{ sha: expect.stringMatching(/^[0-9a-f]{64}$/), mime: 'image/png', bytes: 70, width: 1, height: 1 }]);
  // The same picture twice is one blob; the declared JPEG type is ignored for the real PNG bytes.
  expect(op('shot1').images![0]!.sha).toBe(read[0]!.sha);
  expect(op('shot2').images).toEqual([
    { mime: 'image/png', bytes: expect.any(Number), width: 1, height: 1, omitted: 'too-large' },
    { bytes: expect.any(Number), omitted: 'unrecognised' },
  ]);
  // Observations never carry the image text inline: only a blob reference with no preview.
  const bodies = JSON.stringify(app.store.observations(recordingId));
  expect(bodies).not.toContain(PNG_1x1);
  expect(bodies).not.toContain(huge.slice(0, 200));

  const served = readImage(app.store, [recordingId], read[0]!.sha!);
  expect(served?.mime).toBe('image/png');
  expect(served?.body.equals(Buffer.from(PNG_1x1, 'base64'))).toBe(true);
  expect(readImage(app.store, [recordingId], '0'.repeat(64))).toBeUndefined();
  expect(readImage(app.store, [recordingId], '../x')).toBeUndefined();

  // Slice 2: images you paste into a prompt belong to that prompt, whichever part comes first.
  const pasted = await app.ingest.importSource('claude-code', write('c', [
    { ...base('c'), type: 'user', uuid: 'pp', message: { role: 'user', content: [image(PNG_1x1), { type: 'text', text: 'What is wrong in this screenshot?' }] } },
    { ...base('c'), type: 'user', uuid: 'pq', message: { role: 'user', content: [{ type: 'text', text: 'And this one?' }, image(PNG_1x1)] } },
  ]));
  const turns = app.projection(pasted.recordingId).timeline.filter((i) => i.type === 'turn');
  expect(turns.map((t) => t.type === 'turn' && [t.prompt, t.images?.map((i) => i.mime)])).toEqual([
    ['What is wrong in this screenshot?', ['image/png']],
    ['And this one?', ['image/png']],
  ]);
  expect(readImage(app.store, [pasted.recordingId], turns[0]!.type === 'turn' ? turns[0]!.images![0]!.sha! : '')?.mime).toBe('image/png');

  // Codex: images attached to the prompt and images a tool returned, both as data URLs.
  const codexRows = [
    { timestamp: '2026-10-21T00:00:00Z', type: 'session_meta', payload: { id: 'codex-images', cwd: dir, cli_version: '0.162.0' } },
    { timestamp: '2026-10-21T00:00:01Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Match this mockup' }, { type: 'input_image', image_url: `data:image/png;base64,${PNG_1x1}` }, { type: 'input_image', image_url: 'https://example.com/never-fetched.png' }] } },
    { timestamp: '2026-10-21T00:00:02Z', type: 'response_item', payload: { type: 'function_call', name: 'view_image', call_id: 'v1', arguments: JSON.stringify({ path: join(dir, 'shot.png') }) } },
    { timestamp: '2026-10-21T00:00:03Z', type: 'response_item', payload: { type: 'function_call_output', call_id: 'v1', output: [{ type: 'input_text', text: 'viewed' }, { type: 'input_image', image_url: `data:image/png;base64,${PNG_1x1}` }] } },
  ];
  const codexPath = join(dir, 'rollout-codex-images.jsonl');
  writeFileSync(codexPath, codexRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const codex = await app.ingest.importSource('codex', codexPath);
  const cp = app.projection(codex.recordingId);
  const codexTurn = cp.timeline.find((i) => i.type === 'turn');
  expect(codexTurn?.type === 'turn' && codexTurn.images).toEqual([{ sha: read[0]!.sha, mime: 'image/png', bytes: 70, width: 1, height: 1 }]);
  expect(cp.operations.find((o) => o.id === `${codex.recordingId}.v1`)?.images?.map((i) => i.sha)).toEqual([read[0]!.sha]);
  expect(JSON.stringify(app.store.observations(codex.recordingId))).not.toContain('never-fetched');

  // Another recording cannot fetch this recording's image, even by its hash.
  const other = await app.ingest.importSource('claude-code', write('b', [{ ...base('b'), type: 'user', uuid: 'q', message: { role: 'user', content: 'Hello' } }]));
  expect(readImage(app.store, [other.recordingId], read[0]!.sha!)).toBeUndefined();
});
