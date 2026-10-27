import { useMemo, useState } from 'react';
import type { Operation, Projection } from '@drishya/contracts';
import { planThreads, type PinnedPlan, type PlanPosition, type PlanRevision } from '@drishya/scene';
import { useApp } from '../state.ts';
import './plan-checklist.css';
import { Markdown } from '../lib/markdown.tsx';
import { ArtifactReader } from './ArtifactReader.tsx';

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
    <ul className="plan-list">{shown.map((item, i) => <li key={item.id ?? i} className={`plan-${item.status}`} data-change={item.change}>
      <span className="plan-mark" aria-hidden="true">{MARK[item.status] ?? '·'}</span>
      <span className="plan-text">{item.text}</span>
      <span className="sr-only"> ({item.status ? item.status.replace('_', ' ') : 'status not recorded'}{item.change ? `, ${WORD[item.change]} in this revision` : ''})</span>
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
  if (op.detail.kind === 'plan' && op.detail.document) {
    const doc = op.detail.document;
    return <section className="plan-card plan-document" aria-label={doc.source === 'file' ? 'Captured plan file' : 'Proposed plan'}><small className="plan-basis">{doc.source === 'file' ? 'Captured file · plan-path convention' : 'Captured proposal'} · not an approval</small>{doc.truncated ? <ArtifactReader id={doc.artifactId} kind="output" fallback={doc.text} /> : <Markdown text={doc.text} document />}</section>;
  }
  if (!position && op.detail.kind === 'plan' && op.detail.scope && op.endSequence === undefined) return <small className="plan-basis">Waiting for the recorded task result</small>;
  if (!position) return <ul className="plan-list">{(op.detail.kind === 'plan' ? op.detail.items : []).slice(0, full ? undefined : 8).map((item, i) => <li key={item.id ?? i} className={`plan-${item.status}`}><span className="plan-mark" aria-hidden="true">{MARK[item.status] ?? '·'}</span><span className="plan-text">{item.text}</span></li>)}</ul>;
  const { thread, index } = position;
  const latest = index === thread.revisions.length - 1;
  const shownIndex = full ? Math.min(at ?? index, index, thread.revisions.length - 1) : index;
  const revision = thread.revisions[shownIndex]!;
  const heading = <span className="plan-head"><b>Revision {shownIndex + 1}</b> · {revision.done} of {revision.total}{revision.omittedItems ? ' shown' : ''} done</span>;

  // Modern pins the lead agent's newest list under the prompt (TurnBlock), so in the stream every
  // revision of it is one line; the retained UIs keep the list where it arrived.
  const pinned = !full && thread.lead && typeof document !== 'undefined' && document.documentElement.dataset.uiVersion === 'modern';
  if (!full && (!latest || pinned)) {
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
    {!!revision.omittedItems && <small className="plan-basis">{revision.omittedItems} additional tasks outside the bounded list; recorded result retained in details.</small>}
    {full && revision.removed.length > 0 && <small className="plan-removed">Left out of this revision: {revision.removed.join(' · ')}</small>}
    <small className="plan-basis">Captured task facts, compared with the revision before</small>
  </div>;
}

const PINNED_LIMIT = 8;

/**
 * CONTENT-4: the turn's checklist, pinned under the prompt and rewritten in place as the agent updates it.
 * It is the lead agent's newest captured list as of the viewed step; longer lists show a window around the work in progress.
 */
export function PinnedPlanList({ plan }: { plan: PinnedPlan }) {
  const [all, setAll] = useState(false);
  const long = plan.items.length > PINNED_LIMIT;
  let items = plan.items.map((item, i) => ({ item, i }));
  if (long && !all) {
    const focus = Math.max(0, plan.items.findIndex((item) => item.status === 'in_progress'));
    const from = Math.min(Math.max(0, focus - 2), plan.items.length - PINNED_LIMIT);
    items = items.slice(from, from + PINNED_LIMIT);
  }
  return <div className="plan-pinned" role="group" aria-label="Plan checklist" title={`The agent's newest captured todo list, revision ${plan.revision} of ${plan.revisions}`} onClick={(e) => e.stopPropagation()}>
    <span className="plan-head"><b>Plan</b> · {plan.done} of {plan.total}{plan.omittedItems ? ' shown' : ''} done{plan.revisions > 1 ? ` · revision ${plan.revision}` : ''}</span>
    <ul className="plan-list">{items.map(({ item, i }) => <li key={item.id ?? i} className={`plan-${item.status}`}>
      <span className="plan-mark" aria-hidden="true">{MARK[item.status] ?? '·'}</span>
      <span className="plan-text">{item.text}</span>
      <span className="sr-only"> ({item.status ? item.status.replace('_', ' ') : 'status not recorded'})</span>
    </li>)}</ul>
    {!!plan.omittedItems && <small className="plan-basis">{plan.omittedItems} additional tasks outside the bounded list; recorded result retained in details.</small>}
    {long && <button type="button" className="link plan-pinned-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${plan.items.length}`}</button>}
  </div>;
}
