import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { FileIcon } from './FileIcon.tsx';

interface Destination { key: string; name: string; detail: string; path?: string; run: () => void }
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
      { key: 'search', name: 'Search captured work', detail: 'Recorded prose, commands and evidence', run: () => useApp.setState({ searchOpen: true }) },
      { key: 'map', name: 'Explore repository map', detail: 'Current index or captured file locations', run: () => useApp.setState({ explore: true, mapVisible: true }) },
      { key: 'latest', name: 'Return to latest activity', detail: 'Follow accumulating captured work', run: () => useApp.getState().showHistory() },
      { key: 'settings', name: 'Workspace settings', detail: 'Theme, reading and resources', run: () => useApp.setState({ settingsOpen: true }) },
    ];
    if(kind==='daemon')all.push({key:'library-search',name:'Search all session evidence',detail:'Find captured text across imported sessions',run:()=>requestAnimationFrame(()=>window.dispatchEvent(new Event('drishya-search-library')))});
    if (mode === 'history') {
      if (document.querySelector('details.session-segments')) all.push({key:'newer-work',name:'Newer session work',detail:'Open newer captured work stored separately by the harness',run:()=>requestAnimationFrame(()=>{
        // Let the command dialog restore its prior focus before opening a menu;
        // otherwise that restoration immediately dismisses the new destination.
        if(useApp.getState().recordingId!==id||useApp.getState().screen!=='viewer')return;
        const section=document.querySelector<HTMLDetailsElement>('details.session-segments');
        const menu=section?.closest<HTMLDetailsElement>('details.workspace-menu');
        if(menu)menu.open=true;
        if(section){section.open=true;section.querySelector<HTMLElement>('summary')?.focus();}
      })});
      all.push({ key: 'review', name: 'Review recorded changes and checks', detail: 'Captured outcomes, not coverage', run: () => click('.review-open') });
      all.push({ key: 'questions', name: 'Review questions', detail: 'Your unresolved review decisions', run: () => click('button[data-review-questions]') });
      if (kind === 'daemon' && id && !id.includes('+')) all.push({ key: 'git', name: 'Review current Git changes', detail: 'Separately approved staged and worktree patches', run: () => click('.git-open') });
    }
    if (kind === 'daemon') all.push({ key: 'home', name: 'Choose a session', detail: 'Workspace and local-date groups', run: () => { location.hash = ''; useApp.setState({ screen: 'home', playing: false }); } });
    const needle = query.trim().toLowerCase();
    const result = all.filter(item => !needle || `${item.name} ${item.detail}`.toLowerCase().includes(needle));
    if (needle) {
      for (const node of graph?.nodes ?? []) {
        if (result.length >= 40) break;
        if (node.path.startsWith('.local/') || !node.path.toLowerCase().includes(needle)) continue;
        const currentDisk = graph?.temporal === 'current' && kind === 'daemon';
        result.push({ key: `file/${node.id}`, name: node.path, detail: currentDisk ? 'Current indexed file · separate disk consent' : 'Recorded file work · available captured evidence only', path: node.path, run: () => useApp.getState().set(currentDisk ? { currentFile: node.id, filePanel: undefined, explore: false } : { filePanel: node.id, currentFile: undefined, explore: false }) });
      }
      if (kind === 'daemon') for (const recording of recordings) {
        if (result.length >= 40) break;
        if (recording.id === id || !`${recording.title ?? ''} ${recording.workspaceRoot ?? ''}`.toLowerCase().includes(needle)) continue;
        result.push({ key: `session/${recording.id}`, name: recording.title || 'Untitled session', detail: recording.workspaceRoot ?? 'Workspace unavailable', run: () => { location.hash = `#/r/${recording.id}`; void useApp.getState().openRecording(recording.id); } });
      }
    }
    return result;
  }, [query, graph, mode, kind, id, recordings, open]);
  const index = Math.min(active, Math.max(0, destinations.length - 1));
  useEffect(() => { if (open) document.getElementById(`${listId}/${index}`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [index, open, listId]);
  const choose = (destination: Destination) => { setOpen(false); destination.run(); };
  if (!open || screen !== 'viewer') return null;
  return <ReadingDialog title="Navigate workspace" close={() => setOpen(false)} className="workspace-navigation">
    <input ref={input} className="workspace-navigation-query" role="combobox" aria-label="Find a command, file or session" aria-expanded="true" aria-controls={listId} aria-activedescendant={destinations.length ? `${listId}/${index}` : undefined} autoComplete="off" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive((index + (event.key === 'ArrowDown' ? 1 : -1) + destinations.length) % Math.max(1, destinations.length)); }
      else if (event.key === 'Enter' && destinations[index]) { event.preventDefault(); choose(destinations[index]!); }
    }} />
    <div id={listId} role="listbox" aria-label="Workspace destinations" className="workspace-navigation-results">
      {destinations.map((item, n) => <button key={item.key} id={`${listId}/${n}`} role="option" aria-selected={index === n} onMouseMove={() => setActive(n)} onClick={() => choose(item)}>{item.path ? <FileIcon path={item.path} /> : <span className="navigation-command-icon" aria-hidden="true">↗</span>}<span><strong>{item.name}</strong><small>{item.detail}</small></span></button>)}
      {!destinations.length && <p>No matching destination.</p>}
    </div>
    <p className="workspace-navigation-help">↑↓ Choose · Enter Open · Esc Close · First 40 matches; refine to reach another file/session</p>
  </ReadingDialog>;
}
