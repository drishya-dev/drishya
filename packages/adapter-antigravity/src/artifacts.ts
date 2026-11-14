import { open, readdir, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { conversationId, readablePath, readableRoot } from './paths.ts';

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
type ArtifactName = typeof knownNames[number];
const TEXT_LIMIT = 1024 * 1024;
const METADATA_LIMIT = 64 * 1024;

function unavailable(error: unknown): NonNullable<ArtifactVersion['unavailable']> {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'removed';
  if (code === 'EACCES' || code === 'EPERM' || code === 'ELOOP') return 'protected';
  if (error instanceof Error && /allow-list|conversation|private directory|regular file/.test(error.message)) return 'protected';
  return 'unreadable';
}

async function bounded(root: string, path: string, id: string, limit: number) {
  const safePath = await readablePath(root, path, 'artifact', id);
  const file = await open(safePath, 'r');
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

async function metadata(root: string, path: string, id: string): Promise<{ version?: string; updatedAt?: string }> {
  try {
    const read = await bounded(root, path, id, METADATA_LIMIT);
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

/** Returns raw native material to the caller; it must be sealed before persistence or display. */
export async function readArtifactVersions(root: string, id: string, names: readonly ArtifactName[] = knownNames): Promise<ArtifactVersion[]> {
  const selected = [...new Set(names.filter(name => knownNames.includes(name)))];
  if (!conversationId(id) || selected.length === 0) return [];
  const directory = join(resolve(root), 'brain', id);
  let entries: string[];
  try {
    const canonicalRoot = await readableRoot(root);
    const canonicalDirectory = await realpath(directory);
    if (relative(canonicalRoot, canonicalDirectory).replace(/\\/g, '/') !== `brain/${id}`) throw new Error('Antigravity resolved reference leaves its conversation');
    entries = await readdir(canonicalDirectory);
  } catch (error) {
    if (unavailable(error) === 'removed') return [];
    return selected.map(name => ({ name, path: join(directory, name), current: true, bytes: 0, truncated: false, unavailable: unavailable(error) }));
  }
  const result: ArtifactVersion[] = [];
  for (const name of selected) {
    const historical = entries.filter(entry => entry === `${name}.resolved` || (entry.startsWith(`${name}.resolved.`) && /^\d+$/.test(entry.slice(`${name}.resolved.`.length))));
    historical.sort((a, b) => {
      const prefix = `${name}.resolved.`;
      if (a === `${name}.resolved`) return b === a ? 0 : -1;
      if (b === `${name}.resolved`) return 1;
      return numericCompare(a.slice(prefix.length), b.slice(prefix.length));
    });
    const files = [...historical, ...(entries.includes(name) ? [name] : [])];
    for (const entry of files) {
      const current = entry === name;
      const path = join(directory, entry);
      const suffix = entry.startsWith(`${name}.resolved.`) ? entry.slice(`${name}.resolved.`.length) : undefined;
      const meta = current ? await metadata(root, join(directory, `${name}.metadata.json`), id) : {};
      const base: ArtifactVersion = { name, path, current, bytes: 0, truncated: false, ...(suffix !== undefined ? { version: suffix } : {}), ...meta };
      try { result.push({ ...base, ...await bounded(root, path, id, TEXT_LIMIT) }); }
      catch (error) { result.push({ ...base, unavailable: unavailable(error) }); }
    }
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
