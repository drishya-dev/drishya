// P2-C verification freshness, shown for one change in the operation detail. Wording states order
// only: which runs were recorded after the change, and whether the file changed after the last.
// It never says a run covers the change, and never shows a "safe" badge.

import { useEffect, useState } from 'react';
import type { Operation } from '@drishya/contracts';
import type { FixChain, ReadBeforeWrite, VerificationTrail } from '@drishya/scene';
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

// READ-7: a failed command and the next recorded run of the same command, with the edits
// recorded between them. A relationship by recorded order, never a cause.
export function FixChainPanel({ op }: { op: Operation }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const mode = useApp((s) => s.mode);
  const revision = useApp((s) => s.renderedRevisions[recordingId ?? '']);
  const select = useApp((s) => s.select);
  const [chain, setChain] = useState<FixChain | null>();
  const supported = !!source?.fixChain && !!recordingId && (source.kind === 'bundle' || !recordingId.includes('+'));

  useEffect(() => {
    setChain(undefined);
    if (!supported || mode === 'replay') return;
    let live = true;
    source!.fixChain!(recordingId!, op.id).then((c) => live && setChain(c)).catch(() => live && setChain(null));
    return () => {
      live = false;
    };
  }, [supported, source, recordingId, op.id, mode, revision]);

  if (!chain) return null;
  const mark = (status: string) => (status === 'error' ? '✗' : status === 'ok' ? '✓' : '·');
  return (
    <section className="fix-chain" aria-label="Same command, later run" title="Same command, later run, in recorded order. The edits are not shown to be the reason the result changed.">
      {chain.links.map((link) => (
        <p key={link.from.operationId + link.to.operationId} className="small">
          <button className={`link verify-open${link.from.operationId === op.id ? ' here' : ''}`} onClick={() => select(link.from.operationId)}><span className="bad">✗</span> failed{link.from.detail ? ` · ${link.from.detail}` : ''}</button>
          <span className="muted"> → </span>
          {link.totalEdits ? (
            <details className="fix-chain-edits">
              <summary>{link.totalEdits} edit{link.totalEdits === 1 ? '' : 's'}</summary>
              <ul>{link.edits.map((e) => <li key={e.operationId}><button className="link verify-open" title={e.paths.join(', ')} onClick={() => select(e.operationId)}>{e.title}</button></li>)}</ul>
              {link.totalEdits > link.edits.length && <small className="muted">{link.totalEdits - link.edits.length} more</small>}
            </details>
          ) : <span className="muted">no edits recorded</span>}
          <span className="muted"> → </span>
          <button className={`link verify-open${link.to.operationId === op.id ? ' here' : ''}`} onClick={() => select(link.to.operationId)}><span className={link.to.status === 'error' ? 'bad' : link.to.status === 'ok' ? 'good' : 'muted'}>{mark(link.to.status)}</span> {link.to.status === 'ok' ? 'passed' : link.to.status === 'error' ? 'failed again' : link.to.status}{link.to.detail ? ` · ${link.to.detail}` : ''}</button>
        </p>
      ))}
      <small className="muted">Same command, later run · recorded order</small>
    </section>
  );
}

// READ-6: which lines of this file the agent had read, as recorded, before this edit. Facts about
// recorded reads only: shell output and search results are not counted, and it is never a risk score.
export function ReadBeforePanel({ op }: { op: Operation }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const mode = useApp((s) => s.mode);
  const revision = useApp((s) => s.renderedRevisions[recordingId ?? '']);
  const select = useApp((s) => s.select);
  const [found, setFound] = useState<ReadBeforeWrite | null>();
  const supported = !!source?.readBefore && !!recordingId && (source.kind === 'bundle' || !recordingId.includes('+'));

  useEffect(() => {
    setFound(undefined);
    if (!supported || mode === 'replay') return;
    let live = true;
    source!.readBefore!(recordingId!, op.id).then((r) => live && setFound(r)).catch(() => live && setFound(null));
    return () => {
      live = false;
    };
  }, [supported, source, recordingId, op.id, mode, revision]);

  if (!found || found.created) return null;
  const span = (r: ReadBeforeWrite['reads'][number]) => (r.end === undefined ? (r.start === 1 ? 'the whole file' : `line ${r.start} to the end`) : `lines ${r.start}–${r.end}`);
  const edited = found.edited.map((range) => (range.start === range.end ? `line ${range.start}` : `lines ${range.start}–${range.end}`)).join(', ');
  const REL: Record<ReadBeforeWrite['coverage'], string> = {
    none: '', unknown: 'The file was edited after that read, so its line numbers may differ.',
    inside: 'Those lines are inside what was read.', partly: 'Those lines are partly inside what was read.', outside: 'Those lines are outside what was read.',
  };
  return (
    <section className={`read-before read-before-${found.coverage}`} aria-label="Reads of this file before this edit" title="Only the agent's own read tool is counted. File text that arrived through a shell command or a search result is not seen here.">
      {found.totalReads === 0 ? (
        <p className="small muted">No read of this file was recorded before this edit.</p>
      ) : (
        <p className="small">
          <span className="muted">Read before this edit: </span>
          {found.reads.slice(0, 2).map((r, i) => (
            <span key={r.operationId}>{i > 0 && <span className="muted">, </span>}<button className="link verify-open" onClick={() => select(r.operationId)}>{span(r)}</button></span>
          ))}
          {found.totalReads > 2 && <span className="muted"> and {found.totalReads - 2} more</span>}
          {edited && <span className="muted"> · this edit replaces {edited}. {REL[found.coverage]}</span>}
          {!edited && found.coverage === 'unknown' && <span className="muted"> · the lines this edit replaces were not captured.</span>}
        </p>
      )}
    </section>
  );
}
