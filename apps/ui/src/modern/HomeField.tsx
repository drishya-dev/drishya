import { useEffect, useMemo, useRef, useState } from 'react';
import './home-field.css';

// SHIP-3 (Yash, 12 Nov): Home's opening sits on a quiet field of the person's own sessions. Every point is one real
// session, grouped around its workspace, in its harness's colour; newer sessions are brighter and nearer the centre of
// their group. Nothing here is decoration: a point with no session behind it is never drawn.
export interface FieldSession { key: string; title: string; harness: string; time?: string; running?: boolean }
export interface FieldGroup { key: string; name: string; sessions: FieldSession[]; /** Not a real project: folded temporary folders, or sessions with no workspace recorded. */ minor?: boolean }

// Where groups sit, as fractions of the opening, largest group first. The middle is kept free for the words.
const wideSlots: [number, number][] = [[.15, .34], [.85, .32], [.1, .72], [.9, .7], [.29, .86], [.71, .87], [.3, .13], [.7, .12]];
const narrowSlots: [number, number][] = [[.18, .1], [.82, .12], [.16, .93], [.84, .92]];
const perGroup = 140, golden = 2.399963229728653;

// Points and their spacing follow the opening's size, so a large window is not a few specks in a black field.
const spreadFor = (w: number, h: number) => w < 900 ? 5.2 : 7 * Math.max(1, Math.min(1.7, Math.min(w / 1440, h / 700)));
interface Point { x: number; y: number; r: number; alpha: number; warm: boolean; session: FieldSession; group: number }

function recency(time: string | undefined, now: number) {
  const age = now - (Date.parse(time ?? '') || 0);
  return age < 86400000 ? 1 : age < 7 * 86400000 ? .72 : age < 30 * 86400000 ? .46 : .28;
}

export function HomeField({ groups, now, onOpen, onGroup }: { groups: FieldGroup[]; now: number; onOpen: (key: string) => void; onGroup: (key: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; session: FieldSession; group: string } | undefined>();
  const points = useRef<Point[]>([]), angle = useRef(0), pointer = useRef<{ x: number; y: number } | undefined>(undefined);
  const narrow = size.w < 900;
  const placed = useMemo(() => {
    const slots = narrow ? narrowSlots : wideSlots;
    // Real projects first, weighted toward the ones worked in during the last two weeks; folded temporary folders and
    // sessions with no workspace come last.
    const recent = (group: FieldGroup) => group.sessions.filter(session => now - (Date.parse(session.time ?? '') || 0) < 14 * 86400000).length;
    const weight = (group: FieldGroup) => group.sessions.length + 3 * recent(group);
    return [...groups].sort((a, b) => Number(!!a.minor) - Number(!!b.minor) || weight(b) - weight(a) || a.key.localeCompare(b.key)).slice(0, slots.length).map((group, i) => ({ group, slot: slots[i]! }));
  }, [groups, narrow, now]);

  useEffect(() => {
    const node = wrap.current; if (!node) return;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = canvas.current, context = node?.getContext('2d');
    if (!node || !context || !size.w || !size.h) return;
    const root = document.documentElement, style = getComputedStyle(node);
    const warm = style.getPropertyValue('--field-claude').trim() || '#e8956a', cool = style.getPropertyValue('--field-codex').trim() || '#6fb3ff', line = style.getPropertyValue('--field-line').trim() || '#ffffff';
    const dpr = Math.min(2, devicePixelRatio || 1);
    node.width = Math.round(size.w * dpr); node.height = Math.round(size.h * dpr);
    const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.hasAttribute('data-low-resource') || root.dataset.uiMotion === 'off';
    const spread = spreadFor(size.w, size.h);
    let frame = 0, last = 0, drawn = -1, visible = true, lastScroll = 0;
    const draw = (time: number) => {
      frame = 0;
      const moving = !still() && visible && !document.hidden;
      if (moving) frame = requestAnimationFrame(draw);
      // Scrolling gets the whole frame, and a slow drift needs no more than 30 frames a second.
      if (time - lastScroll < 160 || (drawn >= 0 && time - drawn < 32)) return;
      if (moving && last) angle.current += Math.min(.05, (time - last) / 1000) * .012;
      last = time; drawn = time;
      context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, size.w, size.h);
      const next: Point[] = [];
      placed.forEach(({ group, slot }, g) => {
        const cx = slot[0] * size.w, cy = slot[1] * size.h, turn = angle.current * (g % 2 ? -1 : 1);
        group.sessions.slice(0, perGroup).forEach((session, i) => {
          const radius = spread * Math.sqrt(i + .6), theta = i * golden + turn;
          const bright = recency(session.time, now);
          next.push({ x: cx + Math.cos(theta) * radius, y: cy + Math.sin(theta) * radius * .92, r: (session.running ? 2.6 : 1.1 + bright * 1.1) * spread / 7, alpha: session.running ? 1 : .18 + bright * .62, warm: session.harness !== 'codex', session, group: g });
        });
      });
      for (const p of next) {
        context.globalAlpha = p.alpha; context.fillStyle = p.warm ? warm : cool;
        context.beginPath(); context.arc(p.x, p.y, p.r, 0, Math.PI * 2); context.fill();
        if (p.session.running) { context.globalAlpha = .5; context.strokeStyle = p.warm ? warm : cool; context.lineWidth = 1; context.beginPath(); context.arc(p.x, p.y, 6, 0, Math.PI * 2); context.stroke(); }
      }
      // The pointed session is tied to its workspace: a real relation, drawn only on request.
      const at = pointer.current;
      if (at) {
        let best: Point | undefined, distance = 15;
        for (const p of next) { const d = Math.hypot(p.x - at.x, p.y - at.y); if (d < distance) { distance = d; best = p; } }
        if (best) {
          const slot = placed[best.group]!.slot;
          context.globalAlpha = .22; context.strokeStyle = line; context.lineWidth = 1;
          context.beginPath(); context.moveTo(best.x, best.y); context.lineTo(slot[0] * size.w, slot[1] * size.h); context.stroke();
          context.globalAlpha = 1; context.strokeStyle = best.warm ? warm : cool; context.lineWidth = 1.25;
          context.beginPath(); context.arc(best.x, best.y, 7, 0, Math.PI * 2); context.stroke();
        }
      }
      context.globalAlpha = 1; points.current = next;
    };
    const kick = () => { drawn = -1; if (!frame) frame = requestAnimationFrame(draw); };
    const scrolled = () => { lastScroll = performance.now(); };
    const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; if (visible) kick(); });
    observer.observe(node);
    const scroller = node.closest('.mh-scroll');
    scroller?.addEventListener('scroll', scrolled, { passive: true });
    document.addEventListener('visibilitychange', kick);
    node.addEventListener('home-field-redraw', kick);
    kick();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scroller?.removeEventListener('scroll', scrolled); document.removeEventListener('visibilitychange', kick); node.removeEventListener('home-field-redraw', kick); };
  }, [placed, size.w, size.h, now, narrow]);

  const find = (x: number, y: number) => {
    let best: Point | undefined, distance = 15;
    for (const p of points.current) { const d = Math.hypot(p.x - x, p.y - y); if (d < distance) { distance = d; best = p; } }
    return best;
  };
  const local = (event: { clientX: number; clientY: number }) => { const box = canvas.current!.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };
  if (!groups.length) return <div ref={wrap} className="home-field" aria-hidden="true"/>;
  return <div ref={wrap} className={`home-field${hover ? ' pointing' : ''}`}
    onPointerMove={event => { const at = local(event), p = find(at.x, at.y); pointer.current = at; setHover(p ? { x: p.x, y: p.y, session: p.session, group: placed[p.group]!.group.name } : undefined); canvas.current?.dispatchEvent(new Event('home-field-redraw')); }}
    onPointerLeave={() => { pointer.current = undefined; setHover(undefined); canvas.current?.dispatchEvent(new Event('home-field-redraw')); }}
    onClick={event => { const at = local(event), p = find(at.x, at.y); if (p) onOpen(p.session.key); }}>
    <canvas ref={canvas} aria-hidden="true" style={{ width: size.w, height: size.h }}/>
    {placed.map(({ group, slot }) => <button key={group.key} type="button" className="home-field-label" style={{ left: `${slot[0] * 100}%`, top: `calc(${slot[1] * 100}% + ${Math.min(perGroup, group.sessions.length) ** .5 * spreadFor(size.w, size.h) + 14}px)` }} onClick={event => { event.stopPropagation(); onGroup(group.key); }} title={`Show ${group.name}'s sessions`}><span>{group.name}</span><b>{group.sessions.length}</b></button>)}
    {hover && <div className="home-field-tip" role="status" style={{ left: hover.x, top: hover.y }}><strong>{hover.session.title}</strong><span>{hover.session.harness === 'codex' ? 'Codex' : 'Claude Code'} · {hover.group}{hover.session.running ? ' · writing now' : ''}</span></div>}
  </div>;
}
