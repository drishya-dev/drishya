// SEC-3: why an image was not kept, in words. An image is refused for size (4 MiB), for its declared pixels
// (64 megapixels, `MAX_IMAGE_PIXELS` in packages/privacy; a few kilobytes can declare gigabytes once decoded),
// or for the other reasons below. Every harness's images take the same path, so one place says it.
import type { OperationImage } from '@drishya/contracts';

const MAX_PIXELS = 64_000_000;
const MAX_BYTES = 4 * 1024 * 1024;

const WHY: Record<string, string> = {
  'referenced-file': 'a referenced conversation image whose bytes could not be captured',
  'too-large': 'larger than the 4 MB kept per image',
  'recording-budget': 'past the 256 MB of images kept per session',
  protected: 'from a protected file',
  unrecognised: 'not a recognised image type',
  remote: 'a remote reference; never fetched automatically',
};

/** The reason, correct for the cause: the byte limit or the pixel limit. */
export function omittedReason(image: Pick<OperationImage, 'omitted' | 'bytes' | 'width' | 'height'>): string {
  const omitted = image.omitted;
  if (!omitted) return 'not available here';
  if (omitted === 'too-large' && image.width && image.height && image.width * image.height > MAX_PIXELS && !(image.bytes && image.bytes > MAX_BYTES)) return 'more than 64 megapixels';
  return WHY[omitted] ?? omitted;
}

/** The recorded size, only when there is one: ` · 30000×30000`. */
export const omittedDimensions = (image: Pick<OperationImage, 'width' | 'height'>) => image.width && image.height ? ` · ${image.width}×${image.height}` : '';
