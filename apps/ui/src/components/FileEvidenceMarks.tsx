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

export function FileEvidenceMarks({ evidence, count }: { evidence?: FileEvidence; count?: number }) {
  if (count) return <span className="file-evidence folder-evidence" title={`${count} files with captured activity`} aria-label={`${count} files with captured activity`}><i aria-hidden="true"/>{count}</span>;
  if (!evidence || !evidence.change && !evidence.readCalls && !evidence.now) return null;
  const change = evidence.change === 'A' ? 'creation' : 'edit/write';
  return <span className="file-evidence">
    {!!evidence.readCalls && <span className="file-reads" title={`${evidence.readCalls} captured read calls`} aria-label={`${evidence.readCalls} captured read calls`}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2"/></svg>{evidence.readCalls}</span>}
    {evidence.change && <span className={`file-change change-${evidence.change}`} title={`Captured ${change}${evidence.changeStatus === 'unknown' ? ' · outcome not reported' : ''}`} aria-label={`Captured ${change}${evidence.changeStatus === 'unknown' ? ', outcome not reported' : ''}`}>{evidence.change}</span>}
    {evidence.now && <span className="file-now" title="Open captured tool call" aria-label="Open captured tool call">now</span>}
  </span>;
}
