// SITE-1: the real Drishya app, mounted on the committed synthetic sample, for the laptop on the website.
// The page that embeds it drives the replay step by postMessage, so scrolling plays the real product's arrivals.
// Read-only and offline: like LAND-2's public demo, any request that is not a same-origin GET is refused.
import { createRoot } from 'react-dom/client';
import { loadBundle } from '../../ui/src/api.ts';
import { useApp, setMotion } from '../../ui/src/state.ts';
import { ModernApp } from '../../ui/src/modern/entry.tsx';

document.documentElement.dataset.uiVersion = 'modern';
document.documentElement.dataset.uiSkin = 'modern';
const fetchPublic = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/v1') || !['GET', 'HEAD'].includes(init?.method ?? (input instanceof Request ? input.method : 'GET'))) return Promise.reject(Error('The showcase cannot connect to local sessions.'));
  return fetchPublic(input, { ...init, credentials: 'omit' });
};

async function start() {
  const bundle = await loadBundle(new URL('demo/bundle.json', location.href).pathname);
  if (bundle.projection.operations.some(o => !o.id.startsWith('rec_x'))) throw Error('Only the synthetic sample may be shown.');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) setMotion(false);
  createRoot(document.getElementById('replay')!).render(<ModernApp token="" />);
  const total = bundle.projection.timeline.length;
  addEventListener('message', event => {
    if (event.origin !== location.origin || typeof event.data !== 'object' || event.data?.type !== 'drishya-seek') return;
    const step = Math.max(0, Math.min(total, Math.round(Number(event.data.step) || 0)));
    if (useApp.getState().step !== step || useApp.getState().mode !== 'replay') useApp.getState().seek(step, { hold: true });
  });
  parent.postMessage({ type: 'drishya-ready', total }, location.origin);
}
void start();
