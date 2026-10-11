import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { WorkspaceAccess } from '../src/workspace.ts';
import { GitReview, parseStatus } from '../src/git-review.ts';

let dir: string, root: string, id: string, app: App, access: WorkspaceAccess, review: GitReview;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-git-')); root = join(dir, 'repo'); mkdirSync(root);
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, 'a.ts'), 'export const a = 1;\n'); writeFileSync(join(root, 'staged.ts'), 'before\n'); writeFileSync(join(root, '.env'), 'SECRET=before');
  git('add', '.'); git('commit', '-m', 'synthetic fixture');
  writeFileSync(join(root, 'a.ts'), 'const apiKey = "sk-proj-abcdefghijklmnopqrstuvw0123456789";\n');
  writeFileSync(join(root, 'staged.ts'), 'after\n'); git('add', 'staged.ts');
  writeFileSync(join(root, '.env'), 'SECRET=private'); writeFileSync(join(root, 'untracked.ts'), 'new\n');
  // These helper commands would create an observable canary if inspection executed them.
  const canary = join(dir, 'helper-ran');
  const helper = `node -e "require('fs').writeFileSync('${canary.replace(/\\/g, '/')}', 'bad')"`;
  git('config', 'diff.external', helper); git('config', 'core.fsmonitor', helper);
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '55555555-5555-4555-8555-555555555555', cwd: root, message: { role: 'user', content: 'Synthetic Git review' } }) + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  access = new WorkspaceAccess(app); review = new GitReview(access);
});
afterAll(async () => { await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe fixture'); rmSync(dir, { recursive: true, force: true }); });
it('requires separate Git and current-workspace consent', async () => {
  await expect(review.approve(id)).rejects.toMatchObject({ status: 403 });
  await access.approve(id); await expect(review.snapshot(id)).rejects.toMatchObject({ status: 403 }); await review.approve(id);
});
it('returns bounded redacted staged/worktree changes without invoking helpers or protected content', async () => {
  const snapshot = await review.snapshot(id);
  expect(snapshot.scope).toBe('current-git'); expect(snapshot.head).toMatch(/^[a-f0-9]{40}$/);
  expect(snapshot.files.find(f => f.path === 'staged.ts')?.patch).toContain('Staged changes');
  expect(snapshot.files.find(f => f.path === 'a.ts')?.patch).toContain('[REDACTED:');
  expect(JSON.stringify(snapshot)).not.toContain('abcdefghijklmnopqrstuvw');
  expect(snapshot.files.some(f => f.path === '.env')).toBe(false); expect(snapshot.omitted).toBe(1);
  expect(snapshot.files.find(f => f.path === 'untracked.ts')?.patch).toContain('Untracked file');
  expect(existsSync(join(dir, 'helper-ran'))).toBe(false);
});
it('changes the review content identity on an edit without changing HEAD', async () => {
  const before = await review.snapshot(id); writeFileSync(join(root, 'a.ts'), 'export const a = 3;\n');
  const after = await review.snapshot(id); expect(after.head).toBe(before.head);
  expect(after.files.find(f => f.path === 'a.ts')?.fingerprint).not.toBe(before.files.find(f => f.path === 'a.ts')?.fingerprint);
  review.revoke(id); await expect(review.snapshot(id)).rejects.toMatchObject({ status: 403 });
});
it('parses NUL-delimited rename paths and unusual filenames without whitespace splitting', () => {
  expect(parseStatus('R  new name.ts\0old name.ts\0?? odd\nfile.ts\0')).toEqual([{ path: 'new name.ts', previousPath: 'old name.ts', status: 'R ' }, { path: 'odd\nfile.ts', previousPath: undefined, status: '??' }]);
});
