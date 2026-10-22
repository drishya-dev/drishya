import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { referencedImagePath } from '../src/images.ts';
import { WorkspaceAccess } from '../src/workspace.ts';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let dir: string, root: string, app: App;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-path-images-')); root = join(dir, 'repo'); mkdirSync(join(root, 'docs'), { recursive: true }); app = new App(join(dir, 'store')); });
afterEach(async () => { await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

// CONTENT-1 slice 3: an image known only by its path opens as today's file, only with approval,
// only at a path one of the recording's own actions referenced, and only if it is an image.
it('opens the current file behind a referenced image path only with workspace approval', async () => {
  writeFileSync(join(root, 'docs', 'shot.png'), Buffer.from(PNG_1x1, 'base64'));
  writeFileSync(join(root, 'docs', 'fake.png'), 'plain text named like an image');
  writeFileSync(join(dir, 'outside.png'), Buffer.from(PNG_1x1, 'base64'));
  const base = { timestamp: '2026-10-21T00:00:00Z', cwd: root, sessionId: '55555555-5555-4555-8555-555555555555' };
  const read = (id: string, path: string) => [
    { ...base, type: 'assistant', uuid: `a-${id}`, message: { id: `m-${id}`, role: 'assistant', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: path } }] } },
    // The result recorded no image block: the bytes were never captured.
    { ...base, type: 'user', uuid: `r-${id}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } },
  ];
  const rows = [
    { ...base, type: 'user', uuid: 'p', message: { role: 'user', content: 'Check the screenshots' } },
    ...read('shot', join(root, 'docs', 'shot.png')), ...read('fake', join(root, 'docs', 'fake.png')),
    ...read('outside', join(dir, 'outside.png')), ...read('code', join(root, 'docs', 'notes.md')),
  ];
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  const access = new WorkspaceAccess(app);

  expect(referencedImagePath(app.store, id, `${id}.shot`)).toBe(join(root, 'docs', 'shot.png'));
  expect(referencedImagePath(app.store, id, `${id}.code`)).toBeUndefined();
  expect(referencedImagePath(app.store, id, `${id}.unknown`)).toBeUndefined();

  await expect(access.image(id, referencedImagePath(app.store, id, `${id}.shot`)!)).rejects.toMatchObject({ status: 403 });
  await access.approve(id);
  const image = await access.image(id, referencedImagePath(app.store, id, `${id}.shot`)!);
  expect(image).toMatchObject({ mime: 'image/png', path: 'docs/shot.png' });
  expect(image.body.equals(Buffer.from(PNG_1x1, 'base64'))).toBe(true);
  await expect(access.image(id, referencedImagePath(app.store, id, `${id}.fake`)!)).rejects.toMatchObject({ status: 415 });
  await expect(access.image(id, referencedImagePath(app.store, id, `${id}.outside`)!)).rejects.toMatchObject({ status: 403 });
  await expect(access.image(id, join(root, 'docs', 'gone.png'))).rejects.toMatchObject({ status: 404 });
  // A link inside the workspace pointing at an image elsewhere is refused, like text reads.
  try { symlinkSync(join(dir, 'outside.png'), join(root, 'docs', 'link.png')); } catch { return; /* no symlink rights on this machine */ }
  await expect(access.image(id, join(root, 'docs', 'link.png'))).rejects.toMatchObject({ status: 403 });
});

it('resolves a Codex image item to its recorded path', async () => {
  const path = join(root, 'preview.png');
  const rows = [
    { timestamp: '2026-10-21T00:00:00Z', type: 'session_meta', payload: { id: 'codex-image-view', cwd: root, cli_version: '0.162.0' } },
    { timestamp: '2026-10-21T00:00:01Z', type: 'event_msg', payload: { type: 'item_completed', thread_id: 't', turn_id: 'u', item: { type: 'ImageView', id: 'image-one', path } } },
  ];
  const journal = join(dir, 'rollout-image-view.jsonl');
  writeFileSync(journal, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const id = (await app.ingest.importSource('codex', journal)).recordingId;
  const op = app.projection(id).operations.find((o) => o.title.startsWith('View image'))!;
  expect(op.detail).toMatchObject({ kind: 'other', input: { image: { path } } });
  expect(referencedImagePath(app.store, id, op.id)).toBe(path);
});
