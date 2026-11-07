export type UIVersion = 'classic' | 'modern' | 'clarity';
/** The skin a Modern-shell page wears. Clarity (CLARITY-1) renders as Modern plus its own cascade layer. */
export type UISkin = 'modern' | 'clarity';
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
  // Clarity is a skin of the Modern shell (`data-ui-skin`), so its shell version is Modern.
  if (explicit) return explicit === 'fresh' || explicit === 'clarity' ? 'modern' : explicit === 'canvas' ? 'classic' : explicit;
  if (saved === 'fresh' || saved === 'modern' || saved === 'clarity') return 'modern';
  return developerChoice && (saved === 'canvas' || saved === 'classic') ? 'classic' : 'modern';
}
export function selectedUIVersion(): string {
  let saved: string | null = null;
  try { saved = localStorage.getItem(key) ?? localStorage.getItem('drishya-experience-v4'); } catch { /* URL selection works without storage. */ }
  return resolveUIVersion(location.search, saved, versionChoiceEnabled());
}
/** An explicit `?experience=` wins; otherwise a saved Clarity choice applies. Everything else is the Modern skin. */
export function resolveUISkin(search: string, saved?: string | null): UISkin {
  const explicit = new URLSearchParams(search).get('experience');
  if (explicit) return explicit === 'clarity' ? 'clarity' : 'modern';
  return saved === 'clarity' ? 'clarity' : 'modern';
}
export function selectedUISkin(): UISkin {
  // Units import the store without a page: no location means no Clarity.
  if (typeof location === 'undefined') return 'modern';
  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch { /* URL selection works without storage. */ }
  return resolveUISkin(location.search, saved);
}
/** The skin for components that render differently under Clarity (the Modern branch must stay as it was). The skin cannot change without a reload. */
export function useSkin(): UISkin { return skin; }
const skin: UISkin = typeof location === 'undefined' ? 'modern' : selectedUISkin();
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
