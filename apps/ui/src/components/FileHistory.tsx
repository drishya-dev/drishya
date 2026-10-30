import {currentWorkspacePath} from '../lib/worktree-files.ts';
import {rememberCurrentFileOrigin} from '../lib/current-file-origin.ts';
import {useFileRoots} from '../lib/use-file-roots.ts';
import { fileOperationPage, type FileOperationPage, type FileStepTarget } from '../../../../packages/scene/src/file-timeline.ts';
import './file-reader-controls.css';
import { WorkspaceOptions } from './WorkspaceOptions.tsx';
import {CapturedSourceComparison} from './CapturedSourceComparison.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Projection } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { fileEvidence, type FileEvidence } from '../lib/file-evidence.ts';
import { fileTimeline, timelineStep } from '../lib/file-timeline.ts';
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
  const roots=useFileRoots(projection.observationCount);
  const root=roots.find(root=>path.startsWith(root.prefix+'/'));
  const recordedLocation=root?`${root.root.replace(/[\\/]$/, '')}/${path.slice(root.prefix.length+1)}`:undefined;
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const focusChange = useApp(s => s.filePanelFocus === 'change');
  const preferred = useApp(s => s.filePanelEvidence);
  const requestedLine = useApp(s => s.filePanelLine);
  const explore = useApp(s => s.explore);
  const { workspace, approve } = useSessionWorkspace();
  const diskPath=currentWorkspacePath(path,roots,workspace?.root);
  const [diskError, setDiskError] = useState<string>();
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId)!;
  const mode = useApp((s) => s.mode);
  const step = useApp((s) => s.step);
  const revisions = useApp((s) => s.renderedRevisions);
  const [trailWidth, setTrailWidth] = useEvidenceState('file/trailWidth', 230);
  const [windowWidth,setWindowWidth]=useEvidenceState('file/width',1700);
  // The map's narrower modeless reader must show source on its first frame.
  const [trailHidden, setTrailHidden] = useEvidenceState('file/trailHidden', explore || (modern && window.matchMedia('(max-width: 820px)').matches));
  const [query, setQuery] = useEvidenceState('file/query', '');
  const [start, setStart] = useEvidenceState('file/start', 0);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<FileOperationPage & { key: string; requestedSelection?: string }>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [savedLeft, setLeft] = useEvidenceState<FileEvidence | string | undefined>('file/left', undefined);
  const [savedRight, setRight] = useEvidenceState<FileEvidence | string | undefined>('file/right', undefined);
  const valid=(item:FileEvidence|string|undefined):item is FileEvidence=>!!item&&typeof item==='object'&&!!item.operation&&typeof item.operation.title==='string'&&!!item.operation.detail;
  const reference=(item:FileEvidence|string|undefined)=>typeof item==='string'?item:typeof item?.key==='string'?item.key:undefined;
  const left=valid(savedLeft)?savedLeft:undefined,right=valid(savedRight)?savedRight:undefined;
  const leftKey=reference(savedLeft),rightKey=reference(savedRight);
  const [recoveryError,setRecoveryError]=useState('');
  const [compare, setCompare] = useEvidenceState('file/compare', false);
  const trail = useRef<HTMLElement>(null);
  const reading = useRef<HTMLElement>(null);
  const key = `${recordingId}/${path}/${start}/${query}/${mode === 'replay' ? step : 'all'}/${JSON.stringify(revisions)}`;
  const selectedOperationId = left?.operation.id ?? leftKey?.replace(/\/(read|patch|before|after|search\/\d+)$/, '');
  useEffect(() => {
    if (!source?.fileOperations) return;
    let active = true;
    const timer = setTimeout(() => {
      void source.fileOperations!(recordingId, path, start, 24, mode === 'replay' ? step : undefined, query, selectedOperationId)
        .then((page) => { if (active) { setResponse({ key, requestedSelection: selectedOperationId, ...page }); setFailure(undefined); } })
        .catch((error) => { if (active) setFailure({ key, message: error.message }); });
    }, 100);
    return () => { active = false; clearTimeout(timer); };
  }, [source, key, retry, selectedOperationId]);
  const local = useMemo(() => {
    if (source?.fileOperations) return undefined;
    return fileOperationPage(projection.operations, path, start, 24, query, selectedOperationId);
  }, [source, projection, path, query, start, selectedOperationId]);
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
  useEffect(()=>{
    let active=true;setRecoveryError('');
    const recover=async(key:string|undefined,loaded:FileEvidence|undefined,save:typeof setLeft)=>{
      if(!key||loaded)return;
      let item=choices.find(item=>item.key===key);
      if(!item&&source?.history){
        const operationId=key.replace(/\/(read|patch|before|after|search\/\d+)$/,'');
        if(operationId===key)return;
        const response=await source.history(recordingId,{selectedOperationId:operationId,count:1});
        item=response.projection.operations.flatMap(op=>fileEvidence(op,path)).find(item=>item.key===key);
      }
      if(active){if(item)save(item);else setRecoveryError('Saved captured evidence is unavailable. Choose an item from the action history.');}
    };
    void Promise.all([recover(leftKey,left,setLeft),compare?recover(rightKey,right,setRight):undefined]).catch(()=>{if(active)setRecoveryError('Could not restore the saved evidence. Reopen an item from the action history.');});
    return()=>{active=false;};
  },[source,recordingId,path,leftKey,rightKey,left,right,compare,page]);
  const referenced = requestedLine === undefined ? undefined : choices.find(item => {
    const detail = item.operation.detail;
    return detail.kind === 'read' && requestedLine >= detail.startLine && requestedLine < detail.startLine + detail.lineCount;
  });
  const first = leftKey?choices.find(item=>item.key===leftKey):choices.find(item => item.key === preferred) ?? referenced ?? (focusChange ? choices.find(item => item.patch) ?? choices.find(item => item.operation.kind === 'write' || item.operation.kind === 'edit') : undefined) ?? choices[0];
  const second = rightKey?choices.find(item=>item.key===rightKey):choices.at(-1);
  useEffect(() => { if (!leftKey && first) setLeft(first); }, [leftKey, first]);
  // Steps follow the loaded action page, in its recorded order; retained or clicked extras never reorder them.
  const steps = useMemo(() => fileTimeline(page?.operations ?? [], path), [page, path]);
  const stepper = timelineStep(steps, first);
  const pageSize = 24, moreBefore = start > 0, moreAfter = !!page && start + pageSize < page.total;
  const timeline = page?.timeline;
  const selectedStep = timeline?.selected?.operationId === first?.operation.id ? timeline?.selected : undefined;
  const globalPosition = selectedStep?.position ?? (first && timeline?.positions[first.operation.id]);
  const totalSteps = timeline?.total ?? stepper.total;
  // Retained evidence may be off-page. Wait for metadata for that exact selection before stepping it.
  const selectionPending = !!source?.fileOperations && !!first && !timeline?.positions[first.operation.id] && response?.requestedSelection !== first.operation.id;
  // Crossing onto a neighbouring page of the action list: choose its first or last step once that page has loaded.
  const pendingStep = useRef<'first' | 'last' | (FileStepTarget & { direction: 'previous' | 'next' }) | undefined>(undefined);
  const previousStep = useRef<HTMLButtonElement>(null), nextStep = useRef<HTMLButtonElement>(null);
  const stepped = useRef<'previous' | 'next' | undefined>(undefined);
  const stepTo = (side: 'previous' | 'next') => {
    if (selectionPending) return;
    const exact = selectedStep ? selectedStep[side] : globalPosition === undefined ? (side === 'next' ? timeline?.first : timeline?.last) : undefined;
    if (exact) {
      const loaded = steps.find(item => item.operation.id === exact.operationId);
      if (loaded) { stepped.current = side; setLeft(loaded); }
      else { pendingStep.current = { ...exact, direction: side }; setStart(exact.start); }
      return;
    }
    const target = stepper[side];
    if (target) { stepped.current = side; setLeft(target); return; }
    if (side === 'next' && moreAfter) { pendingStep.current = 'first'; setStart(start + pageSize); }
    else if (side === 'previous' && moreBefore) { pendingStep.current = 'last'; setStart(Math.max(0, start - pageSize)); }
  };
  useEffect(() => {
    const want = pendingStep.current;
    if (!want || !page) return;
    if (typeof want === 'object') {
      const target = steps.find(item => item.operation.id === want.operationId);
      if (target) { pendingStep.current = undefined; stepped.current = want.direction; setLeft(target); }
      else pendingStep.current = undefined;
    }
    else if (steps.length) { pendingStep.current = undefined; stepped.current = want === 'first' ? 'next' : 'previous'; setLeft(want === 'first' ? steps[0] : steps.at(-1)); }
    // A page of searches or other actions holds no read or edit of this file: keep going in the same direction.
    else if (want === 'first' && moreAfter) setStart(start + pageSize);
    else if (want === 'last' && moreBefore) setStart(Math.max(0, start - pageSize));
    else pendingStep.current = undefined;
  }, [page, steps]);
  useEffect(() => {
    const side = stepped.current;
    if (!side) return;
    stepped.current = undefined;
    // Reaching either end disables the button that was pressed; keep keyboard focus on the one that still works.
    const here = side === 'previous' ? previousStep.current : nextStep.current;
    if (here?.disabled) (side === 'previous' ? nextStep.current : previousStep.current)?.focus();
    trail.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [first?.key]);
  const close = () => useApp.getState().set({ filePanel: undefined, filePanelFocus: undefined, filePanelEvidence: undefined });
  return <ReadingDialog title={`Work on ${recordedLocation ?? path}`} windowId={explore?undefined:'Captured file'} resetWindow={()=>{setWindowWidth(1700);setTrailWidth(230);setTrailHidden(false);}} style={explore||document.documentElement.dataset.uiVersion!=='modern'?undefined:{width:`min(${windowWidth}px,calc(100vw - 28px))`}} resizeControl={explore||document.documentElement.dataset.uiVersion!=='modern'?undefined:<ReadingResize value={windowWidth} minimum={640} maximum={1800} change={setWindowWidth} reset={()=>setWindowWidth(1700)} label="Resize captured file reading space" fromRight/>} close={close} className="file-workspace" modeless={explore}>
    <div className="file-reading-context"><EvidenceNavigation compact={modern} />
    {recoveryError&&<p role="status" className="file-workspace-intro">{recoveryError}</p>}
    <div className="file-workspace-intro"><span className="muted small">{page ? `${page.total} recorded actions` : 'Loading captured actions…'} · {mode === 'replay' ? 'Visible at this replay step' : 'Recorded'}{requestedLine !== undefined && ` · Referenced line ${requestedLine} · captured ranges only`}</span></div></div>
    <div className={`file-workspace-layout${trailHidden ? ' trail-hidden' : ''}`} style={{ '--trail-width': `${trailWidth}px` } as React.CSSProperties}>
      {!trailHidden && <ReadingResize value={trailWidth} minimum={160} maximum={440} change={setTrailWidth} reset={()=>setTrailWidth(230)} label="Resize file action history" />}
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
        <div className="file-evidence-toolbar">{!modern && <strong>Historical evidence</strong>}{source?.kind === 'daemon' && workspace?.root && diskPath!==undefined && !recordingId.includes('+') && <button className="btn ghost" aria-label={workspace.approved ? 'Read file on disk' : 'Enable workspace reading'} title={`Read current file · ${workspace.root}`} onClick={() => { void (async () => { try { if (!workspace.approved) await approve(); if (useApp.getState().recordingId !== recordingId || useApp.getState().source !== source) return; rememberCurrentFileOrigin(source,recordingId,diskPath,path); useApp.getState().set({ currentFile: diskPath, filePanel: undefined }); } catch (error) { setDiskError((error as Error).message); } })(); }}>{modern ? 'Read on disk' : workspace.approved ? 'Read file on disk' : 'Enable workspace reading'}</button>}{!modern && <button className="btn ghost" aria-pressed={trailHidden} onClick={() => setTrailHidden(!trailHidden)}>{trailHidden ? 'Show actions' : 'Reading space'}</button>}<button className="btn" aria-label={compare ? 'Single evidence' : 'Compare evidence'} aria-pressed={compare} disabled={!compare && choices.length < 2} onClick={() => { if (!compare) { setLeft(first); setRight(second); } setCompare(!compare); if (!compare) setTrailHidden(true); }}>{modern ? (compare ? 'Single view' : 'Compare') : (compare ? 'Single evidence' : 'Compare evidence')}</button>{modern && <WorkspaceOptions label="Captured file actions"><button className="btn ghost" aria-pressed={trailHidden} onClick={() => setTrailHidden(!trailHidden)}>{trailHidden ? 'Show actions' : 'Reading space'}</button>{<div onClick={event=>event.stopPropagation()}><ImportContext path={path} /></div>}</WorkspaceOptions>}</div>

        {!compare && totalSteps > 1 && <div className="file-timeline-steps" role="group" aria-label="Step through captured reads and edits of this file">
          <button ref={previousStep} className="btn ghost" disabled={selectionPending || globalPosition === 1 || (!selectedStep && !stepper.previous && !moreBefore)} onClick={() => stepTo('previous')}>Previous change</button>
          <span role="status" className="muted small" title="Captured reads and edits in recorded order across the whole session; Previous and Next continue across action pages. Counts respect the current filter and replay position. Actions without captured excerpts, patches or before/after references remain in the action list.">{globalPosition ?? '–'} of {totalSteps}{query && ' · filtered'}</span>
          <button ref={nextStep} className="btn ghost" disabled={selectionPending || globalPosition === totalSteps || (!selectedStep && !stepper.next && !moreAfter)} onClick={() => stepTo('next')}>Next change</button>
        </div>}
        {!modern && <ImportContext path={path} />}
        {diskError && <p className="bad" role="alert">{diskError}</p>}
        {choices.length > 0 ? <div className={`file-evidence-columns${compare ? ' paired' : ''}`}>
          <EvidenceColumn choices={choices} value={first} choose={(key) => setLeft(choices.find((item) => item.key === key))} label="First evidence" path={path} requestedLine={requestedLine} />
          {compare && <EvidenceColumn choices={choices} value={second} choose={(key) => setRight(choices.find((item) => item.key === key))} label="Second evidence" path={path} />}
        </div> : page && <p className="muted">No source bytes or patch were captured for these actions. Open an action to inspect the evidence that is available.</p>}
      </section>
    </div>
  </ReadingDialog>;
}

function EvidenceColumn({ choices, value, choose, label, path, requestedLine }: { choices: FileEvidence[]; value?: FileEvidence; choose: (key: string) => void; label: string; path: string; requestedLine?: number }) {
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  return <section className="file-evidence-column"><div className="file-evidence-choice"><label><span className="muted small">{label}</span><select aria-label={label} value={value?.key ?? ''} onChange={(e) => choose(e.target.value)}>{choices.map((item) => <option key={item.key} value={item.key}>{item.operation.title} · {item.label}</option>)}</select></label>{modern && value && <CapturedSourceComparison compact evidence={value} path={path}/>}</div>
    {value && <div key={value.key} className="file-evidence-material">
      {!modern && <><p className="small">{value.label}</p><CapturedSourceComparison evidence={value} path={path}/></>}
      {value.snippet !== undefined ? <>
        <p className="muted small">Exact captured search result · surrounding file was not captured by this result{value.startLine === undefined ? ' · line number not reported' : ''}</p>
        {value.startLine === undefined ? <Output text={value.snippet} /> : <CodeView text={value.snippet} path={path} startLine={value.startLine} activeLine={requestedLine} />}
      </> : value.patch && value.operation.detail.kind === 'edit' ? <DiffReader hunks={value.operation.detail.hunks} path={path} navigationKey={`${label}/${value.key}`} /> : <ArtifactReader id={value.artifactId} kind="code" path={path} startLine={value.startLine} navigationSlot={label} requestedLine={requestedLine} provenance />}
      {value.operation.kind === 'edit' && <VerificationPanel op={value.operation} onOpen={(id) => { const state = useApp.getState(); state.select(id); state.set({ filePanel: undefined, explore: false }); }} />}
    </div>}
  </section>;
}
