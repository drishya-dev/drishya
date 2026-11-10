import {ProseFilesProvider} from './ProseFiles.tsx';
import {QueuedInputs} from './QueuedInputs.tsx';
import {currentReadingTarget,currentReadingFailure} from '../lib/file-reading.ts';
import {CapturedFileFallback} from './FileHistory.tsx';
import {FileReadingActions} from './FileReadingActions.tsx';
import {useFileRoots} from '../lib/use-file-roots.ts';
import { documentFits, documentLimitMessage } from '../lib/document-limit.ts';
import {FileRowName} from './FileRowName.tsx';
import {worktreeFileRows, workspaceFileReveal, currentWorkspacePath, UNPLACED_GROUP, canonicalFileFolders} from '../lib/worktree-files.ts';
import {workspaceDrafts} from '../lib/workspace-drafts.ts';
import {rememberCurrentFileOrigin,currentFileOrigin} from '../lib/current-file-origin.ts';
import { FileEvidenceMarks, fileEvidenceDescription, useFileEvidence } from './FileEvidenceMarks.tsx';
import { touchedFiles } from '../../../../packages/scene/src/file-evidence.ts';
import {FilePeekTabs} from './FilePeekTabs.tsx';
import {filePeekState,openFilePeek,closeFilePeek,type FilePeekState} from '../lib/file-peek.ts';
import {useSurfaceReflow} from '../lib/use-surface-reflow.ts';
import {Markdown} from '../lib/markdown.tsx';
import { acceptInvestigation } from '../lib/native-return.ts';
import { NativeApproval } from './NativeApproval.tsx';
import { NativeQuestions } from './NativeQuestions.tsx';
import { useCurrentSource } from '../lib/use-current-source.ts';
import { SourceVersionNotice } from './SourceVersions.tsx';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { EvidenceNavigation, useEvidenceState, useEvidenceScroll } from './EvidenceNavigation.tsx';
import { workspaceApi, type WorkspaceStatus, type ControllerStatus, type PromptAttachment, type TurnOptions } from '../api.ts';
import { pastedFiles, promptFiles, promptSizeNote, PROMPT_BYTES, utf8Bytes, attachmentBytes } from '../lib/prompt-files.ts';
import { promptDrafts } from '../lib/prompt-drafts.ts';
import { useWorkspaceMemory, useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { useNowText } from './NowWatcher.tsx';
import { ComposerMenu } from './ComposerMenu.tsx';
import { useApp } from '../state.ts';
import { CodeView } from './common.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { FileIcon } from './FileIcon.tsx';
import { SourceFind } from './SourceFind.tsx';
import { WholeSource } from './WholeSource.tsx';
import { ReadingResize } from './ReadingResize.tsx';
import { ImportContext } from './ImportContext.tsx';
import { useNarrowWorkspace } from '../lib/responsive-workspace.ts';
import { sendWaitReason } from '../lib/send-wait.ts';

interface Connection {
  submitting?: boolean; submit: (prompt: string, exclusive: boolean, attachments?: PromptAttachment[], options?: TurnOptions) => Promise<void>;
  workspace?: WorkspaceStatus; controller?: ControllerStatus; error?: string;
  acknowledged?:boolean; acknowledge?:(value:boolean)=>void;
  refresh: () => Promise<void>; approve: (remember?:boolean) => Promise<void>; inspect?: () => Promise<void>;
}
const SessionContext = createContext<Connection>({ refresh: async () => {}, approve: async () => {}, submit: async () => {} });
export const useSessionWorkspace = () => useContext(SessionContext);

export function SessionWorkspaceProvider({ children }: { children: ReactNode }) {
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const connection=useApp(s=>s.connection),screen=useApp(s=>s.screen);
  const [acknowledged,acknowledge]=useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceStatus>();
  const [controller, setController] = useState<ControllerStatus>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const currentController = useRef(controller); currentController.current = controller;
  const revision = useRef(0);
  const wake = useRef<(() => void) | undefined>(undefined);
  const eligible = source?.kind === 'daemon' && !!id && !id.includes('+');
  const refresh = async () => {
    if (!eligible) return;
    const request = ++revision.current;
    const current=()=>useApp.getState().source===source&&useApp.getState().recordingId===id&&request===revision.current;
    // Reading access must not depend on an installed or responsive native CLI.
    const results=await Promise.allSettled([
      workspaceApi.status(id!).then(value=>{if(current())setWorkspace(value);}),
      workspaceApi.controller(id!).then(value=>{if(current())setController(value);}),
    ]);
    if(!current())return;
    const errors=results.flatMap((result,index)=>result.status==='rejected'?[`${index===0?'Workspace':'Native runtime'}: ${result.reason.message}`]:[]);
    if(errors.length)acknowledge(false);
    setError(errors.join(' · ')||undefined);
  };
  useEffect(() => {
    setWorkspace(undefined); setController(undefined); setError(undefined); setSubmitting(false); acknowledge(false);
    let active = true; let busy = false; let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (!active || busy) return;
      busy = true;
      try { if (document.visibilityState !== 'hidden') await refresh(); } catch (e) { if (active) setError((e as Error).message); } finally {
        busy = false;
        const running = ['connecting', 'running', 'approval'].includes(currentController.current?.state ?? '');
        if (active) timer = setTimeout(() => void load(), running ? 500 : 1800);
      }
    };
    wake.current = () => { clearTimeout(timer); void load(); };
    void load();
    return () => { active = false; clearTimeout(timer); revision.current++; wake.current = undefined; };
  }, [id, source]);
  // Consent belongs to this selected-session connection, never to a saved checkout or turn.
  useEffect(()=>{if(connection!=='connected'||screen!=='viewer'||controller?.state==='failed'||controller?.available===false||workspace?.approved===false)acknowledge(false);},[connection,screen,controller?.state,controller?.available,workspace?.approved]);
  useEffect(()=>{
    if(!eligible||!workspace?.approved)return;
    let active=true;
    void source!.graph(id!).then(graph=>{if(active&&useApp.getState().source===source&&useApp.getState().recordingId===id)useApp.setState({graph});}).catch(()=>{});
    return()=>{active=false;};
  },[id,source,workspace?.approved]);
  useEffect(() => { if (['connecting', 'running', 'approval'].includes(controller?.state ?? '')) wake.current?.(); }, [controller?.state]);
  const approve = async (remember=false) => {
    if (!eligible) return;
    ++revision.current;
    const w = await workspaceApi.approve(id!,remember);
    const graph = await source!.graph(id!);
    if (useApp.getState().source !== source || useApp.getState().recordingId !== id) return;
    ++revision.current;
    setWorkspace(w); useApp.setState({ graph });
  };
  const inspect = async () => {
    if (!eligible) return;
    const state = await workspaceApi.settings(id!);
    if (useApp.getState().source === source && useApp.getState().recordingId === id) { ++revision.current; setController(state); }
  };
  const submit = async (prompt: string, exclusive: boolean, attachments?: PromptAttachment[], options?: TurnOptions) => {
    if (!eligible) return;
    setSubmitting(true);
    ++revision.current;
    try { const state = await workspaceApi.prompt(id!, prompt, exclusive, attachments, options); if (useApp.getState().source === source && useApp.getState().recordingId === id) { acceptInvestigation(source!,id!,state,prompt); ++revision.current; setController(state); } }
    catch(error){acknowledge(false);throw error;}
    finally { if (useApp.getState().source === source && useApp.getState().recordingId === id) setSubmitting(false); }
  };
  return <SessionContext.Provider value={{ workspace, controller, submitting, submit, error, refresh, approve, inspect, acknowledged, acknowledge }}><ProseFilesProvider approved={!!workspace?.approved}>{children}</ProseFilesProvider></SessionContext.Provider>;
}

/** Native live receipt is separate from persisted evidence and disappears on capture. */
export function NativeTurn({ projection }: { projection: Projection }) {
  const { controller, submitting, error } = useSessionWorkspace();
  const connection = useApp(s => s.connection);
  const connected = connection === 'connected' && !error;
  const mode = useApp(s => s.mode);
  const detail = useApp(s => s.reasoningDetail);
  if (mode !== 'history') return null;
  const running = controller && ['connecting', 'running', 'approval'].includes(controller.state);
  const preview = controller?.preview;
  // Prose.sequence is a timeline step; receipt boundaries use observation order.
  const capturedIds = new Set(projection.timeline.flatMap(item => item.type === 'prose' && item.sequence > (controller?.afterSequence ?? 0) ? [item.proseId] : []));
  const captured = preview && projection.prose.some(p => capturedIds.has(p.id) && p.text.trim() === preview.text.trim());
  const prompt = controller?.submittedPrompt;
  const promptCaptured = prompt && projection.timeline.some(p => p.type === 'turn' && p.sequence > (controller?.afterSequence ?? 0) && (p.prompt?.trim() === prompt.trim() || !!controller?.attachments?.length && p.prompt?.startsWith(prompt + '\n\n[Attached file: ')));
  const visible = preview && !captured && (preview.role !== 'reasoning' || detail !== 'hidden');
  if (!submitting && !running && !visible && (!prompt || promptCaptured)) return null;
  const phase = submitting ? 'Sending prompt…' : controller?.state === 'connecting' ? 'Connecting to native session…' : controller?.state === 'approval' ? 'Waiting for your approval' : controller?.phase === 'thinking' ? 'Thinking…' : controller?.phase === 'responding' ? 'Receiving response…' : controller?.phase === 'tool' ? 'Working with tools…' : 'Waiting for the agent…';
  return <section className="native-live-work" aria-label="Native turn progress">
    {prompt && !promptCaptured && <div className="turn"><div className="turn-text"><small className="muted">Submitted here</small><p>{prompt}</p>{!!controller?.attachments?.length && <small>{controller.attachments.map(a => a.name).join(' · ')}</small>}</div></div>}
    {(submitting || running) && <p className="native-phase" role="status">{connected ? phase : 'Connection unavailable · native turn state may have changed'}</p>}
    {visible && <div className="prose" data-native-preview={preview.id}><small className="muted">{connected ? 'Live from harness' : 'Last received from harness'} · {preview.role === 'reasoning' ? preview.exposure === 'summary' ? 'reasoning summary' : 'exposed thinking' : 'response'}</small>{preview.role === 'reasoning' && detail === 'collapsed' ? <details><summary>Read exposed reasoning</summary><pre>{preview.text}</pre></details> : <pre>{preview.text}</pre>}</div>}
  </section>;
}

const subscribeWorkspaceFiles=(notify:()=>void)=>{
  window.addEventListener('drishya-location-change',notify);
  window.addEventListener('drishya-unsaved-change',notify);
  return()=>{window.removeEventListener('drishya-location-change',notify);window.removeEventListener('drishya-unsaved-change',notify);};
};

/** Directory structure from this session's indexed root, never the daemon's own checkout. */
export function FolderExplorer({ scene, projection }: { scene: Scene; projection: Projection }) {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId);
  const graph = useApp(s => s.graph);
  const files = useApp(s => s.projection?.files);
  const capturedRoot=useApp(s=>s.recording?.workspaceRoot);
  const [touchedOnly, setTouchedOnly] = useState(false);
  const fileRoots=useFileRoots(projection.observationCount);
  useEffect(() => setTouchedOnly(false), [id]);
  const touched = useMemo(() => touchedFiles(files ?? []), [files]);
  const hidden = useApp(s => s.foldersHidden);
  const narrow = useNarrowWorkspace(), developerWorkspace = useApp(s => s.developerWorkspace);
  const memory=useWorkspaceMemory();
  // Primitive snapshots stay stable during unrelated document/scroll writes. The
  // state hook is owner-local; a second copy would miss Workspace tab changes.
  const workspaceSnapshot=useSyncExternalStore(subscribeWorkspaceFiles,()=>{
    const path=(memory.get(memory.get('desk/pane')===1&&memory.get('desk/split')?'desk/secondary':'desk/primary') as string|undefined)??'';
    const drafts=source&&id?workspaceDrafts(source):undefined;
    return JSON.stringify([
      path, source&&id?currentFileOrigin(source,id,path,fileRoots,capturedRoot??projection.workspaceRoot)??path:path,
      drafts?.entries().filter(item=>item.id===id&&drafts.get(item.id,item.path)?.creation).map(item=>item.path)??[],
    ]);
  });
  const [activeFile,activeOrigin,draftFiles]=useMemo(()=>JSON.parse(workspaceSnapshot) as [string,string,string[]],[workspaceSnapshot]);
  const workspaceFile=developerWorkspace?activeFile:'';
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const [width, setWidth] = useWorkspaceState('folders/width', 260);
  const [viewport, setViewport] = useState(() => innerWidth);
  useEffect(() => { const resize = () => setViewport(innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const maximumWidth = Math.max(220, Math.min(420, Math.floor(viewport * .32)));
  const readingWidth = Math.max(220, Math.min(maximumWidth, width));
  const shown = !hidden && (!narrow || hidden === false);
  const explorer = useRef<HTMLElement>(null);
  const closeExplorer = (returnFocus = false) => {
    useApp.setState({ foldersHidden: true });
    if (returnFocus && narrow) document.querySelector<HTMLElement>(developerWorkspace ? '.developer-workspace [data-workspace-files-trigger]' : '.workspace-bar [data-workspace-files-trigger]')?.focus({ preventScroll: true });
  };
  const { workspace, approve } = useSessionWorkspace();
  const [query, setQuery] = useWorkspaceState('folders/query', '');
  const [approving,setApproving] = useState(false);
  const [remember,setRemember]=useState(true);
  const [opened, setOpened] = useWorkspaceState('folders/open', () => new Set<string>(['']));
  useLayoutEffect(()=>{
    const next=canonicalFileFolders(opened,fileRoots,capturedRoot ?? projection.workspaceRoot);
    if(next!==opened)setOpened(next);
  },[opened,fileRoots,capturedRoot,projection.workspaceRoot,setOpened]);
  useEffect(()=>{const reveal=(event:Event)=>{const path=(event as CustomEvent).detail;if(typeof path==='string'){setQuery(path);setTouchedOnly(false);}};window.addEventListener('drishya-reveal-captured-file',reveal);return()=>window.removeEventListener('drishya-reveal-captured-file',reveal);},[setQuery,setTouchedOnly]);
  const treeElement = useRef<HTMLDivElement>(null);
  const [treeScroll, setTreeScroll] = useWorkspaceState('folders/top', 0);
  const [treeHeight, setTreeHeight] = useState(600);
  const folderAnchor = useRef<{ path: string; offset: number } | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [graphRetry, setGraphRetry] = useState(0);
  useLayoutEffect(() => {
    const viewer = document.querySelector<HTMLElement>('.viewer');
    if (!viewer || !modern || narrow) return;
    // Minimised, Files gives its width to the stage (Yash, 3 Nov: a small screen can give the work the whole width).
    viewer.style.setProperty('--files-rail', shown ? `${readingWidth + 34}px` : '24px');
    return () => { viewer.style.removeProperty('--files-rail'); };
  }, [modern, narrow, readingWidth, shown]);
  useEffect(() => {
    if (graph || !source || !id) return;
    let active = true; setError(undefined);
    void source.graph(id).then(g => { if (active && useApp.getState().recordingId === id) useApp.setState({ graph: g }); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [source, id, graph, graphRetry]);
  const candidatePaths = useMemo(() => {
    const paths=[...(graph?.nodes.map(n=>n.path)??[]),...(files?.map(f=>f.path)??[])].filter(p=>!(graph?.temporal==='current'&&p.startsWith('.local/'))&&!p.startsWith('/')&&!/^[A-Za-z]:/.test(p));
    if(developerWorkspace)paths.push(...draftFiles);
    if(workspaceFile&&!paths.some(path=>path===workspaceFile||currentWorkspacePath(path,fileRoots,capturedRoot??projection.workspaceRoot)===workspaceFile))paths.push(workspaceFile);
    return [...new Set(paths)].sort();
  }, [graph, files, developerWorkspace, draftFiles, workspaceFile,fileRoots,capturedRoot,projection.workspaceRoot]);
  // Navigation resolves against all candidates, while an explicit Touched choice
  // filters every visible leaf, including the active file and local drafts.
  const paths=useMemo(()=>candidatePaths.filter(path=>!touchedOnly||touched.paths.has(path)),[candidatePaths,touchedOnly,touched]);
  const placement = useMemo(() => ({
    indexed: new Set([...(graph?.temporal === 'current' ? graph.nodes.map(node => node.path) : []),...draftFiles]),
    // Search output alone does not say which directory a bare result came from.
    direct: new Set((files ?? []).filter(file => file.roles.some(role => role === 'read' || role === 'write')).map(file => file.path)),
  }), [graph, files,draftFiles]);
  const tree = useMemo(() => worktreeFileRows(paths,fileRoots,capturedRoot ?? projection.workspaceRoot,opened,query,placement), [paths,fileRoots,capturedRoot,projection.workspaceRoot,query,opened,placement]);
  const [revealedFolder,setRevealedFolder]=useWorkspaceState<string|undefined>('folders/revealed',undefined);
  const pendingFolder=useRef<string|undefined>(undefined);
  const activeReveal=useMemo(()=>workspaceFileReveal(workspaceFile,candidatePaths,fileRoots,capturedRoot??projection.workspaceRoot,placement,activeOrigin),[workspaceFile,candidatePaths,fileRoots,capturedRoot,projection.workspaceRoot,placement,activeOrigin]);
  const revealSignature=JSON.stringify([workspaceFile,activeOrigin,activeReveal]);
  const lastReveal=useRef(''),lastActive=useRef(''),manuallyCollapsed=useRef(false);
  const pendingFile=useRef<string|undefined>(undefined);
  useLayoutEffect(()=>{
    if(lastActive.current!==activeFile){lastActive.current=activeFile;manuallyCollapsed.current=false;}
    if(lastReveal.current===revealSignature)return;
    lastReveal.current=revealSignature;
    pendingFile.current=undefined;
    if(!workspaceFile||!activeReveal||manuallyCollapsed.current)return;
    pendingFile.current=activeReveal.path;
    setQuery('');setTouchedOnly(false);
    setOpened(previous=>{
      const required=new Set(activeReveal.ancestors);
      return new Set([...Array.from(previous).filter(path=>!required.has(path)).slice(-(256-required.size)),...required]);
    });
  },[revealSignature,activeFile,workspaceFile,activeReveal,setOpened,setQuery]);
  useEffect(()=>{
    const reveal=(event:Event)=>{
      const path=(event as CustomEvent).detail;
      if(typeof path!=='string'||!paths.some(file=>file.startsWith(path+'/')))return;
      const canonical=currentWorkspacePath(path,fileRoots,capturedRoot ?? projection.workspaceRoot) ?? path;
      const matches=worktreeFileRows(paths,fileRoots,capturedRoot ?? projection.workspaceRoot,new Set(['',UNPLACED_GROUP]),path,placement).filter(row=>row.path.startsWith(path+'/'));
      const unresolved=matches.some(row=>row.unplaced)&&!matches.some(row=>!row.unplaced);
      const target=unresolved?UNPLACED_GROUP:canonical;
      const parents=target.split('/').map((_,i,parts)=>parts.slice(0,i+1).join('/'));
      pendingFolder.current=target;setRevealedFolder(target);setQuery('');setTouchedOnly(false);
      setOpened(previous=>{const required=new Set(['',UNPLACED_GROUP,...(fileRoots.some(root=>path.startsWith(root.prefix+'/'))?['\u0000recorded-worktrees']:[]),...parents]);return new Set([...Array.from(previous).filter(path=>!required.has(path)).slice(-(256-required.size)),...required]);});
    };
    window.addEventListener('drishya-reveal-prose-folder',reveal);
    return()=>window.removeEventListener('drishya-reveal-prose-folder',reveal);
  },[paths,fileRoots,capturedRoot,projection.workspaceRoot,placement,setOpened,setQuery,setTouchedOnly,setRevealedFolder]);
  const siblingPositions = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const row of tree) {
      const parent = row.parent;
      const group = groups.get(parent) ?? []; group.push(row.path); groups.set(parent, group);
    }
    const positions = new Map<string, { position: number; size: number }>();
    for (const group of groups.values()) group.forEach((path, index) => positions.set(path, { position: index + 1, size: group.length }));
    return positions;
  }, [tree]);
  // One continuous scrollbar; a bounded DOM window keeps large repositories cheap.
  const rowHeight = 32;
  const firstRow = Math.max(0, Math.floor(treeScroll / rowHeight) - 10);
  const lastRow = Math.min(tree.length, firstRow + Math.ceil(treeHeight / rowHeight) + 24);
  const evidence = useFileEvidence(tree.slice(firstRow, lastRow).filter(row => !row.folder).map(row => row.path), projection, shown);
  useLayoutEffect(() => {
    const el = treeElement.current;
    if (!el || !shown) return;
    // Hiding the explorer unmounts its scroller, not its retained window state.
    // Restore the real offset before paint so reopening cannot show a blank spacer.
    el.scrollTop = treeScroll; setTreeScroll(el.scrollTop);
    const measure = () => setTreeHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  useEffect(() => {
    const element = explorer.current;
    if (!narrow || !shown || !element) return;
    const outside = (event: Event) => {
      if (event.composedPath().includes(element) || event.target instanceof Element && event.target.closest('[data-workspace-files-trigger]')) return;
      closeExplorer();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]') || event.target instanceof Element && event.target.closest('.tree-evidence-filter[open]')) return;
      if (!element.contains(event.target as Node) && !(event.target instanceof Element && event.target.closest('[data-workspace-files-trigger]'))) return;
      event.preventDefault(); event.stopPropagation(); closeExplorer(true);
    };
    // Enabling reading removes its grant button. Restore focus if it disappeared,
    // but keep a developer's existing folder/search focus during status updates.
    if (!element.contains(document.activeElement)) element.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape, true); };
  }, [narrow, shown, developerWorkspace, workspace?.approved]);
  useLayoutEffect(() => { treeElement.current?.scrollTo({ top: 0 }); setTreeScroll(0); }, [query, touchedOnly]);
  const treeRows = useRef(0);
  useLayoutEffect(() => {
    const el = treeElement.current; if (!el) return;
    const anchor = folderAnchor.current; folderAnchor.current = undefined;
    // A live update rebuilds the tree with the same rows; only an anchor or a changed row count can move
    // the scroll, so skip the forced layout otherwise (PERF-2).
    const rows = treeRows.current; treeRows.current = tree.length;
    if (!anchor && rows === tree.length) return;
    const index = anchor ? tree.findIndex(row => row.path === anchor.path) : -1;
    const top = index >= 0 ? index * rowHeight - anchor!.offset : el.scrollTop;
    el.scrollTop = Math.max(0, Math.min(top, tree.length * rowHeight - el.clientHeight));
    setTreeScroll(el.scrollTop);
  }, [tree]);
  useLayoutEffect(()=>{
    const path=pendingFolder.current,element=treeElement.current;
    if(!path||!element||!shown)return;
    const index=tree.findIndex(row=>row.path===path);if(index<0)return;
    pendingFolder.current=undefined;
    element.scrollTop=Math.max(0,index*rowHeight-element.clientHeight/3);setTreeScroll(element.scrollTop);
    requestAnimationFrame(()=>element.querySelector<HTMLElement>(`[data-tree-index="${index}"]`)?.focus({preventScroll:true}));
  },[tree,shown,setTreeScroll]);
  useLayoutEffect(()=>{
    const path=pendingFile.current,element=treeElement.current;
    // Wait for the reveal's filter/ancestor updates before consuming it. A search
    // result can already contain the leaf while its full-tree row is offscreen.
    if(!path||!element||!shown||!element.clientHeight||query||touchedOnly||activeReveal?.ancestors.some(parent=>!opened.has(parent)))return;
    const index=tree.findIndex(row=>row.path===path);if(index<0)return;
    pendingFile.current=undefined;
    // Only this scroller moves; scrollIntoView could move the reader/history too.
    if(index*rowHeight<element.scrollTop)element.scrollTop=index*rowHeight;
    else if((index+1)*rowHeight>element.scrollTop+element.clientHeight)element.scrollTop=(index+1)*rowHeight-element.clientHeight;
    setTreeScroll(element.scrollTop);
  },[tree,shown,treeHeight,query,touchedOnly,opened,activeReveal,setTreeScroll]);
  const rootName = workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Session files';
  if (!shown) return null;
  return <aside ref={explorer} style={{width: modern && !narrow ? `${readingWidth}px` : undefined,top: narrow && developerWorkspace ? 'var(--desk-tools-bottom, calc(var(--workspace-header-h, 62px) + 80px))' : undefined}} className="folder-explorer spine" data-reading-access={workspace?.approved?'current':workspace||source?.kind!=='daemon'?'captured':'checking'} aria-label={modern ? 'Repository files' : 'Session folders'}>
    {modern && !narrow && <ReadingResize value={readingWidth} minimum={220} maximum={maximumWidth} change={setWidth} reset={()=>setWidth(260)} label="Resize Files reading space" />}
    <header><div className="folder-root" title={workspace?.root}>{rootName}</div><button className="icon-btn" aria-label={document.documentElement.dataset.uiVersion === 'modern' ? 'Minimize files' : 'Minimize folders'} onClick={() => closeExplorer(true)}>{narrow ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> : '‹'}</button></header>
    <div className="ux-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input aria-label={modern ? 'Find repository files' : 'Find session files'} placeholder={touchedOnly?'Find touched files…':'Find files…'} maxLength={200} value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Clear file search" onClick={() => setQuery('')}>×</button>}
      <details className="desk-options tree-evidence-filter" data-touched={touchedOnly} onKeyDown={event=>{if(event.key==='Escape'&&event.currentTarget.open){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
        <summary aria-label="File filters" title={touchedOnly?'File filters · Touched':'File filters'}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h14M5 10h10M8 16h4" strokeWidth="1.5"/></svg></summary>
        <div className="tree-evidence-filter-menu">{[{value:false,label:'All files'},{value:true,label:'Touched'}].map(option=><button key={option.label} type="button" aria-pressed={touchedOnly===option.value} onClick={event=>{setTouchedOnly(option.value);const menu=event.currentTarget.closest('details')!;menu.open=false;menu.querySelector('summary')?.focus();}}>{option.label}</button>)}<small>Activity in this session. Badges describe tool calls, not current Git status.</small></div>
      </details>
    </div>
    {source?.kind === 'daemon' && !id?.includes('+') && workspace?.root && !workspace.approved && <><button className="workspace-grant" disabled={approving} onClick={() => {setApproving(true);void approve(document.documentElement.dataset.uiVersion==='modern'&&remember).catch(e => setError(e.message)).finally(()=>setApproving(false));}}>{approving?'Opening workspace…':'Enable workspace reading'}<small>Read current files in this folder</small></button>{document.documentElement.dataset.uiVersion==='modern'&&<label><input type="checkbox" checked={remember} disabled={approving} onChange={event=>setRemember(event.target.checked)} /> Remember for this checkout</label>}</>}
    {error && <p className="bad small" role="alert">{error} <button className="btn small" onClick={() => setGraphRetry(n => n + 1)}>Retry file listing</button></p>}
    <div ref={treeElement} className="folder-tree virtual-folder-tree" role="tree" aria-label="Workspace files" onScroll={e => setTreeScroll(e.currentTarget.scrollTop)} onKeyDown={e => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tree-index]');
      if (!target || !tree.length) return;
      e.preventDefault();
      const index = Number(target.dataset.treeIndex);
      const row = tree[index];
      if (!row) return;
      if (e.key === 'ArrowRight' && row.folder && !opened.has(row.path) || e.key === 'ArrowLeft' && row.folder && opened.has(row.path)) { target.click(); return; }
      const parent = row.parent;
      const next = e.key === 'ArrowRight' ? row.folder && tree[index + 1]?.depth === row.depth + 1 ? index + 1 : index : e.key === 'ArrowLeft' ? Math.max(0, tree.findIndex(item => item.folder && item.path === parent)) : e.key === 'Home' ? 0 : e.key === 'End' ? tree.length - 1 : Math.max(0, Math.min(tree.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)));
      const el = treeElement.current!;
      if (next * rowHeight < el.scrollTop) el.scrollTop = next * rowHeight;
      else if ((next + 1) * rowHeight > el.scrollTop + el.clientHeight) el.scrollTop = (next + 1) * rowHeight - el.clientHeight;
      setTreeScroll(el.scrollTop);
      requestAnimationFrame(() => el.querySelector<HTMLElement>(`[data-tree-index="${next}"]`)?.focus({ preventScroll: true }));
    }}>
      <div aria-hidden="true" style={{ height: firstRow * rowHeight }} />
      {tree.slice(firstRow, lastRow).map((row, i) => <button className={row.folder ? 'folder-row' : 'spine-file'} role="treeitem" aria-selected={row.path===(workspaceFile?activeReveal?.path:revealedFolder)} aria-label={row.name} aria-description={draftFiles.includes(row.path)?"Local draft; file not created on disk.":fileEvidenceDescription(evidence.get(row.path), row.folder?touched.folders.get(row.path):undefined)} disabled={approving&&!row.folder} aria-level={row.depth + 1} aria-posinset={siblingPositions.get(row.path)?.position} aria-setsize={siblingPositions.get(row.path)?.size} aria-expanded={row.folder ? opened.has(row.path) : undefined} key={row.path} data-tree-index={firstRow + i} data-tree-path={row.path} data-spine-path={row.folder ? undefined : row.path} data-file-location={row.unplaced ? 'unplaced' : undefined} style={{ paddingLeft: 8 + Math.min(row.depth, 12) * 12, height: rowHeight, minHeight: rowHeight }} title={row.unplaced ? `Captured path; repository location unresolved: ${row.path}` : row.location ?? (row.worktree ? row.name : row.path)} onMouseEnter={() => !row.folder && useApp.setState({ hoveredPath: row.path })} onMouseLeave={() => useApp.setState({ hoveredPath: undefined })} onClick={() => {
        const currentPath=row.unplaced ? undefined : currentWorkspacePath(row.path,fileRoots,workspace?.root);
        if(!row.folder&&currentPath!==undefined&&source&&id)rememberCurrentFileOrigin(source,id,currentPath,row.path);
        if (row.folder) { if(opened.has(row.path)){manuallyCollapsed.current=true;pendingFile.current=undefined;} folderAnchor.current = { path: row.path, offset: (firstRow + i) * rowHeight - (treeElement.current?.scrollTop ?? 0) }; setOpened(prev => { const next = new Set(prev); next.has(row.path) ? next.delete(row.path) : next.add(row.path); if (next.size > 256) next.delete([...next].find(path => path !== '')!); return next; }); }
        else if (row.unplaced || row.location && currentPath===undefined) useApp.getState().set({filePanel:row.path,currentFile:undefined,...(narrow?{foldersHidden:true}:{})});
        else if (useApp.getState().developerWorkspace) window.dispatchEvent(new CustomEvent('drishya-open-workspace-file', { detail: currentPath ?? row.path }));
        else if(modern&&workspace?.approved&&!useApp.getState().explore){window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path:currentPath ?? row.path}}));if(narrow||innerWidth<=1100)useApp.setState({foldersHidden:true});}
        else useApp.getState().set({...(workspace?.approved ? { currentFile: currentPath ?? row.path } : { filePanel: row.path }),...(narrow ? {foldersHidden:true} : {})});
      }} onDoubleClick={()=>{const currentPath=row.unplaced ? undefined : currentWorkspacePath(row.path,fileRoots,workspace?.root);if(!row.folder&&currentPath!==undefined&&modern&&workspace?.approved&&!useApp.getState().developerWorkspace&&!useApp.getState().explore){if(source&&id)rememberCurrentFileOrigin(source,id,currentPath,row.path);window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path:currentPath,pin:true}}));}}}><span className="folder-disclosure" aria-hidden="true">{row.folder ? modern ? '›' : opened.has(row.path) ? '⌄' : '›' : ''}</span><FileIcon path={row.path} folder={row.folder} open={opened.has(row.path)} /><FileRowName name={row.name} folder={row.folder}/><FileEvidenceMarks evidence={row.folder?undefined:evidence.get(row.path)}/></button>)}
      {!tree.length && <p className="muted small">{query ? 'No matching files' : touchedOnly ? 'No file activity' : 'No relative paths recorded yet'}</p>}
      <div aria-hidden="true" style={{ height: (tree.length - lastRow) * rowHeight }} />
    </div>
  </aside>;
}

export function CurrentFileReader() {
  const path=useApp(s=>s.currentFile),id=useApp(s=>s.recordingId),explore=useApp(s=>s.explore),inWorkspace=useApp(s=>s.developerWorkspace);
  const modern=document.documentElement.dataset.uiVersion==='modern';
  const [saved,setSaved]=useWorkspaceState<FilePeekState>('peek/tabs',{files:[]}),[error,setError]=useState('');
  const tabs=useMemo(()=>filePeekState(saved),[saved]);
  const select=(next:string)=>useApp.getState().set({currentFile:next,filePanel:undefined,selectedOp:undefined});
  const open=(next:string,pin=false)=>{const result=openFilePeek(tabs,next,pin);setError(result.error??'');if(result.error)return;setSaved(result.state);select(next);};
  useEffect(()=>{if(modern&&path&&!explore&&!tabs.files.includes(path)&&tabs.preview!==path)setSaved(openFilePeek(tabs,path).state);},[modern,path,explore,tabs]);
  useEffect(()=>{
    const receive=(event:Event)=>{const request=(event as CustomEvent<{path:string;pin?:boolean}>).detail;if(!modern||!id||!request||typeof request.path!=='string')return;open(request.path,request.pin);};
    window.addEventListener('drishya-preview-file',receive);return()=>window.removeEventListener('drishya-preview-file',receive);
  },[modern,id,tabs]);
  // Keep the selected peek location while the full Workspace owns the screen.
  if(!path||!id||inWorkspace)return null;
  const closeTab=(file:string)=>{const next=closeFilePeek(tabs,file);setSaved(next);setError('');if(path===file)useApp.setState({currentFile:next.preview??next.files.at(-1)});};
  return <CurrentDocument key={id} id={id} path={path} tabs={modern&&!explore?<FilePeekTabs state={tabs} path={path} select={select} pin={file=>open(file,true)} close={closeTab} error={error}/>:undefined}/>;
}
function CurrentDocument({ id, path, tabs }: { id: string; path: string;tabs?:ReactNode }) {
  const memory=useWorkspaceMemory();
  const source=useApp(s=>s.source),revision=useApp(s=>s.projection?.observationCount??0);
  const fileRoots=useFileRoots(revision);
  const modern=document.documentElement.dataset.uiVersion==='modern';
  const explore = useApp(s => s.explore);
  const narrow=useNarrowWorkspace();
  const {workspace,approve}=useSessionWorkspace();
  const recordedPath=currentFileOrigin(source,id,path,fileRoots,workspace?.root);
  const projection=useApp(s=>s.projection),target=currentReadingTarget(path,fileRoots,workspace?.root??projection?.workspaceRoot);
  const [granting,setGranting]=useState(false),[grantError,setGrantError]=useState('');
  const [start, setStart] = useEvidenceState('disk/start', 0);
  const current=useCurrentSource(id,target.path??path,workspace?.approved===true&&!!target.path),file=current.shown,error=current.error;
  const [readingVersion, setReadingVersion] = useEvidenceState<string | undefined>('disk/version', undefined);
  const [query, setQuery] = useEvidenceState('disk/query', '');
  const [activeLine, setActiveLine] = useEvidenceState<number | undefined>('disk/line', undefined);
  const [revealRequest,setRevealRequest] = useState(0);
  const [lineInput, setLineInput] = useEvidenceState('disk/lineInput', '');
  const [lineError, setLineError] = useState<string>();
  const [wrap, setWrap] = useEvidenceState('disk/wrap', false);
  const [width, setWidth] = useEvidenceState('disk/width', 1040);
  const [copied, setCopied] = useState('');
  const code = useRef<HTMLDivElement>(null);
  const markdown=/\.(md|markdown)$/i.test(path);
  const [documentMode,setDocumentMode]=useEvidenceState('disk/formatted',true);
  const documentSize=useApp(s=>s.documentSize),documentAllowed=useMemo(()=>!file||documentFits(file,documentSize),[file,documentSize]);
  // A file too large to render opens as its source; a notice is no reason to withhold the content.
  const formatted=markdown&&documentMode&&documentAllowed,oversized=markdown&&documentMode&&!documentAllowed;
  useEvidenceScroll(code, `disk/${formatted?'document':start}`, !!file);
  useEffect(() => { if (file && !readingVersion) setReadingVersion(file.modifiedAt); }, [file, readingVersion]);
  useEffect(() => { setCopied(''); }, [start,file]);
  useEffect(()=>{setLineError(undefined);setCopied('');},[path]);
  const lines = file?.text.split('\n') ?? [];
  const matches = query ? lines.flatMap((line, index) => line.toLowerCase().includes(query.toLowerCase()) ? [index + 1] : []) : [];
  const moveMatch = (direction: 1 | -1) => {
    if (!matches.length) return;
    const current = matches.indexOf(activeLine ?? -1);
    setActiveLine(matches[current < 0 ? direction === 1 ? 0 : matches.length - 1 : (current + direction + matches.length) % matches.length]);
    setRevealRequest(request=>request+1);
  };
  const go = () => {
    const line = Number(lineInput);
    if (!file || !/^\d+$/.test(lineInput) || !Number.isSafeInteger(line) || line < 1 || line > file.totalLines) { setLineError(`Choose a line from 1 to ${file?.totalLines ?? 0}`); return; }
    setLineError(undefined); setActiveLine(line); setRevealRequest(request=>request+1);
  };
  const copy = async () => {
    if (!file) return;
    try { await navigator.clipboard.writeText(file.text); setCopied('Copied file'); }
    catch { setCopied('Copy unavailable · select the text to copy.'); }
  };
  const peek=modern&&!explore;
  const returnToGit = peek && memory.get('git/open') === true ? <button className="btn ghost" aria-label="Return to Git review" title="Return to Git review" onClick={() => window.dispatchEvent(new Event('drishya-git-review'))}>← Git</button> : undefined;
  const refusal=target.reason??currentReadingFailure(error)??currentReadingFailure(grantError);
  if(projection&&!file&&refusal)return <ReadingDialog title={path} close={()=>useApp.setState({currentFile:undefined})} className="current-file-reader file-peek-reader" modeless floating headerExtra={tabs} headerActions={returnToGit}><CapturedFileFallback path={recordedPath??path} projection={projection} reason={refusal}/></ReadingDialog>;
  const fileActions=<><button disabled={!target.path} className={peek?'btn ghost current-reader-icon':'btn ghost'} aria-label="Open in Workspace" onClick={() => { useApp.getState().set({ developerWorkspace: true, explore: false, ...(peek?{}:{currentFile:undefined}), filePanel: undefined, foldersHidden: false, follow: false }); window.dispatchEvent(new CustomEvent('drishya-open-workspace-file', { detail: path })); }} title="Open this current file in Workspace for split views and local drafts">{peek?<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>:'Workspace'}</button><button className="btn ghost current-reader-icon" aria-label="Refresh" title="Refresh current file" disabled={!workspace?.approved||current.busy} onClick={() => void current.refresh()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5"/></svg></button><button className="btn ghost current-reader-icon" aria-label="Agent work on this file" disabled={recordedPath===undefined} title={recordedPath===undefined?"Recorded location unavailable":"Agent work on this file"} onClick={() => {if(recordedPath!==undefined)useApp.getState().set({ currentFile: undefined, filePanel: recordedPath });}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4v5h5M3 9a9 9 0 1 1 0 7M12 7v5l3 2"/></svg></button>{!narrow&&<FileReadingActions path={recordedPath??path} hideCaptured hideWorkspace compact/>}</>;
  const lineControls=<form className="source-go" onSubmit={e=>{e.preventDefault();go();}}><input aria-label="Go to current source line" placeholder="Line" inputMode="numeric" maxLength={16} value={lineInput} onChange={e=>{setLineInput(e.target.value);setLineError(undefined);}}/><button className="btn ghost small" aria-label="Go to line" disabled={!file}>Go</button><button type="button" className="btn ghost small" aria-label="Wrap lines" aria-pressed={wrap} onClick={()=>setWrap(!wrap)}>Wrap</button><span role="status">{lineError}</span></form>;
  const phoneOptions=<details className="desk-options current-reader-options" onKeyDown={event=>{if(event.key!=='Escape'||!event.currentTarget.open)return;event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector<HTMLElement>(':scope>summary')?.focus({preventScroll:true});}}><summary aria-label="Reading options" title="Reading options"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16M9 3v6M15 9v6M9 15v6"/></svg></summary><div>
   <span className="reader-source-context">{file?`${current.candidate?'Retained snapshot':'On disk'} · ${file.totalLines} lines${file.redacted?' · secrets redacted':''}`:'Current file not loaded'}</span>
   {!formatted&&workspace?.approved&&lineControls}
   <button className="btn ghost" disabled={!file} onClick={()=>void copy()}>Copy file</button>{fileActions}<FileReadingActions path={recordedPath??path} hideCaptured hideWorkspace/>
   {copied&&<span role="status">{copied}</span>}
  </div></details>;
  return <ReadingDialog title={path} windowId={explore?undefined:'File reader'} resetWindow={()=>setWidth(1040)} close={() => useApp.setState({ currentFile: undefined })} className={`current-file-reader${modern&&!explore?' file-peek-reader':''}`} modeless={explore||modern} floating={modern&&!explore} headerExtra={tabs} headerActions={peek?<>{returnToGit}{narrow?phoneOptions:fileActions}</>:undefined} style={explore ? undefined : { width: modern?undefined:`min(${width}px, calc(100vw - 28px))` }}>
    {file && readingVersion && file.modifiedAt !== readingVersion && <p className="small" role="status">This reading location was saved for another file version.</p>}
    {!explore && !modern && <ReadingResize value={width} minimum={640} maximum={1600} change={setWidth} reset={()=>setWidth(1040)} label="Resize current source reading space" fromRight />}
    {!peek&&<div className="current-file-meta"><EvidenceNavigation compact hideEmpty/><span className="tag" title="Checked disk snapshot · not a historical artifact">{current.candidate?'Retained':file?'On disk':'Current file'}</span>{fileActions}</div>}
    <SourceVersionNotice path={path} versions={current} accept={()=>{current.accept();setActiveLine(undefined);setReadingVersion(undefined);}}/>
    {markdown&&workspace?.approved&&<div className="current-document-views" role="group" aria-label="Markdown presentation"><button className="btn ghost" aria-pressed={formatted} onClick={()=>setDocumentMode(true)}>Document</button><button className="btn ghost" aria-pressed={!formatted} onClick={()=>setDocumentMode(false)}>Source</button></div>}
    {!formatted&&workspace?.approved&&<div className="current-source-tools"><SourceFind query={query} change={q => { setQuery(q); setActiveLine(undefined); }} matches={matches} activeLine={activeLine} move={moveMatch} label="Find in current source file" scopeLabel="this file" idleLabel="" compact={peek&&narrow} />
      {(!peek||!narrow)&&lineControls}

    </div>}
    {workspace?.approved&&!peek&&<ImportContext path={path} current hideEmpty />}
    {!workspace?<p className="current-reader-access" role="status">Checking workspace access…</p>:!workspace.approved&&<section className="current-reader-access" aria-label="Current file access"><h3>Read current files</h3><p>{workspace.root?`Approve reading in ${workspace.root}.`:'This session recorded no workspace on this machine.'}</p><button className="btn" disabled={granting||!workspace.root} onClick={()=>{setGranting(true);setGrantError('');void approve().catch(error=>setGrantError(error.message)).finally(()=>setGranting(false));}}>{granting?'Approving…':'Approve current-file reading'}</button>{grantError&&<p role="alert">{grantError}</p>}</section>}
    {error && <p className="bad" role="alert">{error} <button className="btn" onClick={() => void current.refresh()}>Retry current source</button></p>}
    {!file ? workspace?.approved&&!error&&<p className="muted" role="status">Reading current file…</p> : <>{oversized&&<p role="status" className="document-limit-note">{documentLimitMessage(documentSize)} Showing the source.</p>}<div key={formatted?'document':'source'} ref={code} id={peek?'current-file-peek-source':undefined} role={peek?'tabpanel':undefined} className={`current-file-code ${formatted?'desk-markdown':`source-reading${wrap?' wrap-source':''}`}`} tabIndex={0} aria-label={formatted?`Rendered document ${path}`:`Source ${path}`}>{formatted?<Markdown text={file.text} document/>:<WholeSource text={file.text} path={path} viewport={code} wrap={wrap} matches={new Set(matches)} activeLine={activeLine} revealLine={activeLine} revealRequest={revealRequest}/>}</div><footer><span title={`Current file version: ${file.modifiedAt}`}>{peek?(current.candidate?'Retained snapshot · ':'On disk · '):''}{file.totalLines} lines{file.redacted ? ' · secrets redacted' : ''}</span><button className="btn ghost" onClick={() => void copy()}>Copy file</button><span role="status">{copied}</span></footer></>}
  </ReadingDialog>;
}

/** Distance from the top of the offset-parent chain, ignoring CSS transforms (unlike getBoundingClientRect). */
export function layoutTop(element: HTMLElement): number {
  let top = 0;
  for (let current: HTMLElement | null = element; current; current = current.offsetParent as HTMLElement | null) top += current.offsetTop;
  return top;
}
export function PromptComposer() {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId);
  const recording = useApp(s => s.recording);
  const connection = useApp(s => s.connection);
  const { workspace, controller, submitting, error: connectionError, approve, refresh, submit, inspect, acknowledged, acknowledge } = useSessionWorkspace();
  // 'auto' collapses an idle composer to its pill so it never covers the newest work; the person's own open/close choice always wins.
  const [choice,setChoice]=useWorkspaceState<'auto'|'open'|'closed'>('composer/choice','auto');
  const now = useNowText();
  useEffect(()=>{if(controller?.inputRequests?.length)setChoice('open');},[controller?.inputRequests?.[0]?.id]);
  const [options, setOptions] = useState<TurnOptions>({});
  useEffect(() => { setOptions({}); }, [id]);
  const [prompt, updatePrompt] = useState(() => source && id ? promptDrafts(source).get(id) : '');
  const setPrompt = (text: string) => { if (source && id) promptDrafts(source).set(id, text); updatePrompt(text); };
  useEffect(() => { const changed = () => { if (source && id) { setChoice('open'); updatePrompt(promptDrafts(source).get(id)); requestAnimationFrame(() => input.current?.focus({ preventScroll: true })); } }; window.addEventListener('drishya-composer-draft', changed); return () => window.removeEventListener('drishya-composer-draft', changed); }, [source, id]);
  const exclusive=!!acknowledged, setExclusive=(value:boolean)=>acknowledge?.(value);
  const [remember,setRemember]=useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const element = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const focusPrompt = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.key !== 'Enter' || !event.shiftKey || !(event.ctrlKey || event.metaKey) || event.altKey || busy) return;
      const state = useApp.getState(), target = event.target;
      if (source?.kind !== 'daemon' || !id || id.includes('+') || state.screen !== 'viewer' || state.developerWorkspace || state.explore) return;
      if ([...document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"],[role="menu"],.desk-options[open],.workspace-menu[open],.permission-policy[open]')].some(node => node.getClientRects().length > 0)) return;
      // Editors and other fields own their chords. Inside our textarea this
      // shortcut only focuses/expands; it never inserts a line or submits.
      if (target instanceof Element && target.closest('input,textarea,[contenteditable],.cm-editor,.monaco-editor') && !element.current?.contains(target)) return;
      const node = element.current;
      if (!node || !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') return;
      event.preventDefault();
      document.documentElement.removeAttribute('data-ui-press');
      setChoice('open');
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('keydown', focusPrompt);
    return () => window.removeEventListener('keydown', focusPrompt);
  }, [source, id, busy]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  // Idle means nothing to send and nothing asking for the person; any request, run, failure or draft opens it.
  const needsAttention = !!controller?.inputRequests?.length || ['connecting', 'running', 'approval', 'failed'].includes(controller?.state ?? '') || !!error || !!controller?.error;
  const collapsed = choice === 'closed' || (choice === 'auto' && !prompt.trim() && !attachments.length && !needsAttention);
  const prepareCollapse = useSurfaceReflow(element, collapsed, id);
  const attachmentRef = useRef(attachments); attachmentRef.current = attachments;
  useEffect(()=>{if(!attachments.length)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[attachments.length]);
  const [preview, setPreview] = useState<PromptAttachment>();
  const rejectedFiles = useRef<File[]>([]);
  const [canRetryFiles, setCanRetryFiles] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPointer, setAddPointer] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (!addOpen) return;
    const fit = () => {
      const node = element.current;
      if (node) node.style.setProperty('--attachment-menu-height', `${Math.max(32, node.getBoundingClientRect().top - 16)}px`);
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [addOpen]);
  useEffect(() => {
    if (!addOpen) return;
    const dismiss = (event: Event) => { if (!(event.target instanceof Element) || !event.target.closest('.composer-add, .composer-add-menu')) { setAddPointer(event.type === 'pointerdown'); setAddOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setAddPointer(false); setAddOpen(false); element.current?.querySelector<HTMLButtonElement>('.composer-add')?.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('focusin', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('focusin', dismiss); document.removeEventListener('keydown', escape); };
  }, [addOpen]);
  const queuedFiles = useRef(0);
  const fileQueue = useRef(Promise.resolve());
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; rejectedFiles.current = []; }; }, []);
  const attach = async (files: File[]) => {
    if (!files.length) return;
    if (busy || controller && ['connecting', 'running', 'approval'].includes(controller.state)) { setError('Wait for the current turn, then attach the files again. They were not added.'); return; }
    if (files.length + queuedFiles.current + attachmentRef.current.length > 32) { setError('Select at most 32 files, including files being prepared.'); return; }
    queuedFiles.current += files.length;
    setLoadingFiles(true); setError(undefined); setAddOpen(false); setConfirmSend(false);
    const task = fileQueue.current.then(async () => {
      if (!active.current) return;
      try {
        const items = await promptFiles(files, attachmentRef.current);
        if (!active.current) return;
        attachmentRef.current = items; setAttachments(items);
        // A later successful selection must not erase an earlier rejected batch.
        rejectedFiles.current = rejectedFiles.current.filter(file => !files.includes(file));
        setCanRetryFiles(rejectedFiles.current.length > 0);
      } catch (e) {
        if (active.current) { rejectedFiles.current = files; setCanRetryFiles(true); setError((e as Error).message); }
      } finally {
        queuedFiles.current -= files.length;
        if (active.current) setLoadingFiles(queuedFiles.current > 0);
      }
    });
    fileQueue.current = task;
    await task;
  };
  useEffect(()=>{
    const receive=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.source!==source||detail?.id!==id||!Array.isArray(detail.files)||!detail.files.every((file:unknown)=>file instanceof File))return;
      if(busy||controller&&['connecting','running','approval'].includes(controller.state)){setError('Wait for the current turn, then prepare the file request again. Its attachment was not added.');return;}
      void attach(detail.files);
    };
    window.addEventListener('drishya-composer-files',receive);
    return()=>window.removeEventListener('drishya-composer-files',receive);
  },[source,id,busy,controller?.state]);
  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    const fit = () => {
      node.style.overflowY = 'hidden';
      node.style.height = 'auto';
      const style = getComputedStyle(node);
      // scrollHeight excludes borders; rounding otherwise leaves a needless one-pixel scrollbar.
      const required = node.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + 1;
      // UI-28: the Modern box grows with the prompt up to 40 % of the window (at most 240 px), then scrolls inside; the older box stays at 88 px.
      const limit = document.documentElement.dataset.uiVersion === 'modern' ? Math.max(88, Math.min(240, Math.floor(innerHeight * 0.4))) : 88;
      node.style.height = `${Math.min(limit, Math.ceil(required))}px`;
      node.style.overflowY = required > limit ? 'auto' : 'hidden';
      node.toggleAttribute('data-scrolls', required > limit);
    };
    fit();
    let width = node.clientWidth;
    const resize = new ResizeObserver(() => {
      if (node.clientWidth !== width) { width = node.clientWidth; fit(); }
    });
    resize.observe(node);
    window.addEventListener('resize', fit);
    return () => { resize.disconnect(); window.removeEventListener('resize', fit); };
  }, [prompt]);
  useLayoutEffect(() => {
    const node = element.current;
    const viewer = node?.closest<HTMLElement>('.viewer');
    if (!node || !viewer) return;
    // Absolute approval/queue surfaces sit outside the composer's border box.
    // Reserve their actual raised extent too, without feeding it back into the
    // composer's own size constraints or changing the user's follow preference.
    const observed = new Set<Element>();
    const measure = () => {
      // UI-28b: the gap other surfaces reserve is the box at rest. A long prompt grows the box upward over the history instead of moving
      // the history, the Follow switch, the rails and the Toolbox, so the textarea's growth past one line is not part of it.
      const field = node.querySelector('textarea');
      const grown = field ? Math.max(0, field.offsetHeight - (parseFloat(getComputedStyle(field).minHeight) || 0)) : 0;
      viewer.style.setProperty('--composer-gap', `${node.offsetHeight - grown + 24}px`);
      // Layout offsets, not bounding rectangles: useSurfaceReflow scales this node (and so the approval inside it) for 200 ms,
      // and a scaled rectangle would store only a fraction of the real raised extent with nothing to remeasure afterwards.
      const top = layoutTop(node);
      let raised = 0;
      for (const surface of node.querySelectorAll<HTMLElement>('.native-turn-details, .queued-input-receipts')) {
        if (!observed.has(surface)) { observer.observe(surface); observed.add(surface); }
        if (!surface.getClientRects().length) continue;
        if (surface.matches('.queued-input-receipts') && surface.querySelector('button')?.checkVisibility({ visibilityProperty: true }) === false) continue;
        raised = Math.max(raised, top - layoutTop(surface));
      }
      viewer.style.setProperty('--composer-raised-gap', `${Math.ceil(raised)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const children = new MutationObserver(measure);
    // A receipt's visibility is an inline style that follows the Follow switch; it changes neither size nor children.
    children.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'data-waiting'] });
    measure();
    return () => { observer.disconnect(); children.disconnect(); viewer.style.removeProperty('--composer-gap'); viewer.style.removeProperty('--composer-raised-gap'); };
  }, [source, id]);
  if (source?.kind !== 'daemon' || !id || id.includes('+')) return source?.kind === 'bundle' && id ? <QueuedInputs standalone/> : null;
  const running = controller && ['connecting', 'running', 'approval'].includes(controller.state);
  const promptBytes = utf8Bytes(prompt);
  const overLimit = promptBytes > PROMPT_BYTES;
  const sizeNote = promptSizeNote(promptBytes, { count: attachments.length, bytes: attachments.reduce((sum, item) => sum + attachmentBytes(item), 0) });
  const unavailable = !!connectionError || connection !== 'connected';
  const cannotSend = busy || loadingFiles || queuedFiles.current > 0 || !prompt.trim() || overLimit || unavailable || !workspace?.approved || !controller?.available;
  // AUDIT-1 (5 Nov): a disabled Send said only "Send prompt"; it now names the first thing it waits for.
  const sendWaits = sendWaitReason({ unavailable, approved: !!workspace?.approved, cliAvailable: !!controller?.available, overLimit, sending: busy, attaching: loadingFiles || queuedFiles.current > 0, hasPrompt: !!prompt.trim() });
  const statusLabel = unavailable ? 'Connection unavailable' : submitting ? 'Sending…' : busy ? 'Working…' : !controller ? 'Checking…' : !controller.available ? 'CLI unavailable' : !workspace?.approved ? 'Workspace access required' : controller.state === 'failed' ? 'Turn failed' : controller.state === 'stopped' ? 'Stopped' : controller.inputRequests?.length ? 'Answer requested' : controller.state === 'approval' ? 'Approval needed' : controller.state === 'connecting' ? 'Connecting…' : controller.state === 'running' ? controller.phase === 'thinking' ? 'Thinking…' : 'Running here' : 'Ready';
  // Watching needs no permission, so the live line may replace a state that only invites setup.
  const quietStatus = statusLabel === 'Ready' || statusLabel === 'Workspace access required';
  // UI-28: a person reads the composer's status only when something is happening or wrong. 'Ready', 'Checking…' and the setup states say
  // nothing here (setup has its own row), and the line "replied 3 m ago" / "live" is not shown: only open work or a question to the person.
  const liveNow = now && ['running', 'asking', 'working'].includes(now.tone) ? now : undefined;
  const calm = quietStatus || statusLabel === 'Checking…' || statusLabel === 'CLI unavailable';
  const stateText = quietStatus && liveNow ? liveNow.text : calm ? '' : statusLabel;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await fn(); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const settingsModels = controller?.settings?.models ?? [];
  const modelId = options.model ?? controller?.settings?.model;
  const modelEfforts = settingsModels.find(model => model.id === modelId)?.efforts ?? [];
  const modelLabel = settingsModels.find(model => model.id === modelId)?.name ?? modelId ?? 'Default model';
  const connectionSetup = <>      {!workspace?.approved && <><button className="btn" disabled={busy || !workspace?.root} onClick={() => void act(()=>approve(modern&&remember))}>Enable this workspace</button>{modern&&<label><input type="checkbox" checked={remember} disabled={busy} onChange={event=>setRemember(event.target.checked)} /> Remember for this checkout</label>}</>}
      {controller && !controller.available && <details className="cli-setup" open><summary>Connect your {recording?.harness === 'codex' ? 'Codex' : 'Claude Code'} CLI</summary>{recording?.harness === 'codex' ? <><p>In a terminal, install and sign in:</p><code>npm install -g @openai/codex</code><code>codex login</code><p>If the command is not found, reopen the terminal or use <code>npx @openai/codex login</code>. Drishya also checks standard Windows installations automatically.</p></> : <p>Install the native Claude Code CLI and sign in using its terminal client.</p>}<button type="button" onClick={() => void refresh()}>Check again</button></details>}
</>;
  const nativeOptions = <>      <details className="permission-policy native-options"><summary>{modern ? <><svg className="native-options-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg><span>Connection & permissions</span></> : <>{options.model ?? controller?.settings?.model ?? 'Native settings'} · {controller?.settings?.permission ?? 'Native policy'}</>}</summary><div className="native-options-menu">{modern && connectionSetup}<small title={workspace?.root}>Target: {workspace?.root ?? 'Workspace unavailable'} · recording {id.slice(-8)}</small><small>Native settings describe the last reported policy; the harness validates permissions when connecting.</small>
        <button disabled={!!running || busy || !workspace?.approved} onClick={() => inspect && void act(inspect)}>Read native settings</button>
        {!!controller?.settings && <><small>{controller.settings.scope === 'connected-session' ? 'Connected session' : 'Workspace defaults'} · {controller.settings.permission ?? 'Policy reported after connecting'}{controller.settings.sandbox && ` · ${controller.settings.sandbox}`}</small>
          <label>Model<select disabled={!!running || busy} value={options.model ?? ''} onChange={e => { setOptions(e.target.value ? { model: e.target.value } : {}); setConfirmSend(false); }}><option value="">Use native default</option>{controller.settings.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
          <label>Effort<select disabled={!!running || busy} value={options.effort ?? ''} onChange={e => { setOptions({ ...options, effort: e.target.value || undefined }); setConfirmSend(false); }}><option value="">Use native default</option>{controller.settings.models.find(model => model.id === (options.model ?? controller.settings?.model))?.efforts.map(effort => <option key={effort} value={effort}>{effort}</option>)}</select></label>
        </>}
        <small>Each Allow once applies only to its native request. Full access and global settings remain in the native CLI.</small>
      </div></details></>;
  if (workspace && !workspace.root) return <section ref={element} className="prompt-composer open composer-readonly" aria-label="Harness prompt"><div><strong>{recording?.harness === 'codex' ? 'Codex' : 'Claude Code'} recording</strong><span>Read-only here · no workspace path was recorded.</span></div><button className="btn ghost" onClick={() => { location.hash = ''; useApp.setState({ screen: 'home', playing: false }); }}>Choose session</button></section>;
  return <section ref={element} className={`prompt-composer open${modern ? ' modern-native-composer' : ''}${modern && collapsed?' composer-minimized':''}`} aria-label="Harness prompt" aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter">
    {modern && <button type="button" className="composer-minimize" data-now={collapsed&&liveNow?liveNow.tone:undefined} title={collapsed&&liveNow?liveNow.basis:statusLabel} aria-label={collapsed?'Expand prompt':'Minimize prompt'} aria-expanded={!collapsed} onClick={()=>{prepareCollapse();setChoice(collapsed?'open':'closed');if(collapsed)requestAnimationFrame(()=>input.current?.focus({preventScroll:true}));}}><span data-surface-label={collapsed?'':undefined}>{collapsed?controller?.inputRequests?.length?'Answer waiting':controller?.state==='approval'?'Approval waiting':unavailable?'Connection unavailable':error||controller?.error||controller?.state==='failed'?'Needs attention':running?'Agent working…':controller&&!controller.available?'CLI unavailable':liveNow?liveNow.text:'Ask your agent…':'⌄'}</span></button>}
    {modern && collapsed && running && <button type="button" className="composer-mini-stop" aria-label="Stop turn" title="Stop this turn" disabled={busy} onClick={() => void act(() => workspaceApi.stop(id, controller.runId!))}><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" /></svg></button>}
    {modern ? <div className="modern-composer-top"><div className="modern-composer-target"><span className="modern-composer-identity" title={`${workspace?.root ?? 'Workspace unavailable'}\nRecording: ${id}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></svg></span><span className="modern-composer-location" title={workspace?.root}><span>{workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Checking workspace…'}</span></span></div>{stateText&&<span role="status" className="modern-composer-state" data-now={quietStatus&&liveNow?liveNow.tone:undefined} title={quietStatus&&liveNow?liveNow.basis:statusLabel}>{stateText}</span>}</div> : <>
    <div className="composer-target"><span title={`${workspace?.root ?? 'Workspace unavailable'}\nRecording: ${id}`}><strong>{recording?.harness === 'codex' ? 'Codex' : recording?.harness === 'claude-code' ? 'Claude Code' : recording?.harness ?? 'Native harness'}</strong><span className="composer-workspace">{workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Selected session'}</span><code>{id.slice(-8)}</code></span><small role="status">{statusLabel}</small></div></>}

      {!modern && connectionSetup}
      {modern && (!workspace?.approved || (controller && !controller.available)) && <div className="composer-setup" role="group" aria-label="Connect this session">{!workspace?.approved && <p>Enable this workspace to send prompts from here.</p>}{connectionSetup}</div>}
      <input hidden ref={fileInput} type="file" multiple aria-label="Choose prompt files" onChange={e => { void attach([...e.currentTarget.files ?? []]); e.currentTarget.value = ''; }} />
      <input hidden ref={folderInput} type="file" multiple {...{ webkitdirectory: '' }} aria-label="Choose prompt folder" onChange={e => { void attach([...e.currentTarget.files ?? []]); e.currentTarget.value = ''; }} />
      <form onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); void attach([...e.dataTransfer.files]); } }} onSubmit={e => { e.preventDefault(); if (running || cannotSend) return; if (!exclusive) { setConfirmSend(true); return; } setConfirmSend(false); void act(async () => { await submit(prompt, exclusive, attachments, options); setPrompt(''); attachmentRef.current = []; setAttachments([]); setPreview(undefined); rejectedFiles.current = []; setCanRetryFiles(false); setConfirmSend(false); }); }}>
        {!!attachments.length && <div className="prompt-attachments" aria-label="Prompt attachments">{attachments.map((a, index) => <span className="attachment-chip" key={`${index}/${a.name}`} title={a.name}>{a.type === 'image' && <img alt={`Preview ${a.name}`} src={`data:${a.mime};base64,${a.data}`} />}<button type="button" className="attachment-preview" onClick={() => setPreview(a)} aria-label={`Preview attachment ${a.name}`}>{a.name}</button><button type="button" disabled={!!running || busy || loadingFiles} aria-label={`Remove attachment ${a.name}`} onClick={() => { attachmentRef.current = attachmentRef.current.filter((_, i) => i !== index); setAttachments(attachmentRef.current); if (preview === a) setPreview(undefined); setConfirmSend(false); }}>×</button></span>)}</div>}
        <textarea ref={input} aria-label="Prompt for selected harness session" placeholder={running ? 'Draft your next prompt…' : document.documentElement.dataset.uiVersion === 'modern' ? 'Ask your agent to build, investigate, or continue…' : 'Ask your agent…'} rows={1} aria-invalid={overLimit || undefined} aria-describedby="prompt-size-status" onPaste={e => { const files = pastedFiles(e.clipboardData); if (files.length) { e.preventDefault(); void attach(files); } }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} value={prompt} maxLength={65_536} disabled={busy} onChange={e => { setPrompt(e.target.value); setConfirmSend(false); }} />
      <small id="prompt-size-status" className={sizeNote.over ? 'bad' : sizeNote.quiet ? 'sr-only' : 'muted'} role={sizeNote.over ? 'alert' : undefined}>{sizeNote.text}</small>
        <div className="composer-actions">{modern ? <div className="modern-composer-input-tools">
          <ComposerMenu label="Attach" className="composer-attach" disabled={!!running || busy || loadingFiles} title="Attach images, files or a folder" trigger={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>} items={[
            { key: 'files', label: 'Images or files', hint: 'PNG, JPEG, WebP, GIF or text · paste or drop works too', select: () => fileInput.current?.click() },
            { key: 'folder', label: 'Folder contents', hint: 'Up to 32 files in total', select: () => folderInput.current?.click() },
          ]} />
          {controller && <ComposerMenu label="Model" className="composer-model" disabled={!!running || busy} title="Model for the next prompt" trigger={<><span>{modelLabel}</span><svg className="composer-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></>} items={[
            { key: 'default', label: 'Default', hint: settingsModels.find(model => model.id === controller.settings?.model)?.name, checked: !options.model, select: () => { setOptions({}); setConfirmSend(false); } },
            ...settingsModels.map(model => ({ key: model.id, label: model.name, checked: options.model === model.id, select: () => { setOptions({ model: model.id }); setConfirmSend(false); } })),
            ...(settingsModels.length ? [] : [{ key: 'load', label: 'Load model list', hint: workspace?.approved ? `Asks ${recording?.harness === 'codex' ? 'Codex' : 'Claude Code'} which models it offers` : 'Enable this workspace first', disabled: !workspace?.approved || !inspect, select: () => inspect && void act(inspect) }]),
          ]} />}
          {!!modelEfforts.length && <ComposerMenu label="Reasoning effort" className="composer-effort" disabled={!!running || busy} title="Reasoning effort for the next prompt" trigger={<><span>{options.effort ?? 'Default effort'}</span><svg className="composer-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></>} items={[
            { key: 'default', label: 'Default', checked: !options.effort, select: () => { setOptions({ ...options, effort: undefined }); setConfirmSend(false); } },
            ...modelEfforts.map(effort => ({ key: effort, label: effort, checked: options.effort === effort, select: () => { setOptions({ ...options, effort }); setConfirmSend(false); } })),
          ]} />}
        </div> : <button type="button" className="composer-add" aria-label="Add files or folders" aria-expanded={addOpen} disabled={!!running || busy || loadingFiles} onClick={e => { setAddPointer(e.detail > 0); setAddOpen(!addOpen); }}>+</button>}{loadingFiles && <small role="status">Preparing files…</small>}{running ? <button type="button" disabled={busy} onClick={() => void act(() => workspaceApi.stop(id, controller.runId!))} aria-label="Stop turn" className="stop-turn" title="Stop this turn"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" /></svg>{modern && <span>Stop</span>}</button> : <button type="submit" className="send-prompt" aria-label="Send prompt" title={cannotSend ? sendWaits : 'Send prompt'} disabled={cannotSend}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5m-4 4 4-4 4 4" /></svg></button>}</div>
        {!modern && <div className="composer-add-menu" hidden={!addOpen} data-pointer-menu={addPointer ? '' : undefined}><button type="button" onClick={() => fileInput.current?.click()}>Files or images</button><button type="button" onClick={() => folderInput.current?.click()}>Folder contents</button><small>Text/code and PNG, JPEG, WebP, GIF · 32 files maximum. Paste screenshots or drop files here. Text secrets are scrubbed; check images before sending.</small></div>}
        {confirmSend && <div className="send-confirmation" role="group" aria-label="Confirm session access"><label><input type="checkbox" checked={exclusive} onChange={e => setExclusive(e.target.checked)} /> This session is idle in other clients</label><small>Finish any turn in another client before sending here.</small><button type="submit" disabled={!exclusive || cannotSend}>Confirm and send</button><button type="button" onClick={() => { setConfirmSend(false); setExclusive(false); }}>Cancel</button></div>}
      </form>
      {!modern && nativeOptions}
      {canRetryFiles && <button className="btn ghost small" disabled={loadingFiles || busy || !!running} onClick={() => void attach(rejectedFiles.current)}>Retry rejected files</button>}
      {preview && <ReadingDialog title={`Attachment: ${preview.name}`} close={() => setPreview(undefined)} className="attachment-preview-dialog"><p className="muted">Prepared locally · not sent. Text is redacted by the server before submission; inspect images for secrets.</p>{preview.type === 'image' ? <img alt={preview.name} src={`data:${preview.mime};base64,${preview.data}`} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} /> : <><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight:'60dvh',overflow:'auto' }}>{preview.data}</pre></>}</ReadingDialog>}

      <QueuedInputs/>
      <div className="native-turn-details">
      {(error || connectionError || controller?.error) && <p className="bad small" role="alert">{error ?? connectionError ?? controller?.error}{connectionError && <button className="btn ghost small" disabled={busy} onClick={() => void act(refresh)}>Retry native connection</button>}</p>}
      {controller?.promptRedacted && <p className="muted small">Detected secrets were removed before sending this prompt.</p>}
      {controller?.inputRequests?.map(request=><NativeQuestions key={`${controller.runId}/${request.id}`} request={request} busy={busy||connection!=='connected'} answer={answers=>void act(()=>workspaceApi.answer(id,controller.runId!,request.id,answers))} stop={()=>void act(()=>workspaceApi.stop(id,controller.runId!))}/>)}
      {controller?.approvals.map(p => <NativeApproval key={p.id} request={p} busy={busy} decide={allow=>void act(()=>workspaceApi.decide(id,controller.runId!,p.id,allow))}/>)}
      </div>
  </section>;
}
