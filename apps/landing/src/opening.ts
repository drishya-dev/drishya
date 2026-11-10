export interface IntroFrame {
  stage: 'seed' | 'assembly' | 'identity' | 'handoff' | 'ready';
  assembly: number;
  letters: number[];
  descriptor: number;
  handoff: number;
  nameOpacity: number;
  overlayOpacity: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function introFrame(elapsedMs: number): IntroFrame {
  if (!Number.isFinite(elapsedMs)) return {stage: 'ready', assembly: 1, letters: [1, 1, 1, 1, 1, 1, 1], descriptor: 1, handoff: 1, nameOpacity: 0, overlayOpacity: 0};
  const t = Math.max(0, elapsedMs);
  const assembly = clamp((t - 180) / 540);
  const letters = Array.from({length: 7}, (_, index) => clamp((t - 560 - index * 72) / 1160));
  const descriptor = clamp((t - 1000) / 520);
  const handoff = clamp((t - 2100) / 900);
  const nameOpacity = 1 - clamp((t - 2280) / 360);
  const overlayOpacity = 1 - clamp((t - 2280) / 720);
  const stage = t < 180 ? 'seed' : t < 1800 ? 'assembly' : t < 2100 ? 'identity' : t < 3000 ? 'handoff' : 'ready';
  return {stage, assembly, letters, descriptor, handoff, nameOpacity, overlayOpacity};
}

import type {MotionRuntime} from './motion-runtime.ts';

export function initOpening(runtime: MotionRuntime): () => void {
  const root = document.documentElement;
  const overlay = document.querySelector<HTMLElement>('[data-opening-overlay]');
  const skip = overlay?.querySelector<HTMLButtonElement>('[data-opening-skip]');
  const enter = overlay?.querySelector<HTMLButtonElement>('[data-opening-enter]');
  const name = overlay?.querySelector<HTMLElement>('.opening-name');
  const replay = document.querySelector<HTMLButtonElement>('[data-replay-intro]');
  const releaseBoot = (window as Window & {__drishyaIntroBootCancel?: () => void}).__drishyaIntroBootCancel;
  const eligible = root.dataset.intro === 'pending' && runtime.policy().intro;
  if (!overlay || !skip || !enter || !name) {
    if (root.dataset.intro === 'pending') root.dataset.intro = 'skip';
    releaseBoot?.();
    return () => undefined;
  }

  const letters = [...name.querySelectorAll<HTMLElement>('[data-opening-letter]')];
  const pageControls = [...document.querySelectorAll<HTMLElement>('body > header, body > main, body > footer, body > .skip')];
  const inertBefore = new Map<HTMLElement, boolean>();
  const events = new AbortController();
  const options = {signal: events.signal};
  const ease = 'cubic-bezier(.22,1,.36,1)';
  type Phase = 'closed' | 'open' | 'wheel' | 'enter';
  let phase: Phase = 'closed';
  let started = 0;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  let fade: Animation | undefined;

  // Keep the dialog outside the page controls so inert never includes Enter or Skip.
  document.body.append(overlay);
  overlay.setAttribute('aria-modal', 'true');
  skip.textContent = 'Skip intro';

  function stopFade() {
    const current = fade;
    fade = undefined;
    current?.cancel();
  }

  function finish() {
    if (phase === 'closed') return;
    const restoreFocus = overlay!.contains(document.activeElement);
    phase = 'closed';
    clearTimeout(revealTimer);
    stopFade();
    overlay!.dataset.active = 'false';
    overlay!.dataset.exiting = 'false';
    overlay!.style.removeProperty('opacity');
    root.dataset.intro = 'ready';
    root.dataset.openingActive = 'false';
    for (const [element, inert] of inertBefore) element.inert = inert;
    inertBefore.clear();
    if (replay) replay.hidden = !runtime.policy().intro;
    if (restoreFocus) {
      const heading = document.querySelector<HTMLElement>('.hero-copy h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
      }
    }
  }

  function render() {
    if (phase !== 'open') return;
    const frame = introFrame(performance.now() - started);
    name!.style.transform = `translateY(${(1 - frame.descriptor) * 8}px)`;
    letters.forEach((letter, index) => {
      const progress = frame.letters[index] ?? 1;
      letter.style.setProperty('--opening-progress', String(1 - (1 - progress) ** 3));
    });
    if (frame.stage !== 'ready') {
      revealTimer = setTimeout(() => runtime.invalidate('opening', render), 16);
    }
  }

  function show(focusEnter: boolean) {
    if (phase !== 'closed' || !runtime.policy().intro) return;
    phase = 'open';
    started = performance.now();
    // Transfer the boot visibility gate directly to the active dialog in the same paint.
    root.dataset.intro = 'active';
    root.dataset.openingActive = 'true';
    overlay!.dataset.active = 'true';
    overlay!.style.opacity = '1';
    if (replay) replay.hidden = true;
    for (const element of pageControls) {
      inertBefore.set(element, element.inert);
      element.inert = true;
    }
    render();
    if (focusEnter) enter!.focus({preventScroll: true});
  }

  function fadeTo(target: number, duration: number, complete?: () => void) {
    const from = Number(getComputedStyle(overlay!).opacity);
    stopFade();
    overlay!.style.opacity = String(target);
    const current = runtime.animate(overlay!, [{opacity: from}, {opacity: target}], {duration, easing: ease});
    if (!current) {
      complete?.();
      return;
    }
    fade = current;
    const settle = () => {
      if (fade !== current) return;
      fade = undefined;
      complete?.();
    };
    current.finished.then(settle, settle);
  }

  function startExit(wheel: boolean) {
    if (phase !== 'open') {
      if (!wheel && phase === 'wheel') phase = 'enter';
      return;
    }
    phase = wheel ? 'wheel' : 'enter';
    clearTimeout(revealTimer);
    overlay!.dataset.exiting = 'true';
    fadeTo(0, 520, finish);
  }

  skip.addEventListener('click', finish, options);
  enter.addEventListener('click', () => startExit(false), options);
  addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (event.deltaY > 0) {
      startExit(true);
    } else if (phase === 'wheel') {
      phase = 'open';
      overlay.dataset.exiting = 'false';
      fadeTo(1, 180);
      render();
    }
  }, {...options, passive: true});
  addEventListener('keydown', event => {
    if (event.key === 'Escape') finish();
    if (event.key === 'Tab' && phase !== 'closed' && !overlay.contains(document.activeElement)) {
      event.preventDefault();
      enter.focus({preventScroll: true});
    }
  }, options);
  addEventListener('pagehide', finish, options);
  replay?.addEventListener('click', () => {
    if (phase !== 'closed' || !runtime.policy().intro) return;
    scrollTo({top: 0, behavior: 'instant'});
    show(true);
  }, options);

  if (eligible) {
    try {
      sessionStorage.setItem('drishya.landing.intro.v1', '1');
      show(false);
    } catch {
      root.dataset.intro = 'skip';
    }
  } else if (root.dataset.intro === 'pending') {
    root.dataset.intro = 'skip';
  }
  releaseBoot?.();

  const unsubscribe = runtime.subscribe(policy => {
    if (!policy.intro) finish();
    if (replay) replay.hidden = phase !== 'closed' || !policy.intro;
  });
  return () => {
    finish();
    events.abort();
    unsubscribe();
  };
}
