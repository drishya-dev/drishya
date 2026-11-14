import './site.css';
import './product.css';
import { FEATURES } from './footage.ts';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import sample from './generated/sample.json';
import { mountLogos } from './logo.ts';
import { createDots, type Dots } from './dots.ts';
import { createMap, type Tone } from './map.ts';
import { appScreen, terminalScreen } from './product.ts';

// Install version is selected by SHIP-9. Source links work without a separate docs service.
const SITE = {
  install: 'npx drishya',
  repo: 'https://github.com/drishya-dev/drishya',
  links: { docs: 'https://github.com/drishya-dev/drishya#readme', changelog: 'https://github.com/drishya-dev/drishya/releases', issues: 'https://github.com/drishya-dev/drishya/issues' } as Record<string, string>,
};

const reduced = document.documentElement.dataset.motion === 'reduced';
const revealSite = () => { document.documentElement.dataset.appReady = 'true'; };
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
  const status = b.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(SITE.install); b.textContent = 'Copied'; if (status) status.textContent = 'Command copied'; }
    catch { b.textContent = 'Select and copy'; if (status) status.textContent = 'Clipboard unavailable'; }
    setTimeout(() => { b.textContent = label; if (status) status.textContent = ''; }, 1600);
  });
}

// ---------- the laptop: three screens of one session, on a fixed 1440x900 stage scaled into the screen ----------
// Screen 3 is the real Drishya app (demo.html) on the synthetic sample; the page moves its replay step as you scroll.
const viewport = $('[data-viewport]');
viewport.innerHTML = `<div class="dr-stage" data-stage><iframe class="dr-frame" data-frame title="Drishya replaying the sample session" tabindex="-1"></iframe></div>`;
const stage = $('[data-stage]'), frameEl = $<HTMLIFrameElement>('[data-frame]');
const fit = () => stage.style.setProperty('--s', String(viewport.clientWidth / 1440));
new ResizeObserver(fit).observe(viewport); fit();
let wantedStep = 0, frameReady = false, refreshing = false, tourActive = () => false;
let seekQueued = false, seekReadyAt = 0, seekInFlight = false, sentStep = -1, requestId = 0;
addEventListener('message', e => {
  // Another same-origin window must not be able to advance the laptop's handshake.
  if (e.origin !== location.origin || e.source !== frameEl.contentWindow) return;
  if (e.data?.type === 'drishya-ready') { frameReady = true; sentStep = -1; seek(wantedStep); }
  else if (e.data?.type === 'drishya-seeked' && seekInFlight && e.data.requestId === requestId) {
    seekInFlight = false;
    frameEl.dataset.step = String(e.data.step);
    // Include React's paint, not just the synchronous store write, in SITE-3's pacing budget.
    seekReadyAt = performance.now() + Math.min(400, Math.max(0, Number(e.data.ms) || 0));
    seek(wantedStep);
  }
});
const pump = () => {
  if (performance.now() < seekReadyAt) { requestAnimationFrame(pump); return; }
  seekQueued = false;
  if (!frameReady || refreshing || seekInFlight || sentStep === wantedStep) return;
  seekInFlight = true;
  sentStep = wantedStep;
  frameEl.contentWindow?.postMessage({ type: 'drishya-seek', step: sentStep, requestId: ++requestId }, location.origin);
};
// A fast scroll coalesces to its latest position; it never queues a backlog of React renders.
function seek(step: number) {
  wantedStep = step;
  if (!frameReady || seekQueued || refreshing || seekInFlight || sentStep === wantedStep) return;
  seekQueued = true;
  requestAnimationFrame(pump);
}
// The real app is about 340 KB compressed and takes a long task to start, so it loads as the laptop comes near, or
// earlier while the page is calm (SITE-3: never in the middle of the scroll that is about to reach it).
let frameRequested = false;
const loadFrame = () => { if (frameRequested) return; frameRequested = true; frameEl.src = new URL('demo.html', location.href).pathname; };
new IntersectionObserver(([e], o) => { if (e!.isIntersecting) { loadFrame(); o.disconnect(); } }, { rootMargin: '150% 0px' }).observe(viewport);

// ---------- hero ----------
const toneOf = (o: Op): Tone => o.kind === 'edit' ? 'edit' : o.kind === 'read' ? 'read' : o.outcome === 'failed' ? 'fail' : o.outcome === 'passed' ? 'pass' : 'search';
const heroMap = createMap($<HTMLCanvasElement>('[data-map="hero"]'), null, sample.graph, { scale: 0.5, still: reduced, offsetY: -0.06 });
const dottedGlow = $<HTMLCanvasElement>('[data-dotted-glow]');
mountDots();
// The dotted backdrop is drawn in a worker on an OffscreenCanvas where the browser allows it (SITE-3): its 10,000+ dots
// and the canvas commit were the largest recurring cost on the page's main thread. Without that, it draws on the page.
function mountDots() {
  const setSize = () => { dottedGlow.style.width = `${innerWidth}px`; dottedGlow.style.height = `${innerHeight}px`; };
  setSize();
  let worker: Worker | undefined;
  if (typeof dottedGlow.transferControlToOffscreen === 'function' && typeof Worker === 'function') {
    try { worker = new Worker(new URL('./dots.worker.ts', import.meta.url), { type: 'module' }); } catch { worker = undefined; }
  }
  let target: Dots;
  if (worker) {
    const w = worker, offscreen = dottedGlow.transferControlToOffscreen();
    w.postMessage({ type: 'init', canvas: offscreen, width: innerWidth, height: innerHeight, reduced }, [offscreen]);
    target = {
      resize: (width, height) => w.postMessage({ type: 'resize', width, height }),
      pointer: (x, y) => w.postMessage({ type: 'pointer', x, y }),
      scrolled: () => w.postMessage({ type: 'scroll' }),
      hidden: value => w.postMessage({ type: 'hidden', value }),
      start: () => {},
    };
  } else {
    const context = dottedGlow.getContext('2d');
    if (!context) return;
    target = createDots(dottedGlow, context, size => { const c = document.createElement('canvas'); c.width = c.height = size; return c; }, cb => requestAnimationFrame(cb), reduced);
    target.resize(innerWidth, innerHeight);
    target.start();
  }
  addEventListener('resize', () => { setSize(); target.resize(innerWidth, innerHeight); });
  // The glow follows the pointer at 30 frames a second, so more than one position every 16 ms is wasted.
  let scrollAt = -1, pointerX = -1, pointerY = -1, pointerTimer = 0;
  const sendPointer = () => { pointerTimer = 0; target.pointer(pointerX, pointerY); };
  const queuePointer = (x: number, y: number) => { pointerX = x; pointerY = y; if (!pointerTimer) pointerTimer = window.setTimeout(sendPointer, 16); };
  addEventListener('pointermove', e => queuePointer(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerleave', () => queuePointer(-1, -1), { passive: true });
  addEventListener('scroll', () => { const now = performance.now(); if (now - scrollAt > 40) { scrollAt = now; target.scrolled(); } }, { passive: true });
  addEventListener('visibilitychange', () => target.hidden(document.hidden));
}
// The two agent screens (about 500 elements) and the why section's stream, which repeats the CLI's lines as they scroll past
// in a terminal. They are not needed by the first layout, so they are added after it, in their own task (SITE-3).
let screensMounted = false;
function mountScreens() {
  if (screensMounted) return;
  screensMounted = true;
  stage.insertAdjacentHTML('beforeend', appScreen() + terminalScreen());
  $('[data-why-lines]').innerHTML = Array.from({ length: 3 }, () => $$('.tl', $('[data-screen="cli"]')).map(l => `<div class="${l.classList.contains('r') ? 'r' : ''}">${l.innerHTML}</div>`).join('')).join('');
}

// The page is one replay: keep a quiet chapter marker and backdrop context in sync with the section in view.
const chapterSections = $$<HTMLElement>('[data-chapter]');
const chapterLinks = $$<HTMLAnchorElement>('[data-chapter-link]');
const sectionRatios = new Map<string, number>();
const setActiveChapter = (id: string) => {
  document.documentElement.dataset.section = id;
  for (const link of chapterLinks) {
    const active = link.dataset.chapterLink === id;
    if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
  }
};
setActiveChapter('top');
const chapterObserver = new IntersectionObserver(entries => {
  for (const entry of entries) sectionRatios.set((entry.target as HTMLElement).dataset.chapter!, entry.intersectionRatio);
  const active = [...sectionRatios.entries()].sort((a, b) => b[1] - a[1])[0];
  if (active && active[1] > 0) setActiveChapter(active[0]);
}, { rootMargin: '-35% 0px -35% 0px', threshold: [0, .15, .4, .7, 1] });
for (const section of chapterSections) chapterObserver.observe(section);

const compareRows = $$<HTMLTableRowElement>('[data-compare-row]');
const compareWrap = $<HTMLElement>('.compare > .wrap');
const compareProof = $<HTMLElement>('[data-compare-proof]');
const proofTitle = $<HTMLElement>('[data-proof-title]');
const proofSource = $<HTMLElement>('[data-proof-source]');
const proofState = $<HTMLElement>('[data-proof-state]');
const proofBody = $<HTMLElement>('[data-proof-body]');
const proofExpand = $<HTMLButtonElement>('[data-proof-expand]');
const chapter = (key: string) => sample.chapters.find(c => c.key === key)!;
const readChapter = chapter('read');
const failureChapter = chapter('failure');
const editChapter = chapter('edit');
const graphPaths = sample.graph.nodes.filter(n => n.path.startsWith('src/')).slice(0, 9).map(n => `• ${n.path}`).join('\n');
const subagentOps = sample.operations.filter(o => o.agent === 'Explore sub-agent' || o.kind === 'spawn' || o.kind === 'mcp').slice(0, 7).map(o => `${o.kind.padEnd(6)} ${o.target ?? o.path ?? ''}`).join('\n');
const proofs: Record<string, { title: string; source: string; body: string }> = {
  files: { title: readChapter.title, source: readChapter.provenance, body: readChapter.text },
  output: { title: failureChapter.title, source: failureChapter.provenance, body: failureChapter.text },
  edits: { title: editChapter.title, source: editChapter.provenance, body: editChapter.text },
  location: { title: 'Repository map · working set', source: `Captured graph · ${sample.graph.nodes.length} nodes`, body: graphPaths },
  branches: { title: 'The work stays linked', source: 'Captured session metadata · no PR record in sample', body: `Branch and pull-request records are not included in this sample.\n\nHarnesses: ${sample.harnesses.join(' · ')}\n\nAgents\n${sample.agents.map(a => `• ${a.label} · ${a.model}`).join('\n')}\n\nGraph edges: ${sample.graph.edges.length}` },
  subagents: { title: 'Parallel work stays visible', source: 'Captured operations · agents and tools', body: subagentOps },
  replay: { title: 'Replay the whole session', source: `Captured timeline · ${sample.operations.length} operations`, body: sample.chapters.map(c => `${c.status.padEnd(18)} ${c.title}`).join('\n') },
};
let selectedCompareRow: HTMLTableRowElement | undefined;
let openCompareRow: HTMLTableRowElement | undefined;
let hideCompareTimer = 0;
let showCompareTimer = 0;
let pendingCompareRow: HTMLTableRowElement | undefined;
let activePointerRow: HTMLTableRowElement | undefined;
let pointerInProof = false;
let proofExpansionPinned = false;
let proofExpansionHover = false;
let proofExpansionFocus = false;
const compareHoverIntentDelay = 140;
const compareHideGrace = 180;
const renderProof = (row: HTMLTableRowElement) => {
  const proof = proofs[row.dataset.proof ?? ''] ?? proofs.files!;
  proofTitle.textContent = proof.title;
  proofSource.textContent = proof.source;
  proofState.textContent = `Captured evidence · ${row.querySelector('th')?.textContent ?? 'selected row'}`;
  proofBody.textContent = proof.body;
  compareProof.dataset.proof = row.dataset.proof ?? '';
};
const positionProof = (row: HTMLTableRowElement) => {
  const wrapRect = compareWrap.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const left = Math.max(0, compareWrap.clientWidth - compareProof.offsetWidth);
  const top = Math.max(0, rowRect.bottom - wrapRect.top + 14);
  compareProof.style.left = `${left}px`;
  compareProof.style.top = `${top}px`;
  compareProof.style.setProperty('--transform-origin', `${Math.max(24, Math.min(compareProof.offsetWidth - 24, rowRect.left - wrapRect.left + rowRect.width * .75 - left))}px 0`);
};
const refreshProofExpansion = () => {
  const expanded = proofExpansionPinned || proofExpansionHover || proofExpansionFocus;
  compareProof.classList.toggle('is-expanded', expanded);
  proofExpand.setAttribute('aria-expanded', String(expanded));
  proofExpand.setAttribute('aria-label', expanded ? 'Collapse evidence' : 'Expand evidence');
  if (openCompareRow) {
    const row = openCompareRow;
    requestAnimationFrame(() => { if (openCompareRow === row) positionProof(row); });
  }
};
const showCompareProof = (row: HTMLTableRowElement) => {
  window.clearTimeout(hideCompareTimer);
  window.clearTimeout(showCompareTimer);
  pendingCompareRow = undefined;
  proofExpansionPinned = false;
  proofExpansionHover = false;
  proofExpansionFocus = false;
  openCompareRow = row;
  for (const candidate of compareRows) candidate.setAttribute('aria-expanded', String(candidate === row));
  proofExpand.tabIndex = 0;
  renderProof(row);
  compareProof.classList.add('is-open');
  compareProof.setAttribute('aria-hidden', 'false');
  refreshProofExpansion();
  positionProof(row);
};
const hideCompareProof = () => {
  window.clearTimeout(showCompareTimer);
  pendingCompareRow = undefined;
  proofExpansionPinned = false;
  proofExpansionHover = false;
  proofExpansionFocus = false;
  if (document.activeElement === proofExpand) proofExpand.blur();
  proofExpand.tabIndex = -1;
  for (const candidate of compareRows) candidate.setAttribute('aria-expanded', 'false');
  openCompareRow = undefined;
  compareProof.classList.remove('is-open');
  compareProof.setAttribute('aria-hidden', 'true');
  refreshProofExpansion();
};
const scheduleShowCompareProof = (row: HTMLTableRowElement) => {
  window.clearTimeout(hideCompareTimer);
  window.clearTimeout(showCompareTimer);
  pendingCompareRow = row;
  if (openCompareRow === row) {
    pendingCompareRow = undefined;
    return;
  }
  showCompareTimer = window.setTimeout(() => showCompareProof(row), compareHoverIntentDelay);
};
const queueHideCompareProof = () => {
  window.clearTimeout(hideCompareTimer);
  hideCompareTimer = window.setTimeout(() => {
    if (!activePointerRow && !pointerInProof && !proofExpansionFocus && !proofExpansionPinned) hideCompareProof();
  }, compareHideGrace);
};
const selectCompareRow = (row: HTMLTableRowElement) => {
  selectedCompareRow = row;
  for (const candidate of compareRows) candidate.classList.toggle('is-selected', candidate === row);
  renderProof(row);
};
for (const row of compareRows) {
  row.addEventListener('pointerenter', () => {
    activePointerRow = row;
    scheduleShowCompareProof(row);
  });
  row.addEventListener('pointerleave', () => {
    if (activePointerRow === row) activePointerRow = undefined;
    if (pendingCompareRow === row) {
      window.clearTimeout(showCompareTimer);
      pendingCompareRow = undefined;
    }
    queueHideCompareProof();
  });
  row.addEventListener('focus', () => showCompareProof(row));
  row.addEventListener('blur', queueHideCompareProof);
  row.addEventListener('click', () => { selectCompareRow(row); showCompareProof(row); });
  row.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCompareRow(row); showCompareProof(row); }
  });
}
compareProof.addEventListener('pointerenter', () => {
  pointerInProof = true;
  window.clearTimeout(hideCompareTimer);
  window.clearTimeout(showCompareTimer);
  pendingCompareRow = undefined;
});
compareProof.addEventListener('pointerleave', () => {
  pointerInProof = false;
  queueHideCompareProof();
});
proofExpand.addEventListener('pointerenter', () => {
  proofExpansionHover = true;
  refreshProofExpansion();
});
proofExpand.addEventListener('pointerleave', () => {
  proofExpansionHover = false;
  refreshProofExpansion();
});
proofExpand.addEventListener('focus', () => {
  proofExpansionFocus = true;
  refreshProofExpansion();
});
proofExpand.addEventListener('blur', () => {
  proofExpansionFocus = false;
  refreshProofExpansion();
  queueHideCompareProof();
});
proofExpand.addEventListener('click', () => {
  proofExpansionPinned = !proofExpansionPinned;
  refreshProofExpansion();
});
compareProof.addEventListener('wheel', event => {
  event.preventDefault();
  event.stopPropagation();
  const maxScroll = Math.max(0, proofBody.scrollHeight - proofBody.clientHeight);
  proofBody.scrollTop = Math.max(0, Math.min(maxScroll, proofBody.scrollTop + event.deltaY));
}, { passive: false });
let proofScrollQueued = false;
addEventListener('scroll', () => {
  if (!openCompareRow || proofScrollQueued) return;
  proofScrollQueued = true;
  requestAnimationFrame(() => { proofScrollQueued = false; if (openCompareRow) positionProof(openCompareRow); });
}, { passive: true });
addEventListener('resize', () => { if (openCompareRow) positionProof(openCompareRow); });
if (reduced) {
  mountScreens();
  wantedStep = 45;
  for (const o of sample.operations) heroMap.light(o.path, toneOf(o), false);
  $$('.screen').forEach(el => (el.style.display = 'none'));
  frameEl.src = new URL('demo.html', location.href).pathname;
  $$('.tour-steps li').forEach(li => li.classList.add('on'));
  $$('.feat-steps li').forEach((li, index) => {
    const stills = document.createElement('div'); stills.className = 'feature-stills';
    for (const [frameIndex, frame] of FEATURES[index]!.entries()) {
      const image = document.createElement('img'); image.src = `footage/${frame.img}.jpg`;
      image.alt = `${li.querySelector('h3')!.textContent} · view ${frameIndex + 1} of ${FEATURES[index]!.length}`;
      image.width = 1440; image.height = 900; image.loading = 'lazy'; stills.append(image);
    }
    li.append(stills);
  });
  revealSite();
} else {
  animate();
}

function animate() {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.addEventListener('refreshInit', () => { refreshing = true; });
  // Only a refresh in the middle of the tour needs the laptop to catch up; elsewhere the laptop is out of sight.
  ScrollTrigger.addEventListener('refresh', () => { refreshing = false; if (tourActive()) seek(wantedStep); });
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) a.addEventListener('click', e => { const id = a.getAttribute('href')!; if (id.length > 1) { e.preventDefault(); lenis.scrollTo(id === '#top' ? 0 : id, { offset: 0, duration: 1.4 }); } });

  // One task each for the intro, every scroll scene and the final refresh: a long one holds the first frames of the
  // page. The page stays hidden until all of it is built, and the intro starts only when the page is shown, so none
  // of its opening is spent inside a stall (SITE-3).
  const yieldTask = () => new Promise<void>(resolve => { const c = new MessageChannel(); c.port1.onmessage = () => resolve(); c.port2.postMessage(0); });
  document.fonts.ready.then(async () => {
    const opening = intro();
    await yieldTask();
    mountScreens();
    await yieldTask();
    await scrollScenes();
    ScrollTrigger.refresh();
    revealSite();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      opening.play(0);
      // The laptop's app starts once the intro has played, in an idle moment, not in the middle of a later scroll.
      window.setTimeout(() => { const idle = (window as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback; if (idle) idle.call(window, loadFrame, { timeout: 4000 }); else window.setTimeout(loadFrame, 600); }, 3000);
    }));
  });

  function intro() {
    const ribbons = $$('.hero-mark .ribbon');
    const word = new SplitText('.wordmark', { type: 'chars' });
    return gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .from(ribbons, { rotate: (i: number) => Number(ribbons[i]!.dataset.angle) - 70, scale: 0.35, opacity: 0, transformOrigin: '0 0', duration: 1.5, stagger: 0.07 }, 0)
      .from('.hero-mark .aperture', { attr: { r: 0 }, duration: 1.2, ease: 'power3.out' }, 0.35)
      .from(word.chars, { yPercent: 70, opacity: 0, filter: 'blur(8px)', duration: 1.1, stagger: 0.035 }, 0.5)
      .from('.nav', { y: -16, opacity: 0, duration: 0.8 }, 1.1)
      .to({ p: 0 }, { p: 1, duration: 2, ease: 'power2.out', onUpdate() { heroMap.setReveal(this.targets()[0].p); } }, 0.7);
  }

  async function scrollScenes() {
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
    ScrollTrigger.create({ trigger: '.why', start: 'bottom top', onEnter: () => { heroMap.pause(); }, onLeaveBack: () => { heroMap.resume(); } });
    await yieldTask();

    for (const h of $$('[data-split]')) {
      const s = new SplitText(h, { type: 'lines', mask: 'lines' });
      gsap.from(s.lines, { yPercent: 100, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
      await yieldTask();
    }
    gsap.from('.close-mark .ribbon', { rotate: (_: number, el: HTMLElement) => Number(el.dataset.angle) - 70, scale: 0.4, opacity: 0, transformOrigin: '0 0', duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 70%', once: true } });

    await yieldTask();
    tourScene();
    await yieldTask();
    featureScenes();
  }

  // Features: one window showing the whole real screen. Each step is one frame or a short sequence; a cursor clicks
  // only the control the step is about, and the camera zooms only to that control, then back out.
  // Frames are real Drishya on a real Drishya session (scripts/site-footage-real.ts, reviewed before publishing).
  function featureScenes() {
    const camera = $('[data-feat-camera]'), win = $('[data-feat-window]'), steps = $$('.feat-steps li');
    const cursorEl = $('.feat-cursor', win), ripple = $('.feat-ripple', win);
    const names = [...new Set(FEATURES.flat().map(f => f.img))];
    camera.innerHTML = names.map(n => `<img src="footage/${n}.jpg" alt="" width="1440" height="900" decoding="async" data-frame-name="${n}" />`).join('');
    const loading = document.createElement('p'); loading.className = 'feat-loading'; loading.role = 'status'; loading.textContent = 'Loading demonstration…'; win.append(loading);
    let currentImage = names[0]!;
    const imageByName = new Map([...camera.querySelectorAll<HTMLImageElement>('img')].map(im => [im.dataset.frameName!, im]));
    const framePositions: {time: number; name: string}[] = [];
    const refreshLoading = () => {
      const image = imageByName.get(currentImage)!;
      const failed = image.dataset.failed === 'true';
      loading.textContent = failed ? 'Demonstration image unavailable. Reload to try again.' : 'Loading demonstration…';
      loading.hidden = image.dataset.ready === 'true';
    };
    for (const im of camera.querySelectorAll<HTMLImageElement>('img')) void im.decode().then(() => { im.dataset.ready = 'true'; refreshLoading(); }, () => { im.dataset.failed = 'true'; refreshLoading(); });
    new IntersectionObserver((entries, io) => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); for (const im of camera.querySelectorAll('img')) void im.decode().catch(() => {}); } }, { rootMargin: '200% 0px' }).observe(win);
    const img = (n: string) => $(`[data-frame-name="${n}"]`, camera);
    const W = () => win.clientWidth, H = () => win.clientHeight;
    const zoomTo = (z?: [number, number, number, number]) => { if (!z) return { scale: 1, x: 0, y: 0 }; const [zx, zy, zw, zh] = z, sc = 0.94 / Math.max(zw, zh); return { scale: sc, x: () => (0.5 - (zx + zw / 2) * sc) * W(), y: () => (0.5 - (zy + zh / 2) * sc) * H() }; };
    gsap.set(steps, { autoAlpha: 0, y: 24 }); gsap.set(steps[0]!, { autoAlpha: 1, y: 0 });
    gsap.set(img(FEATURES[0]![0]!.img), { opacity: 1 });
    refreshLoading();
    const sizeFeatures = () => $('.features').style.setProperty('--features-scroll', `${innerHeight * FEATURES.flat().length * 0.55}px`);
    sizeFeatures(); ScrollTrigger.addEventListener('refreshInit', sizeFeatures);
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' }, scrollTrigger: { trigger: '.features', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    let shown = FEATURES[0]![0]!.img, t = 0;
    FEATURES.forEach((frames, i) => {
      if (i > 0) { tl.to(steps[i - 1]!, { autoAlpha: 0, y: -24, duration: 0.3 }, t).to(steps[i]!, { autoAlpha: 1, y: 0, duration: 0.4 }, t + 0.2); }
      frames.forEach((f, j) => {
        // Inside a sequence a click causes the next screen: the cursor clicks on the screen still showing, then it changes.
        const swapAt = j > 0 && f.click ? t + 0.95 : t;
        framePositions.push({time: swapAt, name: f.img});
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
    tl.eventCallback('onUpdate', () => {
      const time = tl.time();
      const next = framePositions.findLast(frame => frame.time <= time)?.name ?? names[0]!;
      if (next !== currentImage) { currentImage = next; refreshLoading(); }
    });
  }

  // The tour: one pinned timeline, scrubbed by scroll, so every step plays forward and rewinds exactly.
  function tourScene() {
    const steps = $$('.tour-steps li'), cli = $('[data-screen="cli"]'), app = $('[data-screen="app"]');
    const progressDots = $$<HTMLElement>('[data-tour-progress] span');
    const lines = $$('.tl', cli), rows = $$('.ap-tool, .ap-reply', app);
    gsap.set(lines, { opacity: 0 });
    gsap.set(rows, { opacity: 0, y: 8 });
    gsap.set(steps, { autoAlpha: 0, y: 24 }); gsap.set(steps[0]!, { autoAlpha: 1, y: 0 });
    const tourEl = $('.tour');
    const sizeTour = () => tourEl.style.setProperty('--tour-pin', `${$('.tour-pin').offsetHeight}px`);
    sizeTour();
    ScrollTrigger.addEventListener('refreshInit', sizeTour);
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: '.tour', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    tourActive = () => { const p = tl.scrollTrigger?.progress ?? 0; return p > 0 && p < 1; };
    tl.eventCallback('onUpdate', () => {
      const current = Math.min(progressDots.length - 1, Math.floor(tl.progress() * progressDots.length));
      progressDots.forEach((dot, index) => dot.classList.toggle('is-current', index === current));
    });
    const show = (i: number, t: number) => tl.to(steps[i - 1]!, { autoAlpha: 0, y: -24, duration: 0.3 }, t).to(steps[i]!, { autoAlpha: 1, y: 0, duration: 0.4 }, t + 0.2);
    const replay = (from: number, to: number, t: number, duration: number) => tl.fromTo({ s: from }, { s: from }, { s: to, duration, ease: 'none', onUpdate() { const n = Math.round(this.targets()[0].s); if (n !== wantedStep) seek(n); } }, t);

    // The laptop is laid out at its full-screen size and shown smaller at rest, so growing never upscales pixels.
    // At rest it sits in the right-hand column; while the three screens play it fills the screen.
    const wide = () => matchMedia('(min-width: 900px)').matches;
    const laptop = $('.laptop'), lid = $('.laptop-lid'), screen = $('.laptop-screen'), hinge = $('.laptop-hinge-shadow'), base = $('.laptop-base'), caption = $('.tour-steps'), slot = $('.laptop-slot');
    // Measured against the pin, not the viewport, so the resting place is the same at any scroll position (and on refresh).
    const pin = $('.tour-pin');
    const rest = () => { if (!wide()) return { scale: 1, x: 0, y: 0 }; const r = slot.getBoundingClientRect(), p = pin.getBoundingClientRect(), full = laptop.offsetWidth; return { scale: r.width / (full * 1.12), x: r.left + r.width / 2 - (p.left + p.width / 2), y: r.top + r.height / 2 - (p.top + p.height / 2) }; };
    // Keep a readable annotation rail beside the laptop while the pinned scene expands.
    // On narrower desktop windows, shift the laptop right and scale it just enough to preserve the rail.
    const activeLaptop = () => {
      if (!wide()) return { scale: 1, x: 0, y: 0 };
      const full = laptop.offsetWidth;
      const rail = caption.offsetWidth + 40;
      const scale = Math.min(1, (pin.clientWidth - rail - 48) / (full * 1.12));
      return { scale, x: rail / 2, y: 0 };
    };
    const captionLeft = () => { let left = 0; for (let node: HTMLElement | null = caption; node && node !== pin; node = node.offsetParent as HTMLElement | null) left += node.offsetLeft; return left; };
    ScrollTrigger.addEventListener('refreshInit', () => gsap.set(laptop, { yPercent: wide() ? -50 : 0 }));
    // Centred vertically by GSAP's yPercent, so the scroll tweens own only the pixel offsets.
    gsap.set(lid, { transformOrigin: '50% 100%', rotateX: -78 });
    gsap.set(screen, { opacity: .18 });
    gsap.set(hinge, { scaleX: .64, opacity: .42, transformOrigin: '50% 50%' });
    gsap.set(base, { y: 8, scaleX: .98, transformOrigin: '50% 0' });
    gsap.set(laptop, { transformPerspective: 1200, rotateY: -2.5, rotateX: 1.1 });
    gsap.set(laptop, { yPercent: () => wide() ? -50 : 0, scale: () => rest().scale, x: () => rest().x, y: () => rest().y });
    tl.fromTo(laptop, { scale: () => rest().scale, x: () => rest().x, y: () => rest().y }, { scale: () => activeLaptop().scale, x: () => activeLaptop().x, y: () => activeLaptop().y, duration: 0.6, ease: 'power3.inOut', immediateRender: false }, 0);
    tl.to(caption, { x: () => wide() ? -Math.max(0, captionLeft() - 24) : 0, scale: () => wide() ? 0.9 : 1, transformOrigin: '0 50%', duration: 0.6, ease: 'power3.inOut' }, 0);
    tl.to(lid, { rotateX: 0, duration: .5, ease: 'power4.out' }, 0);
    tl.to(base, { y: 0, scaleX: 1, duration: .5, ease: 'power3.out' }, .08);
    tl.to(hinge, { scaleX: 1, opacity: 1, duration: .4, ease: 'power2.out' }, .08);
    tl.to(screen, { opacity: 1, duration: .28, ease: 'power2.out' }, .3);
    tl.to(laptop, { rotateY: 0, rotateX: 0, duration: .62, ease: 'power3.out' }, .12);
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
    { tl.to(laptop, { scale: () => rest().scale, x: () => rest().x, y: () => rest().y, duration: 0.6, ease: 'power3.inOut' }, 10.2); tl.to(caption, { scale: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.inOut' }, 10.2); }
    tl.to({}, { duration: 0.3 }, 10.8);
  }
}
