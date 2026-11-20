/** Existing preferences stay compatible. Candidate IDs are presentation only. */
export type ThemePreference = 'midnight' | 'dark' | 'light' | 'system' | 'neutral' | 'chalk' | 'slate' | 'aubergine';
export function parseThemePreference(value: string | null): ThemePreference {
  const retired: Record<string, ThemePreference> = {mocha:'dark',nord:'dark',gruvbox:'dark',tokyo:'light'};
  return ['dark','midnight','light','system','neutral','chalk','slate','aubergine'].includes(value ?? '') ? value as ThemePreference : retired[value ?? ''] ?? 'dark';
}
export function resolveThemePreference(theme: ThemePreference, systemLight: boolean): {scheme:'light'|'dark';palette:string} {
  const scheme = theme === 'light' || theme === 'chalk' || theme === 'system' && systemLight ? 'light' : 'dark';
  return {scheme,palette:theme === 'system' ? (systemLight?'paper':'jet') : theme === 'dark'?'jet':theme === 'light'?'paper':theme};
}
