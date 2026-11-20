import {realpath} from 'node:fs/promises';
import {basename, isAbsolute} from 'node:path';
import {recordingIdFor} from '@drishya/capture-core';
import type {DiscoveredSource} from '@drishya/contracts';
import type {App} from './app.ts';
import type {EmbedCodes} from './embed-auth.ts';

/** A diagnostic that is safe to print: a step name and an exit or error code, never a path, argument or content. */
export function safeDetail(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9 :._-]{1,120}$/.test(value) ? value : undefined;
}
export class EmbedError extends Error {
  readonly code: string;
  readonly detail?: string;
  constructor(code: string, detail?: string) {
    const safe = safeDetail(detail);
    super(safe ? `${code} (${safe})` : code); this.code = code; if (safe) this.detail = safe;
  }
}
/**
 * Exactly one selector: a Drishya recording ID, the harness's own session ID (EMBED refined: the
 * current session where the harness exposes it), or the newest session, optionally inside one checkout.
 */
export interface EmbedSelection {sessionId?: string; nativeSessionId?: string; latest?: true; cwd?: string; harness?: 'claude-code' | 'codex' | 'antigravity'}
export interface EmbedLaunch {url: string; port: number; recordingId: string; mode: 'top-level'}
const KEYS = ['sessionId', 'nativeSessionId', 'latest', 'cwd', 'harness'];
export function selection(value: unknown): EmbedSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EmbedError('INVALID_SELECTION');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !KEYS.includes(k))
    || (v.sessionId !== undefined && (typeof v.sessionId !== 'string' || !/^rec_[a-f0-9]{8,64}$/.test(v.sessionId)))
    // Native IDs are UUID-like in every supported harness; nothing path- or shell-shaped is accepted.
    || (v.nativeSessionId !== undefined && (typeof v.nativeSessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(v.nativeSessionId)))
    || (v.latest !== undefined && v.latest !== true)
    || Number(v.sessionId !== undefined) + Number(v.nativeSessionId !== undefined) + Number(v.latest === true) !== 1
    || (v.harness !== undefined && (!['claude-code', 'codex', 'antigravity'].includes(v.harness as string) || v.sessionId !== undefined))
    || (v.cwd !== undefined && (typeof v.cwd !== 'string' || !isAbsolute(v.cwd) || v.cwd.length > 4096)))
    throw new EmbedError('INVALID_SELECTION');
  return v as EmbedSelection;
}
async function canonical(path: string): Promise<string> {
  const p = await realpath(path).catch(() => {throw new EmbedError('CHECKOUT_UNAVAILABLE');});
  return process.platform === 'win32' ? p.toLowerCase() : p;
}
/** The harness's own ID: stated in the first records, or the journal's name (Claude `<id>.jsonl`, Codex `rollout-…-<id>.jsonl`). */
export function nativeIdMatches(source: Pick<DiscoveredSource, 'sessionId' | 'path'>, id: string): boolean {
  if (source.sessionId === id) return true;
  const name = basename(source.path);
  return name === `${id}.jsonl` || name.endsWith(`-${id}.jsonl`);
}
export async function openEmbed(app: App, baseUrl: string, codes: EmbedCodes, input: unknown): Promise<EmbedLaunch> {
  const v = selection(input);
  const cwd = v.cwd ? await canonical(v.cwd) : undefined;
  let recordingId = v.sessionId;
  if (v.latest || v.nativeSessionId) {
    const sources = (await app.ingest.discover()).filter(s => !s.parentSessionId);
    const eligible = [];
    for (const source of sources) {
      if (v.nativeSessionId && !nativeIdMatches(source, v.nativeSessionId)) continue;
      if (v.harness && source.harness !== v.harness) continue;
      if (cwd && (!source.cwd || await canonical(source.cwd).catch(() => undefined) !== cwd)) continue;
      eligible.push(source);
    }
    eligible.sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt) || recordingIdFor(a.adapterId,a.path).localeCompare(recordingIdFor(b.adapterId,b.path)));
    const source = eligible[0];
    if (!source) throw new EmbedError(v.nativeSessionId ? 'SESSION_NOT_FOUND' : 'NO_SESSION');
    recordingId = (await app.ingest.importSource(source.adapterId, source.path)).recordingId;
  }
  const recording = recordingId ? app.store.getRecording(recordingId) : undefined;
  if (!recording) throw new EmbedError('SESSION_NOT_FOUND');
  if (cwd && (!recording.workspaceRoot || await canonical(recording.workspaceRoot).catch(() => undefined) !== cwd))
    throw new EmbedError('CHECKOUT_MISMATCH');
  app.ingest.startLive(recording.id);
  const url = new URL(baseUrl);
  url.searchParams.set('embed', '1');
  url.searchParams.set('recording', recording.id);
  url.hash = 'launch=' + codes.mint(recording.id);
  return {url: url.href, port: Number(url.port), recordingId: recording.id, mode: 'top-level'};
}
export function embedFailure(error: unknown): {code: string; message: string; detail?: string} {
  const code = error instanceof EmbedError ? error.code : 'EMBED_UNAVAILABLE';
  const detail = error instanceof EmbedError ? error.detail : undefined;
  // Fixed messages only: upstream errors may quote filenames, request bodies or credentials.
  return {code, message: code === 'IFRAME_UNSUPPORTED' ? 'Use a top-level pane or separate window.'
    : code === 'HOST_HANDOFF_UNAVAILABLE' ? 'This host cannot privately open a pane. Use the local drishya embed command.'
    : code === 'NO_SESSION' ? 'No supported session was found for this checkout.'
    : code === 'SESSION_NOT_FOUND' ? 'No session with this ID was found on this computer.'
    : code === 'CHECKOUT_MISMATCH' ? 'That session belongs to a different checkout.'
    : code === 'CHECKOUT_UNAVAILABLE' ? 'The checkout folder could not be read.'
    : code === 'IMPORT_IN_PROGRESS' ? 'Drishya is still importing a large session. Try again in a minute; it continues where it stopped.'
    : code === 'INVALID_SELECTION' ? 'Give exactly one of a recording ID, a native session ID or --latest; --cwd must be absolute.'
    : code === 'DISCOVERY_UNSAFE' ? 'Drishya could not make its embed-discovery folder private to you, so it did not start.'
    : 'Drishya could not open this local view. Check the selector and local installation.', ...(detail ? {detail} : {})};
}
