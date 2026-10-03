// UI state. Durable data (projection, graph) is loaded once per recording; what is on screen is
// always compose(projection, cursor) — the store never holds a hand-built scene.

import { create } from 'zustand';
import type { Projection, RecordingSummary, RepoGraph } from '@drishya/contracts';
import { nextMarker, type ComposeInput, type Marker } from '@drishya/scene';
import type { Config, DataSource } from './api.ts';
import { latestOnly } from './lib/sync.ts';

/** One guard for every projection load, so the newest open or reload is the only one that lands. */
const newest = latestOnly();

/** Revisions of each recording as they were when the shown projection was loaded. */
function revisionsOf(recordings: RecordingSummary[]): Record<string, number> {
  return Object.fromEntries(recordings.map((r) => [r.id, r.revision ?? 0]));
}

export type Screen = 'loading' | 'home' | 'viewer' | 'no-daemon' | 'signed-out' | 'error';

interface State {
  source?: DataSource;
  config?: Config;
  screen: Screen;
  error?: string;
  recordings: RecordingSummary[];
  recordingId?: string;
  recording?: RecordingSummary;
  projection?: Projection;
  graph?: RepoGraph;
  /** Revisions the shown projection is at; compared with the daemon's after a reconnect (B1b). */
  renderedRevisions: Record<string, number>;
  /** The daemon's change stream: 'reconnecting' while it is down. */
  connection: 'connected' | 'reconnecting';

  /** Normal reading shows every committed step; replay alone applies a visibility cursor. */
  mode: 'history' | 'replay';
  step: number;
  playing: boolean;
  speed: number;
  /** Deliberate reading/selection holds automatic advancement until resumed. */
  held: boolean;
  /** History follows the newest work; scrolling away turns it off. */
  follow: boolean;
  motion: boolean;
  explore: boolean;
  selectedOp?: string;
  /** Stable captured observation to bring into view without switching normal history to replay. */
  focusObservationId?: string;
  hoveredPath?: string;
  hoveredOp?: string;
  /** A file whose operations are listed (from the spine or the map). */
  filePanel?: string;
  filter?: ComposeInput['filter'];
  inspectorTab: 'detail' | 'evidence' | 'explain';
  briefingOpen: boolean;
  searchOpen: boolean;

  set(p: Partial<State>): void;
  openRecording(id: string, opts?: { at?: number | 'end'; play?: boolean }): Promise<void>;
  reloadProjection(): Promise<void>;
  seek(step: number, opts?: { hold?: boolean }): void;
  stepBy(d: number): void;
  togglePlay(): void;
  jump(type: Marker['type'] | Marker['type'][], dir?: 1 | -1): void;
  select(opId: string | undefined): void;
  resume(): void;
  showHistory(): void;
  setFilter(f: ComposeInput['filter'] | undefined): void;
}

const prefersReducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const storedMotion = (() => {
  try {
    return localStorage.getItem('drishya.motion');
  } catch {
    return null;
  }
})();

export const useApp = create<State>((set, get) => ({
  screen: 'loading',
  recordings: [],
  renderedRevisions: {},
  connection: 'connected',
  mode: 'history',
  step: 0,
  playing: false,
  speed: 1,
  held: false,
  follow: true,
  motion: storedMotion ? storedMotion === '1' : !prefersReducedMotion,
  explore: false,
  inspectorTab: 'detail',
  briefingOpen: false,
  searchOpen: false,

  set: (p) => set(p),

  async openRecording(id, opts = {}) {
    const src = get().source;
    if (!src) return;
    set({ recordingId: id, projection: undefined, graph: undefined, selectedOp: undefined, focusObservationId: undefined, filter: undefined, screen: 'viewer', held: false, follow: true, briefingOpen: false });
    const current = newest('projection');
    // Revisions first, then the projection: what is shown is at least as new as what is recorded.
    const recordings = await src.recordings();
    const projection = await src.projection(id);
    if (!current() || get().recordingId !== id) return; // the user moved on; this response is stale
    const recording = recordings.find((r) => r.id === id.split('+')[0]) ?? recordings[0];
    const mode = opts.at === undefined && !opts.play ? 'history' : 'replay';
    const step = mode === 'history' || opts.at === 'end' ? projection.timeline.length : Math.max(0, Math.min(opts.at ?? 0, projection.timeline.length));
    set({ projection, recording, recordings, renderedRevisions: revisionsOf(recordings), mode, step, playing: mode === 'replay' && !!opts.play && step < projection.timeline.length });
    src.graph(id).then((graph) => get().recordingId === id && set({ graph })).catch(() => undefined);
  },

  async reloadProjection() {
    const { source, recordingId } = get();
    if (!source || !recordingId) return;
    const current = newest('projection');
    const recordings = await source.recordings();
    const projection = await source.projection(recordingId);
    if (!current() || get().recordingId !== recordingId) return; // superseded by a newer load
    const { step, mode } = get();
    set({ projection, recordings, renderedRevisions: revisionsOf(recordings), recording: recordings.find((r) => r.id === recordingId.split('+')[0]) ?? get().recording,
      step: mode === 'history' ? projection.timeline.length : Math.min(step, projection.timeline.length) });
    // History grows regardless of the reader's scroll position; `follow` only controls the viewport.
  },

  seek(step, opts) {
    const p = get().projection;
    if (!p) return;
    const s = Math.max(0, Math.min(p.timeline.length, Math.round(step)));
    set({ mode: 'replay', step: s, ...(opts?.hold ? { playing: false, held: true } : {}) });
  },

  stepBy(d) {
    get().seek(get().step + d, { hold: true });
  },

  togglePlay() {
    const { playing, projection, step, mode } = get();
    if (!projection) return;
    if (mode === 'history') return set({ mode: 'replay', step: 0, playing: true, held: false, follow: true });
    if (playing) set({ playing: false });
    else set({ playing: true, held: false, follow: true, step: step >= projection.timeline.length ? 0 : step });
  },

  jump(type, dir = 1) {
    const { projection, step } = get();
    if (!projection) return;
    const to = nextMarker(projection, step, type, dir);
    if (to !== undefined) get().seek(to, { hold: true });
  },

  select(opId) {
    set({ selectedOp: opId, ...(opId ? { playing: false, held: true, follow: false, inspectorTab: 'detail' } : {}) });
  },

  resume() {
    set({ held: false, playing: true, follow: true, selectedOp: undefined });
  },

  showHistory() {
    const projection = get().projection;
    set({ mode: 'history', step: projection?.timeline.length ?? 0, playing: false, held: false, follow: true, selectedOp: undefined });
  },

  setFilter(f) {
    set({ filter: f });
  },
}));

export function setMotion(on: boolean) {
  useApp.setState({ motion: on });
  try {
    localStorage.setItem('drishya.motion', on ? '1' : '0');
  } catch {
    // preference only
  }
}
