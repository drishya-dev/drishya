import {useEffect, useRef, type RefObject} from 'react';
import {useSurfacePresence} from './surface-motion.ts';

/**
 * MOTION-4b: content that a control mounts and unmounts inside the page flow (an expanded note, a summary, a
 * pinned source) gets the shared paired motion without a wrapper element. Render the element only while
 * `shown` is true and put `ref` on it: it fades in on a pointer click and stays mounted through its fade out,
 * a second click reverses from the current frame, and keyboard, reduced motion and low resource are immediate.
 * Content that is already open when its owner mounts (a remount, a restored choice) never animates.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(open: boolean): {ref: RefObject<T | null>; shown: boolean} {
  const ref = useRef<T>(null);
  const settled = useRef(false);
  useEffect(() => { settled.current = true; }, []);
  const shown = useSurfacePresence(open ? true : undefined, ref, 'inline', undefined, settled.current ? undefined : {pointer: false});
  return {ref, shown: shown === true};
}
