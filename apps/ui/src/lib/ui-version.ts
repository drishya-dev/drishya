// Archived source keeps these types so it can be developed again after Release 1.
// The shipped entry and every runtime resolver are Modern-only, regardless of old URLs/storage.
export type UIVersion = 'classic' | 'modern' | 'clarity';
export type UISkin = 'modern' | 'clarity';
export function versionChoiceEnabled(_search?: string): boolean { return false; }
export function resolveUIVersion(_search: string, _saved?: string | null, _developerChoice = false): string { return 'modern'; }
export function selectedUIVersion(): string { return 'modern'; }
export function resolveUISkin(_search: string, _saved?: string | null): UISkin { return 'modern'; }
export function selectedUISkin(): UISkin { return 'modern'; }
export function useSkin(): UISkin { return 'modern'; }
/** Compatibility for archived callers: retain the location, never select another presentation. */
export function versionURL(href: string, _version: string): string {
  const url = new URL(href);
  url.searchParams.delete('experience');
  url.searchParams.delete('versions');
  return url.href;
}
export function switchUIVersion(_version: UIVersion) { location.assign(versionURL(location.href, 'modern')); }
