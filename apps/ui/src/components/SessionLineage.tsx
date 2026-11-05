import type { Projection } from '@drishya/contracts';
import { useApp } from '../state.ts';

/** The passage that opens at or after a transition: a continuation usually starts with a prompt turn, which no passage covers. */
const homes = new WeakMap<Projection, Map<string, string>>();
function homeOf(projection: Projection, recordingId: string, step: number): string | undefined {
  let cache = homes.get(projection);
  if (!cache) homes.set(projection, cache = new Map());
  if (!cache.has(recordingId)) cache.set(recordingId, projection.passages.find(item => item.lastStep >= step)?.id ?? '');
  return cache.get(recordingId) || undefined;
}

/** Derived source transitions, never prose attributed to the agent or a guessed source link. */
export function SessionLineage({ projection, passageId, visibleStep }: { projection: Projection; passageId: string; visibleStep: number }) {
  const local = useApp(state => state.source?.kind === 'daemon');
  const view = projection.lineage;
  if (!view) return null;
  const firstPassage = projection.passages[0]?.id === passageId;
  const links = view.links.filter(link => {
    const transition = view.transitions?.find(item => item.recordingId === link.childRecordingId);
    if (transition) return transition.step < visibleStep && homeOf(projection, link.childRecordingId, transition.step) === passageId;
    // No retained material means there is no exact place for a transition: state that at the start.
    return firstPassage && link.childRecordingId === view.currentRecordingId;
  });
  return <>{links.map(link => <aside key={link.childRecordingId} className="session-lineage muted" aria-label="Session file continuation" style={{ padding: '10px 0 14px', fontSize: 12, lineHeight: 1.6 }}>
    <details>
      <summary style={{ cursor: 'pointer', width: 'fit-content', maxWidth: '100%' }}>{link.status === 'linked' ? 'Continued from an earlier session file' : link.status === 'parent-missing' ? 'Earlier session file is unavailable' : 'Earlier session file could not be identified uniquely'}</summary>
      <p style={{ maxWidth: '65ch', margin: '8px 0' }}>From the harness journal’s exact parent reference. {link.status === 'linked' ? 'History, counts, search and replay include the linked files. Identical parts appear once; differing receipts remain recorded.' : link.status === 'parent-missing' ? 'The recorded parent is not available locally. This file’s retained work is still readable.' : 'Several possible owners, an incomplete source scan or a circular reference prevents a safe join. This file stays independent.'}</p>
      <p style={{ maxWidth: '65ch', margin: '8px 0' }}>Native controls, current Files and Git use the selected file’s workspace. Usage, saved outputs and checkpoints remain scoped to their physical session file.</p>
      {!view.transitions?.some(item => item.recordingId === link.childRecordingId) && <p style={{ margin: '8px 0' }}>This file contributes no additional retained timeline material.</p>}
      {link.status === 'linked' && link.parentRecordingId && <button type="button" className="btn ghost" disabled={!local} title={local ? undefined : 'Open the local session library to read this part separately.'} onClick={() => { location.hash = `#/r/${encodeURIComponent(link.parentRecordingId!)}`; void useApp.getState().openRecording(link.parentRecordingId!); }}>Open earlier part</button>}
    </details>
  </aside>)}</>;
}
