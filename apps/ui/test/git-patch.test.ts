import { expect, it } from 'vitest';
import { gitPatchSections } from '../src/lib/git-patch.ts';

it('keeps staged/worktree hunks separate with actual zero/single/count coordinates', () => {
  const result = gitPatchSections('Staged changes\ndiff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-before\n+after\n\nWorking tree changes\ndiff --git a/a.ts b/a.ts\n@@ -0,0 +1,2 @@\n+first\n+second\n');
  expect(result.map(section => section.name)).toEqual(['Staged', 'Working tree']);
  expect(result[0]!.hunks[0]).toMatchObject({ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1 });
  expect(result[1]!.hunks[0]).toMatchObject({ oldStart: 0, oldLines: 0, newLines: 2 });
});
it('retains metadata and malformed/partial hunks as raw rather than inventing coordinates', () => {
  const result = gitPatchSections('Working tree changes\nBinary files a/a and b/a differ\n@@ -10,2 +10,2 @@\n-one\n+two\n');
  expect(result[0]!.hunks).toEqual([]); expect(result[0]!.raw).toContain('Binary files');
  expect(gitPatchSections('Untracked file. Open on disk.')).toEqual([]);
});
