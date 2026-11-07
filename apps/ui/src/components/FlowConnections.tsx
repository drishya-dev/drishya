import { flowRoute } from '../lib/flow-route.ts';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Projection } from '@drishya/contracts';
import { createPortal } from 'react-dom';
import { useApp } from '../state.ts';

interface Connection { from: string; to: string; key: string; d: string; label: string; strong: boolean }
/** Screen-space gutters connect visible materials only. Order is explicitly not causality. */
export function FlowConnections({ projection }: { projection: Projection }) {
  const selected = useApp(s => s.selectedOp);
  const hovered = useApp(s => s.hoveredOp);
  const explore = useApp(s => s.explore);
  const lowResource = useApp(s => s.lowResource);
  const group = useRef<SVGGElement>(null);
  const frame = useRef<number | undefined>(undefined);
  const evidence = useMemo(() => new Map(projection.links.filter(l => l.relation !== 'temporal-neighbor').map(l => [`${l.from}/${l.to}`, l])), [projection.links]);
  useLayoutEffect(() => {
    const history = document.querySelector<HTMLElement>('.history');
    const root = group.current;
    if (!root) return;
    if (!history || explore || lowResource) { root.replaceChildren(); return; }
    const elements = new Map<string, SVGPathElement>();
    root.replaceChildren();
    let active = true;
    let deadline = performance.now() + 2400;
    let lastMeasure = 0;
    let lastGeometry = "";
    const measure = (time = performance.now()) => {
      if (!active || !root.isConnected) return;
      frame.current = undefined;
      if (time - lastMeasure < 32) { pruneStale(); frame.current = requestAnimationFrame(measure); return; }
      lastMeasure = time;
      const viewport = history.getBoundingClientRect();
      const clip = { left: Math.max(0, viewport.left), right: Math.min(innerWidth, viewport.right), top: Math.max(0, viewport.top), bottom: Math.min(innerHeight, viewport.bottom - 20) };
      const visible = new Map<string, DOMRect>();
      for (const card of history.querySelectorAll<HTMLElement>('.op[data-op-id]')) {
        const rect = card.getBoundingClientRect(), style = getComputedStyle(card);
        if (rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && Number(style.opacity) > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom - 20 && rect.right > viewport.left && rect.left < viewport.right) visible.set(card.dataset.opId!, rect);
        if (visible.size >= 64) break;
      }
      // Follow can advance after a queued measurement in the same frame. Only
      // publish geometry that has held across two measurements; moving cards
      // retain their own arrival motion without a stale screen-space wire.
      const geometry = JSON.stringify([clip, history.scrollTop, [...visible].map(([id, r]) => [id, r.left, r.right, r.top, r.bottom])]);
      if (geometry !== lastGeometry) {
        lastGeometry = geometry; root.replaceChildren(); elements.clear();
        if (performance.now() < deadline) frame.current = requestAnimationFrame(measure);
        return;
      }
      const result: Connection[] = [];
      for (const row of history.querySelectorAll('.ops-row')) {
        const ids = [...row.querySelectorAll<HTMLElement>('.op[data-op-id]')].map(el => el.dataset.opId!);
        if (!ids.some(id => visible.has(id))) continue;
        for (let i = 1; i < ids.length && result.length < 36; i++) {
          const from = ids[i - 1]!; const to = ids[i]!;
          const a = visible.get(from); const b = visible.get(to);
          if (!a || !b) continue;
          const d = flowRoute(a, b, [...visible.values()], clip);
          if (!d) continue;
          const link = evidence.get(`${from}/${to}`);
          result.push({ from, to, key: `${from}/${to}`, d, label: link ? `${link.relation}: ${link.explanation}` : 'Order, not a causal link', strong: selected === from || selected === to || hovered === from || hovered === to });
        }
      }
      // Geometry follows compositor motion without sending 60 React updates a second.
      const keys = new Set(result.map(path => path.key));
      for (const [key, element] of elements) if (!keys.has(key)) { element.remove(); elements.delete(key); }
      for (const path of result) {
        let element = elements.get(path.key);
        if (!element) {
          element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          element.setAttribute('marker-end', 'url(#flow-arrow)');
          element.setAttribute('data-flow-link', path.key);
          element.setAttribute('data-flow-from', path.from); element.setAttribute('data-flow-to', path.to);
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = path.label; element.append(title);
          root.append(element); elements.set(path.key, element);
        }
        if (element.getAttribute('d') !== path.d) element.setAttribute('d', path.d);
        element.classList.toggle('focused', path.strong);
      }
      if (performance.now() < deadline && [...history.querySelectorAll('.op[data-op-id]')].some(el => el.getAnimations().some(a => (a.id.startsWith('surface-') || a.id.startsWith('reading-focus-')) && a.playState === 'running'))) frame.current = requestAnimationFrame(measure);
    };
    const pruneStale = () => {
      const cards = new Map([...history.querySelectorAll<HTMLElement>('.op[data-op-id]')].map(card => [card.dataset.opId!, card]));
      const viewport = history.getBoundingClientRect();
      const attached = (point: DOMPoint, card?: HTMLElement) => {
        if (!card?.isConnected) return false;
        const r = card.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && point.x >= Math.max(0, viewport.left) && point.x <= Math.min(innerWidth, viewport.right)
          && point.y >= Math.max(0, viewport.top) && point.y <= Math.min(innerHeight, viewport.bottom - 20)
          && point.x >= r.left - 1 && point.x <= r.right + 1 && point.y >= r.top - 1 && point.y <= r.bottom + 1
          && Math.min(Math.abs(point.x - r.left), Math.abs(point.x - r.right), Math.abs(point.y - r.top), Math.abs(point.y - r.bottom)) <= 1;
      };
      for (const [key, path] of elements) if (!attached(path.getPointAtLength(0), cards.get(path.dataset.flowFrom!)) || !attached(path.getPointAtLength(path.getTotalLength()), cards.get(path.dataset.flowTo!))) {
        path.remove(); elements.delete(key);
      }
    };
    const schedule = () => { if (!active) return; pruneStale(); deadline = performance.now() + 2400; if (frame.current === undefined) frame.current = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    const observed = new Set<Element>();
    const watchCards = () => {
      for (const card of observed) if (!history.contains(card)) { observer.unobserve(card); observed.delete(card); }
      for (const card of history.querySelectorAll('.op[data-op-id]')) {
        if (observed.size >= 64) break;
        if (!observed.has(card)) { observer.observe(card); observed.add(card); }
      }
    };
    observer.observe(history); watchCards();
    // A fixed-size viewport does not resize when virtual cards are replaced or
    // a disclosure above them moves their positions. Re-measure those changes
    // and observe the new resident cards, rather than leaving stale endpoints.
    const changes = new MutationObserver(() => { watchCards(); schedule(); });
    changes.observe(history, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    const viewer = history.closest('.viewer');
    if (viewer) changes.observe(viewer, { attributes: true, attributeFilter: ['class', 'style'] });
    history.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('drishya-material-layout', schedule);
    // A finite material translation updates endpoint geometry at its final resting position.
    const timer = setTimeout(schedule, 1800);
    return () => { active = false; changes.disconnect(); observer.disconnect(); history.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('drishya-material-layout', schedule); clearTimeout(timer); if (frame.current !== undefined) cancelAnimationFrame(frame.current); frame.current = undefined; };
  }, [projection, selected, hovered, explore, lowResource]);
  if (typeof document === 'undefined') return null;
  return createPortal(<svg className="flow-connections" aria-label="Connections in order" role="img"><defs><marker id="flow-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5" /></marker></defs><g ref={group} /></svg>, document.body);
}
