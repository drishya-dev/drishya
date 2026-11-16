import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, captureImage, sanitize, sniffImage } from '../src/index.ts';

// A real 1×1 PNG and minimal headers for the other types.
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const bytes = (...b: number[]) => Uint8Array.from(b);

// CONTENT-1 under review125 D7 (revised 21 Oct).
describe('captured images', () => {
  it('recognises PNG, JPEG, GIF and WebP by their bytes, with pixel size', () => {
    expect(sniffImage(Buffer.from(PNG_1x1, 'base64'))).toEqual({ mime: 'image/png', width: 1, height: 1 });
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 3, 0, 2, 0))).toEqual({ mime: 'image/gif', width: 3, height: 2 });
    // JPEG: SOI, an APP0 segment of length 4, then SOF0 with height 5 and width 7.
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 5, 0, 7, 3, 0, 0, 0))).toEqual({ mime: 'image/jpeg', height: 5, width: 7 });
    expect(sniffImage(Uint8Array.from(Buffer.from('RIFF\0\0\0\0WEBPVP8X', 'latin1')))).toMatchObject({ mime: 'image/webp' });
    expect(sniffImage(Uint8Array.from(Buffer.from('plain text, not an image', 'utf8')))).toBeUndefined();
  });

  it('keeps an inline image within limits, takes the type from the bytes and refuses disguised text', () => {
    expect(captureImage(PNG_1x1)).toMatchObject({ kind: 'captured-image', mime: 'image/png', width: 1, height: 1, data: PNG_1x1 });
    const secret = Buffer.from('AWS key AKIA0000000000000000 in a text file').toString('base64');
    expect(captureImage(secret)).toEqual({ kind: 'captured-image', bytes: expect.any(Number), omitted: 'unrecognised' });
    expect(captureImage('not base64 at all!')).toEqual({ kind: 'captured-image', omitted: 'unrecognised' });
    const huge = Buffer.concat([Buffer.from(PNG_1x1, 'base64'), Buffer.alloc(MAX_IMAGE_BYTES)]).toString('base64');
    const big = captureImage(huge);
    expect(big).toMatchObject({ mime: 'image/png', omitted: 'too-large' });
    expect(big).not.toHaveProperty('data');
  });

  it('requires positive dimensions from bytes even when capture metadata supplies a size', () => {
    const png = Buffer.from(PNG_1x1, 'base64');
    const zero = Buffer.from(png);
    zero.writeUInt32BE(0, 16);
    const wrongChunk = Buffer.from(png);
    wrongChunk.write('JUNK', 12);
    const oversized = Buffer.from(png);
    oversized.writeUInt32BE(30_000, 16);
    oversized.writeUInt32BE(30_000, 20);
    for (const invalid of [png.subarray(0, 8), zero, wrongChunk, Buffer.from('ffd8ffe00002ffd9', 'hex')]) {
      const result = captureImage(invalid.toString('base64'), { width: 1, height: 1 });
      expect(result).toMatchObject({ omitted: 'unrecognised' });
      expect(result).not.toHaveProperty('data');
    }
    expect(captureImage(oversized.toString('base64'), { width: 1, height: 1 })).toMatchObject({ omitted: 'too-large' });
  });

  it('finds a JPEG frame inside, but never beyond, the common header budget', () => {
    const frame = Buffer.from('ffc00011080005000703011100021100031100', 'hex');
    const jpeg = (length: number) => {
      const segment = Buffer.alloc(length + 2);
      segment.writeUInt16BE(0xffe1);
      segment.writeUInt16BE(length, 2);
      return Buffer.concat([Buffer.from('ffd8', 'hex'), segment, frame, Buffer.from('ffd9', 'hex')]).toString('base64');
    };
    expect(captureImage(jpeg(3_100))).toMatchObject({ mime: 'image/jpeg', width: 7, height: 5, data: expect.any(String) });
    expect(captureImage(jpeg(65_535))).toMatchObject({ mime: 'image/jpeg', omitted: 'unrecognised' });
  });

  it('sanitize keeps only re-checked images, never inside a protected scope, and never text-redacts their bytes', () => {
    const kept = sanitize({ images: [captureImage(PNG_1x1)] }).value as { images: { data?: string }[] };
    expect(kept.images[0]!.data).toBe(PNG_1x1);
    // A crafted record claiming to be a captured image cannot carry text past redaction.
    const crafted = { kind: 'captured-image', mime: 'image/png', data: Buffer.from('password=hunter2 and more text').toString('base64') };
    expect(sanitize(crafted).value).toMatchObject({ kind: 'captured-image', omitted: 'unrecognised' });
    expect(sanitize(crafted).value).not.toHaveProperty('data');
    const protectedScope = sanitize({ path: '.env', images: [captureImage(PNG_1x1)] }).value as unknown as { images: Record<string, unknown>[] };
    expect(protectedScope.images[0]).toMatchObject({ kind: 'captured-image', mime: 'image/png', omitted: 'protected' });
    expect(protectedScope.images[0]).not.toHaveProperty('data');
    // Images in any other shape are still dropped, as before.
    expect(sanitize({ type: 'image', source: { type: 'base64', data: PNG_1x1 } }).value).toEqual({ type: 'image', omitted: true });
  });
});
