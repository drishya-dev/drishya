export type UIVersion = 'classic' | 'modern';
const key = 'drishya-ui-version';
const devKey = 'drishya-dev-ui-versions';
/**
 * Modern is the only version a person can choose (UI-4, 25 Oct). Legacy, Canvas and the chooser stay in the code
 * behind this developer switch: `?versions` in the URL, or `localStorage['drishya-dev-ui-versions'] = '1'`.
 */
export function versionChoiceEnabled(search: string = location.search): boolean {
  if (new URLSearchParams(search).has('versions')) return true;
  try { return localStorage.getItem(devKey) === '1'; } catch { return false; }
}
/** An explicit `?experience=` always wins (tests and links). A saved Legacy/Canvas choice applies only with the developer switch on. */
export function resolveUIVersion(search: string, saved?: string | null, developerChoice = false): string {
  const explicit = new URLSearchParams(search).get('experience');
  // The Canvas experience was retired (UI-4 slice 2): an old ?experience=canvas link opens Legacy.
  if (explicit) return explicit === 'fresh' ? 'modern' : explicit === 'canvas' ? 'classic' : explicit;
  if (saved === 'fresh' || saved === 'modern') return 'modern';
  return developerChoice && (saved === 'canvas' || saved === 'classic') ? 'classic' : 'modern';
}
export function selectedUIVersion(): string {
  let saved: string | null = null;
  try { saved = localStorage.getItem(key) ?? localStorage.getItem('drishya-experience-v4'); } catch { /* URL selection works without storage. */ }
  return resolveUIVersion(location.search, saved, versionChoiceEnabled());
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
