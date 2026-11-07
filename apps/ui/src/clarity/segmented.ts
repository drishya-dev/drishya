import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useSkin } from '../lib/ui-version.ts';

/**
 * Clarity's segmented control (FINISH-0a): a track with one pill that slides to the chosen option. The markup stays the existing one
 * (`.seg`, `.workspace-toggles`: a row of buttons, the chosen one `aria-pressed="true"` or `.on`). This hook only measures the chosen
 * button into `--seg-x`, `--seg-w` and `--seg-h` on the track; the pill and its travel are drawn by CSS (`controls.css`). A track whose
 * buttons are not exactly one chosen (none, or several independent toggles) shows no pill and fills each pressed button instead.
 * Under Modern it does nothing.
 */
export function useSegmentedIndicator<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null), clarity = useSkin() === 'clarity';
  const measure = (travel = true) => {
    const track = ref.current;
    if (!track) return;
    const chosen = [...track.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches('[aria-pressed=true], .on'));
    if (chosen.length !== 1) { track.removeAttribute('data-seg'); track.removeAttribute('data-seg-move'); return; }
    const was = track.hasAttribute('data-seg'), button = chosen[0]!;
    track.style.setProperty('--seg-x', `${button.offsetLeft}px`);
    track.style.setProperty('--seg-y', `${button.offsetTop}px`);
    track.style.setProperty('--seg-w', `${button.offsetWidth}px`);
    track.style.setProperty('--seg-h', `${button.offsetHeight}px`);
    track.setAttribute('data-seg', '');
    // The pill travels only between two chosen options; when it first appears it is simply there.
    track.toggleAttribute('data-seg-move', was && travel);
  };
  // Every render may change which option is chosen; the measurement is four reads and four writes.
  useLayoutEffect(() => { if (clarity) measure(); });
  useEffect(() => {
    const track = ref.current;
    if (!clarity || !track) return;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(track); for (const child of track.children) observer.observe(child);
    return () => observer.disconnect();
  }, [clarity]);
  return ref;
}
