// The repository map: the sample's real files and folders as a slowly turning 3D constellation on a 2D canvas.
// Structure is real (files, folders, static imports); the 3D placement is decorative and deterministic.
// Text never goes on the canvas: lit files get DOM labels positioned each frame.

export type Tone = 'read' | 'search' | 'edit' | 'fail' | 'pass' | 'focus';
export const TONES: Record<Tone, string> = { read: '#7aa8ff', search: '#a7adb5', edit: '#e8b04a', fail: '#ff6a5c', pass: '#46c98b', focus: '#f1eee4' };

interface Graph { nodes: { path: string; dir: string }[]; edges: { from: string; to: string }[] }
interface Point { id: string; x: number; y: number; z: number; hub: boolean; parent?: string }

const golden = Math.PI * (3 - Math.sqrt(5));
function sphere(i: number, n: number, r: number): [number, number, number] {
  const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), t = golden * i;
  return [Math.cos(t) * rad * r, y * r, Math.sin(t) * rad * r];
}

function layout(graph: Graph): Point[] {
  const dirs = new Set<string>();
  for (const n of graph.nodes) { const parts = (n.dir || '.').split('/'); for (let i = 1; i <= parts.length; i++) { const d = parts.slice(0, i).join('/'); if (d && d !== '.') dirs.add(d); } }
  const hubs = [...dirs].sort();
  const points: Point[] = [];
  const top = hubs.filter(d => !d.includes('/'));
  const byId = new Map<string, Point>();
  top.forEach((d, i) => { const [x, y, z] = sphere(i, top.length, 0.62); const p = { id: d, x, y, z, hub: true }; points.push(p); byId.set(d, p); });
  for (const d of hubs.filter(d => d.includes('/'))) {
    const parent = d.slice(0, d.lastIndexOf('/')), base = byId.get(parent)!, siblings = hubs.filter(h => h.startsWith(parent + '/') && !h.slice(parent.length + 1).includes('/'));
    const [x, y, z] = sphere(siblings.indexOf(d), siblings.length, 0.42);
    const p = { id: d, x: base.x * 1.35 + x, y: base.y * 1.35 + y, z: base.z * 1.35 + z, hub: true, parent };
    points.push(p); byId.set(d, p);
  }
  const groups = new Map<string, string[]>();
  for (const n of graph.nodes) { const d = n.dir && n.dir !== '.' ? n.dir : ''; groups.set(d, [...(groups.get(d) ?? []), n.path]); }
  for (const [d, files] of groups) {
    const hub = d ? byId.get(d) : undefined;
    files.forEach((path, i) => {
      const [x, y, z] = sphere(i, files.length, hub ? 0.2 : 0.24);
      points.push({ id: path, x: (hub?.x ?? 0) + x, y: (hub?.y ?? 0) + y, z: (hub?.z ?? 0) + z, hub: false, parent: d || undefined });
    });
  }
  return points;
}

export function createMap(canvas: HTMLCanvasElement, labels: HTMLElement | null, graph: Graph, options: { scale?: number; spin?: boolean; still?: boolean; offsetY?: number } = {}) {
  const ctx = canvas.getContext('2d')!;
  const points = layout(graph), byId = new Map(points.map(p => [p.id, p]));
  const imports = graph.edges.filter(e => byId.has(e.from) && byId.has(e.to));
  const lit = new Map<string, Tone>();
  const labelEls = new Map<string, HTMLSpanElement>();
  let held = false, reveal = options.still ? 1 : 0, angle = 0.6, spin = options.spin ?? true, running = false, visible = true, last = 0, w = 0, h = 0, dpr = 1;

  function resize() {
    const box = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    w = box.width; h = box.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }

  function project(p: Point) {
    const e = 1 - Math.pow(1 - reveal, 3);
    const x0 = p.x * e, y0 = p.y * e, z0 = p.z * e;
    const ca = Math.cos(angle), sa = Math.sin(angle), tilt = -0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
    const x = x0 * ca - z0 * sa, z1 = x0 * sa + z0 * ca;
    const y = y0 * ct - z1 * st, z = y0 * st + z1 * ct;
    const s = Math.min(w, h) * (options.scale ?? 0.62), depth = 2.6 / (2.6 + z);
    return { x: w / 2 + x * s * depth * 1.25, y: h * (0.5 + (options.offsetY ?? 0)) + y * s * depth, d: depth, z };
  }

  function draw() {
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const proj = new Map(points.map(p => [p.id, project(p)]));
    ctx.lineWidth = 1;
    for (const p of points) {
      if (!p.parent) continue; const a = proj.get(p.id)!, b = proj.get(p.parent)!;
      ctx.strokeStyle = `rgba(241,238,228,${0.07 * reveal * a.d})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const e of imports) {
      const a = proj.get(e.from)!, b = proj.get(e.to)!, hot = lit.has(e.from) || lit.has(e.to);
      ctx.strokeStyle = hot ? `rgba(241,238,228,${0.32 * reveal})` : `rgba(241,238,228,${0.09 * reveal * (a.d + b.d) / 2})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const order = [...points].sort((a, b) => proj.get(b.id)!.z - proj.get(a.id)!.z);
    for (const p of order) {
      const q = proj.get(p.id)!, tone = lit.get(p.id);
      if (tone) {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 22 * q.d);
        g.addColorStop(0, TONES[tone] + '66'); g.addColorStop(1, TONES[tone] + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 22 * q.d, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = reveal * (0.35 + 0.65 * Math.min(1, q.d));
      if (p.hub) { ctx.strokeStyle = 'rgba(241,238,228,.5)'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.2 * q.d, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.fillStyle = tone ? TONES[tone] : '#d9d5c9'; ctx.beginPath(); ctx.arc(q.x, q.y, (tone ? 4.2 : 2.4) * q.d, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (labels) for (const [id, el] of labelEls) { const q = proj.get(id); if (q) el.style.transform = `translate(${Math.round(q.x + 10)}px, ${Math.round(q.y - 9)}px)`; }
  }

  function frame(t: number) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (spin) angle += dt * 0.07;
    draw(); requestAnimationFrame(frame);
  }
  function start() { if (running || held || options.still || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function stop() { running = false; }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry!.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize(); start();

  return {
    setReveal(p: number) { reveal = Math.max(0, Math.min(1, p)); if (!running) draw(); },
    setAngle(a: number) { angle = a; if (!running) draw(); },
    light(path: string | undefined, tone: Tone, label = true) {
      if (!path || !byId.has(path)) return;
      lit.set(path, tone);
      if (labels && label && !labelEls.has(path)) { const el = document.createElement('span'); el.className = 'map-label'; el.textContent = path.split('/').pop()!; labels.append(el); labelEls.set(path, el); requestAnimationFrame(() => el.classList.add('on')); }
      labelEls.get(path)?.style.setProperty('--tone', TONES[tone]);
      if (!running) draw();
    },
    unlight(path: string) { lit.delete(path); labelEls.get(path)?.remove(); labelEls.delete(path); if (!running) draw(); },
    clear() { lit.clear(); for (const el of labelEls.values()) el.remove(); labelEls.clear(); if (!running) draw(); },
    has: (path?: string) => !!path && byId.has(path),
    pause() { held = true; stop(); },
    resume() { held = false; start(); },
  };
}
export type RepoMap = ReturnType<typeof createMap>;
