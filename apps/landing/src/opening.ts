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
  const overlay = document.querySelector<HTMLElement>('[data-opening-overlay]');
  const skip = document.querySelector<HTMLButtonElement>('[data-opening-skip]');
  const enter = document.querySelector<HTMLButtonElement>('[data-opening-enter]');
  const replay = document.querySelector<HTMLButtonElement>('[data-replay-intro]');
  if (!overlay) return () => undefined;
  if (location.pathname !== '/' || location.hash || new URLSearchParams(location.search).has('moment')) {
    overlay.remove();
    skip?.remove();
    document.documentElement.dataset.openingActive = 'false';
    document.documentElement.dataset.introReady = 'true';
    return () => undefined;
  }
  if (document.documentElement.dataset.intro === 'skip') {
    overlay.remove();
    skip?.remove();
    document.documentElement.dataset.openingActive = 'false';
    document.documentElement.dataset.introReady = 'true';
    return () => undefined;
  }
  const name = overlay.querySelector<HTMLElement>('.opening-name');
  type OpeningPhase = 'waiting' | 'delaying' | 'exiting' | 'finished';
  let phase: OpeningPhase = 'waiting';
  let started = performance.now();
  let alreadyVisited = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let entryTimer: ReturnType<typeof setTimeout> | undefined;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    alreadyVisited = sessionStorage.getItem('drishya.landing.intro.v1') !== null;
    if (!alreadyVisited) sessionStorage.setItem('drishya.landing.intro.v1', '1');
  } catch {
    alreadyVisited = true;
  }
  const finish = () => {
    if (phase === 'finished') return;
    phase = 'finished';
    [timer, entryTimer, exitTimer].forEach(value => { if (value) clearTimeout(value); });
    overlay.dataset.active = 'false';
    overlay.dataset.exiting = 'false';
    document.documentElement.dataset.openingActive = 'false';
    document.documentElement.dataset.introReady = 'true';
    skip?.remove();
    enter?.remove();
    if (runtime.policy().intro) replay?.removeAttribute('hidden');
  };
  const render = () => {
    if (phase === 'finished') return;
    const frame = introFrame(performance.now() - started);
    overlay.dataset.active = 'true';
    document.documentElement.dataset.openingActive = 'true';
    document.documentElement.dataset.introReady = 'true';
    if (skip) skip.dataset.visible = 'true';
    if (enter && frame.descriptor >= 1) enter.dataset.visible = 'true';
    if (name) {
      name.style.opacity = '1';
      name.style.transform = `translateY(${(1 - frame.descriptor) * 8}px)`;
      name.querySelectorAll<HTMLElement>('[data-opening-letter]').forEach((letter, index) => {
        const progress = frame.letters[index] ?? 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        letter.style.setProperty('--opening-progress', String(eased));
      });
    }
    if (phase === 'waiting') overlay.style.opacity = '1';
    if (frame.stage === 'ready') replay?.removeAttribute('hidden');
    else timer = setTimeout(() => runtime.invalidate('opening', render), 16);
  };
  (window as Window & {__drishyaIntroBootCancel?: () => void}).__drishyaIntroBootCancel?.();
  const startExit = (reversible: boolean) => {
    if (phase !== 'waiting') return;
    phase = 'delaying';
    if (timer) clearTimeout(timer);
    overlay.dataset.exiting = 'true';
    entryTimer = setTimeout(() => {
      if (phase !== 'delaying') return;
      phase = 'exiting';
      overlay.style.opacity = '0';
      name?.style.setProperty('opacity', '0');
      exitTimer = setTimeout(finish, 1500);
    }, reversible ? 500 : 0);
  };
  const restore = () => {
    if (phase !== 'delaying' && phase !== 'exiting') return;
    if (entryTimer) clearTimeout(entryTimer);
    if (exitTimer) clearTimeout(exitTimer);
    phase = 'waiting';
    overlay.dataset.exiting = 'false';
    overlay.style.opacity = '1';
    name?.style.setProperty('opacity', '1');
    runtime.invalidate('opening', render);
  };
  const onSkip = () => startExit(false);
  const onEnter = () => startExit(false);
  skip?.addEventListener('click', onSkip);
  enter?.addEventListener('click', onEnter);
  const onWheel = (event: WheelEvent) => {
    if (event.deltaY > 0) startExit(true);
    else if (event.deltaY < 0) restore();
  };
  addEventListener('wheel', onWheel, {passive: true});
  const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') startExit(false); };
  addEventListener('keydown', onEscape);
  replay?.addEventListener('click', () => { phase = 'waiting'; started = performance.now(); overlay.dataset.active = 'true'; runtime.invalidate('opening', render); });
  if (runtime.policy().intro && !alreadyVisited) {
    document.documentElement.dataset.openingActive = 'true';
    runtime.invalidate('opening', render);
  }
  else finish();
  return () => {
    skip?.removeEventListener('click', onSkip);
    enter?.removeEventListener('click', onEnter);
    removeEventListener('wheel', onWheel);
    removeEventListener('keydown', onEscape);
    if (timer) clearTimeout(timer);
    finish();
  };
}
