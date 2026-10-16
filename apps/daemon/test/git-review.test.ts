import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, renameSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { App, HttpError } from '../src/app.ts';
import { WorkspaceAccess } from '../src/workspace.ts';
import { GitReview, parseStatus, readGit } from '../src/git-review.ts';

let dir: string, root: string, id: string, app: App, access: WorkspaceAccess, review: GitReview;
const git = (...args: string[]) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'diff.external=', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
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
  expect(Number.isFinite(Date.parse(snapshot.sampledAt))).toBe(true); expect(snapshot.scope).toBe('current-git'); expect(snapshot.head).toMatch(/^[a-f0-9]{40}$/);
  expect(snapshot.files.find(f => f.path === 'staged.ts')?.patch).toContain('Staged changes');
  expect(snapshot.files.find(f => f.path === 'a.ts')?.patch).toContain('[REDACTED:');
  expect(JSON.stringify(snapshot)).not.toContain('abcdefghijklmnopqrstuvw');
  expect(snapshot.files.some(f => f.path === '.env')).toBe(false); expect(snapshot.omitted).toBe(1);
  expect(snapshot.files.find(f => f.path === 'untracked.ts')?.patch).toContain('Untracked file');
  expect(existsSync(join(dir, 'helper-ran'))).toBe(false);
});
// Two real Git snapshots can exceed Vitest's 5s default on Windows.
// Keep the production subprocess/snapshot limits and every race/privacy assertion.
it('changes the review content identity on an edit without changing HEAD', { timeout: 20_000 }, async () => {
  const before = await review.snapshot(id); writeFileSync(join(root, 'a.ts'), 'export const a = 3;\n');
  const after = await review.snapshot(id); expect(after.head).toBe(before.head);
  expect(after.files.find(f => f.path === 'a.ts')?.fingerprint).not.toBe(before.files.find(f => f.path === 'a.ts')?.fingerprint);
  review.revoke(id); await expect(review.snapshot(id)).rejects.toMatchObject({ status: 403 });
});
it('parses NUL-delimited rename paths and unusual filenames without whitespace splitting', () => {
  expect(parseStatus('R  new name.ts\0old name.ts\0?? odd\nfile.ts\0')).toEqual([{ path: 'new name.ts', previousPath: 'old name.ts', status: 'R ' }, { path: 'odd\nfile.ts', previousPath: undefined, status: '??' }]);
});

// Two real Git snapshots can exceed Vitest's 5s default on Windows.
// Keep the production subprocess/snapshot limits and every race/privacy assertion.
it('rejects a worktree edit during inspection even when status and HEAD stay identical, then allows retry', { timeout: 20_000 }, async () => {
  const status = git('status', '--porcelain=v1'), head = git('rev-parse', 'HEAD');
  let edited = false;
  const concurrent = new GitReview(access, async (root, args, signal) => {
    const output = await readGit(root, args, signal);
    if (!edited && args.includes('diff') && !args.includes('--cached') && args.at(-1) === 'a.ts') {
      edited = true; writeFileSync(join(root, 'a.ts'), 'export const a = 7;\n');
    }
    return output;
  });
  await access.approve(id); await concurrent.approve(id);
  await expect(concurrent.snapshot(id)).rejects.toMatchObject({ status: 409 });
  expect(git('status', '--porcelain=v1')).toBe(status); expect(git('rev-parse', 'HEAD')).toBe(head);
  expect((await concurrent.snapshot(id)).files.find(f => f.path === 'a.ts')?.patch).toContain('a = 7');
});

it('rejects changed staged content even when index status and HEAD stay identical', async () => {
  const status = git('status', '--porcelain=v1');
  let edited = false;
  const concurrent = new GitReview(access, async (root, args, signal) => {
    const output = await readGit(root, args, signal);
    if (!edited && args.includes('diff') && args.includes('--cached') && args.at(-1) === 'staged.ts') {
      edited = true; writeFileSync(join(root, 'staged.ts'), 'different staged content\n'); git('add', 'staged.ts');
    }
    return output;
  });
  await access.approve(id); await concurrent.approve(id);
  await expect(concurrent.snapshot(id)).rejects.toMatchObject({ status: 409 });
  expect(git('status', '--porcelain=v1')).toBe(status);
});

it('compares raw patch identity even when different credentials have the same redacted display', async () => {
  const first = 'const apiKey = "sk-proj-abcdefghijklmnopqrstuvw0123456789";\n';
  const second = 'const apiKey = "sk-proj-zyxwvutsrqponmlkjihgfed0123456789";\n';
  writeFileSync(join(root, 'a.ts'), first);
  let reads = 0;
  const concurrent = new GitReview(access, async (root, args, signal) => {
    const output = await readGit(root, args, signal);
    if (args.includes('diff') && !args.includes('--cached') && args.at(-1) === 'a.ts' && ++reads === 1) writeFileSync(join(root, 'a.ts'), second);
    return output;
  });
  await access.approve(id); await concurrent.approve(id);
  await expect(concurrent.snapshot(id)).rejects.toMatchObject({ status: 409 });
  expect(reads).toBe(2);
});

it('detects a late edit after the last patch comparison through file change markers', async () => {
  const status = git('status', '--porcelain=v1');
  let reads = 0;
  const concurrent = new GitReview(access, async (root, args, signal) => {
    const output = await readGit(root, args, signal);
    if (args.includes('diff') && !args.includes('--cached') && args.at(-1) === 'a.ts' && ++reads === 2) writeFileSync(join(root, 'a.ts'), 'export const a = 9;\n');
    return output;
  });
  await access.approve(id); await concurrent.approve(id);
  await expect(concurrent.snapshot(id)).rejects.toMatchObject({ status: 409 });
  expect(git('status', '--porcelain=v1')).toBe(status);
});

it('detects a branch switch at the same HEAD', async () => {
  const branch = git('symbolic-ref', '--short', 'HEAD').trim(), head = git('rev-parse', 'HEAD');
  let switched = false;
  const concurrent = new GitReview(access, async (root, args, signal) => {
    const output = await readGit(root, args, signal);
    if (!switched && args.includes('diff')) { switched = true; git('checkout', '-b', 'synthetic-review-branch'); }
    return output;
  });
  await access.approve(id); await concurrent.approve(id);
  try {
    await expect(concurrent.snapshot(id)).rejects.toMatchObject({ status: 409 });
    expect(git('rev-parse', 'HEAD')).toBe(head);
  } finally { git('checkout', branch); }
});

it('detects a staged blob replacement after patch verification without relying on worktree timestamps', async () => {
  const blob = git('hash-object', '-w', '--stdin');
  let reads = 0;
  const concurrent = new GitReview(access, async (root, args, signal) => {
    const output = await readGit(root, args, signal);
    if (args.includes('diff') && !args.includes('--cached') && args.at(-1) === 'staged.ts' && ++reads === 2) {
      // Updating only the index leaves the displayed status MM after both versions
      // are staged against a separately modified worktree.
      git('update-index', '--cacheinfo', `100644,${blob.trim()},staged.ts`);
    }
    return output;
  });
  writeFileSync(join(root, 'staged.ts'), 'unstaged worktree content\n');
  const before = git('status', '--porcelain=v1');
  await access.approve(id); await concurrent.approve(id);
  await expect(concurrent.snapshot(id)).rejects.toMatchObject({ status: 409 });
  expect(git('status', '--porcelain=v1')).toBe(before);
});

it('bounds readers to four and preserves status order and the fifty-file limit across both passes', async () => {
  const paths = Array.from({ length: 60 }, (_, n) => `bounded-${n}.ts`);
  let active = 0, peak = 0, reads = 0;
  const bounded = new GitReview(access, async (approvedRoot, args) => {
    switch (args[0]) {
      case 'rev-parse': return args.includes('--show-toplevel') ? approvedRoot : 'synthetic-head';
      case 'symbolic-ref': return 'synthetic-branch';
      case 'status': return ['.env', ...paths].map(path => ` M ${path}\0`).join('');
      case 'config': return '';
      case 'ls-files': return 'synthetic-index';
      case 'diff': {
        active++; peak = Math.max(peak, active); reads++;
        try {
          await new Promise<void>(resolve => setImmediate(resolve));
          return args.includes('--cached') ? '' : `synthetic patch ${args.at(-1)}`;
        } finally { active--; }
      }
      default: throw new Error('unexpected reader command');
    }
  });
  await access.approve(id); await bounded.approve(id);
  const snapshot = await bounded.snapshot(id);
  expect(snapshot.files.map(file => file.path)).toEqual(paths.slice(0, 50));
  expect(snapshot.omitted).toBe(11);
  expect(peak).toBe(4); expect(active).toBe(0); expect(reads).toBe(200);
});

it('skips an oversized patch without hiding later files and pages all eligible paths', async () => {
  const paths = Array.from({ length: 60 }, (_, n) => `paged-${n}.ts`);
  const paged = new GitReview(access, async (approvedRoot, args) => {
    if (args[0] === 'rev-parse') return args.includes('--show-toplevel') ? approvedRoot : 'head';
    if (args[0] === 'symbolic-ref') return 'branch';
    if (args[0] === 'status') return ['.env', ...paths].map(path => ` M ${path}\0`).join('');
    if (args[0] === 'config') return '';
    if (args[0] === 'ls-files') return 'index';
    if (args.includes('diff')) return args.includes('--cached') ? '' : args.at(-1) === paths[0] ? 'x'.repeat(1024 * 1024 + 1) : `small patch ${args.at(-1)}`;
    throw new Error('unexpected command');
  });
  await access.approve(id); await paged.approve(id);
  const first = await paged.snapshot(id);
  expect(first.files.map(file => file.path)).toEqual(paths.slice(1, 50));
  expect(first.omissions).toEqual([{ path: paths[0], reason: 'content-limit' }]);
  expect(first.protectedCount).toBe(1); expect(first.totalAllowed).toBe(60);
  const next = await paged.snapshot(id, 50);
  expect(next.files.map(file => file.path)).toEqual(paths.slice(50));
  expect(next.pageStart).toBe(50);
  expect((await paged.snapshot(id, 5000)).pageStart).toBe(50);
  await expect(paged.snapshot(id, -1)).rejects.toMatchObject({ status: 400 });
});

it('reports a per-file process content limit but never swallows an ordinary Git failure', async () => {
  let failStatus = 413;
  const limited = new GitReview(access, async (approvedRoot, args) => {
    if (args[0] === 'rev-parse') return args.includes('--show-toplevel') ? approvedRoot : 'head';
    if (args[0] === 'symbolic-ref') return 'branch';
    if (args[0] === 'status') return ' M large.ts\0 M small.ts\0';
    if (args[0] === 'config') return '';
    if (args[0] === 'ls-files') return 'index';
    if (args.includes('diff')) { if (args.at(-1) === 'large.ts') throw new HttpError(failStatus, 'synthetic limit'); return 'small'; }
    throw new Error('unexpected command');
  });
  await access.approve(id); await limited.approve(id);
  const snapshot = await limited.snapshot(id);
  expect(snapshot.files.map(file => file.path)).toEqual(['small.ts']);
  expect(snapshot.omissions).toEqual([{ path: 'large.ts', reason: 'process-limit' }]);
  failStatus = 422;
  await expect(limited.snapshot(id)).rejects.toMatchObject({ status: 422 });
});

it('rejects consent revoked while Git inspection is in progress', async () => {
  let revoked = false;
  let shared: AbortSignal | undefined;
  const racing = new GitReview(access, async (cwd, args, signal) => {
    const out = await readGit(cwd, args, signal);
    expect(signal).toBeInstanceOf(AbortSignal);
    shared ??= signal; expect(signal).toBe(shared);
    if (!revoked && args.includes('diff')) { revoked = true; racing.revoke(id); }
    return out;
  });
  await racing.approve(id);
  await expect(racing.snapshot(id)).rejects.toMatchObject({ status: 409 });
});

it('rejects a file replaced with identical bytes during inspection', async () => {
  let replaced = false;
  const racing = new GitReview(access, async (cwd, args, signal) => {
    const out = await readGit(cwd, args, signal);
    if (!replaced && args.includes('diff') && !args.includes('--cached') && args.at(-1) === 'a.ts') {
      replaced = true;
      const path = join(root, 'a.ts'), old = join(root, 'a.ts.previous');
      const bytes = readFileSync(path); renameSync(path, old); writeFileSync(path, bytes); rmSync(old);
    }
    return out;
  });
  await racing.approve(id);
  await expect(racing.snapshot(id)).rejects.toMatchObject({ status: 409 });
  expect(replaced).toBe(true);
});

// Two real Git snapshots can exceed Vitest's 5s default on Windows.
// Keep the production subprocess/snapshot limits and every race/privacy assertion.
it('changes snapshot identity when switching to another branch at the same commit', { timeout: 20_000 }, async () => {
  const stable = new GitReview(access); await stable.approve(id);
  const before = await stable.snapshot(id);
  git('symbolic-ref', 'HEAD', 'refs/heads/synthetic-review'); git('update-ref', 'HEAD', before.head);
  const after = await stable.snapshot(id);
  expect(after.head).toBe(before.head); expect(after.branch).not.toBe(before.branch);
  expect(after.fingerprint).not.toBe(before.fingerprint);
  expect(after.files.map(f => f.fingerprint)).toEqual(before.files.map(f => f.fingerprint));
});

it('disables configured content filters for status and diff without modifying Git configuration', async () => {
  const canary = join(dir, 'filter-ran');
  const helper = `node -e "require('fs').writeFileSync('${canary.replace(/\\/g, '/')}', 'bad')"`;
  writeFileSync(join(root, '.gitattributes'), 'a.ts filter=synthetic\n');
  git('config', 'filter.synthetic.clean', helper); git('config', 'filter.synthetic.process', helper); git('config', 'filter.synthetic.required', 'true');
  const config = git('config', '--list');
  const filtered = new GitReview(access); await filtered.approve(id);
  const snapshot = await filtered.snapshot(id);
  expect(snapshot.files.find(f => f.path === 'a.ts')?.patch).toContain('export const a = 9');
  expect(existsSync(canary)).toBe(false); expect(git('config', '--list')).toBe(config);
});
