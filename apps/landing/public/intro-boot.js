(() => {
  const root = document.documentElement;
  try {
    const query = new URLSearchParams(location.search);
    const mode = sessionStorage.getItem('drishya.landing.motion.v1');
    const navigation = performance.getEntriesByType('navigation')[0];
    if (location.pathname !== '/' || location.hash || query.has('moment') || query.get('motion') === '0' ||
      document.hidden || innerWidth < 600 || innerHeight < 650 || navigation?.type === 'back_forward' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData ||
      mode === 'off' || mode === 'reduced' || sessionStorage.getItem('drishya.landing.intro.v1')) return;

    const guard = new AbortController();
    const timer = setTimeout(failOpen, 2400);
    function release() {
      clearTimeout(timer);
      guard.abort();
      delete window.__drishyaIntroBootCancel;
    }
    function failOpen() {
      if (root.dataset.intro === 'pending') root.dataset.intro = 'skip';
      release();
    }
    const options = {signal: guard.signal};
    window.__drishyaIntroBootCancel = release;
    addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Tab') failOpen();
    }, options);
    addEventListener('pointerdown', failOpen, options);
    addEventListener('pagehide', failOpen, options);
    root.dataset.intro = 'pending';
  } catch {
    root.dataset.intro = 'skip';
  }
})();
