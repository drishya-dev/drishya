// Optional Claude Code UserPromptSubmit hook. Only an exact /drishya prompt is consumed.
import {spawnSync} from 'node:child_process';
import {readFileSync, realpathSync, statSync} from 'node:fs';
import {isAbsolute, delimiter, join, relative, sep} from 'node:path';

let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); }
catch { process.exit(0); }
if (typeof input?.prompt !== 'string' || input.prompt.trim() !== '/drishya') process.exit(0);
const block = reason => process.stdout.write(JSON.stringify({decision: 'block', reason}) + '\n');
// Match the launcher's native-ID grammar. Never fall back to another session or harness.
if (typeof input.session_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(input.session_id)) {
  block('Drishya needs the current Claude Code session ID; no view was opened.');
  process.exit(0);
}
if (typeof input.cwd !== 'string' || !isAbsolute(input.cwd) || input.cwd.length > 4096 || input.cwd.includes('\0')) {
  block('Drishya needs the current checkout directory; no view was opened.');
  process.exit(0);
}
const args = ['open', '--session', input.session_id, '--harness', 'claude-code'];
// On Windows run the global npm package's actual Node entry, never cmd.exe or a
// checkout-local shim. Only absolute PATH directories outside this checkout qualify.
let executable = 'drishya', launchArgs = args;
if (process.platform === 'win32') {
  let cli;
  let checkout;
  try {checkout = realpathSync(input.cwd);}
  catch {block('Drishya could not read the current checkout directory; no view was opened.'); process.exit(0);}
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    try {
      const candidate = realpathSync(join(directory, 'node_modules/drishya/apps/daemon/src/cli.mjs'));
      const fromCheckout = relative(checkout, candidate);
      if (fromCheckout === '' || (!fromCheckout.startsWith('..' + sep) && fromCheckout !== '..' && !isAbsolute(fromCheckout))) continue;
      if (statSync(candidate).isFile()) {cli = candidate; break;}
    } catch { /* not a global npm installation */ }
  }
  if (!cli) {
    block('Drishya could not find its global npm installation. Install it with npm install -g drishya, then retry.');
    process.exit(0);
  }
  executable = process.execPath;
  launchArgs = [cli, ...args];
}
const result = spawnSync(executable, launchArgs, {
  encoding: 'utf8', windowsHide: true, timeout: 60_000, cwd: input.cwd,
});
if (result.error?.code === 'ETIMEDOUT') block('Drishya took too long to open. Run drishya open with this session ID in a terminal to retry.');
else if (result.error || result.status !== 0) block('Drishya could not open this session. Check the installation and retry in a terminal.');
else block('Opened this Claude Code session in your system browser.');
