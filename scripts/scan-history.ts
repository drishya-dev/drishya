// SEC-5 part 3: scan every blob reachable from every branch and tag with SEC-2's own redaction rules, and
// look for real journal content and private material. It prints COUNTS, RULES, PATHS and COMMIT PREFIXES only:
// a matched value is never printed, written or returned. Run at every release (docs/release-checklist.md):
//
//   node scripts/scan-history.ts [--json] [--refs heads,remotes,tags]
//
// Exit code 1 when anything outside the known synthetic locations matches.
import { spawn, spawnSync } from 'node:child_process';
import { redactText } from '../packages/privacy/src/index.ts';
import { CANARIES } from '../tests/security/lib/secrets.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const refsArg = args[args.indexOf('--refs') + 1];
const refKinds = (args.includes('--refs') && refsArg ? refsArg : 'heads,remotes,tags,pull').split(',');
const root = process.cwd();
const MAX_TEXT = 8 * 1024 * 1024;

function git(gitArgs: string[], input?: string): string {
  const r = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30, input });
  if (r.status !== 0) throw new Error(`git ${gitArgs[0]} failed`);
  return r.stdout;
}

// Where invented secrets are expected (redaction tests, fixtures, the generators that write them).
const SYNTHETIC_HOMES = [
  /^tests\//, /^fixtures\/synthetic\//, /^scripts\/fixtures\//, /(?:^|\/)test\//, /(?:^|\/)tests\//, /\.test\.[cm]?[jt]sx?$/, /(?:^|\/)__fixtures__\//,
  /^apps\/ui\/public\/demo\//, /^scripts\/real-cases\//,
];
const isSyntheticHome = (path: string) => SYNTHETIC_HOMES.some((p) => p.test(path));

// Paths that must never be in history at all.
const FORBIDDEN_PATHS: { kind: string; test: RegExp }[] = [
  { kind: 'environment file', test: /(?:^|\/)\.env(?:\.(?!example$)[^/]*)?$/ },
  { kind: 'key or certificate', test: /\.(?:pem|key|p12|pfx)$|(?:^|\/)id_(?:rsa|ed25519|ecdsa)/ },
  { kind: 'database or store file', test: /\.(?:db|db-wal|db-shm|sqlite3?)$/ },
  { kind: 'local scratch folder', test: /(?:^|\/)\.local\// },
  { kind: 'journal outside the synthetic fixtures', test: /\.(?:jsonl|ndjson)$/ },
  { kind: 'Claude/Codex folder content', test: /(?:^|\/)\.(?:claude|codex)\/(?!worktrees\/?$)(?!settings\.json$)/ },
  { kind: 'screenshot or capture', test: /(?:^|\/)(?:screenshots?|test-results|playwright-report)\//i },
];
const JOURNAL_OK = [/^fixtures\/synthetic\//, /^fixtures\/redacted\//];

// Private material that is not a secret rule.
const PRIVATE_TEXT: { kind: string; test: RegExp }[] = [
  { kind: 'Windows user path', test: /[A-Za-z]:[\\/]+Users[\\/]+(?!Public\b|Default\b|runneradmin\b|user\b|name\b|you\b|me\b|dev\b|x\b|example\b|someone\b|<)[A-Za-z0-9._-]{2,}/ },
  { kind: 'macOS or Linux home path', test: /(?<![A-Za-z0-9_.-])\/(?:Users|home)\/(?!dev\/|user\/|runner\/|node\/|you\/|me\/|name\/|example\/|alice\/|bob\/|jane\/|shared\/|<|\$|\{)[a-z][A-Za-z0-9._-]{2,}\//i },
  { kind: 'email address', test: /[A-Za-z0-9._%+-]+@(?!example\.|users\.noreply\.github\.com|anthropic\.com|openai\.com|localhost|test\.|domain\.|company\.|acme\.|email\.com|git\.local|users\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  // A harness folder that names a person's account or a session file, not the generic `~/.claude/projects/<slug>` in docs.
  { kind: 'real harness session path', test: /\.claude[\\/]projects[\\/](?:C--Users|-Users|-home)[^\s"']+|\.claude[\\/]projects[\\/][^\s"'\\/]+[\\/][0-9a-f]{8}-[0-9a-f]{4}-|\.codex[\\/]sessions[\\/]\d{4}[\\/]\d{2}[\\/]\d{2}[\\/]rollout-/ },
  // Ids of recordings the builders imported from their own sessions (prefixes only are allowed in notes; full ids are not).
  { kind: 'recording or session id', test: /\brec_[0-9a-f]{12,}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/ },
];

// A matched value that is plainly invented: the suite's own canaries, a word such as canary or example, a run of one
// character, a counting sequence. Anything else found in a test file is listed for a person to look at.
const INVENTED_WORD = /canary|fake|example|dummy|sample|invented|synthetic|placeholder|hunter2|redact|xxxx|test|demo|secret|token|password|0000|1234|abcd|q7zxw3rt9vb2/i;
const INVENTED_RUN = /(.)\1{5,}|0123456789|abcdefghij/i;
const CANARY_NEEDLES = CANARIES.map((c) => c.needle);
function looksInvented(value: string): boolean {
  return INVENTED_WORD.test(value) || INVENTED_RUN.test(value) || CANARY_NEEDLES.some((needle) => value.includes(needle) || needle.includes(value));
}
/** The matched values of a text, recovered by comparing it with its redacted form line by line (never printed). */
function matchedValues(text: string): string[] {
  const out = redactText(text).text.split('\n');
  const src = text.split('\n');
  const values: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const a = src[i]!, b = out[i];
    if (b === undefined || a === b) continue;
    const marker = /\[REDACTED:[a-z0-9-]+\]/.exec(b);
    if (!marker) continue;
    const after = b.length - marker.index - marker[0].length;
    values.push(a.slice(marker.index, Math.max(marker.index, a.length - after)));
  }
  return values;
}

// A blob that looks like an agent transcript: many JSON lines carrying journal keys.
function looksLikeTranscript(text: string): boolean {
  if (text.length < 20_000) return false;
  let jsonLines = 0, journalKeys = 0, total = 0;
  for (const line of text.split('\n')) {
    total++;
    if (line.startsWith('{') && line.endsWith('}')) {
      jsonLines++;
      if (/"(?:parentUuid|sessionId|isSidechain|rollout|response_item|session_meta|turn_context|event_msg|tool_use_id|toolUseResult)"/.test(line)) journalKeys++;
    }
    if (total > 4000) break;
  }
  return jsonLines >= 20 && journalKeys >= 10;
}

interface Hit { category: string; rule: string; path: string; commit: string; rank: number; synthetic: boolean }
const hits: Hit[] = [];
// Binary files cannot be text-scanned; they are listed by folder and extension so an image of a real screen cannot hide among them.
const binaryKinds = new Map<string, number>();
const summary = { refs: 0, commits: 0, blobs: 0, blobsText: 0, blobsBinary: 0, blobsOversize: 0, paths: 0 };

// 1. The refs: branches (local and remote), tags. Not stashes, not worktree-private refs.
const prefixes: Record<string, string> = { heads: 'refs/heads', remotes: 'refs/remotes', tags: 'refs/tags', pull: 'refs/pull' };
const refs = git(['for-each-ref', '--format=%(refname)', ...refKinds.map((k) => prefixes[k]!).filter(Boolean)]).split('\n').filter(Boolean);
summary.refs = refs.length;
const REFS_INPUT = refs.join(String.fromCharCode(10)) + String.fromCharCode(10);
const commits = git(['rev-list', '--stdin'], REFS_INPUT).split('\n').filter(Boolean);
summary.commits = commits.length;

// 2. Blob -> (path, first commit that carried it). Oldest commit wins; a merge-only blob is attributed to "merge".
const firstSeen = new Map<string, { path: string; commit: string; rank: number }>();
const log = git(['log', '--reverse', '--no-renames', '-m', '--raw', '-z', '--no-abbrev', '--format=%x00C%H', '--stdin'], REFS_INPUT);
let commit = 'merge';
let pending = '';
for (const part of log.split('\0')) {
  // `git log -z` puts a newline between a commit header and its first change.
  const token = part.replace(/^\n/, '');
  if (!token) continue;
  if (token.startsWith('C') && /^C[0-9a-f]{40}$/.test(token)) { commit = token.slice(1, 9); continue; }
  const m = /^:\d+ \d+ [0-9a-f]+ ([0-9a-f]{40}) ([AMCRT])$/.exec(token);
  if (m) { pending = m[1]!; continue; }
  if (pending && token && !token.startsWith(':')) { if (!firstSeen.has(pending)) firstSeen.set(pending, { path: token, commit, rank: firstSeen.size }); pending = ''; }
}

// 3. Every object reachable from the refs, whatever its path.
const objects = git(['rev-list', '--objects', '--stdin'], REFS_INPUT).split('\n').filter(Boolean);
const blobPaths = new Map<string, string>();
for (const line of objects) {
  const space = line.indexOf(' ');
  if (space > 0) blobPaths.set(line.slice(0, space), line.slice(space + 1));
}
const types = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], [...blobPaths.keys()].join('\n') + '\n').split('\n').filter(Boolean);
const blobs = types.map((l) => l.split(' ')).filter((p) => p[1] === 'blob').map((p) => ({ id: p[0]!, size: Number(p[2]) }));
summary.blobs = blobs.length;
summary.paths = new Set(blobPaths.values()).size;

function note(category: string, rule: string, id: string, synthetic: boolean | 'never') {
  const where = firstSeen.get(id);
  const path = where?.path ?? blobPaths.get(id) ?? '(unplaced)';
  hits.push({ category, rule, path, commit: where?.commit ?? 'merge', rank: where?.rank ?? Number.MAX_SAFE_INTEGER, synthetic: synthetic === 'never' ? false : synthetic || isSyntheticHome(path) });
}

// Path rules need no content.
for (const { id } of blobs) {
  const path = firstSeen.get(id)?.path ?? blobPaths.get(id) ?? '';
  for (const { kind, test } of FORBIDDEN_PATHS) {
    if (!test.test(path)) continue;
    if (kind === 'journal outside the synthetic fixtures' && JOURNAL_OK.some((ok) => ok.test(path))) continue;
    note('path', kind, id, false);
  }
}

// 4. Content: stream blobs through one `git cat-file --batch` process and scan text.
const proc = spawn('git', ['cat-file', '--batch'], { cwd: root, stdio: ['pipe', 'pipe', 'ignore'] });
const queue = blobs.map((b) => b.id);
proc.stdin.end(queue.join('\n') + '\n');
let buffer = Buffer.alloc(0);
let index = 0;
await new Promise<void>((done, fail) => {
  proc.stdout.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const eol = buffer.indexOf(10);
      if (eol < 0) return;
      const header = buffer.subarray(0, eol).toString().split(' ');
      const size = Number(header[2]);
      if (buffer.length < eol + 1 + size + 1) return;
      const body = buffer.subarray(eol + 1, eol + 1 + size);
      buffer = buffer.subarray(eol + 1 + size + 1);
      scan(header[0]!, body);
    }
  });
  proc.on('close', () => done());
  proc.on('error', fail);
});

function scan(id: string, body: Buffer) {
  index++;
  if (body.length > MAX_TEXT) { summary.blobsOversize++; return; }
  // A source file with a NUL byte in it (a test fixture string) is still text and still scanned.
  const looksText = /\.(?:[cm]?[jt]sx?|json|md|css|html|ya?ml|txt|sh|ps1|ndjson|jsonl|svg|toml)$/.test(blobPaths.get(id) ?? '');
  if (!looksText && body.subarray(0, 8000).includes(0)) {
    summary.blobsBinary++;
    const path = blobPaths.get(id) ?? '(unplaced)';
    const kind = path.replace(/[^/]+(\.[A-Za-z0-9]+)$/, '*$1');
    binaryKinds.set(kind, (binaryKinds.get(kind) ?? 0) + 1);
    return;
  }
  summary.blobsText++;
  const text = body.toString('utf8');
  const redacted = redactText(text);
  const home = isSyntheticHome(firstSeen.get(id)?.path ?? blobPaths.get(id) ?? '');
  // In a test or fixture file the location only counts as invented when the value looks invented too.
  const odd = home && redacted.hits.length > 0 && matchedValues(text).some((value) => !looksInvented(value));
  for (const hit of redacted.hits) note('secret rule', hit.rule, id, false);
  if (odd) note('secret rule', 'value in a test file that does not look invented', id, 'never');
  for (const { kind, test } of PRIVATE_TEXT) if (test.test(text)) note('private text', kind, id, false);
  if (looksLikeTranscript(text)) note('journal-like content', 'transcript shape', id, false);
}

// 5. Report: counts, never values.
const keyOf = (h: Hit) => `${h.category}|${h.rule}|${h.synthetic ? 'synthetic location' : 'OTHER'}`;
const grouped = new Map<string, { blobs: number; paths: Map<string, string> }>();
for (const h of hits) {
  const g = grouped.get(keyOf(h)) ?? { blobs: 0, paths: new Map() };
  g.blobs++;
  if (!g.paths.has(h.path)) g.paths.set(h.path, h.commit);
  grouped.set(keyOf(h), g);
}
const other = hits.filter((h) => !h.synthetic);
if (json) {
  console.log(JSON.stringify({ summary, groups: [...grouped].map(([k, g]) => ({ key: k, blobs: g.blobs, paths: g.paths.size })), unexpected: other.map(({ category, rule, path, commit }) => ({ category, rule, path, commit })) }, null, 2));
} else {
  console.log(`refs ${summary.refs} · commits ${summary.commits} · blobs ${summary.blobs} (text ${summary.blobsText}, binary ${summary.blobsBinary}, over ${MAX_TEXT >> 20} MiB ${summary.blobsOversize}) · distinct paths ${summary.paths}`);
  for (const [key, g] of [...grouped].sort()) console.log(`${key.replace(/\|/g, ' · ')}: ${g.blobs} blob(s) at ${g.paths.size} path(s)`);
  for (const [kind, n] of [...binaryKinds].sort()) console.log(`binary · ${kind} · ${n} blob(s)`);
  // One line per rule and path (not per version), with how many blob versions and the oldest commit prefix.
  const lines = new Map<string, { versions: number; commit: string; rank: number }>();
  for (const h of other) {
    const k = `${h.category} · ${h.rule} · ${h.path}`;
    const line = lines.get(k);
    if (line) { line.versions++; if (h.rank < line.rank) { line.rank = h.rank; line.commit = h.commit; } } else lines.set(k, { versions: 1, commit: h.commit, rank: h.rank });
  }
  for (const [k, v] of [...lines].sort()) console.log(`REVIEW ${k} · ${v.versions} version(s) · oldest ${v.commit}`);
  if (!other.length) console.log('Nothing outside the known synthetic locations.');
}
void index;
process.exitCode = other.length ? 1 : 0;
