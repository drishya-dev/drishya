import { useApp } from '../state.ts';

export type ChangesPreset = 'uncommitted' | 'session' | 'branch' | 'pr';

/** Opens the Changes window (GIT-8, GIT-9) from anywhere: the header, the palette, a "← Changes" return. The Workspace and file readers step aside; `preset` picks the view it opens on. */
export const openChanges = (preset?: ChangesPreset) => useApp.setState({ compareOpen: true, developerWorkspace: false, currentFile: undefined, explore: false, ...(preset ? { comparePreset: preset } : {}) });
