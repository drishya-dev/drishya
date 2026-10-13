/** Read-only search result DTO, independent of captured events and Node APIs. */
export interface BlobSearchResult {
  matches: number[]; totalLines: number; scannedThrough: number; continuation?: string;
  skippedLines: number; available: boolean; reason?: 'continuation-expired';
}
