import { useEffect, useRef, useState } from 'react';
import { redactText } from '../../../../packages/privacy/src/index.ts';
import { workspaceApi } from '../api.ts';
import type { GitSnapshot } from '../../../daemon/src/git-types.ts';
import { useApp } from '../state.ts';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { GitPatchReader } from './GitPatchReader.tsx';
import { FileIcon } from './FileIcon.tsx';
import { readReviewMarks, previousReviewNote, updateReviewMark, type ReviewMark } from '../lib/git-review-marks.ts';

function readMarks(key: string): Record<string, ReviewMark> {
  try { return readReviewMarks(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}

function GitBranchGlyph() {
  return <svg className="git-branch-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="19" r="2.5" /><path d="M6 7.5v9M18 8.5v1a6 6 0 0 1-6 6H6" /></svg>;
}

export function GitReviewEntry({ icon = false }: { icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useApp(s => s.recordingId);
  const eligible = useApp(s => s.source?.kind === 'daemon' && !s.recordingId?.includes('+'));
  return eligible ? <><button className="btn ghost git-open" aria-label="Git review" aria-expanded={open} onClick={() => setOpen(value => !value)}>{icon && <GitBranchGlyph />}Git review</button>{open && <GitReader key={id} close={() => setOpen(false)} />}</> : null;
}

function GitReader({ close }: { close: () => void }) {
  const id = useApp(s => s.recordingId)!;
  const source = useApp(s => s.source);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && useApp.getState().recordingId === id && useApp.getState().source === source;
  const { workspace, approve } = useSessionWorkspace();
  const [consent, setConsent] = useState(false);
  const [snapshot, setSnapshot] = useState<GitSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useWorkspaceState('git/selected', '');
  const [pageStart, setPageStart] = useWorkspaceState('git/page', 0);
  const key = `drishya-git-review-v1:${id}`;
  const [marks, setMarks] = useState(() => readMarks(key));
  const [packet, setPacket] = useState<string>();
  useEffect(() => { let active = true; void workspaceApi.gitStatus(id).then(s => { if (active) setConsent(s.approved); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id]);
  const refresh = async (start = snapshot?.pageStart ?? pageStart) => {
    setBusy(true); setError(undefined); setPacket(undefined);
    try { const next = await workspaceApi.gitSnapshot(id, start); if (current()) { setSnapshot(next); setPageStart(next.pageStart ?? 0); setSelected(path => next.files.some(f => f.path === path) ? path : next.files[0]?.path ?? ''); } }
    catch (e) { if (current()) setError((e as Error).message); }
    finally { if (current()) setBusy(false); }
  };
  useEffect(() => {
    if (document.documentElement.dataset.uiVersion === 'modern' && workspace?.approved && consent && !snapshot && !busy) void refresh();
  }, [workspace?.approved, consent]);
  const file = snapshot?.files.find(f => f.path === selected);
  const mark = file ? marks[file.path] : undefined;
  const exact = !!file && mark?.fingerprint === file.fingerprint;
  const previous = file ? previousReviewNote(mark, file.fingerprint) : undefined;
  const update = (patch: Partial<Pick<ReviewMark, 'note' | 'reviewed'>>) => {
    if (!file || file.status === '??' || busy || checking) return;
    setPacket(undefined);
    const next = Object.fromEntries(Object.entries({ ...marks, [file.path]: updateReviewMark(mark, file.fingerprint, patch) }).slice(-100));
    setMarks(next);
    try { localStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.entries(next).slice(-100)))); } catch { setError('Review progress could not be saved in this browser.'); }
  };
  const validate = async () => {
    const next = await workspaceApi.gitSnapshot(id, snapshot?.pageStart ?? 0);
    if (!current()) return;
    setSnapshot(next);
    setSelected(path => next.files.some(f => f.path === path) ? path : next.files[0]?.path ?? '');
    if (next.fingerprint !== snapshot?.fingerprint) {
      setPacket(undefined); setError('Repository changed. Inspect the refreshed changes before making a new handoff.'); return;
    }
    return next;
  };
  const handoff = async (saving = false) => {
    if (!snapshot || busy || checking) return;
    setChecking(true); setError(undefined);
    if (!saving) setPacket(undefined);
    try {
      const fresh = await validate();
      if (!fresh || !current()) return;
      if (saving && packet) {
        const url = URL.createObjectURL(new Blob([packet], { type: 'text/markdown' }));
        const link = document.createElement('a'); link.href = url; link.download = 'drishya-review.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (!saving) {
        const selected = fresh.files.filter(f => marks[f.path]?.reviewed && marks[f.path]?.fingerprint === f.fingerprint);
        const text = [`# Local Git review handoff`, `Current Git, sampled on ${fresh.sampledAt}`, `Branch: ${fresh.branch}\nHEAD: ${fresh.head}`, 'Rechecked sampled content, not an atomic filesystem snapshot, agent attribution or proof of test coverage.', `Scope: explicitly reviewed patches on the current page. ${fresh.omitted} paths outside this sample (other pages, protected or oversized content).`, ...selected.map(f => `## ${f.path}\nContent fingerprint: ${f.fingerprint}\nReview note: ${marks[f.path]?.note ?? ''}\n\n${f.patch}`)].join('\n\n');
        setPacket(redactText(text).text);
      }
    } catch (e) { if (current()) { setPacket(undefined); setError(`Handoff check failed: ${(e as Error).message}`); } }
    finally { if (current()) setChecking(false); }
  };
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  return <ReadingDialog title="Git review" close={close} modeless={modern} headerIcon={modern ? <GitBranchGlyph /> : undefined} className={`git-review-dialog${modern ? ' modern-git-drawer' : ''}`}>
    {modern && <div className="modern-git-context"><strong>{workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Selected workspace'}</strong><small>Read-only · current changes</small></div>}
    {!workspace?.approved ? <section><p>Inspect the selected workspace first. Git access has separate consent.</p><button className="btn" disabled={busy || checking} onClick={() => { setBusy(true); void approve().catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Approve current workspace</button></section> : !consent ? <section><p>Read branch, status and bounded staged / working-tree patches from this repository. No repository writes. This is current Git, separate from captured history.</p><button className="btn" disabled={busy || checking} onClick={() => { setBusy(true); void workspaceApi.approveGit(id).then(() => { setConsent(true); return refresh(); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Approve read-only Git</button></section> : <>
      <nav className="git-review-toolbar"><span>{snapshot ? `${snapshot.branch} · ${snapshot.head.slice(0, 10)}` : 'Current Git'}</span><button className="btn" disabled={busy || checking} onClick={() => void refresh()}>{busy ? 'Inspecting…' : 'Refresh changes'}</button><button className="btn" disabled={busy || checking || !snapshot?.files.some(f => marks[f.path]?.reviewed && marks[f.path]?.fingerprint === f.fingerprint)} onClick={() => void handoff()}>Preview handoff</button></nav>
      {checking && <p role="status">Checking reviewed content…</p>}
      {snapshot && <>
        {modern ? <details className="modern-git-scope"><summary>Current Git · separate from captured history</summary><p>Preview and save recheck content. Refresh to inspect new changes. Reviewed marks apply to this exact patch.</p></details> : <p className="git-scope-note">Current Git sample · Preview and save recheck content. Refresh to inspect new changes. Reviewed marks apply to this exact patch.</p>}
        {snapshot.totalAllowed !== undefined && snapshot.totalAllowed > snapshot.limit && <nav className="reader-pages git-file-pages" aria-label="Git file pages">
          <button className="btn" disabled={busy || checking || !snapshot.pageStart} onClick={() => void refresh(Math.max(0, (snapshot.pageStart ?? 0) - snapshot.limit))}>Previous files</button>
          <span>{(snapshot.pageStart ?? 0) + 1}–{Math.min((snapshot.pageStart ?? 0) + snapshot.limit, snapshot.totalAllowed)} of {snapshot.totalAllowed} eligible paths</span>
          <button className="btn" disabled={busy || checking || (snapshot.pageStart ?? 0) + snapshot.limit >= snapshot.totalAllowed} onClick={() => void refresh((snapshot.pageStart ?? 0) + snapshot.limit)}>Next files</button>
        </nav>}
        <div className="git-review-layout">
          <aside aria-label="Git changed files">
            {snapshot.files.map(f => <button key={f.path} disabled={busy || checking} aria-pressed={f.path === selected} onClick={() => { setSelected(f.path); setPacket(undefined); }}><FileIcon path={f.path} /><span>{f.path}</span><small>{marks[f.path]?.fingerprint === f.fingerprint && marks[f.path]?.reviewed ? 'Reviewed' : marks[f.path] ? 'Changed' : f.status}</small></button>)}
            {!snapshot.files.length && <p>No visible changes.</p>}
            {!!snapshot.protectedCount && <p>{snapshot.protectedCount} protected paths excluded.</p>}
            {snapshot.omissions?.map(item => <div className="git-omission" key={item.path}><strong>{item.path}</strong><span>{item.reason === 'content-limit' ? 'Patch exceeds remaining 1 MiB response budget' : 'Patch exceeds the Git process output limit'}</span><button className="btn ghost small" disabled={busy || checking} onClick={() => { close(); useApp.setState({ currentFile: item.path }); }}>Open current file instead</button></div>)}
            {snapshot.totalAllowed === undefined && snapshot.omitted > 0 && <p>{snapshot.omitted} paths omitted: protected or content / 50-file limit.</p>}
          </aside>
          <section>{file && <>
            <header><strong>{file.path}</strong><button className="btn" disabled={busy || checking} onClick={() => { close(); useApp.setState({ currentFile: file.path }); }}>Open on disk</button><button className="btn" disabled={busy || checking} onClick={() => { close(); useApp.setState({ filePanel: file.path, filePanelFocus: 'change' }); }}>Recorded work</button></header>
            <div className="git-patch"><GitPatchReader key={`${file.path}:${file.fingerprint}`} file={file} /></div>
            {file.status !== '??' && <footer>
              <label><input type="checkbox" disabled={busy || checking} checked={exact && !!mark?.reviewed} onChange={e => update({ reviewed: e.target.checked })} /> Reviewed displayed patch</label>
              <textarea aria-label="Local review note" disabled={busy || checking} placeholder="Review note (local, separate from agent evidence)" maxLength={2000} value={exact ? mark?.note ?? '' : ''} onChange={e => update({ note: e.target.value })} />
              {previous?.note && <details className="git-previous-note" key={`${file.path}:${previous.fingerprint}`}>
                <summary>Previous note · changed patch</summary>
                <p>This note belongs to an earlier patch. Reusing it does not mark this change reviewed.</p>
                <textarea aria-label="Previous patch review note" value={previous.note} readOnly />
                <button className="btn ghost" disabled={busy || checking} onClick={() => update({ note: previous.note, reviewed: false })}>Use previous note as draft</button>
              </details>}
            </footer>}
          </>}</section>
        </div>
      </>}
    </>}
    {error && <p role="alert">{error}</p>}
    {packet && <section className="handoff-preview"><h3>Review this text before sharing</h3><p>Only this page’s explicitly reviewed patches and notes are included. Saving checks the repository again. Pattern redaction is best effort.</p><textarea aria-label="Handoff preview" value={packet} readOnly /><button className="btn" disabled={busy || checking} onClick={() => void handoff(true)}>Save handoff</button></section>}
  </ReadingDialog>;
}
