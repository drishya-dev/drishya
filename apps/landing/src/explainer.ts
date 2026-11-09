import type {MotionRuntime} from './motion-runtime.ts';

export function initExplainer(runtime: MotionRuntime): () => void {
  const section = document.getElementById('how-it-works');
  if (!section) return () => {};

  const art = section.querySelector<HTMLElement>('.explainer-art');
  const inners = Array.from(section.querySelectorAll<SVGElement>('[data-emblem-inner]'));
  if (!art || !inners.length) return () => {};

  let consumed = false;
  let observer: IntersectionObserver | null = null;

  function settle(): void {
    inners.forEach(inner => runtime.cancel(inner));
  }

  function startReveal(): void {
    if (consumed) return;
    consumed = true;
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    const policy = runtime.policy();
    if (!policy.animate || policy.static) {
      settle();
      return;
    }

    inners.forEach((inner, i) => {
      runtime.animate(
        inner,
        [
          {transform: 'translateY(6px)', opacity: 0.75},
          {transform: 'translateY(0)', opacity: 1},
        ],
        {
          duration: 320,
          delay: i * 80,
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'backwards',
        },
      );
    });
  }

  const unsubscribe = runtime.subscribe(policy => {
    if (!policy.animate || policy.static) settle();
  });

  const onVisibility = (): void => {
    if (document.hidden) settle();
  };
  const onFocusIn = (): void => settle();
  const onSelect = (): void => settle();
  const onPageHide = (): void => {
    settle();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  section.addEventListener('focusin', onFocusIn);
  section.addEventListener('selectstart', onSelect);
  addEventListener('pagehide', onPageHide);

  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          startReveal();
        }
      },
      {threshold: 0.15},
    );
    observer.observe(art);
  } else {
    // If observation is unavailable, keep the final static state.
    consumed = true;
  }

  return () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    section.removeEventListener('focusin', onFocusIn);
    section.removeEventListener('selectstart', onSelect);
    removeEventListener('pagehide', onPageHide);
    settle();
  };
}
