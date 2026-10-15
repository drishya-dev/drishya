import { useEffect, useRef, useState } from 'react';
import type { DiscoveredSource } from '../fresh/api';

export function SessionDiscovery({ sources, pending, errors, onClose, discover, open, importSource }: {
  sources: DiscoveredSource[]; pending: boolean; errors: string[];
  onClose: () => void; discover: () => void; open: (id: string) => void; importSource: (source: DiscoveredSource) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(40);
  useEffect(() => { const element = dialog.current; const trigger = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); }; }, []);
  const matches = sources.filter(source => `${source.title ?? ''} ${source.cwd ?? ''} ${source.harness} ${source.path}`.toLowerCase().includes(query.toLowerCase()));
  return <dialog ref={dialog} className="md-discovery-dialog" aria-labelledby="md-discovery-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><span className="md-eyebrow">ON THIS MACHINE</span><h2 id="md-discovery-title">Connect a session</h2></div><button aria-label="Close discovered sessions" onClick={onClose}>×</button></header>
    <p>Import a redacted copy. Native prompting asks for workspace permission separately.</p>
    <label className="md-discovery-search"><span aria-hidden="true">⌕</span><input autoFocus aria-label="Find local session" placeholder="Project, session, or harness…" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} /><span>{matches.length}</span></label>
    <div className="md-discovery-results" aria-busy={pending}>{matches.slice(0, limit).map(source => <div className="md-source-row" key={source.path}><span className="md-harness-symbol">{source.harness === 'codex' ? '✳' : '✺'}</span><div><strong>{source.title || source.cwd?.replaceAll('\\', '/').split('/').pop() || 'Local session'}</strong><small title={source.cwd ?? source.path}>{source.cwd ?? source.path}</small></div><button className="fr-button" disabled={pending} onClick={() => source.importedRecordingId ? open(source.importedRecordingId) : importSource(source)}>{source.importedRecordingId ? 'Open' : 'Connect'} ↗</button></div>)}{matches.length > limit && <button className="fr-button" onClick={() => setLimit(value => value + 40)}>Show more · {matches.length - limit} remaining</button>}{!matches.length && <div className="md-discovery-empty">{pending ? 'Finding local sessions…' : query ? 'No matching sessions. Try another project or harness.' : 'No supported journals found. Start a session in your harness, then refresh.'}</div>}</div>
    <footer>{errors.map((error, index) => <p role="alert" key={index}>{error}</p>)}<span>Journals stay on your machine</span><button className="fr-button" disabled={pending} onClick={discover}>Refresh</button></footer>
  </dialog>;
}
