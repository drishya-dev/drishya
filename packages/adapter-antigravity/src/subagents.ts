import { open, readdir, realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { conversationId, readableRoot, within } from './paths.ts';

export interface ChildReference {
  conversationId: string;
  spawnStepIndex: number;
  agentType?: string;
  role?: string;
  state?: string;
}

/** The native spawn-step reference is the only join key; role and time are never keys. */
export function childReference(value: unknown): ChildReference | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  if (typeof row.conversationId !== 'string' || !conversationId(row.conversationId) || !Number.isSafeInteger(row.spawnStepIndex) || Number(row.spawnStepIndex) < 0) return;
  const descriptor = row.subagentDescriptor && typeof row.subagentDescriptor === 'object' && !Array.isArray(row.subagentDescriptor)
    ? row.subagentDescriptor as Record<string, unknown> : {};
  return {
    conversationId: row.conversationId, spawnStepIndex: Number(row.spawnStepIndex),
    ...(typeof descriptor.typeName === 'string' ? { agentType: descriptor.typeName } : {}),
    ...(typeof descriptor.role === 'string' ? { role: descriptor.role } : {}),
    ...(typeof row.state === 'string' ? { state: row.state } : {}),
  };
}

/** This directory contains native spawn receipts, not child conversation journals. */
export async function readChildren(root: string, id: string): Promise<ChildReference[]> {
  if (!conversationId(id)) return [];
  const canonicalRoot = await readableRoot(root);
  const directory = join(root, 'brain', id, '.system_generated', 'subagents');
  let canonicalDirectory: string;
  try { canonicalDirectory = await realpath(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const expected = `brain/${id}/.system_generated/subagents`;
  if (!within(canonicalRoot, canonicalDirectory) || relative(canonicalRoot, canonicalDirectory).replace(/\\/g, '/') !== expected) return [];
  const children: ChildReference[] = [];
  for (const name of (await readdir(canonicalDirectory)).slice(0, 1024)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\.json$/.test(name)) continue;
    const candidate = await realpath(join(canonicalDirectory, name)).catch(() => undefined);
    if (!candidate || !within(canonicalDirectory, candidate) || relative(canonicalDirectory, candidate) !== name) continue;
    const handle = await open(candidate, 'r');
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 64 * 1024) continue;
      const buffer = Buffer.alloc(info.size);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      let row: unknown;
      try { row = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')); } catch { continue; }
      const child = childReference(row);
      if (child) children.push(child);
    } finally { await handle.close(); }
  }
  return children;
}
