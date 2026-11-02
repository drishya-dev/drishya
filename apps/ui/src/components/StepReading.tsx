import type { EvidenceLink, Operation, Projection } from '@drishya/contracts';
import { StepNoteEditor } from './StepNotes.tsx';
import { stepOfOperation } from '@drishya/scene';
import { useApp } from '../state.ts';
import { ProvenanceBadge } from './common.tsx';
import { EvidenceNavigation } from './EvidenceNavigation.tsx';
import { InvestigationActions } from './InvestigationActions.tsx';
import { VerificationPanel } from './Verification.tsx';
import './step-reading.css';

const RELATION: Record<string, string> = {
  'same-artifact': 'Same file',
  'explicit-reference': 'Named in the result',
  'test-reference': 'Named by the failing test',
  'test-outcome-change': 'Test outcome changed',
  'temporal-neighbor': 'Nearby in time',
  spawned: 'Started a subagent',
  'observed-write-overlap': 'Two agents wrote this file',
  'static-import': 'Imports',
};

/** What is known around a step and what a reader can do with it, under the step's own material. */
export function StepReading({ op, projection }: { op: Operation; projection: Projection }) {
  const links = projection.links.filter((l) => (l.from === op.id || l.to === op.id || op.observationIds.includes(l.from) || op.observationIds.includes(l.to)) && l.relation !== 'tool-result');
  return <div className="step-reading" onClick={(e) => e.stopPropagation()}>
    <EvidenceNavigation hideEmpty />
    {op.classification?.kind !== 'captured' && <ProvenanceBadge p={op.classification} />}
    <VerificationPanel op={op} />
    {links.length > 0 && <details className="step-links"><summary>Links · {links.length}</summary><StepLinks op={op} links={links} projection={projection} /></details>}
    <InvestigationActions key={`investigate/${op.id}`} op={op} />
    <div className="step-notes"><StepNoteEditor key={op.id} op={op} /></div>
  </div>;
}

function StepLinks({ op, links, projection }: { op: Operation; links: EvidenceLink[]; projection: Projection }) {
  const historyPage = useApp((s) => s.historyPage);
  const seek = useApp((s) => s.seek);
  const select = useApp((s) => s.select);
  const go = (id: string) => {
    const reference = historyPage?.references[id];
    if (reference) {
      const state = useApp.getState();
      state.set({ selectedOp: id, expandedOp: undefined, held: true });
      void state.loadHistoryWindow({ selectedOperationId: id }).catch((error) => state.set({ error: error.message }));
      return;
    }
    const other = projection.operations.find((o) => o.id === id);
    if (!other) return;
    const s = stepOfOperation(projection, id);
    if (s !== undefined && useApp.getState().mode === 'replay') seek(s, { hold: true });
    select(id);
  };
  return <div className="links">
    <p className="insp-note muted">Every relationship states how it is known. "Nearby in time" is never a reason.</p>
    {links.map((l) => {
      const otherId = l.from === op.id || op.observationIds.includes(l.from) ? l.to : l.from;
      const other = projection.operations.find((o) => o.id === otherId);
      const reference = historyPage?.references[otherId];
      const prose = projection.prose.find((p) => p.id === otherId);
      return <button key={l.id} className="link-row" onClick={() => go(otherId)} disabled={!other && !reference}>
        <span className={`rel rel-${l.basis}`}>{RELATION[l.relation] ?? l.relation}</span>
        <span className="link-target">{other ? other.title : reference ? reference.title : prose ? `“${prose.text.slice(0, 80)}…”` : otherId.replace(/^file:/, '')}</span>
        <span className="link-why">{l.explanation}</span>
        <span className="link-basis">{l.basis.replace(/-/g, ' ')}{l.ruleVersion ? ` · ${l.ruleVersion}` : ''}</span>
      </button>;
    })}
  </div>;
}
