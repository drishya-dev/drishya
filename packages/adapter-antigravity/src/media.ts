import { join, resolve } from 'node:path';
import { captureImage, MAX_IMAGE_BYTES, type CapturedImage } from '@drishya/privacy';
import { conversationId, localPath, readablePath, openObservation } from './paths.ts';

export interface MediaReference { uri: string; availability: 'captured-file' | 'referenced-file'; reason?: string; mediaType?: string }
export interface MediaResult { images: CapturedImage[]; references: MediaReference[] }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Only an explicit native URI is resolved; no repository search or remote fetch is performed. */
export function mediaPath(root: string, id: string, uri: string): string | undefined {
  if (!conversationId(id)) return;
  const absolute = localPath(uri);
  if (absolute) return absolute;
  if (/^(?:\.system_generated\/logs\/media|\.user_uploaded|\.tempmediaStorage)\//.test(uri.replace(/\\/g, '/'))) return resolve(join(root, 'brain', id), uri);
}

/** Returns unpersisted candidates. Ingest must seal these before any store, index or screen. */
export async function captureMedia(root: string, id: string, value: unknown): Promise<MediaResult> {
  const result: MediaResult = { images: [], references: [] };
  // The store enforces the session budget; bound pre-seal candidates as well.
  let remainingBytes = 256 * 1024 * 1024;
  if (!Array.isArray(value)) return result;
  for (const item of value) {
    const row = object(item), uri = typeof row.uri === 'string' ? row.uri : typeof item === 'string' ? item : undefined;
    if (!uri) continue;
    const reference: MediaReference = { uri, availability: 'referenced-file' };
    result.references.push(reference);
    if (row.mime_type === 'application/pdf') {
      reference.mediaType = row.mime_type;
      reference.reason = 'Non-image attachment reference; bytes were not read.';
      continue;
    }
    const candidate = mediaPath(root, id, uri);
    if (!candidate) { result.images.push({ kind: 'captured-image', omitted: 'protected' }); reference.reason = 'Not a permitted local conversation image.'; continue; }
    try { await readablePath(root, candidate, 'media', id); }
    catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      result.images.push({ kind: 'captured-image', omitted: missing ? 'referenced-file' : 'protected' });
      reference.reason = missing ? 'The referenced image file is no longer present.' : 'The image reference is outside the permitted conversation image locations.';
      continue;
    }
    let handle;
    try { handle = await openObservation(root, candidate, 'media', id); }
    catch { result.images.push({ kind: 'captured-image', omitted: 'referenced-file' }); reference.reason = 'The referenced image could not be opened read-only.'; continue; }
    try {
      const before = await handle.stat();
      if (!before.isFile()) { result.images.push({ kind: 'captured-image', omitted: 'protected' }); reference.reason = 'The image reference is not a regular file.'; continue; }
      if (before.size > MAX_IMAGE_BYTES) { result.images.push({ kind: 'captured-image', bytes: before.size, omitted: 'too-large' }); reference.reason = 'The referenced image exceeds the four MiB image limit.'; continue; }
      if (before.size > remainingBytes) { result.images.push({ kind: 'captured-image', bytes: before.size, omitted: 'recording-budget' }); reference.reason = 'The bounded image capture budget was reached.'; continue; }
      remainingBytes -= before.size;
      const buffer = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      const after = await handle.stat();
      if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
        result.images.push({ kind: 'captured-image', omitted: 'referenced-file' }); reference.reason = 'The referenced image was still changing during capture.'; continue;
      }
      const image = captureImage(buffer.toString('base64'));
      result.images.push(image);
      if (image.data) reference.availability = 'captured-file';
      else reference.reason = 'The file did not pass the existing image signature check.';
    } catch {
      result.images.push({ kind: 'captured-image', omitted: 'referenced-file' }); reference.reason = 'The referenced image could not be read completely.';
    } finally { await handle.close(); }
  }
  return result;
}
