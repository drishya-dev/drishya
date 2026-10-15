export type UIVersion = 'classic' | 'fresh' | 'modern';
const key = 'drishya-ui-version';
export function resolveUIVersion(search: string, saved?: string | null): string {
  const explicit = new URLSearchParams(search).get('experience');
  if (explicit) return explicit;
  return saved === 'fresh' || saved === 'modern' ? saved : 'classic';
}
export function selectedUIVersion(): string {
  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch { /* URL selection works without storage. */ }
  return resolveUIVersion(location.search, saved);
}
export function versionURL(href: string, version: UIVersion): string {
  const url = new URL(href); url.searchParams.set('experience', version); return url.href;
}
export function switchUIVersion(version: UIVersion) {
  try { localStorage.setItem(key, version); } catch { /* URL is the authoritative fallback. */ }
  location.assign(versionURL(location.href, version));
}
