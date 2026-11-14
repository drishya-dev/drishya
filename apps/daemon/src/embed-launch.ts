import {realpath} from 'node:fs/promises';
import {recordingIdFor} from '@drishya/capture-core';
import {isAbsolute} from 'node:path';
import type {App} from './app.ts';
import type {EmbedCodes} from './embed-auth.ts';

export class EmbedError extends Error {
  readonly code: string;
  constructor(code: string) {super(code); this.code = code;}
}
export interface EmbedSelection {sessionId?: string; latest?: true; cwd?: string}
export interface EmbedLaunch {url: string; port: number; recordingId: string; mode: 'top-level'}
export function selection(value: unknown): EmbedSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EmbedError('INVALID_SELECTION');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['sessionId', 'latest', 'cwd'].includes(k))
    || (v.sessionId !== undefined && (typeof v.sessionId !== 'string' || !/^rec_[a-f0-9]{8,64}$/.test(v.sessionId)))
    || (v.latest !== undefined && v.latest !== true)
    || Number(v.sessionId !== undefined) + Number(v.latest === true) !== 1
    || (v.cwd !== undefined && (typeof v.cwd !== 'string' || !isAbsolute(v.cwd) || v.cwd.length > 4096)))
    throw new EmbedError('INVALID_SELECTION');
  return v as EmbedSelection;
}
async function canonical(path: string): Promise<string> {
  const p = await realpath(path).catch(() => {throw new EmbedError('CHECKOUT_UNAVAILABLE');});
  return process.platform === 'win32' ? p.toLowerCase() : p;
}
export async function openEmbed(app: App, baseUrl: string, codes: EmbedCodes, input: unknown): Promise<EmbedLaunch> {
  const v = selection(input);
  const cwd = v.cwd ? await canonical(v.cwd) : undefined;
  let recordingId = v.sessionId;
  if (v.latest) {
    const sources = (await app.ingest.discover()).filter(s => !s.parentSessionId);
    const eligible = [];
    for (const source of sources) {
      if (cwd && (!source.cwd || await canonical(source.cwd).catch(() => undefined) !== cwd)) continue;
      eligible.push(source);
    }
    eligible.sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt) || recordingIdFor(a.adapterId,a.path).localeCompare(recordingIdFor(b.adapterId,b.path)));
    const source = eligible[0];
    if (!source) throw new EmbedError('NO_SESSION');
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
export function embedFailure(error: unknown): {code: string; message: string} {
  const code = error instanceof EmbedError ? error.code : 'EMBED_UNAVAILABLE';
  // Fixed messages only: upstream errors may quote filenames, request bodies or credentials.
  return {code, message: code === 'IFRAME_UNSUPPORTED' ? 'Use a top-level pane or separate window.'
    : code === 'HOST_HANDOFF_UNAVAILABLE' ? 'This host cannot privately open a pane. Use the local drishya embed command.'
    : code === 'NO_SESSION' ? 'No supported session was found for this checkout.'
    : code === 'SESSION_NOT_FOUND' ? 'Import this recording before opening it.'
    : 'Drishya could not open this local view. Check the selector and local installation.'};
}
