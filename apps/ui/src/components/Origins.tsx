import {fileTreeOrigin} from '../lib/file-tree-origin.ts';
import {operationOutcome} from '../lib/operation-outcome.ts';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Projection } from '@drishya/contracts';
import { operationFailed } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { choreographyBetween, frameOf } from '../lib/choreography.ts';
import { useApp } from '../state.ts';
import { moveMaterial, restingRect, settleArrival } from '../lib/material-motion.ts';

const NS = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(.16,1,.3,1)';

/** Material shells move from measured origins; characters stay selectable in their final DOM. */
export function Origins({ scene, projection, stagedArrival = false, isProgrammaticScroll }: { scene: Scene; projection: Projection; stagedArrival?: boolean; isProgrammaticScroll?: () => boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  // Scene revisions are faster than an arrival. Own finite animations across renders,
  // rather than cancelling them whenever capture or a passive hover updates React.
  const runningMotion = useRef(new Map<Animation, { element: Element; target?: Element; rect?: DOMRect }>());
  const preparedMaterials = useRef(new Map<HTMLElement, string>());
  const revealPrepared = () => { for (const [element, opacity] of preparedMaterials.current) element.style.opacity = opacity; preparedMaterials.current.clear(); };
  const materialReady = useRef(new Map<string, boolean>());
  const liveMaterials = useRef(new Set<string>());
  const cancelMotion = () => {
    revealPrepared();
    for (const [animation, cue] of runningMotion.current) { animation.cancel(); if (cue.element instanceof SVGElement) cue.element.remove(); }
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
  }, [recordingId, source, theme, mapVisible, explore, motion, compareAgents, settingsOpen, filePanel, mode]);

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
    const animate = motion && !document.hidden && !preference.matches;
    if (animate) for (const article of history.querySelectorAll<HTMLElement>('article[data-op-id]')) {
      if (plan.arrivals.includes(article.dataset.opId!) && !preparedMaterials.current.has(article)) {
        // Avoid a full-size flash before the post-follow measurement starts the arrival.
        preparedMaterials.current.set(article, article.style.opacity); article.style.opacity = '0';
      }
    }
    const visible = (el: Element, inHistory = true) => {
      const r = restingRect(el);
      const v = (inHistory ? history : viewer.querySelector('.main') ?? history).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > v.top && r.top < v.bottom && r.right > v.left && r.left < v.right;
    };
    const originVisible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) return false;
      // The right station now owns scrolling. A clipped instrument/agent cannot
      // be a visible motion origin merely because its dock extends offscreen.
      for (const selector of ['.workbench-station', '.dock', '.spine', '.folder-tree']) {
        const pane = el.closest(selector)?.getBoundingClientRect();
        if (pane && (r.top < pane.top || r.bottom > pane.bottom || r.left < pane.left || r.right > pane.right)) return false;
      }
      return true;
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
        oldest[0].cancel(); if (oldest[1].element instanceof SVGElement) oldest[1].element.remove(); runningMotion.current.delete(oldest[0]);
      }
      // Readable material arrival, not an icon race. Large reading spaces unfold longer;
      // evidence is already mounted and no capture or presentation queue waits for this.
      const area = motionTarget?.getBoundingClientRect();
      const scale = area ? Math.min(1.55, 1.25 + Math.min(1, area.width * Math.min(area.height, 420) / 240_000) * .3) : 1.25;
      const animation = el.animate(frames, { duration: Math.round(duration * scale), easing, fill: 'forwards' });
      runningMotion.current.set(animation, { element: el, target: motionTarget, rect: motionTarget ? restingRect(motionTarget) : undefined });
      const release = () => { runningMotion.current.delete(animation); el.remove(); };
      void animation.finished.then(release, release);
    };
    const palette = getComputedStyle(viewer);
    const colour = (token: string) => palette.getPropertyValue(token).trim();
    const contour = (el: Element, move: string, tone?: string) => {
      const material = el.closest<HTMLElement>('[data-material]')?.dataset.material;
      // Animate the material's own reading edge, rather than flying the same empty
      // rectangle around every action. The backing never copies captured characters.
      const content = el.matches('.op') ? el.querySelector('.verification-track, .cmd, .query, .code, .diff, .mcp-tool') ?? el : el;
      const r = content.getBoundingClientRect();
      const end = Math.min(r.bottom, r.top + 420);
      const edge = node('path', 'origin-shell', move);
      const rail = material === 'source' || material === 'change' || material === 'external';
      edge.setAttribute('d', rail ? `M${r.left + 10},${r.top} H${r.left} V${end} H${r.left + 10}` : `M${r.left},${end} H${r.right}`);
      edge.style.stroke = tone ?? (getComputedStyle(el).getPropertyValue('--material').trim() || colour('--focus'));
      return edge;
    };
    const arriveSurface = (origin: Element, target: HTMLElement, move: string) => {
      const r = restingRect(target); const a = origin.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (r.left + r.width / 2);
      const dy = a.top + a.height / 2 - (r.top + Math.min(22, r.height / 2));
      const duration = Math.round(700 + Math.min(120, r.width * r.height / 1800));
      // The builder requested whole-material zoom: one real selectable DOM surface,
      // including its content, grows continuously into its final reading allocation.
      while (runningMotion.current.size >= 36) {
        const oldest = runningMotion.current.entries().next().value;
        if (!oldest) break;
        oldest[0].cancel(); if (oldest[1].element instanceof SVGElement) oldest[1].element.remove(); runningMotion.current.delete(oldest[0]);
      }
      const scale = Math.max(.06, Math.min(.18, a.width / Math.max(1, r.width)));
      const animation = moveMaterial(target, new DOMRect(r.left + dx + r.width * (1 - scale) / 2, r.top + dy, r.width * scale, r.height * scale), duration, `surface-${move}`);
      settleArrival(target, r, animation);
      runningMotion.current.set(animation, { element: target, target, rect: r });
      const release = () => { runningMotion.current.delete(animation); animation.cancel(); };
      void animation.finished.then(release, release);
    };
    const tether = (origin: Element, target: Element, label: string, move?: string, fromRight = false, materialOnly = false) => {
      const a = origin.getBoundingClientRect();
      const b = restingRect(target);
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
      path.setAttribute('data-origin-renderer', origin instanceof HTMLElement ? origin.dataset.originRenderer ?? (label === 'File tree row' ? 'tree' : label === 'Repository node' ? 'world' : 'reference') : 'reference');
      if (move) {
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
        } else if (materialOnly) {
          // A late excerpt is already at home. Mark availability without a second box.
          play(contour(target, move), [{ opacity: .8 }, { opacity: 0 }], 480);
        }
        if (!materialOnly && label !== 'Read instrument' && (move === 'Lift' || move === 'Emit') && target instanceof HTMLElement) arriveSurface(origin, target, move);
      }
    };
    const draw = (arrivals = false) => {
      revealPrepared();
      // A retained cue is valid only while its destination still occupies that space.
      // Content growth/wrapping or virtualization cancels it; passive hover does not.
      for (const [animation, cue] of runningMotion.current) {
        // Real surfaces retarget their motion through reflow; cancelling here was
        // the late full-size pop. Decorative relationship marks still expire below.
        if (cue.element === cue.target && cue.element instanceof HTMLElement) continue;
        const now = cue.target ? restingRect(cue.target) : undefined;
        if (cue.target && (!cue.target.isConnected || !now || !cue.rect || Math.abs(now.left - cue.rect.left) > 2 || Math.abs(now.top - cue.rect.top) > 2)) {
          animation.cancel(); if (cue.element instanceof SVGElement) cue.element.remove(); runningMotion.current.delete(animation);
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
          // The visible Files row is the real developer-facing home of read/edit
          // material. Prefer it over an aesthetic map node, but never expand,
          // scroll or reveal the tree just to manufacture an animation origin.
          origin = ['read', 'edit', 'write'].includes(op.kind) ? fileTreeOrigin(viewer, path) : undefined;
          label = origin ? 'File tree row' : 'File reference';
          if (!origin) {
            origin = mapVisible ? [...viewer.querySelectorAll<HTMLElement>('[data-origin-file]')].find((el) => {
              if (el.dataset.originFile !== path || el.dataset.originVisible !== 'true') return false;
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              const overview = el.dataset.originRenderer === 'overview' && hit?.closest('.repo-lens-world');
              return visible(el, false) && !!hit && (overview || !hit.closest('.op, .prose, .turn, .passage-head, .spine, .dock, .crown, .sheet, .file-panel, .map-legend, .map-tip'));
            }) : undefined;
            label = origin ? 'Repository node' : 'File reference';
            origin ??= fileTreeOrigin(viewer, path);
            if (origin && label !== 'Repository node') label = 'File tree row';
          }
        } else if (op.origin.type === 'mcp') {
          const server = op.origin.server;
          const operation = projection.operations.find((item) => item.id === op.id);
          origin = [...viewer.querySelectorAll<HTMLElement>('[data-mcp-tool]')].find((el) => el.dataset.mcpServer === server && el.dataset.mcpTool === (operation?.origin.type === 'mcp' ? operation.origin.tool : undefined));
          const bounds = origin?.getBoundingClientRect();
          const dock = origin?.closest('.dock')?.getBoundingClientRect();
          if (!bounds || !dock || !origin || !originVisible(origin)) origin = undefined;
          label = origin ? 'MCP tool' : 'MCP server';
          origin ??= [...viewer.querySelectorAll<HTMLElement>('.server-name')].find((el) => el.dataset.mcpServer === server || el.textContent?.trim() === server);
        } else {
          origin = viewer.querySelector<HTMLElement>(`.instrument.k-${op.kind}`) ?? undefined;
          label = 'Tool instrument';
        }
        const originBounds = origin?.getBoundingClientRect();
        const originPane = origin?.closest('.spine')?.getBoundingClientRect();
        if (op.origin.type === 'map' && (!origin || !visible(origin, false) || (originBounds && originPane && (originBounds.top < originPane.top || originBounds.bottom > originPane.bottom)))) {
          origin = viewer.querySelector<HTMLElement>(`.instrument.k-${op.kind === 'write' ? 'edit' : op.kind}`) ?? undefined;
          label = 'Tool instrument';
        }
        if (!origin || !originVisible(origin)) {
          const compact = viewer.querySelector<HTMLElement>('.toolbox-minimized .toolbox-collapse');
          if (compact && originVisible(compact)) { origin = compact; label = 'Tool instrument'; }
        }
        if (!origin || !originVisible(origin)) continue;
        const materialOnly = ready.includes(op.id);
        const move = materialOnly ? 'Lift' : arrivals && animate && plan.arrivals.includes(op.id) && !emitted.has(`start:${op.id}`) ? op.origin.type === 'map' && label !== 'Tool instrument' ? 'Lift' : 'Emit' : undefined;
        if (move) emitted.add(`start:${op.id}`);
        // A captured read has two real identities: its calling instrument and the file
        // it requested. Show the call leaving Read as well as the excerpt lifting from
        // the repository; neither thread claims that this file caused another action.
        if (move === 'Lift' && op.kind === 'read' && !materialOnly) {
          const instrument = viewer.querySelector<HTMLElement>('.instrument.k-read');
          const bounds = instrument?.getBoundingClientRect();
          const dock = instrument?.closest('.dock')?.getBoundingClientRect();
          if (instrument && bounds && dock && originVisible(instrument)) tether(instrument, target, 'Read instrument', 'Emit', true);
        }
        tether(origin, target, label, move, op.origin.type !== 'map' || label === 'Tool instrument', materialOnly);
      }
      if (!arrivals || !animate) return;
      for (const id of plan.outcomes) {
        if (emitted.has(`outcome:${id}`)) continue;
        const target = articles.get(id)?.querySelector('.verification-track, .result-area, .op-head');
        const op = projection.operations.find((op) => op.id === id);
        if (!target || !op || !visible(target)) continue;
        motionTarget = target;
        emitted.add(`outcome:${id}`);
        const rect = contour(target, 'Resolve', colour(operationFailed(op) ? '--fail' : operationOutcome(op).tone === 'ok' ? '--pass' : '--t3'));
        play(rect, [{ opacity: .7 }, { opacity: 0 }], 420);
      }
      for (const id of plan.prose) {
        if (emitted.has(`prose:${id}`)) continue;
        const target = [...history.querySelectorAll<HTMLElement>('[data-prose-id]')].find((el) => el.dataset.proseId === id);
          const agentOrigin = [...viewer.querySelectorAll<HTMLElement>('.workspace-agent-bar [data-origin-agent], .crown [data-agent-id], .station-agents [data-agent-id], .workbench-agents [data-agent-id]')].find((el) => (el.dataset.originAgent ?? el.dataset.agentId) === target?.dataset.agentId && originVisible(el));
        // Single-agent sessions omit the badge; their captured session title is the home.
        const origin = agentOrigin ?? (projection.agents.length === 1 ? viewer.querySelector<HTMLElement>('.crown-title') : undefined);
        const r = origin?.getBoundingClientRect();
        if (target && origin && visible(target) && r && originVisible(origin)) {
          motionTarget = target;
          emitted.add(`prose:${id}`);
          tether(origin, target, agentOrigin ? 'Agent presence' : 'Session presence', 'Surface');
        }
      }
      for (const id of plan.settle) {
        if (emitted.has(`settle:${id}`)) continue;
        const target = [...history.querySelectorAll<HTMLElement>('.passage[data-passage-id]')].find((el) => el.dataset.passageId === id);
        if (!target || !visible(target)) continue;
        motionTarget = target;
        emitted.add(`settle:${id}`);
        const r = restingRect(target);
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
        draw(true);
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
      if (!raf) {
        // Active DOM arrivals retarget themselves across follow scrolling.
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
    viewer.addEventListener('scroll', scroll, { passive: true, capture: true });
    viewer.addEventListener('click', interrupt, true);
    viewer.addEventListener('keydown', interrupt);
    document.addEventListener('visibilitychange', interrupt);
    preference.addEventListener('change', interrupt);
    return () => { resize.disconnect(); materials.disconnect(); viewer.removeEventListener('scroll', scroll, true); viewer.removeEventListener('click', interrupt, true); viewer.removeEventListener('keydown', interrupt); document.removeEventListener('visibilitychange', interrupt); preference.removeEventListener('change', interrupt); cancelAnimationFrame(raf); for (const child of [...root.children]) if (!child.hasAttribute('data-move')) child.remove(); };
  }, [scene, projection, motion, hoveredOp, selectedOp, mapVisible, explore, follow, paged, theme, compareAgents, settingsOpen, filePanel, mode, stagedArrival, isProgrammaticScroll]);
  return typeof document === 'undefined' ? null : createPortal(<svg className="origins" ref={svg} aria-hidden="true" />, document.body);
}
