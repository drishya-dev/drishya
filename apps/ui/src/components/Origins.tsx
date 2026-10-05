import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { choreographyBetween, frameOf } from '../lib/choreography.ts';
import { useApp } from '../state.ts';

const NS = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(.16,1,.3,1)';

/** Only empty contours move. Characters remain in the DOM, selectable from arrival. */
export function Origins({ scene, projection }: { scene: Scene; projection: Projection }) {
  const svg = useRef<SVGSVGElement>(null);
  const previous = useRef(frameOf(scene));
  const motion = useApp((s) => s.motion);
  const hoveredOp = useApp((s) => s.hoveredOp);
  const selectedOp = useApp((s) => s.selectedOp);
  const mapVisible = useApp((s) => s.mapVisible);
  const explore = useApp((s) => s.explore);
  const follow = useApp((s) => s.follow);
  const paged = useApp((s) => !!s.historyPage);

  useLayoutEffect(() => {
    const root = svg.current;
    const viewer = document.querySelector('.viewer');
    const history = viewer?.querySelector('.history');
    const plan = choreographyBetween(previous.current, scene, projection, paged ? Math.max(0, scene.step - projection.timeline.length) : 0);
    if (!root || !viewer || !history || explore) { previous.current = frameOf(scene); return; }
    const animations: Animation[] = [];
    let raf = 0;
    const animate = motion && follow && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const v = history.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > v.top && r.top < v.bottom && r.right > v.left && r.left < v.right;
    };
    const node = (tag: 'path' | 'rect', cls: string, move?: string) => {
      const el = document.createElementNS(NS, tag);
      el.setAttribute('class', cls);
      if (move) el.setAttribute('data-move', move);
      root.append(el);
      return el;
    };
    const play = (el: SVGElement, frames: Keyframe[], duration: number) => {
      const animation = el.animate(frames, { duration, easing: EASE, fill: 'forwards' });
      animations.push(animation);
      void animation.finished.then(() => el.remove(), () => el.remove());
    };
    const contour = (el: Element, move: string, tone = '#8b9bff') => {
      const r = el.getBoundingClientRect();
      const rect = node('rect', 'origin-shell', move);
      for (const [key, value] of Object.entries({ x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 420), rx: 3 })) rect.setAttribute(key, String(value));
      rect.style.stroke = tone;
      return rect;
    };
    const tether = (origin: Element, target: Element, label: string, move?: string, fromRight = false) => {
      const a = origin.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x1 = fromRight ? a.left : a.left + a.width / 2;
      const y1 = a.top + a.height / 2;
      const x2 = fromRight ? b.right : b.left;
      const y2 = b.top + Math.min(18, b.height / 2);
      const bend = Math.min(90, Math.abs(x2 - x1) / 2);
      const sign = fromRight ? -1 : 1;
      const path = node('path', 'origin-thread', move) as SVGPathElement;
      path.setAttribute('d', `M${x1},${y1} C${x1 + bend * sign},${y1} ${x2 - bend * sign},${y2} ${x2},${y2}`);
      path.setAttribute('data-origin-type', label);
      path.setAttribute('data-origin-renderer', origin instanceof HTMLElement ? origin.dataset.originRenderer ?? (label === 'Repository node' ? 'world' : 'reference') : 'reference');
      if (move) {
        const length = path.getTotalLength();
        play(path, [{ strokeDasharray: `${length}`, strokeDashoffset: length, opacity: .65 }, { strokeDasharray: `${length}`, strokeDashoffset: 0, opacity: 0 }], 560);
        if (move === 'Surface') {
          // Agent prose stays unboxed, including during its arrival.
          const rule = node('path', 'origin-thread', move);
          rule.setAttribute('d', `M${b.left},${b.top} V${b.bottom}`);
          rule.style.stroke = getComputedStyle(target).borderLeftColor;
          play(rule, [{ opacity: .75 }, { opacity: 0 }], 480);
        } else {
          const shell = contour(target, move);
          play(shell, [{ transform: `translate(${x1 - x2}px,${y1 - y2}px)`, opacity: .08 }, { transform: 'none', opacity: .5, offset: .75 }, { transform: 'none', opacity: 0 }], 480);
        }
      }
    };
    const draw = (arrivals = false) => {
      root.replaceChildren();
      const articles = new Map([...history.querySelectorAll<HTMLElement>('[data-op-id]')].map((el) => [el.dataset.opId, el]));
      const operations = scene.passages.flatMap((ps) => ps.ops);
      const active = operations.filter((op) => op.id === hoveredOp || op.id === selectedOp || (arrivals && animate && plan.arrivals.includes(op.id))).slice(-3);
      for (const op of active) {
        const target = articles.get(op.id);
        if (!target || !visible(target)) continue;
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
          origin = [...viewer.querySelectorAll<HTMLElement>('.server-name')].find((el) => el.textContent?.trim() === server);
          label = 'MCP server';
        } else {
          origin = viewer.querySelector<HTMLElement>(`.instrument.k-${op.kind}`) ?? undefined;
          label = 'Tool instrument';
        }
        if (!origin) continue;
        const r = origin.getBoundingClientRect();
        const pane = origin.closest('.dock, .spine')?.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.top < 0 || r.bottom > innerHeight || (pane && (r.bottom <= pane.top || r.top >= pane.bottom))) continue;
        const move = arrivals && animate && plan.arrivals.includes(op.id) ? op.origin.type === 'map' ? 'Lift' : 'Emit' : undefined;
        tether(origin, target, label, move, op.origin.type !== 'map');
      }
      if (!arrivals || !animate) return;
      for (const id of plan.outcomes) {
        const target = articles.get(id)?.querySelector('.result-area, .op-head');
        const op = projection.operations.find((op) => op.id === id);
        if (!target || !op || !visible(target)) continue;
        const rect = contour(target, 'Resolve', op.status === 'error' ? '#f2706a' : op.status === 'ok' ? '#4fc38a' : '#a1a1aa');
        play(rect, [{ opacity: .7 }, { opacity: 0 }], 420);
      }
      for (const id of plan.prose) {
        const target = [...history.querySelectorAll<HTMLElement>('[data-prose-id]')].find((el) => el.dataset.proseId === id);
        const origin = [...viewer.querySelectorAll<HTMLElement>('.crown [data-agent-id]')].find((el) => el.dataset.agentId === target?.dataset.agentId);
        const r = origin?.getBoundingClientRect();
        if (target && origin && visible(target) && r && r.width > 0 && r.left >= 0 && r.right <= innerWidth) tether(origin, target, 'Agent presence', 'Surface');
      }
      for (const id of plan.settle) {
        const target = [...history.querySelectorAll<HTMLElement>('.passage[data-passage-id]')].find((el) => el.dataset.passageId === id);
        if (!target || !visible(target)) continue;
        const r = target.getBoundingClientRect();
        const line = node('path', 'origin-thread', 'Settle');
        line.setAttribute('d', `M${r.left},${r.top} H${Math.min(r.right, r.left + 80)}`);
        play(line, [{ transform: 'translateY(0)', opacity: .5 }, { transform: 'translateY(-4px)', opacity: 0 }], 360);
      }
    };
    const interrupt = () => {
      animations.forEach((animation) => animation.cancel());
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { raf = 0; draw(); });
    };
    // The parent's layout effects can follow newly mounted work. Measure after that scroll,
    // without delaying a single captured character or replaying historical mounts.
    raf = requestAnimationFrame(() => {
      raf = 0;
      draw(useApp.getState().follow);
      // A synchronous hover/layout update can replace this effect before its first frame.
      // Consume the semantic change only after measuring it, rather than losing its arrival.
      previous.current = frameOf(scene);
    });
    const scroll = () => {
      if (!useApp.getState().follow) interrupt();
      else if (!raf) { animations.forEach((a) => a.cancel()); raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
    };
    let measured = false;
    const resize = new ResizeObserver(() => { if (measured) interrupt(); measured = true; });
    resize.observe(viewer);
    history.addEventListener('scroll', scroll, { passive: true });
    history.addEventListener('wheel', interrupt, { passive: true });
    viewer.addEventListener('pointerdown', interrupt, { passive: true });
    viewer.addEventListener('keydown', interrupt);
    return () => { resize.disconnect(); history.removeEventListener('scroll', scroll); history.removeEventListener('wheel', interrupt); viewer.removeEventListener('pointerdown', interrupt); viewer.removeEventListener('keydown', interrupt); animations.forEach((a) => a.cancel()); cancelAnimationFrame(raf); root.replaceChildren(); };
  }, [scene, projection, motion, hoveredOp, selectedOp, mapVisible, explore, follow, paged]);
  return typeof document === 'undefined' ? null : createPortal(<svg className="origins" ref={svg} aria-hidden="true" />, document.body);
}
