// P2-A "Since your last visit": what happened after the reader's own mark, as captured facts
// with direct links. The mark moves only when the reader says so; opening a recording does not.

import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import type { Projection } from '@drishya/contracts';
import { sinceBoundary, stepOfOperation, type SinceItem } from '@drishya/scene';
import type { DataSource, ReadingBoundary } from '../api.ts';
import { useApp } from '../state.ts';

interface MarkState {
  recordingId?: string;
  /** undefined while loading, null when this recording was never marked. */
  boundary?: ReadingBoundary | null;
  error?: string;
  load(source: DataSource, recordingId: string): Promise<void>;
  mark(source: DataSource, recordingId: string, sequence: number): Promise<void>;
}

export const useMark = create<MarkState>((set, get) => ({
  async load(source, recordingId) {
    set({ recordingId, boundary: undefined, error: undefined });
    try {
      const boundary = await source.boundary(recordingId);
      if (get().recordingId === recordingId) set({ boundary });
    } catch (e) {
      if (get().recordingId === recordingId) set({ boundary: null, error: (e as Error).message });
    }
  },
  async mark(source, recordingId, sequence) {
    try {
      const boundary = await source.setBoundary(recordingId, sequence);
      if (get().recordingId === recordingId) set({ boundary, error: undefined });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));

/** Loads the mark for the open single recording on the local daemon. Combined views have none. */
export function useRecordingMark() {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const supported = source?.kind === 'daemon' && !!recordingId && !recordingId.includes('+');
  const load = useMark((s) => s.load);
  useEffect(() => {
    if (supported) void load(source!, recordingId!);
  }, [supported, source, recordingId, load]);
  return { supported, source, recordingId };
}

/** A quiet button in the crown when something happened after the mark. */
export function SinceMarkPill({ projection }: { projection: Projection }) {
  const { supported } = useRecordingMark();
  const boundary = useMark((s) => s.boundary);
  const set = useApp((s) => s.set);
  const n = useMemo(() => (boundary ? sinceBoundary(projection, boundary.sequence).newSteps : 0), [projection, boundary]);
  if (!supported || !boundary || n === 0) return null;
  return (
    <button className="btn ghost since-pill" onClick={() => set({ briefingOpen: true })} title="What happened after the point you marked as seen">
      {n} new since your mark
    </button>
  );
}

const GROUPS: { key: 'failures' | 'edits' | 'tests' | 'unfinished' | 'gaps'; label: string }[] = [
  { key: 'failures', label: 'Failed' },
  { key: 'edits', label: 'Changed' },
  { key: 'tests', label: 'Test runs' },
  { key: 'unfinished', label: 'Still running' },
  { key: 'gaps', label: 'Missing from the record' },
];

/** The digest at the top of the Briefing sheet. */
export function SinceMarkSection({ projection }: { projection: Projection }) {
  const { supported, source, recordingId } = useRecordingMark();
  const boundary = useMark((s) => s.boundary);
  const error = useMark((s) => s.error);
  const mark = useMark((s) => s.mark);
  const seek = useApp((s) => s.seek);
  const select = useApp((s) => s.select);
  const set = useApp((s) => s.set);
  const [busy, setBusy] = useState(false);
  const digest = useMemo(() => sinceBoundary(projection, boundary?.sequence ?? -1), [projection, boundary]);
  if (!supported) return null;
  if (boundary === undefined) return <div className="since"><div className="skeleton" /></div>;

  const markAt = async (sequence: number) => {
    setBusy(true);
    await mark(source!, recordingId!, sequence);
    setBusy(false);
  };
  const open = (it: SinceItem) => {
    if (!it.operationId) return;
    const s = stepOfOperation(projection, it.operationId);
    if (useApp.getState().mode === 'replay' && s !== undefined) seek(s, { hold: true });
    select(it.operationId);
    set({ briefingOpen: false });
  };
  const any = GROUPS.some((g) => digest[g.key].length > 0);

  return (
    <section className="since" aria-label="Since your mark">
      <h4>{boundary ? 'Since your mark' : 'Not marked yet'}</h4>
      <p className="muted small">
        {boundary
          ? `${digest.newSteps} step${digest.newSteps === 1 ? '' : 's'} after the point you marked as seen${digest.editedFiles.length ? ` · ${digest.editedFiles.length} file${digest.editedFiles.length === 1 ? '' : 's'} changed` : ''}. Facts counted from the recording; opening it never moves your mark.`
          : 'Mark what you have seen, and next time this lists only what happened after it.'}
      </p>
      {boundary && !any && <p className="muted small">Nothing new since your mark.</p>}
      {boundary &&
        GROUPS.filter((g) => digest[g.key].length).map((g) => (
          <div key={g.key} className={`since-group since-${g.key}`}>
            <div className="since-label">{g.label} · {digest[g.key].length}</div>
            <ul>
              {digest[g.key].slice(0, 20).map((it) => (
                <li key={`${g.key}-${it.operationId ?? it.sequence}`}>
                  {it.operationId ? (
                    <button className="link since-open" onClick={() => open(it)}>{it.title}</button>
                  ) : (
                    <span>{it.title}</span>
                  )}
                  {it.detail && <span className="muted small"> · {it.detail}</span>}
                  <button className="btn ghost small since-through" disabled={busy} title="Mark everything up to this point as seen" onClick={() => markAt(it.sequence)}>
                    Mark through here
                  </button>
                </li>
              ))}
              {digest[g.key].length > 20 && <li className="muted small">…and {digest[g.key].length - 20} more in the history</li>}
            </ul>
          </div>
        ))}
      <div className="since-actions">
        <button className="btn" disabled={busy || (boundary?.sequence ?? -1) >= projection.lastSequence} onClick={() => markAt(projection.lastSequence)}>
          Mark all as seen
        </button>
        {boundary?.previousSequence !== undefined && (
          <button className="btn ghost" disabled={busy} onClick={() => markAt(boundary.previousSequence!)}>Undo last mark</button>
        )}
      </div>
      {error && <p className="bad small">{error}</p>}
    </section>
  );
}
