import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { localPath, readablePath } from './paths.ts';

export const OUTPUT_LIMIT = 256 * 1024;
export type CapturedOutput =
  | { available: true; path: string; text: string; bytes: number; truncated: boolean; signature: string }
  | { available: false; reason: 'not-recorded' | 'removed' | 'outside-harness-folder' };

/** Task identity is recorded explicitly. Never associate commands by time or output similarity. */
export function taskId(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const match = /^(?:task-)?(\d{1,16})$/.exec(String(value));
  return match ? `task-${match[1]}` : undefined;
}

export function taskInResult(content: string): string | undefined {
  return taskId(/(?:^|\n)\s*Task\s*ID\s*:\s*((?:task-)?\d+)\s*(?:\r?$)/im.exec(content)?.[1]);
}

/** A terminal state must be stated by the harness. A quiet or growing log proves neither. */
export function taskState(content: string): 'running' | 'complete' | 'error' | undefined {
  const state = /(?:^|\n)\s*Status\s*:\s*(\w+)\s*(?:\r?$)/im.exec(content)?.[1]?.toUpperCase();
  if (state === 'RUNNING') return 'running';
  if (['COMPLETED', 'DONE', 'FINISHED', 'SUCCESS'].includes(state ?? '')) return 'complete';
  if (['ERROR', 'FAILED', 'CANCELLED', 'CANCELED', 'KILLED'].includes(state ?? '')) return 'error';
}

export function taskOutputPath(root: string, conversation: string, id: string): string | undefined {
  const normalized = taskId(id);
  return normalized ? join(root, 'brain', conversation, '.system_generated', 'tasks', `${normalized}.log`) : undefined;
}

/** Keep only an explicitly written persisted-output URI/path; containment is checked on read. */
export function outputReferences(content: string): string[] {
  return [...new Set(content.match(/(?:file:\/\/\/|[a-zA-Z]:[\\/]|\/)[^\r\n`"<>]*?\.system_generated[\\/](?:steps[\\/]\d+[\\/]output\.txt|tasks[\\/]task-\d+\.log)/g) ?? [])];
}

/** Raw text stays private to ingest; the caller must seal it before storage or presentation. */
export async function readOutput(root: string, conversation: string, reference: string, limit = OUTPUT_LIMIT): Promise<CapturedOutput> {
  const candidate = localPath(reference);
  if (!candidate) return { available: false, reason: 'outside-harness-folder' };
  let path: string;
  try { path = await readablePath(root, candidate, 'output', conversation); }
  catch (error) { return { available: false, reason: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'removed' : 'outside-harness-folder' }; }
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) return { available: false, reason: 'outside-harness-folder' };
    const ceiling = Math.max(1, Math.min(OUTPUT_LIMIT, Number.isFinite(limit) ? Math.floor(limit) : OUTPUT_LIMIT));
    const buffer = Buffer.alloc(Math.min(info.size, ceiling));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    // Decode only complete UTF-8 sequences if a bounded read splits a character.
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer.subarray(0, bytesRead), { stream: bytesRead < info.size });
    return { available: true, path, text, bytes: info.size, truncated: bytesRead < info.size, signature: `${info.size}:${info.mtimeMs}` };
  } finally { await handle.close(); }
}
