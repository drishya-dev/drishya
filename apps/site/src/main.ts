import './site.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import sample from './generated/sample.json';
import { mountLogos } from './logo.ts';
import { createMap, type RepoMap, type Tone } from './map.ts';

// One place for what SHIP-9 decides at release: the install command and the public repository.
const SITE = { install: 'npx drishya', repo: 'https://github.com/drishya-dev/drishya' };

gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = document.documentElement.dataset.motion === 'reduced';
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
type Chapter = (typeof sample.chapters)[number];
type Op = (typeof sample.operations)[number];

// ---------- static content from the sample ----------
mountLogos();
for (const a of $$<HTMLAnchorElement>('[data-repo-link]')) { a.href = SITE.repo; a.rel = 'noopener'; }
for (const el of $$('[data-install-command]')) el.textContent = SITE.install;
$('[data-sample-title]').textContent = sample.title;

for (const b of $$<HTMLButtonElement>('[data-copy]')) {
  const label = b.textContent;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(SITE.install); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => (b.textContent = label), 1600);
  });
}

const verb: Record<string, string> = { read: 'Read', search: 'Searched', edit: 'Edited', test: 'Ran', shell: 'Ran', mcp: 'Asked', spawn: 'Started' };
const toneOf = (o: Op): Tone => o.kind === 'edit' ? 'edit' : o.kind === 'read' ? 'read' : o.outcome === 'failed' ? 'fail' : o.outcome === 'passed' ? 'pass' : 'search';
const kindLabel: Record<string, string> = { read: 'Read', search: 'Search', edit: 'Edit', test: 'Test', shell: 'Shell', mcp: 'MCP', spawn: 'Agent' };

function codeLines(c: Chapter) {
  return c.text.split('\n').slice(0, 22).map((line, i) => {
    const tone = c.kind === 'edit' ? (line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : '') : /\bfail|✗|×|FAIL/i.test(line) ? 'del' : /\bpass|✓/i.test(line) ? 'add' : '';
    return `<span class="ln ${tone}"><i>${i + 1}</i>${esc(line) || ' '}</span>`;
  }).join('');
}
// The file a test chapter points at, only when its own captured output names it.
const testedFile = (c: Chapter) => sample.graph.nodes.map(n => n.path).find(p => p.startsWith('test/') && c.text.includes(p.split('/').pop()!));

const cardsEl = $('[data-cards]'), stepsEl = $('[data-steps]');
cardsEl.innerHTML = sample.chapters.map((c, i) => `
  <article class="card" data-card="${i}" data-kind="${c.kind}">
    <header><span class="chip ${c.key === 'failure' ? 'fail' : c.key === 'retest' ? 'pass' : c.kind}">${esc(c.short)}</span><span class="card-path">${esc(c.path ?? c.command)}</span><span class="status ${c.key === 'failure' ? 'fail' : c.key === 'retest' ? 'pass' : ''}">${esc(c.status)}</span></header>
    <h3>${esc(c.title)}</h3>
    <pre class="code">${codeLines(c)}</pre>
    <p class="provenance">${esc(c.provenance)}</p>
  </article>`).join('');
stepsEl.innerHTML = sample.chapters.map((c, i) => `<li data-step="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(c.title)}</li>`).join('');

// Feature cards: each fragment is drawn from the same synthetic sample, never a mock-up.
const files = new Map<string, Set<string>>();
for (const o of sample.operations) if (o.path) files.set(o.path, new Set([...(files.get(o.path) ?? []), o.kind]));
const editChapter = sample.chapters.find(c => c.kind === 'edit')!, failure = sample.chapters.find(c => c.key === 'failure')!, retest = sample.chapters.find(c => c.key === 'retest')!;
const max = Math.max(...Object.values(sample.counts));
const tools = [
  ['Follows every action in order', 'Each read, search, test and edit as it happened, with its result.',
    `<ul class="mini-history">${sample.operations.slice(0, 7).map(o => `<li><span class="chip ${o.kind}">${kindLabel[o.kind]}</span><span>${esc(o.target)}</span>${o.outcome ? `<b class="${o.outcome === 'failed' ? 'fail' : 'pass'}">${o.outcome}</b>` : ''}</li>`).join('')}</ul>`],
  ['Shows each file and its changes', 'Files the agent read or edited are marked in your own tree.',
    `<ul class="mini-tree">${sample.graph.nodes.slice(0, 9).map(n => { const k = files.get(n.path); return `<li style="--depth:${n.path.split('/').length - 1}"><span>${esc(n.path.split('/').pop())}</span>${k?.has('edit') ? '<b class="edit">E</b>' : k?.has('read') ? '<b class="read">R</b>' : ''}</li>`; }).join('')}</ul>`],
  ['Keeps the exact diff', 'The change as the agent wrote it, before any later edit.',
    `<pre class="code small">${codeLines(editChapter)}</pre>`],
  ['Shows the test run, not a summary', 'The failing output, then the next run, as captured.',
    `<div class="mini-tests"><div><span class="chip fail">npm test</span><b class="fail">${esc(failure.status)}</b></div><div><span class="chip pass">npm test</span><b class="pass">${esc(retest.status)}</b></div></div>`],
  ['Counts every tool the agent used', 'Built-in tools and MCP servers, from one session or many.',
    `<ul class="mini-bars">${Object.entries(sample.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${kindLabel[k] ?? k}</span><i style="--w:${(v / max) * 100}%"></i><b>${v}</b></li>`).join('')}</ul>`],
  ['Tracks sub-agents separately', 'Work a sub-agent did stays with that agent.',
    `<ul class="mini-agents">${sample.agents.map((a, i) => `<li class="${a.parent ? 'child' : ''}"><i class="agent-dot ${i === 2 ? 'codex' : ''}"></i>${esc(a.label)}<span>${i === 2 ? 'Codex' : 'Claude Code'}</span></li>`).join('')}</ul>`],
];
$('[data-tools]').innerHTML = tools.map(([title, body, fragment]) => `<article class="tool"><div class="tool-visual">${fragment}</div><h3>${title}</h3><p>${body}</p></article>`).join('');

// ---------- maps ----------
const heroMap = createMap($<HTMLCanvasElement>('[data-map="hero"]'), $('[data-map-labels="hero"]'), sample.graph, { scale: 0.5, still: reduced, offsetY: -0.06 });
const replayMap = createMap($<HTMLCanvasElement>('[data-map="replay"]'), $('[data-map-labels="replay"]'), sample.graph, { scale: 0.7, still: reduced });

// ---------- reduced motion: composed still frames, everything visible ----------
if (reduced) {
  for (const o of sample.operations) heroMap.light(o.path, toneOf(o), false);
  sample.chapters.forEach((c, i) => { replayMap.light(c.path ?? testedFile(c), c.key === 'failure' ? 'fail' : c.key === 'retest' ? 'pass' : c.kind === 'edit' ? 'edit' : 'read'); stepsEl.children[i]?.classList.add('done'); });
  $('[data-ticker]').textContent = `${sample.operations.length} recorded actions in this sample`;
} else {
  animate();
}

function animate() {
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) a.addEventListener('click', e => { const id = a.getAttribute('href')!; if (id.length > 1) { e.preventDefault(); lenis.scrollTo(id === '#top' ? 0 : id, { offset: -64 }); } });

  document.fonts.ready.then(() => {
    intro();
    scrollScenes();
    ScrollTrigger.refresh();
  });

  function intro() {
    const ribbons = $$('.hero-mark .ribbon');
    const word = new SplitText('.wordmark', { type: 'chars' }), title = new SplitText('#hero-title', { type: 'lines', mask: 'lines' });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(ribbons, { rotate: (i: number) => Number(ribbons[i]!.dataset.angle) - 70, scale: 0.35, opacity: 0, transformOrigin: '0 0', duration: 1.5, stagger: 0.07 }, 0)
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
    const ticker = $('[data-ticker]');
    const tl = gsap.timeline();
    sample.operations.forEach((o, i) => {
      tl.call(() => {
        ticker.innerHTML = `<span class="chip ${o.kind}">${kindLabel[o.kind]}</span>${esc(verb[o.kind])} ${esc(o.target)}${o.outcome ? ` · <b class="${o.outcome === 'failed' ? 'fail' : 'pass'}">${o.outcome}</b>` : ''}<span class="ticker-agent">${esc(o.agent)} · ${esc(o.harness)}</span>`;
        gsap.fromTo(ticker, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
        heroMap.light(o.path, toneOf(o), i < 6 || o.kind === 'edit');
      }, [], i * 0.62);
    });
    tl.call(() => { ticker.innerHTML = `${sample.operations.length} recorded actions · ${sample.harnesses.join(' and ')} · <b class="pass">${esc(retest.status)}</b>`; gsap.fromTo(ticker, { opacity: 0 }, { opacity: 1, duration: 0.5 }); }, [], sample.operations.length * 0.62 + 0.3);
  }

  function scrollScenes() {
    // Leaving the hero: the mark recedes and the map turns with the scroll.
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
      .to('.hero-inner', { y: -80, opacity: 0.15, ease: 'none' }, 0)
      .to('.hero-mark', { scale: 0.7, ease: 'none' }, 0)
      .to({ a: 0.6 }, { a: 1.6, ease: 'none', onUpdate() { heroMap.setAngle(this.targets()[0].a); } }, 0);

    // Why: the paragraph resolves word by word while the section holds still.
    const words = new SplitText('[data-words]', { type: 'words' });
    gsap.set(words.words, { opacity: 0.14 });
    gsap.timeline({ scrollTrigger: { trigger: '.why', start: 'top top', end: '+=140%', pin: '.why-pin', scrub: 0.6 } })
      .to(words.words, { opacity: 1, stagger: 0.05, ease: 'none' });

    // Section headings rise in once, line by line, when they first come into view.
    for (const h of $$('[data-split]').filter(h => h.id !== 'hero-title')) {
      const s = new SplitText(h, { type: 'lines', mask: 'lines' });
      gsap.from(s.lines, { yPercent: 100, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
    }
    gsap.from('.close-mark .ribbon', { rotate: (i: number, el: HTMLElement) => Number(el.dataset.angle) - 70, scale: 0.4, opacity: 0, transformOrigin: '0 0', duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 70%', once: true } });

    replayScene();
  }

  // The signature scene: the four chapters emit from the map one by one, earlier ones settle back, the outcome resolves.
  // Scroll drives it both ways, so scrolling back rewinds it exactly.
  function replayScene() {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const cards = $$('[data-card]'), stepWord = $('[data-step-word]'), n = cards.length;
      gsap.set(cards, { autoAlpha: 0, xPercent: -18, scale: 0.92, filter: 'blur(6px)' });
      replayMap.setReveal(1);
      let shown = -1;
      const show = (i: number) => {
        if (i === shown) return; shown = i;
        replayMap.clear();
        sample.chapters.slice(0, i + 1).forEach((c, k) => replayMap.light(c.path ?? testedFile(c), c.key === 'failure' ? 'fail' : c.key === 'retest' ? 'pass' : c.kind === 'edit' ? 'edit' : 'read', k === i));
        $$('[data-step]').forEach((li, k) => { li.classList.toggle('active', k === i); li.classList.toggle('done', k < i); });
        if (i >= 0) gsap.fromTo(stepWord, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out', overwrite: true, onStart: () => { stepWord.textContent = sample.chapters[i]!.short; } });
      };
      const tl = gsap.timeline({ scrollTrigger: { trigger: '.replay', start: 'top top', end: () => `+=${innerHeight * 3.2}`, pin: '.replay-pin', scrub: 0.7, onUpdate: s => show(Math.min(n - 1, Math.floor(s.progress * n * 0.999))) } });
      cards.forEach((card, i) => {
        tl.to(card, { autoAlpha: 1, xPercent: 0, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out' }, i);
        cards.slice(0, i).forEach((prev, k) => tl.to(prev, { y: -26 * (i - k), scale: 1 - 0.05 * (i - k), autoAlpha: i - k > 2 ? 0 : 0.42 / (i - k), filter: 'blur(1.5px)', duration: 0.6, ease: 'power3.out' }, i));
        tl.to({}, { duration: 0.4 }, i + 0.6);
      });
      show(0);
      return () => { gsap.set(cards, { clearProps: 'all' }); replayMap.clear(); };
    });
    mm.add('(max-width: 899px)', () => {
      replayMap.setReveal(1);
      sample.chapters.forEach(c => replayMap.light(c.path ?? testedFile(c), c.key === 'failure' ? 'fail' : c.key === 'retest' ? 'pass' : c.kind === 'edit' ? 'edit' : 'read', false));
    });
  }
}
