import { useMemo, type ReactNode } from 'react';
import { capturedOutcomes, type OutcomeState } from '../lib/captured-outcomes.ts';
import { testTiles } from '../lib/test-tiles.ts';

export function CapturedOutcomes({ output, fallback }: { output?: string; fallback?: ReactNode }) {
  const report = useMemo(() => capturedOutcomes(output ?? ''), [output]);
  if (!report.runs.length && !report.notes.length) return fallback ?? null;
  return <div className="captured-outcomes" aria-label="Derived captured test outcomes">
    {report.runs.map((run, index) => {
      const entries = Object.entries(run.counts).filter(([, count]) => count > 0) as [OutcomeState, number][];
      const total = entries.reduce((n, [, count]) => n + count, 0);
      const tap = run.tap && !run.counts.cancelled && !run.counts.errors && !run.counts.unknown ? testTiles({ framework: 'tap', ...run.counts, failures: [], passing: [], basis: 'derived' }, run.tap) : undefined;
      const displayed = tap?.ordered ? total : entries.reduce((n, [, count]) => n + Math.min(32, count), 0);
      return <section key={index}>
        <div className="material-context">{run.runner} · captured output {run.output} · {run.unit}</div>
        <div className="verification-track" aria-hidden="true">{tap?.ordered ? tap.tiles.map(tile => <span key={tile.index} title={tile.name} className={`verification-tile ${tile.state}`}>{tile.index}</span>) : entries.flatMap(([state, count]) => Array.from({ length: Math.min(32, count) }, (_, n) => <span key={`${state}-${n}`} className={`verification-tile ${state}`} />))}</div>
        <div className="verification-caption">{entries.map(([state, count]) => <span key={state} className={state === 'passed' ? 'good' : state === 'failed' || state === 'errors' ? 'bad' : 'muted'}>{count.toLocaleString()} {state}</span>)}{!total && <span className="muted">0 reported tests</span>}</div>
        {run.suites && <div className="verification-basis">Suite summary: {run.suites}</div>}
        <div className="verification-basis">Derived · runner-summary-v1 · {tap?.ordered ? 'captured flat TAP indices' : 'grouped counts, not execution order'}{total > displayed ? ` · ${total - displayed} additional outcomes in counts` : ''}</div>
      </section>;
    })}
    {report.notes.map(note => <p key={note} className="verification-basis">{note}</p>)}
  </div>;
}
