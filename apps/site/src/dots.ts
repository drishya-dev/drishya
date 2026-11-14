// The hero's dotted backdrop: a staggered grid of soft dots that twinkle, with a glow that follows the pointer.
// SITE-3: the drawing lives here, away from the page, so the same code can run in a worker on an OffscreenCanvas
// (the page's main thread then never pays for the 10,000+ dots, nor for committing the canvas) or, where that is not
// available, on the page itself. The look is unchanged: same grid, same stagger, same glow sprite, same timing.

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = { width: number; height: number };
type Sprite = HTMLCanvasElement | OffscreenCanvas;

export interface Dots {
  resize(width: number, height: number): void;
  pointer(x: number, y: number): void;
  scrolled(): void;
  hidden(value: boolean): void;
  start(): void;
}

export function createDots(canvas: Surface, ctx: Ctx, makeSprite: (size: number) => Sprite, frame: (cb: (now: number) => void) => number, reduced: boolean): Dots {
  const gap = 12;
  const radius = 2;
  const glowRadius = 150;
  let dots: { x: number; y: number; phase: number; speed: number }[] = [];
  let width = 0;
  let height = 0;
  let pointerX = -1;
  let pointerY = -1;
  let pending = 0;
  let isHidden = false;

  // One blurred dot, drawn once. Per-dot canvas shadows cost a blur for each of about 15,000 dots on every frame
  // and made the whole page lag; stamping this sprite gives the same glow for a fraction of the work.
  const glowSize = 28;
  const glow = makeSprite(glowSize);
  const g = (glow as HTMLCanvasElement).getContext('2d') as Ctx | null;
  if (g) {
    g.shadowColor = 'rgba(0, 170, 255, .85)';
    g.shadowBlur = 12;
    g.fillStyle = 'rgba(241, 238, 228, .3)';
    g.beginPath();
    g.arc(glowSize / 2, glowSize / 2, radius, 0, Math.PI * 2);
    g.fill();
  }

  const levels = 10;
  const buckets: number[][] = Array.from({ length: levels + 1 }, () => []);
  let lastDraw = 0, lastScroll = 0, lastPointer = 0;

  const draw = (now: number) => {
    pending = 0;
    if (!reduced && !isHidden) pending = frame(draw);
    // Scrolling gets the whole frame: the grid holds its last frame while the page moves.
    if (now - lastScroll < 160) return;
    // The twinkle takes 5 to 15 seconds a cycle, so 12 frames a second is enough at rest;
    // the glow under the pointer follows it at 30.
    if (now - lastDraw < (now - lastPointer < 240 ? 30 : 80)) return;
    lastDraw = now;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(241, 238, 228, .3)';
    const time = now / 1000;
    for (const bucket of buckets) bucket.length = 0;
    const glows: number[] = [];
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i]!;
      const pulse = .25 + .55 * ((Math.sin(time * dot.speed + dot.phase) + 1) / 2);
      let hover = 0;
      if (pointerX >= 0) {
        const dx = dot.x - pointerX, dy = dot.y - pointerY;
        if (dx > -glowRadius && dx < glowRadius && dy > -glowRadius && dy < glowRadius) hover = Math.max(0, 1 - Math.hypot(dx, dy) / glowRadius);
      }
      const brightness = Math.min(1, pulse + hover * .7);
      buckets[Math.round(brightness * levels)]!.push(i);
      const blur = hover > 0 ? hover : brightness > .62 ? .5 * (brightness - .62) / .38 : 0;
      if (blur > .04) glows.push(i, blur * brightness * .7);
    }
    // One fill per brightness level instead of one per dot.
    for (let level = 1; level <= levels; level++) {
      const bucket = buckets[level]!;
      if (!bucket.length) continue;
      ctx.globalAlpha = level / levels * .7;
      ctx.beginPath();
      for (const i of bucket) { const dot = dots[i]!; ctx.moveTo(dot.x + radius, dot.y); ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2); }
      ctx.fill();
    }
    for (let k = 0; k < glows.length; k += 2) {
      const dot = dots[glows[k]!]!;
      ctx.globalAlpha = Math.min(1, glows[k + 1]! * 2.4);
      ctx.drawImage(glow as CanvasImageSource, dot.x - glowSize / 2, dot.y - glowSize / 2, glowSize, glowSize);
    }
    ctx.globalAlpha = 1;
  };

  return {
    // Soft 4 px dots at 30 % ink do not need device resolution: a 2x canvas is four times the pixels to clear and
    // composite on every frame, and it alone held a Retina-size window near 27 frames a second.
    resize(w, h) {
      width = w;
      height = h;
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      dots = [];
      const cols = Math.ceil(width / gap) + 2;
      const rows = Math.ceil(height / gap) + 2;
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * gap + (j % 2 === 0 ? 0 : gap * 0.5);
          const y = j * gap;
          dots.push({ x, y, phase: Math.random() * Math.PI * 2, speed: .4 + Math.random() * .9 });
        }
      }
    },
    pointer(x, y) { pointerX = x; pointerY = y; lastPointer = performance.now(); },
    scrolled() { lastScroll = performance.now(); },
    hidden(value) { isHidden = value; if (!value && !pending && !reduced) pending = frame(draw); },
    start() { if (!pending) pending = frame(draw); },
  };
}
