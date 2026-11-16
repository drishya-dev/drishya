import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useApp } from '../state.ts';

export type SurfaceKind = 'menu' | 'panel' | 'dialog';
type Origin = { x: number; y: number };
export type SurfaceIntent = { origin?: Origin; pointer: boolean };
const timings = {menu: [180, 140], panel: [220, 160], dialog: [240, 180]};
const motionQuery = '(prefers-reduced-motion: reduce)';
const defaultEase = 'cubic-bezier(.16,1,.3,1)';
let pointerOrigin: { node: HTMLElement; point?: Origin } | undefined;

/** Capture before a click changes layout or moves focus into a native dialog. */
export function captureSurfaceTrigger(event: PointerEvent) {
  const target = event.target instanceof Element ? event.target : undefined;
  const node = target?.closest<HTMLElement>('button, summary, a[href], [role=button], [role=tab], [data-spine-path], article[data-op-id]');
  pointerOrigin = node ? {node, point: {x: event.clientX, y: event.clientY}} : undefined;
}

export function surfaceMotionAllowed() {
  const {motion, lowResource} = useApp.getState();
  const root = document.documentElement;
  return root.dataset.uiVersion === 'modern' && root.hasAttribute('data-ui-press') && motion && !lowResource && !document.hidden && !matchMedia(motionQuery).matches;
}

export function surfaceDuration(kind: SurfaceKind, closing = false) {
  const fallback = timings[kind][closing ? 1 : 0]!;
  const token = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${kind}-${closing ? 'exit' : 'enter'}`).trim();
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(token);
  const value = match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) : fallback;
  return value > 0 && value < 300 ? value : fallback;
}

export function surfaceEasing() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--motion-surface-ease').trim() || style.getPropertyValue('--ease-out').trim() || defaultEase;
}

interface MotionPolicy {
  allowed: () => boolean;
  duration: (kind: SurfaceKind, closing: boolean) => number;
  style: (node: HTMLElement) => Pick<CSSStyleDeclaration, 'opacity' | 'transform'> & Partial<Pick<CSSStyleDeclaration, 'translate' | 'scale'>>;
  easing: () => string;
  origin?: (node: HTMLElement) => Origin | undefined;
}

function triggerOrigin(surface: HTMLElement): Origin | undefined {
  const trigger = pointerOrigin;
  if (!trigger || surface.contains(trigger.node)) return;
  if (trigger.node.isConnected) {
    const rect = trigger.node.getBoundingClientRect();
    if (rect.width && rect.height) return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
  }
  return trigger.point;
}

/** Snapshot an opening intent before a lazy surface or asynchronous read can move it. */
export function captureSurfaceIntent(): SurfaceIntent {
  if (!surfaceMotionAllowed()) return {pointer:false};
  const rect = pointerOrigin?.node.getBoundingClientRect();
  return {
    pointer: true,
    origin: rect?.width && rect.height ? {x:rect.left + rect.width / 2,y:rect.top + rect.height / 2} : pointerOrigin?.point,
  };
}

const policy: MotionPolicy = {allowed: surfaceMotionAllowed, duration: surfaceDuration, style: node => getComputedStyle(node), easing: surfaceEasing, origin: triggerOrigin};

function closedFrame(node: HTMLElement, kind: SurfaceKind, origin: Origin | undefined): Keyframe {
  if (!origin || kind === 'menu') return {opacity: 0, translate: kind === 'menu' ? '0 -2px' : '0 6px', scale: kind === 'menu' ? '.97' : '.98'};
  const rect = node.getBoundingClientRect();
  const limit = (value: number) => Math.round(Math.max(-72, Math.min(72, value * .16)));
  return {opacity: 0, translate: `${limit(origin.x - rect.left - rect.width / 2)}px ${limit(origin.y - rect.top - rect.height / 2)}px`, scale: '.96'};
}

/** Retarget the same DOM surface from its current frame, including a cancelled exit. */
export function surfaceMotion(node: HTMLElement, kind: SurfaceKind = 'panel', rules: MotionPolicy = policy, anchored = kind === 'panel') {
  let animation: Animation | undefined;
  let finishedClose: (() => void) | undefined;
  let closing = false;
  let closed: Keyframe | undefined;
  const original = {inert: node.inert, pointer: node.style.pointerEvents};
  node.dataset.surfaceMotion = '';

  const restore = () => { node.inert = original.inert; node.style.pointerEvents = original.pointer; };
  const cancel = () => {
    const previous = animation;
    animation = undefined;
    finishedClose = undefined;
    closing = false;
    previous?.cancel();
    restore();
    node.dataset.surfacePhase = 'open';
  };

  const run = (exit: boolean, done?: () => void, fresh = false) => {
    if (!rules.allowed()) { cancel(); done?.(); return; }
    const style = rules.style(node);
    const from: Keyframe = {opacity: style.opacity, translate: style.translate ?? 'none', scale: style.scale ?? 'none'};
    if (!closed || fresh) closed = closedFrame(node, kind, anchored ? rules.origin?.(node) : undefined);
    animation?.cancel();
    finishedClose = done;
    closing = exit;
    node.dataset.surfacePhase = exit ? 'closing' : 'opening';
    if (exit) { node.inert = true; node.style.pointerEvents = 'none'; }
    else restore();
    const current = node.animate([fresh ? closed : from, exit ? closed : {opacity: 1, translate: 'none', scale: 'none'}], {
      duration: rules.duration(kind, exit), easing: rules.easing(), fill: 'both',
    });
    animation = current;
    void current.finished.then(() => {
      if (animation !== current || !node.isConnected) return;
      if (exit) { finishedClose = undefined; done?.(); }
      else cancel();
    }, () => {});
  };

  return {
    open: (fresh = false) => run(false, undefined, fresh),
    close: (done: () => void) => { if (!closing || !rules.allowed()) run(true, done); },
    get closing() { return closing; },
    finishImmediately: () => { const done = finishedClose; cancel(); done?.(); },
    cancel,
    dispose: () => { cancel(); delete node.dataset.surfaceMotion; delete node.dataset.surfacePhase; },
  };
}

type SurfaceMotion = ReturnType<typeof surfaceMotion>;

/** Settings and media preferences can change while a surface is moving. */
export function watchSurfaceMotion(disabled: () => void) {
  const media = matchMedia(motionQuery);
  const check = () => { if (!surfaceMotionAllowed()) disabled(); };
  const unsubscribe = useApp.subscribe((current, previous) => {
    if (current.motion !== previous.motion || current.lowResource !== previous.lowResource) check();
  });
  media.addEventListener('change', check);
  document.addEventListener('visibilitychange', check);
  return () => {
    unsubscribe();
    media.removeEventListener('change', check);
    document.removeEventListener('visibilitychange', check);
  };
}

/** Keep the real conditional surface through its exit while its state changes immediately. */
export function useSurfacePresence<T>(value: T | undefined, ref: RefObject<HTMLElement | null>, kind: SurfaceKind, identity?: unknown, intent?: SurfaceIntent): T | undefined {
  const [retained, setRetained] = useState({identity, value});
  if (retained.identity !== identity || value !== undefined && retained.value !== value) setRetained({identity, value});
  const shown = value ?? (retained.identity === identity ? retained.value : undefined);
  const wanted = value !== undefined;
  const controller = useRef<{node: HTMLElement; motion: SurfaceMotion; wanted: boolean}>(undefined);

  useLayoutEffect(() => () => { controller.current?.motion.dispose(); controller.current = undefined; }, [identity]);
  useLayoutEffect(() => {
    const node = ref.current;
    const current = controller.current;
    if (current?.node !== node) {
      current?.motion.dispose();
      const rules = intent ? {...policy, origin: () => intent.origin} : policy;
      controller.current = node ? {node, motion:surfaceMotion(node,kind,rules), wanted} : undefined;
      if (wanted && intent?.pointer !== false) controller.current?.motion.open(true);
      else if (wanted) controller.current?.motion.cancel();
    } else if (current.wanted !== wanted) {
      current.wanted = wanted;
      if (wanted) current.motion.open();
      else current.motion.close(() => setRetained({identity, value: undefined}));
    }
  });
  useLayoutEffect(() => watchSurfaceMotion(() => controller.current?.motion.finishImmediately()), []);
  return shown;
}
