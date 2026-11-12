import './site.css';
import './product.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import sample from './generated/sample.json';
import { mountLogos } from './logo.ts';
import { createMap, type Tone } from './map.ts';
import { productScreen, terminalScreen } from './product.ts';

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

// ---------- the laptop: a fixed 1440×900 product stage scaled into the screen ----------
const viewport = $('[data-viewport]');
viewport.innerHTML = `<div class="dr-stage" data-stage>${productScreen()}${terminalScreen()}</div>`;
const stage = $('[data-stage]');
const fit = () => stage.style.setProperty('--s', String(viewport.clientWidth / 1440));
new ResizeObserver(fit).observe(viewport); fit();
const camera = $('[data-dr-camera]'), cursor = $('[data-dr-cursor]'), term = $('[data-term]');
// Camera framing for a region of the 1440×900 stage, as a transform on the camera.
function frame(x: number, y: number, w: number, h: number) {
  const s = Math.min(1440 / w, 900 / h) * 0.94;
  return { x: (1440 - w * s) / 2 - x * s, y: (900 - h * s) / 2 - y * s, scale: s };
}
// Where an element sits inside the camera, in stage pixels (offsets are unaffected by transforms).
function at(el: HTMLElement) { let x = 0, y = 0, n: HTMLElement | null = el; while (n && n !== camera) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }

// ---------- hero ----------
const verb: Record<string, string> = { read: 'Read', search: 'Searched', edit: 'Edited', test: 'Ran', shell: 'Ran', mcp: 'Asked', spawn: 'Started' };
const kindLabel: Record<string, string> = { read: 'Read', search: 'Search', edit: 'Edit', test: 'Test', shell: 'Shell', mcp: 'MCP', spawn: 'Agent' };
const toneOf = (o: Op): Tone => o.kind === 'edit' ? 'edit' : o.kind === 'read' ? 'read' : o.outcome === 'failed' ? 'fail' : o.outcome === 'passed' ? 'pass' : 'search';
const heroMap = createMap($<HTMLCanvasElement>('[data-map="hero"]'), $('[data-map-labels="hero"]'), sample.graph, { scale: 0.5, still: reduced, offsetY: -0.06 });
const retest = sample.chapters.find(c => c.key === 'retest')!;

if (reduced) {
  for (const o of sample.operations) heroMap.light(o.path, toneOf(o), false);
  $('[data-ticker]').textContent = `${sample.operations.length} recorded actions in this sample`;
  term.style.display = 'none';
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
      .to(words.words, { opacity: 1, stagger: 0.05, ease: 'none' });

    for (const h of $$('[data-split]').filter(h => h.id !== 'hero-title')) {
      const s = new SplitText(h, { type: 'lines', mask: 'lines' });
      gsap.from(s.lines, { yPercent: 100, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
    }
    gsap.from('.close-mark .ribbon', { rotate: (_: number, el: HTMLElement) => Number(el.dataset.angle) - 70, scale: 0.4, opacity: 0, transformOrigin: '0 0', duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 70%', once: true } });

    tourScene();
  }

  // The tour: one pinned timeline, scrubbed by scroll, so every step plays forward and rewinds exactly.
  function tourScene() {
    const steps = $$('.tour-steps li'), cards = $$('[data-dr-card]'), lines = $$('.tl', term);
    const layer = (name: string) => $(`[data-dr-layer="${name}"]`);
    const file = $('[data-dr-file]'), files = $('.dr-files'), toolbox = $('.dr-toolbox'), passages = $$('.dr-passage');
    const whole = { x: 0, y: 0, scale: 1 };
    const region = (el: HTMLElement, pad = 24) => { const r = at(el); return frame(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2); };
    const fileAt = at(file);

    gsap.set(lines, { opacity: 0, y: 6 });
    gsap.set(cards, { opacity: 0, y: 22, scale: 0.96 });
    gsap.set('[data-dr-prose]', { opacity: 0 });
    gsap.set(steps, { autoAlpha: 0, y: 24 }); gsap.set(steps[0]!, { autoAlpha: 1, y: 0 });

    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: '.tour', start: 'top top', end: () => `+=${innerHeight * 8}`, pin: '.tour-pin', scrub: 0.8 } });
    const show = (i: number, at: number) => { tl.to(steps[i - 1]!, { autoAlpha: 0, y: -24, duration: 0.3 }, at).to(steps[i]!, { autoAlpha: 1, y: 0, duration: 0.4 }, at + 0.2); };

    // 0 · the terminal: each action is one line, and the lines scroll past.
    tl.to(lines, { opacity: 1, y: 0, stagger: 0.12, duration: 0.2 }, 0.1);
    // 1 · switch to Drishya, then the actions arrive one after another, left to right.
    show(1, 2.2);
    tl.to(term, { clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: 'power3.inOut' }, 2.1);
    tl.to(cards.slice(0, 3), { opacity: 1, y: 0, scale: 1, stagger: 0.35, duration: 0.45, ease: 'power3.out' }, 2.8);
    // 2 · the failure, the fix and the passing run, closer.
    show(2, 4.2);
    tl.to(camera, { ...region(passages[1]!, 30), duration: 0.8 }, 4.2);
    tl.to(cards.slice(3), { opacity: 1, y: 0, scale: 1, stagger: 0.35, duration: 0.45, ease: 'power3.out' }, 4.6);
    tl.to('[data-dr-prose]', { opacity: 1, duration: 0.4 }, 5.6);
    // 3 · Files beside the work.
    show(3, 6.3);
    tl.to(camera, { ...frame(80, 60, 760, 760), duration: 0.9 }, 6.3);
    // 4 · a cursor hovers the edited file, and its history opens.
    show(4, 7.6);
    tl.fromTo(cursor, { left: 640, top: 640, opacity: 0 }, { left: fileAt.x + 150, top: fileAt.y + 10, opacity: 1, duration: 0.7, ease: 'power3.inOut' }, 7.6);
    tl.to(file, { backgroundColor: 'rgba(122,168,255,.18)', duration: 0.2 }, 8.3);
    tl.to(layer('peek'), { autoAlpha: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 8.4).from(layer('peek'), { x: -14, duration: 0.4 }, 8.4);
    // 5 · Workspace.
    show(5, 9.4);
    tl.to([layer('peek'), cursor], { autoAlpha: 0, duration: 0.3 }, 9.4);
    tl.to(camera, { ...whole, duration: 0.8 }, 9.4);
    tl.fromTo(layer('workspace'), { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 9.7);
    // 6 · Changes for a branch.
    show(6, 10.9);
    tl.to(layer('workspace'), { autoAlpha: 0, duration: 0.3 }, 10.9);
    tl.fromTo(layer('changes'), { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 11.1);
    tl.to(camera, { ...region(layer('changes'), 10), duration: 0.8 }, 11.4);
    // 7 · the Git graph.
    show(7, 12.6);
    tl.to(layer('changes'), { autoAlpha: 0, duration: 0.3 }, 12.6);
    tl.fromTo(layer('graph'), { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 12.8);
    tl.from('.dr-graph-body path', { strokeDasharray: 600, strokeDashoffset: 600, duration: 0.8, stagger: 0.1 }, 12.9);
    // 8 · the Toolbox.
    show(8, 14.2);
    tl.to(layer('graph'), { autoAlpha: 0, duration: 0.3 }, 14.2);
    tl.to(camera, { ...region(toolbox, 40), duration: 0.9 }, 14.3);
    tl.to(camera, { ...whole, duration: 0.9 }, 15.6);
    tl.to({}, { duration: 0.4 }, 16.5);
    void files;
  }
}
