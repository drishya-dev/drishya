import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Agent, Operation, Projection, Prose } from '@drishya/contracts';
import type { Scene, SceneOp, ScenePassage } from '@drishya/scene';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { Markdown } from '../lib/markdown.tsx';
import { useApp } from '../state.ts';
import { CodeView, DiffView, Output, timeOf, useArtifact } from './common.tsx';

const WINDOW = 50;

export function History({ scene, projection }: { scene: Scene; projection: Projection }) {
  const mode = useApp((s) => s.mode);
  const follow = useApp((s) => s.follow);
  const selectedOp = useApp((s) => s.selectedOp);
  const focusObservationId = useApp((s) => s.focusObservationId);
  const set = useApp((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const [extra, setExtra] = useState(0);
  const [detachedStartId, setDetachedStartId] = useState<string | undefined>();
  const programmatic = useRef(false);
  const lastScrollTop = useRef(0);
  const userScrollUntil = useRef(0);
  const scrollFrame = useRef<number | undefined>(undefined);
  const olderAnchor = useRef<{ height: number; top: number } | undefined>(undefined);
  const readingAnchor = useRef<{ id: string; offset: number } | undefined>(undefined);
  const seenThrough = useRef(scene.total);

  const ops = useMemo(() => new Map(projection.operations.map((o) => [o.id, o])), [projection]);
  const prose = useMemo(() => new Map(projection.prose.map((p) => [p.id, p])), [projection]);
  const agents = useMemo(() => new Map(projection.agents.map((a) => [a.id, a])), [projection]);

  // Freeze the mounted starting point while reading earlier work. New passages append below;
  // they must not evict the passage under the reader as the recent-window edge advances.
  const recentStart = Math.max(0, scene.passages.length - WINDOW - extra);
  const anchoredStart = detachedStartId ? scene.passages.findIndex((ps) => ps.id === detachedStartId) : -1;
  const start = follow ? recentStart : Math.min(anchoredStart < 0 ? recentStart : anchoredStart, recentStart);
  const visible = scene.passages.slice(start);

  const rememberReading = () => {
    const el = ref.current;
    if (!el) return;
    const viewport = el.getBoundingClientRect();
    const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
    if (node?.dataset.passageId) readingAnchor.current = { id: node.dataset.passageId, offset: node.getBoundingClientRect().top - viewport.top };
  };

  const setScrollTop = (top: number) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = top;
    lastScrollTop.current = el.scrollTop;
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => { programmatic.current = false; scrollFrame.current = undefined; });
  };

  const restoreReading = () => {
    const el = ref.current;
    const anchor = readingAnchor.current;
    if (!el || follow || !anchor) return;
    const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.dataset.passageId === anchor.id);
    if (!node) return;
    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) > 0.5) setScrollTop(el.scrollTop + delta);
  };

  useLayoutEffect(() => {
    if (follow) {
      setDetachedStartId(undefined);
      setExtra(0);
      readingAnchor.current = undefined;
    } else {
      if (!readingAnchor.current) rememberReading();
      if (detachedStartId === undefined) setDetachedStartId(scene.passages[recentStart]?.id);
    }
  }, [follow]);

  // A late record can insert steps ahead of the reader. Restore the same captured passage
  // and pixel offset after React updates it, instead of trusting an old array index.
  useLayoutEffect(() => {
    restoreReading();
  }, [scene.passages, follow]);

  // Artifact content is fetched after a passage first mounts. Its late height must not move the
  // reader; while following, the same growth should keep the latest edge in view.
  useLayoutEffect(() => {
    const el = ref.current;
    const inner = el?.querySelector('.history-inner');
    if (!el || !inner) return;
    const observer = new ResizeObserver(() => {
      if (follow) setScrollTop(el.scrollHeight);
      else restoreReading();
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [follow]);

  useLayoutEffect(() => {
    if (follow) seenThrough.current = scene.total;
  }, [follow, scene.total]);

  // Prepending older passages must not move the line the reader was looking at.
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = olderAnchor.current;
    if (!el || !anchor) return;
    setScrollTop(anchor.top + el.scrollHeight - anchor.height);
    olderAnchor.current = undefined;
    rememberReading();
  }, [extra]);

  const targetIndex = scene.passages.findIndex((ps) =>
    selectedOp ? ps.ops.some((op) => op.id === selectedOp) : focusObservationId ?
      ps.ops.some((op) => ops.get(op.id)?.observationIds.includes(focusObservationId)) ||
      ps.prose.some((p) => prose.get(p.id)?.observationIds.includes(focusObservationId)) : false,
  );
  useLayoutEffect(() => {
    if (targetIndex >= 0 && targetIndex < start) setExtra(scene.passages.length - WINDOW - targetIndex);
  }, [targetIndex, scene.passages.length, start]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || targetIndex < 0) return;
    const passageId = scene.passages[targetIndex]?.id;
    const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((n) => n.dataset.passageId === passageId);
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const viewport = el.getBoundingClientRect();
    if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) node.scrollIntoView({ block: 'center', behavior: 'auto' });
    rememberReading();
  }, [selectedOp, focusObservationId, targetIndex, extra]);

  // Follow: keep the newest work in view. A deliberate scroll away turns following off.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !follow) return;
    setScrollTop(el.scrollHeight);
  }, [scene.step, follow, visible.length]);

  useLayoutEffect(() => () => { if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current); }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    if (performance.now() < userScrollUntil.current) rememberReading();
    const movedUp = el.scrollTop < lastScrollTop.current - 1;
    lastScrollTop.current = el.scrollTop;
    if (movedUp && follow && performance.now() < userScrollUntil.current) set({ follow: false, ...(mode === 'replay' ? { playing: false, held: true } : {}) });
  };

  const holdForSelection = () => {
    const selection = window.getSelection();
    const el = ref.current;
    if (!selection || selection.isCollapsed || !el?.contains(selection.anchorNode) || !el.contains(selection.focusNode)) return;
    rememberReading();
    if (follow) set({ follow: false, ...(mode === 'replay' ? { playing: false, held: true } : {}) });
  };

  return (
    <div className="history" ref={ref} onScroll={onScroll} onWheel={() => { userScrollUntil.current = performance.now() + 750; }} onPointerDown={(e) => { if (e.target === ref.current) userScrollUntil.current = performance.now() + 750; }} onKeyDown={(e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) userScrollUntil.current = performance.now() + 750; }} onPointerUp={holdForSelection} onKeyUp={holdForSelection} onCopy={holdForSelection}>
      <div className="history-inner">
        {start > 0 && (
          <button className="load-earlier" onClick={() => {
            const el = ref.current;
            if (el) olderAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
            set({ follow: false });
            setExtra(Math.max(0, scene.passages.length - WINDOW - Math.max(0, start - WINDOW)));
          }}>
            Show {Math.min(WINDOW, start)} earlier passages
          </button>
        )}
        {scene.passages.length === 0 && <div className="history-empty">No captured work in this view yet.</div>}
        {visible.map((ps) => (
          <PassageView key={ps.id} ps={ps} ops={ops} prose={prose} agent={agents.get(ps.agentId)} agents={projection.agents} focus={scene.focus?.passageId === ps.id} />
        ))}
      </div>
      {!follow && (
        <button className="follow-pill" onClick={() => { userScrollUntil.current = 0; set({ follow: true, selectedOp: undefined, focusObservationId: undefined, held: false }); }}>
          {mode === 'history' && scene.total > seenThrough.current ? `${scene.total - seenThrough.current} new steps · ` : ''}Back to latest ↓
        </button>
      )}
    </div>
  );
}

const PassageView = memo(function PassageView({ ps, ops, prose, agent, agents, focus }: { ps: ScenePassage; ops: Map<string, Operation>; prose: Map<string, Prose>; agent?: Agent; agents: Agent[]; focus: boolean }) {
  const color = agentColor(agent, agents);
  const first = ps.ops[0] ? ops.get(ps.ops[0].id) : undefined;
  return (
    <section data-passage-id={ps.id} className={`passage${ps.settled ? ' settled' : ''}${ps.matchesFilter ? '' : ' filtered-out'}${focus ? ' focus' : ''}`} style={{ '--agent': color } as React.CSSProperties}>
      {ps.turnPrompt && (
        <div className="turn">
          <span className="turn-who">You</span>
          <div className="turn-text">{ps.turnPrompt}</div>
        </div>
      )}
      {ps.ops.length > 0 && (
        <>
          <div className="passage-head">
            <span className="agent-dot" />
            <span className="passage-agent">{agentName(agent)}</span>
            {first?.startTime && <span className="passage-time">{timeOf(first.startTime)}</span>}
          </div>
          <div className="ops-row">
            {ps.ops.map((o, i) => {
              const op = ops.get(o.id);
              return op ? <OpCard key={o.id} so={o} op={op} index={i} /> : null;
            })}
          </div>
        </>
      )}
      {ps.prose.map((p) => {
        const pr = prose.get(p.id);
        return pr ? <ProseView key={p.id} pr={pr} arriving={p.arriving} agent={agent} /> : null;
      })}
    </section>
  );
});

function ProseView({ pr, arriving, agent }: { pr: Prose; arriving: boolean; agent?: Agent }) {
  const set = useApp((s) => s.set);
  const [open, setOpen] = useState(pr.role !== 'reasoning' || pr.text.length < 600);
  const label = pr.role === 'reasoning' ? (pr.exposure === 'summary' ? 'Reasoning summary' : 'Thinking') : undefined;
  return (
    <div className={`prose prose-${pr.role}${arriving ? ' arriving' : ''}`} aria-label={`${agentName(agent)} ${label ?? 'said'}`}>
      {label && (
        <button className="prose-label" onClick={() => { setOpen((o) => !o); set({ follow: false }); }} aria-expanded={open}>
          {label}
          {!open && ' · show'}
        </button>
      )}
      {open && <Markdown text={pr.text} onPath={(p) => set({ hoveredPath: p })} />}
      {pr.truncated && <div className="prose-trunc">Shortened for display — the full text is in the recording.</div>}
    </div>
  );
}

// ─── operation cards ─────────────────────────────────────────────────────────────────────

const OpCard = memo(function OpCard({ so, op, index }: { so: SceneOp; op: Operation; index: number }) {
  const selected = useApp((s) => s.selectedOp === op.id);
  const hoveredPath = useApp((s) => s.hoveredPath);
  const select = useApp((s) => s.select);
  const set = useApp((s) => s.set);
  const lit = !!hoveredPath && op.paths.some((p) => p.path === hoveredPath);
  const from = so.origin.type === 'map' ? 'from-map' : 'from-dock';
  const originLabel = so.origin.type === 'mcp' ? so.origin.server : KIND_LABEL[op.kind];
  return (
    <article
      data-op-id={op.id}
      className={`op op-${op.kind} st-${so.state} ph-${so.phase}${so.resolving ? ' resolving' : ''}${selected ? ' selected' : ''}${lit ? ' lit' : ''}${so.matchesFilter ? '' : ' filtered-out'} ${so.phase === 'arriving' ? from : ''}`}
      style={{ zIndex: selected ? 50 : 10 + index }}
      tabIndex={0}
      onClick={() => select(selected ? undefined : op.id)}
      onKeyDown={(e) => e.key === 'Enter' && select(op.id)}
      onMouseEnter={() => set({ hoveredOp: op.id, hoveredPath: op.paths.find((p) => p.role !== 'search-hit')?.path })}
      onMouseLeave={() => set({ hoveredOp: undefined, hoveredPath: undefined })}
      aria-label={op.title}
    >
      <header className="op-head">
        <span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`}>{originLabel}</span>
        <span className="op-title" title={op.title}>{op.title.replace(/^(Read|Edit|Write|Create|Search|Test ·|Run) /, '')}</span>
        <StateMark state={so.state} />
      </header>
      <div className="op-body">
        <OpPreview op={op} />
      </div>
      {op.classification.kind === 'derived' && <div className="op-foot" title={`Classified by rule ${op.classification.rule} from the command text`}>derived from {op.tool}</div>}
    </article>
  );
});

function StateMark({ state }: { state: SceneOp['state'] }) {
  if (state === 'running') return <span className="state state-running" aria-label="running" />;
  if (state === 'error') return <span className="state state-error" aria-label="failed">✕</span>;
  if (state === 'ok') return <span className="state state-ok" aria-label="done">✓</span>;
  return <span className="state state-unknown" aria-label="outcome not captured">?</span>;
}

function OpPreview({ op }: { op: Operation }) {
  const d = op.detail;
  switch (d.kind) {
    case 'read':
      return <ReadPreview artifactId={d.excerptArtifactId} start={d.startLine} path={d.path} />;
    case 'edit':
      return d.hunks.length ? <DiffView hunks={d.hunks} path={d.path} maxLines={9} /> : <div className="muted">{d.reconstructionNote ?? 'No change captured.'}</div>;
    case 'search':
      return (
        <div className="hits">
          <div className="query">{d.query}</div>
          {d.hits.slice(0, 5).map((h, i) => (
            <div key={i} className="hit">
              <span className="hit-path">{h.path}</span>
              {h.line !== undefined && <span className="hit-line">:{h.line}</span>}
            </div>
          ))}
          {d.hits.length > 5 && <div className="muted">{d.hits.length - 5} more</div>}
          {op.status !== 'running' && d.hits.length === 0 && <div className="muted">No matches</div>}
        </div>
      );
    case 'test': {
      const s = d.summary;
      return (
        <div className="test">
          <div className="cmd">$ {d.command}</div>
          {s ? (
            <div className="test-counts">
              {s.failed > 0 && <span className="bad">{s.failed} failed</span>}
              <span className="good">{s.passed} passed</span>
              {s.skipped > 0 && <span className="muted">{s.skipped} skipped</span>}
            </div>
          ) : op.status !== 'running' ? (
            <div className="muted">exit {d.exitCode ?? '?'}</div>
          ) : null}
          {s?.failures[0] && (
            <div className="failure">
              <div className="failure-name">{s.failures[0].name}</div>
              {s.failures[0].message && <div className="failure-msg">{s.failures[0].message}</div>}
            </div>
          )}
        </div>
      );
    }
    case 'shell':
      return (
        <div className="shell">
          <div className="cmd">$ {d.command.split('\n')[0]}{d.command.includes('\n') ? ' …' : ''}</div>
          {d.outputPreview && <Output text={d.outputPreview} maxLines={4} />}
          {d.exitCode !== undefined && d.exitCode !== 0 && d.exitCode !== null && <div className="bad">exit {d.exitCode}</div>}
        </div>
      );
    case 'mcp':
      return (
        <div className="mcp">
          <div className="mcp-tool">{d.tool}</div>
          <div className="mcp-input">{summarizeInput(d.input)}</div>
          {d.resultPreview && <div className="mcp-result">{d.resultPreview.slice(0, 220)}</div>}
        </div>
      );
    case 'web':
      return (
        <div className="web">
          <div className="query">{d.url ?? d.query}</div>
          {d.resultPreview && <div className="mcp-result">{d.resultPreview.slice(0, 200)}</div>}
        </div>
      );
    case 'spawn':
      return (
        <div className="spawn">
          <div className="query">{d.agentType ?? 'subagent'}</div>
          <div className="muted">{d.description}</div>
        </div>
      );
    case 'plan':
      return (
        <ul className="plan">
          {d.items.slice(0, 6).map((it, i) => (
            <li key={i} className={`plan-${it.status}`}>{it.text}</li>
          ))}
        </ul>
      );
    default:
      return <div className="mcp-input">{summarizeInput(d.input) || d.resultPreview?.slice(0, 200)}</div>;
  }
}

function ReadPreview({ artifactId, start, path }: { artifactId?: string; start: number; path: string }) {
  const { text, error, unavailable } = useArtifact(artifactId);
  if (!artifactId) return <div className="muted">Content not captured</div>;
  if (error) return <div className="muted">{error}</div>;
  if (unavailable) return <div className="muted">{unavailable}</div>;
  if (text === undefined) return <div className="skeleton" />;
  if (!text) return <div className="muted">Empty</div>;
  return <CodeView text={text} startLine={start} path={path} maxLines={8} />;
}

export function summarizeInput(input: unknown): string {
  if (input === undefined || input === null) return '';
  if (typeof input === 'string') return input.slice(0, 200);
  if (typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v)?.slice(0, 80)}`)
      .join('  ·  ');
  }
  return String(input);
}
