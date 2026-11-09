import type {Chapter} from './sample-model.ts';
import type {MotionRuntime} from './motion-runtime.ts';

export type SampleOwner = 'scroll' | 'manual' | 'playback';

export interface SampleSnapshot {
  index: 0 | 1 | 2 | 3;
  owner: SampleOwner;
  playing: boolean;
  repeat: boolean;
}

export interface SampleClock {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export interface SampleController {
  snapshot(): SampleSnapshot;
  subscribe(listener: (snapshot: SampleSnapshot) => void): () => void;
  select(index: number, origin: 'pointer' | 'keyboard' | 'range' | 'scroll' | 'restore'): void;
  play(): void;
  pause(): void;
  replay(): void;
  setRepeat(value: boolean): void;
  setVisible(value: boolean): void;
  followScroll(): void;
  restore(index: number, owner: SampleSnapshot['owner']): void;
  dispose(): void;
}

const DWELL_MS = [1600, 2200, 2600, 1800] as const;
const REPEAT_HOLD_MS = 1200;

const systemClock: SampleClock = {
  set: (cb, delayMs) => setTimeout(cb, delayMs),
  clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export function createSampleController(
  chapters: readonly Chapter[],
  runtime?: MotionRuntime,
  clock: SampleClock = systemClock
): SampleController {
  let index: 0 | 1 | 2 | 3 = 0;
  let owner: SampleOwner = 'manual';
  let playing = false;
  let repeat = false;
  let visible = true;
  let activeTimer: unknown = null;
  const listeners = new Set<(snapshot: SampleSnapshot) => void>();

  function snapshot(): SampleSnapshot {
    return {index, owner, playing, repeat};
  }

  function notify(): void {
    const s = snapshot();
    for (const listener of listeners) {
      listener(s);
    }
  }

  function clearTimer(): void {
    if (activeTimer !== null) {
      clock.clear(activeTimer);
      activeTimer = null;
    }
  }

  function scheduleNext(): void {
    clearTimer();
    if (!playing || !visible) {
      playing = false;
      notify();
      return;
    }

    if (index < 3) {
      activeTimer = clock.set(() => {
        if (!playing || !visible) return;
        index = (index + 1) as 0 | 1 | 2 | 3;
        notify();
        scheduleNext();
      }, DWELL_MS[index]);
    } else {
      // index === 3: dwell 1800 ms
      activeTimer = clock.set(() => {
        if (!playing || !visible) return;
        if (repeat) {
          // hold for REPEAT_HOLD_MS
          activeTimer = clock.set(() => {
            if (!playing || !visible || !repeat) {
              playing = false;
              notify();
              return;
            }
            index = 0;
            notify();
            scheduleNext();
          }, REPEAT_HOLD_MS);
        } else {
          playing = false;
          notify();
        }
      }, DWELL_MS[3]);
    }
  }

  function play(): void {
    if (playing) return;
    if (index === 3) {
      index = 0;
    }
    playing = true;
    owner = 'playback';
    notify();
    scheduleNext();
  }

  function pause(): void {
    clearTimer();
    if (playing) {
      playing = false;
      notify();
    }
  }

  function replay(): void {
    clearTimer();
    index = 0;
    playing = true;
    owner = 'playback';
    notify();
    scheduleNext();
  }

  function select(newIndex: number, origin: 'pointer' | 'keyboard' | 'range' | 'scroll' | 'restore'): void {
    clearTimer();
    playing = false;
    if (origin === 'scroll') {
      owner = 'scroll';
    } else if (origin !== 'restore') {
      owner = 'manual';
    }
    const clamped = Math.max(0, Math.min(3, Math.trunc(newIndex))) as 0 | 1 | 2 | 3;
    index = clamped;
    notify();
  }

  function setRepeat(value: boolean): void {
    repeat = Boolean(value);
    notify();
  }

  function setVisible(value: boolean): void {
    visible = Boolean(value);
    if (!visible && playing) {
      pause();
    }
  }

  function followScroll(): void {
    clearTimer();
    playing = false;
    owner = 'scroll';
    notify();
  }

  function restore(newIndex: number, newOwner: SampleSnapshot['owner']): void {
    clearTimer();
    playing = false;
    index = Math.max(0, Math.min(3, Math.trunc(newIndex))) as 0 | 1 | 2 | 3;
    owner = newOwner;
    notify();
  }

  const unsubscribeRuntime = runtime?.subscribe((policy) => {
    if (policy.static || !policy.animate) {
      pause();
    }
  });

  function dispose(): void {
    clearTimer();
    playing = false;
    listeners.clear();
    unsubscribeRuntime?.();
  }

  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select,
    play,
    pause,
    replay,
    setRepeat,
    setVisible,
    followScroll,
    restore,
    dispose,
  };
}
