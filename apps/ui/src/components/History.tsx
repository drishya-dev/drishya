import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Agent, Operation, Projection, Prose } from '@drishya/contracts';
import type { Scene, SceneOp, ScenePassage } from '@drishya/scene';
import { passageWindow } from '../lib/history-window.ts';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { Markdown } from '../lib/markdown.tsx';
import { useApp } from '../state.ts';
import { CodeView, DiffView, Output, timeOf, useArtifact } from './common.tsx';
import { ArtifactReader, DiffReader } from './ArtifactReader.tsx';

export function History({ scene, projection }: { scene: Scene; projection: Projection }) {
  const mode = useApp((s) => s.mode);
  const follow = useApp((s) => s.follow);
  const selectedOp = useApp((s) => s.selectedOp);
  const expandedOp = useApp((s) => s.expandedOp);
  const focusObservationId = useApp((s) => s.focusObservationId);
  const set = useApp((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 900 });
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [focusedPassageId, setFocusedPassageId] = useState<string | undefined>();
  const measurements = useRef(new Map<string, number>());
  const programmatic = useRef(false);
  const lastScrollTop = useRef(0);
  const userScrollUntil = useRef(0);
  const scrollFrame = useRef<number | undefined>(undefined);
  const navigationFrame = useRef<number | undefined>(undefined);
  const navigating = useRef(false);
  const readingAnchor = useRef<{ id: string; offset: number } | undefined>(undefined);
  const pendingNavigation = useRef<string | undefined>(undefined);
  const lastNavigation = useRef<string | undefined>(undefined);
  const seenThrough = useRef(scene.total);

  const ops = useMemo(() => new Map(projection.operations.map((o) => [o.id, o])), [projection]);
  const prose = useMemo(() => new Map(projection.prose.map((p) => [p.id, p])), [projection]);
  const agents = useMemo(() => new Map(projection.agents.map((a) => [a.id, a])), [projection]);

  const targetIndex = scene.passages.findIndex((ps) =>
    selectedOp ? ps.ops.some((op) => op.id === selectedOp) : focusObservationId ?
      ps.ops.some((op) => ops.get(op.id)?.observationIds.includes(focusObservationId)) ||
      ps.prose.some((p) => prose.get(p.id)?.observationIds.includes(focusObservationId)) : false,
  );
  const targetId = scene.passages[targetIndex]?.id;
  const expandedId = scene.passages.find((ps) => ps.ops.some((op) => op.id === expandedOp))?.id;
  const ids = scene.passages.map((ps) => ps.id);
  const pinned = new Set([readingAnchor.current?.id, targetId, expandedId, focusedPassageId].filter((id): id is string => !!id));
  const layout = useMemo(() => passageWindow(ids, measurements.current, viewport.top, viewport.height, pinned),
    // IDs and pinning are recreated as scene and reader state change. Measurements need their own revision.
    [scene.passages, viewport, measurementVersion, targetId, expandedId, focusedPassageId, readingAnchor.current?.id]);

  const rememberReading = () => {
    const el = ref.current;
    if (!el) return;
    const viewport = el.getBoundingClientRect();
    const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.bottom > viewport.top + 1 && bounds.top < viewport.bottom;
    });
    readingAnchor.current = node?.dataset.passageId ? { id: node.dataset.passageId, offset: node.getBoundingClientRect().top - viewport.top } : undefined;
  };

  const setScrollTop = (top: number) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = top;
    lastScrollTop.current = el.scrollTop;
    setViewport((old) => old.top === el.scrollTop && old.height === el.clientHeight ? old : { top: el.scrollTop, height: el.clientHeight });
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => { programmatic.current = false; scrollFrame.current = undefined; });
  };

  const restoreReading = () => {
    const el = ref.current;
    const anchor = readingAnchor.current;
    if (!el || follow || !anchor || navigating.current) return;
    const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.dataset.passageId === anchor.id);
    if (!node) return;
    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) > 0.5) setScrollTop(el.scrollTop + delta);
  };

  useLayoutEffect(() => {
    if (follow) {
      readingAnchor.current = undefined;
    } else if (!readingAnchor.current) rememberReading();
  }, [follow]);

  // A late record can insert steps ahead of the reader. Restore the same captured passage
  // and pixel offset after React updates it, instead of trusting an old array index.
  useLayoutEffect(() => {
    restoreReading();
  }, [scene.passages, follow]);

  // A passage can grow after its artifact arrives or its width changes. Record the actual slot
  // height, then reflow spacers; preserve the captured passage/pixel anchor while detached.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.passageId;
        if (!id) continue;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        if (Math.abs((measurements.current.get(id) ?? 0) - height) > 0.5) {
          measurements.current.set(id, height);
          changed = true;
        }
      }
      if (changed) {
        setMeasurementVersion((n) => n + 1);
        if (follow) setScrollTop(el.scrollHeight);
        else restoreReading();
      }
    });
    for (const node of el.querySelectorAll<HTMLElement>('[data-passage-id]')) observer.observe(node);
    return () => observer.disconnect();
  }, [layout.runs, follow]);

  useLayoutEffect(() => {
    if (!follow && !readingAnchor.current) rememberReading();
  }, [layout]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewport((old) => old.height === el.clientHeight ? old : { top: el.scrollTop, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (follow) seenThrough.current = scene.total;
  }, [follow, scene.total]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !targetId) { lastNavigation.current = undefined; pendingNavigation.current = undefined; return; }
    if (targetId !== lastNavigation.current) {
      lastNavigation.current = targetId;
      pendingNavigation.current = targetId;
      set({ follow: false });
      setScrollTop(layout.prefix[targetIndex]!);
      return;
    }
    if (pendingNavigation.current !== targetId) return;
    const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((n) => n.dataset.passageId === targetId);
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const viewportBounds = el.getBoundingClientRect();
    if (bounds.top < viewportBounds.top || bounds.bottom > viewportBounds.bottom) setScrollTop(el.scrollTop + bounds.top - viewportBounds.top - (el.clientHeight - bounds.height) / 2);
    rememberReading();
    pendingNavigation.current = undefined;
  }, [targetId, targetIndex, layout]);

  // Follow: keep the newest work in view. A deliberate scroll away turns following off.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !follow) return;
    setScrollTop(el.scrollHeight);
  }, [scene.step, follow, layout.total]);

  useLayoutEffect(() => () => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    if (navigationFrame.current !== undefined) cancelAnimationFrame(navigationFrame.current);
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    navigating.current = true;
    rememberReading();
    const movedUp = el.scrollTop < lastScrollTop.current - 1;
    lastScrollTop.current = el.scrollTop;
    setViewport((old) => old.top === el.scrollTop && old.height === el.clientHeight ? old : { top: el.scrollTop, height: el.clientHeight });
    if (navigationFrame.current !== undefined) cancelAnimationFrame(navigationFrame.current);
    navigationFrame.current = requestAnimationFrame(() => {
      navigationFrame.current = requestAnimationFrame(() => {
        navigating.current = false;
        rememberReading();
        navigationFrame.current = undefined;
      });
    });
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
    <div className="history" ref={ref} onScroll={onScroll} onWheel={(e) => { userScrollUntil.current = performance.now() + 750; navigating.current = true; if (follow && e.deltaY < 0) { rememberReading(); set({ follow: false, ...(mode === 'replay' ? { playing: false, held: true } : {}) }); } }} onPointerDown={(e) => { if (e.target === ref.current) userScrollUntil.current = performance.now() + 750; }} onKeyDown={(e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) { userScrollUntil.current = performance.now() + 750; navigating.current = true; } }} onClickCapture={(e) => { if ((e.target as HTMLElement).closest('[data-expand-op]')) rememberReading(); }} onPointerUp={holdForSelection} onKeyUp={holdForSelection} onCopy={holdForSelection} onFocusCapture={(e) => setFocusedPassageId((e.target as HTMLElement).closest<HTMLElement>('[data-passage-id]')?.dataset.passageId)} onBlurCapture={(e) => { if (!(e.relatedTarget as HTMLElement | null)?.closest('[data-passage-id]')) setFocusedPassageId(undefined); }}>
      <div className="history-inner">
        {scene.passages.length === 0 && <div className="history-empty">No captured work in this view yet.</div>}
        {layout.runs.flatMap((run) => [
          ...(run.before > 0 ? [<div key={`gap-${run.start}`} aria-hidden="true" style={{ height: run.before }} />] : []),
          ...scene.passages.slice(run.start, run.end).map((ps) => (
            <div className="passage-slot" data-passage-id={ps.id} key={ps.id}>
              <PassageView ps={ps} ops={ops} prose={prose} agent={agents.get(ps.agentId)} agents={projection.agents} focus={scene.focus?.passageId === ps.id} />
            </div>
          )),
        ])}
        {layout.runs.length > 0 && <div aria-hidden="true" style={{ height: layout.total - layout.prefix[layout.runs.at(-1)!.end]! }} />}
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
  const expanded = useApp((s) => s.expandedOp === op.id);
  const hoveredPath = useApp((s) => s.hoveredPath);
  const select = useApp((s) => s.select);
  const set = useApp((s) => s.set);
  const lit = !!hoveredPath && op.paths.some((p) => p.path === hoveredPath);
  const from = so.origin.type === 'map' ? 'from-map' : 'from-dock';
  const originLabel = so.origin.type === 'mcp' ? so.origin.server : KIND_LABEL[op.kind];
  return (
    <article
      data-op-id={op.id}
      className={`op op-${op.kind} st-${so.state} ph-${so.phase}${so.resolving ? ' resolving' : ''}${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}${lit ? ' lit' : ''}${so.matchesFilter ? '' : ' filtered-out'} ${so.phase === 'arriving' ? from : ''}`}
      style={{ zIndex: selected ? 50 : 10 + index }}
      tabIndex={0}
      onClick={() => select(selected ? undefined : op.id)}
      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && select(op.id)}
      onMouseEnter={() => set({ hoveredOp: op.id, hoveredPath: op.paths.find((p) => p.role !== 'search-hit')?.path })}
      onMouseLeave={() => set({ hoveredOp: undefined, hoveredPath: undefined })}
      aria-label={op.title}
    >
      <header className="op-head">
        <span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`}>{originLabel}</span>
        <span className="op-title" title={op.title}>{op.title.replace(/^(Read|Edit|Write|Create|Search|Test ·|Run) /, '')}</span>
        <StateMark state={so.state} />
        {['read', 'edit', 'search', 'test', 'shell'].includes(op.detail.kind) && (
          <button data-expand-op={op.id} className="op-expand" aria-label={`${expanded ? 'Close' : 'Expand'} ${op.title} in history`} aria-expanded={expanded} onClick={(e) => {
            e.stopPropagation();
            set({ expandedOp: expanded ? undefined : op.id, selectedOp: undefined, follow: false, ...(expanded ? {} : { playing: false, held: true }) });
          }}>{expanded ? 'Close' : 'Expand'}</button>
        )}
      </header>
      {!expanded && <div className="op-body">
        <OpPreview op={op} />
      </div>}
      {expanded && <ExpandedOperation op={op} />}
      {op.classification.kind === 'derived' && <div className="op-foot" title={`Classified by rule ${op.classification.rule} from the command text`}>derived from {op.tool}</div>}
    </article>
  );
});

function ExpandedOperation({ op }: { op: Operation }) {
  const d = op.detail;
  const select = useApp((s) => s.select);
  switch (d.kind) {
    case 'read':
      return <div className="op-expanded read-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.path} · captured lines {d.startLine}–{d.startLine + Math.max(0, d.lineCount - 1)}{d.totalLines ? ` of ${d.totalLines}` : ''}</div>
        <ArtifactReader key={d.excerptArtifactId} id={d.excerptArtifactId} kind="code" startLine={d.startLine} path={d.path} />
      </div>;
    case 'edit':
      return <div className="op-expanded edit-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.path} · captured patch{d.reconstruction !== 'complete' ? ' · after-state not verified' : ''}</div>
        {d.hunks.length ? <DiffReader key={op.id} hunks={d.hunks} path={d.path} /> : <p className="muted">No change captured.</p>}
        <button className="material-more" onClick={() => select(op.id)}>Open provenance and file states</button>
      </div>;
    case 'search':
      return <div className="op-expanded search-material" onClick={(e) => e.stopPropagation()}>
        <div className="query">{d.query} · {d.total ?? d.hits.length} recorded result{(d.total ?? d.hits.length) === 1 ? '' : 's'}</div>
        {d.hits.slice(0, 50).map((hit, i) => <div className="hit" key={i}>{hit.path}{hit.line ? `:${hit.line}` : ''}{hit.text ? ` · ${hit.text}` : ''}</div>)}
        {d.hits.length > 50 && <div className="muted">{d.hits.length - 50} more recorded hits · open details to inspect all</div>}
      </div>;
    case 'test':
      return <div className="op-expanded test-material" onClick={(e) => e.stopPropagation()}>
        <div className="cmd">$ {d.command}</div>
        {d.summary ? <div className="test-counts"><span className="good">{d.summary.passed} passed</span><span className={d.summary.failed ? 'bad' : 'muted'}>{d.summary.failed} failed</span>{d.summary.skipped > 0 && <span>{d.summary.skipped} skipped</span>}<span className="muted">derived from output</span></div> : <div className="muted">Exit {d.exitCode ?? 'not captured'}</div>}
        {d.summary?.failures.map((failure, i) => <div className="failure" key={i}><div className="failure-name">{failure.name}</div>{failure.message && <div className="failure-msg">{failure.message}</div>}</div>)}
        <ArtifactReader key={d.outputArtifactId} id={d.outputArtifactId} kind="output" fallback={d.outputPreview} />
      </div>;
    case 'shell':
      return <div className="op-expanded shell-material" onClick={(e) => e.stopPropagation()}>
        <div className="cmd">$ {d.command}</div>
        <ArtifactReader key={d.outputArtifactId} id={d.outputArtifactId} kind="output" fallback={d.outputPreview} />
        <div className="muted small">Exit {d.exitCode ?? 'not captured'}</div>
      </div>;
    default:
      return null;
  }
}

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
  const { text, error, unavailable } = useArtifact(artifactId, { scope: 'preview' });
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
