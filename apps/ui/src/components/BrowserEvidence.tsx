import { useLayoutEffect, useState, type ReactNode } from 'react';
import type { Operation } from '@drishya/contracts';
import { browserStep, safeWebUrl } from '../lib/browser-evidence.ts';
import { useApp } from '../state.ts';
import { ToolOutput } from './ToolOutput.tsx';
import { ToolInput } from './ToolInput.tsx';
import { WebResults } from './WebResults.tsx';
import { CapturedOutcomes } from './CapturedOutcomes.tsx';
import { fetchFacts } from './CommandRun.tsx';
import './browser-evidence.css';

export function RecordedUrl({ url }: { url: string }) {
  return safeWebUrl(url) ? <a className="browser-url" href={url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{url}</a> : <span className="browser-url">{url}</span>;
}

/** Captured page material. The result is an excerpt, never a generated page summary. */
export function BrowserEvidence({ op, full = false }: { op: Operation; full?: boolean }) {
  const step = browserStep(op);
  if (!step) return null;
  return <div className="browser-evidence">
    <div className="browser-address">{step.url ? <RecordedUrl url={step.url}/> : <span className="muted">Page URL not captured for this step</span>}</div>
    <div className="browser-action"><span>{step.action}</span>{step.tab !== undefined && <small>tab {step.tab}</small>}<small>{op.status === 'running' ? 'Running' : op.status === 'error' ? 'Failed' : op.status === 'ok' ? 'Returned' : 'Outcome not captured'}</small></div>
    {step.batch?.length ? <ol className="browser-batch">{step.batch.map((item, i) => <li key={i}><span>{item.name ?? 'Recorded action'}{item.action ? ` · ${item.action}` : ''}</span>{item.url && <RecordedUrl url={item.url}/>}</li>)}{step.batchCount! > step.batch.length && <li className="muted">{step.batchCount! - step.batch.length} more actions · expand for captured input</li>}</ol> : null}
    {step.query && <div className="browser-query">{step.query}</div>}
    {step.excerpt ? <div className={`browser-excerpt${full ? ' full' : ''}`} tabIndex={0} aria-label="Captured browser result excerpt"><ToolOutput text={step.excerpt}/></div> : <p className="muted">{op.status === 'running' ? 'Waiting for browser result' : 'No page text captured'}</p>}
    {full && op.detail.kind === 'mcp' && <details><summary>Captured browser input</summary><ToolInput value={op.detail.input}/></details>}
  </div>;
}

export function WebEvidence({ op, full = false }: { op: Operation; full?: boolean }) {
  const d = op.detail;
  if (d.kind !== 'web') return null;
  return <div className="web-evidence">
    {d.url && <RecordedUrl url={d.url}/>}
    {d.query && <div className="query">{d.query}</div>}
    {d.fetch && fetchFacts(d.fetch) && <div className="browser-action">{fetchFacts(d.fetch)}</div>}
    {d.results?.length ? <WebResults results={d.results} snippets={full} limit={full ? undefined : 5}/> : null}
    {full && <CapturedOutcomes output={d.resultPreview}/>}
    {(full || !d.results?.length) && <div className={`browser-excerpt${full ? ' full' : ''}`} tabIndex={0} aria-label="Captured web result excerpt"><ToolOutput text={d.resultPreview ?? (op.status === 'running' ? 'Waiting for result' : 'No result content captured')}/></div>}
  </div>;
}

/** The chosen step is still the original operation card: images, raw input and inspection keep their owners. */
export function BrowserStrip({ operations, renderOperation }: { operations: Operation[]; renderOperation: (op: Operation, index: number) => ReactNode }) {
  const trackLatest = useApp(s => s.follow && (s.mode === 'replay' || s.recording?.live === true));
  const [choice, setChoice] = useState(trackLatest ? operations.at(-1)?.id : operations[0]?.id);
  const target = useApp(s => s.expandedOp ?? s.selectedOp);
  const [lastCount, setLastCount] = useState(operations.length);
  if (lastCount !== operations.length) { setLastCount(operations.length); if (trackLatest) setChoice(operations.at(-1)?.id); }
  const observation = useApp(s => s.focusObservationId);
  const [lastTarget, setLastTarget] = useState<string>();
  const targeted = operations.find(op => op.id === target || observation && op.observationIds.includes(observation))?.id;
  // A new explicit navigation wins once. Scrubbing afterwards remains free even with an Inspector open.
  if (targeted !== lastTarget) { setLastTarget(targeted); if (targeted) setChoice(targeted); }
  const index = Math.max(0, operations.findIndex(op => op.id === choice));
  const op = operations[index];
  useLayoutEffect(() => { window.dispatchEvent(new Event('drishya-material-layout')); }, [op?.id]);
  if (!op) return null;
  const choose = (next: number) => { const item = operations[next]; if (item) { setChoice(item.id); useApp.getState().set({ follow: false }); } };
  return <div className="browser-strip" data-browser-steps={operations.length} data-browser-first-op={operations[0]?.id}>
    <nav className="browser-scrubber" aria-label="Captured browser steps" onClick={event => event.stopPropagation()}>
      <button type="button" aria-label="Previous browser step" disabled={index === 0} onClick={() => choose(index - 1)}>‹</button>
      <span>Browser · {index + 1} / {operations.length}</span>
      <input type="range" aria-label="Browser step" min={1} max={operations.length} value={index + 1} onChange={event => choose(Number(event.target.value) - 1)}/>
      <button type="button" aria-label="Next browser step" disabled={index === operations.length - 1} onClick={() => choose(index + 1)}>›</button>
    </nav>
    {renderOperation(op, index)}
  </div>;
}
