import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { workspaceApi, type WorkspaceStatus, type ControllerStatus, type CurrentFile, type PromptAttachment, type TurnOptions } from '../api.ts';
import { promptFiles } from '../lib/prompt-files.ts';
import { useApp } from '../state.ts';
import { CodeView } from './common.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { FileIcon } from './FileIcon.tsx';
import { SourceFind } from './SourceFind.tsx';
import { ReadingResize } from './ReadingResize.tsx';
import { ImportContext } from './ImportContext.tsx';

interface Connection {
  submitting?: boolean; submit: (prompt: string, exclusive: boolean, attachments?: PromptAttachment[], options?: TurnOptions) => Promise<void>;
  workspace?: WorkspaceStatus; controller?: ControllerStatus; error?: string;
  refresh: () => Promise<void>; approve: () => Promise<void>; inspect?: () => Promise<void>;
}
const SessionContext = createContext<Connection>({ refresh: async () => {}, approve: async () => {}, submit: async () => {} });
export const useSessionWorkspace = () => useContext(SessionContext);

export function SessionWorkspaceProvider({ children }: { children: ReactNode }) {
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
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
    const [w, c] = await Promise.all([workspaceApi.status(id!), workspaceApi.controller(id!)]);
    if (useApp.getState().recordingId !== id || request !== revision.current) return;
    setWorkspace(w); setController(c); setError(undefined);
  };
  useEffect(() => {
    setWorkspace(undefined); setController(undefined); setError(undefined); setSubmitting(false);
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
  useEffect(() => { if (['connecting', 'running', 'approval'].includes(controller?.state ?? '')) wake.current?.(); }, [controller?.state]);
  const approve = async () => {
    if (!eligible) return;
    const w = await workspaceApi.approve(id!);
    const graph = await source!.graph(id!);
    if (useApp.getState().recordingId !== id) return;
    setWorkspace(w); useApp.setState({ graph });
  };
  const inspect = async () => {
    if (!eligible) return;
    const state = await workspaceApi.settings(id!);
    if (useApp.getState().recordingId === id) { ++revision.current; setController(state); }
  };
  const submit = async (prompt: string, exclusive: boolean, attachments?: PromptAttachment[], options?: TurnOptions) => {
    if (!eligible) return;
    setSubmitting(true);
    ++revision.current;
    try { const state = await workspaceApi.prompt(id!, prompt, exclusive, attachments, options); if (useApp.getState().recordingId === id) { ++revision.current; setController(state); } }
    finally { if (useApp.getState().recordingId === id) setSubmitting(false); }
  };
  return <SessionContext.Provider value={{ workspace, controller, submitting, submit, error, refresh, approve, inspect }}>{children}</SessionContext.Provider>;
}

/** Native live receipt is separate from persisted evidence and disappears on capture. */
export function NativeTurn({ projection }: { projection: Projection }) {
  const { controller, submitting } = useSessionWorkspace();
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
    {(submitting || running) && <p className="native-phase" role="status">{phase}</p>}
    {visible && <div className="prose" data-native-preview={preview.id}><small className="muted">Live from harness · {preview.role === 'reasoning' ? preview.exposure === 'summary' ? 'reasoning summary' : 'exposed thinking' : 'response'}</small>{preview.role === 'reasoning' && detail === 'collapsed' ? <details><summary>Read exposed reasoning</summary><pre>{preview.text}</pre></details> : <pre>{preview.text}</pre>}</div>}
  </section>;
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
    <label className="ux-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input aria-label="Find session files" placeholder="Find files…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Clear file search" onClick={() => setQuery('')}>×</button>}</label>
    {source?.kind === 'daemon' && !id?.includes('+') && workspace?.root && !workspace.approved && <button className="workspace-grant" onClick={() => void approve().catch(e => setError(e.message))}>Enable workspace reading<small>Read current files in this folder</small></button>}
    {error && <p className="bad small" role="alert">{error}</p>}
    <div className="folder-tree" role="tree" aria-label="Workspace files">
      {tree.slice(page * 120, (page + 1) * 120).map(row => <button className={row.folder ? 'folder-row' : 'spine-file'} role="treeitem" aria-level={row.depth + 1} aria-expanded={row.folder ? opened.has(row.path) : undefined} key={row.path} data-spine-path={row.folder ? undefined : row.path} style={{ paddingLeft: 8 + Math.min(row.depth, 12) * 12 }} title={row.path} onMouseEnter={() => !row.folder && useApp.setState({ hoveredPath: row.path })} onMouseLeave={() => useApp.setState({ hoveredPath: undefined })} onClick={() => {
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
  const explore = useApp(s => s.explore);
  const [start, setStart] = useState(0);
  const [file, setFile] = useState<CurrentFile>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [activeLine, setActiveLine] = useState<number>();
  const [lineInput, setLineInput] = useState('');
  const [lineError, setLineError] = useState<string>();
  const [wrap, setWrap] = useState(false);
  const [width, setWidth] = useState(1040);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [copied, setCopied] = useState('');
  const code = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true; setFile(undefined); setError(undefined);
    void workspaceApi.file(id, path, start).then(f => { if (active) setFile(f); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id, path, start, retry]);
  useEffect(() => { setFrom(''); setTo(''); setCopied(''); }, [start, retry]);
  useLayoutEffect(() => { if (activeLine !== undefined) code.current?.querySelector(`[data-source-line="${activeLine}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); }, [activeLine, file]);
  const lines = file?.text.replace(/\n$/, '').split('\n') ?? [];
  const matches = query ? lines.flatMap((line, index) => line.toLowerCase().includes(query.toLowerCase()) ? [start + index + 1] : []) : [];
  const moveMatch = (direction: 1 | -1) => {
    if (!matches.length) return;
    const current = matches.indexOf(activeLine ?? -1);
    setActiveLine(matches[current < 0 ? direction === 1 ? 0 : matches.length - 1 : (current + direction + matches.length) % matches.length]);
  };
  const go = () => {
    const line = Number(lineInput);
    if (!file || !/^\d+$/.test(lineInput) || !Number.isSafeInteger(line) || line < 1 || line > file.totalLines) { setLineError(`Choose a line from 1 to ${file?.totalLines ?? 0}`); return; }
    setLineError(undefined); setActiveLine(line);
    if (line <= start || line > start + file.returnedLines) setStart(Math.floor((line - 1) / 200) * 200);
  };
  const copy = async (range = false) => {
    if (!file) return;
    const first = from ? Number(from) : start + 1;
    const last = to ? Number(to) : start + file.returnedLines;
    if (range && ((from && !/^\d+$/.test(from)) || (to && !/^\d+$/.test(to)) || !Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < start + 1 || last > start + file.returnedLines || last < first)) { setCopied('Choose a range within the loaded page.'); return; }
    try { await navigator.clipboard.writeText(range ? lines.slice(first - start - 1, last - start).join('\n') : file.text); setCopied(range ? `Copied lines ${first}–${last}` : 'Copied visible page'); }
    catch { setCopied('Copy unavailable · select the text to copy.'); }
  };
  return <ReadingDialog title={path} close={() => useApp.setState({ currentFile: undefined })} className="current-file-reader" modeless={explore} style={explore ? undefined : { width: `min(${width}px, calc(100vw - 28px))` }}>
    {!explore && <ReadingResize value={width} minimum={640} maximum={1600} change={setWidth} label="Resize current source reading space" fromRight />}
    <div className="current-file-meta"><span className="tag" title="Current disk · not a historical snapshot">On disk</span><button className="btn ghost" onClick={() => setRetry(r => r + 1)}>Refresh</button><button className="btn ghost" onClick={() => useApp.setState({ currentFile: undefined, filePanel: path })}>Recorded work on this file</button></div>
    <div className="current-source-tools"><SourceFind query={query} change={q => { setQuery(q); setActiveLine(undefined); }} matches={matches} activeLine={activeLine} move={moveMatch} label="Find in current source page" />
      <form className="source-go" onSubmit={e => { e.preventDefault(); go(); }}><input aria-label="Go to current source line" placeholder="Line" inputMode="numeric" maxLength={16} value={lineInput} onChange={e => { setLineInput(e.target.value); setLineError(undefined); }} /><button className="btn ghost small" disabled={!file}>Go to line</button><button type="button" className="btn ghost small" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>Wrap lines</button><span role="status">{lineError}</span></form>
      <details className="source-utilities"><summary>Copy source range</summary><div className="source-range"><input aria-label="Current source range start" placeholder="From" inputMode="numeric" maxLength={16} value={from} onChange={e => setFrom(e.target.value)} /><input aria-label="Current source range end" placeholder="To" inputMode="numeric" maxLength={16} value={to} onChange={e => setTo(e.target.value)} /><button className="btn ghost small" disabled={!file} onClick={() => void copy(true)}>Copy range</button><span role="status">{copied || 'Loaded page only'}</span></div></details>
    </div>
    <ImportContext path={path} current />
    {error ? <p className="bad" role="alert">{error}</p> : !file ? <p className="muted" role="status">Reading current file…</p> : <><div ref={code} className={`current-file-code source-reading${wrap ? ' wrap-source' : ''}`}><CodeView text={file.text} path={path} startLine={file.start + 1} highlightLines={new Set(matches)} activeLine={activeLine} /></div><footer><span title={`Current file version: ${file.modifiedAt}`}>Lines {file.start + 1}–{file.start + file.returnedLines} of {file.totalLines}{file.redacted ? ' · secrets redacted' : ''}</span><button disabled={!start} onClick={() => { setActiveLine(undefined); setStart(s => Math.max(0, s - 200)); }}>Previous lines</button><button disabled={!file.hasMore} onClick={() => { setActiveLine(undefined); setStart(s => s + 200); }}>Next lines</button><button onClick={() => void copy()}>Copy visible page</button></footer></>}
  </ReadingDialog>;
}

export function PromptComposer() {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId);
  const recording = useApp(s => s.recording);
  const { workspace, controller, error: connectionError, approve, refresh, submit, inspect } = useSessionWorkspace();
  const [options, setOptions] = useState<TurnOptions>({});
  useEffect(() => { setOptions({}); }, [id]);
  const [prompt, setPrompt] = useState('');
  const [exclusive, setExclusive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const element = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!addOpen) return;
    const dismiss = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.composer-add, .composer-add-menu')) setAddOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAddOpen(false); };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', escape); };
  }, [addOpen]);
  const fileLoading = useRef(false);
  const attach = async (files: File[]) => {
    if (!files.length || fileLoading.current || busy || controller && ['connecting', 'running', 'approval'].includes(controller.state)) return;
    fileLoading.current = true; setLoadingFiles(true); setError(undefined); setAddOpen(false); setConfirmSend(false); setExclusive(false);
    try { setAttachments(await promptFiles(files, attachments)); } catch (e) { setError((e as Error).message); }
    finally { fileLoading.current = false; setLoadingFiles(false); }
  };
  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    const fit = () => {
      node.style.overflowY = 'hidden';
      node.style.height = 'auto';
      const style = getComputedStyle(node);
      // scrollHeight excludes borders; rounding otherwise leaves a needless one-pixel scrollbar.
      const required = node.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + 1;
      node.style.height = `${Math.min(88, Math.ceil(required))}px`;
      node.style.overflowY = required > 88 ? 'auto' : 'hidden';
    };
    fit();
    let width = node.clientWidth;
    const resize = new ResizeObserver(() => {
      if (node.clientWidth !== width) { width = node.clientWidth; fit(); }
    });
    resize.observe(node);
    return () => resize.disconnect();
  }, [prompt]);
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
      {controller && !controller.available && <details className="cli-setup" open><summary>Connect your {recording?.harness === 'codex' ? 'Codex' : 'Claude Code'} CLI</summary>{recording?.harness === 'codex' ? <><p>In a terminal, install and sign in:</p><code>npm install -g @openai/codex</code><code>codex login</code><p>If the command is not found, reopen the terminal or use <code>npx @openai/codex login</code>. Drishya also checks standard Windows installations automatically.</p></> : <p>Install the native Claude Code CLI and sign in using its terminal client.</p>}<button type="button" onClick={() => void refresh()}>Check again</button></details>}
      <input hidden ref={fileInput} type="file" multiple aria-label="Choose prompt files" onChange={e => { void attach([...e.currentTarget.files ?? []]); e.currentTarget.value = ''; }} />
      <input hidden ref={folderInput} type="file" multiple {...{ webkitdirectory: '' }} aria-label="Choose prompt folder" onChange={e => { void attach([...e.currentTarget.files ?? []]); e.currentTarget.value = ''; }} />
      <form onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); void attach([...e.dataTransfer.files]); } }} onSubmit={e => { e.preventDefault(); if (running || busy || loadingFiles || !prompt.trim() || !workspace?.approved || !controller?.available) return; if (!exclusive) { setConfirmSend(true); return; } setConfirmSend(false); void act(async () => { await submit(prompt, exclusive, attachments, options); setPrompt(''); setAttachments([]); setExclusive(false); setConfirmSend(false); }); }}>
        {!!attachments.length && <div className="prompt-attachments" aria-label="Prompt attachments">{attachments.map((a, index) => <span className="attachment-chip" key={`${index}/${a.name}`} title={a.name}>{a.type === 'image' && <img alt={`Preview ${a.name}`} src={`data:${a.mime};base64,${a.data}`} />}<span>{a.name}</span><button type="button" disabled={!!running || busy || loadingFiles} aria-label={`Remove attachment ${a.name}`} onClick={() => { setAttachments(items => items.filter((_, i) => i !== index)); setExclusive(false); setConfirmSend(false); }}>×</button></span>)}</div>}
        <textarea ref={input} aria-label="Prompt for selected harness session" placeholder="Ask your agent…" rows={1} onPaste={e => { const files = [...e.clipboardData.items].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter((file): file is File => !!file); if (files.length) { e.preventDefault(); void attach(files); } }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} value={prompt} maxLength={65_536} disabled={!!running || busy} onChange={e => { setPrompt(e.target.value); setExclusive(false); setConfirmSend(false); }} />
        <div className="composer-actions"><button type="button" className="composer-add" aria-label="Add files or folders" aria-expanded={addOpen} disabled={!!running || busy || loadingFiles} onClick={() => setAddOpen(!addOpen)}>+</button>{loadingFiles && <small role="status">Preparing files…</small>}{running ? <button type="button" disabled={busy} onClick={() => void act(() => workspaceApi.stop(id, controller.runId!))} aria-label="Stop turn" className="stop-turn" title="Stop this turn"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" /></svg></button> : <button type="submit" className="send-prompt" aria-label="Send prompt" title="Send prompt" disabled={busy || loadingFiles || !prompt.trim() || !workspace?.approved || !controller?.available}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5m-4 4 4-4 4 4" /></svg></button>}</div>
        {addOpen && <div className="composer-add-menu"><button type="button" onClick={() => fileInput.current?.click()}>Files or images</button><button type="button" onClick={() => folderInput.current?.click()}>Folder contents</button><small>Text/code and PNG, JPEG, WebP, GIF · 32 files maximum. Paste screenshots or drop files here. Text secrets are scrubbed; check images before sending.</small></div>}
        {confirmSend && <div className="send-confirmation" role="group" aria-label="Confirm session access"><label><input type="checkbox" checked={exclusive} onChange={e => setExclusive(e.target.checked)} /> This session is idle in other clients</label><small>Finish any turn in another client before sending here.</small><button type="submit" disabled={!exclusive || busy}>Confirm and send</button><button type="button" onClick={() => { setConfirmSend(false); setExclusive(false); }}>Cancel</button></div>}
      </form>
      <details className="permission-policy native-options"><summary>{controller?.settings?.model ?? 'Native settings'} · Ask permission</summary><div className="native-options-menu">
        <button disabled={!!running || busy || !workspace?.approved} onClick={() => inspect && void act(inspect)}>Read native settings</button>
        {!!controller?.settings && <><small>{controller.settings.scope === 'connected-session' ? 'Connected session' : 'Workspace defaults'} · {controller.settings.permission ?? 'Policy reported after connecting'}{controller.settings.sandbox && ` · ${controller.settings.sandbox}`}</small>
          <label>Model<select disabled={!!running || busy} value={options.model ?? ''} onChange={e => { setOptions(e.target.value ? { model: e.target.value } : {}); setExclusive(false); setConfirmSend(false); }}><option value="">Use native default</option>{controller.settings.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
          <label>Effort<select disabled={!!running || busy} value={options.effort ?? ''} onChange={e => { setOptions({ ...options, effort: e.target.value || undefined }); setExclusive(false); setConfirmSend(false); }}><option value="">Use native default</option>{controller.settings.models.find(model => model.id === (options.model ?? controller.settings?.model))?.efforts.map(effort => <option key={effort} value={effort}>{effort}</option>)}</select></label>
        </>}
        <small>Each Allow once applies only to its native request. Full access and global settings remain in the native CLI.</small>
      </div></details>
      <div className="native-turn-details">
      {(error || connectionError || controller?.error) && <p className="bad small" role="alert">{error ?? connectionError ?? controller?.error}</p>}
      {controller?.promptRedacted && <p className="muted small">Detected secrets were removed before sending this prompt.</p>}
      {controller?.approvals.map(p => <div className="tool-approval" key={p.id}><strong>{p.name} · approval requested</strong><pre>{p.detail}</pre><button disabled={busy} onClick={() => void act(() => workspaceApi.decide(id, controller.runId!, p.id, false))}>Decline</button><button disabled={busy} onClick={() => void act(() => workspaceApi.decide(id, controller.runId!, p.id, true))}>Allow once</button></div>)}
      </div>
  </section>;
}
