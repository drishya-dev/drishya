import { useApp } from '../state.ts';
/** Finite, interruptible motion of one real DOM surface. Layout keeps its final geometry. */
const active = new WeakMap<HTMLElement, Animation>();
export function materialRect(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
  return new DOMRect(rect.left - matrix.m41, rect.top - matrix.m42,
    rect.width / Math.max(.001, matrix.m11), rect.height / Math.max(.001, matrix.m22));
}

export function moveMaterial(element: HTMLElement, from: DOMRect, duration: number, name: string): Animation {
  active.get(element)?.cancel();
  let destination = materialRect(element);
  const frames = (source: DOMRect, target: DOMRect): Keyframe[] => [
    { transform: `translate(${source.left - target.left}px,${source.top - target.top}px) scale(${source.width / Math.max(1, target.width)},${source.height / Math.max(1, target.height)})`, clipPath: 'none' },
    { transform: 'translate(0px,0px) scale(1,1)', clipPath: 'none' },
  ];
  const animation = element.animate(frames(from, destination), { duration, easing: 'cubic-bezier(.22,.65,.18,1)', fill: 'both' });
  animation.id = name; active.set(element, animation);
  const deadline = performance.now() + duration;
  let previous = from;
  const history = element.closest<HTMLElement>('.history');
  let scroll = history?.scrollTop ?? 0;
  let frame: number;
  const tick = () => {
    if (!element.isConnected || animation.playState !== 'running') return;
    const next = materialRect(element);
    const scrollNow = history?.scrollTop ?? 0;
    const scrollDelta = scroll - scrollNow;
    const moved = Math.abs(next.left - destination.left) > .5 || Math.abs(next.top - destination.top - scrollDelta) > .5 || Math.abs(next.width - destination.width) > .5 || Math.abs(next.height - destination.height) > .5;
    if (moved && deadline - performance.now() > 40) {
      // Continue from the last visible rectangle, never restart at the origin or snap
      // into the resized final box. Native scrolling remains immediate.
      const source = new DOMRect(previous.left, previous.top + scrollDelta, previous.width, previous.height);
      const effect = animation.effect as KeyframeEffect;
      effect.setKeyframes(frames(source, next));
      effect.updateTiming({ duration: Math.max(40, deadline - performance.now()) });
      animation.currentTime = 0;
    }
    destination = next; scroll = scrollNow;
    previous = element.getBoundingClientRect();
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  const release = () => { cancelAnimationFrame(frame); if (active.get(element) === animation) active.delete(element); animation.cancel(); };
  void animation.finished.then(release, release);
  return animation;
}

export function materialIsMoving(element: HTMLElement): boolean { return active.get(element)?.playState === 'running'; }

/** Resting geometry for a glyph or excerpt inside a travelling surface. */
export function restingRect(element: Element): DOMRect {
  const parent = element.closest<HTMLElement>('.op');
  if (!parent) return element.getBoundingClientRect();
  if (parent === element) return materialRect(parent);
  const rect = element.getBoundingClientRect(), visual = parent.getBoundingClientRect(), natural = materialRect(parent);
  const sx = visual.width / Math.max(1, natural.width), sy = visual.height / Math.max(1, natural.height);
  return new DOMRect(natural.left + (rect.left - visual.left) / Math.max(.001, sx), natural.top + (rect.top - visual.top) / Math.max(.001, sy), rect.width / Math.max(.001, sx), rect.height / Math.max(.001, sy));
}

/** Reserve an arriving request's allocation, then resize after it has visibly settled.
 * Captured result DOM remains mounted inside the scrollable material throughout. */
export function settleArrival(element: HTMLElement, start: DOMRect, flight: Animation): void {
  const properties = ['width', 'height', 'flex-basis'];
  const saved = properties.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
  element.style.setProperty('width', `${start.width}px`);
  element.style.setProperty('height', `${start.height}px`);
  element.style.setProperty('flex-basis', `${start.width}px`);
  element.dataset.materialSettling = 'true';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let growth: Animation | undefined;
  let interrupted = false;
  let unsubscribe = () => {};
  const restore = () => {
    for (const [name, value, priority] of saved) { if (value) element.style.setProperty(name!, value, priority); else element.style.removeProperty(name!); }
    delete element.dataset.materialSettling;
  };
  const interrupt = () => { interrupted = true; clearTimeout(timer); growth?.cancel(); restore(); cleanup(); };
  const cleanup = () => { history?.removeEventListener('wheel', interrupt); history?.removeEventListener('pointerdown', interrupt); window.removeEventListener('keydown', interrupt); unsubscribe(); };
  const history = element.closest('.history');
  history?.addEventListener('wheel', interrupt, { passive: true }); history?.addEventListener('pointerdown', interrupt); window.addEventListener('keydown', interrupt);
  unsubscribe = useApp.subscribe(state => { if (!state.motion || state.lowResource || !state.follow || state.explore) interrupt(); });
  void flight.finished.then(() => {
    if (interrupted) return;
    timer = setTimeout(() => {
      if (!element.isConnected) { interrupt(); return; }
      const from = element.getBoundingClientRect(); restore();
      const to = materialRect(element);
      if (Math.abs(from.width - to.width) < 1 && Math.abs(from.height - to.height) < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches || !useApp.getState().motion || useApp.getState().lowResource) { cleanup(); return; }
      const frame = (r: DOMRect) => ({ width: `${r.width}px`, height: `${r.height}px`, flexBasis: `${r.width}px` });
      element.dataset.materialSettling = 'true';
      growth = element.animate([frame(from), frame(to)], { duration: 780, easing: 'cubic-bezier(.22,.65,.18,1)' });
      growth.id = 'surface-Settle'; active.set(element, growth);
      window.dispatchEvent(new Event('drishya-material-layout'));
      const finish = () => { delete element.dataset.materialSettling; if (active.get(element) === growth) active.delete(element); cleanup(); };
      void growth.finished.then(finish, finish);
    }, 280);
  }, interrupt);
}
