import type { ArtifactSlice, Operation } from '@drishya/contracts';
import { CodeTokens } from '../fresh/CodeTokens';

function boundedInput(input: unknown) {
  const text = typeof input === 'string' ? input : JSON.stringify(input, null, 2) ?? '';
  return text.length > 1600 ? `${text.slice(0, 1600)}\n… Open the action for complete captured input` : text;
}

/** A composition per kind, with all deeper material reachable through the reader. */
export function ModernActionContent({ operation, material }: { operation: Operation; material?: ArtifactSlice }) {
  const d = operation.detail;
  const shell = d.kind === 'shell' || d.kind === 'test';
  const output = material?.available ? material.text : shell ? d.outputPreview : 'resultPreview' in d ? d.resultPreview : undefined;
  const summary = d.kind === 'test' ? d.summary : undefined;
  return <>
    {summary && <div className="md-test-result"><div><strong>{summary.passed} passed</strong>{summary.failed > 0 && <strong className="is-failed">{summary.failed} failed</strong>}{summary.skipped > 0 && <span>{summary.skipped} skipped</span>}</div><div className="md-test-cells" aria-hidden="true">{(['passed', 'failed', 'skipped'] as const).flatMap(key => Array.from({ length: Math.min(24, summary[key]) }, (_, i) => <i className={key} key={`${key}-${i}`} />))}</div><small>{summary.framework} · aggregate counts from output</small></div>}
    {shell && <div className="md-action-input"><span>COMMAND</span><pre><b aria-hidden="true">$ </b><CodeTokens text={d.command} /></pre></div>}
    {d.kind === 'read' && <div className="md-read-strip"><span>Source</span><strong>{d.startLine}–{d.startLine + Math.max(0, d.lineCount - 1)}</strong><span>{d.totalLines ? `of ${d.totalLines} lines` : 'captured range'}</span></div>}
    {d.kind === 'edit' && <div className="md-patch-preview"><div><span>{d.created ? 'NEW FILE' : 'PATCH'}</span><span>{d.hunks.length} {d.hunks.length === 1 ? 'hunk' : 'hunks'}</span></div><div className="fr-diff-mini">{d.hunks.map((hunk, i) => <div key={i}><div className="md-hunk-label">@@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</div>{hunk.lines.map((line, j) => <code key={j} className={line.startsWith('+') ? 'fr-add' : line.startsWith('-') ? 'fr-remove' : ''}><CodeTokens text={line} /></code>)}</div>)}</div></div>}
    {d.kind === 'search' && <div className="md-search-material"><code>⌕ {d.query}</code>{d.hits.map((hit, i) => <div key={i}><span>{hit.path}{hit.line ? `:${hit.line}` : ''}</span>{hit.text && <pre>{hit.text}</pre>}</div>)}</div>}
    {(d.kind === 'mcp' || d.kind === 'other') && <div className="md-action-input"><span>{d.kind === 'mcp' ? `${d.server} / ${d.tool}` : 'INPUT'}</span><pre><CodeTokens text={boundedInput(d.input)} /></pre></div>}
    {d.kind === 'spawn' && <div className="md-delegation"><i>↗</i><span>{d.description ?? d.agentType ?? 'Delegated task'}{d.childAgentId && <small>Captured child · {d.childAgentId}</small>}</span></div>}
    {d.kind === 'web' && <div className="md-action-input"><span>{d.url ? 'URL' : 'QUERY'}</span><pre>{d.url ?? d.query}</pre></div>}
    {d.kind === 'plan' && <div className="md-plan">{d.items.map((item, i) => <div key={i}><i>{item.status === 'completed' ? '✓' : '○'}</i><span>{item.text}<small>{item.status}</small></span></div>)}</div>}

    {output && <div className="fr-action-material"><div className="md-output-heading"><span>{d.kind === 'read' ? 'CAPTURED SOURCE' : 'RESULT'}</span>{shell && d.exitCode !== undefined && d.exitCode !== null && <span>exit {d.exitCode}</span>}</div><pre><CodeTokens text={output} /></pre><small>{material?.hasMore ? 'Excerpt · open to read all available lines' : material?.available ? 'Captured material' : 'Captured output preview · open evidence'}</small></div>}
  </>;
}
