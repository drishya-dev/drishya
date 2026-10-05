// P2-A "Since your last visit": what happened after the reader's own mark, as captured facts
// with direct links. The mark moves only when the reader says so; opening a recording does not.

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { Projection } from '@drishya/contracts';
import { type SinceItem } from '@drishya/scene';
import type { SinceSnapshot } from '../../../../packages/scene/src/since.ts';
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
      if (get().recordingId === recordingId) set({ error: (e as Error).message });
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

function useSinceDigest(projection: Projection, boundary: ReadingBoundary | null | undefined) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const revisions = useApp((s) => s.renderedRevisions);
  const key = `${recordingId}:${revisions[recordingId ?? ''] ?? 0}:${projection.lastSequence}:${boundary?.sequence ?? -1}`;
  const [state, setState] = useState<{ key: string; digest?: SinceSnapshot; error?: string }>();
  useEffect(() => {
    if (!source?.since || !recordingId || recordingId.includes('+') || boundary === undefined) return;
    let active = true;
    source.since(recordingId, boundary?.sequence ?? -1).then((digest) => { if (active) setState({ key, digest }); }).catch((e) => { if (active) setState({ key, error: (e as Error).message }); });
    return () => { active = false; };
  }, [source, recordingId, key, boundary === undefined]);
  return state?.key === key ? state : undefined;
}

/** A quiet button in the crown when something happened after the mark. */
export function SinceMarkPill({ projection }: { projection: Projection }) {
  const { supported } = useRecordingMark();
  const boundary = useMark((s) => s.boundary);
  const set = useApp((s) => s.set);
  const snapshot = useSinceDigest(projection, boundary);
  const n = boundary ? snapshot?.digest?.newSteps ?? 0 : 0;
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
  const select = useApp((s) => s.select);
  const set = useApp((s) => s.set);
  const [busy, setBusy] = useState(false);
  const snapshot = useSinceDigest(projection, boundary);
  const digest = snapshot?.digest;
  if (!supported) return null;
  if (boundary === undefined) return <div className="since"><div className="skeleton" /></div>;
  if (!digest) return <div className="since" role="status">{snapshot?.error ?? 'Loading recording facts…'}</div>;

  const markAt = async (sequence: number) => {
    setBusy(true);
    await mark(source!, recordingId!, sequence);
    setBusy(false);
  };
  const open = (it: SinceItem) => {
    if (!it.operationId) return;
    // Global selection loads the operation's page; the digest may refer to unloaded work.
    select(it.operationId);
    set({ briefingOpen: false });
  };
  const any = GROUPS.some((g) => digest[g.key].length > 0);

  return (
    <section className="since" aria-label="Since your mark">
      <h4>{boundary ? 'Since your mark' : 'Not marked yet'}</h4>
      <p className="muted small">
        {boundary
          ? `${digest.newSteps} step${digest.newSteps === 1 ? '' : 's'} after the point you marked as seen${digest.editedFileCount ? ` · ${digest.editedFileCount} file${digest.editedFileCount === 1 ? '' : 's'} changed` : ''}. Facts counted from the recording; opening it never moves your mark.`
          : 'Mark what you have seen, and next time this lists only what happened after it.'}
      </p>
      {boundary && !any && <p className="muted small">Nothing new since your mark.</p>}
      {boundary &&
        GROUPS.filter((g) => digest[g.key].length).map((g) => (
          <div key={g.key} className={`since-group since-${g.key}`}>
            <div className="since-label">{g.label} · {digest.counts[g.key]}</div>
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
              {digest.counts[g.key] > 20 && <li className="muted small">…and {digest.counts[g.key] - 20} more in the history</li>}
            </ul>
          </div>
        ))}
      <div className="since-actions">
        <button className="btn" disabled={busy || (boundary?.sequence ?? -1) >= digest.through} onClick={() => markAt(digest.through)}>
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
