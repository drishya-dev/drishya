/** Store only a reference to already-redacted local evidence, never a copied journal. */
const key = 'drishya-local-preview-v1';
/** Explicit developer tools only; this never selects a different product UI. */
export function developerToolsEnabled(search = location.search, saved?: string | null): boolean {
  if (new URLSearchParams(search).get('devtools') === '1') return true;
  try { return (saved ?? localStorage.getItem('drishya-dev-tools')) === '1'; } catch { return false; }
}
export function localPreviewId(): string | undefined {
  try { return localStorage.getItem(key) || undefined; } catch { return undefined; }
}
export function saveLocalPreview(id: string): boolean {
  try { localStorage.setItem(key, id); return true; } catch { return false; }
}
