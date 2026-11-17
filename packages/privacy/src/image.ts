// AG-4 (builders' 13 Nov agreement) additionally permits explicitly referenced, allow-listed
// same-conversation Antigravity images. They use these same size/signature gates before seal().
// CONTENT-1 under review125 D7 (revised 21 Oct): other image bytes are kept only when the journal already
// holds them inline, at most 4 MiB each, and only when the decoded bytes carry a real image
// signature. Pixels cannot be pattern-redacted, and the signature check stops a crafted record from
// carrying unredacted text through this path: text never decodes to a PNG/JPEG/GIF/WebP header.

/** Largest single image kept, decoded bytes. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * SEC-3: bytes do not bound the memory a browser needs to decode an image. A few kilobytes of PNG can declare
 * 30000 x 30000 pixels (gigabytes decoded), so the declared size is limited too. 64 megapixels is above any
 * screenshot of a real display and decodes to 256 MB at most.
 */
export const MAX_IMAGE_PIXELS = 64_000_000;
export const tooManyPixels = (size?: { width?: number; height?: number }) => !!size && (size.width ?? 0) * (size.height ?? 0) > MAX_IMAGE_PIXELS;

const IMAGE_HEADER_BYTES = 65_536;
type ImageHeader = { mime: string; width?: number; height?: number };

export function hasImageDimensions(header: ImageHeader | undefined): header is Required<ImageHeader> {
  return !!header && typeof header.width === 'number' && typeof header.height === 'number'
    && Number.isInteger(header.width) && Number.isInteger(header.height) && header.width > 0 && header.height > 0;
}

export type ImageOmission = 'too-large' | 'unrecognised' | 'protected' | 'recording-budget' | 'referenced-file';

/** An image captured from a journal. `data` is base64 and present only when the bytes were kept. */
export interface CapturedImage {
  kind: 'captured-image';
  mime?: string;
  bytes?: number;
  width?: number;
  height?: number;
  data?: string;
  omitted?: ImageOmission;
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Decoded size of a base64 string, without decoding it. */
export const base64Bytes = (b64: string) => Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

/** The image type and pixel size from its first bytes; undefined when it is not a supported image. */
export function sniffImage(bytes: Uint8Array): ImageHeader | undefined {
  const head = bytes.subarray(0, IMAGE_HEADER_BYTES);
  const at = (i: number) => head[i] ?? 0;
  const be16 = (i: number) => (at(i) << 8) | at(i + 1), le16 = (i: number) => at(i) | (at(i + 1) << 8);
  const be32 = (i: number) => ((at(i) << 24) >>> 0) + (at(i + 1) << 16) + (at(i + 2) << 8) + at(i + 3);
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) {
    const hasIhdr = head.length >= 24 && be32(8) === 13 && be32(12) === 0x49484452;
    return { mime: 'image/png', ...(hasIhdr ? { width: be32(16), height: be32(20) } : {}) };
  }
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return { mime: 'image/gif', ...(head.length >= 10 ? { width: le16(6), height: le16(8) } : {}) };
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) {
    const chunk = String.fromCharCode(at(12), at(13), at(14), at(15));
    if (chunk === 'VP8X' && head.length >= 30) return { mime: 'image/webp', width: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)), height: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)) };
    if (chunk === 'VP8 ' && head.length >= 30 && !(at(20) & 1) && at(23) === 0x9d && at(24) === 0x01 && at(25) === 0x2a) {
      return { mime: 'image/webp', width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && head.length >= 25 && at(20) === 0x2f) {
      const b = at(21) | (at(22) << 8) | (at(23) << 16) | (at(24) << 24);
      return { mime: 'image/webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return { mime: 'image/webp' };
  }
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    // Walk JPEG segments to the first start-of-frame marker for the pixel size.
    let i = 2;
    while (i + 3 < head.length && at(i) === 0xff) {
      while (i < head.length && at(i) === 0xff) i++;
      const marker = at(i++);
      if (marker === 0 || marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01) continue; // TEM is a standalone marker.
      const length = be16(i);
      if (length < 2) break;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (length >= 8 && i + 7 <= head.length) return { mime: 'image/jpeg', height: be16(i + 3), width: be16(i + 5) };
        break;
      }
      i += length;
    }
    return { mime: 'image/jpeg' };
  }
  return undefined;
}

/** Decodes the first `chars` base64 characters (a multiple of 4) without decoding the rest. */
function decodeHead(data: string, chars: number): Uint8Array {
  const bin = atob(data.slice(0, chars - (chars % 4)));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** What an adapter hands to sanitize: unchecked. sanitize is the one place that certifies it (captureImage). */
export const imageCandidate = (data: unknown, size?: { width?: unknown; height?: unknown }) =>
  ({ kind: 'captured-image' as const, data, ...(typeof size?.width === 'number' ? { width: size.width } : {}), ...(typeof size?.height === 'number' ? { height: size.height } : {}) });

/**
 * Keeps an inline base64 image within D7's limits, or records why not. The declared type is only
 * a hint; the stored type comes from the bytes.
 */
export function captureImage(data: unknown, size?: { width?: unknown; height?: unknown }): CapturedImage {
  if (typeof data !== 'string' || data.length < 8 || data.length % 4 === 1 || !BASE64.test(data)) return { kind: 'captured-image', omitted: 'unrecognised' };
  const bytes = base64Bytes(data);
  // The signature and size sit in the first bytes; a JPEG's frame header can sit further on.
  const initialChars = 4_096;
  let sniff = sniffImage(decodeHead(data, initialChars));
  if (sniff?.mime === 'image/jpeg' && !hasImageDimensions(sniff) && data.length > initialChars) {
    sniff = sniffImage(decodeHead(data, Math.ceil(IMAGE_HEADER_BYTES / 3) * 4));
  }
  if (!sniff) return { kind: 'captured-image', bytes, omitted: 'unrecognised' };
  if (!hasImageDimensions(sniff)) return { kind: 'captured-image', mime: sniff.mime, bytes, omitted: 'unrecognised' };
  const dims = {
    ...(typeof size?.width === 'number' && size.width > 0 ? { width: size.width } : sniff.width ? { width: sniff.width } : {}),
    ...(typeof size?.height === 'number' && size.height > 0 ? { height: size.height } : sniff.height ? { height: sniff.height } : {}),
  };
  if (bytes > MAX_IMAGE_BYTES || tooManyPixels(sniff)) return { kind: 'captured-image', mime: sniff.mime, bytes, ...dims, omitted: 'too-large' };
  return { kind: 'captured-image', mime: sniff.mime, bytes, ...dims, data };
}
