import { useEffect, useState } from 'react';
import { redactText } from '../../../../packages/privacy/src/index.ts';
import { workspaceApi } from '../api.ts';
import type { GitSnapshot } from '../../../daemon/src/git-types.ts';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { GitPatchReader } from './GitPatchReader.tsx';
import { FileIcon } from './FileIcon.tsx';
import { readReviewMarks, previousReviewNote, updateReviewMark, type ReviewMark } from '../lib/git-review-marks.ts';

function readMarks(key: string): Record<string, ReviewMark> {
  try { return readReviewMarks(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}

export function GitReviewEntry() {
  const [open, setOpen] = useState(false);
  const id = useApp(s => s.recordingId);
  const eligible = useApp(s => s.source?.kind === 'daemon' && !s.recordingId?.includes('+'));
  return eligible ? <><button className="btn ghost git-open" onClick={() => setOpen(true)}>Git review</button>{open && <GitReader key={id} close={() => setOpen(false)} />}</> : null;
}

function GitReader({ close }: { close: () => void }) {
  const id = useApp(s => s.recordingId)!;
  const { workspace, approve } = useSessionWorkspace();
  const [consent, setConsent] = useState(false);
  const [snapshot, setSnapshot] = useState<GitSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const key = `drishya-git-review-v1:${id}`;
  const [marks, setMarks] = useState(() => readMarks(key));
  const [packet, setPacket] = useState<string>();
  useEffect(() => { let active = true; void workspaceApi.gitStatus(id).then(s => { if (active) setConsent(s.approved); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id]);
  const refresh = async (start = snapshot?.pageStart ?? 0) => {
    setBusy(true); setError(undefined); setPacket(undefined);
    try { const next = await workspaceApi.gitSnapshot(id, start); setSnapshot(next); setSelected(path => next.files.some(f => f.path === path) ? path : next.files[0]?.path ?? ''); }
    catch (e) { setError((e as Error).message); setSnapshot(undefined); }
    finally { setBusy(false); }
  };
  const file = snapshot?.files.find(f => f.path === selected);
  const mark = file ? marks[file.path] : undefined;
  const exact = !!file && mark?.fingerprint === file.fingerprint;
  const previous = file ? previousReviewNote(mark, file.fingerprint) : undefined;
  const update = (patch: Partial<Pick<ReviewMark, 'note' | 'reviewed'>>) => {
    if (!file || file.status === '??') return;
    const next = Object.fromEntries(Object.entries({ ...marks, [file.path]: updateReviewMark(mark, file.fingerprint, patch) }).slice(-100));
    setMarks(next);
    try { localStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.entries(next).slice(-100)))); } catch { setError('Review progress could not be saved in this browser.'); }
  };
  const preview = () => {
    if (!snapshot) return;
    const selected = snapshot.files.filter(f => marks[f.path]?.reviewed && marks[f.path]?.fingerprint === f.fingerprint);
    const text = [`# Local Git review handoff`, `Current Git, sampled on ${new Date().toISOString()}`, `Branch: ${snapshot.branch}\nHEAD: ${snapshot.head}`, 'These are current Git changes, not attribution to a recorded agent or proof of test coverage.', ...selected.map(f => `## ${f.path}\nContent fingerprint: ${f.fingerprint}\nReview note: ${marks[f.path]?.note ?? ''}\n\n${f.patch}`)].join('\n\n');
    setPacket(redactText(text).text);
  };
  return <ReadingDialog title="Git review" close={close} className="git-review-dialog">
    {!workspace?.approved ? <section><p>Inspect the selected workspace first. Git access has separate consent.</p><button className="btn" disabled={busy} onClick={() => { setBusy(true); void approve().catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Approve current workspace</button></section> : !consent ? <section><p>Read branch, status and bounded staged / working-tree patches from this repository. No repository writes. This is current Git, separate from captured history.</p><button className="btn" onClick={() => { setBusy(true); void workspaceApi.approveGit(id).then(() => { setConsent(true); return refresh(); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Approve read-only Git</button></section> : <>
      <nav className="git-review-toolbar"><span>{snapshot ? `${snapshot.branch} · ${snapshot.head.slice(0, 10)}` : 'Current Git'}</span><button className="btn" disabled={busy} onClick={() => void refresh()}>{busy ? 'Inspecting…' : 'Refresh changes'}</button><button className="btn" disabled={!snapshot?.files.some(f => marks[f.path]?.reviewed && marks[f.path]?.fingerprint === f.fingerprint)} onClick={preview}>Preview handoff</button></nav>
      {snapshot && <>
        <p className="git-scope-note">Current Git sample · Refresh before sharing. Reviewed marks apply to this exact patch.</p>
        {snapshot.totalAllowed !== undefined && snapshot.totalAllowed > snapshot.limit && <nav className="reader-pages git-file-pages" aria-label="Git file pages">
          <button className="btn" disabled={busy || !snapshot.pageStart} onClick={() => void refresh(Math.max(0, (snapshot.pageStart ?? 0) - snapshot.limit))}>Previous files</button>
          <span>{(snapshot.pageStart ?? 0) + 1}–{Math.min((snapshot.pageStart ?? 0) + snapshot.limit, snapshot.totalAllowed)} of {snapshot.totalAllowed} eligible paths</span>
          <button className="btn" disabled={busy || (snapshot.pageStart ?? 0) + snapshot.limit >= snapshot.totalAllowed} onClick={() => void refresh((snapshot.pageStart ?? 0) + snapshot.limit)}>Next files</button>
        </nav>}
        <div className="git-review-layout">
          <aside aria-label="Git changed files">
            {snapshot.files.map(f => <button key={f.path} aria-pressed={f.path === selected} onClick={() => { setSelected(f.path); setPacket(undefined); }}><FileIcon path={f.path} /><span>{f.path}</span><small>{marks[f.path]?.fingerprint === f.fingerprint && marks[f.path]?.reviewed ? 'Reviewed' : marks[f.path] ? 'Changed' : f.status}</small></button>)}
            {!snapshot.files.length && <p>No visible changes.</p>}
            {!!snapshot.protectedCount && <p>{snapshot.protectedCount} protected paths excluded.</p>}
            {snapshot.omissions?.map(item => <div className="git-omission" key={item.path}><strong>{item.path}</strong><span>{item.reason === 'content-limit' ? 'Patch exceeds remaining 1 MiB response budget' : 'Patch exceeds the Git process output limit'}</span><button className="btn ghost small" onClick={() => { close(); useApp.setState({ currentFile: item.path }); }}>Open current file instead</button></div>)}
            {snapshot.totalAllowed === undefined && snapshot.omitted > 0 && <p>{snapshot.omitted} paths omitted: protected or content / 50-file limit.</p>}
          </aside>
          <section>{file && <>
            <header><strong>{file.path}</strong><button className="btn" onClick={() => { close(); useApp.setState({ currentFile: file.path }); }}>Open on disk</button><button className="btn" onClick={() => { close(); useApp.setState({ filePanel: file.path, filePanelFocus: 'change' }); }}>Recorded work</button></header>
            <div className="git-patch"><GitPatchReader key={`${file.path}:${file.fingerprint}`} file={file} /></div>
            {file.status !== '??' && <footer>
              <label><input type="checkbox" checked={exact && !!mark?.reviewed} onChange={e => update({ reviewed: e.target.checked })} /> Reviewed displayed patch</label>
              <textarea aria-label="Local review note" placeholder="Review note (local, separate from agent evidence)" maxLength={2000} value={exact ? mark?.note ?? '' : ''} onChange={e => update({ note: e.target.value })} />
              {previous?.note && <details className="git-previous-note" key={`${file.path}:${previous.fingerprint}`}>
                <summary>Previous note · changed patch</summary>
                <p>This note belongs to an earlier patch. Reusing it does not mark this change reviewed.</p>
                <textarea aria-label="Previous patch review note" value={previous.note} readOnly />
                <button className="btn ghost" onClick={() => update({ note: previous.note, reviewed: false })}>Use previous note as draft</button>
              </details>}
            </footer>}
          </>}</section>
        </div>
      </>}
    </>}
    {error && <p role="alert">{error}</p>}
    {packet && <section className="handoff-preview"><h3>Review this text before sharing</h3><p>Only explicitly reviewed patches and their notes are included. Pattern redaction is best effort.</p><textarea aria-label="Handoff preview" value={packet} readOnly /><button className="btn" onClick={() => { const url = URL.createObjectURL(new Blob([packet], { type: 'text/markdown' })); const link = document.createElement('a'); link.href = url; link.download = 'drishya-review.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Save handoff</button></section>}
  </ReadingDialog>;
}
