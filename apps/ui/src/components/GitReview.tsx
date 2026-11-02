import {FileReadingActions} from './FileReadingActions.tsx';
import {collectionBounds} from '../lib/collection-bounds.ts';
import './collection-surfaces.css';
import {openGitHistory} from './GitHistory.tsx';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { redactText } from '../../../../packages/privacy/src/index.ts';
import { workspaceApi } from '../api.ts';
import type { GitSnapshot } from '../../../daemon/src/git-types.ts';
import { useApp } from '../state.ts';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { GitPatchReader } from './GitPatchReader.tsx';
import { FileIcon } from './FileIcon.tsx';
import { InterfaceGlyph } from './InterfaceGlyph.tsx';
import { WorkspaceOptions } from './WorkspaceOptions.tsx';
import './git-review-controls.css';
import { GitAccess, grantGit } from './GitAccess.tsx';
import { ReadingResize } from './ReadingResize.tsx';
import { readReviewMarks, previousReviewNote, updateReviewMark, type ReviewMark } from '../lib/git-review-marks.ts';

function readMarks(key: string): Record<string, ReviewMark> {
  try { return readReviewMarks(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}

function GitBranchGlyph() {
  return <svg className="git-branch-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="19" r="2.5" /><path d="M6 7.5v9M18 8.5v1a6 6 0 0 1-6 6H6" /></svg>;
}

export const openGitReview = () => window.dispatchEvent(new Event('drishya-git-review'));

/** The reader owner stays mounted while its one trigger moves between header and fallback row. */
export function GitReviewEntry({ icon = false, slot }: { icon?: boolean; slot?: Element | null }) {
  const [open, setOpen] = useWorkspaceState('git/open', false);
  const [choices, setChoices] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), popover = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const id = useApp(s => s.recordingId), source = useApp(s => s.source), mode = useApp(s => s.mode);
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const eligible = source?.kind === 'daemon' && !!id && !id.includes('+') && (!modern || mode === 'history');
  const reason = 'Git needs a single local session in history';
  const dismiss = () => popover.current?.hidePopover();
  const chooseReview = () => { dismiss(); trigger.current?.focus({ preventScroll: true }); setOpen(true); };
  useEffect(() => {
    const close = () => setOpen(false);
    const review = () => { const state = useApp.getState(); if (state.source?.kind === 'daemon' && state.recordingId && !state.recordingId.includes('+') && state.mode === 'history') chooseReview(); };
    window.addEventListener('drishya-git-history', close);
    window.addEventListener('drishya-git-review', review);
    return () => { window.removeEventListener('drishya-git-history', close); window.removeEventListener('drishya-git-review', review); };
  }, [setOpen]);
  useEffect(() => { dismiss(); if (modern && !eligible) setOpen(false); }, [id, source, mode]);
  useEffect(() => {
    if (!choices) return;
    const place = () => { const box = trigger.current?.getBoundingClientRect(); if (box) setPosition({ top: box.bottom + 6, left: Math.max(8, Math.min(innerWidth - 232, box.right - 224)) }); };
    place(); window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [choices, slot]);
  const button = modern ? <button ref={trigger} className="btn ghost git-open" aria-label="Git" title={eligible ? 'Git: current changes or branches and commits' : reason} aria-describedby={!eligible ? popoverId + '-reason' : undefined} aria-expanded={choices} aria-controls={popoverId} disabled={!eligible} onClick={event => {
    const box = event.currentTarget.getBoundingClientRect(); setPosition({ top: box.bottom + 6, left: Math.max(8, Math.min(innerWidth - 232, box.right - 224)) });
    const keyboard = event.detail === 0; popover.current?.togglePopover();
    if (keyboard) requestAnimationFrame(() => popover.current?.querySelector<HTMLButtonElement>('button')?.focus());
  }}>{icon && <GitBranchGlyph />}Git</button> : <button className="btn ghost git-open" aria-label="Git review" aria-expanded={open} onClick={() => setOpen(value => !value)}>{icon && <GitBranchGlyph />}Git review</button>;
  if (!modern && !eligible) return null;
  return <>{slot ? createPortal(button, slot) : button}{modern && createPortal(<>
    {!eligible && <span className="sr-only" id={popoverId + '-reason'}>{reason}</span>}
    <div ref={popover} id={popoverId} popover="auto" className="git-entry-choices" aria-label="Git destinations" style={position} onToggle={event => setChoices(event.newState === 'open')} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); trigger.current?.focus(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')], current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    }}><button aria-label="Git review" onClick={chooseReview}><strong>Git review</strong><small>Current changes</small></button><button aria-label="Git graph" onClick={() => { dismiss(); trigger.current?.focus({ preventScroll: true }); openGitHistory(); }}><strong>Git graph</strong><small>Branches and commits</small></button></div>
  </>, document.body)}{eligible && open && <GitReader key={id} close={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }} />}</>;
}

function GitReader({ close }: { close: () => void }) {
  const id = useApp(s => s.recordingId)!;
  const source = useApp(s => s.source);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && useApp.getState().recordingId === id && useApp.getState().source === source;
  const { workspace, approve } = useSessionWorkspace();
  const [consent, setConsent] = useState<boolean>();
  const [snapshot, setSnapshot] = useState<GitSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useWorkspaceState('git/selected', '');
  const [pageStart, setPageStart] = useWorkspaceState('git/page', 0);
  const [width, setWidth] = useWorkspaceState('git/width', 680);
  const [filesHidden, setFilesHidden] = useWorkspaceState('git/filesHidden', false);
  const [viewport, setViewport] = useState(() => innerWidth);
  useEffect(() => { const resized = () => setViewport(innerWidth); window.addEventListener('resize', resized); return () => window.removeEventListener('resize', resized); }, []);
  const maximumWidth = Math.max(420, Math.min(1200, viewport - 32));
  const readingWidth = Math.max(420, Math.min(maximumWidth, width));
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
  const fileBounds=collectionBounds((snapshot?.files.length??0)+(snapshot?.omissions?.length??0),6,44);
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
  const workspaceName = workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Selected workspace';
  const canHandoff = !busy && !checking && !!snapshot?.files.some(f => marks[f.path]?.reviewed && marks[f.path]?.fingerprint === f.fingerprint);
  return <ReadingDialog title="Git review" windowId="Git review" resetWindow={()=>{setWidth(680);setFilesHidden(false);}} close={close} modeless={modern} headerIcon={modern ? <GitBranchGlyph /> : undefined} style={modern ? {'--git-reader-width': `${readingWidth}px`} as CSSProperties : undefined} resizeControl={modern ? <ReadingResize value={readingWidth} minimum={420} maximum={maximumWidth} change={setWidth} reset={()=>setWidth(680)} label="Resize Git reading space" fromRight /> : undefined} className={`git-review-dialog${modern ? ' modern-git-drawer' : ''}`}>
    {!modern && <div className="git-history-entry"><button className="btn ghost" disabled={busy||checking} onClick={()=>{close();requestAnimationFrame(openGitHistory);}}>Branches &amp; commits ↗</button></div>}
    {modern && (!workspace?.approved || !consent) && <div className="modern-git-context"><strong>{workspaceName}</strong><small>Read-only · current changes</small></div>}
    {consent === undefined && !error ? <section aria-busy="true"><p>Checking Git access…</p></section> : !workspace?.approved || !consent ? <GitAccess workspaceApproved={!!workspace?.approved} busy={busy} disabled={busy || checking} grant={() => { setBusy(true); void grantGit(id, !!workspace?.approved, approve).then(() => { setConsent(true); return refresh(); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }} /> : <>
      {modern ? <nav className="git-review-toolbar git-review-compact" aria-label="Git review controls">
        <div className="git-review-identity"><strong title={workspace?.root}>{workspaceName}</strong><span title={snapshot ? `${snapshot.branch} · ${snapshot.head}` : 'Current Git'}>{snapshot ? `${snapshot.branch} · ${snapshot.head.slice(0, 10)}` : 'Current Git'}</span><small>Read-only · current changes</small></div>
        {snapshot && <button className="btn git-file-toggle" aria-expanded={!filesHidden} aria-controls="git-changed-files" onClick={() => setFilesHidden(!filesHidden)} title={filesHidden ? 'Show changed files' : 'Hide changed files'}><InterfaceGlyph name="folder"/>Files <span>{snapshot.files.length}</span></button>}
        <button className="btn git-refresh-control" aria-label="Refresh changes" aria-busy={busy} title={busy ? 'Inspecting changes…' : 'Refresh changes'} disabled={busy || checking} onClick={() => void refresh()}><InterfaceGlyph name="refresh"/></button>
        <WorkspaceOptions label="Git review actions">
          <button className="btn ghost" disabled={!canHandoff} onClick={() => void handoff()}>Preview handoff</button>
          <button className="btn ghost" disabled={busy || checking || !file} onClick={() => { if (!file) return; close(); useApp.getState().set({ filePanel: file.path, filePanelFocus: 'change' }); }}>Recorded work</button>
          <button className="btn ghost" disabled={busy || checking} onClick={() => { close(); requestAnimationFrame(openGitHistory); }}>Branches &amp; commits ↗</button>
          <p className="git-review-menu-note">Current Git is separate from captured history. Reviewed marks apply to this exact patch; preview and save recheck content.</p>
        </WorkspaceOptions>
      </nav> : <nav className="git-review-toolbar"><span>{snapshot ? `${snapshot.branch} · ${snapshot.head.slice(0, 10)}` : 'Current Git'}</span><button className="btn" disabled={busy || checking} onClick={() => void refresh()}>{busy ? 'Inspecting…' : 'Refresh changes'}</button><button className="btn" disabled={busy || checking || !snapshot?.files.some(f => marks[f.path]?.reviewed && marks[f.path]?.fingerprint === f.fingerprint)} onClick={() => void handoff()}>Preview handoff</button></nav>}
      {checking && <p role="status">Checking reviewed content…</p>}
      {snapshot && <>
        {!modern && <p className="git-scope-note">Current Git sample · Preview and save recheck content. Refresh to inspect new changes. Reviewed marks apply to this exact patch.</p>}
        {snapshot.totalAllowed !== undefined && snapshot.totalAllowed > snapshot.limit && <nav className="reader-pages git-file-pages" aria-label="Git file pages">
          <button className="btn" disabled={busy || checking || !snapshot.pageStart} onClick={() => void refresh(Math.max(0, (snapshot.pageStart ?? 0) - snapshot.limit))}>Previous files</button>
          <span>{(snapshot.pageStart ?? 0) + 1}–{Math.min((snapshot.pageStart ?? 0) + snapshot.limit, snapshot.totalAllowed)} of {snapshot.totalAllowed} eligible paths</span>
          <button className="btn" disabled={busy || checking || (snapshot.pageStart ?? 0) + snapshot.limit >= snapshot.totalAllowed} onClick={() => void refresh((snapshot.pageStart ?? 0) + snapshot.limit)}>Next files</button>
        </nav>}
        <div className={`git-review-layout${modern && filesHidden ? ' git-files-hidden' : ''}`}>
          <aside id="git-changed-files" data-size={modern?fileBounds.state:undefined} style={modern&&fileBounds.maxBlockSize?{'--collection-cap':`${fileBounds.maxBlockSize}px`} as CSSProperties:undefined} hidden={modern && filesHidden} aria-label="Git changed files">
            {snapshot.files.map(f => <button key={f.path} title={f.path} disabled={busy || checking} aria-pressed={f.path === selected} onClick={() => { setSelected(f.path); setPacket(undefined); }}><FileIcon path={f.path} /><span className="git-file-name">{modern ? <><strong>{f.path.split('/').at(-1)}</strong>{f.path.includes('/') && <small>{f.path.slice(0, f.path.lastIndexOf('/'))}</small>}</> : f.path}</span><small>{marks[f.path]?.fingerprint === f.fingerprint && marks[f.path]?.reviewed ? 'Reviewed' : marks[f.path] ? 'Changed' : f.status}</small></button>)}
            {!snapshot.files.length && <p>No visible changes.</p>}
            {!!snapshot.protectedCount && <p>{snapshot.protectedCount} protected paths excluded.</p>}
            {snapshot.omissions?.map(item => <div className="git-omission" key={item.path}><strong>{item.path}</strong><span>{item.reason === 'content-limit' ? 'Patch exceeds remaining 1 MiB response budget' : 'Patch exceeds the Git process output limit'}</span><button className="btn ghost small" disabled={busy || checking} onClick={() => { close(); useApp.setState({ currentFile: item.path }); }}>Open current file instead</button></div>)}
            {snapshot.totalAllowed === undefined && snapshot.omitted > 0 && <p>{snapshot.omitted} paths omitted: protected or content / 50-file limit.</p>}
          </aside>
          <section>{file && <>
            <header className={modern ? 'git-selected-file-header' : undefined}><strong title={file.path}>{file.path}</strong><FileReadingActions path={file.path} compact onNavigate={close}/><button className="btn" disabled={busy || checking} onClick={() => { close(); useApp.getState().set({ currentFile: file.path }); }}>Open on disk</button>{!modern && <button className="btn" disabled={busy || checking} onClick={() => { close(); useApp.getState().set({ filePanel: file.path, filePanelFocus: 'change' }); }}>Recorded work</button>}</header>
            <div className="git-patch"><GitPatchReader key={`${file.path}:${file.fingerprint}`} file={file} openRecorded={(path, key) => { close(); useApp.getState().set({ filePanel: path, filePanelFocus: 'change', filePanelEvidence: key }); }} /></div>
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
