// P2-C verification freshness, shown for one change in the operation detail. Wording states order
// only: which runs were recorded after the change, and whether the file changed after the last.
// It never says a run covers the change, and never shows a "safe" badge.

import { useEffect, useState } from 'react';
import type { Operation } from '@drishya/contracts';
import type { VerificationTrail } from '@drishya/scene';
import { CapturedTime } from './common.tsx';
import { useApp } from '../state.ts';

const VERDICT: Record<VerificationTrail['verdict'], string> = {
  'no-check-recorded': 'No test run was recorded after this change.',
  'checked-after': 'A test run was recorded after this change.',
  'changed-after-last-check': 'The last recorded test run predates a later change to this file.',
};

const CAVEAT: Record<VerificationTrail['verdict'], string> = {
  'no-check-recorded': 'That means none in this capture, not that none was run.',
  'checked-after': 'Running later does not show that the run exercises this change.',
  'changed-after-last-check': 'The latest version of the file has no recorded run after it.',
};

export function VerificationPanel({ op, onOpen }: { op: Operation; onOpen?: (operationId: string) => void }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const mode = useApp((s) => s.mode);
  const revision = useApp((s) => s.renderedRevisions[recordingId ?? '']);
  const select = useApp((s) => s.select);
  const operations = useApp(s => s.projection?.operations);
  const open = onOpen ?? select;
  const [trail, setTrail] = useState<VerificationTrail | null>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  // The daemon computes this per recording; a bundle computes it locally on its whole (possibly
  // combined) projection, so a combined bundle view is fine.
  const supported = (op.kind === 'edit' || op.kind === 'write') && !!source?.verification && !!recordingId && (source.kind === 'bundle' || !recordingId.includes('+'));

  useEffect(() => {
    setTrail(undefined);
    setError(undefined);
    if (!supported || mode === 'replay') return;
    let live = true;
    source!.verification!(recordingId!, op.id).then((t) => live && setTrail(t)).catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [supported, source, recordingId, op.id, mode, revision, retry]);

  if (!supported) return null;
  if (mode === 'replay') return <section className="verify" aria-label="Test runs after this change"><h4>Test runs after this change</h4><p className="muted small">This view uses the full recording. Return to history to inspect its test runs; future results are hidden during sequence replay.</p></section>;
  if (error) return <section className="verify" aria-label="Test runs after this change"><p className="muted small" role="alert">Could not load test runs after this change: {error}</p><button className="btn" onClick={() => setRetry(n => n + 1)}>Retry test verification</button></section>;
  if (trail === undefined) return <section className="verify"><div className="skeleton" /></section>;
  if (trail === null) return null;

  const last = trail.lastCheck;
  const lastOperation = operations?.find(operation => operation.id === last?.operationId);
  return (
    <section className={`verify verify-${trail.verdict}`} aria-label="Test runs after this change">
      <h4>Test runs after this change{trail.totalChecks > 1 && <small> · {trail.totalChecks} runs</small>}</h4>
      <p className="verify-verdict" title={CAVEAT[trail.verdict]}>{VERDICT[trail.verdict]}</p>
      {last && (
        <p className="small">
          Latest:{' '}
          <button className="link verify-open" title={last.title} onClick={() => open(last.operationId)}>{last.title}</button>
          {(lastOperation?.endTime ?? lastOperation?.startTime) && <CapturedTime iso={(lastOperation?.endTime ?? lastOperation?.startTime)!} />}
          {last.detail && <span className="muted"> · {last.detail}</span>}
          {last.status === 'error' && <span className="bad"> · failed</span>}
          {last.namesChangedFile && <span className="muted"> · a captured failure names this file</span>}
          {!last.sameAgent && <span className="muted"> · run by another agent</span>}
        </p>
      )}
      <small className="muted">Recorded order · coverage not established</small>
      {trail.laterChanges.length > 0 && (
        <div className="small">
          Later changes to {trail.paths.length === 1 ? 'this file' : 'these files'}:
          <ul>
            {trail.laterChanges.map((c) => (
              <li key={c.operationId}>
                <button className="link verify-open" onClick={() => open(c.operationId)}>{c.title}</button>
                {last && c.sequence > last.sequence && <span className="muted"> · after the last recorded run</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
