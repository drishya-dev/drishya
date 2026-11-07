/**
 * Clarity's segmented control (FINISH-0a): a track with one pill that slides to the chosen option. The markup stays the existing one
 * (`.seg`, `.workspace-toggles`: a row of buttons, the chosen one `aria-pressed="true"` or `.on`). This only measures the chosen button
 * into `--seg-x/-y/-w/-h` on the track; the pill and its travel are drawn by CSS (`controls.css`). A track whose buttons are not exactly
 * one chosen (none, or several independent toggles) shows no pill and fills each pressed button instead.
 *
 * It is installed once by Clarity's entry, so no Modern component or bundle changes (a hook inside `Workspace.tsx` and `Viewer.tsx`
 * moved Modern's history by 8 px in some long guard sequences, which this avoids).
 */
const TRACKS = '.seg, .workspace-toggles';
const chosenOf = (button: Element) => button.matches('[aria-pressed=true], .on');

function measure(track: HTMLElement, travel = true) {
  const chosen = [...track.children].filter((child): child is HTMLElement => child instanceof HTMLElement && chosenOf(child));
  if (chosen.length !== 1) { track.removeAttribute('data-seg'); track.removeAttribute('data-seg-move'); return; }
  const was = track.hasAttribute('data-seg'), button = chosen[0]!;
  track.style.setProperty('--seg-x', `${button.offsetLeft}px`);
  track.style.setProperty('--seg-y', `${button.offsetTop}px`);
  track.style.setProperty('--seg-w', `${button.offsetWidth}px`);
  track.style.setProperty('--seg-h', `${button.offsetHeight}px`);
  track.setAttribute('data-seg', '');
  // The pill travels only between two chosen options; when it first appears it is simply there.
  track.toggleAttribute('data-seg-move', was && travel);
}

export function installSegmentedIndicators(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const watched = new WeakSet<Element>();
  const resize = new ResizeObserver(entries => { for (const entry of entries) { const track = entry.target.closest<HTMLElement>(TRACKS) ?? (entry.target as HTMLElement); if (track.matches(TRACKS)) measure(track, false); } });
  const scan = (root: ParentNode = document) => {
    for (const track of root.querySelectorAll<HTMLElement>(TRACKS)) {
      measure(track);
      if (!watched.has(track)) { watched.add(track); resize.observe(track); for (const child of track.children) resize.observe(child); }
    }
  };
  // New tracks are found once per frame, however many nodes the history adds.
  let pending = false;
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; scan(); }); } };
  const observer = new MutationObserver(mutations => {
    const tracks = new Set<HTMLElement>(); let added = false;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        // Only a track's own buttons change which option is chosen.
        const parent = (mutation.target as Element).parentElement;
        if (parent?.matches(TRACKS)) tracks.add(parent);
      } else if (mutation.addedNodes.length) added = true;
    }
    for (const track of tracks) measure(track);
    if (added) schedule();
  });
  scan();
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'class'] });
  return () => { observer.disconnect(); resize.disconnect(); };
}
