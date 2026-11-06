import {Disclosure} from './Disclosure.tsx';
import { contextTime } from './ContextEvidence.tsx';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ContextReading, UsagePayload } from '@drishya/contracts';
import { contextReport, type ContextReport } from '../lib/context-report.ts';
import './recorded-usage.css';
import { recordedUsageApi } from '../api.ts';
import { useApp } from '../state.ts';
import { useSessionWorkspace } from './SessionWorkspace.tsx';

type Row = [string, string | number | undefined];
// UI-15: reported values, written the way a person reads them. Nothing is added or inferred; units follow the recorded field.
const count = (value?: number) => value === undefined ? undefined : value.toLocaleString('en-US');
const money = (value: number) => `$${value >= 1 ? value.toFixed(2) : value.toFixed(4)}`;
const compact = (value: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const milliseconds = (value?: number) => {
  if (value === undefined) return undefined;
  if (value < 1000) return `${value} ms`;
  const seconds = Math.round(value / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours} h ${minutes} min` : minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
};
const windowWords = (minutes?: number) => {
  if (minutes === undefined) return undefined;
  if (minutes % 1440 === 0) return `${minutes / 1440}-day`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour`;
  return `${minutes}-minute`;
};
const resetTime = (seconds?: number) => seconds === undefined ? undefined : new Date(seconds * 1000).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** The one line shown beside the Usage entry while it is closed. */
function usageBrief(point?: UsagePayload) {
  const total = point?.tokens?.total, used = point?.limits?.usedPercent, other = point?.secondaryLimits;
  const limit = used !== undefined ? `${used}% of limit` : other ? `${other.usedPercent}% of ${windowWords(other.windowMinutes)} limit` : '';
  return [total !== undefined ? `${compact(total)} tokens` : '', limit].filter(Boolean).join(' · ') || undefined;
}
const sourceName = (source: UsagePayload['source']) => source === 'codex-token-count' ? 'Codex token_count' : source === 'claude-cost-state' ? 'Claude cost-state' : 'Claude message.usage';
function Rows({ rows }: { rows: Row[] }) {
  return <dl>{rows.filter(([, value]) => value !== undefined).map(([name, value]) => <Fragment key={name}><dt>{name}</dt><dd>{value}</dd></Fragment>)}</dl>;
}
/** A share the harness reported (or one computed from two reported numbers, which the title says) drawn as a quiet bar. */
function Share({ label, value, percent, title }: { label: string; value: string; percent: number; title: string }) {
  return <div className="usage-share" title={title}><span>{label}</span><span>{value}</span><span className="usage-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></span></div>;
}

/** USAGE-1 (Yash, 3 Nov): what people read about a session's spending, as a few sections with bars where a share exists. Each harness fills what
 *  it records; a section a harness does not record says so instead of staying empty. A later adapter fills the same sections. */
function Limits({ point, harness }: { point?: UsagePayload; harness?: string }) {
  const limits = point?.limits, secondary = point?.secondaryLimits;
  // Each window is shown on its own evidence: the weekly one does not depend on a primary window having been recorded.
  return <section aria-label="Limits"><h4>Limits</h4>
    {limits || secondary ? <>
      {limits && <><Share label={`${windowWords(limits.windowMinutes) ?? ''} window`.trim()} value={`${limits.usedPercent}% used`} percent={limits.usedPercent} title={`Recorded by ${sourceName(point!.source)} · rate_limits.primary`} />
        <small>{limits.resetsAt ? `Resets ${resetTime(limits.resetsAt)}` : 'Reset time not recorded'}{limits.plan ? ` · ${limits.plan} plan` : ''}</small></>}
      {secondary && <><Share label={`${windowWords(secondary.windowMinutes) ?? ''} window`.trim()} value={`${secondary.usedPercent}% used`} percent={secondary.usedPercent} title={`Recorded by ${sourceName(point!.source)} · rate_limits.secondary`} />
        <small>Resets {resetTime(secondary.resetsAt)}</small></>}</>
      : <p className="usage-absent">{harness === 'claude-code' ? 'Claude Code does not record plan limits in its journal.' : 'No plan limit recorded for this session.'}</p>}
  </section>;
}
function Context({ reading, report, main }: { reading?: ContextReading; report?: { report: ContextReport; time?: string }; main?: boolean }) {
  if (!reading && !report) return <section aria-label="Context"><h4>Context</h4><p className="usage-absent">No context reading recorded.</p></section>;
  const percent = reading?.window ? reading.input.tokens / reading.window * 100 : undefined;
  const basis = reading?.input.basis === 'derived-request-input' ? 'Computed: Claude message.usage input + cache read + cache write' : 'Recorded: Codex token_count request input';
  return <section aria-label="Context"><h4>Context</h4>
    {reading && (percent !== undefined
      ? <Share label={main ? 'Main agent · last request' : 'Last request'} value={`${count(reading.input.tokens)} of ${count(reading.window)}`} percent={percent} title={`${basis}; window recorded by the harness; the share is computed`} />
      : <p title={basis}>{count(reading.input.tokens)} tokens in the last request · <span className="usage-absent">window not recorded</span></p>)}
    {reading && <small>Read {contextTime(reading.time)}</small>}
    {report && <div className="usage-report" role="group" aria-label="Context report"><small>From /context · {contextTime(report.time)}</small>
      {report.report.rows.map((row, i) => row.percent !== undefined
        ? <Share key={i} label={row.label} value={row.value} percent={row.percent} title="Recorded by Claude Code's /context report" />
        : <div key={i} className="usage-share" title="Recorded by Claude Code's /context report"><span>{row.label}</span><span>{row.value}</span></div>)}
    </div>}
  </section>;
}
function Tokens({ point }: { point: UsagePayload }) {
  const tokens = point.tokens;
  return <section aria-label="Tokens"><h4>{point.cumulative ? "This session's tokens" : point.source === 'claude-message-usage' ? 'Last assistant message' : 'Last model request'}</h4>
    <small title="Where these numbers come from">Recorded · {sourceName(point.source)}{point.model ? ` · ${point.model}` : ''}</small>
    {tokens && Object.values(tokens).some(value => value !== undefined) ? <Rows rows={[
      ['Input', count(tokens.input)], ['Output', count(tokens.output)], ['Cached input', count(tokens.cachedInput)], ['Cache write', count(tokens.cacheWrite)],
      ['Reasoning output', count(tokens.reasoningOutput)], ['Total', count(tokens.total)],
    ]} /> : <p className="usage-absent">This record carries no token counts.</p>}
  </section>;
}
function Work({ point }: { point: UsagePayload }) {
  const rows: Row[] = [
    ['Cost · harness estimate', point.cost && !point.cost.modelCostUnknown ? money(point.cost.usd) : undefined],
    ['Lines added', count(point.work?.linesAdded)], ['Lines removed', count(point.work?.linesRemoved)], ['Session time', milliseconds(point.work?.durationMs)],
    ['Waiting on the API', milliseconds(point.work?.apiDurationMs)], ['Running tools', milliseconds(point.work?.toolDurationMs)],
  ];
  if (!rows.some(([, value]) => value !== undefined)) return null;
  return <section aria-label="Work"><h4>Work</h4><Rows rows={rows} /></section>;
}

/** Recorded journal receipts and native-runtime receipts have separate, explicit sources. */
export function UsagePeek() {
  const { controller } = useSessionWorkspace();
  const { projection, mode, step, historyPage, recording } = useApp();
  const total = historyPage?.scene.total ?? projection?.timeline.length ?? 0;
  const readings = projection?.context?.readings.filter(r => mode === 'history' || step >= total || r.availableAfterStep < step);
  // With sub-agents, the context that matters is the main agent's: its latest reading, never a sub-agent's or a blend.
  const main = projection?.agents.find(agent => !agent.parentId)?.id;
  const reading = readings?.length ? (new Set(readings.map(r => r.agentId)).size === 1 ? readings.at(-1) : readings.filter(r => r.agentId === main).at(-1)) : undefined;
  // Context readings come only from usage receipts; with readings but no total, the receipts span more than one journal (a continued session).
  const joined = !projection?.usage && !!projection?.context?.readings.length;
  const recorded = mode === 'history' ? projection?.usage?.latest : undefined;
  // The newest /context report the person ran, from the loaded history; in replay, only one already reached.
  const report = useMemo(() => {
    const items = projection?.timeline ?? [];
    for (let i = (mode === 'history' ? items.length : Math.min(items.length, step)) - 1; i >= 0; i--) {
      const item = items[i]!;
      if (item.type !== 'turn' || !item.prompt?.includes('local-command-stdout')) continue;
      const found = contextReport(item.prompt);
      if (found) return { report: found, time: item.time };
    }
    return undefined;
  }, [projection?.timeline, mode, step]);
  const native = controller?.usage;
  const brief = usageBrief(recorded);
  const harness = recording?.harness;
  return <Disclosure surface="session/usage" initiallyOpen={false} className="usage-peek"><summary>Usage{brief && <small className="usage-brief">{brief}</small>}</summary><div>
    {mode === 'replay' && !reading && !report ? <p>Recorded accounting is available in full session history.</p> : <>
      <Limits point={recorded} harness={harness} />
      <Context reading={reading} report={report} main={!!main && readings?.some(r => r.agentId !== main)} />
      {recorded ? <Tokens point={recorded} /> : <section aria-label="Tokens"><h4>Tokens</h4><p className="usage-absent">{joined ? 'This session continues across more than one journal, and each reports its own usage, so no single total is shown.' : 'No usage values recorded for this session.'}</p></section>}
      {recorded && <Work point={recorded} />}
    </>}
    {native && <section aria-label="Native runtime usage"><h4>Native runtime · {controller?.harness === 'codex' ? 'last model request' : 'connected turn'}</h4><Rows rows={[
      ['Input tokens', count(native.input)], ['Output tokens', count(native.output)], ['Cached input', count(native.cached)], ['Cost · harness estimate', native.costUsd === undefined ? undefined : money(native.costUsd)],
      ['Context input', count(native.contextInput)], ['Context window', count(native.contextWindow)], ['Thread tokens so far', count(native.threadTotal)], ['Reasoning output tokens', count(native.reasoningOutput)],
    ]} /></section>}
    <small className="usage-note">Every number is the harness's own unless its title says computed. Cumulative tokens are spending, not what fills the context. Subscription billing is not inferred.</small>
  </div></Disclosure>;
}

/** Re-reads the original journal for new records. It is about the journal, not about usage, so it lives with Share. */
export function RescanEntry({ menuOpen }: { menuOpen: boolean }) {
  const { recordingId, source } = useApp();
  const [available, setAvailable] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  // A finished rescan's message belongs to the recording; it must survive the projection reload the rescan itself causes.
  useEffect(() => { setStatus(''); }, [recordingId]);
  useEffect(() => {
    if (!menuOpen || source?.kind !== 'daemon' || !recordingId || recordingId.includes('+')) { setAvailable(false); return; }
    let cancelled = false;
    void recordedUsageApi.available(recordingId).then(result => { if (!cancelled) setAvailable(result.available); }).catch(() => {});
    return () => { cancelled = true; };
  }, [menuOpen, recordingId, source]);
  async function rescan() {
    if (!recordingId || busy) return;
    setBusy(true); setStatus('Reading the original journal…');
    try {
      const result = await recordedUsageApi.rescan(recordingId);
      await useApp.getState().reloadProjection();
      setStatus(`${result.added} new observations added.${result.more ? ' More journal data remains to read.' : ''}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Journal rescan failed'); }
    finally { setBusy(false); }
  }
  if (!available && !status) return null;
  return <>{available && <button className="btn ghost" disabled={busy} onClick={() => void rescan()}>Rescan original journal</button>}{status && <p role="status">{status}</p>}</>;
}
