import { RequestContextLine } from './ContextEvidence.tsx';
import { Fragment, useEffect, useState } from 'react';
import type { UsagePayload } from '@drishya/contracts';
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
  const total = point?.tokens?.total, used = point?.limits?.usedPercent;
  return [total !== undefined ? `${compact(total)} tokens` : '', used !== undefined ? `${used}% of limit` : ''].filter(Boolean).join(' · ') || undefined;
}
function Rows({ rows }: { rows: Row[] }) {
  return <dl>{rows.filter(([, value]) => value !== undefined).map(([name, value]) => <Fragment key={name}><dt>{name}</dt><dd>{value}</dd></Fragment>)}</dl>;
}
function RecordedPoint({ point }: { point: UsagePayload }) {
  const tokens = point.tokens;
  return <section aria-label="Recorded usage"><strong>Recorded · {point.source === 'codex-token-count' ? 'Codex token_count' : point.source === 'claude-cost-state' ? 'Claude cost-state' : 'Claude message.usage'}</strong>
    <small>{point.cumulative ? 'Session cumulative' : point.source === 'claude-message-usage' ? 'One assistant message' : 'Last model request'}{point.model ? ` · ${point.model}` : ''}</small>
    <Rows rows={[
      ['Input tokens', count(tokens?.input)], ['Output tokens', count(tokens?.output)], ['Cached input', count(tokens?.cachedInput)], ['Cache write', count(tokens?.cacheWrite)],
      ['Reasoning output tokens', count(tokens?.reasoningOutput)], ['Total tokens', count(tokens?.total)], ['Context window', count(point.contextWindow)],
      ['Cost · harness estimate', point.cost && !point.cost.modelCostUnknown ? money(point.cost.usd) : undefined],
      ['Lines added', count(point.work?.linesAdded)], ['Lines removed', count(point.work?.linesRemoved)], ['Session time', milliseconds(point.work?.durationMs)],
      ['Waiting on the API', milliseconds(point.work?.apiDurationMs)], ['Running tools', milliseconds(point.work?.toolDurationMs)],
      [point.limits?.windowMinutes !== undefined ? `Plan limit used · ${windowWords(point.limits.windowMinutes)} window` : 'Plan limit used', point.limits ? `${point.limits.usedPercent}%` : undefined],
      ['Limit resets', resetTime(point.limits?.resetsAt)], ['Plan', point.limits?.plan],
    ]} />
  </section>;
}

/** Recorded journal receipts and native-runtime receipts have separate, explicit sources. */
export function UsagePeek() {
  const { controller } = useSessionWorkspace();
  const { projection, mode, step, historyPage } = useApp();
  const total = historyPage?.scene.total ?? projection?.timeline.length ?? 0;
  const readings = projection?.context?.readings.filter(r => mode === 'history' || step >= total || r.availableAfterStep < step);
  const context = projection?.context?.latest && readings?.length && new Set(readings.map(r => r.agentId)).size === 1 ? readings.at(-1) : undefined;
  const recorded = mode === 'history' ? projection?.usage?.latest : undefined;
  const native = controller?.usage;
  const brief = usageBrief(recorded);
  return <details className="usage-peek"><summary>Usage{brief && <small className="usage-brief">{brief}</small>}</summary><div>
    {context && <RequestContextLine reading={context} />}
    {recorded && <RecordedPoint point={recorded} />}
    {native && <section aria-label="Native runtime usage"><strong>Native runtime · {controller?.harness === 'codex' ? 'Last model request' : 'Connected turn'}</strong><Rows rows={[
      ['Input tokens', count(native.input)], ['Output tokens', count(native.output)], ['Cached input', count(native.cached)], ['Cost · harness estimate', native.costUsd === undefined ? undefined : money(native.costUsd)],
      ['Context input', count(native.contextInput)], ['Context window', count(native.contextWindow)], ['Thread tokens so far', count(native.threadTotal)], ['Reasoning output tokens', count(native.reasoningOutput)],
    ]} /></section>}
    {!recorded && !native && !context && <p>{mode === 'replay' ? 'Recorded accounting is available in full session history.' : 'No usage values captured for this session.'}</p>}
    <small>Captured receipts; derived request input is labelled. Cumulative tokens are usage, not occupied context. Subscription billing is not inferred.</small>
  </div></details>;
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
