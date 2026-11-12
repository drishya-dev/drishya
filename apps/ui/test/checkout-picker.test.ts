import { describe, it, expect } from 'vitest';
import { buildCheckoutPickerModel, filterCheckoutOptions } from '../src/lib/checkout-picker.ts';
import type { RecordedFileRoot } from '../src/lib/worktree-files.ts';

describe('FILES-16b checkout picker model', () => {
  it('returns undefined when only the session checkout has captured files', () => {
    const roots: RecordedFileRoot[] = [
      { root: 'C:/repo', prefix: 'worktree-main', fileCount: 4, onDisk: 'present' },
      { root: 'C:/cwd-only', prefix: 'worktree-empty', fileCount: 0, onDisk: 'present' },
    ];
    expect(buildCheckoutPickerModel({ fileRoots: roots, sessionRoot: 'C:/repo', checkoutPrefix: undefined })).toBeUndefined();
  });

  it('names each Codex worktree slot cleanly without repeating drishya on every row', () => {
    const roots: RecordedFileRoot[] = [
      { root: 'C:/Users/u/Desktop/CS/Projects/drishya', prefix: 'worktree-main', fileCount: 12, onDisk: 'present', lastFileSequence: 10 },
      { root: 'C:/Users/u/.codex/worktrees/files16-nov11/drishya', prefix: 'worktree-a', fileCount: 5, onDisk: 'present', lastFileSequence: 40 },
      { root: 'C:/Users/u/.codex/worktrees/003f/drishya', prefix: 'worktree-b', fileCount: 1, onDisk: 'present', lastFileSequence: 30 },
    ];
    const model = buildCheckoutPickerModel({ fileRoots: roots, sessionRoot: roots[0]!.root, checkoutPrefix: 'worktree-a' })!;
    expect(model.summaryTitle).toBe('files16-nov11');
    expect(model.options.map(o => ({ title: o.title, accessibleName: o.accessibleName, meta: o.metadata }))).toEqual([
      { title: 'drishya', accessibleName: 'Session checkout', meta: '…/Desktop/CS/Projects · 12 files' },
      { title: 'files16-nov11', accessibleName: 'files16-nov11', meta: '…/.codex/worktrees/…/drishya · 5 files' },
      { title: '003f', accessibleName: '003f', meta: '…/.codex/worktrees/…/drishya · 1 file' },
    ]);
  });

  it('prefers recorded branch, ignores HEAD/detached, and disambiguates duplicate branches', () => {
    const roots: RecordedFileRoot[] = [
      { root: 'C:/repo/drishya', prefix: 'worktree-main', branch: 'main', fileCount: 2, onDisk: 'present', lastFileSequence: 5 },
      { root: 'C:/repo/drishya/.claude/worktrees/sleepy-jones', prefix: 'worktree-1', branch: 'claude/ui-28b', fileCount: 6, onDisk: 'present', lastFileSequence: 30 },
      { root: 'C:/repo/drishya/.claude/worktrees/keen-bell', prefix: 'worktree-2', branch: 'claude/ui-28b', fileCount: 4, onDisk: 'present', lastFileSequence: 20 },
      { root: 'C:/repo/drishya/.claude/worktrees/detached-wt', prefix: 'worktree-3', branch: 'HEAD', fileCount: 3, onDisk: 'present', lastFileSequence: 15 },
      { root: 'C:/repo/drishya/.claude/worktrees/unique-branch-wt', prefix: 'worktree-4', branch: 'feat/solo', fileCount: 1, onDisk: 'present', lastFileSequence: 10 },
    ];
    const model = buildCheckoutPickerModel({ fileRoots: roots, sessionRoot: roots[0]!.root, checkoutPrefix: undefined })!;
    expect(model.summaryTitle).toBe('drishya');
    expect(model.options.map(o => o.title)).toEqual([
      'drishya',
      'claude/ui-28b · sleepy-jones',
      'claude/ui-28b · keen-bell',
      'detached-wt',
      'feat/solo',
    ]);
  });

  it('disambiguates colliding non-worktree directories and same-slot cross-harness worktrees', () => {
    const roots: RecordedFileRoot[] = [
      { root: 'C:/Projects/main/Report', prefix: 'worktree-main', fileCount: 3, onDisk: 'present' },
      { root: 'C:/Projects/other/Report', prefix: 'worktree-other', fileCount: 2, onDisk: 'present', lastFileSequence: 50 },
      { root: 'C:/u/.codex/worktrees/alpha/Report', prefix: 'worktree-codex', fileCount: 4, onDisk: 'present', lastFileSequence: 40 },
      { root: 'C:/u/.claude/worktrees/alpha/Report', prefix: 'worktree-claude', fileCount: 1, onDisk: 'present', lastFileSequence: 30 },
    ];
    const model = buildCheckoutPickerModel({ fileRoots: roots, sessionRoot: roots[0]!.root, checkoutPrefix: undefined })!;
    const titles = model.options.map(o => o.title);
    expect(new Set(titles).size).toBe(4);
    expect(titles).toEqual([
      'main/Report',
      'other/Report',
      '.codex/worktrees/alpha',
      '.claude/worktrees/alpha',
    ]);
  });

  it('orders present roots first and puts removed and unavailable roots last, enabling filter above eight rows', () => {
    const present = Array.from({ length: 6 }, (_, i) => ({
      root: `C:/u/.codex/worktrees/wt-0${i + 1}/drishya`,
      prefix: `worktree-p${i + 1}`,
      fileCount: i + 1,
      onDisk: 'present' as const,
      lastFileSequence: 100 + i,
    }));
    const roots: RecordedFileRoot[] = [
      { root: 'C:/Projects/drishya', prefix: 'worktree-main', fileCount: 9, onDisk: 'present' },
      ...present,
      { root: 'C:/u/.codex/worktrees/old-removed/drishya', prefix: 'worktree-r1', fileCount: 3, onDisk: 'removed', lastFileSequence: 999 },
      { root: '/mnt/wsl/worktrees/unavail/drishya', prefix: 'worktree-u1', fileCount: 2, onDisk: 'unavailable', lastFileSequence: 500 },
    ];
    const model = buildCheckoutPickerModel({ fileRoots: roots, sessionRoot: roots[0]!.root, checkoutPrefix: undefined })!;
    expect(model.options).toHaveLength(9);
    expect(model.showFilter).toBe(true);
    expect(model.options.at(-2)).toMatchObject({ title: 'old-removed', onDisk: 'removed' });
    expect(model.options.at(-1)).toMatchObject({ title: 'unavail', onDisk: 'unavailable' });

    const filtered = filterCheckoutOptions(model.options, 'removed');
    expect(filtered.present).toHaveLength(0);
    expect(filtered.unavailable.map(o => o.title)).toEqual(['old-removed']);

    const empty = filterCheckoutOptions(model.options, 'nonexistent-branch-xyz');
    expect(empty.present).toHaveLength(0);
    expect(empty.unavailable).toHaveLength(0);
  });

  it('preserves exact basename for fixture-shaped roots (FILES-16 compatibility)', () => {
    const codexRoots: RecordedFileRoot[] = [
      { root: 'C:/tmp/drishya-f16/main', prefix: 'worktree-1111111111', fileCount: 1, onDisk: 'present', lastFileSequence: 1 },
      { root: 'C:/tmp/drishya-f16/worker', prefix: 'worktree-2222222222', fileCount: 1, onDisk: 'present', lastFileSequence: 2 },
    ];
    const codexModel = buildCheckoutPickerModel({ fileRoots: codexRoots, sessionRoot: codexRoots[0]!.root, checkoutPrefix: undefined })!;
    expect(codexModel.showFilter).toBe(false);
    expect(codexModel.options[0]?.accessibleName).toBe('Session checkout');
    expect(codexModel.options[1]?.accessibleName).toBe('worker');

    const claudeRoots: RecordedFileRoot[] = [
      { root: 'C:/tmp/drishya-f16/main', prefix: 'worktree-1111111111', branch: 'main', fileCount: 1, onDisk: 'present', lastFileSequence: 1 },
      { root: 'C:/tmp/drishya-f16/worker', prefix: 'worktree-2222222222', branch: 'feature/worker', fileCount: 1, onDisk: 'present', lastFileSequence: 2 },
    ];
    const claudeModel = buildCheckoutPickerModel({ fileRoots: claudeRoots, sessionRoot: claudeRoots[0]!.root, checkoutPrefix: 'worktree-2222222222' })!;
    expect(claudeModel.summaryTitle).toBe('feature/worker');
    expect(claudeModel.options[1]?.accessibleName).toBe('feature/worker');
  });
});
