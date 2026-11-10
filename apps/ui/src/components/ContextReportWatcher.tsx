import { useEffect } from 'react';
import { useApp } from '../state.ts';
import { publishContextReport, useDaemonReport } from '../lib/context-report-store.ts';

/** Keeps the newest `/context` report current without rendering anything, for recordings large enough to be paged (their reader holds no whole timeline). */
export function ContextReportWatcher() {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), recording = useApp(s => s.recording), paged = useApp(s => !!s.historyPage);
  useEffect(() => {
    if (!paged || !source?.contextReport || !id) return;
    let cancelled = false;
    const timer = setTimeout(() => { void source.contextReport!(id).then(result => { if (!cancelled) publishContextReport(id, result.candidates); }, () => {}); }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [paged, source, id, recording?.revision, recording?.observationCount]);
  useEffect(() => () => useDaemonReport.setState({ newest: undefined, checked: undefined }), [id]);
  return null;
}
