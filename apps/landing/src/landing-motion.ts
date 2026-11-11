import type {MotionRuntime} from './motion-runtime.ts';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
export const motionAllowed = () =>
  !reduced.matches && new URLSearchParams(location.search).get('motion') !== '0' && !connection?.saveData;

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
