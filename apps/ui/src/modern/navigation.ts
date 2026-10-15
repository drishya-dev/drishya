export type WorkspaceView = 'home' | 'work' | 'repository' | 'review' | 'settings';
export function readRoute(hash: string): { view: WorkspaceView; recordingId?: string } {
  if (hash === '#/settings') return { view: 'settings' };
  const match = /^#\/r\/([^/?]+)(?:\/(repository|review|settings))?$/.exec(hash);
  if (!match) return { view: 'home' };
  try { return { recordingId: decodeURIComponent(match[1]!), view: (match[2] as WorkspaceView) ?? 'work' }; }
  catch { return { view: 'home' }; }
}
export function routeHash(view: WorkspaceView, recordingId?: string) {
  if (view === 'home') return '#/';
  if (!recordingId) return view === 'settings' ? '#/settings' : '#/';
  return `#/r/${encodeURIComponent(recordingId)}${view === 'work' ? '' : `/${view}`}`;
}
