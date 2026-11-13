import { useApp } from '../state.ts';
import { openChanges } from '../lib/open-changes.ts';

export function CompareButton() {
  const open = useApp(s => s.compareOpen), mode = useApp(s => s.mode), id = useApp(s => s.recordingId), source = useApp(s => s.source);
  const unavailable = source?.kind === 'daemon' && !!id?.includes('+');
  return <button className="btn ghost compare-open" data-compare-open aria-expanded={open} disabled={mode === 'replay' || unavailable}
    title={mode === 'replay' ? 'Return to history to see changes' : unavailable ? 'Choose one native recording to see its changes' : 'Changes: uncommitted work, this session’s branch, two branches or a pull request, with the agent work behind each file'}
    onClick={() => { if (open) window.dispatchEvent(new Event('drishya-compare-close')); else openChanges(); }}>Changes</button>;
}
