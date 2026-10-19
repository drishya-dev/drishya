import {describe,it,expect} from 'vitest';
import {workspaceTabLabels} from '../src/lib/workspace-tab-labels.ts';
describe('compact Workspace tab identity',()=>{
 it('keeps distinct filenames simple and distinguishes a root and nested README',()=>{const labels=workspaceTabLabels(['README.md','eval/README.md','src/main.ts']);expect([...labels.values()]).toEqual(['README.md','README.md · eval','main.ts']);});
 it('uses the shortest unambiguous parent suffix and is independent of tab order',()=>{const paths=['apps/a/src/index.ts','apps/b/src/index.ts','lib/index.ts'];const labels=workspaceTabLabels(paths);expect([...labels.values()]).toEqual(['index.ts · a/src','index.ts · b/src','index.ts · lib']);expect(workspaceTabLabels([...paths].reverse()).get(paths[0]!)).toBe(labels.get(paths[0]!));});
 it('handles nesting, Windows separators and non-Latin names without altering paths',()=>{const paths=['src/index.ts','foo/src/index.ts','docs/दृश्य.md','other/दृश्य.md','windows\\run.ts'];const labels=workspaceTabLabels(paths);expect(labels.get('src/index.ts')).toBe('index.ts · src');expect(labels.get('foo/src/index.ts')).toBe('index.ts · foo/src');expect(labels.get('docs/दृश्य.md')).toBe('दृश्य.md · docs');expect(labels.get('windows\\run.ts')).toBe('run.ts');});
});
