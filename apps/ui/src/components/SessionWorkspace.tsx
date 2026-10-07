import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { workspaceApi, type WorkspaceStatus, type ControllerStatus, type CurrentFile } from '../api.ts';
import { useApp } from '../state.ts';
import { CodeView } from './common.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { FileIcon } from './FileIcon.tsx';

interface Connection {
  workspace?: WorkspaceStatus; controller?: ControllerStatus; error?: string;
  refresh: () => Promise<void>; approve: () => Promise<void>;
}
const SessionContext = createContext<Connection>({ refresh: async () => {}, approve: async () => {} });
export const useSessionWorkspace = () => useContext(SessionContext);

export function SessionWorkspaceProvider({ children }: { children: ReactNode }) {
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const [workspace, setWorkspace] = useState<WorkspaceStatus>();
  const [controller, setController] = useState<ControllerStatus>();
  const [error, setError] = useState<string>();
  const eligible = source?.kind === 'daemon' && !!id && !id.includes('+');
  const refresh = async () => {
    if (!eligible) return;
    const [w, c] = await Promise.all([workspaceApi.status(id!), workspaceApi.controller(id!)]);
    if (useApp.getState().recordingId !== id) return;
    setWorkspace(w); setController(c); setError(undefined);
  };
  useEffect(() => {
    setWorkspace(undefined); setController(undefined); setError(undefined);
    let active = true; let busy = false;
    const load = async () => {
      if (!active || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try { await refresh(); } catch (e) { if (active) setError((e as Error).message); } finally { busy = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 1800);
    return () => { active = false; clearInterval(timer); };
  }, [id, source]);
  const approve = async () => {
    if (!eligible) return;
    const w = await workspaceApi.approve(id!);
    const graph = await source!.graph(id!);
    if (useApp.getState().recordingId !== id) return;
    setWorkspace(w); useApp.setState({ graph });
  };
  return <SessionContext.Provider value={{ workspace, controller, error, refresh, approve }}>{children}</SessionContext.Provider>;
}

/** Directory structure from this session's indexed root, never the daemon's own checkout. */
export function FolderExplorer({ scene, projection }: { scene: Scene; projection: Projection }) {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId);
  const graph = useApp(s => s.graph);
  const files = useApp(s => s.projection?.files);
  const hidden = useApp(s => s.foldersHidden);
  const { workspace, approve } = useSessionWorkspace();
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState(() => {
    const initial = new Set<string>(['']);
    // Open the bounded recorded working set; other folders start collapsed.
    for (const file of projection.files.slice(0, 32)) {
      const parts = file.path.split('/');
      for (let n = 1; n < parts.length; n++) initial.add(parts.slice(0, n).join('/'));
    }
    return initial;
  });
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (graph || !source || !id) return;
    let active = true;
    void source.graph(id).then(g => { if (active && useApp.getState().recordingId === id) useApp.setState({ graph: g }); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [source, id, graph]);
  const paths = useMemo(() => [...new Set((graph?.nodes.map(n => n.path) ?? files?.map(f => f.path) ?? []).filter(p => !(graph?.temporal === 'current' && p.startsWith('.local/')) && !p.startsWith('/') && !/^[A-Za-z]:/.test(p)))].sort(), [graph, files]);
  const tree = useMemo(() => {
    if (query.trim()) return paths.filter(p => p.toLowerCase().includes(query.toLowerCase())).map(path => ({ path, folder: false, depth: 0, name: path }));
    const rows: { path: string; folder: boolean; depth: number; name: string }[] = [];
    const seen = new Set<string>();
    for (const path of paths) {
      const parts = path.split('/'); let parent = '';
      for (let i = 0; i < parts.length; i++) {
        if (!opened.has(parent)) break;
        const next = parent ? `${parent}/${parts[i]}` : parts[i]!;
        if (!seen.has(next)) { rows.push({ path: next, folder: i < parts.length - 1, depth: i, name: parts[i]! }); seen.add(next); }
        parent = next;
      }
    }
    return rows;
  }, [paths, query, opened]);
  useEffect(() => setPage(0), [query, opened]);
  const rootName = workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Session files';
  if (hidden) return null;
  return <aside className="folder-explorer spine" aria-label="Session folders">
    <header><div className="folder-root" title={workspace?.root}>{rootName}</div><button className="icon-btn" aria-label="Minimize folders" onClick={() => useApp.setState({ foldersHidden: true })}>‹</button></header>
    <input aria-label="Find session files" placeholder="Find files…" value={query} onChange={e => setQuery(e.target.value)} />
    {source?.kind === 'daemon' && !id?.includes('+') && workspace?.root && !workspace.approved && <button className="workspace-grant" onClick={() => void approve().catch(e => setError(e.message))}>Enable workspace reading<small>Read current files in this folder</small></button>}
    {error && <p className="bad small" role="alert">{error}</p>}
    <div className="folder-tree" role="tree" aria-label="Workspace files">
      {tree.slice(page * 120, (page + 1) * 120).map(row => <button className={row.folder ? 'folder-row' : 'spine-file'} role="treeitem" aria-level={row.depth + 1} aria-expanded={row.folder ? opened.has(row.path) : undefined} key={row.path} data-spine-path={row.folder ? undefined : row.path} style={{ paddingLeft: 8 + Math.min(row.depth, 12) * 12 }} title={row.path} onMouseEnter={() => !row.folder && useApp.setState({ hoveredPath: row.path })} onMouseLeave={() => useApp.setState({ hoveredPath: undefined })} onClick={() => {
        useApp.setState({ follow: false, playing: false, held: true });
        if (row.folder) setOpened(prev => { const next = new Set(prev); next.has(row.path) ? next.delete(row.path) : next.add(row.path); return next; });
        else useApp.setState(workspace?.approved ? { currentFile: row.path } : { filePanel: row.path });
      }}><span className="folder-disclosure" aria-hidden="true">{row.folder ? opened.has(row.path) ? '⌄' : '›' : ''}</span><FileIcon path={row.path} folder={row.folder} open={opened.has(row.path)} /><span>{row.name}</span></button>)}
      {!tree.length && <p className="muted small">{query ? 'No matching files' : 'No relative paths captured yet'}</p>}
    </div>
    {tree.length > 120 && <div className="folder-pages"><button disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1} / {Math.ceil(tree.length / 120)}</span><button disabled={(page + 1) * 120 >= tree.length} onClick={() => setPage(p => p + 1)}>Next</button></div>}
  </aside>;
}

export function CurrentFileReader() {
  const path = useApp(s => s.currentFile);
  const id = useApp(s => s.recordingId);
  if (!path || !id) return null;
  return <CurrentDocument key={`${id}/${path}`} id={id} path={path} />;
}
function CurrentDocument({ id, path }: { id: string; path: string }) {
  const [start, setStart] = useState(0);
  const [file, setFile] = useState<CurrentFile>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setFile(undefined); setError(undefined);
    void workspaceApi.file(id, path, start).then(f => { if (active) setFile(f); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id, path, start, retry]);
  return <ReadingDialog title={path} close={() => useApp.setState({ currentFile: undefined })} className="current-file-reader">
    <div className="current-file-meta"><span className="tag">Current disk · not a historical snapshot</span><button className="btn ghost" onClick={() => setRetry(r => r + 1)}>Refresh</button><button className="btn ghost" onClick={() => useApp.setState({ currentFile: undefined, filePanel: path })}>Recorded work on this file</button></div>
    {error ? <p className="bad" role="alert">{error}</p> : !file ? <p className="muted">Reading current file…</p> : <><div className="current-file-code"><CodeView text={file.text} path={path} startLine={file.start + 1} /></div><footer><span>Lines {file.start + 1}–{file.start + file.returnedLines} of {file.totalLines}{file.redacted ? ' · secrets redacted' : ''}</span><button disabled={!start} onClick={() => setStart(s => Math.max(0, s - 200))}>Previous lines</button><button disabled={!file.hasMore} onClick={() => setStart(s => s + 200)}>Next lines</button><button onClick={() => void navigator.clipboard.writeText(file.text)}>Copy visible page</button></footer></>}
  </ReadingDialog>;
}

export function PromptComposer() {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId);
  const recording = useApp(s => s.recording);
  const { workspace, controller, error: connectionError, approve, refresh } = useSessionWorkspace();
  const [prompt, setPrompt] = useState('');
  const [exclusive, setExclusive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const element = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = element.current;
    const viewer = node?.closest<HTMLElement>('.viewer');
    if (!node || !viewer) return;
    // The ordinary composer owns space; it must not cover the last captured result.
    const observer = new ResizeObserver(() => viewer.style.setProperty('--composer-gap', `${node.getBoundingClientRect().height + 24}px`));
    observer.observe(node);
    return () => { observer.disconnect(); viewer.style.removeProperty('--composer-gap'); };
  }, [source, id]);
  if (source?.kind !== 'daemon' || !id || id.includes('+')) return null;
  const running = controller && ['connecting', 'running', 'approval'].includes(controller.state);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await fn(); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section ref={element} className="prompt-composer open" aria-label="Harness prompt">
    <div className="composer-target sr-only"><small title={workspace?.root}>{workspace?.root?.replace(/\\/g, '/').split('/').at(-1) ?? 'Selected session'} · {controller?.state ?? 'checking'}</small></div>
      {!workspace?.approved && <button className="btn" disabled={busy || !workspace?.root} onClick={() => void act(approve)}>Enable this workspace</button>}
      {controller && !controller.available && <p className="muted small">Install the native {recording?.harness === 'codex' ? 'Codex' : 'Claude Code'} CLI and sign in there, then restart Drishya.</p>}
      <form onSubmit={e => { e.preventDefault(); if (running || busy || !prompt.trim() || !workspace?.approved || !controller?.available || !exclusive) return; void act(async () => { await workspaceApi.prompt(id, prompt, exclusive); setPrompt(''); }); }}>
        <textarea aria-label="Prompt for selected harness session" placeholder="Ask your agent…" rows={1} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} value={prompt} maxLength={65_536} disabled={!!running || busy} onChange={e => { setPrompt(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(120, e.currentTarget.scrollHeight)}px`; }} onFocus={() => useApp.setState({ follow: false, held: true, playing: false })} />
        <div className="composer-actions"><button type="button" className="composer-add" aria-label="Add files or folders (coming later)" title="File and folder attachments are planned; not available yet" disabled>+</button>{!!prompt.trim() && <label title="Finish the turn in other native clients before submitting here"><input type="checkbox" checked={exclusive} disabled={!!running} onChange={e => setExclusive(e.target.checked)} /> This session is idle in other clients</label>}{running ? <button type="button" disabled={busy} onClick={() => void act(() => workspaceApi.stop(id, controller.runId!))}>Stop turn</button> : <button type="submit" className="send-prompt" disabled={busy || !prompt.trim() || !workspace?.approved || !controller?.available || !exclusive}>Send prompt ↗</button>}</div>
      </form>
      <span className="composer-note">Native session · conservative permissions</span>
      {(error || connectionError || controller?.error) && <p className="bad small" role="alert">{error ?? connectionError ?? controller?.error}</p>}
      {controller?.promptRedacted && <p className="muted small">Detected secrets were removed before sending this prompt.</p>}
      {controller?.approvals.map(p => <div className="tool-approval" key={p.id}><strong>{p.name} · approval requested</strong><pre>{p.detail}</pre><button disabled={busy} onClick={() => void act(() => workspaceApi.decide(id, controller.runId!, p.id, false))}>Decline</button><button disabled={busy} onClick={() => void act(() => workspaceApi.decide(id, controller.runId!, p.id, true))}>Allow once</button></div>)}
      {controller?.output && <details className="controller-receipt"><summary>Native response · {controller.state}</summary><pre>{controller.output}</pre></details>}
  </section>;
}
