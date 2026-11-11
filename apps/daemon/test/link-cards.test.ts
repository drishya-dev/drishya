import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { GithubLinks, parseGithubUrl } from '../src/github-links.ts';
import { gitRefSummary } from '../src/git-ref.ts';

let dir: string, app: App;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-link-cards-')); app = new App(join(dir, 'data')); });
afterAll(async () => { await app.close(); if (resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true }); });

it('accepts only exact github.com pull request and issue addresses', () => {
  expect(parseGithubUrl('https://github.com/drishya-dev/drishya/pull/395')).toEqual({ owner: 'drishya-dev', repo: 'drishya', kind: 'pull', number: 395 });
  expect(parseGithubUrl('https://github.com/a/b/issues/7#issuecomment-1')?.kind).toBe('issue');
  for (const bad of ['http://github.com/a/b/pull/1', 'https://github.com.evil.test/a/b/pull/1', 'https://example.com/a/b/pull/1', 'https://github.com/a/b/commit/abc', 'https://github.com/a/b/pull/0', 'https://github.com/a/../pull/1', 'https://user@github.com/a/b/pull/1'])
    expect(parseGithubUrl(bad), bad).toBeUndefined();
});

it('runs nothing without opt-in, then answers from the signed-in gh once and caches it', async () => {
  const calls: string[][] = [];
  const gh = async (args: string[]) => {
    calls.push(args);
    if (args[0] === '--version') return 'gh version 2.0.0';
    return JSON.stringify({ state: 'OPEN', title: 'Fix the thing', author: { login: 'octo' }, additions: 12, deletions: 3, changedFiles: 2, isDraft: false, mergedAt: null });
  };
  const links = new GithubLinks(app, gh);
  const url = 'https://github.com/o/r/pull/5';
  expect(await links.item(url)).toEqual({ status: 'disabled' });
  expect(await links.status()).toEqual({ enabled: false });
  expect(calls).toEqual([]);                                  // not even `gh --version` before the opt-in
  expect(await links.set(true)).toEqual({ enabled: true, available: true });
  const first = await links.item(url);
  expect(first).toMatchObject({ status: 'ready', item: { kind: 'pull', state: 'open', title: 'Fix the thing', author: 'octo', additions: 12, deletions: 3, changedFiles: 2, url } });
  await links.item(url);
  expect(calls.filter((call) => call[0] === 'pr')).toEqual([['pr', 'view', '5', '--repo', 'o/r', '--json', 'state,title,author,additions,deletions,changedFiles,url,isDraft,mergedAt']]);
  await expect(links.item('https://example.com/a/b/pull/1')).rejects.toMatchObject({ status: 400 });
  await links.set(false);
  expect(await links.item(url)).toEqual({ status: 'disabled' });
});

it('says plainly when gh is missing or signed out and does not cache those answers', async () => {
  let mode: 'missing' | 'signed-out' = 'missing';
  const gh = async (args: string[]) => {
    if (mode === 'missing') throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    if (args[0] === '--version') return 'gh';
    throw Object.assign(new Error('failed'), { stderr: 'To get started with GitHub CLI, please run:  gh auth login' });
  };
  const links = new GithubLinks(app, gh); await links.set(true);
  expect(await links.item('https://github.com/o/r/issues/9')).toEqual({ status: 'gh-missing' });
  mode = 'signed-out';
  const fresh = new GithubLinks(app, gh);
  expect(await fresh.item('https://github.com/o/r/issues/9')).toEqual({ status: 'gh-unauthenticated' });
});

it('summarises a commit and a local branch from read-only Git, and refuses anything else', async () => {
  const root = join(dir, 'repo'); mkdirSync(root);
  const run = (args: string[]) => execFileSync('git', ['-c', 'user.email=a@b.test', '-c', 'user.name=Tester', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  run(['init', '-q', '-b', 'main']); writeFileSync(join(root, 'a.txt'), 'one\n'); run(['add', '.']); run(['commit', '-qm', 'First subject']);
  writeFileSync(join(root, 'a.txt'), 'one\ntwo\nthree\n'); writeFileSync(join(root, 'b.txt'), 'x\n'); run(['add', '.']); run(['commit', '-qm', 'Second subject']);
  run(['branch', 'feature/cards']);
  const git = async (args: string[]) => run(args);
  const sha = run(['rev-parse', 'HEAD']).trim();
  const commit = await gitRefSummary(git, sha.slice(0, 10));
  expect(commit).toMatchObject({ found: true, kind: 'commit', hash: sha, subject: 'Second subject', author: 'Tester', additions: 3, deletions: 0, files: 2 });
  expect(await gitRefSummary(git, 'feature/cards')).toMatchObject({ found: true, kind: 'branch', name: 'feature/cards', subject: 'Second subject' });
  expect(await gitRefSummary(git, 'deadbeef1234')).toEqual({ found: false });
  expect(await gitRefSummary(git, 'no/such-branch')).toEqual({ found: false });
  for (const bad of ['--output=x', '-x', 'a..b', 'with space', 'x'.repeat(101)]) await expect(gitRefSummary(git, bad), bad).rejects.toMatchObject({ status: 400 });
});
