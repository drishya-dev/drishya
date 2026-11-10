import { create } from 'zustand';
import { useMemo } from 'react';
import { contextReport, newestContextReport, type ContextReport } from './context-report.ts';
import { useApp } from '../state.ts';

type Newest = { report: ContextReport; time?: string };
/** USAGE-1: the newest `/context` report of a paged recording, read from the daemon because the reader holds only a window of the history. */
export const useDaemonReport = create<{ newest?: Newest; checked?: string }>(() => ({}));

export function publishContextReport(id: string, candidates: { time?: string; prompt: string }[]) {
  useDaemonReport.setState({ checked: id });
  for (const candidate of candidates) {
    const report = contextReport(candidate.prompt);
    if (report) { useDaemonReport.setState({ newest: { report, ...(candidate.time ? { time: candidate.time } : {}) } }); return; }
  }
  if (useDaemonReport.getState().newest) useDaemonReport.setState({ newest: undefined });
}

/** True while a paged recording's report has not been asked for yet, so "no report recorded" is not said before it is known. */
export function useContextReportPending(): boolean {
  const paged = useApp(s => !!s.historyPage), id = useApp(s => s.recordingId), checked = useDaemonReport(s => s.checked);
  return paged && checked !== id;
}

/** The newest report the person ran, from the whole history. In replay only one already reached counts (only possible while the timeline is held in full). */
export function useNewestContextReport(): Newest | undefined {
  const projection = useApp(s => s.projection), paged = useApp(s => !!s.historyPage), mode = useApp(s => s.mode), step = useApp(s => s.step);
  const daemon = useDaemonReport(s => s.newest);
  const local = useMemo(() => paged ? undefined : newestContextReport(projection?.timeline, mode === 'history' ? undefined : step), [paged, projection?.timeline, mode, step]);
  return paged ? (mode === 'history' ? daemon : undefined) : local;
}
