import { createPortal } from 'react-dom';
import { useApp } from '../state.ts';
import { openGitHistory } from './GitHistory.tsx';

export function GitBranchGlyph() {
  return <svg className="git-branch-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="19" r="2.5" /><path d="M6 7.5v9M18 8.5v1a6 6 0 0 1-6 6H6" /></svg>;
}

/** The header's Git control (GIT-9): one click opens Git graph. The popover that also offered Git review is gone; the working-tree patches live in Changes under Uncommitted. */
export function GitEntry({ icon = false, slot }: { icon?: boolean; slot?: Element | null }) {
  const id = useApp(s => s.recordingId), source = useApp(s => s.source), mode = useApp(s => s.mode);
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const eligible = source?.kind === 'daemon' && !!id && !id.includes('+') && (!modern || mode === 'history');
  if (!modern && !eligible) return null;
  const button = <button className="btn ghost git-open" aria-label={modern ? 'Git' : 'Git graph'} title={eligible ? 'Git graph: branches and commits' : 'Git needs a single local session in history'} disabled={!eligible} onClick={openGitHistory}>{icon && <GitBranchGlyph />}{modern ? 'Git' : 'Git graph'}</button>;
  return slot ? createPortal(button, slot) : button;
}
