// CONTENT-1 (D7): image bytes a recording captured inline, served by content hash. History pages carry
// only the hash; the browser fetches an image when its card is on screen. The type sent is the one
// the bytes carry, never the journal's claim.
import { sniffImage, tooManyPixels } from '@drishya/privacy';
import type { Store } from '@drishya/store';
import { fileURLToPath } from 'node:url';

export function readImage(store: Store, recordingIds: string[], sha: string): { mime: string; body: Buffer } | undefined {
  if (!/^[0-9a-f]{64}$/.test(sha) || !recordingIds.some((id) => store.imageShas(id).has(sha))) return undefined;
  const data = store.blobs.get(sha);
  if (!data) return undefined;
  const body = Buffer.from(data, 'base64');
  const sniff = sniffImage(body.subarray(0, 65_536));
  return sniff && !tooManyPixels(sniff) ? { mime: sniff.mime, body } : undefined;
}

/**
 * The image path one operation of this recording referenced: a Read of an image file, or a harness
 * image item (Codex ImageView, a generated image's saved path). Only such a path may be opened.
 */
export function referencedImagePath(store: Store, recordingId: string, operationId: string): string | undefined {
  const native = operationId.startsWith(`${recordingId}.`) ? operationId.slice(recordingId.length + 1).split('#')[0]! : operationId;
  if (native.startsWith('item:')) {
    const image = (store.observationById(recordingId, native.slice(5))?.payload as { image?: { path?: unknown; savedPath?: unknown } } | undefined)?.image;
    const path = image?.path ?? image?.savedPath;
    if (typeof path !== 'string') return undefined;
    // Do not ask realpath to contact a network share, even behind a deliberate current-file read.
    if (/^[\\/]{2}/.test(path)) return undefined;
    // Native Codex ImageView records use file: URLs. Decode exactly once, then let the
    // workspace reader apply its normal approval, root, protected-path and symlink checks.
    if (/^file:/i.test(path)) {
      try {
        const url = new URL(path);
        if (!url.host && !url.search && !url.hash) return fileURLToPath(url);
      } catch { /* Leave malformed/remote references to the native-path refusal below. */ }
    }
    return path;
  }
  const call = store.operationObservations(recordingId, native).find((o) => o.kind === 'tool.call');
  const intent = (call?.payload as { intent?: { kind?: string; path?: unknown } } | undefined)?.intent;
  return intent?.kind === 'read' && typeof intent.path === 'string' && !/^[\\/]{2}/.test(intent.path) && /\.(png|jpe?g|gif|webp)$/i.test(intent.path) ? intent.path : undefined;
}
