import { flowRoute } from '../lib/flow-route.ts';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Projection } from '@drishya/contracts';
import { createPortal } from 'react-dom';
import { useApp } from '../state.ts';

interface Connection { key: string; d: string; label: string; strong: boolean }
/** Screen-space gutters connect visible materials only. Order is explicitly not causality. */
export function FlowConnections({ projection }: { projection: Projection }) {
  const selected = useApp(s => s.selectedOp);
  const hovered = useApp(s => s.hoveredOp);
  const explore = useApp(s => s.explore);
  const lowResource = useApp(s => s.lowResource);
  const [paths, setPaths] = useState<Connection[]>([]);
  const frame = useRef<number | undefined>(undefined);
  const evidence = useMemo(() => new Map(projection.links.filter(l => l.relation !== 'temporal-neighbor').map(l => [`${l.from}/${l.to}`, l])), [projection.links]);
  useLayoutEffect(() => {
    const history = document.querySelector<HTMLElement>('.history');
    if (!history || explore || lowResource) { setPaths([]); return; }
    let deadline = performance.now() + 2400;
    const measure = () => {
      frame.current = undefined;
      const viewport = history.getBoundingClientRect();
      const visible = new Map<string, DOMRect>();
      for (const card of history.querySelectorAll<HTMLElement>('.op[data-op-id]')) {
        const rect = card.getBoundingClientRect();
        if (rect.bottom > viewport.top && rect.top < viewport.bottom - 20 && rect.right > viewport.left && rect.left < viewport.right) visible.set(card.dataset.opId!, rect);
        if (visible.size >= 64) break;
      }
      const result: Connection[] = [];
      for (const row of history.querySelectorAll('.ops-row')) {
        const ids = [...row.querySelectorAll<HTMLElement>('.op[data-op-id]')].map(el => el.dataset.opId!);
        if (!ids.some(id => visible.has(id))) continue;
        for (let i = 1; i < ids.length && result.length < 36; i++) {
          const from = ids[i - 1]!; const to = ids[i]!;
          const a = visible.get(from); const b = visible.get(to);
          if (!a || !b) continue;
          const d = flowRoute(a, b, [...visible.values()]);
          if (!d) continue;
          const link = evidence.get(`${from}/${to}`);
          result.push({ key: `${from}/${to}`, d, label: link ? `${link.relation}: ${link.explanation}` : 'Recorded sequence · order, not a causal link', strong: selected === from || selected === to || hovered === from || hovered === to });
        }
      }
      setPaths(result);
      if (performance.now() < deadline && [...history.querySelectorAll('.op[data-op-id]')].some(el => el.getAnimations().some(a => (a.id.startsWith('surface-') || a.id.startsWith('reading-focus-')) && a.playState === 'running'))) frame.current = requestAnimationFrame(measure);
    };
    const schedule = () => { deadline = performance.now() + 2400; if (frame.current === undefined) frame.current = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(history);
    for (const card of history.querySelectorAll('.op[data-op-id]')) observer.observe(card);
    history.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('drishya-material-layout', schedule);
    // A finite material translation updates endpoint geometry at its final resting position.
    const timer = setTimeout(schedule, 1800);
    return () => { observer.disconnect(); history.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('drishya-material-layout', schedule); clearTimeout(timer); if (frame.current !== undefined) cancelAnimationFrame(frame.current); frame.current = undefined; };
  }, [projection, selected, hovered, explore, lowResource]);
  if (!paths.length || explore || lowResource) return null;
  return createPortal(<svg className="flow-connections" aria-label="Connections in recorded order" role="img"><defs><marker id="flow-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5" /></marker></defs>{paths.map(path => <path key={path.key} d={path.d} className={path.strong ? 'focused' : ''} markerEnd="url(#flow-arrow)"><title>{path.label}</title></path>)}</svg>, document.body);
}
