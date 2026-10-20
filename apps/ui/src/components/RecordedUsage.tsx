import { Fragment, useEffect, useState } from 'react';
import type { UsagePayload } from '@drishya/contracts';
import { recordedUsageApi } from '../api.ts';
import { useApp } from '../state.ts';
import { useSessionWorkspace } from './SessionWorkspace.tsx';

type Row = [string, string | number | undefined];
function Rows({ rows }: { rows: Row[] }) {
  return <dl>{rows.filter(([, value]) => value !== undefined).map(([name, value]) => <Fragment key={name}><dt>{name}</dt><dd>{value}</dd></Fragment>)}</dl>;
}
function RecordedPoint({ point }: { point: UsagePayload }) {
  const tokens = point.tokens;
  return <section aria-label="Recorded usage"><strong>Recorded · {point.source === 'codex-token-count' ? 'Codex token_count' : point.source === 'claude-cost-state' ? 'Claude cost-state' : 'Claude message.usage'}</strong>
    <small>{point.cumulative ? 'Session cumulative' : 'One assistant message'}{point.model ? ` · ${point.model}` : ''}</small>
    <Rows rows={[
      ['Input tokens', tokens?.input], ['Output tokens', tokens?.output], ['Cached input', tokens?.cachedInput], ['Cache write', tokens?.cacheWrite],
      ['Reasoning output tokens', tokens?.reasoningOutput], ['Total tokens', tokens?.total], ['Context capacity', point.contextWindow],
      ['Cost (USD) · harness estimate', point.cost && !point.cost.modelCostUnknown ? point.cost.usd : undefined],
      ['Lines added', point.work?.linesAdded], ['Lines removed', point.work?.linesRemoved], ['Duration (ms)', point.work?.durationMs],
      ['API duration (ms)', point.work?.apiDurationMs], ['Tool duration (ms)', point.work?.toolDurationMs],
      ['Primary window used', point.limits ? `${point.limits.usedPercent}%` : undefined], ['Window (minutes)', point.limits?.windowMinutes],
      ['Reset (Unix seconds)', point.limits?.resetsAt], ['Plan', point.limits?.plan],
    ]} />
  </section>;
}

/** Recorded journal receipts and native-runtime receipts have separate, explicit sources. */
export function UsagePeek() {
  const { controller } = useSessionWorkspace();
  const { projection, mode, recordingId, source } = useApp();
  const [open, setOpen] = useState(false), [available, setAvailable] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const recorded = mode === 'history' ? projection?.usage?.latest : undefined;
  const native = controller?.usage;
  useEffect(() => {
    setAvailable(false); setStatus('');
    if (!open || source?.kind !== 'daemon' || !recordingId || recordingId.includes('+')) return;
    let cancelled = false;
    void recordedUsageApi.available(recordingId).then(result => { if (!cancelled) setAvailable(result.available); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, recordingId, source]);
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
  return <details className="usage-peek" onToggle={event => setOpen(event.currentTarget.open)}><summary>Usage</summary><div>
    {recorded && <RecordedPoint point={recorded} />}
    {native && <section aria-label="Native runtime usage"><strong>Native runtime · {controller?.harness === 'codex' ? 'Last model request' : 'Connected turn'}</strong><Rows rows={[
      ['Input tokens', native.input], ['Output tokens', native.output], ['Cached input', native.cached], ['Cost (USD) · harness estimate', native.costUsd],
      ['Context input', native.contextInput], ['Context capacity', native.contextWindow], ['Thread tokens so far', native.threadTotal], ['Reasoning output tokens', native.reasoningOutput],
    ]} /></section>}
    {!recorded && !native && <p>{mode === 'replay' ? 'Recorded accounting is available in full session history.' : 'No usage values captured for this session.'}</p>}
    <small>Only reported values. Cumulative tokens are usage, not occupied context. Subscription billing is not inferred.</small>
    {available && <button className="btn ghost" disabled={busy} onClick={() => void rescan()}>Rescan original journal</button>}
    {status && <p role="status">{status}</p>}
  </div></details>;
}
