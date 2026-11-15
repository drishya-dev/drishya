import { describe, expect, it } from 'vitest';
import { applyEdits, applyHunks, diffTexts, hunksFromStrings, parseApplyPatch } from '../src/patch.ts';
import { relativize } from '../src/paths.ts';
import { classifyShell, parseHitLines, plausibleHitPath } from '../src/shell.ts';
import { isTestCommand, parseTestOutput } from '../src/tests.ts';
import { buildPassages } from '../src/reduce.ts';
import type { Operation, TimelineItem } from '@drishya/contracts';

describe('history identity', () => {
  it('anchors passages to captured event IDs when earlier events arrive late', () => {
    const op = (id: string) => ({ id, agentId: 'r.agent:main' }) as Operation;
    const call = (id: string): TimelineItem => ({ type: 'op-start', id: `s_${id}`, operationId: id, agentId: 'r.agent:main', sequence: 0 });
    const turn: TimelineItem = { type: 'turn', id: 'turn_late', agentId: 'r.agent:main', sequence: 0 };
    const original = buildPassages([call('first'), { type: 'turn', id: 'turn_next', agentId: 'r.agent:main', sequence: 1 }, call('second')], [op('first'), op('second')], []);
    const withLate = buildPassages([turn, call('first'), { type: 'turn', id: 'turn_next', agentId: 'r.agent:main', sequence: 1 }, call('second')], [op('first'), op('second')], []);
    expect(withLate.map((p) => p.id)).toEqual(original.map((p) => p.id));
    expect(withLate[0]!.firstStep).toBe(original[0]!.firstStep + 1);
  });
});

describe('edit reconstruction', () => {
  it('applies an edit only when the old string occurs exactly once', () => {
    expect(applyEdits('a\nb\nc', [{ oldString: 'b', newString: 'B' }])).toBe('a\nB\nc');
    expect(applyEdits('b b', [{ oldString: 'b', newString: 'B' }])).toBeUndefined();
    expect(applyEdits('a', [{ oldString: 'zzz', newString: 'B' }])).toBeUndefined();
    expect(applyEdits('b b', [{ oldString: 'b', newString: 'B', replaceAll: true }])).toBe('B B');
  });

  it('refuses a patch whose context does not match the base', () => {
    const [f] = parseApplyPatch('*** Begin Patch\n*** Update File: a.ts\n@@\n x\n-y\n+Y\n*** End Patch');
    expect(applyHunks('x\ny\nz', f!.hunks)?.text).toBe('x\nY\nz');
    expect(applyHunks('q\nr', f!.hunks)).toBeUndefined();
  });

  it('parses add, update and move in apply_patch', () => {
    const files = parseApplyPatch('*** Begin Patch\n*** Add File: n.ts\n+hello\n*** Update File: o.ts\n*** Move to: p.ts\n@@\n-a\n+b\n*** End Patch');
    expect(files.map((f) => [f.op, f.path, f.moveTo])).toEqual([['add', 'n.ts', undefined], ['update', 'o.ts', 'p.ts']]);
  });

  it('diffs whole texts into unified hunks', () => {
    const h = diffTexts('1\n2\n3\n4\n5\n6\n7\n8', '1\n2\n3\n4x\n5\n6\n7\n8', 1)!;
    expect(h).toHaveLength(1);
    expect(h[0]!.lines).toEqual([' 3', '-4', '+4x', ' 5']);
    expect(h[0]!.oldStart).toBe(3);
  });

  it('locates string edits in a known base', () => {
    const [h] = hunksFromStrings([{ oldString: 'b', newString: 'B' }], 'a\nb\nc');
    expect(h!.oldStart).toBe(2);
  });
});

describe('shell classification (derived)', () => {
  it.each([
    ['npm test', 'test'],
    ['pnpm vitest run', 'test'],
    ['cd api && python -m pytest -q', 'test'],
    ['cat src/a.ts', 'read'],
    ["sed -n '10,40p' src/a.ts", 'read'],
    ['rg -n "total" src', 'search'],
    ['git grep foo', 'search'],
    ['ls -la', 'shell'],
    ['cat a.ts | grep x', 'shell'],
  ])('%s → %s', (cmd, kind) => expect(classifyShell(cmd).kind).toBe(kind));

  it('keeps operators inside quoted search patterns and file names', () => {
    expect(classifyShell("cd 'my project' && rg -n 'open|close' src")).toEqual({ kind: 'search', query: 'open|close', path: 'src' });
    expect(classifyShell('cat "notes; final.md"')).toEqual({ kind: 'read', path: 'notes; final.md' });
    expect(classifyShell('cat "C:\\My Work\\notes.md"')).toEqual({ kind: 'read', path: 'C:\\My Work\\notes.md' });
    expect(classifyShell('cat "notes; final.md" | head -n 2')).toEqual({ kind: 'shell' });
  });

  it('does not attribute compound command output to its first read or multiline search', () => {
    expect(classifyShell('Get-Content README.md\r\n# Report status next.\r\nWrite-Output Ready')).toEqual({ kind: 'shell' });
    expect(classifyShell('rg -n total src\nWrite-Output Ready')).toEqual({ kind: 'shell' });
    expect(classifyShell('cat "work notes.md"; echo Ready')).toEqual({ kind: 'shell' });
    expect(classifyShell('cat "work notes.md" && echo Ready')).toEqual({ kind: 'shell' });
    expect(classifyShell('cd src && cat "work notes.md"')).toEqual({ kind: 'read', path: 'work notes.md' });
    expect(classifyShell('cat README.md\n# Finished | ready to review')).toEqual({ kind: 'read', path: 'README.md' });
    expect(classifyShell('Get-Content README.md\npnpm vitest run')).toEqual({ kind: 'test' });
  });

  it('does not infer file paths from shell input bodies or ambiguously doubled quotes', () => {
    expect(classifyShell("cat <<'NOTE'\nA work note\nNOTE")).toEqual({ kind: 'shell' });
    expect(classifyShell("cat @'\nA work note\n'@")).toEqual({ kind: 'shell' });
    expect(classifyShell("rg 'today''s note' src")).toEqual({ kind: 'shell' });
  });

  it('reads the range from sed', () => {
    expect(classifyShell("sed -n '10,40p' src/a.ts")).toEqual({ kind: 'read', path: 'src/a.ts', start: 10, end: 40 });
  });

  it('parses search hits including Windows drive letters', () => {
    expect(parseHitLines('src/a.ts:3:const x\nC:\\w\\b.ts:9:y')).toEqual([
      { path: 'src/a.ts', line: 3, text: 'const x' },
      { path: 'C:\\w\\b.ts', line: 9, text: 'y' },
    ]);
  });

  // BUG-8: a grep over test-runner output must not invent files. Log lines still parse as hits (they are captured
  // text) but only a plausible path may become a file reference.
  it('does not register log lines from test output as files', () => {
    const junk = [
      'ok 146 tests\\browser\\toolbar.spec.ts:420:1 › the dock keeps identities',
      '[270/408] tests\\browser\\p1-pacing.spec.ts:482:1 › every observed action kind',
      '1) tests\\browser\\b2-live.spec.ts:139:1 › long history mounts only nearby work',
      'x 150 tests/browser/a.spec.ts:9:1 › fails',
    ];
    for (const line of junk) {
      const [hit] = parseHitLines(line);
      expect(hit, line).toBeDefined();
      expect(plausibleHitPath(hit!.path), line).toBe(false);
    }
  });

  it('keeps real paths: relative, posix, dynamic routes, and absolute paths with spaces', () => {
    for (const path of ['src/a.ts', 'tests\\browser\\a.spec.ts', 'app/[id]/page.tsx', '0-trace.stacks', '/home/me/my project/a.ts', 'C:\\Users\\Some One\\repo\\a.ts', '~/notes/a b.md']) {
      expect(plausibleHitPath(path), path).toBe(true);
    }
    for (const path of ['', ' src/a.ts', 'src/a b.ts', 'src/a.ts\n']) expect(plausibleHitPath(path), JSON.stringify(path)).toBe(false);
  });
});

describe('test output parsing (derived)', () => {
  it('recognises test commands', () => {
    expect(isTestCommand('npm run test:unit')).toBe(true);
    expect(isTestCommand('cd api && timeout 600 python -m pytest -q')).toBe(true);
    expect(isTestCommand('py -3 -m pytest tests\\test_env.py -q')).toBe(true);
    expect(isTestCommand('CI=1 pnpm vitest run')).toBe(true);
    expect(isTestCommand('npm install')).toBe(false);
    expect(isTestCommand('node node_modules/vitest/vitest.mjs run')).toBe(true);
    expect(isTestCommand('node node_modules/@playwright/test/cli.js test')).toBe(true);
  });

  it('does not mistake a mention of a runner for running it', () => {
    expect(isTestCommand("cat > run.py <<'EOF'\nimport pytest\npytest.main()\nEOF")).toBe(false);
    expect(isTestCommand("Select-String -Path requirements.txt -Pattern 'pytest-timeout'")).toBe(false);
    expect(isTestCommand('grep -rl pytest tests | head')).toBe(false);
    expect(isTestCommand("rg -n 'palette|mocha|tokyo' themes.css")).toBe(false);
    expect(isTestCommand('text(await tools.exec_command({cmd:"rg -n \'palette|mocha|tokyo\' themes.css"}));')).toBe(false);
    expect(isTestCommand('printf "first; npm test\\npytest"')).toBe(false);
  });

  it('only closes a shell heredoc at its complete delimiter line', () => {
    const command = ["cat <<'NOTE' > README.md", 'NOTE is the title of this page.', 'npm test', 'NOTE'].join('\n');
    expect(isTestCommand(command)).toBe(false);
    expect(isTestCommand(command + '\npnpm vitest run')).toBe(true);
  });

  it('skips multiple input bodies and recognises a runner after a PowerShell here-string', () => {
    const heredocs = ["cat <<'FIRST' <<-'SECOND'", 'project notes', 'FIRST', '\tpnpm vitest run', '\tSECOND'].join('\n');
    expect(isTestCommand(heredocs)).toBe(false);
    const hereString = ["Set-Content README.md @'", 'npm test', "'@"].join('\r\n');
    expect(isTestCommand(hereString)).toBe(false);
    expect(isTestCommand(hereString + '; npm test')).toBe(true);
  });

  it('ignores input markers within multiline quoted arguments and standalone comments', () => {
    const quoted = ["printf '%s' 'A Markdown example:", 'cat <<EXAMPLE', "end of sample'", 'npm test'].join('\n');
    const commented = ["# Example input: cat <<NOTE with 'quoted text", 'npm test'].join('\r\n');
    expect(isTestCommand(quoted)).toBe(true);
    expect(isTestCommand(commented)).toBe(true);
  });

  it('ignores heredoc examples in inline comments and keeps literal hashes in arguments', () => {
    const commented = ['echo Ready # Example input: cat <<NOTE', 'npm test'].join('\n');
    expect(isTestCommand(commented)).toBe(true);

    for (const path of ['notes#2.md', 'my\\ #2.md']) {
      const heredoc = ['cat ' + path + ' <<NOTE', 'npm test', 'NOTE'].join('\n');
      expect(isTestCommand(heredoc)).toBe(false);
    }
  });

  it('recognises complete hyphenated heredoc delimiters before a real test command', () => {
    for (const delimiter of ['WORK-NOTES', "'WORK-NOTES'", '"WORK-NOTES"']) {
      const doc = ['cat <<' + delimiter, 'npm test', 'WORK-NOTES'].join('\n');
      expect(isTestCommand(doc)).toBe(false);
      expect(isTestCommand(doc + '\npnpm vitest run')).toBe(true);
    }
  });

  it('parses quiet pytest output', () => {
    expect(parseTestOutput('........\n138 passed, 4 warnings in 10.32s\r\n')).toMatchObject({ framework: 'pytest', passed: 138, failed: 0 });
  });

  it('parses vitest failures with file and line', () => {
    const s = parseTestOutput(' FAIL  test/a.test.ts > suite > works\nAssertionError: expected 1 to be 2\n ❯ test/a.test.ts:12:5\n\n      Tests  1 failed | 3 passed (4)\n')!;
    expect(s).toMatchObject({ framework: 'vitest', failed: 1, passed: 3, failures: [{ name: 'suite > works', file: 'test/a.test.ts', line: 12, message: 'AssertionError: expected 1 to be 2' }] });
  });

  it('does not mistake the harness exit line for the assertion', () => {
    const s = parseTestOutput('Error: Exit code 1\n × t 1ms\nAssertionError: real\n      Tests  1 failed (1)\n')!;
    expect(s.failures[0]!.message).toBe('AssertionError: real');
  });

  it('parses jest, pytest, go and cargo summaries', () => {
    expect(parseTestOutput('Tests:       2 failed, 5 passed, 7 total')).toMatchObject({ framework: 'jest', failed: 2, passed: 5 });
    expect(parseTestOutput('FAILED tests/t.py::test_x - assert 1 == 2\n==== 1 failed, 4 passed in 0.2s ====')).toMatchObject({ framework: 'pytest', failed: 1, passed: 4, failures: [{ name: 'test_x', file: 'tests/t.py' }] });
    expect(parseTestOutput('--- FAIL: TestX (0.00s)\n--- PASS: TestY (0.00s)\nFAIL\tpkg')).toMatchObject({ framework: 'go', failed: 1, passed: 1 });
    expect(parseTestOutput('test result: FAILED. 3 passed; 1 failed; 0 ignored')).toMatchObject({ framework: 'cargo', failed: 1, passed: 3 });
  });

  it('returns nothing for output it does not recognise', () => {
    expect(parseTestOutput('hello')).toBeUndefined();
  });
});

describe('paths', () => {
  it('relativizes posix and Windows paths', () => {
    expect(relativize('/w/shop/src/a.ts', '/w/shop')).toBe('src/a.ts');
    expect(relativize('C:\\W\\Shop\\src\\a.ts', 'c:\\w\\shop')).toBe('src/a.ts');
    expect(relativize('/elsewhere/x', '/w/shop')).toBe('/elsewhere/x');
  });
});
