import { opendir, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { artifactName, conversationId, readableRoot, openObservation } from './paths.ts';

export interface ArtifactVersion {
  name: string;
  path: string;
  version?: string;
  current: boolean;
  text?: string;
  bytes: number;
  truncated: boolean;
  updatedAt?: string;
  unavailable?: 'removed' | 'protected' | 'unreadable';
}

const knownNames = ['implementation_plan.md', 'task.md', 'walkthrough.md'] as const;
const TEXT_LIMIT = 1024 * 1024;
const METADATA_LIMIT = 64 * 1024;

function unavailable(error: unknown): NonNullable<ArtifactVersion['unavailable']> {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'removed';
  if (code === 'EACCES' || code === 'EPERM' || code === 'ELOOP') return 'protected';
  if (error instanceof Error && /allow-list|conversation|private directory|regular file/.test(error.message)) return 'protected';
  return 'unreadable';
}

async function bounded(root: string, path: string, id: string, limit: number, name: string) {
  const file = await openObservation(root, path, 'artifact', id, name);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error('Antigravity observation input is not a regular file');
    const buffer = Buffer.alloc(Math.min(stat.size, limit));
    let used = 0;
    while (used < buffer.length) {
      const result = await file.read(buffer, used, buffer.length - used, used);
      if (!result.bytesRead) break;
      used += result.bytesRead;
    }
    // A writer can extend, shrink, or rewrite the file while we read it. Do not
    // describe a mixed or incomplete observation as a complete snapshot.
    const after = await file.stat();
    const truncated = stat.size > used || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs;
    // Streaming leaves an incomplete final UTF-8 sequence out of a bounded preview.
    const text = new TextDecoder().decode(buffer.subarray(0, used), { stream: truncated });
    return { text, bytes: after.size, truncated };
  } finally { await file.close(); }
}

function numericCompare(a: string, b: string): number {
  const left = a.replace(/^0+(?=\d)/, ''), right = b.replace(/^0+(?=\d)/, '');
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0) || (a < b ? -1 : a > b ? 1 : 0);
}

async function metadata(root: string, path: string, id: string, name: string): Promise<{ version?: string; updatedAt?: string }> {
  try {
    const read = await bounded(root, path, id, METADATA_LIMIT, name);
    if (read.truncated) return {};
    const value: unknown = JSON.parse(read.text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const object = value as Record<string, unknown>;
    const version = typeof object.version === 'string' && object.version.length > 0 && object.version.length <= 128
      ? object.version : typeof object.version === 'number' && Number.isSafeInteger(object.version) && object.version >= 0
        ? String(object.version) : undefined;
    const updatedAt = typeof object.updatedAt === 'string' && object.updatedAt.length <= 100 && !Number.isNaN(Date.parse(object.updatedAt))
      ? object.updatedAt : undefined;
    return { ...(version !== undefined ? { version } : {}), ...(updatedAt !== undefined ? { updatedAt } : {}) };
  } catch { return {}; }
}

/** Compare native filenames without converting version numbers to JavaScript numbers. */
function artifactEntry(entry: string): { name: string; rank: number; version?: string } | undefined {
  const match = /^(.*\.md)(?:\.resolved(?:\.(\d+))?)?$/.exec(entry);
  if (!match || !artifactName(match[1]!)) return;
  return { name: match[1]!, rank: entry === match[1] ? 2 : match[2] === undefined ? 0 : 1, ...(match[2] !== undefined ? { version: match[2] } : {}) };
}

function compareEntries(a: string, b: string): number {
  const left = artifactEntry(a)!, right = artifactEntry(b)!;
  return (left.name < right.name ? -1 : left.name > right.name ? 1 : 0) || left.rank - right.rank ||
    (left.version !== undefined && right.version !== undefined ? numericCompare(left.version, right.version) : 0);
}

/** Returns a bounded page of raw native material; the caller must seal it before persistence or display.
 * Use the last path's basename as `after`; it remains valid if that file is deleted. */
export async function readArtifactVersions(root: string, id: string, names: readonly string[] = knownNames, page: { after?: string; limit?: number } = {}): Promise<ArtifactVersion[]> {
  const selected = [...new Set(names.filter(artifactName))].sort();
  if (!conversationId(id) || selected.length === 0 || (page.after !== undefined && !artifactEntry(page.after))) return [];
  const limit = typeof page.limit === 'number' && Number.isFinite(page.limit) ? Math.max(1, Math.min(8, Math.floor(page.limit))) : 8;
  const directory = join(resolve(root), 'brain', id);
  // Retain only the smallest next candidates, regardless of directory enumeration order.
  const candidates: string[] = [];
  const offer = (entry: string) => {
    const parsed = artifactEntry(entry);
    if (!parsed || !selected.includes(parsed.name) || (page.after !== undefined && compareEntries(entry, page.after) <= 0)) return;
    if (candidates.includes(entry)) return;
    candidates.push(entry);
    candidates.sort(compareEntries);
    if (candidates.length > limit) candidates.pop();
  };
  // Current paths are candidates even when missing; the read below reports removal.
  for (const name of selected) offer(name);
  let directoryError: ArtifactVersion['unavailable'];
  try {
    const canonicalRoot = await readableRoot(root);
    const canonicalDirectory = await realpath(directory);
    if (relative(canonicalRoot, canonicalDirectory).replace(/\\/g, '/') !== `brain/${id}`) throw new Error('Antigravity resolved reference leaves its conversation');
    const entries = await opendir(canonicalDirectory);
    for await (const entry of entries) offer(entry.name);
  } catch (error) { directoryError = unavailable(error); }
  const result: ArtifactVersion[] = [];
  for (const entry of candidates) {
    const parsed = artifactEntry(entry)!;
    const { name, version } = parsed;
    const current = parsed.rank === 2;
    const path = join(directory, entry);
    const base: ArtifactVersion = { name, path, current, bytes: 0, truncated: false, ...(version !== undefined ? { version } : {}) };
    if (directoryError) { result.push({ ...base, unavailable: directoryError }); continue; }
    try {
      const read = await bounded(root, path, id, TEXT_LIMIT, name);
      const meta = current ? await metadata(root, join(directory, `${name}.metadata.json`), id, name) : {};
      result.push({ ...base, ...meta, ...read });
    } catch (error) { result.push({ ...base, unavailable: unavailable(error) }); }
  }
  return result;
}

/** Derive statuses only from literal Markdown task list items outside fenced code. */
export function markdownTasks(text: string): { text: string; status: 'completed' | 'pending' }[] {
  const tasks: { text: string; status: 'completed' | 'pending' }[] = [];
  let fence: { char: string; length: number } | undefined;
  for (const line of text.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1]![0] === fence.char && marker[1]!.length >= fence.length && /^\s*$/.test(marker[2]!)) fence = undefined;
      continue;
    }
    if (marker && !(marker[1]![0] === '`' && marker[2]!.includes('`'))) {
      fence = { char: marker[1]![0]!, length: marker[1]!.length };
      continue;
    }
    const task = /^\s*(?:[-+*]|\d+[.)])\s+\[([ xX])\](?:\s+|$)(.*)$/.exec(line);
    if (task) tasks.push({ text: task[2]!, status: task[1]!.toLowerCase() === 'x' ? 'completed' : 'pending' });
  }
  return tasks;
}
