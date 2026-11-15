// SEC-3: a repository built to attack the person who opens it in Drishya.
//
// Its configuration, attributes and hooks name a marker program for every way Git can be made to run
// one. If Drishya's reading ever starts one, a file appears in `marks/`.
import { chmodSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, makeRepo, write } from './seed.ts';

const fwd = (path: string) => path.replace(/\\/g, '/');

export interface HostileRepo {
  root: string;
  marks: string;
  /** Names of the marker programs that ran, sorted. */
  ran(): string[];
}

/** The marker: `node mark.cjs <name>` writes `marks/<name>`; it prints nothing and exits 0. */
function marker(dir: string): { command: (name: string) => string; marks: string } {
  const marks = join(dir, 'marks');
  mkdirSync(marks, { recursive: true });
  const script = join(dir, 'mark.cjs');
  writeFileSync(script, `require('fs').writeFileSync(${JSON.stringify(fwd(marks))} + '/' + process.argv[2].replace(/[^a-z0-9_.-]/gi, '_'), 'ran');`);
  // Quoted for Git's config parser and for sh: forward slashes work on every platform.
  return { command: (name) => `node "${fwd(script)}" ${name}`, marks };
}

/**
 * @param dir a scratch directory the caller owns; the repository is `dir/repo`.
 * @param opts.commit make the hostile settings part of an already-created history
 */
export function makeHostileRepo(dir: string): HostileRepo {
  const root = makeRepo(join(dir, 'repo'));
  const { command, marks } = marker(dir);
  const hooks = join(dir, 'hooks');
  mkdirSync(hooks, { recursive: true });
  for (const hook of ['pre-commit', 'post-commit', 'post-checkout', 'post-merge', 'reference-transaction', 'pre-push', 'post-rewrite', 'fsmonitor-watchman', 'post-index-change', 'pre-auto-gc', 'commit-msg', 'prepare-commit-msg']) {
    const file = join(hooks, hook);
    writeFileSync(file, `#!/bin/sh\n${command('hook-' + hook)}\nexit 0\n`);
    chmodSync(file, 0o755);
  }
  write(join(root, '.gitattributes'), '* filter=evil diff=evil merge=evil\n');
  write(join(root, 'src', 'b.ts'), 'export const b = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'second commit <img src=x onerror=window.__pwned=1>');
  git(root, 'branch', 'feature/<script>x</script>'.replace(/[<>]/g, '_'));
  // A submodule whose own repository carries its own filter configuration (status looks inside it).
  const subSource = join(dir, 'subsrc');
  makeRepo(subSource);
  write(join(subSource, '.gitattributes'), '* filter=subevil\n');
  git(subSource, 'add', '.');
  git(subSource, 'commit', '-q', '-m', 'submodule attributes');
  git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', fwd(subSource), 'vendor');
  git(root, 'commit', '-q', '-m', 'add submodule');
  const submodule = join(root, 'vendor');
  for (const key of ['clean', 'smudge', 'process']) git(submodule, 'config', '--local', `filter.subevil.${key}`, command('sub-filter-' + key));
  git(submodule, 'config', '--local', 'core.fsmonitor', command('sub-core.fsmonitor'));
  write(join(submodule, 'src', 'a.ts'), 'export const a = 99; // dirty inside the submodule\n');
  // Dirty the files so Git must look at their content.
  write(join(root, 'src', 'a.ts'), 'export const a = 3; // changed\n');
  write(join(root, 'src', 'b.ts'), 'export const b = 2; // changed\n');
  write(join(root, 'untracked.ts'), 'export const u = 1;\n');

  const settings: [string, string][] = [
    ['core.fsmonitor', command('core.fsmonitor')],
    ['core.pager', command('core.pager')],
    ['core.editor', command('core.editor')],
    ['core.sshCommand', command('core.sshCommand')],
    ['core.askPass', command('core.askPass')],
    ['core.gitProxy', command('core.gitProxy')],
    ['core.hooksPath', fwd(hooks)],
    ['core.untrackedCache', 'true'],
    ['diff.external', command('diff.external')],
    ['diff.evil.command', command('diff.evil.command')],
    ['diff.evil.textconv', command('diff.evil.textconv')],
    ['filter.evil.clean', command('filter.clean')],
    ['filter.evil.smudge', command('filter.smudge')],
    ['filter.evil.process', command('filter.process')],
    ['filter.evil.required', 'true'],
    ['merge.evil.driver', command('merge.driver')],
    ['credential.helper', '!' + command('credential.helper')],
    ['gpg.program', command('gpg.program')],
    ['gpg.ssh.program', command('gpg.ssh.program')],
    ['log.showSignature', 'true'],
    ['uploadpack.packObjectsHook', command('packObjectsHook')],
    ['sequence.editor', command('sequence.editor')],
    ['remote.origin.url', `ext::${command('remote.ext')}`],
    ['remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'],
    ['alias.show', '!' + command('alias.show')],
    ['alias.status', '!' + command('alias.status')],
    ['alias.diff', '!' + command('alias.diff')],
    ['alias.log', '!' + command('alias.log')],
    ['alias.cat-file', '!' + command('alias.cat-file')],
    ['alias.rev-parse', '!' + command('alias.rev-parse')],
    ['alias.for-each-ref', '!' + command('alias.for-each-ref')],
    ['alias.merge-base', '!' + command('alias.merge-base')],
    ['alias.config', '!' + command('alias.config')],
    ['alias.ls-files', '!' + command('alias.ls-files')],
  ];
  for (const [key, value] of settings) git(root, 'config', '--local', key, value);
  return {
    root,
    marks,
    ran: () => readdirSync(marks).sort(),
  };
}
