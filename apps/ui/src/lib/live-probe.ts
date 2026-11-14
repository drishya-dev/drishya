// LIVE-7: a developer-only latency probe. It records, in memory on `window.__drishyaLiveProbe`, when
// a change notice reached the page, when the data it describes landed in the store and when the
// frame after it was produced. Off unless `localStorage['drishya.liveProbe'] === '1'`; nothing is
// ever sent anywhere (Drishya has no telemetry) and a benchmark reads the array from the page itself.
import type { Projection } from '@drishya/contracts';

export type LiveProbeMark = {
  kind: 'notice' | 'data' | 'paint' | 'refresh-start' | 'recordings-done' | 'projection-done';
  /** Epoch milliseconds, comparable with a journal's own append times on the same machine. */
  at: number;
  recordingId?: string;
  /** Observations the notice or data covers; the benchmark joins these to journal records. */
  observationCount?: number;
  total?: number;
};

declare global {
  interface Window { __drishyaLiveProbe?: LiveProbeMark[] }
}

const KEY = 'drishya.liveProbe';
const LIMIT = 20_000;
const now = () => performance.timeOrigin + performance.now();

export function liveProbeEnabled(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** A stage of the page's reload (developer probe only): where the time between a notice and the data goes. */
export function probeStage(kind: 'refresh-start' | 'recordings-done' | 'projection-done') {
  if (typeof window === 'undefined' || !window.__drishyaLiveProbe) return;
  push({ kind, at: now() });
}

export function probeNotice(recordingId: string, observationCount: number | undefined) {
  if (typeof window === 'undefined' || !window.__drishyaLiveProbe) return;
  push({ kind: 'notice', at: now(), recordingId, observationCount });
}

function push(mark: LiveProbeMark) {
  const marks = window.__drishyaLiveProbe!;
  if (marks.length < LIMIT) marks.push(mark);
}

type ProbeState = { projection?: Projection; historyPage?: { scene: { total: number } } | undefined; recordingId?: string };

/** Installs the probe when the developer switch is on; otherwise does nothing at all. */
export function installLiveProbe(store: { subscribe(listener: (state: ProbeState) => void): unknown }) {
  if (!liveProbeEnabled() || window.__drishyaLiveProbe) return;
  window.__drishyaLiveProbe = [];
  let last: unknown;
  store.subscribe((state) => {
    const page = state.historyPage;
    const projection = state.projection;
    const data = page ?? projection;
    if (!data || data === last) return;
    last = data;
    const observationCount = projection?.observationCount;
    const total = page?.scene.total ?? projection?.timeline.length;
    const recordingId = state.recordingId;
    push({ kind: 'data', at: now(), recordingId, observationCount, total });
    // The frame after the store changed: the second callback runs once the first frame has been produced.
    requestAnimationFrame(() => requestAnimationFrame(() => push({ kind: 'paint', at: now(), recordingId, observationCount, total })));
  });
}
