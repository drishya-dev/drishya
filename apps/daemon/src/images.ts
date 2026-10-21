// CONTENT-1 (D7): image bytes a recording captured inline, served by content hash. History pages carry
// only the hash; the browser fetches an image when its card is on screen. The type sent is the one
// the bytes carry, never the journal's claim.
import { sniffImage } from '@drishya/privacy';
import type { Store } from '@drishya/store';

export function readImage(store: Store, recordingIds: string[], sha: string): { mime: string; body: Buffer } | undefined {
  if (!/^[0-9a-f]{64}$/.test(sha) || !recordingIds.some((id) => store.imageShas(id).has(sha))) return undefined;
  const data = store.blobs.get(sha);
  if (!data) return undefined;
  const body = Buffer.from(data, 'base64');
  const sniff = sniffImage(body.subarray(0, 65_536));
  return sniff ? { mime: sniff.mime, body } : undefined;
}
