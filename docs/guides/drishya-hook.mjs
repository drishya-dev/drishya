// Optional, opt-in Claude Code UserPromptSubmit hook: a prompt that is exactly `/drishya` runs `drishya open` and is
// blocked, so the model is never called. Any other prompt passes through untouched. See docs/guides/embed.md.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  // Not our input or unparseable: let it through untouched.
  process.exit(0);
}

const prompt = String(input?.prompt ?? '').trim();
if (prompt !== '/drishya') process.exit(0);

// Validate session_id and cwd from Claude Code UserPromptSubmit payload contract.
// Session ID is an opaque identifier (e.g. UUID); validate safely with a strict pattern.
const sessionId = typeof input?.session_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(input.session_id)
  ? input.session_id
  : undefined;
const targetCwd = typeof input?.cwd === 'string' && input.cwd ? input.cwd : process.cwd();

// Fixed arguments only, nothing from prompt text. Pass exact session identity with --harness claude-code when available.
const args = ['open', ...(sessionId ? ['--session', sessionId, '--harness', 'claude-code'] : [])];

// On Windows, npm installs `drishya` as a .cmd file, which requires cmd /c. Construct fixed command string without DEP0190 args.
const isWin = process.platform === 'win32';
const winCmd = `drishya ${args.join(' ')}`;
const r = spawnSync(isWin ? winCmd : 'drishya', isWin ? [] : args, {
  encoding: 'utf8',
  shell: isWin,
  windowsHide: true,
  timeout: 60_000,
  cwd: targetCwd,
});

const line = (r.stdout || '').trim().split('\n').pop() || 'Drishya could not open the view.';
process.stdout.write(JSON.stringify({decision: 'block', reason: line}) + '\n');

