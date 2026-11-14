// SEC-3: recordings and repositories for the security suite. Synthetic only.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { JOURNAL_WRITERS, hostileScenario, type Scenario } from './corpus.ts';
import type { Scratch } from './scratch.ts';

/** Runs the real `git` in a scratch repository with a fixed identity and no hooks of ours. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function write(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** A small repository with one commit and one uncommitted edit. */
export function makeRepo(root: string): string {
  mkdirSync(root, { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  write(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  write(join(root, 'README.md'), '# Synthetic\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'synthetic first commit');
  write(join(root, 'src', 'a.ts'), 'export const a = 2;\n');
  return root;
}

/** Imports a journal for one harness through its real adapter and returns the recording id. */
export async function importHostile(scratch: Scratch, adapterId: string, cwd: string, scenario: Scenario = hostileScenario(cwd), tag = ''): Promise<string> {
  const entry = JOURNAL_WRITERS[adapterId];
  if (!entry) throw new Error(`no hostile journal writer for ${adapterId}: add one to tests/security/lib/corpus.ts`);
  const file = join(scratch.dir, 'journals', tag ? entry.file.replace('.jsonl', `-${tag}.jsonl`) : entry.file);
  entry.writer(file, scenario);
  const imported = await scratch.run.app.ingest.importSource(adapterId, file);
  return imported.recordingId;
}

/** Person-consent steps the page walks through: read the workspace, then separately read its Git. */
export async function grantAccess(scratch: Scratch, recording: string): Promise<void> {
  const json = { ...scratch.bearer, 'content-type': 'application/json' };
  const workspace = await scratch.call(`/v1/recordings/${encodeURIComponent(recording)}/workspace/approve`, { method: 'POST', headers: json, body: '{}' });
  if (workspace.status !== 200) throw new Error(`workspace approval failed (${workspace.status}): ${workspace.text.slice(0, 120)}`);
  const gitAccess = await scratch.call(`/v1/recordings/${encodeURIComponent(recording)}/git/approve`, { method: 'POST', headers: json, body: '{}' });
  if (gitAccess.status !== 200) throw new Error(`git approval failed (${gitAccess.status}): ${gitAccess.text.slice(0, 120)}`);
}
