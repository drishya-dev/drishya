import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Agent, Hunk, Operation, Projection, Prose } from '@drishya/contracts';
import type { Scene, SceneOp, ScenePassage } from '@drishya/scene';
import { ESTIMATED_PASSAGE_HEIGHT, passageWindow } from '../lib/history-window.ts';
import type { HistoryQuery } from '../../../../packages/scene/src/history.ts';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { Markdown } from '../lib/markdown.tsx';
import { useApp } from '../state.ts';
import { CodeView, DiffView, Output, CapturedTime, useArtifact } from './common.tsx';
import { ArtifactReader, DiffReader } from './ArtifactReader.tsx';
import { presentationOf, readingWidth } from '../lib/presentation.ts';
import { Origins } from './Origins.tsx';
import { MaterialGlyph } from './MaterialGlyph.tsx';
import { StructuredResult } from './StructuredResult.tsx';
import { TerminalPreview } from './TerminalPreview.tsx';
import { VerificationStrip } from './VerificationStrip.tsx';
import { firstChangeOffset } from '../lib/change-preview.ts';
import { FlowConnections } from './FlowConnections.tsx';
import { materialRect, materialIsMoving, moveMaterial } from '../lib/material-motion.ts';
import { useHoverReading } from '../lib/hover-reading.ts';
import { scrollsInsideMaterial } from '../lib/reading-scroll.ts';
import { NativeTurn } from './SessionWorkspace.tsx';
import { useExperience } from '../lib/experience.ts';
import { PromptRail } from './PromptRail.tsx';

export function History({ scene, projection, onWindow }: { scene: Scene; projection: Projection; onWindow?: (query: HistoryQuery) => Promise<void> }) {
  const mode = useApp((s) => s.mode);
  const compareAgents = useApp((s) => s.compareAgents);
  const explore = useApp((s) => s.explore);
  const theme = useApp((s) => s.theme);
  const lowResource = useApp((s) => s.lowResource);
  const follow = useApp((s) => s.follow);
  const selectedOp = useApp((s) => s.selectedOp);
  const expandedOp = useApp((s) => s.expandedOp);
  const hoveredOp = useApp((s) => s.hoveredOp);
  const focusObservationId = useApp((s) => s.focusObservationId);
  const promptStep = useApp((s) => s.promptStep);
  const set = useApp((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  useHoverReading(ref);
  const [viewport, setViewport] = useState({ top: 0, height: 900 });
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [focusedPassageId, setFocusedPassageId] = useState<string | undefined>();
  const measurements = useRef(new Map<string, number>());
  const programmatic = useRef(false);
  const lastScrollTop = useRef(0);
  const userScrollUntil = useRef(0);
  const pointerFocus = useRef(false);
  const scrollFrame = useRef<number | undefined>(undefined);
  const navigationFrame = useRef<number | undefined>(undefined);
  const navigating = useRef(false);
  const readingAnchor = useRef<{ id: string; offset: number } | undefined>(undefined);
  const readingAtStart = useRef(false);
  const pendingNavigation = useRef<string | undefined>(undefined);
  const lastNavigation = useRef<string | undefined>(undefined);
  const navigationBoundary = useRef<{ step: number; projection: Projection } | undefined>(undefined);
  const chapterNavigation = useRef<{ id: string; step: number } | undefined>(undefined);
  const seenThrough = useRef(scene.total);
  const followFrame = useRef<number | undefined>(undefined);
  const followingStarted = useRef(false);
  const requestedWindow = useRef('');
  const motion = useApp(s => s.motion);
  const materialPositions = useRef(new Map<string, DOMRect>());
  const isProgrammaticScroll = useCallback(() => programmatic.current && Math.abs((ref.current?.scrollTop ?? 0) - lastScrollTop.current) < .5, []);
  useLayoutEffect(() => {
    const history = ref.current;
    if (!history) return;
    const measure = () => {
      const next = new Map<string, DOMRect>();
      const viewportBounds = history.getBoundingClientRect();
      for (const card of history.querySelectorAll<HTMLElement>('article[data-op-id]')) {
        if (card.dataset.hoverReading) continue;
        const id = card.dataset.opId!;
        const r = materialRect(card);
        const stored = new DOMRect(r.left, r.top + history.scrollTop, r.width, r.height);
        const before = materialPositions.current.get(id);
        if (before && useApp.getState().motion && !lowResource && !matchMedia('(prefers-reduced-motion: reduce)').matches && !materialIsMoving(card) && r.bottom > viewportBounds.top && r.top < viewportBounds.bottom && [stored.x - before.x, stored.y - before.y, stored.width - before.width, stored.height - before.height].some(delta => Math.abs(delta) > 1)) {
          moveMaterial(card, new DOMRect(before.x, before.y - history.scrollTop, before.width, before.height), 300, 'surface-Reflow');
        }
        next.set(id, stored);
        if (next.size >= 80) break;
      }
      materialPositions.current = next;
    };
    measure();
    const observer = new ResizeObserver(measure);
    const inner = history.querySelector('.history-inner'); if (inner) observer.observe(inner);
    for (const card of history.querySelectorAll('article[data-op-id]')) observer.observe(card);
    return () => observer.disconnect();
  }, [scene.passages, follow, lowResource, measurementVersion, viewport.height]);

  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => { for (const card of ref.current?.querySelectorAll('article[data-op-id]') ?? []) for (const a of card.getAnimations()) if (a.id === 'surface-Reflow') a.cancel(); };
    if (!motion || lowResource) cancel();
    const changed = () => { if (preference.matches) cancel(); };
    preference.addEventListener('change', changed);
    const history = ref.current;
    // Cancel after hit testing; mouse-down cancellation can move the chosen
    // control before mouse-up and lose its click during a reflow.
    history?.addEventListener('click', cancel, true);
    history?.addEventListener('keydown', cancel);
    return () => { preference.removeEventListener('change', changed); history?.removeEventListener('click', cancel, true); history?.removeEventListener('keydown', cancel); };
  }, [motion, lowResource]);

  const ops = useMemo(() => new Map(projection.operations.map((o) => [o.id, o])), [projection]);
  const prose = useMemo(() => new Map(projection.prose.map((p) => [p.id, p])), [projection]);
  const agents = useMemo(() => new Map(projection.agents.map((a) => [a.id, a])), [projection]);

  useLayoutEffect(() => {
    const destination = chapterNavigation.current;
    if (!destination) return;
    if (scene.step !== destination.step) { chapterNavigation.current = undefined; return; }
    // Fetching an older chapter replaces the projection without adding work.
    // Adopt that page before Follow can mistake it for a new live result.
    navigationBoundary.current = { step: scene.step, projection };
    if (scene.passages.some(ps => ps.id === destination.id && !ps.unloaded)) chapterNavigation.current = undefined;
  }, [scene.passages, scene.step, projection]);

  const targetIndex = scene.passages.findIndex((ps) =>
    selectedOp ? ps.ops.some((op) => op.id === selectedOp) : focusObservationId ?
      ps.ops.some((op) => ops.get(op.id)?.observationIds.includes(focusObservationId)) ||
      ps.prose.some((p) => prose.get(p.id)?.observationIds.includes(focusObservationId)) : promptStep !== undefined ? ps.id === projection.passages.find(p => p.firstStep >= promptStep - 1)?.id : false,
  );
  const targetId = scene.passages[targetIndex]?.id;
  const expandedId = scene.passages.find((ps) => ps.ops.some((op) => op.id === expandedOp))?.id;
  const ids = scene.passages.map((ps) => ps.id);
  const hoverPassageId = scene.passages.find(ps => ps.ops.some(op => op.id === hoveredOp))?.id;
  const pinned = new Set([readingAnchor.current?.id, targetId, expandedId, focusedPassageId, hoverPassageId].filter((id): id is string => !!id));
  const layout = useMemo(() => passageWindow(ids, measurements.current, viewport.top, viewport.height, pinned, lowResource ? 300 : 900),
    // IDs and pinning are recreated as scene and reader state change. Measurements need their own revision.
    [scene.passages, viewport, measurementVersion, targetId, expandedId, focusedPassageId, hoverPassageId, readingAnchor.current?.id, lowResource]);

  useLayoutEffect(() => {
    // A selection can end outside history. Do not leave following locked by a
    // pointer release that never bubbles through the history element.
    const release = () => { pointerFocus.current = false; };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', release);
    };
  }, []);

  useLayoutEffect(() => {
    if (!onWindow) return;
    const visible = passageWindow(ids, measurements.current, viewport.top, viewport.height, new Set(), lowResource ? 300 : 900);
    const missing = visible.runs.flatMap((run) => Array.from({ length: run.end - run.start }, (_, i) => run.start + i))
      .find((i) => scene.passages[i]?.unloaded);
    if (missing === undefined) { requestedWindow.current = ''; return; }
    const start = Math.max(0, missing - 8);
    const key = `${scene.step}:${start}`;
    if (requestedWindow.current === key) return;
    requestedWindow.current = key;
    void onWindow({ start, count: 32, pinnedPassageIds: [...pinned].slice(0, 3) }).catch((error) => {
      requestedWindow.current = '';
      set({ error: error.message });
    });
  }, [scene.passages, scene.step, viewport, measurementVersion, onWindow]);

  const rememberReading = () => {
    const el = ref.current;
    if (!el) return;
    const viewport = el.getBoundingClientRect();
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')].find((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.bottom > viewport.top + 1 && bounds.top < viewport.bottom;
    });
    // The start boundary exists even while virtualization has no mounted passage there.
    readingAtStart.current = el.scrollTop < 1 || navigating.current && readingAtStart.current;
    readingAnchor.current = node?.dataset.passageId ? { id: node.dataset.passageId, offset: node.getBoundingClientRect().top - viewport.top } : undefined;
    if (useApp.getState().readingPassageId !== readingAnchor.current?.id) set({ readingPassageId: readingAnchor.current?.id });
  };

  const setScrollTop = (top: number) => {
    const el = ref.current;
    // Focus can pin a passage and trigger measurements during a pointer press.
    // Never move its control before release has delivered the activation.
    if (!el || pointerFocus.current) return;
    if (followFrame.current !== undefined) cancelAnimationFrame(followFrame.current);
    followFrame.current = undefined;
    programmatic.current = true;
    el.scrollTop = top;
    lastScrollTop.current = el.scrollTop;
    setViewport((old) => old.top === el.scrollTop && old.height === el.clientHeight ? old : { top: el.scrollTop, height: el.clientHeight });
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => { programmatic.current = false; scrollFrame.current = undefined; });
  };

  const followLatest = () => {
    const boundary = navigationBoundary.current;
    if (boundary?.step === scene.step && boundary.projection === projection) return;
    const el = ref.current;
    if (!el || !useApp.getState().follow || pointerFocus.current) return;
    if (!followingStarted.current || !motion || lowResource || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      followingStarted.current = true;
      setScrollTop(el.scrollHeight);
      return;
    }
    if (followFrame.current !== undefined) return;
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = undefined;
    let previousTime = performance.now();
    const tick = (time: number) => {
      followFrame.current = undefined;
      if (!ref.current || !useApp.getState().follow || pointerFocus.current) { programmatic.current = false; return; }
      const target = Math.max(0, el.scrollHeight - el.clientHeight);
      const gap = target - el.scrollTop;
      const elapsed = Math.min(48, Math.max(1, time - previousTime)); previousTime = time;
      programmatic.current = true;
      // Native scroll offsets may round subpixel writes to the same pixel at high
      // refresh rates. Guarantee progress so the finite camera actually settles.
      const advance = Math.sign(gap) * Math.max(1, Math.abs(gap) * (1 - Math.exp(-elapsed / 45)));
      el.scrollTop = Math.abs(gap) < 1 ? target : el.scrollTop + advance;
      lastScrollTop.current = el.scrollTop;
      // Virtualization needs window updates, not a React render on every camera frame.
      setViewport(old => Math.abs(old.top - el.scrollTop) > 120 || Math.abs(gap) < 1 ? { top: el.scrollTop, height: el.clientHeight } : old);
      if (Math.abs(gap) >= 1) followFrame.current = requestAnimationFrame(tick);
      else scrollFrame.current = requestAnimationFrame(() => { programmatic.current = false; scrollFrame.current = undefined; });
    };
    followFrame.current = requestAnimationFrame(tick);
  };

  const restoreReading = () => {
    const el = ref.current;
    const anchor = readingAnchor.current;
    const boundary = navigationBoundary.current;
    const atDestination = boundary?.step === scene.step && boundary.projection === projection;
    if (!el || follow && !atDestination || navigating.current) return;
    // At the document start, late allocation changes must preserve the boundary,
    // rather than pull the reader down to an old first-passage pixel offset.
    if (readingAtStart.current) { if (el.scrollTop > .5) setScrollTop(0); return; }
    if (!anchor) return;
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')].find((item) => item.dataset.passageId === anchor.id);
    if (!node) return;
    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) > 0.5) setScrollTop(el.scrollTop + delta);
  };

  useLayoutEffect(() => {
    if (follow) {
      readingAnchor.current = undefined; readingAtStart.current = false;
    } else {
      if (followFrame.current !== undefined) cancelAnimationFrame(followFrame.current);
      followFrame.current = undefined;
      if (!readingAnchor.current) rememberReading();
    }
  }, [follow]);

  // A late record can insert steps ahead of the reader. Restore the same captured passage
  // and pixel offset after React updates it, instead of trusting an old array index.
  useLayoutEffect(() => {
    restoreReading();
  }, [scene.passages, follow, compareAgents, explore, theme]);

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
        // Measurements may resolve while a button is pressed. Keep the current spacer
        // layout until activation; rebuilding it now can put another passage under it.
        if (pointerFocus.current) return;
        setMeasurementVersion((n) => n + 1);
        // A burst can detach follow before this observer's closure is replaced.
        if (useApp.getState().follow && !(navigationBoundary.current?.step === scene.step && navigationBoundary.current.projection === projection)) {
          followLatest();
        }
        else requestAnimationFrame(() => restoreReading());
      }
    });
    // The inner section repeats the same identity but has a different height. Measuring both
    // alternates the stored height and can create an endless scroll/resize feedback loop.
    for (const node of el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')) observer.observe(node);
    return () => observer.disconnect();
  }, [layout.runs, follow, mode]);

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
    const el = ref.current;
    if (!el || !targetId) { lastNavigation.current = undefined; pendingNavigation.current = undefined; return; }
    if (targetId !== lastNavigation.current) {
      lastNavigation.current = targetId;
      pendingNavigation.current = targetId;
      navigationBoundary.current = { step: scene.step, projection };
      readingAtStart.current = false;
      setScrollTop(layout.prefix[targetIndex]!);
      return;
    }
    if (pendingNavigation.current !== targetId) return;
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')].find((n) => n.dataset.passageId === targetId);
    if (!node) return;
    // Bring the selected action itself into view: a tall passage centred as a whole can leave
    // its first action above the viewport. Taller-than-viewport material aligns to its top.
    const selected = selectedOp ? [...node.querySelectorAll<HTMLElement>('[data-op-id]')].find((n) => n.dataset.opId === selectedOp) : undefined;
    const bounds = (selected ?? node).getBoundingClientRect();
    const viewportBounds = el.getBoundingClientRect();
    if (bounds.top < viewportBounds.top || bounds.bottom > viewportBounds.bottom) setScrollTop(el.scrollTop + bounds.top - viewportBounds.top - Math.max(16, (el.clientHeight - bounds.height) / 2));
    // Anchor reading to the navigated passage itself. Passages above may still carry estimated
    // heights; anchoring to whichever slot was first visible let their measurement pull the
    // reader away from the action just opened.
    readingAnchor.current = { id: targetId, offset: node.getBoundingClientRect().top - el.getBoundingClientRect().top };
    if (useApp.getState().readingPassageId !== targetId) set({ readingPassageId: targetId });
    pendingNavigation.current = undefined;
  }, [targetId, targetIndex, layout, selectedOp]);

  // Follow remains active across bursts and late artifacts. Only deliberate reading
  // detaches it; live capture and the replay clock advance independently.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!follow) { navigationBoundary.current = undefined; return; }
    const boundary = navigationBoundary.current;
    // A clicked destination stays readable until genuinely new captured work arrives.
    // Keep the Follow preference on; layout measurements alone must not undo navigation.
    if (boundary?.step === scene.step && boundary.projection === projection) return;
    navigationBoundary.current = undefined;
    if (follow) {
      followLatest();
      seenThrough.current = scene.total;
    }
  }, [scene.step, follow, layout.total, mode, projection]);

  useLayoutEffect(() => () => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    if (navigationFrame.current !== undefined) cancelAnimationFrame(navigationFrame.current);
    if (followFrame.current !== undefined) cancelAnimationFrame(followFrame.current);
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    // Even a programmatic scroll changes the required data window. A reader can scroll
    // again before its one-frame guard clears; skipping the viewport leaves unloaded work.
    setViewport((old) => old.height !== el.clientHeight || Math.abs(old.top - el.scrollTop) > (programmatic.current ? 120 : .5) ? { top: el.scrollTop, height: el.clientHeight } : old);
    if (programmatic.current && Math.abs(el.scrollTop - lastScrollTop.current) < 0.5) return;
    if (follow && performance.now() >= userScrollUntil.current) return;
    navigating.current = true;
    rememberReading();
    const movedUp = el.scrollTop < lastScrollTop.current - 1;
    lastScrollTop.current = el.scrollTop;
    setViewport((old) => old.top === el.scrollTop && old.height === el.clientHeight ? old : { top: el.scrollTop, height: el.clientHeight });
    if (navigationFrame.current !== undefined) cancelAnimationFrame(navigationFrame.current);
    navigationFrame.current = requestAnimationFrame(() => {
      navigationFrame.current = requestAnimationFrame(() => {
        navigating.current = false;
        // Capture can finish while a user scroll is settling. Restore the anchor recorded
        // by that scroll; adopting the reflowed position here would silently lose it.
        restoreReading();
        navigationFrame.current = undefined;
      });
    });
    if (movedUp && follow && performance.now() < userScrollUntil.current) set({ follow: false });
  };

  const prompts = scene.passages.flatMap((ps, index) => ps.turnPrompt ? [{ ps, index }] : []);
  const readingIndex = Math.max(0, layout.prefix.findIndex((_, index) => index < scene.passages.length && layout.prefix[index + 1]! > viewport.top + 1));
  const activePrompt = prompts.findLast(item => item.index <= readingIndex)?.ps.id ?? prompts[0]?.ps.id;

  const holdForSelection = (event: React.SyntheticEvent) => {
    if ((event.target as HTMLElement).closest('button, input, select, a')) return;
    const selection = window.getSelection();
    const el = ref.current;
    if (!selection || selection.isCollapsed || !el?.contains(selection.anchorNode) || !el.contains(selection.focusNode)) return;
    setMeasurementVersion((n) => n + 1);
    rememberReading();
  };

  return (
    <>
    <div className="history" ref={ref} onPointerDownCapture={() => { pointerFocus.current = true; }} onPointerUpCapture={() => { pointerFocus.current = false; }} onPointerCancelCapture={() => { pointerFocus.current = false; }} onScroll={onScroll} onWheel={(e) => {
      if (scrollsInsideMaterial(e.target)) { e.stopPropagation(); return; }
      userScrollUntil.current = performance.now() + 750;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (ref.current?.clientHeight ?? 1) : 1;
      const reachesStart = e.deltaY < 0 && (ref.current?.scrollTop ?? 0) + e.deltaY * unit <= 0;
      readingAtStart.current = reachesStart;
      // A forwarded hover wheel updates Follow before the native scroll event.
      // Do not restore its old anchor in the intervening React layout commit.
      navigating.current = true;
      if (follow && e.deltaY < 0) { rememberReading(); if (reachesStart) readingAtStart.current = true; set({ follow: false }); }
      if (navigationFrame.current !== undefined) cancelAnimationFrame(navigationFrame.current);
      navigationFrame.current = requestAnimationFrame(() => {
        navigationFrame.current = requestAnimationFrame(() => {
          rememberReading(); navigating.current = false; restoreReading(); navigationFrame.current = undefined;
        });
      });
    }} onPointerDown={(e) => { if (e.target === ref.current || e.pointerType === 'touch' && !scrollsInsideMaterial(e.target) && !(e.target as HTMLElement).closest('button, input, select, a')) { userScrollUntil.current = performance.now() + 750; readingAtStart.current = false; } }} onKeyDown={(e) => { pointerFocus.current = false; if (scrollsInsideMaterial(e.target)) return; if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) readingAtStart.current = false; if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) { userScrollUntil.current = performance.now() + 750; if (follow) { rememberReading(); set({ follow: false }); } } }} onClickCapture={(e) => {
      // Pin the interacted material after activation without disabling Follow.
      if ((e.target as HTMLElement).closest('button, input, select, a')) {
        const id = (e.target as HTMLElement).closest<HTMLElement>('[data-passage-id]')?.dataset.passageId;
        rememberReading();
        // External-store updates can flush before the target's click handler. Defer
        // pinning/reflow until activation has delivered its own reading action.
        queueMicrotask(() => {
          if (!ref.current) return;
          setFocusedPassageId(id);
          setMeasurementVersion((n) => n + 1);
        });
      }
    }} onPointerUp={holdForSelection} onKeyUp={holdForSelection} onCopy={holdForSelection} onFocusCapture={(e) => { if (scrollsInsideMaterial(e.target) && !(e.target as HTMLElement).closest('button, input, select, a')) return; if (pointerFocus.current && (e.target as HTMLElement).closest('button, input, select, a')) return; const id = (e.target as HTMLElement).closest<HTMLElement>('[data-passage-id]')?.dataset.passageId; setFocusedPassageId(id); if (id) rememberReading(); }} onBlurCapture={(e) => { if (!(e.relatedTarget as HTMLElement | null)?.closest('[data-passage-id]')) setFocusedPassageId(undefined); }}>
      {/* Keep the document extent stable while React replaces disjoint virtual runs.
          Otherwise removing a spacer can clamp native scroll to the pinned old work. */}
      <div className="history-inner"><div style={{ minHeight: layout.total }}>
        {scene.passages.length === 0 && <div className="history-empty">No captured work in this view yet.</div>}
        {layout.runs.flatMap((run) => [
          ...(run.before > 0 ? [<div key={`gap-${run.start}`} aria-hidden="true" style={{ height: run.before }} />] : []),
          ...scene.passages.slice(run.start, run.end).map((ps) => (
            <div className="passage-slot" data-passage-id={ps.id} key={ps.id}>
              {ps.unloaded ? <div className="muted" style={{ minHeight: ESTIMATED_PASSAGE_HEIGHT }} aria-busy="true">Loading captured work…</div> : <PassageView ps={ps} ops={ops} prose={prose} agent={agents.get(ps.agentId)} agents={projection.agents} focus={scene.focus?.passageId === ps.id} />}
            </div>
          )),
        ])}
        {layout.runs.length > 0 && <div aria-hidden="true" style={{ height: layout.total - layout.prefix[layout.runs.at(-1)!.end]! }} />}
      </div>
      <NativeTurn projection={projection} />
      </div>
      <Origins scene={scene} projection={projection} isProgrammaticScroll={isProgrammaticScroll} />
      <FlowConnections projection={projection} />
    </div>
      {mode === 'history' && prompts.length > 0 && <PromptRail chapters={prompts.map(({ ps, index }) => ({ id: ps.id, label: ps.turnPrompt!, index }))} activeId={activePrompt} open={({ id, index }) => {
          const ps = scene.passages[index]!;
          set({ selectedOp: undefined, expandedOp: undefined, focusObservationId: undefined, promptStep: undefined, readingPassageId: ps.id });
          navigationBoundary.current = { step: scene.step, projection };
          chapterNavigation.current = onWindow && ps.unloaded ? { id: ps.id, step: scene.step } : undefined;
          setFocusedPassageId(ps.id);
          readingAnchor.current = { id: ps.id, offset: 0 }; readingAtStart.current = false;
          setScrollTop(layout.prefix[index]!);
          if (onWindow && ps.unloaded) void onWindow({ start: Math.max(0, index - 8), count: 32, pinnedPassageIds: [ps.id] }).catch(error => set({ error: error.message }));
        }} />}
      {(!follow || navigationBoundary.current?.step === scene.step && navigationBoundary.current.projection === projection) && (
        <button className="follow-pill" aria-label={`${mode === 'history' && scene.total > seenThrough.current ? `${scene.total - seenThrough.current} new steps · ` : ''}Back to latest`} title="Back to latest" onClick={() => {
          userScrollUntil.current = 0;
          navigationBoundary.current = undefined; readingAnchor.current = undefined; readingAtStart.current = false;
          setFocusedPassageId(undefined);
          requestAnimationFrame(() => followLatest());
          set({ follow: true, selectedOp: undefined, focusObservationId: undefined, promptStep: undefined, held: false });
          // Return the camera to the current replay/live edge, without stopping its clock.
        }}>
          ↓
        </button>
      )}
    </>
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
            {agents.length > 1 && <><span className="agent-dot" /><span className="passage-agent">{agentName(agent)}</span></>}
            {first?.startTime && <CapturedTime iso={first.startTime} />}
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
  const detail = useApp(s => s.reasoningDetail);
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(detail === 'expanded'), [detail]);
  const [full, setFull] = useState(false);
  const prose = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = prose.current;
    if (!root || !arriving || !useApp.getState().motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations = [...root.querySelectorAll(':scope > p, :scope > ul, :scope > pre')].slice(0, 12).map((el, i) => el.animate([{ opacity: .12, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: Math.min(480, i * 40), fill: 'backwards', easing: 'ease-out' }));
    const cancel = () => animations.forEach(a => a.cancel());
    root.addEventListener('pointerdown', cancel); window.addEventListener('keydown', cancel);
    return () => { cancel(); root.removeEventListener('pointerdown', cancel); window.removeEventListener('keydown', cancel); };
  }, [arriving, pr.id]);
  const label = pr.role === 'reasoning' ? (pr.exposure === 'summary' ? 'Reasoning summary' : 'Thinking') : undefined;
  if (label && detail === 'hidden') return null;
  return (
    <div ref={prose} data-prose-id={pr.id} data-agent-id={pr.agentId} className={`prose prose-${pr.role}${arriving ? ' arriving' : ''}`} aria-label={`${agentName(agent)} ${label ?? 'said'}`}>
      {label && (
        <button className="prose-label" onClick={() => { setOpen((o) => !o); }} aria-expanded={open}>
          {label}
          {open ? ' · collapse' : ' · show'}
        </button>
      )}
      {open && <Markdown text={pr.text} onPath={(p) => set({ hoveredPath: p })} />}
      {pr.truncated && <><button className="material-more" onClick={() => { setFull((value) => !value); }}>{full ? 'Close full captured text' : 'Preview · read full captured text'}</button>{full && <ArtifactReader id={`art_${pr.id}_prose`} kind="output" />}</>}
    </div>
  );
}

// ─── operation cards ─────────────────────────────────────────────────────────────────────

const OpCard = memo(function OpCard({ so, op, index }: { so: SceneOp; op: Operation; index: number }) {
  const experience = useExperience();
  const card = useRef<HTMLElement>(null);
  const selected = useApp((s) => s.selectedOp === op.id);
  const expanded = useApp((s) => s.expandedOp === op.id);
  const hoveredPath = useApp((s) => s.hoveredPath);
  const select = useApp((s) => s.select);
  const set = useApp((s) => s.set);
  const lit = !!hoveredPath && op.paths.some((p) => p.path === hoveredPath);
  const from = so.origin.type === 'map' ? 'from-map' : 'from-dock';
  const presentation = presentationOf(op);
  const [sourceWidth, setSourceWidth] = useState<number>();
  const measureSource = useCallback((text: string) => setSourceWidth(Math.max(280, Math.min(420, readingWidth(...text.split('\n').slice(0, 12))))), []);
  const readingAllocation = presentation.width ?? sourceWidth;
  const originLabel = so.origin.type === 'mcp' ? so.origin.server : KIND_LABEL[op.kind];
  return (
    <article ref={card}
      data-op-id={op.id}
      data-material={presentation.material}
      data-origin={so.origin.type}
      className={`op op-${op.kind} shape-${presentation.shape} material-${presentation.material} st-${so.state} ph-${so.phase}${so.resolving ? ' resolving' : ''}${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}${lit ? ' lit' : ''}${so.matchesFilter ? '' : ' filtered-out'} ${so.phase === 'arriving' ? from : ''}`}
      style={{ zIndex: selected ? 50 : 10 + index, ...(readingAllocation ? { '--reading-width': `${readingAllocation}px` } : {}) } as React.CSSProperties}
      tabIndex={0}
      onClick={(e) => {
        // Reading or selecting captured content must not open an inspector and reflow
        // the text between pointer events. The heading and Enter still inspect it.
        if ((e.target as HTMLElement).closest('.op-body, .op-expanded')) return;
        select(selected ? undefined : op.id);
      }}
      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && select(op.id)}
      onMouseEnter={() => set({ hoveredOp: op.id, hoveredPath: op.paths.find((p) => p.role !== 'search-hit')?.path })}
      onMouseLeave={e => { if (e.currentTarget.dataset.hoverReading !== 'focused') set({ hoveredOp: undefined, hoveredPath: undefined }); }}
      aria-label={op.title}
    >
      <header className="op-head">
        <MaterialGlyph material={presentation.material} />
        {experience !== 'legacy' ? <span className="studio-action-identity"><span className="op-title" title={op.title}>{op.title.replace(/^(Read|Edit|Write|Create|Search|Test ·|Run) /, '')}</span><span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`}>{originLabel}<span aria-hidden="true"> · </span>{op.tool}</span></span> : <><span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`} title={so.origin.type === 'map' ? `File reference: ${so.origin.path}` : so.origin.type === 'mcp' ? `Observed MCP server: ${so.origin.server}` : `Observed tool: ${op.tool}`}>{originLabel}</span><span className="op-title" title={op.title}>{op.title.replace(/^(Read|Edit|Write|Create|Search|Test ·|Run) /, '')}</span></>}
        <StateMark state={so.state} />
        {['read', 'edit', 'search', 'test', 'shell', 'mcp', 'web', 'other'].includes(op.detail.kind) && (
          <button data-expand-op={op.id} className="op-expand" aria-label={`${expanded ? 'Close' : 'Expand'} ${op.title} in history`} aria-expanded={expanded} onClick={(e) => {
            e.stopPropagation();
            set({ expandedOp: expanded ? undefined : op.id, selectedOp: undefined });
          }}>{expanded ? 'Close' : 'Expand'}</button>
        )}
      </header>
      {!expanded && <div className="op-body">
        <OpPreview op={op} resolving={so.resolving} onSource={measureSource} />
      </div>}
      {expanded && <ExpandedOperation op={op} />}
      {!expanded && op.artifactIds.some((id) => id.endsWith('_input')) && <div className="material-context">Captured input preview · expand for full text</div>}
      {op.classification.kind === 'derived' && <div className="op-foot" title={`Classified by rule ${op.classification.rule} from the command text`}>derived from {op.tool}</div>}
    </article>
  );
});

function ExpandedOperation({ op }: { op: Operation }) {
  const d = op.detail;
  const select = useApp((s) => s.select);
  const input = op.artifactIds.find((id) => id.endsWith('_input'));
  switch (d.kind) {
    case 'read':
      return <div className="op-expanded read-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.path} · historical source at this action</div>
        <ArtifactReader key={d.excerptArtifactId} id={d.excerptArtifactId} kind="code" startLine={d.startLine} path={d.path} provenance />
      </div>;
    case 'edit':
      return <div className="op-expanded edit-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.path} · captured patch{d.reconstruction !== 'complete' ? ' · after-state not verified' : ''}</div>
        {d.hunks.length ? <DiffReader key={op.id} hunks={d.hunks} path={d.path} /> : op.artifactIds.some(id => id.endsWith('_after')) ? <ArtifactReader id={op.artifactIds.find(id => id.endsWith('_after'))} kind="code" path={d.path} provenance /> : <p className="muted">No source bytes or patch captured.</p>}
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
        {input && <ArtifactReader id={input} kind="code" />}
        {d.summary ? <div className="test-counts"><span className="good">{d.summary.passed} passed</span><span className={d.summary.failed ? 'bad' : 'muted'}>{d.summary.failed} failed</span>{d.summary.skipped > 0 && <span>{d.summary.skipped} skipped</span>}<span className="muted">derived from output</span></div> : <div className="muted">Exit {d.exitCode ?? 'not captured'}</div>}
        {d.summary?.failures.map((failure, i) => <div className="failure" key={i}><div className="failure-name">{failure.name}</div>{failure.message && <div className="failure-msg">{failure.message}</div>}</div>)}
        <ArtifactReader key={d.outputArtifactId} id={d.outputArtifactId} kind="output" fallback={d.outputPreview} />
      </div>;
    case 'shell':
      return <div className="op-expanded shell-material" onClick={(e) => e.stopPropagation()}>
        <div className="cmd">$ {d.command}</div>
        {input && <ArtifactReader id={input} kind="code" />}
        <ArtifactReader key={d.outputArtifactId} id={d.outputArtifactId} kind="output" fallback={d.outputPreview} />
        <div className="muted small">Exit {d.exitCode ?? 'not captured'}</div>
      </div>;
    case 'mcp':
      return <div className="op-expanded mcp-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.server} / {d.tool} · captured input</div>
        <pre className="json">{JSON.stringify(d.input, null, 2) ?? String(d.input)}</pre>
        <div className="material-context">Captured result preview</div>
        <StructuredResult text={d.resultPreview || (op.status === 'running' ? 'Waiting for result' : 'No result content captured')} />
      </div>;
    case 'web':
      return <div className="op-expanded web-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.url ?? d.query ?? 'Web request'}</div>
        <div className="material-context">Captured result preview</div>
        <pre className="output">{d.resultPreview || (op.status === 'running' ? 'Waiting for result' : 'No result content captured')}</pre>
      </div>;
    case 'other':
      return <div className="op-expanded other-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">Captured input</div>
        <pre className="json">{JSON.stringify(d.input, null, 2) ?? String(d.input)}</pre>
        <div className="material-context">Captured result preview</div>
        <pre className="output">{d.resultPreview || (op.status === 'running' ? 'Waiting for result' : 'No result content captured')}</pre>
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

function ResultArea({ state, resolving, children }: { state: Operation['status']; resolving: boolean; children?: React.ReactNode }) {
  return <div className={`result-area${resolving ? ' result-arriving' : ''}`}>
    <span className="result-lead" aria-hidden="true">↳</span>
    <div className="result-content">{children ?? <span className="muted">{state === 'running' ? 'Waiting for result' : 'No result content captured'}</span>}</div>
  </div>;
}

function OpPreview({ op, resolving, onSource }: { op: Operation; resolving: boolean; onSource?: (text: string) => void }) {
  const d = op.detail;
  const set = useApp((s) => s.set);
  switch (d.kind) {
    case 'read':
      return <>
        <div className="request-line excerpt-range">{op.status === 'running' ? <>Requested from line {d.startLine}{d.lineCount > 0 ? ` through ${d.startLine + d.lineCount - 1}` : ''} · awaiting excerpt</> : 'Historical source · recorded result'}</div>
        <ResultArea state={op.status} resolving={resolving}>{op.status === 'running' && !d.excerptArtifactId ? <PendingResult /> : <ReadPreview onSource={onSource} opId={op.id} artifactId={d.excerptArtifactId} start={d.startLine} path={d.path} />}</ResultArea>
      </>;
    case 'edit':
      return <>
        <div className="request-line">{op.status === 'running' ? 'Patch request · awaiting recorded outcome' : op.status === 'unknown' && op.classification.kind === 'derived' ? 'Captured patch input · nested outcome not exposed' : `Captured patch${d.reconstruction === 'complete' ? ' · reconstructed from captured base' : ' · after-state not verified'}`}</div>
        {op.status === 'running' && <PatchRequest op={op} path={d.path} />}
        <ResultArea state={op.status} resolving={resolving}>{d.hunks.length ? <><div className="material-context">Captured changes · scroll to read</div><ChangePreview hunks={d.hunks} path={d.path} /></> : op.artifactIds.some(id => id.endsWith('_after')) ? <ReadPreview opId={op.id} artifactId={op.artifactIds.find(id => id.endsWith('_after'))} start={1} path={d.path} /> : op.status === 'running' ? <PendingResult /> : <div className="muted">{d.reconstructionNote ?? 'No source bytes or patch captured.'}</div>}</ResultArea>
      </>;
    case 'search':
      return (
        <div className="hits">
          <div className="query">{d.query}</div>
          <ResultArea state={op.status} resolving={resolving}>
            {d.hits.slice(0, 5).map((h, i) => (
              <button key={i} className="hit search-bead" title={`Open captured match on ${h.path}`} onClick={(e) => { e.stopPropagation(); set({ filePanel: h.path, filePanelEvidence: `${op.id}/search/${i}`, filePanelFocus: undefined, currentFile: undefined }); }} onMouseEnter={() => set({ hoveredPath: h.path })}>
                <span className="hit-path">{h.path}</span>
                {h.line !== undefined && <span className="hit-line">:{h.line}</span>}
                {h.text && <span className="hit-excerpt">{h.text.slice(0, 180)}</span>}
              </button>
            ))}
            {d.hits.length > 5 && <div className="muted">{d.hits.length - 5} more</div>}
            {op.status !== 'running' && d.hits.length === 0 && <div className="muted">No matches</div>}
            {op.status === 'running' && d.hits.length === 0 && <div className="muted">Waiting for results</div>}
          </ResultArea>
        </div>
      );
    case 'test': {
      const s = d.summary;
      return (
        <div className="test">
          <div className="cmd">$ {d.command}</div>
          <ResultArea state={op.status} resolving={resolving}>{s ? (
            <VerificationStrip summary={s} output={d.outputPreview} onFailure={() => set({ expandedOp: op.id, selectedOp: undefined })} />
          ) : op.status !== 'running' ? (
            <div className="muted">exit {d.exitCode ?? '?'}</div>
          ) : <div className="muted">Waiting for output</div>}
          {s?.failures[0] && (
            <div className="failure">
              <div className="failure-name">{s.failures[0].name}</div>
              {s.failures[0].message && <div className="failure-msg">{s.failures[0].message}</div>}
            </div>
          )}
          </ResultArea>
        </div>
      );
    }
    case 'shell':
      return (
        <div className="shell">
          <div className="cmd">$ {d.command.slice(0, 1200)}</div>
          {d.command.length > 1200 && <div className="material-context">First 1,200 captured characters · expand for full input</div>}
          <ResultArea state={op.status} resolving={resolving}>
            {d.outputPreview ? <TerminalPreview text={d.outputPreview} failed={op.status === 'error'} /> : <span className="muted">{op.status === 'running' ? 'Waiting for output' : 'No output captured'}</span>}
            {d.exitCode !== undefined && d.exitCode !== 0 && d.exitCode !== null && <div className="bad">exit {d.exitCode}</div>}
          </ResultArea>
        </div>
      );
    case 'mcp':
      return (
        <div className="mcp">
          <div className="mcp-tool">{d.tool}</div>
          <div className="material-context">Captured arguments · bounded preview</div>
          <RequestFields input={d.input} />
          <ResultArea state={op.status} resolving={resolving}>
            {d.resultPreview ? <div className="mcp-result"><StructuredResult text={d.resultPreview} /></div> : <span className="muted">{op.status === 'running' ? 'Waiting for result' : 'No result content captured'}</span>}
          </ResultArea>
        </div>
      );
    case 'web':
      return (
        <div className="web">
          <div className="query">{d.url ?? d.query}</div>
          <ResultArea state={op.status} resolving={resolving}>
            {d.resultPreview ? <div className="mcp-result">{d.resultPreview.slice(0, 200)}</div> : <span className="muted">{op.status === 'running' ? 'Waiting for result' : 'No result content captured'}</span>}
          </ResultArea>
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
      return <>
        <div className="mcp-input">{summarizeInput(d.input)}</div>
        <ResultArea state={op.status} resolving={resolving}>{d.resultPreview ? <div className="mcp-result">{d.resultPreview.slice(0, 200)}</div> : undefined}</ResultArea>
      </>;
  }
}

function RequestFields({ input }: { input: unknown }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return <div className="mcp-input">{summarizeInput(input)}</div>;
  const keys = Object.keys(input);
  return <><dl className="request-fields">{keys.slice(0, 6).map((key) => <div key={key}><dt>{key}</dt><dd>{summarizeInput((input as Record<string, unknown>)[key])}</dd></div>)}</dl>{keys.length > 6 && <p className="muted">{keys.length - 6} more arguments · expand for full captured input</p>}</>;
}

/** All captured changes are reachable; large patches page explicitly rather than disappearing. */
function ChangePreview({ hunks, path }: { hunks: Hunk[]; path: string }) {
  const total = hunks.reduce((n, h) => n + h.lines.length, 0);
  const paged = total > 600;
  const [page, setPage] = useState(() => paged ? Math.floor(firstChangeOffset(hunks) / 120) : 0);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = root.current?.closest<HTMLElement>('.op-body');
    const changed = root.current?.querySelector<HTMLElement>('.add,.del');
    if (body && changed) body.scrollTop = Math.max(0, changed.offsetTop - body.offsetTop - 48);
  }, [hunks, page]);
  return <div ref={root} className="change-preview"><DiffView hunks={hunks} path={path} skipLines={paged ? page * 120 : 0} maxLines={paged ? 120 : undefined} showRemaining={false} />{paged && <nav className="preview-pages" aria-label="Captured patch pages"><button disabled={!page} onClick={e => { e.stopPropagation(); setPage(p => p - 1); }}>Previous lines</button><span>Page {page + 1} of {Math.ceil(total / 120)}</span><button disabled={(page + 1) * 120 >= total} onClick={e => { e.stopPropagation(); setPage(p => p + 1); }}>Next lines</button></nav>}</div>;
}

function PendingResult() {
  return <div className="pending-result"><span aria-hidden="true">···</span><span>Request observed. Result has not arrived.</span></div>;
}

function PatchRequest({ op, path }: { op: Operation; path: string }) {
  const id = op.artifactIds.find((artifact) => artifact.endsWith('_patch'));
  const view = useArtifact(id, { scope: 'preview', count: 12 });
  if (!id) return null;
  return <div className="patch-request">{view.text !== undefined ? <CodeView text={view.text} path={path} maxLines={12} /> : <span className="muted">{view.error ?? view.unavailable ?? 'Opening captured patch input…'}</span>}</div>;
}

function ReadPreview({ opId, artifactId, start, path, onSource }: { opId: string; artifactId?: string; start: number; path: string; onSource?: (text: string) => void }) {
  const [page, setPage] = useState(0);
  const { text, artifact, error, unavailable, hasMore, start: offset = 0 } = useArtifact(artifactId, { scope: 'preview', start: page * 200, count: 200 });
  useEffect(() => { if (text !== undefined) onSource?.(text); }, [text, onSource]);
  const set = useApp((s) => s.set);
  if (!artifactId) return <div className="muted">Content not captured</div>;
  if (error) return <div className="muted">{error}</div>;
  if (unavailable) return <div className="muted">{unavailable}</div>;
  if (text === undefined) return <div className="skeleton" />;
  if (!text) return <div className="muted">Empty</div>;
  const sourceStart = (artifact?.range?.start ?? start) + offset;
  const shownLines = text.replace(/\n$/, '').split('\n').length;
  return <div className="read-preview">
    <button className="captured-range" onClick={(e) => {
      e.stopPropagation();
      // Keep keyboard focus on a control that survives this preview's replacement.
      e.currentTarget.closest('article')?.querySelector<HTMLButtonElement>('[data-expand-op]')?.focus({ preventScroll: true });
      set({ expandedOp: opId, selectedOp: undefined });
    }} aria-label={`Read excerpt of ${path}`}>
      <span>Preview · lines {sourceStart}–{sourceStart + shownLines - 1}</span><span>Read excerpt ↗</span>
    </button>
    <CodeView text={text} startLine={sourceStart} path={path} />
    {(page > 0 || hasMore) && <nav className="preview-pages" aria-label="Captured source pages"><button disabled={!page} onClick={e => { e.stopPropagation(); setPage(p => p - 1); }}>Previous lines</button><span>Page {page + 1}</span><button disabled={!hasMore} onClick={e => { e.stopPropagation(); setPage(p => p + 1); }}>Next lines</button></nav>}
  </div>;
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
