// Optional, opt-in Claude Code UserPromptSubmit hook: a prompt that is exactly `/drishya` runs `drishya open` and is
// blocked, so the model is never called. Any other prompt passes through untouched. See docs/guides/embed.md.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

let prompt = '';
try {prompt = String(JSON.parse(readFileSync(0, 'utf8')).prompt ?? '').trim();} catch { /* not our input: let it through */ }
if (prompt !== '/drishya') process.exit(0);
// Fixed arguments only, nothing from the prompt. A shell is needed on Windows, where npm installs `drishya` as a .cmd file.
const r = spawnSync(process.platform === 'win32' ? 'drishya open' : 'drishya', process.platform === 'win32' ? [] : ['open'], {encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, timeout: 60_000, cwd: process.cwd()});
const line = (r.stdout || '').trim().split('\n').pop() || 'Drishya could not open the view.';
process.stdout.write(JSON.stringify({decision: 'block', reason: line}) + '\n');
