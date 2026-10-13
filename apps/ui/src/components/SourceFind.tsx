/** The same bounded search affordance in current and historical source readers. */
export function SourceFind({ query, change, matches, activeLine, move, label, idleLabel = 'Loaded page only', scopeLabel = 'this page' }: {
  query: string; change: (query: string) => void; matches: number[]; activeLine?: number;
  move: (direction: 1 | -1) => void; label: string; idleLabel?: string;
  scopeLabel?: string;
}) {
  return <div className="source-find"><input type="search" aria-label={label} placeholder="Find in this page" maxLength={200} value={query} onChange={e => change(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); move(e.shiftKey ? -1 : 1); } }} />
    <button className="btn ghost small" aria-label="Previous match" disabled={!matches.length} onClick={() => move(-1)}>↑</button><button className="btn ghost small" aria-label="Next match" disabled={!matches.length} onClick={() => move(1)}>↓</button>
    <span className="muted small" role="status">{query ? `${matches.length} matching ${matches.length === 1 ? 'line' : 'lines'} in ${scopeLabel}${matches.includes(activeLine ?? -1) ? ` · ${matches.indexOf(activeLine!) + 1} of ${matches.length}` : ''}` : idleLabel}</span>
  </div>;
}
