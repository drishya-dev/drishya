import './source-reader-compact.css';
/** The same bounded search affordance in current and historical source readers. */
export function SourceFind({ query, change, matches, activeLine, move, label, idleLabel = 'Loaded page only', scopeLabel = 'this page', compact=false }: {
  query: string; change: (query: string) => void; matches: number[]; activeLine?: number;
  move: (direction: 1 | -1) => void; label: string; idleLabel?: string;
  scopeLabel?: string; compact?:boolean;
}) {
  const description=query?`${matches.length} matching ${matches.length===1?'line':'lines'} in ${scopeLabel}${matches.includes(activeLine??-1)?` · ${matches.indexOf(activeLine!)+1} of ${matches.length}`:''}`:idleLabel;
  const position=matches.includes(activeLine??-1)?matches.indexOf(activeLine!)+1:0;
  return <div className={`source-find${compact?' source-find-compact':''}`}><input type="search" aria-label={label} placeholder={scopeLabel === 'this patch' ? 'Find in patch' : scopeLabel === 'this file' ? 'Find in file' : 'Find in this page'} maxLength={200} value={query} onChange={e => change(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); move(e.shiftKey ? -1 : 1); } }} />
    <button className="btn ghost small" aria-label="Previous match" disabled={!matches.length} onClick={() => move(-1)}>↑</button><button className="btn ghost small" aria-label="Next match" disabled={!matches.length} onClick={() => move(1)}>↓</button>
    <span className="muted small" role="status" aria-label={compact?description:undefined} title={compact?description:undefined}>{compact?(query?`${position}/${matches.length}`:''):description}</span>
  </div>;
}
