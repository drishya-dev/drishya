import { useEffect, useMemo, useState } from 'react';
import type { Operation, Projection } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { fileEvidence, type FileEvidence } from '../lib/file-evidence.ts';
import { agentName, KIND_LABEL } from '../lib/identity.ts';
import { ArtifactReader, DiffReader } from './ArtifactReader.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import { VerificationPanel } from './Verification.tsx';

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
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId)!;
  const mode = useApp((s) => s.mode);
  const step = useApp((s) => s.step);
  const revisions = useApp((s) => s.renderedRevisions);
  const [query, setQuery] = useState('');
  const [start, setStart] = useState(0);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; operations: Operation[]; total: number }>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [left, setLeft] = useState<FileEvidence>();
  const [right, setRight] = useState<FileEvidence>();
  const [compare, setCompare] = useState(false);
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
  const choices = useMemo(() => {
    if (!page?.total) return [];
    const items = page.operations.flatMap((op) => fileEvidence(op, path));
    // Comparing distant moments retains two chosen references, never an unbounded trail.
    if (compare) for (const selected of [left, right]) {
      if (selected && !items.some((item) => item.key === selected.key)) items.push(selected);
    }
    return items;
  }, [page, path, compare, left, right]);
  const first = choices.find((item) => item.key === left?.key) ?? choices[0];
  const second = choices.find((item) => item.key === right?.key) ?? choices.at(-1);
  const close = () => useApp.setState({ filePanel: undefined });
  return <ReadingDialog title={`Work on ${path}`} close={close} className="file-workspace">
    <div className="file-workspace-intro"><code>{path}</code><span className="muted small">{page ? `${page.total} recorded actions` : 'Loading captured actions…'} · {mode === 'replay' ? 'Visible at this replay step' : 'Whole-recording history'}</span></div>
    <div className="file-workspace-layout">
      <nav className="file-trail" aria-label="File action history">
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
            <span className={`op-kind k-${op.kind}`}>{KIND_LABEL[op.kind]}</span><span className="file-op-title">{op.title}</span><small>{agentName(projection.agents.find((agent) => agent.id === op.agentId))} · {op.status === 'error' ? 'failed' : op.status === 'running' ? 'in flight' : op.status}</small>
          </button>{evidence.length > 0 && <button data-file-op={op.id} className="file-inspect" onClick={() => { const state = useApp.getState(); state.select(op.id); state.set({ filePanel: undefined, explore: false }); }}>Open in history ↗</button>}</div>;
        })}
        {page && page.total > 24 && <div className="file-pagination"><button className="btn" disabled={start === 0} onClick={() => setStart(Math.max(0, start - 24))}>Previous</button><span>{start + 1}–{Math.min(start + 24, page.total)} / {page.total}</span><button className="btn" disabled={start + 24 >= page.total} onClick={() => setStart(start + 24)}>Next</button></div>}
      </nav>
      <section className="file-evidence-reading" aria-label="File evidence">
        <div className="file-evidence-toolbar"><strong>Historical evidence</strong><button className="btn" aria-pressed={compare} disabled={!compare && choices.length < 2} onClick={() => { if (!compare) { setLeft(first); setRight(second); } setCompare(!compare); }}>{compare ? 'Single evidence' : 'Compare evidence'}</button></div>
        <p className="muted small">Read excerpts and file states recorded at different moments. Ranges may differ. No current source or inferred intermediate state is substituted.</p>
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
    {value && <div key={value.key} className="file-evidence-material"><p className="small">{value.label}</p>{value.patch && value.operation.detail.kind === 'edit' ? <DiffReader hunks={value.operation.detail.hunks} path={path} /> : <ArtifactReader id={value.artifactId} kind="code" path={path} startLine={value.startLine} provenance />}{value.operation.kind === 'edit' && <VerificationPanel op={value.operation} onOpen={(id) => { const state = useApp.getState(); state.select(id); state.set({ filePanel: undefined, explore: false }); }} />}</div>}
  </section>;
}
