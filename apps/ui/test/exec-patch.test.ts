import { describe, expect, it } from 'vitest';
import { extractExecPatches } from '../src/lib/exec-patch.ts';

describe('exec apply_patch detection', () => {
  it('extracts static variable-bound apply_patch payloads from Codex exec input', () => {
    const patch = '*** Begin Patch\n*** Update File: C:\\repo\\app.ts\n@@\n-const a = 1;\n+const a = 2;\n*** End Patch';
    const source = `const patch = ${JSON.stringify(patch)};\nconst r = await tools.apply_patch(patch);\ntext(typeof r === "string" ? r : JSON.stringify(r));`;
    const extracted = extractExecPatches(source);
    expect(extracted).toBeDefined();
    expect(extracted!.truncated).toBe(false);
    expect(extracted!.files).toHaveLength(1);
    expect(extracted!.files[0]).toMatchObject({ path: 'C:\\repo\\app.ts', op: 'update' });
    expect(extracted!.files[0]!.hunks[0]!.lines).toEqual(['-const a = 1;', '+const a = 2;']);
  });

  it('extracts truncated command previews and omits an incomplete trailing line', () => {
    const patch = '*** Begin Patch\n*** Update File: src/main.ts\n@@\n-const a = 1;\n+const a = 2;\n*** End Patch';
    const full = `const patch = ${JSON.stringify(patch)};\nawait tools.apply_patch(patch);`;
    const truncated = full.slice(0, full.indexOf('+const a = 2;') + 8);
    const extracted = extractExecPatches(truncated, true);
    expect(extracted).toBeDefined();
    expect(extracted!.truncated).toBe(true);
    expect(extracted!.files[0]!.hunks[0]!.lines).toEqual(['-const a = 1;']);
  });

  it('ignores ordinary shell commands and interpolated templates', () => {
    expect(extractExecPatches('git status --short')).toBeUndefined();
    expect(extractExecPatches('await tools.exec_command({ cmd: "echo *** Begin Patch" })')).toBeUndefined();
    expect(extractExecPatches('await tools.apply_patch(`*** Begin Patch\n${dynamic}\n*** End Patch`)')).toBeUndefined();
  });
});
