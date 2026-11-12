import './site.css';
import './product.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import sample from './generated/sample.json';
import { mountLogos } from './logo.ts';
import { createMap, type Tone } from './map.ts';
import { appScreen, terminalScreen } from './product.ts';

// One place for what SHIP-9 and the builders decide at release. Links without a page yet stay on '#'.
const SITE = {
  install: 'npx drishya',
  repo: 'https://github.com/drishya-dev/drishya',
  links: { docs: '#', discussions: '#', changelog: '#', issues: '#' } as Record<string, string>,
};

gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = document.documentElement.dataset.motion === 'reduced';
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
type Op = (typeof sample.operations)[number];

// ---------- links, copy ----------
mountLogos();
const external = (a: HTMLAnchorElement, href: string) => { a.href = href; if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; } };
for (const a of $$<HTMLAnchorElement>('[data-repo-link]')) external(a, SITE.repo);
for (const a of $$<HTMLAnchorElement>('[data-star-link]')) external(a, SITE.repo);
for (const a of $$<HTMLAnchorElement>('[data-link]')) external(a, SITE.links[a.dataset.link!] ?? '#');
for (const el of $$('[data-install-command]')) el.textContent = SITE.install;
for (const b of $$<HTMLButtonElement>('[data-copy]')) {
  const label = b.textContent;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(SITE.install); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => (b.textContent = label), 1600);
  });
}

// ---------- the laptop: three screens of one session, on a fixed 1440x900 stage scaled into the screen ----------
// Screen 3 is the real Drishya app (demo.html) on the synthetic sample; the page moves its replay step as you scroll.
const viewport = $('[data-viewport]');
viewport.innerHTML = `<div class="dr-stage" data-stage><iframe class="dr-frame" data-frame title="Drishya replaying the sample session" tabindex="-1"></iframe>${appScreen()}${terminalScreen()}</div>`;
const stage = $('[data-stage]'), frameEl = $<HTMLIFrameElement>('[data-frame]');
const fit = () => stage.style.setProperty('--s', String(viewport.clientWidth / 1440));
new ResizeObserver(fit).observe(viewport); fit();
let wantedStep = 0, frameReady = false;
addEventListener('message', e => { if (e.origin === location.origin && e.data?.type === 'drishya-ready') { frameReady = true; seek(wantedStep); } });
// One seek per frame at most: a fast scroll asks for many steps, and only the last one needs rendering.
let seekQueued = false;
function seek(step: number) { wantedStep = step; if (!frameReady || seekQueued) return; seekQueued = true; requestAnimationFrame(() => { seekQueued = false; frameEl.contentWindow?.postMessage({ type: 'drishya-seek', step: wantedStep }, location.origin); }); }
// The real app is about 340 KB compressed, so it loads only as the laptop comes near.
new IntersectionObserver(([e], o) => { if (e!.isIntersecting) { frameEl.src = new URL('demo.html', location.href).pathname; o.disconnect(); } }, { rootMargin: '150% 0px' }).observe(viewport);

// ---------- hero ----------
const toneOf = (o: Op): Tone => o.kind === 'edit' ? 'edit' : o.kind === 'read' ? 'read' : o.outcome === 'failed' ? 'fail' : o.outcome === 'passed' ? 'pass' : 'search';
const heroMap = createMap($<HTMLCanvasElement>('[data-map="hero"]'), null, sample.graph, { scale: 0.5, still: reduced, offsetY: -0.06 });
// The why section's stream: the same CLI lines the laptop shows, scrolling past as they do in a terminal.
$('[data-why-lines]').innerHTML = Array.from({ length: 3 }, () => $$('.tl', $('[data-screen="cli"]')).map(l => `<div class="${l.classList.contains('r') ? 'r' : ''}">${l.innerHTML}</div>`).join('')).join('');
if (reduced) {
  for (const o of sample.operations) heroMap.light(o.path, toneOf(o), false);
  $$('.screen').forEach(el => (el.style.display = 'none'));
  frameEl.src = new URL('demo.html', location.href).pathname;
  $$('.tour-steps li').forEach(li => li.classList.add('on'));
} else {
  animate();
}

function animate() {
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) a.addEventListener('click', e => { const id = a.getAttribute('href')!; if (id.length > 1) { e.preventDefault(); lenis.scrollTo(id === '#top' ? 0 : id, { offset: 0, duration: 1.4 }); } });

  document.fonts.ready.then(() => { intro(); scrollScenes(); ScrollTrigger.refresh(); });

  function intro() {
    const ribbons = $$('.hero-mark .ribbon');
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from(ribbons, { rotate: (i: number) => Number(ribbons[i]!.dataset.angle) - 70, scale: 0.35, opacity: 0, transformOrigin: '0 0', duration: 1.5, stagger: 0.07 }, 0)
      .from('.hero-mark .aperture', { attr: { r: 0 }, duration: 1.2, ease: 'power3.out' }, 0.35)
      .from('.nav', { y: -16, opacity: 0, duration: 0.8 }, 1.1)
      .to({ p: 0 }, { p: 1, duration: 2, ease: 'power2.out', onUpdate() { heroMap.setReveal(this.targets()[0].p); } }, 0.7);
  }

  function scrollScenes() {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
      .to('.hero-inner', { y: -80, opacity: 0.15, ease: 'none' }, 0)
      .to('.hero-mark', { scale: 0.7, ease: 'none' }, 0)
      .to({ a: 0.6 }, { a: 1.6, ease: 'none', onUpdate() { heroMap.setAngle(this.targets()[0].a); } }, 0);

    const words = new SplitText('[data-words]', { type: 'words' });
    gsap.set(words.words, { opacity: 0.14 });
    gsap.timeline({ scrollTrigger: { trigger: '.why', start: 'top top', end: '+=140%', pin: '.why-pin', scrub: true } })
      .to(words.words, { opacity: 1, stagger: 0.05, ease: 'none' }, 0)
      .to('[data-why-lines]', { yPercent: -55, ease: 'none', duration: words.words.length * 0.05 }, 0);
    gsap.to('.backdrop .hero-map', { opacity: 0.38, ease: 'none', scrollTrigger: { trigger: '.why', start: 'top bottom', end: 'top top', scrub: true } });
    ScrollTrigger.create({ trigger: '.why', start: 'bottom top', onEnter: () => { heroMap.pause(); $('.aurora').classList.add('rest'); }, onLeaveBack: () => { heroMap.resume(); $('.aurora').classList.remove('rest'); } });
    gsap.to('.glow', { opacity: 0.45, ease: 'none', scrollTrigger: { trigger: '.why', start: 'top bottom', end: 'top top', scrub: true } });

    for (const h of $$('[data-split]')) {
      const s = new SplitText(h, { type: 'lines', mask: 'lines' });
      gsap.from(s.lines, { yPercent: 100, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
    }
    gsap.from('.close-mark .ribbon', { rotate: (_: number, el: HTMLElement) => Number(el.dataset.angle) - 70, scale: 0.4, opacity: 0, transformOrigin: '0 0', duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 70%', once: true } });

    tourScene();
    featureScenes();
  }

  // Features: one window showing the whole real screen. Each step is one frame or a short sequence; a cursor clicks
  // only the control the step is about, and the camera zooms only to that control, then back out.
  // Frames are real Drishya on a real Drishya session (scripts/site-footage-real.ts, reviewed before publishing).
  type Frame = { img: string; click?: [number, number]; zoom?: [number, number, number, number] };
  const FEATURES: Frame[][] = [
    // Click positions are where the real control was on screen, measured by the footage script.
    [{ img: 'explorer', click: [.155, .472] }],
    [{ img: 'history-a' }, { img: 'history-b', click: [.032, .587] }],
    [{ img: 'workspace' }],
    [{ img: 'changes-session', click: [.419, .111] }, { img: 'changes-branch', click: [.472, .111] }, { img: 'changes-branch-pick', click: [.369, .161] },
     { img: 'changes-branch-picked', click: [.446, .31] }, { img: 'changes-pr-pick', click: [.522, .111] }, { img: 'changes-pr', click: [.397, .201] }],
    [{ img: 'git-graph' }, { img: 'git-graph-branch', click: [.149, .413] }],
    [{ img: 'tool', click: [.869, .754] }, { img: 'tool-next', click: [.882, .471] }],
    [{ img: 'prompt', zoom: [.6, .5, .4, .5], click: [.936, .678] }],
    [{ img: 'composer', click: [.5, .957] }],
  ];
  function featureScenes() {
    const camera = $('[data-feat-camera]'), win = $('[data-feat-window]'), steps = $$('.feat-steps li');
    const cursorEl = $('.feat-cursor', win), ripple = $('.feat-ripple', win);
    const names = [...new Set(FEATURES.flat().map(f => f.img))];
    camera.innerHTML = names.map(n => `<img src="footage/${n}.jpg" alt="" decoding="async" data-frame-name="${n}" />`).join('');
    new IntersectionObserver((entries, io) => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); for (const im of camera.querySelectorAll('img')) void im.decode().catch(() => {}); } }, { rootMargin: '200% 0px' }).observe(win);
    const img = (n: string) => $(`[data-frame-name="${n}"]`, camera);
    const W = () => win.clientWidth, H = () => win.clientHeight;
    const zoomTo = (z?: [number, number, number, number]) => { if (!z) return { scale: 1, x: 0, y: 0 }; const [zx, zy, zw, zh] = z, sc = 0.94 / Math.max(zw, zh); return { scale: sc, x: () => (0.5 - (zx + zw / 2) * sc) * W(), y: () => (0.5 - (zy + zh / 2) * sc) * H() }; };
    gsap.set(steps, { autoAlpha: 0, y: 24 }); gsap.set(steps[0]!, { autoAlpha: 1, y: 0 });
    gsap.set(img(FEATURES[0]![0]!.img), { opacity: 1 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' }, scrollTrigger: { trigger: '.features', start: 'top top', end: () => `+=${innerHeight * FEATURES.flat().length * 0.55}`, pin: '.features-pin', scrub: true, invalidateOnRefresh: true } });
    let shown = FEATURES[0]![0]!.img, t = 0;
    FEATURES.forEach((frames, i) => {
      if (i > 0) { tl.to(steps[i - 1]!, { autoAlpha: 0, y: -24, duration: 0.3 }, t).to(steps[i]!, { autoAlpha: 1, y: 0, duration: 0.4 }, t + 0.2); }
      frames.forEach((f, j) => {
        // Inside a sequence a click causes the next screen: the cursor clicks on the screen still showing, then it changes.
        const swapAt = j > 0 && f.click ? t + 0.95 : t;
        if (f.img !== shown) { tl.to(img(shown), { opacity: 0, duration: 0.35 }, swapAt).to(img(f.img), { opacity: 1, duration: 0.35 }, swapAt); shown = f.img; }
        tl.to(cursorEl, { opacity: 0, duration: 0.12 }, t);
        tl.to(camera, { ...zoomTo(f.zoom), duration: 0.55 }, t + 0.1);
        if (f.click) {
          const z = zoomTo(f.zoom), sc = z.scale;
          const px = () => (typeof z.x === 'function' ? z.x() : 0) + f.click![0] * W() * sc, py = () => (typeof z.y === 'function' ? z.y() : 0) + f.click![1] * H() * sc;
          tl.fromTo(cursorEl, { left: () => W() * 0.82, top: () => H() * 0.9, opacity: 0 }, { left: px, top: py, opacity: 1, duration: 0.4, ease: 'power2.out' }, t + 0.5);
          tl.fromTo(ripple, { left: px, top: py, scale: 0.4, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.3, ease: 'power1.out' }, t + 0.92);
          t += swapAt > t ? 2.1 : 1.25; // a screen the click changed holds long enough to read
        } else t += 0.9;
      });
      tl.to(camera, { scale: 1, x: 0, y: 0, duration: 0.45 }, t); t += 0.5;
    });
    tl.to({}, { duration: 0.3 }, t);
  }

  // The tour: one pinned timeline, scrubbed by scroll, so every step plays forward and rewinds exactly.
  function tourScene() {
    const steps = $$('.tour-steps li'), cli = $('[data-screen="cli"]'), app = $('[data-screen="app"]');
    const lines = $$('.tl', cli), rows = $$('.ap-tool, .ap-reply', app);
    gsap.set(lines, { opacity: 0 });
    gsap.set(rows, { opacity: 0, y: 8 });
    gsap.set(steps, { autoAlpha: 0, y: 24 }); gsap.set(steps[0]!, { autoAlpha: 1, y: 0 });
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: '.tour', start: 'top top', end: () => `+=${innerHeight * 7}`, pin: '.tour-pin', scrub: true, invalidateOnRefresh: true } });
    const show = (i: number, t: number) => tl.to(steps[i - 1]!, { autoAlpha: 0, y: -24, duration: 0.3 }, t).to(steps[i]!, { autoAlpha: 1, y: 0, duration: 0.4 }, t + 0.2);
    const replay = (from: number, to: number, t: number, duration: number) => tl.fromTo({ s: from }, { s: from }, { s: to, duration, ease: 'none', onUpdate() { const n = Math.round(this.targets()[0].s); if (n !== wantedStep) seek(n); } }, t);

    // The laptop is laid out at its full-screen size and shown smaller at rest, so growing never upscales pixels.
    // At rest it sits in the right-hand column; while the three screens play it fills the screen.
    const wide = matchMedia('(min-width: 900px)').matches;
    const laptop = $('.laptop'), caption = $('.tour-steps'), slot = $('.laptop-slot');
    // Measured against the pin, not the viewport, so the resting place is the same at any scroll position (and on refresh).
    const pin = $('.tour-pin');
    const rest = () => { const r = slot.getBoundingClientRect(), p = pin.getBoundingClientRect(), full = laptop.offsetWidth; return { scale: r.width / full, x: r.left + r.width / 2 - (p.left + p.width / 2), y: r.top + r.height / 2 - (p.top + p.height / 2) }; };
    // Centred vertically by GSAP's yPercent, so the scroll tweens own only the pixel offsets.
    if (wide) gsap.set(laptop, { yPercent: -50, scale: () => rest().scale, x: () => rest().x, y: () => rest().y });
    if (wide) tl.fromTo(laptop, { scale: () => rest().scale, x: () => rest().x, y: () => rest().y }, { scale: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.inOut', immediateRender: false }, 0);
    if (wide) tl.to(caption, { y: () => innerHeight * 0.26, x: () => -Math.max(0, caption.getBoundingClientRect().left - 24), scale: 0.9, transformOrigin: '0 100%', duration: 0.6, ease: 'power3.inOut' }, 0);
    // 1: the CLI, one line per action, scrolling past.
    tl.to(lines, { opacity: 1, stagger: 0.07, duration: 0.15, ease: 'none' }, 0.6);
    // 2: the desktop app, the same session as a chat with tools folded into rows.
    show(1, 1.9);
    tl.to(cli, { clipPath: 'inset(0 0 100% 0)', duration: 0.6, ease: 'power3.inOut' }, 1.9);
    tl.to(rows, { opacity: 1, y: 0, stagger: 0.08, duration: 0.3, ease: 'power2.out' }, 2.3);
    // 3: Drishya, the real app replaying the same session as you scroll.
    show(2, 3.6);
    tl.to(app, { clipPath: 'inset(0 0 100% 0)', duration: 0.6, ease: 'power3.inOut' }, 3.6);
    replay(0, 12, 4.0, 1.4);
    show(3, 5.4); replay(12, 21, 5.5, 1.3);
    show(4, 6.9); replay(21, 29, 7.0, 1.4);
    show(5, 8.5); replay(29, 45, 8.6, 1.6);
    if (wide) { tl.to(laptop, { scale: () => rest().scale, x: () => rest().x, y: () => rest().y, duration: 0.6, ease: 'power3.inOut' }, 10.2); tl.to(caption, { scale: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.inOut' }, 10.2); }
    tl.to({}, { duration: 0.3 }, 10.8);
  }
}
