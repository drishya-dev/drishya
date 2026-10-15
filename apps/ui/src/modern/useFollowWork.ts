import { usePresentation } from './presentation';
import { useLayoutEffect, type RefObject } from 'react';

/** Following is a camera policy; reading and capture never wait on its finite movement. */
export function useFollowWork(ref: RefObject<HTMLDivElement | null>, enabled: boolean, revision: unknown) {
  const { preferences } = usePresentation();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    let frame = 0, disposed = false;
    const move = () => {
      cancelAnimationFrame(frame);
      if (disposed) return;
      const from = element.scrollTop, to = Math.max(0, element.scrollHeight - element.clientHeight);
      if (Math.abs(to - from) < 1) return;
      if (!preferences.motion || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || element.closest('[data-modality=keyboard]')) { element.scrollTop = to; return; }
      // Very distant navigation is immediate. Small incoming results maintain orientation.
      if (Math.abs(to - from) > element.clientHeight * 1.5) { element.scrollTop = to; return; }
      const start = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        const t = Math.min(1, (now - start) / 220);
        element.scrollTop = from + (to - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(move);
    element.querySelectorAll('.fr-passage').forEach(passage => observer.observe(passage));
    move();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [ref, enabled, revision, preferences.motion]);
}
