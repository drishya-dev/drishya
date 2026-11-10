import {resolveMotionPolicy, type MotionInputs, type MotionPolicy, type MotionMode} from './motion-policy.ts';

export interface MotionRuntime {
  policy(): MotionPolicy;
  subscribe(listener: (policy: MotionPolicy) => void): () => void;
  invalidate(key: string, render: () => void): void;
  animate(owner: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | null;
  cancel(owner: Element): void;
  dispose(): void;
}

export function createMotionRuntime(): MotionRuntime {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('Motion runtime requires a browser.');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
  const listeners = new Set<(policy: MotionPolicy) => void>();
  const owners = new Set<Element>();
  const renders = new Map<string, () => void>();
  let frame = 0;
  let disposed = false;
  let current = readPolicy();

  function readPolicy(): MotionPolicy {
    const userMode = (() => {
      try {
        const value = sessionStorage.getItem('drishya.landing.motion.v1');
        return value === 'off' || value === 'reduced' ? value : 'auto';
      } catch {
        return 'auto';
      }
    })() as MotionMode;
    return resolveMotionPolicy({
      width: innerWidth,
      height: innerHeight,
      finePointer: finePointer.matches,
      reducedMotion: reduced.matches,
      saveData: connection?.saveData === true,
      lowResource: (navigator as Navigator & {deviceMemory?: number; hardwareConcurrency?: number}).deviceMemory !== undefined && ((navigator as Navigator & {deviceMemory?: number}).deviceMemory ?? 8) <= 2,
      hidden: document.hidden,
      queryOff: new URLSearchParams(location.search).get('motion') === '0',
      userMode,
    });
  }
  function refresh() {
    if (disposed) return;
    const next = readPolicy();
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    listeners.forEach(listener => listener(current));
  }
  function schedule() {
    if (frame || disposed) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const callbacks = [...renders.values()];
      renders.clear();
      callbacks.forEach(render => render());
    });
  }
  const onPreference = () => refresh();
  const onVisibility = () => refresh();
  addEventListener('resize', onPreference, {passive: true});
  addEventListener('pageshow', onPreference);
  addEventListener('pagehide', onVisibility);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onPreference);
  finePointer.addEventListener('change', onPreference);
  return {
    policy: () => current,
    subscribe(listener) { listeners.add(listener); listener(current); return () => listeners.delete(listener); },
    invalidate(key, render) { renders.set(key, render); schedule(); },
    animate(owner, frames, options) {
      if (!current.animate || disposed || !('animate' in owner)) return null;
      owners.add(owner);
      const animation = owner.animate(frames, options);
      animation.finished.finally(() => owners.delete(owner)).catch(() => undefined);
      return animation;
    },
    cancel(owner) { owner.getAnimations().forEach(animation => animation.cancel()); owners.delete(owner); },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      renders.clear();
      owners.forEach(owner => owner.getAnimations().forEach(animation => animation.cancel()));
      owners.clear();
      removeEventListener('resize', onPreference);
      removeEventListener('pageshow', onPreference);
      removeEventListener('pagehide', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onPreference);
      finePointer.removeEventListener('change', onPreference);
      listeners.clear();
    },
  };
}
