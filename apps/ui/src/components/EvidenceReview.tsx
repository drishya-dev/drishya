import { useEffect, useState } from 'react';
import type { Projection } from '@drishya/contracts';
import { sinceSnapshot, type SinceSnapshot } from '../../../../packages/scene/src/since.ts';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { FileIcon } from './FileIcon.tsx';
import { useEvidenceState } from './EvidenceNavigation.tsx';

/** A first-visit review entry. Daemon facts cover the whole recording, not its resident page. */
export function EvidenceReview({ projection, label = 'Review work' }: { projection: Projection; label?: string }) {
  const [open, setOpen] = useState(false);
  const mode = useApp(s => s.mode);
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const unavailable = source?.kind === 'daemon' && id?.includes('+');
  return <><button className="btn ghost review-open" disabled={mode === 'replay' || unavailable} title={mode === 'replay' ? 'Return to history to review the complete recording' : unavailable ? 'Choose one native recording to review' : 'Changes, failures and recorded checks'} onClick={() => setOpen(true)}>{label}</button>
    {open && mode !== 'replay' && <ReviewContent projection={projection} close={() => setOpen(false)} />}</>;
}

function ReviewContent({ projection, close }: { projection: Projection; close: () => void }) {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId)!;
  const revision = useApp(s => s.renderedRevisions[id]);
  const [page, setPage] = useEvidenceState('review/page', 0);
  const [response, setResponse] = useState<{ page: number; data: SinceSnapshot }>();
  const facts = response?.page === page ? response.data : undefined;
  const pageCount = Math.max(1, Math.ceil((response?.data.editedFileCount ?? 0) / 50), ...Object.entries(response?.data.counts ?? {}).filter(([key]) => key !== 'edits').map(([, count]) => Math.ceil(count / 20)));
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(undefined);
    const request = source?.kind === 'daemon' ? source.since?.(id, -1, page) : Promise.resolve(sinceSnapshot(projection, -1, page));
    if (!request) { setError('Review is unavailable for this recording.'); return; }
    void request.then(data => {
      if (!active) return;
      const pages = Math.max(1, Math.ceil(data.editedFileCount / 50), ...Object.entries(data.counts).filter(([key]) => key !== 'edits').map(([, count]) => Math.ceil(count / 20)));
      if (page >= pages) { setPage(pages - 1); return; }
      setResponse({ page, data });
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [source, id, revision, projection.lastSequence, retry, page]);
  const groups = [['failures', 'Failures'], ['tests', 'Recorded checks'], ['unfinished', 'In progress'], ['gaps', 'Capture gaps']] as const;
  return <ReadingDialog title="Review work" close={close} className="evidence-review">
    <div className="review-intro"><p>Start with the change. Follow the evidence.</p><span>Whole recording · recorded order, not test coverage</span></div>
    {pageCount > 1 && <nav className="reader-pages review-pagination" aria-label="Recorded review pages"><button className="btn" aria-label="Previous review page" disabled={!page} onClick={() => setPage(n => Math.max(0, n - 1))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Previous</button><span aria-live="polite">Page {page + 1} of {pageCount}</span><button className="btn" aria-label="Next review page" disabled={page + 1 >= pageCount} onClick={() => setPage(n => n + 1)}>Next<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button><small>Up to 20 outcomes per group · 50 files per page</small></nav>}
    {error ? <p role="alert">{error} <button className="btn" onClick={() => setRetry(n => n + 1)}>Retry</button></p> : !facts ? <p role="status">Opening recorded evidence…</p> : <>
      <div className="review-counts"><span><strong>{facts.editedFileCount.toLocaleString()}</strong> {facts.editedFileCount === 1 ? 'file' : 'files'} with change inputs</span><span><strong>{facts.counts.failures.toLocaleString()}</strong> failed {facts.counts.failures === 1 ? 'operation' : 'operations'}</span><span><strong>{facts.counts.tests.toLocaleString()}</strong> test {facts.counts.tests === 1 ? 'run' : 'runs'}</span></div>
      <div className="review-layout"><section className="review-files" aria-label="Files with captured changes"><h3>Changed files</h3>
        {facts.editedFiles.length ? facts.editedFiles.map(path => <button key={path} onClick={() => { useApp.getState().set({ filePanel: path, filePanelFocus: 'change', currentFile: undefined, explore: false }); close(); }}><FileIcon path={path} /><span>{path}</span><span aria-hidden="true">↗</span></button>) : <p className="muted">{facts.editedFileCount ? 'No more changed files on this page.' : 'No change inputs recorded.'}</p>}
        {facts.editedFileCount > facts.editedFiles.length && <p className="muted">Showing {facts.editedFiles.length} of {facts.editedFileCount} files on page {page + 1}. Use review pages for the rest.</p>}
        <p className="review-note">Captured patches can be proposed or reconstructed. Open a file to inspect its actual evidence and later checks.</p>
      </section><div className="review-outcomes">{groups.map(([key, title]) => <section key={key} aria-label={title}><h3>{title} <span>{facts.counts[key]}</span></h3>
        {facts[key].length ? facts[key].map(item => <div className="review-item" key={`${key}/${item.operationId ?? item.sequence}`}>{item.operationId ? <button onClick={() => { useApp.getState().select(item.operationId!); close(); }}>{item.title}<span aria-hidden="true">↗</span></button> : <span>{item.title}</span>}{item.detail && <small>{item.detail}</small>}{item.status === 'unknown' && <small>Outcome not exposed</small>}</div>) : <p className="muted">{facts.counts[key] ? 'No more on this page.' : 'None recorded.'}</p>}
        {facts.counts[key] > facts[key].length && <p className="muted">Showing {facts[key].length} of {facts.counts[key]} on page {page + 1}. Use review pages for the rest.</p>}
      </section>)}</div></div>
    </>}
  </ReadingDialog>;
}
