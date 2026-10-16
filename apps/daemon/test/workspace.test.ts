import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { WorkspaceAccess } from '../src/workspace.ts';

let dir: string, root: string, id: string, app: App, access: WorkspaceAccess;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-workspace-'));
  root = join(dir, 'repo'); mkdirSync(root);
  writeFileSync(join(root, 'a.ts'), Array.from({ length: 405 }, (_, n) => n === 201 ? 'const apiKey = "sk-proj-abcdefghijklmnopqrstuvw0123456789";' : `export const item${n} = ${n};`).join('\n'));
  writeFileSync(join(root, '.env'), 'private data');
  writeFileSync(join(root, 'binary.ts'), Buffer.from([0, 1, 2]));
  writeFileSync(join(root, 'invalid-utf8.ts'), Buffer.from([0x61,0xc3,0x28]));
  writeFileSync(join(root, 'large.ts'), 'a'.repeat(2 * 1024 * 1024 + 1));
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '44444444-4444-4444-8444-444444444444', cwd: root, message: { role: 'user', content: 'Synthetic workspace' } }) + '\n');
  app = new App(join(dir, 'store'));
  id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  access = new WorkspaceAccess(app);
});
afterAll(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
it('does not treat graph approval as file-content permission', async () => {
  await app.approveGraphRoot(id);
  expect(access.status(id).approved).toBe(false);
  await expect(access.read(id, 'a.ts')).rejects.toMatchObject({ status: 403 });
});
it('approves only the selected captured workspace and returns bounded redacted current pages', async () => {
  await access.approve(id);
  const page = await access.read(id, 'a.ts', 200);
  expect(page.scope).toBe('current-workspace'); expect(page.returnedLines).toBe(200); expect(page.hasMore).toBe(true);
  expect(page.text).toContain('[REDACTED:'); expect(page.text).not.toContain('abcdefghijklmnopqrstuvw'); expect(page.redacted).toBe(true);
});
it('returns the entire redacted file for document reading with the same consent boundary',async()=>{
  const file=await access.read(id,'a.ts',0,Number.MAX_SAFE_INTEGER);
  expect(file.start).toBe(0);expect(file.hasMore).toBe(false);expect(file.returnedLines).toBe(file.totalLines);
  expect(file.text.split('\n')).toHaveLength(file.totalLines);
  await expect(new WorkspaceAccess(app).read(id,'a.ts',0,Number.MAX_SAFE_INTEGER)).rejects.toMatchObject({status:403});
});
it.each(['../outside.ts', '/etc/passwd', 'C:/private.ts', '.env', 'folder/../../a.ts', 'folder\\a.ts', '.local/private.ts'])('rejects protected or escaping path %s', async path => {
  await expect(access.read(id, path)).rejects.toMatchObject({ status: 403 });
});
it('rejects symlinks even into the approved root', async () => {
  symlinkSync(root, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(access.read(id, 'linked/a.ts')).rejects.toMatchObject({ status: 403 });
});
it('refuses binary and oversized content', async () => {
  await expect(access.read(id, 'binary.ts')).rejects.toMatchObject({ status: 413 });
  // The index itself excludes oversized files; also cover growth after an approved scan.
  await expect(access.read(id, 'large.ts')).rejects.toMatchObject({ status: 403 });
  writeFileSync(join(root, 'a.ts'), 'a'.repeat(2 * 1024 * 1024 + 1));
  await expect(access.read(id, 'a.ts')).rejects.toMatchObject({ status: 413 });
});
it('requires a single workspace and drops reading permissions across server instances', async () => {
  await expect(access.approve(`${id}+${id}`)).rejects.toMatchObject({ status: 400 });
  expect(new WorkspaceAccess(app).status(id).approved).toBe(false);
});

it('refuses malformed UTF-8 rather than presenting replacement characters as editable source', async () => { await expect(access.read(id,'invalid-utf8.ts')).rejects.toMatchObject({status:413}); });
