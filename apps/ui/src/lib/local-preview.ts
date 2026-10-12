/** Store only a reference to already-redacted local evidence, never a copied journal. */
const key = 'drishya-local-preview-v1';
export function localPreviewId(): string | undefined {
  try { return localStorage.getItem(key) || undefined; } catch { return undefined; }
}
export function saveLocalPreview(id: string): boolean {
  try { localStorage.setItem(key, id); return true; } catch { return false; }
}
