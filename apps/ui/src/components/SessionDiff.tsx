import {useState} from 'react';
import {useReveal} from '../lib/reveal.ts';
import type {SessionDiff as Diff, DiffAttribution} from '../../../../packages/scene/src/session-diff.ts';

/** One optional reading surface per file. Its line links refer to captured operations, never inferred authorship. */
export function SessionDiff({diff, open}: {diff?: Diff; open: (id: string) => void}) {
  const [expanded, setExpanded] = useState(false);
  const reveal = useReveal<HTMLDivElement>(expanded);
  if (!diff) return null;
  if (diff.status === 'unavailable') return <p className="review-net-note">Net diff unavailable · {diff.note}</p>;
  const changes = diff.lines.length;
  return <div className="review-net"><button className="review-net-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? '▾' : '▸'} Net diff <span>{changes ? `+${diff.lines.filter(l => l.kind === 'add').length} −${diff.lines.filter(l => l.kind === 'remove').length}` : 'No net textual change'}</span></button>
    {reveal.shown && <div ref={reveal.ref} className="review-net-body"><p className="review-net-note">Computed from the session’s patches, not checked against disk. Final newline differences are not shown. Line links open the edits; later checks show order, not coverage.</p><div className="review-net-lines" aria-label="Net changed lines, each linked to its edit">{diff.lines.map((line, index) => <div key={index} className={`review-net-line ${line.kind}`}><span className="review-net-number">{line.oldLine ?? line.newLine}</span><code>{line.kind === 'add' ? '+' : '−'} {line.text}</code><LineSource attribution={line.attribution} open={open}/></div>)}</div></div>}
  </div>;
}

function LineSource({attribution: a, open}: {attribution: DiffAttribution; open: (id: string) => void}) {
  const c = a.nextCheck;
  return <span className="review-net-source"><button onClick={() => open(a.operationId)} title="Open the edit for this changed line">{a.turn ? `turn ${a.turn}` : 'unattributed'}</button>{c && <button className={c.outcome} onClick={() => open(c.operationId)} title="First later check in the same turn; it does not show coverage">→ {c.kind === 'test' ? 'test' : 'command'} {c.outcome === 'passed' ? '✓' : c.outcome === 'failed' ? '✗' : '?'}</button>}</span>;
}
