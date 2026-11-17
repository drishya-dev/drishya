// Test-output parsing. Derived, never captured: the runner printed text, we read it.
import type { TestSummary } from '@drishya/contracts';

// A segment counts only if it BEGINS with a runner. Mentioning "pytest" in a heredoc, a grep
// pattern or a file name is not running tests.
const RUNNER = /^(npx\s+|pnpm\s+(exec\s+|dlx\s+)?|yarn\s+|bunx?\s+|uv\s+run\s+|poetry\s+run\s+)?(vitest|jest|mocha|ava|playwright\s+test|pytest|py\.test|(python3?|py(\s+-3(\.\d+)?)?)(\.exe)?\s+-m\s+(pytest|unittest)|go\s+test|cargo\s+(test|nextest)|dotnet\s+test|mvn\w*\s+test|\.?\/?gradlew?\w*\s+test|rspec|phpunit|deno\s+test)(\s|$)/i;
const SCRIPT = /^(npm|pnpm|yarn|bun)\s+(run\s+)?test(:[\w-]+)?(\s|$)/i;
const PREFIX = /^((cd\s+("[^"]*"|'[^']*'|\S+))|(timeout\s+\d+[smh]?)|(env\s+)|(sudo\s+)|([A-Z_][A-Z0-9_]*=("[^"]*"|'[^']*'|\S*)))\s*/;
const NODE_RUNNER=/^node(?:\.exe)?\s+["']?(?:[^\s"']*[/\\])?(?:vitest(?:\.m?js)?|jest(?:\.m?js)?|(?:@playwright[/\\]test|playwright)[/\\]cli\.js["']?\s+test)(?:["']?\s|["']?$)/i;

/** A separator or input marker inside a quoted argument or comment is data. */
function* shellSymbols(body: string, state = { quote: '' }): IterableIterator<number> {
  let tokenStart = true;
  for (let i = 0; i < body.length; i++) {
    const char = body[i]!;
    if (char === '\n' || char === '\r') {
      tokenStart = true;
      if (!state.quote) yield i;
      continue;
    }
    if (!state.quote && tokenStart && char === '#') {
      while (i + 1 < body.length && body[i + 1] !== '\n' && body[i + 1] !== '\r') i++;
      continue;
    }
    if (state.quote) {
      tokenStart = false;
      if (char === '\\' && state.quote !== "'") { i++; continue; }
      if (char === state.quote) {
        if (body[i + 1] === char && char !== '`') { i++; continue; }
        state.quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { state.quote = char; tokenStart = false; continue; }
    if (char === '\\') { tokenStart = false; i++; continue; }
    tokenStart = /\s/.test(char) || ';&|<>()'.includes(char);
    if (char === ';' || char === '|' || char === '&' || char === '<' || char === '@') yield i;
  }
}

function* commandBoundaries(body: string): IterableIterator<{ at: number; next: number; pipe: boolean }> {
  let next = 0;
  for (const at of shellSymbols(body)) {
    if (at < next) continue;
    const char = body[at]!;
    if (char === ';' || char === '|' || char === '\n' || char === '\r' || (char === '&' && body[at + 1] === '&')) {
      next = at + (body[at + 1] === char ? 2 : 1);
      yield { at, next, pipe: char === '|' };
    }
  }
}

/** A derived file read needs an isolated output source. */
export function firstShellSegment(body: string): { text: string; allowRead: boolean; multiline: boolean } {
  let headEnd = body.length;
  let start = 0;
  let pastLine = false;
  let compound = false;
  let multiline = false;
  const noteLaterCommand = (end: number) => {
    if (headEnd === body.length) return;
    const segment = body.slice(start, end).trimStart();
    if (segment && !segment.startsWith('#')) {
      compound = true;
      multiline ||= pastLine;
    }
  };
  for (const boundary of commandBoundaries(body)) {
    noteLaterCommand(boundary.at);
    headEnd = Math.min(headEnd, boundary.at);
    compound ||= boundary.pipe;
    pastLine ||= body[boundary.at] === '\n' || body[boundary.at] === '\r';
    start = boundary.next;
  }
  noteLaterCommand(body.length);
  const text = body.slice(0, headEnd).trimEnd();
  for (const at of shellSymbols(text)) {
    // Stdin redirections and here-strings can supply the content independently of a file argument.
    if (text[at] === '<' || (text[at] === '@' && (text[at + 1] === '"' || text[at + 1] === "'"))) {
      return { text, allowRead: false, multiline };
    }
  }
  return { text, allowRead: !compound, multiline };
}

function* commandSegments(body: string): IterableIterator<string> {
  let start = 0;
  for (const { at, next } of commandBoundaries(body)) {
    yield body.slice(start, at);
    start = next;
  }
  yield body.slice(start);
}

/** Recognise simple shell heredoc delimiters and PowerShell here-strings without scanning ahead from each opener. */
function withoutInputBodies(cmd: string): string | undefined {
  if (!cmd.includes('<<') && !cmd.includes("@'") && !cmd.includes('@"')) return cmd;
  const lines = cmd.split(/\r?\n/);
  const kept: string[] = [];
  const state = { quote: '' };
  const opener = /<<(-?)[^\S\r\n]*(?:"([\w.-]+)"|'([\w.-]+)'|([\w.-]+))(?=$|[\s;&|<>])|@(["'])$/y;
  let ends: { marker: string; trimTabs: boolean; hereString: boolean }[] = [];
  let nextEnd = 0;
  for (const [index, line] of lines.entries()) {
    const end = ends[nextEnd];
    if (end) {
      const text = end.trimTabs ? line.replace(/^\t+/, '') : line;
      if (end.hereString && text.startsWith(end.marker)) {
        kept[kept.length - 1] += text.slice(end.marker.length);
        nextEnd++;
      } else if (!end.hereString && text === end.marker) nextEnd++;
      continue;
    }
    ends = [];
    nextEnd = 0;
    if (index === lines.length - 1) { kept.push(line); continue; }

    let cursor = 0;
    const parts: string[] = [];
    for (const at of shellSymbols(line, state)) {
      if (at < cursor || (line[at] !== '<' && line[at] !== '@') || line[at - 1] === '<') continue;
      opener.lastIndex = at;
      const match = opener.exec(line);
      if (!match) continue;
      const hereString = match[5] !== undefined;
      ends.push({ marker: hereString ? match[5] + '@' : (match[2] ?? match[3] ?? match[4])!, trimTabs: match[1] === '-', hereString });
      parts.push(line.slice(cursor, at), hereString ? '@heredoc@' : '<<heredoc');
      cursor = opener.lastIndex;
    }
    // The following lines are handled as a here-string body, not an ordinary quoted value.
    if (ends.at(-1)?.hereString) state.quote = '';
    if (cursor) parts.push(line.slice(cursor));
    kept.push(cursor ? parts.join('') : line);
  }
  return ends[nextEnd] ? undefined : kept.join('\n');
}

export function isTestCommand(cmd: string): boolean {
  const body = withoutInputBodies(cmd);
  if (body === undefined) return false;
  for (let seg of commandSegments(body)) {
    seg = seg.trim();
    for (let i = 0; i < 5; i++) {
      const m = PREFIX.exec(seg);
      if (!m || !m[0]) break;
      seg = seg.slice(m[0].length);
    }
    if (RUNNER.test(seg) || SCRIPT.test(seg) || NODE_RUNNER.test(seg)) return true;
  }
  return false;
}

const strip = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');

export function parseTestOutput(raw: string): TestSummary | undefined {
  const out = strip(raw);
  let framework = 'unknown';
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let found = false;
  const failures: TestSummary['failures'] = [];
  const passing: string[] = [];

  // vitest: "Tests  1 failed | 4 passed (5)"
  const vt = /^\s*Tests\s+(.+?)\s*\(\d+\)\s*$/m.exec(out);
  if (vt && /passed|failed|skipped/.test(vt[1]!)) {
    framework = 'vitest';
    found = true;
    passed = count(vt[1]!, 'passed');
    failed = count(vt[1]!, 'failed');
    skipped = count(vt[1]!, 'skipped') + count(vt[1]!, 'todo');
  }
  // jest: "Tests:       1 failed, 4 passed, 5 total"
  const jt = /^\s*Tests:\s+(.+total)\s*$/m.exec(out);
  if (!found && jt) {
    framework = 'jest';
    found = true;
    passed = count(jt[1]!, 'passed');
    failed = count(jt[1]!, 'failed');
    skipped = count(jt[1]!, 'skipped') + count(jt[1]!, 'todo');
  }
  // pytest: "==== 1 failed, 4 passed in 0.12s ===="
  // pytest, bordered ("==== 1 failed, 4 passed in 0.12s ====") or quiet ("138 passed in 10.3s").
  const pt = /^=+\s*(.*?\b(?:passed|failed|error)\b.*?)\s+in\s+[\d.]+s.*=+\s*$/m.exec(out) ?? /^\s*(\d+\s+(?:passed|failed|errors?)\b[^\n]*?)\s+in\s+[\d.]+s\b.*$/m.exec(out);
  if (!found && pt) {
    framework = 'pytest';
    found = true;
    passed = count(pt[1]!, 'passed');
    failed = count(pt[1]!, 'failed') + count(pt[1]!, 'error');
    skipped = count(pt[1]!, 'skipped');
  }
  // cargo: "test result: FAILED. 3 passed; 1 failed; 0 ignored"
  const ct = /test result: \w+\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored/.exec(out);
  if (!found && ct) {
    framework = 'cargo';
    found = true;
    passed = Number(ct[1]);
    failed = Number(ct[2]);
    skipped = Number(ct[3]);
  }
  // go: count "--- PASS" / "--- FAIL"
  if (!found && /^(--- (PASS|FAIL)|ok\s+\S+|FAIL\s+\S+)/m.test(out)) {
    framework = 'go';
    found = true;
    passed = (out.match(/^\s*--- PASS/gm) ?? []).length;
    failed = (out.match(/^\s*--- FAIL/gm) ?? []).length;
  }
  if (!found) return undefined;

  for (const line of out.split('\n')) {
    let m: RegExpExecArray | null;
    // vitest: " FAIL  test/cart.test.ts > checkout > free order" / " × free order 3ms"
    if ((m = /^\s*FAIL\s+(\S+\.\w+)\s+>\s+(.+?)\s*$/.exec(line))) addFailure(failures, m[2]!.replace(/\s+\d+ms$/, ''), m[1]);
    else if ((m = /^\s*[×✗✕]\s+(.+?)(\s+\d+ms)?\s*$/.exec(line))) addFailure(failures, m[1]!);
    else if ((m = /^\s*[✓✔√]\s+(.+?)(\s+\d+ms)?\s*$/.exec(line))) passing.push(m[1]!.trim());
    // jest: "● suite › name"
    else if ((m = /^\s*●\s+(.+›.+?)\s*$/.exec(line))) addFailure(failures, m[1]!);
    // pytest: "FAILED tests/test_cart.py::test_free - AssertionError: …"
    else if ((m = /^FAILED\s+([^:\s]+)::(\S+)(?:\s+-\s+(.*))?$/.exec(line))) addFailure(failures, m[2]!, m[1], m[3]);
    else if ((m = /^(\S+)::(\S+)\s+PASSED/.exec(line))) passing.push(m[2]!);
    // go / cargo
    else if ((m = /^\s*--- FAIL:\s+(\S+)/.exec(line))) addFailure(failures, m[1]!);
    else if ((m = /^\s*--- PASS:\s+(\S+)/.exec(line))) passing.push(m[1]!);
    else if ((m = /^test\s+(\S+)\s+\.\.\.\s+FAILED/.exec(line))) addFailure(failures, m[1]!);
    else if ((m = /^test\s+(\S+)\s+\.\.\.\s+ok/.exec(line))) passing.push(m[1]!);
  }

  // Assertion text and location, when printed near a failure: "AssertionError: expected …" and "❯ file:line:col".
  // Prefer a real assertion over a generic error; "Error: Exit code N" is the harness, not the test.
  const assertion =
    /^\s*AssertionError\b.*$/m.exec(out) ??
    /^\s*(?:TypeError|ReferenceError|RangeError|expect\(.+?\)\..+?)[:(].*$/m.exec(out) ??
    /^\s*Error:(?!\s*Exit code).*$/m.exec(out);
  const loc = /(?:❯|at)\s+([\w./\\-]+\.(?:[cm]?[jt]sx?|py|go|rs)):(\d+)/.exec(out);
  if (failures.length && assertion && !failures[0]!.message) failures[0]!.message = assertion[0].trim().slice(0, 300);
  if (failures.length && loc) {
    failures[0]!.file ??= loc[1];
    failures[0]!.line ??= Number(loc[2]);
  }
  return { framework, passed, failed, skipped, failures, passing, basis: 'derived' };
}

function count(s: string, word: string): number {
  const m = new RegExp(`(\\d+)\\s+${word}`).exec(s);
  return m ? Number(m[1]) : 0;
}

function addFailure(list: TestSummary['failures'], name: string, file?: string, message?: string) {
  const n = name.trim();
  if (!list.some((f) => f.name === n)) list.push({ name: n, file, message: message?.slice(0, 300) });
}
