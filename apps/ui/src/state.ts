// UI state. Durable data (projection, graph) is loaded once per recording; what is on screen is
// always compose(projection, cursor) — the store never holds a hand-built scene.

import { create } from 'zustand';
import type { Projection, RecordingSummary, RepoGraph } from '@drishya/contracts';
import { nextMarker, type ComposeInput, type Marker } from '@drishya/scene';
import type { Config, DataSource } from './api.ts';

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
    set({ recordingId: id, projection: undefined, graph: undefined, selectedOp: undefined, filter: undefined, screen: 'viewer', held: false, follow: true, briefingOpen: false });
    const [projection, recordings] = await Promise.all([src.projection(id), src.recordings()]);
    const recording = recordings.find((r) => r.id === id.split('+')[0]) ?? recordings[0];
    const step = opts.at === 'end' ? projection.timeline.length : Math.min(opts.at ?? 0, projection.timeline.length);
    set({ projection, recording, recordings, step, playing: !!opts.play && step < projection.timeline.length });
    src.graph(id).then((graph) => get().recordingId === id && set({ graph })).catch(() => undefined);
  },

  async reloadProjection() {
    const { source, recordingId, step, projection: old } = get();
    if (!source || !recordingId) return;
    const projection = await source.projection(recordingId);
    const wasAtEnd = !old || step >= old.timeline.length;
    const recordings = await source.recordings();
    set({ projection, recordings, recording: recordings.find((r) => r.id === recordingId.split('+')[0]) ?? get().recording });
    // Following live work: keep playing into the new steps rather than jumping to the end.
    if (wasAtEnd && get().follow && !get().held) set({ playing: true });
  },

  seek(step, opts) {
    const p = get().projection;
    if (!p) return;
    const s = Math.max(0, Math.min(p.timeline.length, Math.round(step)));
    set({ step: s, ...(opts?.hold ? { playing: false, held: true } : {}) });
  },

  stepBy(d) {
    get().seek(get().step + d, { hold: true });
  },

  togglePlay() {
    const { playing, projection, step } = get();
    if (!projection) return;
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
    set({ selectedOp: opId, ...(opId ? { playing: false, held: true, inspectorTab: 'detail' } : {}) });
  },

  resume() {
    set({ held: false, playing: true, follow: true, selectedOp: undefined });
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
