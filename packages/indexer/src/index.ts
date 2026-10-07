// Repository map: files and resolved imports (engineering plan §7). The graph describes the
// workspace as it is NOW; it is labelled "current" and never presented as historical.
//
// Draft: imports are extracted with line-anchored rules for TS/JS and Python, not a parser.
// `web-tree-sitter` replaces the extractor next; the resolver and layout stay.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { GraphEdge, GraphNode, RepoGraph } from '@drishya/contracts';
import { isDeniedPath } from '@drishya/privacy';

export const INDEXER_VERSION = 'imports-rules-v1';

const SKIP_DIRS = new Set([
  'node_modules', '.local', '.git', '.hg', '.svn', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache',
  'coverage', 'vendor', 'target', '__pycache__', '.venv', 'venv', 'env', '.tox', '.mypy_cache', '.pytest_cache',
  '.idea', '.vscode', '.drishya', 'playwright-report', 'test-results', '.gradle', 'Pods', 'DerivedData',
]);
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|svgz|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|class|so|dylib|dll|exe|bin|o|a|lib|wasm|woff2?|ttf|otf|eot|mp[34]|mov|avi|webm|ogg|wav|flac|db|sqlite3?|lock|pyc|pyd|node)$/i;
const LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.md': 'markdown', '.json': 'json', '.css': 'css', '.html': 'html',
  '.go': 'go', '.rs': 'rust', '.java': 'java', '.rb': 'ruby', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.sh': 'shell',
};
const JS_EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

export interface IndexOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  /** Injected so tests and replays are reproducible. */
  now?: () => string;
}

interface FileEntry {
  path: string; // workspace-relative, forward slashes
  bytes: number;
  mtimeMs: number;
}

/** The files a map would include: the shared first step of building and of probing freshness. */
async function scan(root: string, opts: IndexOptions): Promise<{ files: FileEntry[]; skipped: number; truncated: boolean }> {
  const maxFiles = opts.maxFiles ?? 5000;
  const maxBytes = opts.maxFileBytes ?? 512 * 1024;
  const ignore = readGitignore(root);
  const files: FileEntry[] = [];
  let skipped = 0;
  let truncated = false;

  const walk = async (dir: string, rel: string): Promise<void> => {
    if (truncated) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue; // never follow links out of the approved root
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || ignore(r, true)) continue;
        await walk(join(dir, e.name), r);
      } else if (e.isFile()) {
        if (BINARY.test(e.name) || ignore(r, false)) {
          skipped++;
          continue;
        }
        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }
        const s = await stat(join(dir, e.name)).catch(() => undefined);
        if (!s) continue;
        if (s.size > maxBytes) {
          skipped++;
          continue;
        }
        files.push({ path: r, bytes: s.size, mtimeMs: s.mtimeMs });
      }
    }
  };
  await walk(root, '');
  return { files, skipped, truncated };
}

/** Identity of a file set: changes when any file is added, removed, resized or touched. */
function generationOf(files: FileEntry[]): string {
  return createHash('sha256').update(INDEXER_VERSION + files.map((f) => `${f.path}:${f.bytes}:${Math.floor(f.mtimeMs)}`).join('\n')).digest('hex').slice(0, 16);
}

/**
 * The generation a fresh build would have, from a walk and stat only (no file is opened). Lets a
 * cached map say it is out of date without being rebuilt under a reader (B2).
 */
export async function probeGeneration(root: string, opts: IndexOptions = {}): Promise<string> {
  return generationOf((await scan(root, opts)).files);
}

export async function buildGraph(root: string, opts: IndexOptions = {}): Promise<RepoGraph> {
  const t0 = performance.now();
  const { files, skipped, truncated } = await scan(root, opts);

  const known = new Set(files.map((f) => f.path));
  const aliases = readTsPaths(root);
  const edges: GraphEdge[] = [];
  const unresolved: RepoGraph['unresolved'] = [];
  const lines = new Map<string, number>();
  let parsed = 0;

  for (const f of files) {
    const lang = LANG[extname(f.path).toLowerCase()];
    if (lang !== 'typescript' && lang !== 'javascript' && lang !== 'python') continue;
    // A protected file (`.env.js`, keys, credentials) stays a node by name only; it is never opened.
    if (isDeniedPath(f.path)) continue;
    const src = await readFile(join(root, f.path), 'utf8').catch(() => undefined);
    if (src === undefined) continue;
    parsed++;
    lines.set(f.path, src.split('\n').length);
    const specs = lang === 'python' ? pythonImports(src) : jsImports(src);
    const seen = new Set<string>();
    for (const spec of specs) {
      const target = lang === 'python' ? resolvePython(spec, f.path, known) : resolveJs(spec, f.path, known, aliases);
      if (target === 'external') continue;
      if (!target) {
        unresolved.push({ from: f.path, specifier: spec });
        continue;
      }
      if (target === f.path || seen.has(target)) continue;
      seen.add(target);
      edges.push({ from: f.path, to: target, relation: 'static-import', basis: 'deterministic-rule', specifier: spec });
    }
  }

  const nodes = layout(files, edges).map((n) => ({ ...n, language: LANG[extname(n.path).toLowerCase()], lines: lines.get(n.path) }));
  const generation = generationOf(files);
  return {
    generation,
    root,
    temporal: 'current',
    builtAt: opts.now ? opts.now() : new Date().toISOString(),
    indexerVersion: INDEXER_VERSION,
    nodes,
    edges,
    unresolved: unresolved.slice(0, 500),
    truncated,
    stats: { files: files.length, parsed, edges: edges.length, unresolved: unresolved.length, skipped, ms: Math.round(performance.now() - t0) },
  };
}

/** A map with only the files a recording touched, when the workspace is not on this machine. */
export function graphFromPaths(paths: string[], now = () => new Date().toISOString()): RepoGraph {
  const files = [...new Set(paths)].sort().map((path) => ({ path, bytes: 0, mtimeMs: 0 }));
  return {
    generation: 'files-' + createHash('sha256').update(files.map((f) => f.path).join('\n')).digest('hex').slice(0, 12),
    root: '',
    temporal: 'recording-files-only',
    builtAt: now(),
    indexerVersion: INDEXER_VERSION,
    nodes: layout(files, []).map((n) => ({ ...n, language: LANG[extname(n.path).toLowerCase()] })),
    edges: [],
    unresolved: [],
    truncated: false,
    stats: { files: files.length, parsed: 0, edges: 0, unresolved: 0, skipped: 0, ms: 0 },
  };
}

// ─── extraction ──────────────────────────────────────────────────────────────────────────

export function jsImports(src: string): string[] {
  const out: string[] = [];
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const re = /(?:^|[;\s])(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?["']([^"'\n]+)["']|(?:require|import)\s*\(\s*["']([^"'\n]+)["']\s*\)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push((m[1] ?? m[2])!);
  return out;
}

export function pythonImports(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split('\n')) {
    let m: RegExpExecArray | null;
    if ((m = /^\s*from\s+(\.*[\w.]*)\s+import\s+([\w\s,*()]+)/.exec(line))) {
      const mod = m[1]!;
      // `from . import x` imports submodule x; `from .a import b` imports from module a.
      if (/^\.+$/.test(mod)) for (const n of m[2]!.replace(/[()]/g, '').split(',')) out.push(mod + n.trim().split(/\s+/)[0]);
      else out.push(mod);
    } else if ((m = /^\s*import\s+([\w.,\s]+)/.exec(line))) {
      for (const n of m[1]!.split(',')) out.push(n.trim().split(/\s+/)[0]!);
    }
  }
  return out.filter(Boolean);
}

// ─── resolution ──────────────────────────────────────────────────────────────────────────

function dirOf(p: string) {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

function normalize(p: string): string | undefined {
  const parts: string[] = [];
  for (const s of p.split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') {
      if (!parts.length) return undefined; // escapes the workspace
      parts.pop();
    } else parts.push(s);
  }
  return parts.join('/');
}

function tryJs(base: string, known: Set<string>): string | undefined {
  if (known.has(base)) return base;
  // NodeNext: "./x.js" in source refers to "./x.ts".
  const noExt = base.replace(/\.(m|c)?js$/, '');
  for (const e of JS_EXT) if (known.has(noExt + e)) return noExt + e;
  for (const e of JS_EXT) if (known.has(`${base}/index${e}`)) return `${base}/index${e}`;
  return undefined;
}

type Aliases = { prefix: string; targets: string[] }[];

export function resolveJs(spec: string, from: string, known: Set<string>, aliases: Aliases = []): string | undefined | 'external' {
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const n = normalize(spec.startsWith('/') ? spec : `${dirOf(from)}/${spec}`);
    return n === undefined ? undefined : tryJs(n, known);
  }
  for (const a of aliases) {
    if (!spec.startsWith(a.prefix)) continue;
    const rest = spec.slice(a.prefix.length);
    for (const t of a.targets) {
      const n = normalize(t + rest);
      const hit = n === undefined ? undefined : tryJs(n, known);
      if (hit) return hit;
    }
    return undefined;
  }
  return 'external';
}

export function resolvePython(spec: string, from: string, known: Set<string>): string | undefined | 'external' {
  const tryMod = (base: string) => (known.has(`${base}.py`) ? `${base}.py` : known.has(`${base}/__init__.py`) ? `${base}/__init__.py` : undefined);
  const dots = /^\.*/.exec(spec)![0].length;
  const name = spec.slice(dots).replace(/\./g, '/');
  if (dots) {
    let dir = dirOf(from);
    for (let i = 1; i < dots; i++) dir = dirOf(dir);
    if (!name) return undefined;
    return tryMod(dir ? `${dir}/${name}` : name);
  }
  for (const root of ['', 'src/', 'lib/', 'app/']) {
    const hit = tryMod(root + name);
    if (hit) return hit;
  }
  // A module that is not in the workspace is a dependency or the standard library.
  return 'external';
}

function readTsPaths(root: string): Aliases {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
      const cfg = JSON.parse(raw);
      const base = String(cfg.compilerOptions?.baseUrl ?? '.').replace(/^\.\/?/, '');
      const paths = cfg.compilerOptions?.paths ?? {};
      return Object.entries(paths).map(([k, v]) => ({
        prefix: k.replace(/\*$/, ''),
        targets: (v as string[]).map((t) => (base ? `${base}/` : '') + t.replace(/^\.\//, '').replace(/\*$/, '')),
      }));
    } catch {
      return [];
    }
  }
  return [];
}

function readGitignore(root: string): (rel: string, isDir: boolean) => boolean {
  let lines: string[] = [];
  try {
    lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
  } catch {
    return () => false;
  }
  const rules = lines.map((l) => {
    const dirOnly = l.endsWith('/');
    const anchored = l.startsWith('/') || l.replace(/\/$/, '').includes('/');
    const pat = l.replace(/^\//, '').replace(/\/$/, '');
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '.*') + '$');
    return { re, dirOnly, anchored };
  });
  return (rel, isDir) =>
    rules.some((r) => {
      if (r.dirOnly && !isDir) return false;
      if (r.anchored) return r.re.test(rel);
      return r.re.test(rel.split('/').pop()!);
    });
}

// ─── layout ──────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic layout: files grouped by directory (two levels), groups packed on a spiral
 * largest-first, files arranged in a sunflower pattern inside their group. Same input, same
 * picture — no randomness, so the map is stable between sessions.
 */
export function layout(files: { path: string; bytes: number }[], edges: GraphEdge[]): Omit<GraphNode, 'language' | 'lines'>[] {
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const parts = f.path.split('/');
    const g = parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length === 2 ? parts[0]! : '.';
    groups.set(g, [...(groups.get(g) ?? []), f.path]);
  }
  // Groups with more imports between them are placed closer: order by size, then by the
  // group they share most edges with (already placed), which keeps related code adjacent.
  const groupOf = new Map<string, string>();
  for (const [g, ps] of groups) for (const p of ps) groupOf.set(p, g);
  const affinity = new Map<string, number>();
  for (const e of edges) {
    const a = groupOf.get(e.from);
    const b = groupOf.get(e.to);
    if (!a || !b || a === b) continue;
    const k = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
    affinity.set(k, (affinity.get(k) ?? 0) + 1);
  }
  const names = [...groups.keys()].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length || a.localeCompare(b));
  const order: string[] = [];
  const remaining = new Set(names);
  while (remaining.size) {
    let best = [...remaining][0]!;
    let bestScore = -1;
    for (const g of remaining) {
      let s = 0;
      for (const p of order) {
        const k = g < p ? `${g}\u0000${p}` : `${p}\u0000${g}`;
        s += affinity.get(k) ?? 0;
      }
      if (s > bestScore) {
        best = g;
        bestScore = s;
      }
      if (order.length === 0) break;
    }
    order.push(best);
    remaining.delete(best);
  }

  const placed: { g: string; x: number; y: number; r: number }[] = [];
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (const g of order) {
    const n = groups.get(g)!.length;
    const r = Math.sqrt(n) * 1.25 + 0.8;
    let x = 0;
    let y = 0;
    if (placed.length) {
      // Walk an outward spiral until the circle fits without overlap.
      for (let i = 0; i < 40000; i++) {
        const a = i * 0.2;
        const d = 0.35 * a;
        x = Math.cos(a) * d;
        y = Math.sin(a) * d;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + 0.6)) break;
      }
    }
    placed.push({ g, x, y, r });
  }

  const bytes = new Map(files.map((f) => [f.path, f.bytes]));
  const out: Omit<GraphNode, 'language' | 'lines'>[] = [];
  for (const p of placed) {
    const paths = groups.get(p.g)!.sort();
    paths.forEach((path, i) => {
      const rr = Math.sqrt(i + 0.5) * 1.2;
      const a = i * GOLDEN;
      out.push({ id: path, path, dir: p.g, bytes: bytes.get(path) ?? 0, x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr });
    });
  }
  // Normalise to [0, 1] on the longer axis, keeping aspect.
  if (!out.length) return out;
  const xs = out.map((n) => n.x);
  const ys = out.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1);
  return out.map((n) => ({ ...n, x: round((n.x - minX) / span), y: round((n.y - minY) / span) }));
}

const round = (v: number) => Math.round(v * 10000) / 10000;
