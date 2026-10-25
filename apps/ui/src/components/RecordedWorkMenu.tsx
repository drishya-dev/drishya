import type { Operation } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { recordedPicks } from '../lib/hunk-evidence.ts';
import { timeOf } from './common.tsx';
import './recorded-work-menu.css';

/**
 * GIT-4: several captured edits wrote the same lines. Light dismissal, arrow keys and viewport fitting come from the
 * shared `.desk-options` disclosure (useDismissMenus); Escape is also handled here so it never closes the dialog behind.
 */
export function RecordedWorkMenu({ matches, open }: { matches: Operation[]; open: (evidenceKey: string) => void }) {
  const timeline = useApp(s => s.projection?.timeline);
  const picks = recordedPicks(matches, timeline ?? []);
  return <details className="desk-options recorded-work-menu" onKeyDown={event => {
    if (event.key !== 'Escape' || !event.currentTarget.open) return;
    event.preventDefault(); event.stopPropagation();
    document.documentElement.removeAttribute('data-ui-press');
    event.currentTarget.removeAttribute('data-pointer-menu'); event.currentTarget.open = false;
    event.currentTarget.querySelector<HTMLElement>(':scope>summary')?.focus({ preventScroll: true });
  }}>
    <summary className="btn ghost small hunk-recorded" title={`${picks.length} captured edits wrote exactly these added lines; choose one to open`}>Recorded work · {picks.length} edits</summary>
    <div className="desk-options-body" role="group" aria-label="Edits that wrote these lines, newest first">
      {picks.map(pick => {
        const time = pick.twin ? timeOf(pick.op.startTime) : '';
        return <button key={pick.key} type="button" className="btn ghost small" aria-label={`${pick.label}${time ? ` · ${time}` : ''}`} onClick={event => { event.currentTarget.closest('details')!.open = false; open(pick.key); }}>
          {pick.turn !== undefined && <span className="recorded-turn">Turn {pick.turn}</span>}
          <span>{pick.op.title}</span>
          {time && <span className="recorded-turn">{time}</span>}
        </button>;
      })}
    </div>
  </details>;
}
