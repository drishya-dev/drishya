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
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
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
function seek(step: number) { wantedStep = step; if (frameReady) frameEl.contentWindow?.postMessage({ type: 'drishya-seek', step }, location.origin); }
// The real app is about 340 KB compressed, so it loads only as the laptop comes near.
new IntersectionObserver(([e], o) => { if (e!.isIntersecting) { frameEl.src = new URL('demo.html', location.href).pathname; o.disconnect(); } }, { rootMargin: '150% 0px' }).observe(viewport);

// ---------- hero ----------
const verb: Record<string, string> = { read: 'Read', search: 'Searched', edit: 'Edited', test: 'Ran', shell: 'Ran', mcp: 'Asked', spawn: 'Started' };
const kindLabel: Record<string, string> = { read: 'Read', search: 'Search', edit: 'Edit', test: 'Test', shell: 'Shell', mcp: 'MCP', spawn: 'Agent' };
const toneOf = (o: Op): Tone => o.kind === 'edit' ? 'edit' : o.kind === 'read' ? 'read' : o.outcome === 'failed' ? 'fail' : o.outcome === 'passed' ? 'pass' : 'search';
const heroMap = createMap($<HTMLCanvasElement>('[data-map="hero"]'), $('[data-map-labels="hero"]'), sample.graph, { scale: 0.5, still: reduced, offsetY: -0.06 });
// The why section's stream: the same CLI lines the laptop shows, scrolling past as they do in a terminal.
$('[data-why-lines]').innerHTML = Array.from({ length: 3 }, () => $$('.tl', $('[data-screen="cli"]')).map(l => `<div class="${l.classList.contains('r') ? 'r' : ''}">${l.innerHTML}</div>`).join('')).join('');
const retest = sample.chapters.find(c => c.key === 'retest')!;

if (reduced) {
  for (const o of sample.operations) heroMap.light(o.path, toneOf(o), false);
  $('[data-ticker]').textContent = `${sample.operations.length} recorded actions in this sample`;
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
  for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) a.addEventListener('click', e => { const id = a.getAttribute('href')!; if (id.length > 1) { e.preventDefault(); lenis.scrollTo(id === '#top' ? 0 : id, { offset: -64 }); } });

  document.fonts.ready.then(() => { intro(); scrollScenes(); ScrollTrigger.refresh(); });

  function intro() {
    const ribbons = $$('.hero-mark .ribbon');
    const word = new SplitText('.wordmark', { type: 'chars' }), title = new SplitText('#hero-title', { type: 'lines', mask: 'lines' });
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from(ribbons, { rotate: (i: number) => Number(ribbons[i]!.dataset.angle) - 70, scale: 0.35, opacity: 0, transformOrigin: '0 0', duration: 1.5, stagger: 0.07 }, 0)
      .from('.hero-mark .aperture', { attr: { r: 0 }, duration: 1.2, ease: 'power3.out' }, 0.35)
      .from(word.chars, { yPercent: 70, opacity: 0, filter: 'blur(8px)', duration: 1.1, stagger: 0.035 }, 0.5)
      .from(title.lines, { yPercent: 100, duration: 0.9, stagger: 0.08 }, 0.9)
      .from('[data-rise]', { y: 18, opacity: 0, duration: 0.9, stagger: 0.08 }, 1.05)
      .from('.nav', { y: -16, opacity: 0, duration: 0.8 }, 1.1)
      .to({ p: 0 }, { p: 1, duration: 2, ease: 'power2.out', onUpdate() { heroMap.setReveal(this.targets()[0].p); } }, 0.7)
      .add(playSession, 2.2);
  }

  // The hero replays the sample once, in its real order, lighting each file the agent touched. It then rests.
  function playSession() {
    const ticker = $('[data-ticker]'), tl = gsap.timeline();
    sample.operations.forEach((o, i) => tl.call(() => {
      ticker.innerHTML = `<span class="chip ${o.kind}">${kindLabel[o.kind]}</span>${esc(verb[o.kind])} ${esc(o.target)}${o.outcome ? ` · <b class="${o.outcome === 'failed' ? 'fail' : 'pass'}">${o.outcome}</b>` : ''}<span class="ticker-agent">${esc(o.agent)} · ${esc(o.harness)}</span>`;
      gsap.fromTo(ticker, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
      heroMap.light(o.path, toneOf(o), i < 6 || o.kind === 'edit');
    }, [], i * 0.62));
    tl.call(() => { ticker.innerHTML = `${sample.operations.length} recorded actions · ${sample.harnesses.join(' and ')} · <b class="pass">${esc(retest.status)}</b>`; gsap.fromTo(ticker, { opacity: 0 }, { opacity: 1, duration: 0.5 }); }, [], sample.operations.length * 0.62 + 0.3);
  }

  function scrollScenes() {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
      .to('.hero-inner', { y: -80, opacity: 0.15, ease: 'none' }, 0)
      .to('.hero-mark', { scale: 0.7, ease: 'none' }, 0)
      .to({ a: 0.6 }, { a: 1.6, ease: 'none', onUpdate() { heroMap.setAngle(this.targets()[0].a); } }, 0);

    const words = new SplitText('[data-words]', { type: 'words' });
    gsap.set(words.words, { opacity: 0.14 });
    gsap.timeline({ scrollTrigger: { trigger: '.why', start: 'top top', end: '+=140%', pin: '.why-pin', scrub: 0.6 } })
      .to(words.words, { opacity: 1, stagger: 0.05, ease: 'none' }, 0)
      .to('[data-why-lines]', { yPercent: -55, ease: 'none', duration: words.words.length * 0.05 }, 0);
    gsap.to('.backdrop .hero-map, .backdrop .hero-labels', { opacity: 0.38, ease: 'none', scrollTrigger: { trigger: '.why', start: 'top bottom', end: 'top top', scrub: true } });
    gsap.to('.glow', { opacity: 0.45, ease: 'none', scrollTrigger: { trigger: '.why', start: 'top bottom', end: 'top top', scrub: true } });

    for (const h of $$('[data-split]').filter(h => h.id !== 'hero-title')) {
      const s = new SplitText(h, { type: 'lines', mask: 'lines' });
      gsap.from(s.lines, { yPercent: 100, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
    }
    gsap.from('.close-mark .ribbon', { rotate: (_: number, el: HTMLElement) => Number(el.dataset.angle) - 70, scale: 0.4, opacity: 0, transformOrigin: '0 0', duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 70%', once: true } });

    tourScene();
    featureScenes();
  }

  // Features: each real frame starts whole, then zooms into the part the text describes. Files adds a cursor
  // that moves to the edited file, then the frame changes to that file's history.
  function featureScenes() {
    for (const shot of $$('.shot')) {
      const [rx, ry, rw, rh] = shot.dataset.zoom!.split(',').map(Number) as [number, number, number, number];
      const scale = 0.92 / Math.max(rw, rh), x = (0.5 - (rx + rw / 2) * scale) * 100, y = (0.5 - (ry + rh / 2) * scale) * 100;
      const main = $('.shot-main', shot), swap = shot.querySelector<HTMLElement>('.shot-swap'), cursorEl = shot.querySelector<HTMLElement>('.shot-cursor');
      const section = shot.closest('.feature')!;
      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: section, start: 'top top', end: () => `+=${innerHeight * (swap ? 1.6 : 0.9)}`, pin: section.querySelector('.feature-pin'), scrub: 0.6 } });
      tl.to(main, { scale, xPercent: x, yPercent: y, duration: 1 }, 0.1);
      if (cursorEl) {
        const [cx, cy] = cursorEl.dataset.cursor!.split(',').map(Number) as [number, number];
        tl.fromTo(cursorEl, { left: '78%', top: '86%', opacity: 0 }, { left: `${x + cx * scale * 100}%`, top: `${y + cy * scale * 100}%`, opacity: 1, duration: 0.7 }, 1.2);
      }
      if (swap) {
        tl.to(main, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.6 }, 2.1);
        tl.to(cursorEl, { opacity: 0, duration: 0.2 }, 2.1);
        tl.to(swap, { opacity: 1, duration: 0.5 }, 2.3);
      }
      tl.to({}, { duration: 0.3 });
    }
  }

  // The tour: one pinned timeline, scrubbed by scroll, so every step plays forward and rewinds exactly.
  function tourScene() {
    const steps = $$('.tour-steps li'), cli = $('[data-screen="cli"]'), app = $('[data-screen="app"]');
    const lines = $$('.tl', cli), rows = $$('.ap-tool, .ap-reply', app);
    gsap.set(lines, { opacity: 0 });
    gsap.set(rows, { opacity: 0, y: 8 });
    gsap.set(steps, { autoAlpha: 0, y: 24 }); gsap.set(steps[0]!, { autoAlpha: 1, y: 0 });
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: '.tour', start: 'top top', end: () => `+=${innerHeight * 7}`, pin: '.tour-pin', scrub: 0.6 } });
    const show = (i: number, t: number) => tl.to(steps[i - 1]!, { autoAlpha: 0, y: -24, duration: 0.3 }, t).to(steps[i]!, { autoAlpha: 1, y: 0, duration: 0.4 }, t + 0.2);
    const replay = (from: number, to: number, t: number, duration: number) => tl.fromTo({ s: from }, { s: from }, { s: to, duration, ease: 'none', onUpdate() { const n = Math.round(this.targets()[0].s); if (n !== wantedStep) seek(n); } }, t);

    // The laptop grows to fill the screen while the three screens play; the captions float over it.
    const laptop = $('.laptop'), caption = $('.tour-steps');
    const grow = () => { const r = laptop.getBoundingClientRect(), s = Math.min(innerWidth * 0.94 / r.width, innerHeight * 0.9 / r.height); return { scale: s, x: innerWidth / 2 - (r.left + r.width / 2), y: innerHeight / 2 - (r.top + r.height / 2) + 6 }; };
    tl.to(laptop, { scale: () => grow().scale, x: () => grow().x, y: () => grow().y, duration: 0.6, ease: 'power3.inOut' }, 0);
    tl.to(caption, { y: () => innerHeight * 0.26, x: () => -Math.max(0, caption.getBoundingClientRect().left - 24), scale: 0.9, transformOrigin: '0 100%', duration: 0.6, ease: 'power3.inOut' }, 0);
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
    tl.to([laptop, caption], { scale: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.inOut' }, 10.2);
    tl.to({}, { duration: 0.3 }, 10.8);
  }
}
