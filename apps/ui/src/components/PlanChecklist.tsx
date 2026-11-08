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

function Items({ revision }: { revision: Pick<PlanRevision, 'items'> }) {
  return <ul className="plan-list">{revision.items.map((item, i) => <li key={item.id ?? i} className={`plan-${item.status}`} data-change={item.change}>
      <span className="plan-mark" aria-hidden="true">{MARK[item.status] ?? '·'}</span>
      <span><span className="plan-text">{item.text}</span>{item.change && <small className="plan-change" aria-hidden="true">{WORD[item.change]}</small>}</span>
      <span className="sr-only"> ({item.status ? item.status.replace('_', ' ') : 'status not recorded'}{item.change ? `, ${WORD[item.change]} in this revision` : ''})</span>
    </li>)}</ul>;
}

/** The agent's rewritten todo list as one evolving checklist. Captured items only; "changed" is a comparison with the revision before. */
export function PlanChecklist({ op, full = false }: { op: Operation; full?: boolean }) {
  const projection = useApp((s) => s.projection);
  const mode = useApp(s => s.mode), step = useApp(s => s.step);
  const position = useMemo(() => (projection ? (mode === 'replay'
    ? planThreads(projection, candidate => (candidate.detail.kind === 'plan' && candidate.detail.scope ? candidate.endSequence ?? Infinity : candidate.startSequence) < step)
    : threadsOf(projection)).get(op.id) : undefined), [projection, op.id, mode, step]);
  const [at, setAt] = useState<number>();
  if (op.detail.kind === 'plan' && op.detail.document) {
    const doc = op.detail.document;
    return <section className="plan-card plan-document" aria-label={doc.source === 'file' ? 'Plan file' : 'Proposed plan'}><small className="plan-basis">{doc.source === 'file' ? 'File · plan-path convention' : 'Proposal'} · not an approval</small>{doc.truncated ? <ArtifactReader id={doc.artifactId} kind="output" fallback={doc.text} /> : <Markdown text={doc.text} document />}</section>;
  }
  if (!position && op.detail.kind === 'plan' && op.detail.scope && op.endSequence === undefined) return <small className="plan-basis">Waiting for the task result</small>;
  if (!position) return <div className="plan-card"><Items revision={{ items: op.detail.kind === 'plan' ? op.detail.items : [] }} /></div>;
  const { thread, index } = position;
  const shownIndex = full ? Math.min(at ?? index, index, thread.revisions.length - 1) : index;
  const revision = thread.revisions[shownIndex]!;
  const heading = <span className="plan-head"><b>Revision {shownIndex + 1}</b> · {revision.done} of {revision.total}{revision.omittedItems ? ' shown' : ''} done</span>;

  // Each captured revision keeps its own items; no disclosure preference can hide evidence.
  return <div className="plan-card" role="group" aria-label="Plan checklist">
    <div className="plan-bar">
      {heading}
      {full && thread.revisions.length > 1 && <span className="plan-steps">
        <button type="button" className="link" disabled={shownIndex === 0} onClick={() => setAt(shownIndex - 1)} aria-label="Earlier revision">‹</button>
        <button type="button" className="link" disabled={shownIndex >= index} onClick={() => setAt(shownIndex + 1)} aria-label="Later revision">›</button>
      </span>}
    </div>
    <Items revision={revision} />
    {!!revision.omittedItems && <small className="plan-basis">{revision.omittedItems} additional tasks outside the bounded list; result retained in details.</small>}
    {revision.removed.length > 0 && <small className="plan-removed">Left out of this revision: {revision.removed.join(' · ')}</small>}
    <small className="plan-basis">Task facts, compared with the revision before</small>
  </div>;
}

/**
 * The prompt keeps a progress reference; the current captured revision below
 * owns the list. This avoids both duplicate text and an offscreen-only home.
 */
export function PinnedPlanList({ plan }: { plan: PinnedPlan }) {
  return <div className="plan-pinned" title={`The agent's newest todo list, revision ${plan.revision} of ${plan.revisions}`} onClick={(e) => e.stopPropagation()}>
    <span className="plan-head"><b>Plan</b> · {plan.done} of {plan.total}{plan.omittedItems ? ' shown' : ''} done{plan.revisions > 1 ? ` · revision ${plan.revision}` : ''}</span>
    <button type="button" className="link plan-pinned-more" onClick={() => window.dispatchEvent(new CustomEvent('drishya-reading-navigate', {detail: {type: 'operation', id: plan.operationId}}))}>Go to checklist</button>
  </div>;
}
