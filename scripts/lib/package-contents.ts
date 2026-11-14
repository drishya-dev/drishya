// SEC-5: what the published npm package may contain. `package:verify` runs `checkPackage` on the built
// package; `tests/security/11-package.test.ts` proves each rule fails when the thing it guards appears.
// Everything here is an allowlist first: a new file in the tarball fails until a person adds it below.
import { existsSync, readFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { redactText } from '../../packages/privacy/src/index.ts';

/** Every path the tarball may contain. Hashed chunk names are matched by shape, never by exact hash. */
export const ALLOWED_PATHS: RegExp[] = [
  /^package\.json$/,
  /^LICENSE$/,
  /^BUILD\.json$/,
  /^SHA256SUMS$/,
  // The bundled daemon: entry, history worker and esbuild's hashed chunks, as ES modules only.
  /^apps\/daemon\/src\/(?:cli|history-worker)\.mjs$/,
  /^apps\/daemon\/src\/[A-Za-z0-9_-]+-[A-Za-z0-9_]{8}\.mjs$/,
  // The built UI: hashed assets, brand images, the committed demo bundle, bundled fonts with their licences.
  /^apps\/ui\/dist\/index\.html$/,
  /^apps\/ui\/dist\/favicon\.ico$/,
  /^apps\/ui\/dist\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/,
  /^apps\/ui\/dist\/brand\/[A-Za-z0-9_-]+\.(?:png|svg)$/,
  /^apps\/ui\/dist\/demo\/bundle\.json$/,
  /^apps\/ui\/dist\/fonts\/[A-Za-z0-9_-]+\.(?:woff2|ttf)$/,
  /^apps\/ui\/dist\/fonts\/[A-Za-z0-9_-]+-OFL\.txt$/,
  // Invented sessions and the invented repository they work in (fixtures/synthetic/README.md).
  /^fixtures\/synthetic\/(?:README\.md|[A-Za-z0-9_./-]+\.(?:jsonl|ndjson|ts|md|json|txt))$/,
];

/** Named reasons, so a failure says what kind of leak a path looks like (checked before the allowlist). */
const FORBIDDEN: { why: string; test: RegExp }[] = [
  { why: 'environment file', test: /(?:^|\/)\.env(?:\.|$)/ },
  { why: 'local scratch folder', test: /(?:^|\/)\.(?:local|drishya|drishya-preview|claude|codex)(?:\/|$)/ },
  { why: 'editor or tooling settings', test: /(?:^|\/)\.(?:vscode|idea|git|github|husky|npmrc|yarnrc|editorconfig)(?:\/|$|\.)/ },
  { why: 'dependency folder', test: /(?:^|\/)node_modules(?:\/|$)/ },
  { why: 'store, database or blob file', test: /\.(?:db|db-wal|db-shm|sqlite3?|blob)$/i },
  { why: 'key or certificate', test: /\.(?:pem|key|crt|p12|pfx)$|(?:^|\/)id_(?:rsa|ed25519|ecdsa)/i },
  { why: 'screenshot or capture', test: /(?:^|\/)(?:screenshots?|test-results|playwright-report|\.local)(?:\/|$)|screenshot/i },
  { why: 'real-journal folder', test: /(?:^|\/)fixtures\/(?:local|redacted)(?:\/|$)/ },
  { why: 'journal outside the synthetic fixtures', test: /\.(?:jsonl|ndjson)$/ },
  { why: 'install-time script or native build file', test: /(?:^|\/)(?:binding\.gyp|(?:pre|post)?install\.[cm]?[jt]s)$|\.node$/ },
  { why: 'TypeScript source', test: /\.(?:ts|tsx|mts|cts)$/ },
];
// `.jsonl`, `.ndjson` and `.ts` are legitimate only inside fixtures/synthetic (invented content, shop repository).
const SYNTHETIC = /^fixtures\/synthetic\//;

const MANIFEST_DEPENDENCIES = ['dependencies', 'optionalDependencies', 'peerDependencies', 'bundleDependencies', 'bundledDependencies', 'devDependencies'];

export function checkPaths(paths: string[]): string[] {
  const problems: string[] = [];
  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/');
    const forbidden = FORBIDDEN.find((rule) => rule.test.test(path) && !(SYNTHETIC.test(path) && /\.(?:jsonl|ndjson|ts)$/.test(path)));
    if (forbidden) problems.push(`${path}: ${forbidden.why}`);
    else if (!ALLOWED_PATHS.some((allowed) => allowed.test(path))) problems.push(`${path}: not on the allowlist`);
  }
  return problems;
}

export function checkManifest(manifest: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const scripts = (manifest.scripts ?? {}) as Record<string, unknown>;
  for (const name of Object.keys(scripts)) problems.push(`package.json: script "${name}" (the package defines no scripts, so nothing runs on install)`);
  if (manifest.gypfile) problems.push('package.json: gypfile (a native build runs on install)');
  for (const key of MANIFEST_DEPENDENCIES) {
    const value = manifest[key];
    if (value !== undefined && !(typeof value === 'object' && value !== null && Object.keys(value).length === 0 && !Array.isArray(value))) problems.push(`package.json: "${key}" present (the package has zero dependencies)`);
  }
  for (const [name, spec] of Object.entries((manifest.dependencies ?? {}) as Record<string, string>)) {
    if (name.startsWith('@drishya/') || String(spec).startsWith('workspace:')) problems.push(`package.json: workspace dependency ${name}`);
  }
  const publish = (manifest.publishConfig ?? {}) as Record<string, unknown>;
  if (publish.provenance !== true) problems.push('package.json: publishConfig.provenance must be true');
  if (publish.access !== 'public') problems.push('package.json: publishConfig.access must be "public"');
  if (typeof manifest.repository !== 'object' || manifest.repository === null) problems.push('package.json: repository is required for provenance');
  return problems;
}

/** Strings that name this machine or its owner; a published file must carry none of them. */
export interface LocalIdentity { home: string; user: string; workspace: string }
export function localIdentity(workspace: string): LocalIdentity {
  let user = '';
  try { user = userInfo().username; } catch { /* no passwd entry */ }
  return { home: homedir(), user, workspace };
}

const ABSOLUTE_PATH = [
  /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"']+/,
  /(?<![A-Za-z0-9_.-])\/Users\/(?!Shared\b)[A-Za-z0-9._-]+\//,
  /(?<![A-Za-z0-9_.-])\/home\/(?!dev\/|user\/|runner\/|node\/)[A-Za-z0-9._-]+\//,
  /\\\\[A-Za-z0-9._-]+\\[A-Za-z0-9$._-]+\\/,
  /file:\/\/\/[A-Za-z]:/,
];

/** `text` with the invented sessions' own sandbox paths removed, so the check does not trip on data we made up. */
function withoutSyntheticPaths(text: string): string {
  return text.replace(/\/home\/dev\/shop/g, '');
}

/**
 * Invented secrets the synthetic fixtures carry on purpose, so redaction has something to catch
 * (written by scripts/fixtures/make-synthetic.ts). Exact rule and count: a new one fails the check.
 */
export const SYNTHETIC_SECRETS: { path: string; rule: string; count: number }[] = [
  { path: 'fixtures/synthetic/antigravity/corpus.ndjson', rule: 'github-token', count: 1 },
  { path: 'fixtures/synthetic/turns/codex-rollout-turns.jsonl', rule: 'aws-access-key', count: 1 },
];
/** In bundled code the keyword-and-value rule matches identifiers such as `token: nextToken`; the specific rules still apply. */
const CODE_FILE = /.(?:mjs|js|css)$/;

export function checkText(path: string, text: string, who: LocalIdentity): string[] {
  const problems: string[] = [];
  const slash = (s: string) => s.replace(/\\/g, '/').toLowerCase();
  const normal = slash(text);
  for (const [label, value] of [['home folder', who.home], ['workspace folder', who.workspace]] as const) {
    if (value.length > 3 && normal.includes(slash(value))) problems.push(`${path}: contains this machine's ${label}`);
  }
  if (who.user.length > 3 && new RegExp(`[\\\\/]${who.user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]`, 'i').test(text)) problems.push(`${path}: contains the local user name in a path`);
  const scanned = withoutSyntheticPaths(text);
  if (ABSOLUTE_PATH.some((pattern) => pattern.test(scanned))) problems.push(`${path}: contains an absolute local path`);
  const redacted = redactText(text);
  for (const hit of redacted.hits) {
    if (CODE_FILE.test(path) && hit.rule === 'secret-assignment') continue;
    if (SYNTHETIC_SECRETS.some((known) => known.path === path && known.rule === hit.rule && known.count === hit.count)) continue;
    problems.push(`${path}: matches redaction rule ${hit.rule} (${hit.count})`);
  }
  return problems;
}

/** A source map must list only relative sources and carry no content that names this machine. */
export function checkSourceMap(path: string, text: string, who: LocalIdentity): string[] {
  const problems: string[] = [];
  let map: { sources?: unknown; sourceRoot?: unknown; sourcesContent?: unknown };
  try { map = JSON.parse(text) as typeof map; } catch { return [`${path}: source map is not valid JSON`]; }
  const sources = Array.isArray(map.sources) ? map.sources.map(String) : [];
  for (const source of [...sources, String(map.sourceRoot ?? '')]) {
    if (/^(?:[A-Za-z]:[\\/]|\/|\\\\|file:)/.test(source)) problems.push(`${path}: source map lists an absolute path`);
  }
  problems.push(...checkText(path, text, who).filter((p) => !p.includes('redaction rule')));
  return [...new Set(problems)];
}

const TEXT_FILE = /\.(?:mjs|js|css|html|json|svg|txt|md|jsonl|ndjson|ts|map)$|(?:^|\/)(?:LICENSE|SHA256SUMS)$/;
const INLINE_MAP = /\/\/[#@]\s*sourceMappingURL=data:application\/json;(?:charset=[^;]+;)?base64,([A-Za-z0-9+/=]+)/g;
const MAP_REFERENCE = /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL=([^\s*]+)/g;

/** Everything the package check can say about one file's bytes. */
export function checkFile(path: string, bytes: Buffer, who: LocalIdentity, packed: Set<string>): string[] {
  if (!TEXT_FILE.test(path)) return [];
  const text = bytes.toString('utf8');
  const problems: string[] = [];
  if (path.endsWith('.map')) return checkSourceMap(path, text, who);
  problems.push(...checkText(path, text, who));
  for (const inline of text.matchAll(INLINE_MAP)) problems.push(...checkSourceMap(`${path} (inline map)`, Buffer.from(inline[1]!, 'base64').toString('utf8'), who));
  for (const reference of text.matchAll(MAP_REFERENCE)) {
    const target = reference[1]!;
    if (target.startsWith('data:')) continue;
    const resolved = join(path, '..', target).replace(/\\/g, '/');
    if (!packed.has(resolved)) problems.push(`${path}: points at source map ${target}, which is not in the package`);
  }
  return [...new Set(problems)];
}

/** Full check of a built package directory against the list `npm pack` reports. */
export function checkPackage(packageDir: string, packedPaths: string[], who: LocalIdentity): string[] {
  const problems = checkPaths(packedPaths);
  const packed = new Set(packedPaths.map((p) => p.replace(/\\/g, '/')));
  const manifestPath = join(packageDir, 'package.json');
  if (!existsSync(manifestPath)) return [...problems, 'package.json is missing'];
  problems.push(...checkManifest(JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>));
  for (const path of packed) {
    const full = join(packageDir, path);
    if (!existsSync(full)) { problems.push(`${path}: listed by npm but not on disk`); continue; }
    problems.push(...checkFile(path, readFileSync(full), who, packed));
  }
  return problems;
}

/** Imports in the bundled daemon: only `node:` built-ins and files beside the entry. */
export function foreignImports(source: string): string[] {
  const found = new Set<string>();
  // esbuild writes every static import at the start of a line; matching only there keeps text inside strings out.
  const patterns = [
    /^import\s[^;\n]*?\bfrom\s*["']([^"']+)["']/gm,
    /^(?:import|export)\s*["']([^"']+)["']/gm,
    /^export\s[^;\n]*?\bfrom\s*["']([^"']+)["']/gm,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\b(?:__)?require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) {
    const specifier = match[1]!;
    if (specifier.startsWith('node:') || specifier.startsWith('./')) continue;
    found.add(specifier);
  }
  return [...found].sort();
}
