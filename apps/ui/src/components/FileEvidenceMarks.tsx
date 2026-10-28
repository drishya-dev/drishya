import { useEffect, useMemo, useState } from 'react';
import type { Projection } from '@drishya/contracts';
import { fileEvidence, type FileEvidence } from '../../../../packages/scene/src/file-evidence.ts';
import { useApp } from '../state.ts';
import './file-evidence.css';

/** One bounded request for visible files, not one request per row or a full projection download. */
export function useFileEvidence(paths: string[], projection: Projection, shown: boolean) {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId);
  const revision = useApp(s => id ? s.renderedRevisions[id] : undefined);
  const mode = useApp(s => s.mode), step = useApp(s => s.mode === 'replay' ? s.step : undefined);
  const live = useApp(s => s.recording?.live);
  const key = JSON.stringify(paths.slice(0, 100));
  const [result, setResult] = useState<{ source: typeof source; id: typeof id; step?: number; entries: FileEvidence[] }>();
  useEffect(() => {
    if (!shown || !source?.fileEvidence || !id || !paths.length) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void source.fileEvidence!(id, JSON.parse(key), step).then(entries => {
        if (!cancelled) setResult({ source, id, step, entries });
      }, () => { if (!cancelled) setResult(undefined); });
    }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source, id, key, revision, step, shown]);
  return useMemo(() => {
    const entries = source?.fileEvidence
      ? result?.source === source && result.id === id && result.step === step ? result.entries : []
      : fileEvidence(projection, paths);
    return new Map(entries.map(entry => [entry.path, { ...entry, now: entry.now && mode === 'history' && !!live }]));
  }, [result, source, id, step, projection, key, mode, live]);
}

export function fileEvidenceDescription(evidence?: FileEvidence, count?: number): string | undefined {
  if (count) return `${count} file${count===1?'':'s'} with captured activity`;
  if (!evidence) return undefined;
  return [evidence.readCalls ? `${evidence.readCalls} captured read calls` : '', evidence.change ? `Captured ${evidence.change==='A'?'creation':evidence.change==='D'?'deletion':'edit/write'}${evidence.changeStatus==='unknown'?', outcome not reported':''}` : '', evidence.outside ? outsideLabel(evidence.outside) : '', evidence.now ? 'Open captured tool call' : ''].filter(Boolean).join('; ') || undefined;
}

const outsideLabel = (n: number) => `Changed on disk outside Claude Code’s edits${n > 1 ? ` (${n} times)` : ''}: by you, another program or a command`;

/** UI-13: only what happened to the file shows on its row (E/A/D, changed outside, now). Read and folder counts live in the row's description. */
export function FileEvidenceMarks({ evidence }: { evidence?: FileEvidence }) {
  if (!evidence || !evidence.change && !evidence.now && !evidence.outside) return null;
  const change = evidence.change === 'A' ? 'creation' : evidence.change === 'D' ? 'deletion' : 'edit/write';
  return <span className="file-evidence">
    {evidence.change && <span className={`file-change change-${evidence.change}`} title={`Captured ${change}${evidence.changeStatus === 'unknown' ? ' · outcome not reported' : ''}`} aria-label={`Captured ${change}${evidence.changeStatus === 'unknown' ? ', outcome not reported' : ''}`}>{evidence.change}</span>}
    {!!evidence.outside && <span className="file-outside" title={outsideLabel(evidence.outside)} aria-label={outsideLabel(evidence.outside)}>≠</span>}
    {evidence.now && <span className="file-now" title="Open captured tool call" aria-label="Open captured tool call">now</span>}
  </span>;
}
