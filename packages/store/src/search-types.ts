/** Read-only search result DTO, independent of captured events and Node APIs. */
export interface BlobSearchResult {
  matches: number[]; totalLines: number; scannedThrough: number; continuation?: string;
  skippedLines: number; available: boolean; reason?: 'continuation-expired';
}

/** Local indexed evidence only; does not search unimported journals or whole blobs. */
export interface LibrarySearchQuery {
  q: string; count?: number; before?: number; root?: string; harness?: 'codex' | 'claude-code'; from?: string; to?: string;
}
export interface LibrarySearchPage {
  items: { recordingId: string; title?: string; workspaceRoot?: string; harness: string; observationId: string; sourceTime?: string; snippet: string }[];
  nextBefore?: number;
}
