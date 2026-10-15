import { useMemo, useState } from 'react';
import type { RecordingSummary, DiscoveredSource } from '../fresh/api';

const rootName = (root?: string) => root?.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? 'Unassigned workspace';
const count = (n: number) => n.toLocaleString();
const when = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recorded';
export function ModernLibrary({ recordings, sources, ready, pending, errors, discover, open, importSource }: {
  recordings: RecordingSummary[]; sources: DiscoveredSource[]; ready: boolean; pending: boolean; errors: string[];
  discover: () => void; open: (id: string) => void; importSource: (s: DiscoveredSource) => void;
}) {
  const [query, setQuery] = useState('');
  const [project, setProject] = useState<string>();
  const [limit, setLimit] = useState(30);
  const [discovering, setDiscovering] = useState(false);
  const projects = useMemo(() => [...new Set(recordings.map(r => r.workspaceRoot ?? ''))], [recordings]);
  const sessions = recordings.filter(r => (project === undefined || (r.workspaceRoot ?? '') === project) && `${r.title} ${r.workspaceRoot} ${r.harness}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return <main className="md-library">
    <aside className="md-library-nav"><span className="md-eyebrow">WORKSPACES</span><button aria-pressed={project === undefined} onClick={() => setProject(undefined)}><span>All sessions</span><small>{recordings.length}</small></button>{projects.map(root => <button title={root || 'No workspace recorded'} key={root} aria-pressed={project === root} onClick={() => setProject(root)}><i className="md-project-glyph">⌘</i><span>{rootName(root)}</span><small>{recordings.filter(r => (r.workspaceRoot ?? '') === root).length}</small></button>)}<div className="md-library-private"><i />Everything stays on this machine.<small>Local capture. No telemetry.</small></div></aside>
    <div className="md-library-main"><header className="md-library-heading"><div><span className="md-eyebrow">YOUR AGENT WORKSPACE</span><h1>The work, in view.</h1><p>Follow the decisions. Read the code. Pick up where you left off.</p></div><button className="md-primary" disabled={pending} onClick={() => { setDiscovering(true); discover(); }}><span>＋</span>{pending ? 'Finding sessions…' : 'Connect session'}</button></header>
      <div className="md-library-bar"><h2>{project === undefined ? 'Recent sessions' : rootName(project)}<span>{sessions.length}</span></h2><label><span aria-hidden="true">⌕</span><input aria-label="Filter sessions" placeholder="Find a session…" value={query} onChange={e => setQuery(e.target.value)} /><kbd>/</kbd></label></div>
      <div className="md-session-grid">{sessions.slice(0, limit).map(r => <button className="md-session-card" key={r.id} onClick={() => open(r.id)}><div className="md-session-card-top"><span className={`md-harness ${r.harness === 'codex' ? 'is-codex' : ''}`}><b>{r.harness === 'codex' ? '✳' : '✺'}</b>{r.harness === 'codex' ? 'Codex' : r.harness === 'claude-code' ? 'Claude Code' : r.harness}</span><time title={r.updatedAt}>{when(r.updatedAt)}</time></div><h3>{r.title || 'Untitled session'}</h3><div className="md-session-context"><span>⌘</span>{rootName(r.workspaceRoot)}</div><footer><span><i className={r.live ? 'is-live' : ''} />{r.live ? 'Following journal' : `${count(r.observationCount)} observations`}</span><span className="md-session-arrow">↗</span></footer>{r.privacyOutdated && <small className="fr-warning-text">Re-import for the current privacy policy</small>}</button>)}</div>
      {sessions.length > limit && <button className="fr-button md-library-more" onClick={() => setLimit(n => n + 30)}>Show more sessions · {sessions.length - limit} remaining</button>}
      {!sessions.length && <div className="md-library-empty"><span>◎</span><h2>{!ready ? 'Opening your workspace…' : query ? 'No matching sessions' : 'Bring your agent’s work into view.'}</h2><p>{query ? 'Try a project name, harness or part of a session title.' : 'Connect a local Codex or Claude Code session to see its actual reads, edits and results.'}</p></div>}
      {discovering && <section className="md-discovery"><header><div><span className="md-eyebrow">ON THIS MACHINE</span><h2>Connect a session</h2></div><button aria-label="Close discovered sessions" onClick={() => setDiscovering(false)}>×</button></header><p>Import captures a redacted copy. Sending a prompt requires separate workspace permission.</p>{sources.map(s => <div className="md-source-row" key={s.path}><span className="md-harness-symbol">{s.harness === 'codex' ? '✳' : '✺'}</span><div><strong>{s.title || rootName(s.cwd)}</strong><small>{s.cwd ?? s.path}</small></div><button className="fr-button" disabled={pending} onClick={() => s.importedRecordingId ? open(s.importedRecordingId) : importSource(s)}>{s.importedRecordingId ? 'Open' : 'Connect'} ↗</button></div>)}{!pending && !sources.length && <p>No supported journals found. Start a session in your harness, then try again.</p>}{errors.map((e, i) => <p className="fr-warning-text" key={i}>{e}</p>)}<button className="fr-button" disabled={pending} onClick={discover}>Refresh discovery</button></section>}
    </div>
  </main>;
}
