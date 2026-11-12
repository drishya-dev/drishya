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
  return <section className="request-context" aria-label="Request input">
    <strong>Last request input{reading.input.basis === 'derived-request-input' ? ' · computed' : ''}</strong>
    <span>{number(reading.input.tokens)} tokens{reading.window ? ` / ${number(reading.window)} context window` : ' · Context window not reported'}</span>
    <small>Read at {contextTime(reading.time)}{percent !== undefined ? ` · ${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of window · computed` : ''}</small>
    <small>{reading.input.basis === 'derived-request-input' ? 'Claude message.usage · input + cache read + cache write.' : 'Codex token_count · request input.'} This reading stays fixed until another is recorded.</small>
  </section>;
}
// History remounts a row as it pages and measures; a summary being read must not close by itself.
const openSummaries = new Set<string>();
function Summary({ summary, unlinked = false }: { summary?: CompactionSummary; unlinked?: boolean }) {
  const [open, setOpenState] = useState(() => !!summary?.id && openSummaries.has(summary.id));
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (summary?.id) { if (next) openSummaries.add(summary.id); else openSummaries.delete(summary.id); }
  };
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
    <button ref={button} type="button" className="btn ghost" aria-expanded={open} aria-controls={readerId} onClick={() => setOpen(!open)}>{open ? 'Hide summary' : unlinked ? 'Read nearby summary' : 'Read summary'}</button>
    {open && <div id={readerId} ref={reader} tabIndex={-1} className="context-summary-reader" aria-label="Compaction summary" onClickCapture={event => {
      navigation.current = (event.target as Element).closest<HTMLButtonElement>('.reader-pages button');
    }}><ArtifactReader id={summary.artifactId} kind="output" provenance navigationSlot={`compaction/${summary.id}`} /><button type="button" className="btn ghost" onClick={close}>Close summary</button></div>}
  </div>;
}
function Metric({ label, tokens, maximum, reading }: { label: string; tokens?: number; maximum: number; reading?: ContextReading }) {
  return <div className="context-metric"><span>{label}</span><strong>{tokens === undefined ? 'Not recorded' : `${number(tokens)} tokens`}</strong>
    {tokens !== undefined && <span className="context-track" aria-hidden="true"><span style={{ width: `${Math.min(100, maximum ? tokens / maximum * 100 : 0)}%` }} /></span>}
    {reading && <small>{contextTime(reading.time)}{reading.window ? ` · ${number(reading.window)} context window` : ''}</small>}
  </div>;
}
function CompactionIcon() {
  return <svg className="context-compaction-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 8h11M8 2v3.5M6 3.5 8 5.5l2-2M8 14v-3.5M6 12.5 8 10.5l2 2" />
  </svg>;
}
/** Whether this passage currently exposes at least one visible compaction boundary or unlinked summary. */
export function useHasVisibleCompaction(compactionIds?: string[], summaryIds?: string[]): boolean {
  const evidence = useContext(Evidence);
  if (!evidence) return false;
  const { projection: p, step, total } = evidence, atEnd = step >= total;
  const available = (after: number) => atEnd || after <= step;
  if (compactionIds?.some(id => p.compactions?.some(c => c.id === id && c.step < step))) return true;
  return !!summaryIds?.some(id => {
    const s = p.compactionSummaries?.find(item => item.id === id && available(item.availableAfterStep));
    return !!s && !s.boundaryId;
  });
}
/** Only references selected for this loaded passage are read, with an independent replay cutoff. */
export function CompactionEvidence({ id, summaryId, commandNote }: { id?: string; summaryId?: string; commandNote?: string }) {
  const evidence = useContext(Evidence);
  if (!evidence) return null;
  const { projection: p, step, total } = evidence, atEnd = step >= total;
  const available = (after: number, request = false) => atEnd || (request ? after < step : after <= step);
  const boundary = id ? p.compactions?.find(c => c.id === id && c.step < step) : undefined;
  const summary = p.compactionSummaries?.find(s => s.id === (boundary?.summaryId ?? summaryId) && available(s.availableAfterStep));
  if (!boundary) return summary && !summary.boundaryId ? <div className="context-evidence context-unlinked" data-summary-id={summary.id}><div className="context-heading"><CompactionIcon /><strong>Context compacted</strong><small>Summary recorded nearby · link not recorded · {contextTime(summary.time)}</small></div><Summary summary={summary} unlinked /></div> : null;
  const before = p.context?.readings.find(r => r.id === boundary.priorReadingId && available(r.availableAfterStep, true));
  const after = p.context?.readings.find(r => r.id === boundary.nextReadingId && available(r.availableAfterStep, true));
  const direct = p.agents.find(a => a.id === boundary.agentId)?.harness === 'claude-code';
  const left = direct ? boundary.beforeTokens : before?.input.tokens, right = direct ? boundary.afterTokens : after?.input.tokens;
  const maximum = Math.max(left ?? 0, right ?? 0);
  return <section className="context-evidence" aria-label="Compaction" data-compaction-id={boundary.id}>
    <div className="context-heading"><CompactionIcon /><strong>Context compacted</strong><small>{contextTime(boundary.time)}</small>{commandNote && <small className="context-command">{commandNote}</small>}</div>
    <small>{direct ? 'Before and after tokens · relative scale' : 'Request input readings around compaction · relative scale'}</small>
    <div className="context-pair"><Metric label={direct ? 'Before' : 'Last request before'} tokens={left} maximum={maximum} reading={direct ? undefined : before} /><Metric label={direct ? 'After' : 'First request after'} tokens={right} maximum={maximum} reading={direct ? undefined : after} /></div>
    <div className="context-foot"><span>Trigger · {boundary.trigger ?? 'Not recorded'}</span><span>Duration · {boundary.durationMs === undefined ? 'Not recorded' : `${number(boundary.durationMs)} ms`}</span></div>
    <Summary summary={summary} />
  </section>;
}
export function CapturedContextReport({ report, time }: { report: ContextReport; time?: string }) {
  return <section className="context-report" aria-label="Context report"><strong>Claude Code · {report.heading}</strong><small>Report from {contextTime(time)}</small>
    <dl>{report.rows.map((row, i) => <div key={i}><dt>{row.label}</dt><dd>{row.value}</dd>{row.percent !== undefined && <span className="context-track" aria-hidden="true"><span style={{ width: `${row.percent}%` }} /></span>}</div>)}</dl>
    {report.sections.map((section, i) => <div className="context-listing" role="group" aria-label={section.title} key={i}><small>{section.title} · {section.rows.length} listed</small>
      <dl>{section.rows.map((row, j) => <div key={j}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>)}
    {report.clipped && <small>Additional rows are in the report.</small>}
    <details><summary>Report</summary><pre className="output">{report.raw}</pre></details>
  </section>;
}
