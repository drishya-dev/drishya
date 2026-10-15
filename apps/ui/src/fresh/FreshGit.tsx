import { useEffect, useRef, useState } from 'react';
import { redactText } from '../../../../packages/privacy/src/index.ts';
import { CodeTokens } from './CodeTokens.tsx';
import type { FreshApi, GitSnapshot, WorkspaceState } from './api.ts';

interface Mark { fingerprint: string; reviewed: boolean; note: string }
function savedMarks(key: string): Record<string, Mark> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, mark]) => mark && typeof mark.fingerprint === 'string' && typeof mark.reviewed === 'boolean' && typeof mark.note === 'string' && mark.note.length <= 2000).slice(0, 100));
  } catch { return {}; }
}

/** Current Git remains a separate, explicitly permitted sample with exact-content reviews. */
export function FreshGit({ api, recordingId, onError }: { api: FreshApi; recordingId: string; onError: (error?: string) => void }) {
  const key = `drishya-fresh-git-v1:${recordingId}`;
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [approved, setApproved] = useState(false);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<GitSnapshot>();
  const [selected, setSelected] = useState('');
  const [marks, setMarks] = useState(() => savedMarks(key));
  const [busy, setBusy] = useState(false);
  const [packet, setPacket] = useState<string>();
  const [lineStart, setLineStart] = useState(0);
  const [find, setFind] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const apply = (sample: GitSnapshot) => {
    setSnapshot(sample); setSelected(path => sample.files.some(file => file.path === path) ? path : sample.files[0]?.path ?? '');
  };
  const run = async (job: () => Promise<void>) => {
    if (busy) return; setBusy(true); onError(undefined);
    try { await job(); } catch (error) { if (alive.current) { setPacket(undefined); onError(error instanceof Error ? error.message : 'Git inspection could not finish.'); } }
    finally { if (alive.current) setBusy(false); }
  };
  const refresh = (start = snapshot?.pageStart ?? 0) => run(async () => {
    setPacket(undefined); const sample = await api.git(recordingId, start); if (alive.current) apply(sample);
  });
  useEffect(() => {
    let current = true;
    void Promise.all([api.workspace(recordingId), api.gitStatus(recordingId)]).then(async ([root, git]) => {
      if (!current || !alive.current) return; setWorkspace(root); setApproved(git.approved); setReady(true);
      if (git.approved) { setBusy(true); const sample = await api.git(recordingId); if (current && alive.current) { apply(sample); setBusy(false); } }
    }).catch(error => { if (current && alive.current) { setBusy(false); onError(error.message); } });
    return () => { current = false; };
  }, [api, recordingId]);
  const file = snapshot?.files.find(item => item.path === selected);
  const previous = file ? marks[file.path] : undefined;
  const exact = !!file && previous?.fingerprint === file.fingerprint;
  useEffect(() => { setLineStart(0); setFind(''); }, [file?.path, file?.fingerprint]);
  const update = (patch: Partial<Mark>) => {
    if (!file || busy || file.status === '??') return;
    if (!marks[file.path] && Object.keys(marks).length >= 100) { onError('This browser has 100 file reviews for this recording. Export your handoff before starting another review.'); return; }
    const next = { ...marks, [file.path]: { fingerprint: file.fingerprint, reviewed: exact && !!previous?.reviewed, note: exact ? previous?.note ?? '' : '', ...patch } };
    try { localStorage.setItem(key, JSON.stringify(next)); setMarks(next); setPacket(undefined); }
    catch { onError('Review progress could not be saved in this browser. Copy your note before leaving.'); }
  };
  const handoff = (download: boolean) => run(async () => {
    if (!snapshot) return;
    const fresh = await api.git(recordingId, snapshot.pageStart ?? 0); if (!alive.current) return;
    apply(fresh);
    if (fresh.fingerprint !== snapshot.fingerprint) { setPacket(undefined); throw new Error('Repository changed. Inspect the refreshed patches before preparing a handoff.'); }
    if (download && packet) {
      const url = URL.createObjectURL(new Blob([packet], { type: 'text/markdown' }));
      const link = document.createElement('a'); link.href = url; link.download = 'drishya-review.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
    }
    const reviewed = fresh.files.filter(item => marks[item.path]?.reviewed && marks[item.path]?.fingerprint === item.fingerprint);
    const text = ['# Local Git review handoff', `Current Git sampled ${fresh.sampledAt}`, `Branch: ${fresh.branch}\nHEAD: ${fresh.head}`, 'Revalidated optimistic sample, not an atomic filesystem snapshot, agent attribution or proof of coverage.', `Scope: ${reviewed.length} explicitly reviewed patches from this page; ${fresh.omitted} other/protected/oversized paths outside the sample.`, ...reviewed.map(item => `## ${item.path}\n\nReview note: ${marks[item.path]?.note ?? ''}\nContent fingerprint: ${item.fingerprint}\n\n${item.patch}`)].join('\n\n');
    setPacket(redactText(text).text);
  });
  const lines = file?.patch.split('\n') ?? [];
  const findNext = () => {
    if (!find.trim()) return;
    const indexes = lines.flatMap((line, index) => line.toLowerCase().includes(find.toLowerCase()) ? [index] : []);
    if (!indexes.length) { onError('No match in this sampled patch.'); return; }
    setLineStart(Math.floor((indexes.find(index => index >= lineStart + 180) ?? indexes[0]!) / 180) * 180);
  };
  if (!ready) return <div className="fr-git-view" role="status">Checking workspace permissions…</div>;
  if (!approved) return <div className="fr-git-view"><div className="fr-consent"><h3>{workspace?.approved ? 'Review the working tree' : 'Allow workspace reading first'}</h3><p>{workspace?.approved ? 'Read current branch, status and patches. Git remains separate from captured history.' : 'Read only this session’s captured workspace. Git inspection requires separate permission next.'}</p>{workspace?.root ? <code>{workspace.root}</code> : <p>No captured workspace is available on this machine.</p>}<button className="fr-button fr-button-primary" disabled={busy || !workspace?.root} onClick={() => void run(async () => { if (!workspace?.approved) { const root = await api.workspaceApprove(recordingId); if (alive.current) setWorkspace(root); } else { await api.gitApprove(recordingId); if (!alive.current) return; setApproved(true); const sample = await api.git(recordingId); if (alive.current) apply(sample); } })}>{busy ? 'Checking…' : workspace?.approved ? 'Allow read-only Git' : 'Allow this workspace'}</button></div></div>;
  return <div className="fr-git-view">
    <div className="fr-git-heading"><div><strong>{snapshot?.branch ?? 'Current Git'}</strong><span>{snapshot?.head.slice(0, 10)}</span></div><button className="fr-button" disabled={busy} onClick={() => void refresh()}>Refresh snapshot</button><button className="fr-button" disabled={busy || !snapshot?.files.some(item => marks[item.path]?.reviewed && marks[item.path]?.fingerprint === item.fingerprint)} onClick={() => void handoff(false)}>Preview handoff</button></div>
    <p className="fr-muted">Current Git · {snapshot ? new Date(snapshot.sampledAt).toLocaleTimeString() : 'Waiting for a sample'} · exact-content review marks</p>
    {busy && <p role="status">Checking current Git…</p>}
    <div className="fr-git-body"><div className="fr-git-files">{snapshot?.files.map(item => <button key={item.path} disabled={busy} className={item.path === selected ? 'is-active' : ''} onClick={() => { setSelected(item.path); setPacket(undefined); }}><span>{marks[item.path]?.fingerprint === item.fingerprint && marks[item.path]?.reviewed ? '✓' : item.status}</span>{item.path}</button>)}</div>
      <div className="fr-git-patch">{file ? <><div className="fr-git-file-heading"><strong>{file.path}</strong></div><form className="fr-git-find" onSubmit={event => { event.preventDefault(); findNext(); }}><input aria-label="Find current Git patch" placeholder="Find in this patch…" value={find} onChange={event => setFind(event.target.value)} /><button className="fr-button" type="submit">Next match</button></form><div className="fr-code-material" role="region" aria-label="Current Git patch">{lines.slice(lineStart, lineStart + 180).map((line, index) => <div key={lineStart + index} className={line.startsWith('+') ? 'fr-code-add' : line.startsWith('-') ? 'fr-code-remove' : ''}><code><CodeTokens text={line || ' '} /></code></div>)}</div>{lines.length > 180 && <div className="fr-reader-paging"><button className="fr-button" disabled={!lineStart} onClick={() => setLineStart(start => Math.max(0, start - 180))}>Previous patch lines</button><span>{lineStart + 1}–{Math.min(lineStart + 180, lines.length)} of {lines.length} patch lines</span><button className="fr-button" disabled={lineStart + 180 >= lines.length} onClick={() => setLineStart(start => start + 180)}>Next patch lines</button></div>}
      {file.status !== '??' && <div className="fr-git-review-note"><label><input type="checkbox" disabled={busy} checked={exact && !!previous?.reviewed} onChange={event => update({ reviewed: event.target.checked })} />Reviewed displayed patch</label><textarea aria-label="Local Git review note" maxLength={2000} disabled={busy} value={exact ? previous?.note ?? '' : ''} placeholder="Your note about this exact patch…" onChange={event => update({ note: redactText(event.target.value).text })} />{!exact && previous?.note && <details><summary>Previous note · changed content</summary><p>{previous.note}</p><button className="fr-button" disabled={busy} onClick={() => update({ note: previous.note, reviewed: false })}>Use as draft</button></details>}</div>}</> : <p className="fr-muted">{busy ? 'Reading patches…' : 'No visible changes in this page.'}</p>}</div></div>
    {snapshot?.omissions?.map(item => <p className="fr-warning-text" key={item.path}>{item.path} · {item.reason === 'content-limit' ? 'Response content budget reached' : 'Git output limit reached'}</p>)}
    {snapshot && <div className="fr-reader-paging"><button className="fr-button" disabled={busy || !snapshot.pageStart} onClick={() => void refresh(Math.max(0, (snapshot.pageStart ?? 0) - snapshot.limit))}>Previous file page</button><span>{snapshot.totalAllowed ?? snapshot.files.length} eligible files · {snapshot.omitted} outside sample</span><button className="fr-button" disabled={busy || (snapshot.pageStart ?? 0) + snapshot.limit >= (snapshot.totalAllowed ?? snapshot.files.length)} onClick={() => void refresh((snapshot.pageStart ?? 0) + snapshot.limit)}>Next file page</button></div>}
    {packet && <section className="fr-git-handoff"><h3>Preview before sharing</h3><textarea aria-label="Git handoff preview" readOnly value={packet} /><button className="fr-button fr-button-primary" disabled={busy} onClick={() => void handoff(true)}>Save checked handoff</button></section>}
  </div>;
}
