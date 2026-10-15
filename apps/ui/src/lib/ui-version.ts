export type UIVersion = 'canvas' | 'classic' | 'modern';
const key = 'drishya-ui-version';
export function resolveUIVersion(search: string, saved?: string | null): string {
  const explicit = new URLSearchParams(search).get('experience');
  if (explicit) return explicit === 'fresh' ? 'modern' : explicit;
  if (saved === 'fresh' || saved === 'modern') return 'modern';
  return saved === 'canvas' ? 'canvas' : 'classic';
}
export function selectedUIVersion(): string {
  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch { /* URL selection works without storage. */ }
  return resolveUIVersion(location.search, saved);
}
export function versionURL(href: string, version: UIVersion): string {
  const url = new URL(href); url.searchParams.set('experience', version);
  // Presentation-specific subviews are not routes in the other shells.
  const recording = /^#\/r\/([^/?]+)/.exec(url.hash);
  if (recording) url.hash = `#/r/${recording[1]}`;
  else if (url.hash === '#/settings') url.hash = '#/';
  return url.href;
}
export function switchUIVersion(version: UIVersion) {
  try { localStorage.setItem(key, version); } catch { /* URL is the authoritative fallback. */ }
  location.assign(versionURL(location.href, version));
}
