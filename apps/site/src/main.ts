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
const dottedGlow = $<HTMLCanvasElement>('[data-dotted-glow]');
const dottedContext = dottedGlow.getContext('2d');
if (dottedContext) {
  const gap = 12;
  const radius = 2;
  const glowRadius = 150;
  let dots: { x: number; y: number; phase: number; speed: number }[] = [];
  let width = 0;
  let height = 0;
  let pointerX = -1;
  let pointerY = -1;
  let dotsFrame = 0;
  const resizeDots = () => {
    const dpr = Math.min(Math.max(1, devicePixelRatio || 1), 2);
    width = innerWidth;
    height = innerHeight;
    dottedGlow.width = Math.floor(width * dpr);
    dottedGlow.height = Math.floor(height * dpr);
    dottedGlow.style.width = `${width}px`;
    dottedGlow.style.height = `${height}px`;
    dottedContext.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  };
  const updatePointer = (event: PointerEvent) => { pointerX = event.clientX; pointerY = event.clientY; };
  const clearPointer = () => { pointerX = -1; pointerY = -1; };
  const drawDots = (now: number) => {
    dottedContext.clearRect(0, 0, width, height);
    dottedContext.fillStyle = 'rgba(241, 238, 228, .3)';
    const time = now / 1000;
    for (const dot of dots) {
      const wave = (time * dot.speed + dot.phase) % (Math.PI * 2);
      const pulse = .25 + .55 * ((Math.sin(wave) + 1) / 2);
      const distance = pointerX < 0 ? Infinity : Math.hypot(dot.x - pointerX, dot.y - pointerY);
      const hover = Math.max(0, 1 - distance / glowRadius);
      const brightness = Math.min(1, pulse + hover * .7);
      dottedContext.globalAlpha = brightness * .7;
      dottedContext.shadowColor = 'rgba(0, 170, 255, .85)';
      dottedContext.shadowBlur = hover > 0 ? 12 * hover : brightness > .62 ? 6 * (brightness - .62) / .38 : 0;
      dottedContext.beginPath();
      dottedContext.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      dottedContext.fill();
    }
    dottedContext.globalAlpha = 1;
    dottedContext.shadowBlur = 0;
    dotsFrame = 0;
    if (!reduced && !document.hidden) dotsFrame = requestAnimationFrame(drawDots);
  };
  resizeDots();
  addEventListener('resize', resizeDots);
  addEventListener('pointermove', updatePointer, { passive: true });
  addEventListener('pointerleave', clearPointer, { passive: true });
  addEventListener('visibilitychange', () => {
    if (!document.hidden && !dotsFrame) dotsFrame = requestAnimationFrame(drawDots);
  });
  dotsFrame = requestAnimationFrame(drawDots);
}
// The why section's stream: the same CLI lines the laptop shows, scrolling past as they do in a terminal.
$('[data-why-lines]').innerHTML = Array.from({ length: 3 }, () => $$('.tl', $('[data-screen="cli"]')).map(l => `<div class="${l.classList.contains('r') ? 'r' : ''}">${l.innerHTML}</div>`).join('')).join('');
const compareRows = $$<HTMLTableRowElement>('[data-compare-row]');
const compareWrap = $<HTMLElement>('.compare > .wrap');
const compareProof = $<HTMLElement>('[data-compare-proof]');
const proofTitle = $<HTMLElement>('[data-proof-title]');
const proofSource = $<HTMLElement>('[data-proof-source]');
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
let selectedCompareRow = compareRows[0];
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
addEventListener('scroll', () => { if (openCompareRow) positionProof(openCompareRow); }, { passive: true });
addEventListener('resize', () => { if (openCompareRow) positionProof(openCompareRow); });
if (selectedCompareRow) selectCompareRow(selectedCompareRow);
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
    const word = new SplitText('.wordmark', { type: 'chars' });
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from(ribbons, { rotate: (i: number) => Number(ribbons[i]!.dataset.angle) - 70, scale: 0.35, opacity: 0, transformOrigin: '0 0', duration: 1.5, stagger: 0.07 }, 0)
      .from('.hero-mark .aperture', { attr: { r: 0 }, duration: 1.2, ease: 'power3.out' }, 0.35)
      .from(word.chars, { yPercent: 70, opacity: 0, filter: 'blur(8px)', duration: 1.1, stagger: 0.035 }, 0.5)
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
    ScrollTrigger.create({ trigger: '.why', start: 'bottom top', onEnter: () => { heroMap.pause(); }, onLeaveBack: () => { heroMap.resume(); } });

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
    const laptop = $('.laptop'), lid = $('.laptop-lid'), screen = $('.laptop-screen'), base = $('.laptop-base'), caption = $('.tour-steps'), slot = $('.laptop-slot');
    // Measured against the pin, not the viewport, so the resting place is the same at any scroll position (and on refresh).
    const pin = $('.tour-pin');
    const rest = () => { const r = slot.getBoundingClientRect(), p = pin.getBoundingClientRect(), full = laptop.offsetWidth; return { scale: r.width / full, x: r.left + r.width / 2 - (p.left + p.width / 2), y: r.top + r.height / 2 - (p.top + p.height / 2) }; };
    // Keep a readable annotation rail beside the laptop while the pinned scene expands.
    // On narrower desktop windows, shift the laptop right and scale it just enough to preserve the rail.
    const activeLaptop = () => {
      const full = laptop.offsetWidth;
      const rail = caption.offsetWidth + 40;
      const scale = Math.min(1, Math.max(.62, (pin.clientWidth - rail) / full));
      const centeredLeft = (pin.clientWidth - full * scale) / 2;
      return { scale, x: Math.max(0, rail - centeredLeft), y: 0 };
    };
    // Centred vertically by GSAP's yPercent, so the scroll tweens own only the pixel offsets.
    gsap.set(lid, { transformOrigin: '50% 100%', rotateX: -78 });
    gsap.set(screen, { opacity: .18 });
    gsap.set(base, { y: 8, scaleX: .98, transformOrigin: '50% 0' });
    if (wide) gsap.set(laptop, { yPercent: -50, scale: () => rest().scale, x: () => rest().x, y: () => rest().y });
    if (wide) tl.fromTo(laptop, { scale: () => rest().scale, x: () => rest().x, y: () => rest().y }, { scale: () => activeLaptop().scale, x: () => activeLaptop().x, y: () => activeLaptop().y, duration: 0.6, ease: 'power3.inOut', immediateRender: false }, 0);
    if (wide) tl.to(caption, { x: () => -Math.max(0, caption.getBoundingClientRect().left - 24), scale: 0.9, transformOrigin: '0 50%', duration: 0.6, ease: 'power3.inOut' }, 0);
    tl.to(lid, { rotateX: 0, duration: .5, ease: 'power4.out' }, 0);
    tl.to(base, { y: 0, scaleX: 1, duration: .5, ease: 'power3.out' }, .08);
    tl.to(screen, { opacity: 1, duration: .28, ease: 'power2.out' }, .3);
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
