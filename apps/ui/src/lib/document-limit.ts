/** How large a Markdown file may be before the Document view hands over to Source. A person's own preference: larger files render more slowly. */
export type DocumentSize = 'standard' | 'large' | 'largest';
export const DOCUMENT_SIZES: Record<DocumentSize, { lines: number; bytes: number; label: string }> = {
  standard: { lines: 5_000, bytes: 256 * 1024, label: '5,000 lines · 256 KiB' },
  large: { lines: 20_000, bytes: 1024 * 1024, label: '20,000 lines · 1 MiB' },
  // The current-file reader itself stops at 2 MiB, so nothing larger is ever offered for rendering.
  largest: { lines: 100_000, bytes: 2 * 1024 * 1024, label: '100,000 lines · 2 MiB' },
};
export const isDocumentSize = (value: unknown): value is DocumentSize => value === 'standard' || value === 'large' || value === 'largest';
export function documentFits(file: { totalLines: number; text: string }, size: DocumentSize): boolean {
  const limit = DOCUMENT_SIZES[size];
  return file.totalLines <= limit.lines && new TextEncoder().encode(file.text).length <= limit.bytes;
}
export const documentLimitMessage = (size: DocumentSize) => `Rendered documents support up to ${DOCUMENT_SIZES[size].label}${size === 'largest' ? '' : '; a larger limit is in Settings'}.`;
