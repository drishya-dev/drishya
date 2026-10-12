import { useEffect, useMemo, useRef, useState } from 'react';
import type { Operation, Projection } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { fileEvidence, type FileEvidence } from '../lib/file-evidence.ts';
import { agentName, KIND_LABEL } from '../lib/identity.ts';
import { ArtifactReader, DiffReader } from './ArtifactReader.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import { VerificationPanel } from './Verification.tsx';
import { CapturedTime } from './common.tsx';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { ReadingResize } from './ReadingResize.tsx';
import { ImportContext } from './ImportContext.tsx';
import { CodeView, Output } from './common.tsx';
import { EvidenceNavigation, useEvidenceState, useEvidenceScroll } from './EvidenceNavigation.tsx';

/** Global bounded file history; the loaded passage window is never mistaken for the whole session. */
export function FileHistory({ projection }: { projection: Projection }) {
  const path = useApp((s) => s.filePanel);
  const recordingId = useApp((s) => s.recordingId);
  const mode = useApp((s) => s.mode);
  const step = useApp((s) => s.step);
  if (!path || !recordingId) return null;
  // Rewinding must discard later selected material before paint, rather than waiting for an effect.
  return <FileWorkspace key={`${recordingId}/${path}/${mode === 'replay' ? step : 'history'}`} path={path} projection={projection} />;
}

function FileWorkspace({ path, projection }: { path: string; projection: Projection }) {
  const focusChange = useApp(s => s.filePanelFocus === 'change');
  const preferred = useApp(s => s.filePanelEvidence);
  const explore = useApp(s => s.explore);
  const { workspace, approve } = useSessionWorkspace();
  const [diskError, setDiskError] = useState<string>();
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId)!;
  const mode = useApp((s) => s.mode);
  const step = useApp((s) => s.step);
  const revisions = useApp((s) => s.renderedRevisions);
  const [trailWidth, setTrailWidth] = useEvidenceState('file/trailWidth', 230);
  // The map's narrower modeless reader must show source on its first frame.
  const [trailHidden, setTrailHidden] = useEvidenceState('file/trailHidden', explore);
  const [query, setQuery] = useEvidenceState('file/query', '');
  const [start, setStart] = useEvidenceState('file/start', 0);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; operations: Operation[]; total: number }>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [left, setLeft] = useEvidenceState<FileEvidence | undefined>('file/left', undefined);
  const [right, setRight] = useEvidenceState<FileEvidence | undefined>('file/right', undefined);
  const [compare, setCompare] = useEvidenceState('file/compare', false);
  const trail = useRef<HTMLElement>(null);
  const reading = useRef<HTMLElement>(null);
  const key = `${recordingId}/${path}/${start}/${query}/${mode === 'replay' ? step : 'all'}/${JSON.stringify(revisions)}`;
  useEffect(() => {
    if (!source?.fileOperations) return;
    let active = true;
    const timer = setTimeout(() => {
      void source.fileOperations!(recordingId, path, start, 24, mode === 'replay' ? step : undefined, query)
        .then((page) => { if (active) { setResponse({ key, ...page }); setFailure(undefined); } })
        .catch((error) => { if (active) setFailure({ key, message: error.message }); });
    }, 100);
    return () => { active = false; clearTimeout(timer); };
  }, [source, key, retry]);
  const local = useMemo(() => {
    if (source?.fileOperations) return undefined;
    const matches = projection.operations.filter((op) => op.paths.some((ref) => ref.path === path) && (!query || `${op.title} ${op.kind}`.toLowerCase().includes(query.toLowerCase())));
    return { operations: matches.slice(start, start + 24), total: matches.length };
  }, [source, projection, path, query, start]);
  const page = local ?? (response?.key === key ? response : undefined);
  const error = failure?.key === key ? failure.message : undefined;
  useEvidenceScroll(trail, 'file/trail', !!page);
  useEvidenceScroll(reading, 'file/reading', !!page);
  const choices = useMemo(() => {
    const items = page?.operations.flatMap((op) => fileEvidence(op, path)) ?? [];
    // A clicked hit is already in the current as-of evidence window. Keep that one
    // reference even if its global trail page has not loaded or starts elsewhere.
    const clickedOperation = preferred && projection.operations.find(op => preferred.startsWith(`${op.id}/search/`));
    const clicked = clickedOperation && fileEvidence(clickedOperation, path).find(item => item.key === preferred);
    if (clicked && !items.some(item => item.key === clicked.key)) items.push(clicked);
    // Paging the action list must not replace the source being read. Retain one
    // selected reference, or two for comparison, never an unbounded trail.
    for (const selected of [left, compare ? right : undefined]) {
      if (selected && !items.some((item) => item.key === selected.key)) items.push(selected);
    }
    return items;
  }, [page, path, compare, left, right, preferred, projection]);
  const first = choices.find((item) => item.key === left?.key) ?? choices.find(item => item.key === preferred) ?? (focusChange ? choices.find(item => item.patch) ?? choices.find(item => item.operation.kind === 'write' || item.operation.kind === 'edit') : undefined) ?? choices[0];
  const second = choices.find((item) => item.key === right?.key) ?? choices.at(-1);
  useEffect(() => { if (!left && first) setLeft(first); }, [left, first]);
  const close = () => useApp.setState({ filePanel: undefined, filePanelFocus: undefined, filePanelEvidence: undefined });
  return <ReadingDialog title={`Work on ${path}`} close={close} className="file-workspace" modeless={explore}>
    <EvidenceNavigation />
    <div className="file-workspace-intro"><span className="muted small">{page ? `${page.total} recorded actions` : 'Loading captured actions…'} · {mode === 'replay' ? 'Visible at this replay step' : 'Recorded'}</span></div>
    <div className={`file-workspace-layout${trailHidden ? ' trail-hidden' : ''}`} style={{ '--trail-width': `${trailWidth}px` } as React.CSSProperties}>
      {!trailHidden && <ReadingResize value={trailWidth} minimum={160} maximum={440} change={setTrailWidth} label="Resize file action history" />}
      <nav ref={trail} className="file-trail" aria-label="File action history">
        <input className="file-filter" aria-label="Filter actions on this file" placeholder="Find a recorded action" value={query} onChange={(e) => { setQuery(e.target.value); setStart(0); setLeft(undefined); setRight(undefined); }} />
        {error && <p role="alert" className="bad">{error} <button className="btn" onClick={() => { setFailure(undefined); setRetry((n) => n + 1); }}>Retry</button></p>}
        {!page && !error && <p className="muted" role="status">Loading captured actions…</p>}
        {page?.total === 0 && <p className="muted">No matching captured actions.</p>}
        {page?.operations.map((op) => {
          const evidence = fileEvidence(op, path);
          return <div key={op.id} className="file-trail-item"><button className="file-op" onClick={() => {
            if (evidence.length) setLeft(evidence[0]);
            else { const state = useApp.getState(); state.select(op.id); state.set({ filePanel: undefined, explore: false }); }
          }} aria-pressed={first?.operation.id === op.id}>
            <span className={`op-kind k-${op.kind}`}>{KIND_LABEL[op.kind]}</span><span className="file-op-title">{op.title}</span><small>{projection.agents.length > 1 && <>{agentName(projection.agents.find((agent) => agent.id === op.agentId))} · </>}{op.status === 'error' ? 'failed' : op.status === 'running' ? 'in flight' : op.status} {op.startTime && <CapturedTime iso={op.startTime} />}</small>
          </button>{evidence.length > 0 && <button data-file-op={op.id} className="file-inspect" onClick={() => { const state = useApp.getState(); state.select(op.id); state.set({ filePanel: undefined, explore: false }); }}>Open in history ↗</button>}</div>;
        })}
        {page && page.total > 24 && <div className="file-pagination"><button className="btn" disabled={start === 0} onClick={() => { setLeft(first); setStart(Math.max(0, start - 24)); }}>Previous</button><span>{start + 1}–{Math.min(start + 24, page.total)} / {page.total}</span><button className="btn" disabled={start + 24 >= page.total} onClick={() => { setLeft(first); setStart(start + 24); }}>Next</button></div>}
      </nav>
      <section ref={reading} className="file-evidence-reading" aria-label="File evidence">
        <div className="file-evidence-toolbar"><strong>Historical evidence</strong>{source?.kind === 'daemon' && workspace?.root && !recordingId.includes('+') && <button className="btn ghost" title={workspace.root} onClick={() => { void (async () => { try { if (!workspace.approved) await approve(); if (useApp.getState().recordingId !== recordingId) return; useApp.setState({ currentFile: path, filePanel: undefined }); } catch (error) { setDiskError((error as Error).message); } })(); }}>{workspace.approved ? 'Read file on disk' : 'Enable workspace reading'}</button>}<button className="btn ghost" aria-pressed={trailHidden} onClick={() => setTrailHidden(!trailHidden)}>{trailHidden ? 'Show actions' : 'Reading space'}</button><button className="btn" aria-pressed={compare} disabled={!compare && choices.length < 2} onClick={() => { if (!compare) { setLeft(first); setRight(second); } setCompare(!compare); if (!compare) setTrailHidden(true); }}>{compare ? 'Single evidence' : 'Compare evidence'}</button></div>

        <ImportContext path={path} />
        {diskError && <p className="bad" role="alert">{diskError}</p>}
        {choices.length > 0 ? <div className={`file-evidence-columns${compare ? ' paired' : ''}`}>
          <EvidenceColumn choices={choices} value={first} choose={(key) => setLeft(choices.find((item) => item.key === key))} label="First evidence" path={path} />
          {compare && <EvidenceColumn choices={choices} value={second} choose={(key) => setRight(choices.find((item) => item.key === key))} label="Second evidence" path={path} />}
        </div> : page && <p className="muted">No source bytes or patch were captured for these actions. Open an action to inspect the evidence that is available.</p>}
      </section>
    </div>
  </ReadingDialog>;
}

function EvidenceColumn({ choices, value, choose, label, path }: { choices: FileEvidence[]; value?: FileEvidence; choose: (key: string) => void; label: string; path: string }) {
  return <section className="file-evidence-column"><label><span className="muted small">{label}</span><select aria-label={label} value={value?.key ?? ''} onChange={(e) => choose(e.target.value)}>{choices.map((item) => <option key={item.key} value={item.key}>{item.operation.title} · {item.label}</option>)}</select></label>
    {value && <div key={value.key} className="file-evidence-material">
      <p className="small">{value.label}</p>
      {value.snippet !== undefined ? <>
        <p className="muted small">Exact captured search result · surrounding file was not captured by this result{value.startLine === undefined ? ' · line number not reported' : ''}</p>
        {value.startLine === undefined ? <Output text={value.snippet} /> : <CodeView text={value.snippet} path={path} startLine={value.startLine} />}
      </> : value.patch && value.operation.detail.kind === 'edit' ? <DiffReader hunks={value.operation.detail.hunks} path={path} navigationKey={`${label}/${value.key}`} /> : <ArtifactReader id={value.artifactId} kind="code" path={path} startLine={value.startLine} navigationSlot={label} provenance />}
      {value.operation.kind === 'edit' && <VerificationPanel op={value.operation} onOpen={(id) => { const state = useApp.getState(); state.select(id); state.set({ filePanel: undefined, explore: false }); }} />}
    </div>}
  </section>;
}
