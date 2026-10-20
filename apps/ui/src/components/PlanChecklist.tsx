import { useMemo, useState } from 'react';
import type { Operation, Projection } from '@drishya/contracts';
import { planThreads, type PlanPosition, type PlanRevision } from '@drishya/scene';
import { useApp } from '../state.ts';
import './plan-checklist.css';

const threadCache = new WeakMap<Projection, Map<string, PlanPosition>>();
const threadsOf = (projection: Projection) => {
  let found = threadCache.get(projection);
  if (!found) threadCache.set(projection, found = planThreads(projection));
  return found;
};

const MARK: Record<string, string> = { completed: '✓', in_progress: '▸', pending: '○' };
const WORD = { added: 'added', started: 'started', completed: 'completed', reopened: 'reopened' } as const;

function Items({ revision, limit }: { revision: PlanRevision; limit?: number }) {
  const shown = limit ? revision.items.slice(0, limit) : revision.items;
  return <>
    <ul className="plan-list">{shown.map((item, i) => <li key={i} className={`plan-${item.status}`} data-change={item.change}>
      <span className="plan-mark" aria-hidden="true">{MARK[item.status] ?? '·'}</span>
      <span className="plan-text">{item.text}</span>
      <span className="sr-only"> ({item.status.replace('_', ' ')}{item.change ? `, ${WORD[item.change]} in this revision` : ''})</span>
      {item.change && <small className="plan-change" aria-hidden="true">{WORD[item.change]}</small>}
    </li>)}</ul>
    {limit && revision.items.length > limit && <small className="plan-more">{revision.items.length - limit} more items</small>}
  </>;
}

const summary = (revision: PlanRevision) => {
  const changes = revision.items.filter((item) => item.change).slice(0, 2).map((item) => `${WORD[item.change!]} ${item.text}`);
  return changes.length ? changes.join(' · ') : undefined;
};

/** The agent's rewritten todo list as one evolving checklist. Captured items only; "changed" is a comparison with the revision before. */
export function PlanChecklist({ op, full = false }: { op: Operation; full?: boolean }) {
  const projection = useApp((s) => s.projection);
  const position = useMemo(() => (projection ? threadsOf(projection).get(op.id) : undefined), [projection, op.id]);
  const [at, setAt] = useState<number>();
  if (!position) return <ul className="plan-list">{(op.detail.kind === 'plan' ? op.detail.items : []).slice(0, full ? 50 : 8).map((item, i) => <li key={i} className={`plan-${item.status}`}><span className="plan-mark" aria-hidden="true">{MARK[item.status] ?? '·'}</span><span className="plan-text">{item.text}</span></li>)}</ul>;
  const { thread, index } = position;
  const latest = index === thread.revisions.length - 1;
  const shownIndex = full ? Math.min(at ?? index, thread.revisions.length - 1) : index;
  const revision = thread.revisions[shownIndex]!;
  const heading = <span className="plan-head"><b>Revision {shownIndex + 1}</b> · {revision.done} of {revision.total} done</span>;

  if (!full && !latest) {
    // An earlier list in the same turn: one line saying what it changed, not the list again.
    return <div className="plan-card plan-earlier">{heading}{summary(revision) && <small className="plan-delta">{summary(revision)}</small>}</div>;
  }
  return <div className="plan-card" role="group" aria-label="Plan checklist">
    <div className="plan-bar">
      {heading}
      {full && thread.revisions.length > 1 && <span className="plan-steps">
        <button type="button" className="link" disabled={shownIndex === 0} onClick={() => setAt(shownIndex - 1)} aria-label="Earlier revision">‹</button>
        <button type="button" className="link" disabled={shownIndex >= index} onClick={() => setAt(shownIndex + 1)} aria-label="Later revision">›</button>
      </span>}
    </div>
    <Items revision={revision} limit={full ? undefined : 10} />
    {full && revision.removed.length > 0 && <small className="plan-removed">Left out of this revision: {revision.removed.join(' · ')}</small>}
    <small className="plan-basis">Captured list, compared with the revision before</small>
  </div>;
}
