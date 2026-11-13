import { realpath, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultRoots = () => process.env.DRISHYA_ANTIGRAVITY_HOME
  ? [resolve(process.env.DRISHYA_ANTIGRAVITY_HOME)]
  : [join(homedir(), '.gemini', 'antigravity'), join(homedir(), '.gemini', 'antigravity-ide')];

export function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}

function rejectPrivateLocation(path: string): void {
  const privateRoots = [join(homedir(), '.gemini', 'antigravity-browser-profile'), ...(process.env.APPDATA ? [join(process.env.APPDATA, 'Antigravity')] : [])];
  if (privateRoots.some(root => within(resolve(root), resolve(path)))) throw new Error('Antigravity location is in a never-read private directory');
}

export async function readableRoot(root: string): Promise<string> {
  rejectPrivateLocation(root);
  const canonical = await realpath(root);
  rejectPrivateLocation(canonical);
  return canonical;
}

export function conversationId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
}

export function localPath(value: string): string | undefined {
  try {
    if (/^file:/i.test(value)) return fileURLToPath(value);
    return isAbsolute(value) ? value : undefined;
  } catch { return undefined; }
}

/** Only journals, their bounded output references and the index are observation inputs.
 * User uploads, scratch files and all credential-bearing siblings are deliberately excluded.
 */
export function allowedRelative(path: string, purpose: 'index' | 'transcript' | 'output' | 'media' | 'artifact'): boolean {
  const p = path.replace(/\\/g, '/');
  if (purpose === 'index') return p === 'conversation_summaries.db';
  if (!/^brain\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\//.test(p)) return false;
  const tail = p.split('/').slice(2).join('/');
  if (purpose === 'transcript') return /^\.system_generated\/logs\/transcript(?:_full)?\.jsonl$/.test(tail);
  if (purpose === 'output') return /^\.system_generated\/(?:steps\/\d+\/output\.txt|tasks\/task-\d+\.log)$/.test(tail);
  if (purpose === 'media') return /^\.system_generated\/logs\/media\/step_\d+_media_\d+\.(?:png|jpe?g)$/i.test(tail);
  return /^(?:implementation_plan|task|walkthrough)\.md(?:\.metadata\.json|\.resolved(?:\.\d+)?)?$/.test(tail);
}

export async function readablePath(root: string, candidate: string, purpose: Parameters<typeof allowedRelative>[1], id?: string): Promise<string> {
  const absolute = resolve(candidate);
  rejectPrivateLocation(absolute);
  if (!within(root, absolute) || !allowedRelative(relative(root, absolute), purpose)) throw new Error('Antigravity path is outside the observation allow-list');
  if (id && (!conversationId(id) || !within(join(root, 'brain', id), absolute))) throw new Error('Antigravity reference leaves its conversation');
  const canonicalRoot = await readableRoot(root);
  const canonical = await realpath(absolute);
  rejectPrivateLocation(canonical);
  // Validate the resolved path too, rejecting junctions/symlinks into sibling or private files.
  if (!within(canonicalRoot, canonical) || !allowedRelative(relative(canonicalRoot, canonical), purpose)) throw new Error('Antigravity resolved path is outside the observation allow-list');
  if (id) {
    const canonicalConversation = await realpath(join(root, 'brain', id));
    if (!within(canonicalConversation, canonical) || relative(canonicalRoot, canonicalConversation).replace(/\\/g, '/') !== `brain/${id}`) throw new Error('Antigravity resolved reference leaves its conversation');
  }
  if (!(await lstat(canonical)).isFile()) throw new Error('Antigravity observation input is not a regular file');
  return canonical;
}
