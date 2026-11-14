// SITE-3: draws the hero's dotted backdrop on an OffscreenCanvas, so the page's main thread never does.
import { createDots, type Dots } from './dots.ts';

type Message =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; reduced: boolean }
  | { type: 'resize'; width: number; height: number }
  | { type: 'pointer'; x: number; y: number }
  | { type: 'scroll' }
  | { type: 'hidden'; value: boolean };

let dots: Dots | undefined;
// A worker's own requestAnimationFrame follows the canvas's display; a timer is the fallback where it is missing.
const frame = (cb: (now: number) => void): number => typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(cb)
  : (setTimeout(() => cb(performance.now()), 16) as unknown as number);

self.onmessage = (event: MessageEvent<Message>) => {
  const m = event.data;
  if (m.type === 'init') {
    const ctx = m.canvas.getContext('2d');
    if (!ctx) return;
    dots = createDots(m.canvas, ctx, size => new OffscreenCanvas(size, size), frame, m.reduced);
    dots.resize(m.width, m.height);
    dots.start();
  } else if (!dots) return;
  else if (m.type === 'resize') dots.resize(m.width, m.height);
  else if (m.type === 'pointer') dots.pointer(m.x, m.y);
  else if (m.type === 'scroll') dots.scrolled();
  else if (m.type === 'hidden') dots.hidden(m.value);
};
