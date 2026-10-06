import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { choreographyBetween, frameOf } from '../lib/choreography.ts';
import { useApp } from '../state.ts';

const NS = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(.16,1,.3,1)';

/** Material shells move from measured origins; characters stay selectable in their final DOM. */
export function Origins({ scene, projection, stagedArrival = false, isProgrammaticScroll }: { scene: Scene; projection: Projection; stagedArrival?: boolean; isProgrammaticScroll?: () => boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  // Scene revisions are faster than an arrival. Own finite animations across renders,
  // rather than cancelling them whenever capture or a passive hover updates React.
  const runningMotion = useRef(new Map<Animation, { element: SVGElement; target?: Element; rect?: DOMRect }>());
  const materialReady = useRef(new Map<string, boolean>());
  const liveMaterials = useRef(new Set<string>());
  const cancelMotion = () => {
    for (const [animation, cue] of runningMotion.current) { animation.cancel(); cue.element.remove(); }
    runningMotion.current.clear();
  };
  const previous = useRef(frameOf(scene));
  const motion = useApp((s) => s.motion);
  const theme = useApp((s) => s.theme);
  const compareAgents = useApp((s) => s.compareAgents);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const filePanel = useApp((s) => s.filePanel);
  const hoveredOp = useApp((s) => s.hoveredOp);
  const selectedOp = useApp((s) => s.selectedOp);
  const mapVisible = useApp((s) => s.mapVisible);
  const explore = useApp((s) => s.explore);
  const follow = useApp((s) => s.follow);
  const paged = useApp((s) => !!s.historyPage);
  const recordingId = useApp((s) => s.recordingId);
  const source = useApp((s) => s.source);
  const mode = useApp((s) => s.mode);

  useLayoutEffect(() => { previous.current = frameOf(scene); materialReady.current.clear(); liveMaterials.current.clear(); }, [recordingId, source]);

  useLayoutEffect(() => {
    cancelMotion();
    return cancelMotion;
  }, [recordingId, source, theme, mapVisible, explore, motion, follow, compareAgents, settingsOpen, filePanel, mode]);

  useLayoutEffect(() => {
    const root = svg.current;
    const viewer = document.querySelector('.viewer');
    const history = viewer?.querySelector('.history');
    const plan = choreographyBetween(previous.current, scene, projection, paged ? Math.max(0, scene.step - projection.timeline.length) : 0);
    if (!root || !viewer || !history || explore || settingsOpen || filePanel) { previous.current = frameOf(scene); return; }
    // Seed pending mounts before their fetch can finish, rather than waiting two
    // paint frames and occasionally missing the false → ready transition.
    for (const article of history.querySelectorAll<HTMLElement>('article.op-read[data-op-id]')) {
      const id = article.dataset.opId!;
      if (!materialReady.current.has(id)) materialReady.current.set(id, !!article.querySelector('.read-preview'));
    }
    const emitted = new Set<string>();
    for (const id of [...plan.arrivals, ...plan.outcomes]) liveMaterials.current.add(id);
    while (liveMaterials.current.size > 96) liveMaterials.current.delete(liveMaterials.current.values().next().value!);
    let motionTarget: Element | undefined;
    let raf = 0;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animate = motion && (follow || stagedArrival) && !document.hidden && !preference.matches;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const v = history.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > v.top && r.top < v.bottom && r.right > v.left && r.left < v.right;
    };
    const node = (tag: 'path' | 'rect' | 'g' | 'circle', cls: string, move?: string) => {
      const el = document.createElementNS(NS, tag);
      el.setAttribute('class', cls);
      if (move) el.setAttribute('data-move', move);
      root.append(el);
      return el;
    };
    const play = (el: SVGElement, frames: Keyframe[], duration: number, easing = EASE) => {
      // Bursts stay bounded even when the next capture lands before earlier cues finish.
      while (runningMotion.current.size >= 36) {
        const oldest = runningMotion.current.entries().next().value;
        if (!oldest) break;
        oldest[0].cancel(); oldest[1].element.remove(); runningMotion.current.delete(oldest[0]);
      }
      // Readable material arrival, not an icon race. Large reading spaces unfold longer;
      // evidence is already mounted and no capture or presentation queue waits for this.
      const area = motionTarget?.getBoundingClientRect();
      const scale = area ? Math.min(2.1, 1.6 + Math.min(1, area.width * Math.min(area.height, 420) / 240_000) * .5) : 1.6;
      const animation = el.animate(frames, { duration: Math.round(duration * scale), easing, fill: 'forwards' });
      runningMotion.current.set(animation, { element: el, target: motionTarget, rect: motionTarget?.getBoundingClientRect() });
      const release = () => { runningMotion.current.delete(animation); el.remove(); };
      void animation.finished.then(release, release);
    };
    const palette = getComputedStyle(viewer);
    const colour = (token: string) => palette.getPropertyValue(token).trim();
    const contour = (el: Element, move: string, tone?: string) => {
      const material = el.closest<HTMLElement>('[data-material]')?.dataset.material;
      // Animate the material's own reading edge, rather than flying the same empty
      // rectangle around every action. Every character stays at its final position.
      const content = el.matches('.op') ? el.querySelector('.verification-track, .cmd, .query, .code, .diff, .mcp-tool') ?? el : el;
      const r = content.getBoundingClientRect();
      const end = Math.min(r.bottom, r.top + 420);
      const edge = node('path', 'origin-shell', move);
      const rail = material === 'source' || material === 'change' || material === 'external';
      edge.setAttribute('d', rail ? `M${r.left + 10},${r.top} H${r.left} V${end} H${r.left + 10}` : `M${r.left},${end} H${r.right}`);
      edge.style.stroke = tone ?? (getComputedStyle(el).getPropertyValue('--material').trim() || colour('--focus'));
      return edge;
    };
    const materialArrival = (target: Element, origin: DOMRect, move: string, fromRight: boolean) => {
      const r = target.getBoundingClientRect();
      const plate = node('rect', 'origin-material', move);
      plate.setAttribute('x', String(r.left)); plate.setAttribute('y', String(r.top));
      plate.setAttribute('width', String(r.width)); plate.setAttribute('height', String(Math.min(r.height, 420)));
      plate.setAttribute('rx', '9');
      plate.style.stroke = getComputedStyle(target).getPropertyValue('--material').trim() || colour('--focus');
      // The empty backing carries the allocated material shape, never a second copy
      // of captured text. Its small origin footprint expands to the measured reading space.
      plate.style.transformOrigin = `${r.left}px ${r.top}px`;
      const x = fromRight ? origin.left : origin.left + origin.width / 2;
      const y = origin.top + origin.height / 2;
      play(plate, [
        { transform: `translate(${x - r.left}px,${y - r.top}px) scale(.08,.04)`, opacity: .7 },
        { transform: `translate(${(x - r.left) * .22}px,${(y - r.top) * .22}px) scale(.78,.14)`, opacity: .6, offset: .42 },
        { transform: 'none', opacity: .4, offset: .86 },
        { transform: 'none', opacity: 0 },
      ], 620, 'cubic-bezier(.4,0,.2,1)');
      const edge = contour(target, move);
      play(edge, [{ opacity: 0 }, { opacity: .8, offset: .6 }, { opacity: 0 }], 680);
    };
    const toolTransfer = (origin: Element, target: Element, label: string, tone: string) => {
      const source = origin.querySelector<SVGSVGElement>('.material-glyph');
      const destination = target.querySelector<SVGSVGElement>('.op-head > .material-glyph');
      if (!source || !destination || !visible(destination)) return;
      const a = source.getBoundingClientRect();
      const b = destination.getBoundingClientRect();
      if (!a.width || !a.height || !b.width || !b.height) return;
      const pane = origin.closest('.dock')?.getBoundingClientRect();
      const viewport = history.getBoundingClientRect();
      const sourceHit = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
      const targetHit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (!pane || a.top < pane.top || a.bottom > pane.bottom || b.top < viewport.top || b.bottom > viewport.bottom || !sourceHit || !origin.contains(sourceHit) || !targetHit || !target.contains(targetHit)) return;
      const x1 = a.left + a.width / 2; const y1 = a.top + a.height / 2;
      const x2 = b.left + b.width / 2; const y2 = b.top + b.height / 2;
      const bend = Math.min(120, Math.abs(x1 - x2) / 3);
      const route = document.createElementNS(NS, 'path');
      route.setAttribute('d', `M${x1},${y1} C${x1 - bend},${y1} ${x2 + bend},${y2} ${x2},${y2}`);
      const mark = node('g', 'origin-tool-transfer', 'Emit');
      mark.setAttribute('data-origin-type', label);
      mark.setAttribute('data-source-x', String(x1)); mark.setAttribute('data-source-y', String(y1));
      mark.setAttribute('data-target-x', String(x2)); mark.setAttribute('data-target-y', String(y2));
      mark.style.color = tone;
      const backing = document.createElementNS(NS, 'rect');
      backing.setAttribute('x', '-13'); backing.setAttribute('y', '-13');
      backing.setAttribute('width', '26'); backing.setAttribute('height', '26'); backing.setAttribute('rx', '5');
      mark.append(backing);
      // Transfer only our instrument silhouette, never tool text or captured content.
      const glyph = source.cloneNode(true) as SVGSVGElement;
      glyph.removeAttribute('class');
      glyph.setAttribute('x', '-8'); glyph.setAttribute('y', '-8');
      glyph.setAttribute('width', '16'); glyph.setAttribute('height', '16');
      mark.append(glyph);
      const length = route.getTotalLength();
      const frames = Array.from({ length: 9 }, (_, i): Keyframe => {
        const point = route.getPointAtLength(length * i / 8);
        return { transform: `translate(${point.x}px,${point.y}px)`, opacity: i === 8 ? 0 : i === 0 ? .65 : .9, offset: i / 8 };
      });
      // A travel curve reserves time for the relationship, rather than landing in
      // the first frames like the material's faster expansion curve.
      const materialTarget = motionTarget;
      motionTarget = destination;
      play(mark, frames, 620, 'cubic-bezier(.4,0,.2,1)');
      motionTarget = materialTarget;
    };
    // A read's file lifts out of its measured origin (map node or working-set row) as a plain
    // document silhouette, rises, then travels into the action's header glyph. No path text or
    // captured content travels; the excerpt is already stationary in its final DOM.
    const fileTransfer = (origin: Element, target: Element, label: string, tone: string) => {
      const destination = target.querySelector<SVGSVGElement>('.op-head > .material-glyph');
      if (!destination || !visible(destination)) return;
      const a = origin.getBoundingClientRect();
      const b = destination.getBoundingClientRect();
      if (!a.width || !a.height || !b.width || !b.height) return;
      const x1 = a.left + Math.min(a.width / 2, 14); const y1 = a.top + a.height / 2;
      const x2 = b.left + b.width / 2; const y2 = b.top + b.height / 2;
      const rise = Math.min(28, Math.max(12, a.height));
      const route = document.createElementNS(NS, 'path');
      route.setAttribute('d', `M${x1},${y1 - rise} C${x1 + Math.abs(x2 - x1) / 2},${y1 - rise} ${x2 - 60},${y2} ${x2},${y2}`);
      const mark = node('g', 'origin-file-transfer', 'Lift');
      mark.setAttribute('data-origin-type', label);
      mark.style.color = tone;
      const sheet = document.createElementNS(NS, 'path');
      sheet.setAttribute('d', 'M-7,-9 H3 L8,-4 V9 H-7 Z');
      const fold = document.createElementNS(NS, 'path');
      fold.setAttribute('d', 'M3,-9 V-4 H8 M-4,0 H5 M-4,4 H3');
      mark.append(sheet, fold);
      const length = route.getTotalLength();
      const frames: Keyframe[] = [
        { transform: `translate(${x1}px,${y1}px) scale(.55)`, opacity: 0, offset: 0 },
        { transform: `translate(${x1}px,${y1 - rise}px) scale(1.15)`, opacity: 1, offset: .22 },
        ...Array.from({ length: 6 }, (_, i): Keyframe => {
          const point = route.getPointAtLength(length * (i + 1) / 6);
          return { transform: `translate(${point.x}px,${point.y}px) scale(${1.15 - (i + 1) * .05})`, opacity: i === 5 ? 0 : .95, offset: .22 + (i + 1) * .13 };
        }),
      ];
      const materialTarget = motionTarget;
      motionTarget = destination;
      play(mark, frames, 700, 'cubic-bezier(.4,0,.2,1)');
      motionTarget = materialTarget;
    };
    const tether = (origin: Element, target: Element, label: string, move?: string, fromRight = false, materialOnly = false) => {
      const a = origin.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x1 = fromRight ? a.left : a.left + a.width / 2;
      const y1 = a.top + a.height / 2;
      const x2 = fromRight ? b.right : b.left;
      const y2 = b.top + Math.min(18, b.height / 2);
      const bend = Math.min(90, Math.abs(x2 - x1) / 2);
      const sign = fromRight ? -1 : 1;
      const path = node('path', 'origin-thread', move) as SVGPathElement;
      path.style.stroke = getComputedStyle(target).getPropertyValue(move === 'Surface' ? '--agent' : '--material').trim() || colour('--focus');
      path.setAttribute('d', `M${x1},${y1} C${x1 + bend * sign},${y1} ${x2 - bend * sign},${y2} ${x2},${y2}`);
      path.setAttribute('data-origin-type', label);
      path.setAttribute('data-origin-renderer', origin instanceof HTMLElement ? origin.dataset.originRenderer ?? (label === 'Repository node' ? 'world' : 'reference') : 'reference');
      if (move) {
        if (move === 'Emit' && !materialOnly) toolTransfer(origin, target, label, path.style.stroke);
        if (move === 'Lift' && label !== 'Read instrument' && !materialOnly) fileTransfer(origin, target, label, path.style.stroke);
        const repositoryNode = label === 'Repository node';
        const ignition = node(repositoryNode ? 'circle' : 'rect', 'origin-instrument', move);
        if (repositoryNode) {
          ignition.setAttribute('cx', String(a.left + a.width / 2));
          ignition.setAttribute('cy', String(a.top + a.height / 2));
          ignition.setAttribute('r', '9');
        } else {
          ignition.setAttribute('x', String(a.left - 2)); ignition.setAttribute('y', String(a.top - 2));
          ignition.setAttribute('width', String(a.width + 4)); ignition.setAttribute('height', String(a.height + 4)); ignition.setAttribute('rx', '5');
        }
        ignition.style.stroke = path.style.stroke;
        play(ignition, [{ opacity: .8 }, { opacity: 0 }], 380);
        const length = path.getTotalLength();
        play(path, [{ strokeDasharray: `${length}`, strokeDashoffset: length, opacity: .65 }, { strokeDasharray: `${length}`, strokeDashoffset: 0, opacity: 0 }], 560);
        if (move === 'Surface') {
          // Agent prose stays unboxed, including during its arrival.
          const rule = node('path', 'origin-thread', move);
          rule.setAttribute('d', `M${b.left},${b.top} V${b.bottom}`);
          rule.style.stroke = getComputedStyle(target).borderLeftColor;
          play(rule, [{ opacity: .75 }, { opacity: 0 }], 480);
        } else if (label !== 'Read instrument') materialArrival(target, a, move, fromRight);
      }
    };
    const draw = (arrivals = false) => {
      // A retained cue is valid only while its destination still occupies that space.
      // Content growth/wrapping or virtualization cancels it; passive hover does not.
      for (const [animation, cue] of runningMotion.current) {
        const now = cue.target?.getBoundingClientRect();
        if (cue.target && (!cue.target.isConnected || !now || !cue.rect || Math.abs(now.left - cue.rect.left) > 2 || Math.abs(now.top - cue.rect.top) > 2 || Math.abs(now.width - cue.rect.width) > 2 || Math.abs(now.height - cue.rect.height) > 2)) {
          animation.cancel(); cue.element.remove(); runningMotion.current.delete(animation);
        }
      }
      // Repaint passive relationships without deleting still-running arrivals.
      for (const child of [...root.children]) if (!child.hasAttribute('data-move')) child.remove();
      const articles = new Map([...history.querySelectorAll<HTMLElement>('[data-op-id]')].map((el) => [el.dataset.opId, el]));
      const ready: string[] = [];
      for (const [id, article] of articles) {
        if (!id || !article.classList.contains('op-read')) continue;
        const available = !!article.querySelector('.read-preview');
        if (materialReady.current.get(id) === false && available && liveMaterials.current.has(id) && animate && visible(article)) ready.push(id);
        materialReady.current.set(id, available);
      }
      while (materialReady.current.size > 96) materialReady.current.delete(materialReady.current.keys().next().value!);
      const operations = scene.passages.flatMap((ps) => ps.ops);
      const active = operations.filter((op) => op.id === hoveredOp || op.id === selectedOp || ready.includes(op.id) || (arrivals && animate && plan.arrivals.includes(op.id))).slice(-3);
      for (const op of active) {
        const target = articles.get(op.id);
        if (!target || !visible(target)) continue;
        motionTarget = target;
        if (ready.includes(op.id)) {
          // The file has already arrived in this read. Its eventual content opens
          // from that captured filename, without replaying an icon or depending
          // on a newly discovered/occluded repository node becoming visible.
          const reference = target.querySelector('.op-title');
          if (reference && visible(reference)) tether(reference, target, 'Captured read reference', 'Lift', false, true);
          continue;
        }
        let origin: HTMLElement | undefined;
        let label: string;
        if (op.origin.type === 'map') {
          const path = op.origin.path;
          origin = mapVisible ? [...viewer.querySelectorAll<HTMLElement>('[data-origin-file]')].find((el) => {
            if (el.dataset.originFile !== path || el.dataset.originVisible !== 'true') return false;
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            const overview = el.dataset.originRenderer === 'overview' && hit?.closest('.repo-lens-world');
            return visible(el) && !!hit && (overview || !hit.closest('.op, .prose, .turn, .passage-head, .spine, .dock, .crown, .inspector, .sheet, .file-panel, .map-legend, .map-tip'));
          }) : undefined;
          label = origin ? 'Repository node' : 'File reference';
          origin ??= [...viewer.querySelectorAll<HTMLElement>('[data-spine-path]')].find((el) => el.dataset.spinePath === path);
        } else if (op.origin.type === 'mcp') {
          const server = op.origin.server;
          const operation = projection.operations.find((item) => item.id === op.id);
          origin = [...viewer.querySelectorAll<HTMLElement>('[data-mcp-tool]')].find((el) => el.dataset.mcpServer === server && el.dataset.mcpTool === (operation?.origin.type === 'mcp' ? operation.origin.tool : undefined));
          const bounds = origin?.getBoundingClientRect();
          const dock = origin?.closest('.dock')?.getBoundingClientRect();
          if (!bounds || !dock || bounds.top < dock.top || bounds.bottom > dock.bottom) origin = undefined;
          label = origin ? 'MCP tool' : 'MCP server';
          origin ??= [...viewer.querySelectorAll<HTMLElement>('.server-name')].find((el) => el.textContent?.trim() === server);
        } else {
          origin = viewer.querySelector<HTMLElement>(`.instrument.k-${op.kind}`) ?? undefined;
          label = 'Tool instrument';
        }
        if (!origin) continue;
        const r = origin.getBoundingClientRect();
        const pane = origin.closest('.dock, .spine')?.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.top < 0 || r.bottom > innerHeight || (pane && (r.bottom <= pane.top || r.top >= pane.bottom))) continue;
        const materialOnly = ready.includes(op.id);
        const move = materialOnly ? 'Lift' : arrivals && animate && plan.arrivals.includes(op.id) && !emitted.has(`start:${op.id}`) ? op.origin.type === 'map' ? 'Lift' : 'Emit' : undefined;
        if (move) emitted.add(`start:${op.id}`);
        // A captured read has two real identities: its calling instrument and the file
        // it requested. Show the call leaving Read as well as the excerpt lifting from
        // the repository; neither thread claims that this file caused another action.
        if (move === 'Lift' && op.kind === 'read' && !materialOnly) {
          const instrument = viewer.querySelector<HTMLElement>('.instrument.k-read');
          const bounds = instrument?.getBoundingClientRect();
          const dock = instrument?.closest('.dock')?.getBoundingClientRect();
          if (instrument && bounds && dock && bounds.width > 0 && bounds.top >= dock.top && bounds.bottom <= dock.bottom) tether(instrument, target, 'Read instrument', 'Emit', true);
        }
        tether(origin, target, label, move, op.origin.type !== 'map', materialOnly);
      }
      if (!arrivals || !animate) return;
      for (const id of plan.outcomes) {
        if (emitted.has(`outcome:${id}`)) continue;
        const target = articles.get(id)?.querySelector('.verification-track, .result-area, .op-head');
        const op = projection.operations.find((op) => op.id === id);
        if (!target || !op || !visible(target)) continue;
        motionTarget = target;
        emitted.add(`outcome:${id}`);
        const rect = contour(target, 'Resolve', colour(op.status === 'error' ? '--fail' : op.status === 'ok' ? '--pass' : '--t3'));
        play(rect, [{ opacity: .7 }, { opacity: 0 }], 420);
      }
      for (const id of plan.prose) {
        if (emitted.has(`prose:${id}`)) continue;
        const target = [...history.querySelectorAll<HTMLElement>('[data-prose-id]')].find((el) => el.dataset.proseId === id);
        const origin = [...viewer.querySelectorAll<HTMLElement>('.crown [data-agent-id]')].find((el) => el.dataset.agentId === target?.dataset.agentId);
        const r = origin?.getBoundingClientRect();
        if (target && origin && visible(target) && r && r.width > 0 && r.left >= 0 && r.right <= innerWidth) {
          motionTarget = target;
          emitted.add(`prose:${id}`);
          tether(origin, target, 'Agent presence', 'Surface');
        }
      }
      for (const id of plan.settle) {
        if (emitted.has(`settle:${id}`)) continue;
        const target = [...history.querySelectorAll<HTMLElement>('.passage[data-passage-id]')].find((el) => el.dataset.passageId === id);
        if (!target || !visible(target)) continue;
        motionTarget = target;
        emitted.add(`settle:${id}`);
        const r = target.getBoundingClientRect();
        const line = node('path', 'origin-thread', 'Settle');
        line.setAttribute('d', `M${r.left},${r.top} H${Math.min(r.right, r.left + 80)}`);
        play(line, [{ transform: 'translateY(0)', opacity: .5 }, { transform: 'translateY(-4px)', opacity: 0 }], 360);
      }
    };
    const interrupt = () => {
      cancelMotion();
      previous.current = frameOf(scene);
      liveMaterials.current.clear();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { raf = 0; draw(); });
    };
    // The parent's layout effects can follow newly mounted work. Measure after that scroll,
    // without delaying a single captured character or replaying historical mounts.
    raf = requestAnimationFrame(() => {
      // ResizeObserver measures new material in the first rendering opportunity.
      // Its follow adjustment must land before testing an arrival's visibility.
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw(useApp.getState().follow || stagedArrival);
        // A synchronous hover/layout update can replace this effect before its first frame.
        // Consume the semantic change only after measuring it, rather than losing its arrival.
        previous.current = frameOf(scene);
      });
    });
    const scroll = () => {
      // A camera hold/anchor correction is not a deliberate reader gesture. Keep
      // the source-ready eligibility, but revalidate destinations after its scroll.
      if (isProgrammaticScroll?.()) {
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
        return;
      }
      if (!useApp.getState().follow) interrupt();
      else if (!raf) {
        cancelMotion();
        // The follow scroll can land after measurement. Retry only this update's
        // unshown cues; emitted identities prevent repeating an already visible arrival.
        raf = requestAnimationFrame(() => { raf = 0; draw(true); });
      }
    };
    let measured = false;
    const resize = new ResizeObserver(() => { if (measured) interrupt(); measured = true; });
    resize.observe(viewer);
    // Captured source can finish fetching after its outcome step was measured. Observe
    // readiness, not text changes or animation frames; historical mounts never gain a cue.
    const materials = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); });
    materials.observe(history, { childList: true, subtree: true });
    history.addEventListener('scroll', scroll, { passive: true });
    history.addEventListener('wheel', interrupt, { passive: true });
    viewer.addEventListener('pointerdown', interrupt, { passive: true });
    viewer.addEventListener('keydown', interrupt);
    document.addEventListener('visibilitychange', interrupt);
    preference.addEventListener('change', interrupt);
    return () => { resize.disconnect(); materials.disconnect(); history.removeEventListener('scroll', scroll); history.removeEventListener('wheel', interrupt); viewer.removeEventListener('pointerdown', interrupt); viewer.removeEventListener('keydown', interrupt); document.removeEventListener('visibilitychange', interrupt); preference.removeEventListener('change', interrupt); cancelAnimationFrame(raf); for (const child of [...root.children]) if (!child.hasAttribute('data-move')) child.remove(); };
  }, [scene, projection, motion, hoveredOp, selectedOp, mapVisible, explore, follow, paged, theme, compareAgents, settingsOpen, filePanel, mode, stagedArrival, isProgrammaticScroll]);
  return typeof document === 'undefined' ? null : createPortal(<svg className="origins" ref={svg} aria-hidden="true" />, document.body);
}
