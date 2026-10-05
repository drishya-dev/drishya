import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Scene } from '@drishya/scene';
import { useApp } from '../state.ts';

/** DOM-owned origins and contours. Captured text never travels, scales or waits for this layer. */
export function Origins({ scene }: { scene: Scene }) {
  const svg = useRef<SVGSVGElement>(null);
  const seen = useRef(new Set<string>());
  const existing = useRef(new Set(scene.passages.flatMap((p) => p.ops.map((op) => op.id))));
  const through = useRef(scene.step);
  const recordingId = useApp((s) => s.recordingId);
  const motion = useApp((s) => s.motion);
  const hoveredOp = useApp((s) => s.hoveredOp);
  const selectedOp = useApp((s) => s.selectedOp);
  const mapVisible = useApp((s) => s.mapVisible);
  const explore = useApp((s) => s.explore);
  const follow = useApp((s) => s.follow);
  useLayoutEffect(() => { seen.current.clear(); through.current = scene.step; }, [recordingId]);

  useLayoutEffect(() => {
    const root = svg.current;
    const viewer = document.querySelector('.viewer');
    const history = viewer?.querySelector('.history');
    if (!root || !viewer || !history || explore) return;
    const animations: Animation[] = [];
    let frame = 0;
    const previousStep = through.current;
    if (scene.step < previousStep) seen.current.clear();
    through.current = scene.step;
    const changed = scene.step !== previousStep;
    const candidates = scene.passages.flatMap((p) => p.ops);
    const arriving = new Set(candidates.filter((op) => !existing.current.has(op.id)).map((op) => op.id));
    existing.current = new Set(candidates.map((op) => op.id));
    const draw = (arrivals = false) => {
      root.replaceChildren();
      const viewport = history.getBoundingClientRect();
      const bounds = root.getBoundingClientRect();
      const articles = new Map([...history.querySelectorAll<HTMLElement>('[data-op-id]')].map((el) => [el.dataset.opId, el]));
      const active = candidates.filter((op) => op.id === hoveredOp || op.id === selectedOp || (arrivals && changed && follow && arriving.has(op.id) && !seen.current.has(op.id))).slice(-3);
      for (const op of active) {
        const el = articles.get(op.id);
        if (!el) continue;
        const target = el.getBoundingClientRect();
        if (target.bottom <= viewport.top || target.top >= viewport.bottom) continue;
        let origin: HTMLElement | undefined;
        let label: string;
        if (op.origin.type === 'map') {
          const path = op.origin.path;
          origin = mapVisible ? [...viewer.querySelectorAll<HTMLElement>('[data-origin-file]')].find((node) => node.dataset.originFile === path && node.dataset.originVisible === 'true') : undefined;
          label = origin ? 'Repository node' : 'File reference';
          origin ??= [...viewer.querySelectorAll<HTMLElement>('[data-spine-path]')].find((node) => node.dataset.spinePath === path);
        } else if (op.origin.type === 'mcp') {
          const server = op.origin.server;
          origin = [...viewer.querySelectorAll<HTMLElement>('.server-name')].find((node) => node.textContent?.trim() === server);
          label = 'MCP server';
        } else {
          origin = viewer.querySelector<HTMLElement>(`.instrument.k-${op.kind}`) ?? undefined;
          label = 'Tool instrument';
        }
        if (!origin) continue; // Unresolved or offscreen origins are never fabricated.
        const source = origin.getBoundingClientRect();
        const sourcePane = origin.closest('.dock, .spine')?.getBoundingClientRect();
        if (sourcePane && (source.bottom <= sourcePane.top || source.top >= sourcePane.bottom)) continue;
        const fromRight = op.origin.type !== 'map';
        const x1 = (fromRight ? source.left : source.right) - bounds.left;
        const y1 = source.top + source.height / 2 - bounds.top;
        const x2 = (fromRight ? target.right : target.left) - bounds.left;
        const y2 = target.top + 18 - bounds.top;
        const bend = Math.min(90, Math.abs(x2 - x1) / 2);
        const sign = fromRight ? -1 : 1;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${x1 + bend * sign},${y1} ${x2 - bend * sign},${y2} ${x2},${y2}`);
        path.setAttribute('class', 'origin-thread');
        path.setAttribute('data-origin-type', label);
        root.append(path);
        if (arrivals && changed && motion && !seen.current.has(op.id)) {
          const length = path.getTotalLength();
          animations.push(path.animate([{ strokeDasharray: `${length}`, strokeDashoffset: length, opacity: 0.6 }, { strokeDasharray: `${length}`, strokeDashoffset: 0, opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }));
          const shell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          shell.setAttribute('x', String(target.left - bounds.left)); shell.setAttribute('y', String(target.top - bounds.top));
          shell.setAttribute('width', String(target.width)); shell.setAttribute('height', String(Math.min(target.height, 300))); shell.setAttribute('rx', '5'); shell.setAttribute('class', 'origin-shell');
          shell.style.transformOrigin = `${target.left - bounds.left}px ${target.top - bounds.top}px`;
          root.append(shell);
          animations.push(shell.animate([{ transform: `translate(${x1 - x2}px,${y1 - y2}px) scale(.03,.06)`, opacity: 0.2 }, { transform: 'none', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }));
          animations.push(origin.animate([{ outline: '1px solid rgba(139,155,255,.65)', outlineOffset: '2px' }, { outline: '1px solid transparent', outlineOffset: '2px' }], { duration: 560 }));
        } else if (op.id !== hoveredOp && op.id !== selectedOp) path.remove();
        seen.current.add(op.id);
        if (seen.current.size > 512) seen.current.delete(seen.current.values().next().value!);
      }
    };
    const interrupt = () => {
      for (const animation of animations) animation.cancel();
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); });
    };
    draw(true);
    // Scroll/resize/reading cancels choreography; no RAF loop or capture/presentation queue.
    let measured = false;
    const resize = new ResizeObserver(() => { if (measured) interrupt(); measured = true; });
    resize.observe(viewer);
    history.addEventListener('scroll', interrupt, { passive: true });
    viewer.addEventListener('pointerdown', interrupt, { passive: true });
    viewer.addEventListener('keydown', interrupt);
    return () => { resize.disconnect(); history.removeEventListener('scroll', interrupt); viewer.removeEventListener('pointerdown', interrupt); viewer.removeEventListener('keydown', interrupt); for (const animation of animations) animation.cancel(); cancelAnimationFrame(frame); root.replaceChildren(); };
  }, [scene, motion, hoveredOp, selectedOp, mapVisible, explore, follow]);
  return typeof document === 'undefined' ? null : createPortal(<svg className="origins" ref={svg} aria-hidden="true" />, document.body);
}
