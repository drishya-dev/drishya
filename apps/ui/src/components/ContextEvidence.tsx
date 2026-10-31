import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CompactionSummary, ContextReading, Projection } from '@drishya/contracts';
import type { ContextReport } from '../lib/context-report.ts';
import { ArtifactReader } from './ArtifactReader.tsx';
import './context-evidence.css';

const Evidence = createContext<{ projection: Projection; step: number; total: number } | undefined>(undefined);
/** The deferred scene and its evidence travel together; paged timeline lengths are not replay cursors. */
export function ContextEvidenceScope({ projection, step, total, children }: { projection: Projection; step: number; total: number; children: ReactNode }) {
  return <Evidence.Provider value={{ projection, step, total }}>{children}</Evidence.Provider>;
}
const number = (n: number) => n.toLocaleString('en-US');
export const contextTime = (time?: string) => {
  if (!time) return 'Time not recorded';
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? 'Time not recorded' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
export function RequestContextLine({ reading }: { reading: ContextReading }) {
  const percent = reading.window ? reading.input.tokens / reading.window * 100 : undefined;
  return <section className="request-context" aria-label="Recorded request input">
    <strong>Last request input{reading.input.basis === 'derived-request-input' ? ' · derived' : ''}</strong>
    <span>{number(reading.input.tokens)} tokens{reading.window ? ` / ${number(reading.window)} recorded window` : ' · Context window not reported'}</span>
    <small>Read at {contextTime(reading.time)}{percent !== undefined ? ` · ${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of window · derived ratio` : ''}</small>
    <small>{reading.input.basis === 'derived-request-input' ? 'Claude message.usage · input + cache read + cache write.' : 'Codex token_count · captured request input.'} This reading stays fixed until another is recorded.</small>
  </section>;
}
function Summary({ summary, unlinked = false }: { summary?: CompactionSummary; unlinked?: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const readerId = useId();
  const reader = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const root = reader.current;
    if (!open || !root) return;
    const leave = (event: Event) => { if (event.target instanceof Node && !root.contains(event.target)) navigation.current = null; };
    const observer = new MutationObserver(() => {
      const activated = navigation.current;
      if (!activated || (!activated.disabled && activated.isConnected)) return;
      navigation.current = null;
      // A disabled/removed pagination control can drop focus to body. This mutation microtask
      // owns only that loss; any deliberate outside pointer/focus action cancels ownership.
      if (document.activeElement === document.body || document.activeElement === activated) root.focus({ preventScroll: true });
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
    document.addEventListener('pointerdown', leave, true);
    document.addEventListener('focusin', leave, true);
    return () => { navigation.current = null; observer.disconnect(); document.removeEventListener('pointerdown', leave, true); document.removeEventListener('focusin', leave, true); };
  }, [open]);
  if (!summary?.artifactId || summary.availability !== 'captured') return <span className="context-missing">{summary?.availability === 'encrypted' ? 'Summary encrypted by harness' : 'Summary not recorded'}</span>;
  const close = () => { setOpen(false); button.current?.focus({ preventScroll: true }); };
  return <div className="context-summary" onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); close(); } }}>
    <button ref={button} type="button" className="btn ghost" aria-expanded={open} aria-controls={readerId} onClick={() => setOpen(v => !v)}>{open ? 'Hide summary' : unlinked ? 'Read nearby summary' : 'Read captured summary'}</button>
    {open && <div id={readerId} ref={reader} tabIndex={-1} className="context-summary-reader" aria-label="Captured compaction summary" onClickCapture={event => {
      navigation.current = (event.target as Element).closest<HTMLButtonElement>('.reader-pages button');
    }}><ArtifactReader id={summary.artifactId} kind="output" provenance navigationSlot={`compaction/${summary.id}`} /><button type="button" className="btn ghost" onClick={close}>Close summary</button></div>}
  </div>;
}
function Metric({ label, tokens, maximum, reading }: { label: string; tokens?: number; maximum: number; reading?: ContextReading }) {
  return <div className="context-metric"><span>{label}</span><strong>{tokens === undefined ? 'Not recorded' : `${number(tokens)} tokens`}</strong>
    {tokens !== undefined && <span className="context-track" aria-hidden="true"><span style={{ width: `${Math.min(100, maximum ? tokens / maximum * 100 : 0)}%` }} /></span>}
    {reading && <small>{contextTime(reading.time)}{reading.window ? ` · ${number(reading.window)} recorded window` : ''}</small>}
  </div>;
}
/** Only references selected for this loaded passage are read, with an independent replay cutoff. */
export function CompactionEvidence({ id, summaryId }: { id?: string; summaryId?: string }) {
  const evidence = useContext(Evidence);
  if (!evidence) return null;
  const { projection: p, step, total } = evidence, atEnd = step >= total;
  const available = (after: number, request = false) => atEnd || (request ? after < step : after <= step);
  const boundary = id ? p.compactions?.find(c => c.id === id && c.step < step) : undefined;
  const summary = p.compactionSummaries?.find(s => s.id === (boundary?.summaryId ?? summaryId) && available(s.availableAfterStep));
  if (!boundary) return summary && !summary.boundaryId ? <div className="context-evidence context-unlinked" data-summary-id={summary.id}><small>Summary recorded nearby · link not recorded · {contextTime(summary.time)}</small><Summary summary={summary} unlinked /></div> : null;
  const before = p.context?.readings.find(r => r.id === boundary.priorReadingId && available(r.availableAfterStep, true));
  const after = p.context?.readings.find(r => r.id === boundary.nextReadingId && available(r.availableAfterStep, true));
  const direct = p.agents.find(a => a.id === boundary.agentId)?.harness === 'claude-code';
  const left = direct ? boundary.beforeTokens : before?.input.tokens, right = direct ? boundary.afterTokens : after?.input.tokens;
  const maximum = Math.max(left ?? 0, right ?? 0);
  return <section className="context-evidence" aria-label="Compaction" data-compaction-id={boundary.id}>
    <div className="context-heading"><strong>Context compacted</strong><small>{contextTime(boundary.time)}</small></div>
    <small>{direct ? 'Recorded before/after tokens · relative scale' : 'Request input readings around compaction · relative scale'}</small>
    <div className="context-pair"><Metric label={direct ? 'Before' : 'Last request before'} tokens={left} maximum={maximum} reading={direct ? undefined : before} /><Metric label={direct ? 'After' : 'First request after'} tokens={right} maximum={maximum} reading={direct ? undefined : after} /></div>
    <div className="context-foot"><span>Trigger · {boundary.trigger ?? 'Not recorded'}</span><span>Duration · {boundary.durationMs === undefined ? 'Not recorded' : `${number(boundary.durationMs)} ms`}</span></div>
    <Summary summary={summary} />
  </section>;
}
export function CapturedContextReport({ report, time }: { report: ContextReport; time?: string }) {
  return <section className="context-report" aria-label="Captured context report"><strong>Claude Code · {report.heading}</strong><small>Report from {contextTime(time)}</small>
    <dl>{report.rows.map((row, i) => <div key={i}><dt>{row.label}</dt><dd>{row.value}</dd>{row.percent !== undefined && <span className="context-track" aria-hidden="true"><span style={{ width: `${row.percent}%` }} /></span>}</div>)}</dl>
    {report.clipped && <small>Additional rows are in the captured report.</small>}
    <details><summary>Captured report</summary><pre className="output">{report.raw}</pre></details>
  </section>;
}
