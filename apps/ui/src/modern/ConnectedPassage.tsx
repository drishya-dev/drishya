import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** These are captured-order wires, never inferred tool dependencies. */
export function ConnectedPassage({ children, revision }: { children: ReactNode; revision: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{ width: number; height: number; paths: string[] }>({ width: 1, height: 1, paths: [] });
  useLayoutEffect(() => {
    const root = ref.current!;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = root.getBoundingClientRect();
        const cards = [...root.querySelectorAll<HTMLElement>('.md-action-slot')].slice(0, 120).map(el => el.getBoundingClientRect());
        const paths = cards.slice(1).map((next, index) => {
          const previous = cards[index]!;
          const ax = previous.right - bounds.left, ay = previous.top + 24 - bounds.top;
          const bx = next.left - bounds.left, by = next.top + 24 - bounds.top;
          if (Math.abs(previous.top - next.top) < 3) return `M ${ax} ${ay} C ${ax + 20} ${ay}, ${bx - 20} ${by}, ${bx} ${by}`;
          const gutter = previous.bottom - bounds.top + 26;
          return `M ${ax} ${ay} C ${ax + 18} ${ay}, ${ax + 18} ${gutter}, ${ax} ${gutter} L ${bx - 18} ${gutter} Q ${bx - 28} ${gutter} ${bx - 28} ${gutter + 10} L ${bx - 28} ${by - 12} Q ${bx - 28} ${by} ${bx} ${by}`;
        });
        setGeometry({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), paths });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root); root.querySelectorAll('.md-action-slot').forEach(el => observer.observe(el));
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [revision]);
  return <div className="md-connected" ref={ref}>
    <svg className="md-order-wires" width={geometry.width} height={geometry.height} aria-hidden="true">{geometry.paths.map((path, index) => <path key={index} d={path} />)}</svg>
    {children}
  </div>;
}
