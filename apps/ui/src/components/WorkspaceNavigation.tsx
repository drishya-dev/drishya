import { openGitHistory } from './GitHistory.tsx';
import { openReviewTool } from './ReviewInsights.tsx';
import { openChanges } from '../lib/open-changes.ts';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { FileIcon } from './FileIcon.tsx';

export type DestinationGroup = 'This session' | 'Review' | 'Repository' | 'Workspace' | 'Files' | 'Sessions';
const GROUP_ORDER: readonly DestinationGroup[] = ['This session', 'Review', 'Repository', 'Workspace', 'Files', 'Sessions'];

export interface Destination {
  key: string;
  group: DestinationGroup;
  name: string;
  detail: string;
  shortcut?: string;
  keywords?: string;
  path?: string;
  run: () => void;
}

function CommandGlyph({ id }: { id: string }) {
  switch (id) {
    case 'search':
    case 'library-search':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
    case 'map':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="11" cy="18" r="2.5"/><path d="M8.3 6.5 15.5 7M7.2 8.2l2.8 7.5M16.6 9.1 12.4 16"/></svg>;
    case 'latest':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m0 0-5-5m5 5 5-5"/></svg>;
    case 'settings':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1"/></svg>;
    case 'commands':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 10 3 2.5L7 15m5 0h5"/></svg>;
    case 'notes':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5Z"/><path d="M15 4v4h4M9 12h6M9 16h4"/></svg>;
    case 'review':
    case 'review-findings':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>;
    case 'review-prompts':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h10M5 17h12"/></svg>;
    case 'review-packet':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
    case 'git-history':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="6" cy="19" r="2.5"/><path d="M6 7.5v9M18 9.5v1a6 6 0 0 1-6 6H6"/></svg>;
    case 'compare':
    case 'git':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12m-3-3 3 3 3-3M17 18V6m-3 3 3-3 3 3"/></svg>;
    case 'workspace':
    case 'files':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>;
    case 'home':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z"/></svg>;
    case 'newer-work':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/></svg>;
  }
}

export function WorkspaceNavigation() {
  const screen = useApp(s => s.screen), id = useApp(s => s.recordingId), mode = useApp(s => s.mode);
  const graph = useApp(s => s.graph), recordings = useApp(s => s.recordings), kind = useApp(s => s.source?.kind);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const listId = useId(), input = useRef<HTMLInputElement>(null);
  const launch = () => { setQuery(''); setActive(0); setOpen(true); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (useApp.getState().screen !== 'viewer' || document.querySelector('dialog[open]:not(.workspace-navigation):not(.map-reader)')) return;
      event.preventDefault(); launch();
    };
    window.addEventListener('keydown', key);
    const reveal = () => launch(); window.addEventListener('drishya-navigate-workspace', reveal);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('drishya-navigate-workspace', reveal); };
  }, []);
  useEffect(() => setOpen(false), [id, screen]);
  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open]);
  const destinations = useMemo(() => {
    const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)?.click();
    const all: Destination[] = [
      { key: 'search', group: 'This session', name: 'Search this session', detail: 'Prose, commands and results', shortcut: '/', run: () => useApp.setState({ searchOpen: true }) },
      { key: 'latest', group: 'This session', name: 'Return to latest activity', detail: 'Leave reading spaces and follow the agent', run: () => { useApp.getState().set({ developerWorkspace: false, explore: false, currentFile: undefined, filePanel: undefined }); useApp.getState().showHistory(); } },
      { key: 'map', group: 'Repository', name: 'Explore repository map', detail: 'File and import relationships', shortcut: 'X', run: () => useApp.getState().set({ developerWorkspace: false, currentFile: undefined, filePanel: undefined, selectedOp: undefined, expandedOp: undefined, explore: true, mapVisible: true, follow: false, held: true }) },
      { key: 'settings', group: 'Workspace', name: 'Workspace settings', detail: 'Theme, reading and resources', run: () => useApp.setState({ settingsOpen: true }) },
    ];
    if (kind === 'daemon') all.push({ key: 'library-search', group: 'Workspace', name: 'Search all sessions', detail: 'Find text across imported sessions', run: () => requestAnimationFrame(() => window.dispatchEvent(new Event('drishya-search-library'))) });
    if (mode === 'history') {
      if (document.querySelector('details.session-segments')) all.push({
        key: 'newer-work', group: 'This session', name: 'Newer session work', detail: 'Open newer work stored separately by the harness', run: () => requestAnimationFrame(() => {
          // Let the command dialog restore its prior focus before opening a menu;
          // otherwise that restoration immediately dismisses the new destination.
          if (useApp.getState().recordingId !== id || useApp.getState().screen !== 'viewer') return;
          const section = document.querySelector<HTMLDetailsElement>('details.session-segments');
          const menu = section?.closest<HTMLDetailsElement>('details.workspace-menu');
          if (menu) menu.open = true;
          if (section) { section.open = true; section.querySelector<HTMLElement>('summary')?.focus(); }
        }),
      });
      all.push({ key: 'commands', group: 'This session', name: 'Find commands', detail: 'Search, copy and inspect shell and test runs', keywords: 'captured commands', run: () => requestAnimationFrame(() => window.dispatchEvent(new Event('drishya-commands'))) });
      all.push({ key: 'notes', group: 'This session', name: 'Notes', detail: 'Your notes and saved steps', run: () => requestAnimationFrame(() => window.dispatchEvent(new Event('drishya-notes-open'))) });
      all.push({ key: 'review', group: 'Review', name: 'Review changes and checks', detail: 'Files changed, recorded checks and failures', run: () => { if (document.querySelector('.review-open')) click('.review-open'); else window.dispatchEvent(new Event('drishya-session-review')); } });
      for (const [view, name, detail] of [['findings', 'Review findings', 'Commands that keep failing, missing outcomes and gaps'], ['prompts', 'Prompt overview', 'Prompts and activity counts'], ['packet', 'Prepare review packet', 'Changes, checks, gaps and your open reviewer questions']] as const) {
        all.push({ key: `review-${view}`, group: 'Review', name, detail, run: () => requestAnimationFrame(() => openReviewTool(view)) });
      }
      if (kind === 'daemon' && id && !id.includes('+')) {
        all.push({ key: 'git', group: 'Repository', name: 'Review current Git changes', detail: 'Staged and working-tree changes in this repository', run: () => requestAnimationFrame(() => openChanges('uncommitted')) });
        all.push({ key: 'compare', group: 'Repository', name: 'Changes: compare branches or a pull request', detail: 'Compare branches or a pull request, with agent edits', run: () => requestAnimationFrame(() => openChanges('branch')) });
        all.push({ key: 'git-history', group: 'Repository', name: 'Explore Git branches and commits', detail: 'Branches, commits and parent history', run: () => requestAnimationFrame(openGitHistory) });
        all.push({ key: 'workspace', group: 'Repository', name: 'Open developer workspace', detail: 'Open and edit workspace files with draft saving', run: () => { if (!useApp.getState().developerWorkspace) click('[aria-label="Open developer workspace"]'); } });
      }
      all.push({ key: 'files', group: 'Repository', name: 'Browse workspace files', detail: 'Open the workspace or session file tree', run: () => { useApp.getState().set({ foldersHidden: false, explore: false, currentFile: undefined, filePanel: undefined, selectedOp: undefined, follow: false, held: true }); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.folder-explorer input')?.focus({ preventScroll: true })); } });
    }
    if (kind === 'daemon') all.push({ key: 'home', group: 'Workspace', name: 'Choose a session', detail: 'All local sessions across workspaces', run: () => { location.hash = ''; useApp.setState({ screen: 'home', playing: false }); } });
    all.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    const needle = query.trim().toLowerCase();
    const result = all.filter(item => !needle || `${item.name} ${item.detail} ${item.keywords ?? ''} ${item.group}`.toLowerCase().includes(needle));
    if (needle) {
      for (const node of graph?.nodes ?? []) {
        if (result.length >= 40) break;
        if (node.path.startsWith('.local/') || !node.path.toLowerCase().includes(needle)) continue;
        const currentDisk = graph?.temporal === 'current' && kind === 'daemon';
        result.push({ key: `file/${node.id}`, group: 'Files', name: node.path, detail: currentDisk ? 'Current indexed file · separate disk consent' : 'What the agent did to each file', path: node.path, run: () => useApp.getState().set(currentDisk ? { currentFile: node.id, filePanel: undefined, explore: false } : { filePanel: node.id, currentFile: undefined, explore: false }) });
      }
      if (kind === 'daemon') for (const recording of recordings) {
        if (result.length >= 40) break;
        if (recording.id === id || !`${recording.title ?? ''} ${recording.workspaceRoot ?? ''}`.toLowerCase().includes(needle)) continue;
        result.push({ key: `session/${recording.id}`, group: 'Sessions', name: recording.title || 'Untitled session', detail: recording.workspaceRoot ?? 'Workspace unavailable', run: () => { location.hash = `#/r/${recording.id}`; void useApp.getState().openRecording(recording.id); } });
      }
    }
    return result;
  }, [query, graph, mode, kind, id, recordings, open]);
  const index = Math.min(active, Math.max(0, destinations.length - 1));
  useEffect(() => { if (open) document.getElementById(`${listId}/${index}`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [index, open, listId]);
  const choose = (destination: Destination) => { setOpen(false); destination.run(); };
  if (!open || screen !== 'viewer') return null;
  return <ReadingDialog title="Navigate workspace" close={() => setOpen(false)} className="workspace-navigation">
    <input ref={input} data-dialog-focus placeholder="Find a file, a session or a command" className="workspace-navigation-query" role="combobox" aria-label="Find a command, file or session" aria-expanded="true" aria-controls={listId} aria-activedescendant={destinations.length ? `${listId}/${index}` : undefined} autoComplete="off" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive((index + (event.key === 'ArrowDown' ? 1 : -1) + destinations.length) % Math.max(1, destinations.length)); }
      else if (event.key === 'Enter' && destinations[index]) { event.preventDefault(); choose(destinations[index]!); }
    }} />
    <div id={listId} role="listbox" aria-label="Workspace destinations" className="workspace-navigation-results">
      {destinations.map((item, n) => {
        const prev = destinations[n - 1];
        const heading = !prev || prev.group !== item.group ? <div className="workspace-navigation-heading" role="presentation">{item.group}</div> : null;
        return <Fragment key={item.key}>{heading}<button id={`${listId}/${n}`} role="option" aria-selected={index === n} onMouseMove={() => setActive(n)} onClick={() => choose(item)}>{item.path ? <FileIcon path={item.path} /> : <span className="navigation-command-icon" aria-hidden="true"><CommandGlyph id={item.key} /></span>}<span className="navigation-command-text"><strong>{item.name}</strong><small>{item.detail}</small></span>{item.shortcut && <kbd className="navigation-command-shortcut" aria-hidden="true">{item.shortcut}</kbd>}</button></Fragment>;
      })}
      {!destinations.length && <p>No matching destination.</p>}
    </div>
    <p className="workspace-navigation-help">↑↓ choose · Enter open · Esc close · first 40 matches</p>
  </ReadingDialog>;
}
