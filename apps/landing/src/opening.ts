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
  const assembly = clamp((t - 120) / 440);
  const letters = Array.from({length: 7}, (_, index) => clamp((t - 400 - index * 24) / 500));
  const descriptor = clamp((t - 680) / 360);
  const handoff = clamp((t - 1200) / 600);
  const nameOpacity = 1 - clamp((t - 1320) / 240);
  const overlayOpacity = 1 - clamp((t - 1320) / 360);
  const stage = t < 120 ? 'seed' : t < 1060 ? 'assembly' : t < 1200 ? 'identity' : t < 1800 ? 'handoff' : 'ready';
  return {stage, assembly, letters, descriptor, handoff, nameOpacity, overlayOpacity};
}

import type {MotionRuntime} from './motion-runtime.ts';

export function initOpening(runtime: MotionRuntime): () => void {
  const overlay = document.querySelector<HTMLElement>('[data-opening-overlay]');
  const mark = document.querySelector<SVGElement>('.identity-sculpture');
  const skip = document.querySelector<HTMLButtonElement>('[data-opening-skip]');
  const replay = document.querySelector<HTMLButtonElement>('[data-replay-intro]');
  if (!overlay || !mark) return () => undefined;
  if (location.pathname !== '/' || location.hash || new URLSearchParams(location.search).has('moment')) {
    overlay.remove();
    skip?.remove();
    return () => undefined;
  }
  const name = overlay.querySelector<HTMLElement>('.opening-name');
  let stopped = false;
  let started = performance.now();
  let alreadyVisited = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    alreadyVisited = sessionStorage.getItem('drishya.landing.intro.v1') !== null;
    if (!alreadyVisited) sessionStorage.setItem('drishya.landing.intro.v1', '1');
  } catch {
    alreadyVisited = true;
  }
  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    overlay.dataset.active = 'false';
    mark.dataset.openingStage = 'ready';
    mark.removeAttribute('data-opening');
    skip?.remove();
    if (runtime.policy().intro) replay?.removeAttribute('hidden');
  };
  const render = () => {
    if (stopped) return;
    const frame = introFrame(performance.now() - started);
    overlay.dataset.active = 'true';
    if (skip) skip.dataset.visible = 'true';
    mark.dataset.opening = 'true';
    mark.dataset.openingStage = frame.stage;
    mark.style.opacity = String(Math.max(.2, frame.handoff ? 1 : frame.assembly));
    mark.style.transform = `scale(${.75 + frame.assembly * .25})`;
    if (name) {
      name.style.opacity = String(frame.nameOpacity);
      name.style.transform = `translateY(${(1 - frame.descriptor) * 8}px)`;
      name.querySelectorAll<HTMLElement>('[data-opening-letter]').forEach((letter, index) => {
        const progress = frame.letters[index] ?? 1;
        letter.style.opacity = String(progress);
        letter.style.transform = `translateY(${(1 - progress) * 16}px) rotateX(${(1 - progress) * 18}deg)`;
      });
    }
    overlay.style.opacity = String(frame.overlayOpacity);
    if (frame.stage === 'ready') finish();
    else timer = setTimeout(() => runtime.invalidate('opening', render), 16);
  };
  const cancel = () => finish();
  skip?.addEventListener('click', cancel);
  addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Tab') cancel(); }, {once: true});
  addEventListener('pointerdown', cancel, {once: true});
  addEventListener('focusin', cancel, {once: true});
  replay?.addEventListener('click', () => { stopped = false; started = performance.now(); overlay.dataset.active = 'true'; runtime.invalidate('opening', render); });
  if (runtime.policy().intro && !alreadyVisited) runtime.invalidate('opening', render);
  else finish();
  return () => {
    skip?.removeEventListener('click', cancel);
    if (timer) clearTimeout(timer);
    finish();
  };
}
