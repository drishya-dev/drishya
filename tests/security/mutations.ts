// SEC-3: "each defence has a test that fails when the defence is removed", checked mechanically.
//
//   pnpm test:security:mutations            every mutation
//   pnpm test:security:mutations -- gate    only those whose name contains "gate"
//
// Each entry removes one defence by editing the source in place, runs the test files that guard it, expects
// them to FAIL, and restores the file byte for byte. A `find` that no longer matches stops the run, so this list
// is also a maintained inventory of the defences: when the code moves, update the entry.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Edit { file: string; find: string; replace: string }
interface Mutation { name: string; edits: Edit[]; tests: string[] }

const S = 'apps/daemon/src/server.ts';
const W = 'apps/daemon/src/workspace.ts';
const G = 'apps/daemon/src/git-review.ts';
const rm = (file: string, find: string): Edit => ({ file, find, replace: '' });

export const MUTATIONS: Mutation[] = [
  // 1. network exposure
  { name: 'network: bind-host allowlist', edits: [rm(S, "if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Drishya binds to loopback only.');")], tests: ['01-network'] },
  { name: 'network: listen on the wildcard address', edits: [{ file: S, find: 'server.listen(port, host, () => {', replace: 'server.listen(port, () => {' }], tests: ['01-network'] },
  // 2. the request gate
  { name: 'gate: token required', edits: [{ file: S, find: 'if (!authed(req)) throw new HttpError(401,', replace: 'if (false) throw new HttpError(401,' }], tests: ['02-request-gate'] },
  { name: 'gate: Host check (DNS rebinding)', edits: [rm(S, "if (!allowedHosts().has(String(req.headers.host ?? ''))) throw new HttpError(421, 'unexpected host');")], tests: ['02-request-gate'] },
  { name: 'gate: Origin check (cross-site)', edits: [rm(S, "if (origin && !allowedOrigins().has(origin)) throw new HttpError(403, 'unexpected origin');")], tests: ['02-request-gate'] },
  { name: 'gate: JSON content type on writes (CSRF form)', edits: [rm(S, "if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'JSON body required');")], tests: ['02-request-gate'] },
  { name: 'gate: no CORS allowance', edits: [{ file: S, find: 'for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);', replace: "for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v); res.setHeader('access-control-allow-origin', '*');" }], tests: ['02-request-gate'] },
  { name: 'gate: constant-time token compare', edits: [{ file: S, find: 'return x.length === y.length && timingSafeEqual(x, y);', replace: 'return a === b;' }], tests: ['02-request-gate'] },
  { name: 'gate: the token is not accepted in a query string', edits: [{ file: S, find: 'if (bearer && safeEqual(bearer, token)) return true;', replace: "if (bearer && safeEqual(bearer, token)) return true; if (new URL(req.url ?? '/', 'http://x').searchParams.get('token') === token) return true;" }], tests: ['02-request-gate'] },
  { name: 'gate: sign-out ends the session', edits: [rm(S, 'for (const sid of sessionsOf(req)) sessions.delete(sid);')], tests: ['02-request-gate'] },
  { name: 'gate: session expiry', edits: [{ file: S, find: 'if (t - s.lastSeen > idleMs || t - s.created > maxAgeMs) {', replace: 'if (false) {' }], tests: ['02-request-gate'] },
  { name: 'headers: X-Frame-Options', edits: [rm(S, "'x-frame-options': 'DENY',")], tests: ['02-request-gate'] },
  { name: 'headers: Referrer-Policy', edits: [rm(S, "'referrer-policy': 'no-referrer',")], tests: ['02-request-gate'] },
  { name: 'headers: CSP script-src', edits: [{ file: S, find: "script-src 'self';", replace: "script-src 'self' 'unsafe-inline';" }], tests: ['02-request-gate'] },
  // SEC-4: found by the penetration pass (12-pentest)
  { name: 'pentest: any valid session cookie signs in (cookie tossing)', edits: [{ file: S, find: 'return sessionsOf(req).some(sessionValid);', replace: "return sessionValid(sessionsOf(req)[0] ?? '');" }], tests: ['12-pentest'] },
  { name: 'pentest: a malformed escape is a 400', edits: [rm(S, "if (e instanceof URIError) return { status: 400, body: { error: 'malformed URL' } };")], tests: ['12-pentest'] },
  { name: 'pentest: an empty part of a combined recording id is a 404', edits: [rm(S, "if (id.split('+').some((part) => !part)) throw new HttpError(404, 'no such recording');")], tests: ['12-pentest'] },
  { name: 'pentest: only the history fields reach the worker', edits: [{ file: S, find: 'pageBytes(app.readingId(id), query)', replace: 'pageBytes(app.readingId(id), body as never)' }], tests: ['12-pentest'] },
  { name: 'pentest: control characters in a search are word breaks', edits: [{ file: 'packages/store/src/index.ts', find: String.raw`.replace(/["*^:()\u0000-\u001f]/g, ' ')`, replace: String.raw`.replace(/["*^:()]/g, ' ')` }, { file: 'packages/store/src/index.ts', find: String.raw`.replace(/["*^:()\u0000-\u001f]/g, ' ')`, replace: String.raw`.replace(/["*^:()]/g, ' ')` }], tests: ['12-pentest'] },
  { name: 'pentest: an unknown stored result is a 404', edits: [{ file: S, find: "throw new HttpError(404, 'Stored result not found.'); } // SEC-4", replace: "throw error; } // SEC-4" }], tests: ['12-pentest'] },
  { name: 'pentest: a launch code signs in once', edits: [rm(S, '    launchCodes.delete(code);')], tests: ['12-pentest'] },
  { name: 'pentest: the browser is opened with a code, not the token', edits: [{ file: 'apps/daemon/src/commands.ts', find: 'openBrowser(running.openUrl());', replace: 'openBrowser(running.launchUrl);' }], tests: ['12-pentest'] },
  { name: 'pentest: a launch code expires', edits: [{ file: S, find: 'return expires !== undefined && expires > now();', replace: 'return expires !== undefined;' }], tests: ['12-pentest'] },
  // 3. file access
  { name: 'files: static server stays inside the UI directory', edits: [rm(S, "if (!file.startsWith(resolve(uiDir) + sep) && file !== resolve(uiDir)) throw new HttpError(403, 'outside the UI directory');")], tests: ['03-file-access'] },
  { name: 'files: workspace grant required', edits: [rm(W, "if (!root || !rec.workspaceRoot || await realpath(rec.workspaceRoot) !== root) throw new HttpError(403, 'approve this session workspace first');")], tests: ['03-file-access'] },
  {
    name: 'files: path containment (`..`, protected names, root check and index membership together)',
    edits: [
      { file: W, find: ".some(p => !p || p === '.' || p === '..' || p.includes(':')) || isDeniedPath(path)) throw new HttpError(403, 'not a readable workspace path');", replace: ".some(() => false)) throw new HttpError(403, 'not a readable workspace path');" },
      rm(W, "if (relative(root, file).startsWith('..') || !file.startsWith(root + sep)) throw new HttpError(403, 'outside this workspace');"),
      { file: W, find: 'if (!(recordedMainFile || graph.truncated || graph.stale) || !await isIndexableFile(root, path)) throw', replace: 'if (false) throw' },
    ],
    tests: ['03-file-access'],
  },
  // 4. injected content
  { name: 'content: image bytes must carry a raster signature', edits: [{ file: 'packages/privacy/src/image.ts', find: "if (!sniff) return { kind: 'captured-image', bytes, omitted: 'unrecognised' };", replace: "sniff = sniff ?? { mime: 'image/png' };" }], tests: ['04-injected-content'] },
  { name: 'content: images are not cacheable by the browser', edits: [{ file: S, find: "'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });", replace: "'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });" }], tests: ['04-injected-content'] },
  // 5. command execution and Git
  { name: 'exec: Git content filters off for worktree commands', edits: [{ file: G, find: 'const overrides = OBJECT_ONLY.has(subcommandOf(args)) ? [] : await filterOverrides(root, signal);', replace: 'const overrides: string[] = [];' }], tests: ['00-verify-first'] },
  { name: 'exec: Git fsmonitor off', edits: [{ file: G, find: "'-c', 'core.fsmonitor=false', ", replace: '' }], tests: ['00-verify-first'] },
  { name: 'exec: submodule work trees are not scanned', edits: [{ file: G, find: "'--ignore-submodules=dirty'", replace: "'--ignore-submodules=none'" }], tests: ['00-verify-first'] },
  { name: 'exec: the harness is never started through a shell', edits: [{ file: 'apps/daemon/src/controller.ts', find: '{ cwd: root, shell: false, windowsHide: true, stdio: \'pipe\', env: { ...process.env, CLAUDE_CODE_DISABLE', replace: '{ cwd: root, shell: true, windowsHide: true, stdio: \'pipe\', env: { ...process.env, CLAUDE_CODE_DISABLE' }], tests: ['05-command-execution', '10-controller'] },
  { name: 'exec: relative PATH entries are ignored', edits: [{ file: 'apps/daemon/src/native-executable.ts', find: '.filter(dir => dir && (isAbsolute(dir) || win32.isAbsolute(dir)));', replace: '.filter(Boolean);' }], tests: ['05-command-execution'] },
  { name: 'exec: a launch token must be URL-safe', edits: [{ file: 'apps/daemon/src/commands.ts', find: "if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new Error(", replace: 'if (false) throw new Error(' }], tests: ['05-command-execution'] },
  // 6. outbound traffic
  { name: 'outbound: no network client in the daemon', edits: [{ file: S, find: 'const MAX_STREAMS = 64;', replace: "const MAX_STREAMS = 64; void fetch('http://example.com/ping').catch(() => undefined);" }], tests: ['06-outbound-traffic'] },
  // 7. secrets
  { name: 'secrets: a redaction rule (github-token)', edits: [{ file: 'packages/privacy/src/index.ts', find: "{ id: 'github-token', pattern: /\\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\\b/g },", replace: '' }], tests: ['07-secrets'] },
  { name: 'secrets: text encoded inside a string is redacted (Antigravity MCP arguments)', edits: [{ file: 'packages/privacy/src/index.ts', find: 'return redactNested(input, redactPlain(input), 0);', replace: 'return redactPlain(input);' }], tests: ['07-secrets'] },
  { name: 'secrets: error bodies are redacted', edits: [{ file: S, find: 'return { status, body: { error: redactText(message).text.slice(0, 2000) } };', replace: 'return { status, body: { error: message.slice(0, 2000) } };' }], tests: ['07-secrets'] },
  // 8. limits
  { name: 'limits: request body size', edits: [rm(S, "if (n > limit) throw new HttpError(413, 'body too large');")], tests: ['08-limits'] },
  { name: 'limits: open change streams', edits: [rm(S, "if (clients.size >= MAX_STREAMS) throw new HttpError(429, 'too many open change streams');")], tests: ['08-limits'] },
  { name: 'limits: image pixels (decompression bomb)', edits: [{ file: 'packages/privacy/src/image.ts', find: 'if (bytes > MAX_IMAGE_BYTES || tooManyPixels(sniff))', replace: 'if (bytes > MAX_IMAGE_BYTES)' }], tests: ['08-limits'] },
  // 10. sending prompts
  { name: 'controller: idle-clients acknowledgement', edits: [rm('apps/daemon/src/controller.ts', "if (exclusive !== true) throw new HttpError(400, 'confirm this session is idle in its other harness clients');")], tests: ['10-controller'] },
  { name: 'controller: an approval answers once', edits: [{ file: 'apps/daemon/src/controller.ts', find: "if (!request) throw new HttpError(409, 'approval already answered');", replace: '' }], tests: ['10-controller'] },
  { name: 'controller: an approval names its run', edits: [{ file: 'apps/daemon/src/controller.ts', find: "if (!run || run.state.runId !== runId || typeof approvalId !== 'string' || typeof allow !== 'boolean') throw new HttpError(409, 'approval is no longer current');", replace: "if (!run) throw new HttpError(409, 'approval is no longer current');" }], tests: ['10-controller'] },
  { name: 'controller: an interrupt names its run', edits: [{ file: 'apps/daemon/src/controller.ts', find: "if (!run || run.state.runId !== runId) throw new HttpError(409, 'connection is no longer current');", replace: "if (!run) throw new HttpError(409, 'connection is no longer current');" }], tests: ['10-controller'] },
];

const root = process.cwd();
const only = process.argv.slice(2).filter((a) => a !== '--');
const selected = MUTATIONS.filter((m) => !only.length || only.some((o) => m.name.includes(o)));
const originals = new Map<string, Buffer>();
const restore = () => { for (const [file, bytes] of originals) writeFileSync(join(root, file), bytes); originals.clear(); };
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });

let notCaught = 0;
const rows: string[] = [];
for (const mutation of selected) {
  for (const edit of mutation.edits) {
    if (!originals.has(edit.file)) originals.set(edit.file, readFileSync(join(root, edit.file)));
    const text = readFileSync(join(root, edit.file), 'utf8');
    if (!text.includes(edit.find)) { restore(); console.error(`mutation "${mutation.name}": text not found in ${edit.file}; update tests/security/mutations.ts`); process.exit(2); }
    writeFileSync(join(root, edit.file), text.replace(edit.find, () => edit.replace));
  }
  const run = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.security.config.ts', ...mutation.tests], { cwd: root, encoding: 'utf8', shell: true, timeout: 280_000 });
  restore();
  const output = `${run.stdout}${run.stderr}`;
  const failed = /Tests\s+(?:(\d+) failed)/.exec(output)?.[1] ?? (run.status === 0 ? '0' : 'file error');
  const caught = run.status !== 0;
  if (!caught) notCaught++;
  rows.push(`${caught ? 'CAUGHT  ' : 'MISSED  '} ${mutation.name}  [${mutation.tests.join(', ')}]  failing tests: ${failed}`);
  console.log(rows.at(-1));
}
console.log(`\n${selected.length - notCaught}/${selected.length} defences have a test that fails when they are removed`);
process.exit(notCaught ? 1 : 0);
