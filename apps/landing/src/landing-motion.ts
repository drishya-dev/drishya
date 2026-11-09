import {identityPolygons} from './identity.ts';
import type {MotionRuntime} from './motion-runtime.ts';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 1000px) and (min-height: 700px)');
const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
export const motionAllowed = () =>
  !reduced.matches && new URLSearchParams(location.search).get('motion') !== '0' && !connection?.saveData;
export const scrollMotionAllowed = () => motionAllowed() && desktop.matches && !document.hidden;

export function initLandingMotion(runtime?: MotionRuntime): void {
  const track = document.querySelector<HTMLElement>('[data-identity-track]');
  const sculpture = track?.querySelector<SVGElement>('.identity-sculpture');
  const world = track?.querySelector<HTMLElement>('.hero-world');
  if (!track || !sculpture || !world) return;

  document.documentElement.classList.add('landing-home');

  // One-time arrival aperture settle: 420 ms, turn <= 18deg, scale 0.94 -> 1
  const hasDirectIntent = Boolean(location.hash && location.hash !== '#');
  if (motionAllowed() && !document.hidden && !hasDirectIntent) {
    const settleAnim = sculpture.animate(
      [
        {transform: 'rotate(18deg) scale(0.94)'},
        {transform: 'rotate(0deg) scale(1)'},
      ],
      {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)'}
    );

    settleAnim.finished
      .then(() => {
        const tether = world.querySelector('.evidence-tether');
        const preview = world.querySelector('.product-scene');
        if (tether && motionAllowed() && !document.hidden) {
          tether.animate([{opacity: 0.25}, {opacity: 1}], {
            duration: 280,
            easing: 'cubic-bezier(.22,1,.36,1)',
          });
        }
        if (preview && motionAllowed() && !document.hidden) {
          preview.animate(
            [
              {borderColor: '#56615b'},
              {borderColor: '#92d6c388'},
              {borderColor: '#56615b'},
            ],
            {duration: 280, easing: 'cubic-bezier(.22,1,.36,1)'}
          );
        }
      })
      .catch(() => {});
  }

  // Subtle pointer depth within artwork bounds
  let lastX = -999,
    lastY = -999;
  let targetX = 0,
    targetY = 0;

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    if (!motionAllowed() || document.hidden) return;
    const rect = world.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (Math.hypot(e.clientX - lastX, e.clientY - lastY) < 2) return;
    lastX = e.clientX;
    lastY = e.clientY;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
    targetX = nx;
    targetY = ny;

    runtime?.invalidate('hero-pointer', () => {
      sculpture.innerHTML = identityPolygons(0, {x: targetX, y: targetY});
      world.style.setProperty('--pointer-front-x', `${(targetX * 6).toFixed(2)}px`);
      world.style.setProperty('--pointer-front-y', `${(targetY * 4).toFixed(2)}px`);
      world.style.setProperty('--pointer-rear-x', `${(targetX * 3).toFixed(2)}px`);
      world.style.setProperty('--pointer-rear-y', `${(targetY * 2).toFixed(2)}px`);
    });
  };

  const onPointerLeave = () => {
    targetX = 0;
    targetY = 0;
    lastX = -999;
    lastY = -999;
    runtime?.invalidate('hero-pointer', () => {
      sculpture.innerHTML = identityPolygons(0, {x: 0, y: 0});
      world.style.setProperty('--pointer-front-x', '0px');
      world.style.setProperty('--pointer-front-y', '0px');
      world.style.setProperty('--pointer-rear-x', '0px');
      world.style.setProperty('--pointer-rear-y', '0px');
    });
  };

  world.addEventListener('pointermove', onPointerMove, {passive: true});
  world.addEventListener('pointerleave', onPointerLeave, {passive: true});

  const settle = () => {
    onPointerLeave();
  };
  const unsubscribe = runtime?.subscribe(() => settle());
  reduced.addEventListener('change', settle);
  desktop.addEventListener('change', settle);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settle();
  });
  addEventListener('pagehide', settle);
}

export function initSectionArrivals(runtime?: MotionRuntime): void {
  const animations = new Set<Animation>();
  const settle = () => {
    animations.forEach(a => a.cancel());
    animations.clear();
  };
  const applyPreference = () => {
    document.documentElement.dataset.landingMotion =
      motionAllowed() && !document.hidden ? 'on' : 'off';
    if (!motionAllowed() || document.hidden) {
      settle();
      document.getAnimations().forEach(a => a.cancel());
    }
  };
  applyPreference();
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!motionAllowed() || document.hidden || entry.target.contains(document.activeElement)) continue;
        const animation =
          runtime?.animate(
            entry.target,
            [{transform: 'translateY(18px)'}, {transform: 'translateY(0)'}],
            {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)'}
          ) ??
          entry.target.animate(
            [{transform: 'translateY(18px)'}, {transform: 'translateY(0)'}],
            {duration: 420, easing: 'cubic-bezier(.22,1,.36,1)'}
          );
        animations.add(animation);
        animation.finished.then(() => animations.delete(animation)).catch(() => animations.delete(animation));
      }
    },
    {threshold: 0.12}
  );
  document
    .querySelectorAll('.editorial-row,.closing,.statement>.wrap,.local-section>.wrap')
    .forEach(el => observer.observe(el));
  document.addEventListener('focusin', event => {
    if (event.target instanceof Element)
      event.target
        .closest('.editorial-row,.closing,.statement>.wrap,.local-section>.wrap')
        ?.getAnimations()
        .forEach(a => a.cancel());
  });
  reduced.addEventListener('change', () => {
    applyPreference();
    settle();
  });
  document.addEventListener('visibilitychange', applyPreference);
  addEventListener('pagehide', () => {
    settle();
    document.getAnimations().forEach(a => a.cancel());
    observer.disconnect();
  });
  addEventListener('pageshow', applyPreference);
}
