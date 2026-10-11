// UI state. Durable data (projection, graph) is loaded once per recording; what is on screen is
// always compose(projection, cursor) — the store never holds a hand-built scene.

import { create } from 'zustand';
import type { Projection, RecordingSummary, RepoGraph } from '@drishya/contracts';
import { nextMarker, type ComposeInput, type Marker } from '@drishya/scene';
import type { Config, DataSource, ReaderRecording } from './api.ts';
import { latestOnly } from './lib/sync.ts';
import { materialCache } from './lib/artifact-cache.ts';
import type { HistoryPage, HistoryQuery } from '../../../packages/scene/src/history.ts';

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
  recordings: ReaderRecording[];
  recordingId?: string;
  recording?: RecordingSummary;
  projection?: Projection;
  historyPage?: HistoryPage;
  graph?: RepoGraph;
  /** Revisions the shown projection is at; compared with the daemon's after a reconnect (B1b). */
  renderedRevisions: Record<string, number>;
  /** The daemon's change stream: 'reconnecting' while it is down. */
  connection: 'connected' | 'reconnecting';

  /** Normal reading shows every committed step; replay alone applies a visibility cursor. */
  mode: 'history' | 'replay';
  replayDiagnostics: boolean;
  step: number;
  playing: boolean;
  speed: number;
  /** Deliberate reading/selection holds automatic advancement until resumed. */
  held: boolean;
  /** History follows the newest work; scrolling away turns it off. */
  follow: boolean;
  motion: boolean;
  hoverReading: boolean;
  reasoningDetail: 'expanded' | 'collapsed' | 'hidden';
  mapDepth: boolean;
  mapOrbit: boolean;
  lowResource: boolean;
  mapVisible: boolean;
  explore: boolean;
  compareAgents: boolean;
  foldersHidden?: boolean;
  currentFile?: string;
  theme: ThemePreference;
  settingsOpen: boolean;
  selectedOp?: string;
  /** One content-shaped reader expanded inside its original passage. */
  expandedOp?: string;
  /** Stable captured observation to bring into view without switching normal history to replay. */
  focusObservationId?: string;
  /** Reading navigation, independent of the capture/replay cursor. */
  promptStep?: number;
  hoveredPath?: string;
  /** Explicit repository navigation, independent of hover and captured identity. */
  mapFocusPath?: string;
  hoveredOp?: string;
  /** The held reader's first visible passage; presentation context, not a capture cursor. */
  readingPassageId?: string;
  /** A file whose operations are listed (from the spine or the map). */
  filePanel?: string;
  filePanelFocus?: 'change';
  filter?: ComposeInput['filter'];
  inspectorTab: 'detail' | 'evidence' | 'explain';
  inspectorWidth: number;
  briefingOpen: boolean;
  searchOpen: boolean;

  set(p: Partial<State>): void;
  openRecording(id: string, opts?: { at?: number | 'end'; play?: boolean }): Promise<void>;
  reloadProjection(): Promise<void>;
  loadHistoryWindow(query: HistoryQuery): Promise<void>;
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
function storedPresentation(key: string): string | null { try { return localStorage.getItem(`drishya.${key}`); } catch { return null; } }
const storedLowResource = (() => { try { return localStorage.getItem('drishya.lowResource') === '1'; } catch { return false; } })();
materialCache.setLowResource(storedLowResource);
const storedMotion = (() => {
  try {
    return localStorage.getItem('drishya.motion');
  } catch {
    return null;
  }
})();
const storedMapVisible = (() => {
  try {
    return localStorage.getItem('drishya.mapVisible');
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
  replayDiagnostics: false,
  step: 0,
  playing: false,
  speed: 1,
  held: false,
  follow: true,
  hoverReading: (() => { try { return localStorage.getItem("drishya.hoverReading") !== "0"; } catch { return true; } })(),
  reasoningDetail: storedPresentation('reasoningDetail') === 'hidden' ? 'hidden' : storedPresentation('reasoningDetail') === 'collapsed' ? 'collapsed' : 'expanded',
  mapDepth: storedPresentation('mapDepth') !== 'false',
  mapOrbit: storedPresentation('mapOrbit') !== 'false',
  lowResource: storedLowResource,
  motion: !storedLowResource && (storedMotion ? storedMotion === '1' : !prefersReducedMotion),
  mapVisible: !storedLowResource && storedMapVisible !== '0',
  explore: false,
  compareAgents: false,
  theme: storedTheme(),
  settingsOpen: false,
  inspectorTab: 'detail',
  inspectorWidth: 760,
  briefingOpen: false,
  searchOpen: false,

  set: (p) => set(p),

  async openRecording(id, opts = {}) {
    const src = get().source;
    if (!src) return;
    set({ error: undefined, replayDiagnostics: opts.at !== undefined || !!opts.play, promptStep: undefined, recordingId: id, projection: undefined, historyPage: undefined, graph: undefined, mapFocusPath: undefined, selectedOp: undefined, expandedOp: undefined, focusObservationId: undefined, readingPassageId: undefined, filter: undefined, screen: 'viewer', held: false, follow: true, briefingOpen: false, searchOpen: false, filePanel: undefined, filePanelFocus: undefined, explore: false, compareAgents: false });
    const current = newest('projection');
    // Revisions first, then the projection: what is shown is at least as new as what is recorded.
    try {
      const recordings = await src.recordings();
      const count = recordings.filter((r) => id.split('+').includes(r.id)).reduce((n, r) => n + r.observationCount, 0);
      const bytes = recordings.filter((r) => id.split('+').includes(r.id)).reduce((n, r) => n + (r.sourceBytes ?? 0), 0);
      const page = (count > 10_000 || bytes > 32 * 1024 * 1024) && src.history ? await src.history(id, { step: typeof opts.at === 'number' ? opts.at : opts.play ? 0 : undefined }) : undefined;
      const projection = page?.projection ?? await src.projection(id);
      if (!current() || get().recordingId !== id) return; // the user moved on; this response is stale
      const recording = recordings.find((r) => r.id === id) ?? recordings.find((r) => r.id === id.split('+')[0]) ?? recordings[0];
      const mode = opts.at === undefined && !opts.play ? 'history' : 'replay';
      const total = page?.scene.total ?? projection.timeline.length;
      const step = mode === 'history' || opts.at === 'end' ? total : Math.max(0, Math.min(opts.at ?? 0, total));
      set({ error: undefined, projection, historyPage: page, recording, recordings, renderedRevisions: page?.revisions ?? revisionsOf(recordings), mode, step, playing: mode === 'replay' && !!opts.play && step < total });
    } catch (error) {
      if (current() && get().recordingId === id) set({ error: (error as Error).message, playing: false });
    }
  },

  async reloadProjection() {
    const { source, recordingId } = get();
    if (!source || !recordingId) return;
    const current = newest('projection');
    const recordings = await source.recordings();
    if (!current() || get().recordingId !== recordingId) return;
    const count = recordings.filter((r) => recordingId.split('+').includes(r.id)).reduce((n, r) => n + r.observationCount, 0);
    const bytes = recordings.filter((r) => recordingId.split('+').includes(r.id)).reduce((n, r) => n + (r.sourceBytes ?? 0), 0);
    if (source.history && (get().historyPage || count > 10_000 || bytes > 32 * 1024 * 1024)) {
      set({ recordings, recording: recordings.find((r) => r.id === recordingId) ?? recordings.find((r) => r.id === recordingId.split('+')[0]) ?? get().recording });
      await get().loadHistoryWindow({ start: get().follow ? undefined : get().historyPage?.start });
      return;
    }
    const projection = await source.projection(recordingId);
    if (!current() || get().recordingId !== recordingId) return; // superseded by a newer load
    const { step, mode } = get();
      set({ error: undefined, projection, recordings, renderedRevisions: revisionsOf(recordings), recording: recordings.find((r) => r.id === recordingId) ?? recordings.find((r) => r.id === recordingId.split('+')[0]) ?? get().recording,
      step: mode === 'history' ? projection.timeline.length : Math.min(step, projection.timeline.length) });
    // History grows regardless of the reader's scroll position; `follow` only controls the viewport.
  },

  async loadHistoryWindow(query) {
    const { source, recordingId, mode, step, filter, selectedOp } = get();
    if (!source?.history || !recordingId) return;
    const current = newest('projection');
    const page = await source.history(recordingId, { step: mode === 'replay' ? step : undefined, filter, selectedOperationId: selectedOp, ...query });
    if (!current() || get().recordingId !== recordingId) return;
      set({ error: undefined, historyPage: page, projection: page.projection, renderedRevisions: page.revisions,
      step: mode === 'history' ? page.scene.total : page.scene.step });
  },

  seek(step, opts) {
    const p = get().projection;
    if (!p) return;
    const s = Math.max(0, Math.min(get().historyPage?.scene.total ?? p.timeline.length, Math.round(step)));
    set({ mode: 'replay', step: s, ...(opts?.hold ? { playing: false, held: true } : {}) });
    if (get().historyPage) void get().loadHistoryWindow({ step: s, ...(!get().follow && get().readingPassageId ? { pinnedPassageIds: [get().readingPassageId!] } : {}) }).catch((error) => set({ error: error.message }));
  },

  stepBy(d) {
    get().seek(get().step + d, { hold: true });
  },

  togglePlay() {
    const { playing, projection, step, mode, historyPage } = get();
    if (!projection) return;
    const total = historyPage?.scene.total ?? projection.timeline.length;
    if (mode === 'history') { set({ playing: true, held: false, follow: true }); get().seek(0); return; }
    if (playing) set({ playing: false });
    else { set({ playing: true, held: false, follow: true }); get().seek(step >= total ? 0 : step); }
  },

  jump(type, dir = 1) {
    const { projection, step, historyPage, source, recordingId } = get();
    if (!projection) return;
    if (historyPage && source?.historyMarker && recordingId) {
      void source.historyMarker(recordingId, step, Array.isArray(type) ? type : [type], dir).then((to) => { if (to !== undefined && get().recordingId === recordingId && get().step === step) get().seek(to, { hold: true }); }).catch((error) => { if (get().recordingId === recordingId) set({ error: error.message, playing: false }); });
      return;
    }
    const to = nextMarker(projection, step, type, dir);
    if (to !== undefined) get().seek(to, { hold: true });
  },

  select(opId) {
    const clockRunning = get().mode === 'replay' && get().playing;
    set({ selectedOp: opId, promptStep: undefined, ...(opId ? { expandedOp: undefined, ...(!clockRunning ? { playing: false, held: true } : {}), inspectorTab: 'detail' } : {}) });
    if (opId && get().historyPage && !get().projection?.operations.some((op) => op.id === opId)) void get().loadHistoryWindow({ selectedOperationId: opId }).catch((error) => set({ error: error.message }));
  },

  resume() {
    set({ held: false, playing: true, follow: true, selectedOp: undefined });
  },

  showHistory() {
    const projection = get().projection;
    set({ promptStep: undefined, mode: 'history', step: get().historyPage?.scene.total ?? projection?.timeline.length ?? 0, playing: false, held: false, follow: true, selectedOp: undefined, expandedOp: undefined });
    if (get().historyPage) void get().loadHistoryWindow({}).catch((error) => set({ error: error.message }));
  },

  setFilter(f) {
    set({ filter: f });
    if (get().historyPage) void get().loadHistoryWindow({ start: get().historyPage?.start }).catch((error) => set({ error: error.message }));
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

export function setLowResource(on: boolean) {
  materialCache.setLowResource(on);
  useApp.setState({ lowResource: on, ...(on ? { motion: false, mapVisible: false, explore: false, graph: undefined } : {}) });
  try { localStorage.setItem('drishya.lowResource', on ? '1' : '0'); } catch { /* Optional local preference. */ }
}

export function setMapVisible(on: boolean) {
  useApp.setState({ mapVisible: on, ...(on ? {} : { explore: false, graph: undefined }) });
  try {
    localStorage.setItem('drishya.mapVisible', on ? '1' : '0');
  } catch {
    // The preference is optional when storage is unavailable.
  }
}

/** Jet (stored as 'dark') is the signature default: matte black and champagne gold. Midnight is the cooler option. */
export type ThemePreference = 'midnight' | 'dark' | 'light';

function storedTheme(): ThemePreference {
  try {
    const value = localStorage.getItem('drishya.theme');
    return value === 'midnight' || value === 'light' ? value : 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme: ThemePreference) {
  useApp.setState({ theme });
  try { localStorage.setItem('drishya.theme', theme); } catch { /* Optional local preference. */ }
}

export function setHoverReading(on: boolean) {
  useApp.setState({ hoverReading: on });
  try { localStorage.setItem('drishya.hoverReading', on ? '1' : '0'); } catch { /* Optional local preference. */ }
}
export function setPresentationPreferences(patch: Partial<Pick<State, 'mapDepth' | 'mapOrbit' | 'reasoningDetail'>>) {
  useApp.setState(patch);
  try { for (const [key, value] of Object.entries(patch)) localStorage.setItem(`drishya.${key}`, String(value)); } catch { /* Optional local preference. */ }
}
