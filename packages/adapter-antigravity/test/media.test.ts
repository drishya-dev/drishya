import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, stat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureMedia } from '../src/media.ts';
import { createParser, descriptor } from '../src/index.ts';
import { liveParser } from '../src/live.ts';
import { seal, type RawObservation } from '@drishya/capture-core';

const roots: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GAAAAABJRU5ErkJggg==', 'base64');
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'ag-media-')); roots.push(root);
  const dir = join(root, 'brain', 'one');
  await mkdir(join(dir, '.system_generated', 'logs', 'media'), { recursive: true });
  await mkdir(join(dir, '.user_uploaded'));
  return { root, dir };
}
afterEach(async () => { for (const root of roots.splice(0)) {
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup');
  await rm(root, { recursive: true, force: true });
} });
it('captures only explicitly referenced same-conversation images without modifying them', async () => {
  const { root, dir } = await setup(), path = join(dir, '.user_uploaded', 'shot.png');
  await writeFile(path, png); const before = await stat(path);
  const value = await captureMedia(root, 'one', [{ uri: pathToFileURL(path).href, mime_type: 'text/plain' }]);
  expect(value.images[0]).toMatchObject({ mime: 'image/png', width: 1, height: 1, data: png.toString('base64') });
  expect(value.references[0]?.availability).toBe('captured-file');
  expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
  expect((await captureMedia(root, 'two', [{ uri: path }])).images[0]?.omitted).toBe('protected');
  expect((await captureMedia(root, 'one', [{ uri: 'https://example.test/a.png' }])).images[0]?.omitted).toBe('protected');
});
it('reports missing, oversized and invalid files, and rejects a directory junction escape', async () => {
  const { root, dir } = await setup();
  const uploaded = join(dir, '.user_uploaded');
  expect((await captureMedia(root, 'one', ['.user_uploaded/missing.png'])).images[0]?.omitted).toBe('referenced-file');
  await writeFile(join(uploaded, 'big.png'), Buffer.alloc(4 * 1024 * 1024 + 1));
  await writeFile(join(uploaded, 'invalid.png'), 'not an image');
  expect((await captureMedia(root, 'one', ['.user_uploaded/big.png', '.user_uploaded/invalid.png'])).images.map(i => i.omitted)).toEqual(['too-large', 'unrecognised']);
  const outside = join(root, 'outside'); await mkdir(outside); await writeFile(join(outside, 'shot.png'), png);
  await rm(uploaded, { recursive: true });
  await symlink(outside, uploaded, process.platform === 'win32' ? 'junction' : 'dir');
  expect((await captureMedia(root, 'one', ['.user_uploaded/shot.png'])).images[0]?.omitted).toBe('protected');
});
it('puts image bytes on user and result receipts and seals artifact text before persistence', async () => {
  const { root, dir } = await setup(), path = join(dir, '.user_uploaded', 'shot.png');
  await writeFile(path, png);
  const ctx = { recordingId: 'r', sourceId: 's', sourcePath: join(dir, '.system_generated', 'logs', 'transcript_full.jsonl') };
  const parser = liveParser(createParser(ctx), ctx, root, 'one', () => undefined, () => 2);
  const raws: RawObservation[] = [];
  const ingest = async (row: Record<string, unknown>) => { await parser.prepare?.(row); const out = parser.parse(row); raws.push(...out); return out; };
  const user = await ingest({ step_index: 0, type: 'USER_INPUT', source: 'USER_EXPLICIT', content: '', media: [{ uri: path }] });
  expect(user.find(r => r.kind === 'message.user')?.payload.images).toHaveLength(1);
  const canary = 'ghp_' + '1'.repeat(36), artifact = join(dir, 'task.md');
  await writeFile(artifact, `- [x] ${canary}`);
  const call = await ingest({ step_index: 1, type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'write_file', args: { Path: JSON.stringify(artifact), Content: JSON.stringify('- [ ] initial'), ArtifactMetadata: '{}' } }] });
  expect(call.find(r => r.kind === 'tool.call')?.payload.intent).toMatchObject({ kind: 'plan' });
  expect((await parser.refresh?.())?.some(r => r.kind === 'artifact.plan')).toBe(false);
  const result = await ingest({ step_index: 2, type: 'GENERIC', content: 'Created artifact', media: [{ uri: path }] });
  expect(result.find(r => r.kind === 'tool.result')?.payload.images).toHaveLength(1);
  const versions = (await parser.refresh?.())?.filter(r => r.kind === 'artifact.plan') ?? [];
  expect(versions).toHaveLength(1);
  const sealed = versions.map((raw, i) => seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: i, observedAt: '2026-11-14T10:00:00Z' }));
  expect(JSON.stringify(sealed)).not.toContain(canary);
  expect(versions[0]?.payload.forOperationId).toBe(call.find(r => r.kind === 'tool.call')?.operationId);
});
