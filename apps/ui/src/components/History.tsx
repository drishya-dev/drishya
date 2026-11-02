import { SessionLineage } from './SessionLineage.tsx';
import {FileReadingActions,openCapturedFileReading} from './FileReadingActions.tsx';
import { CompactionEvidence, CapturedContextReport, ContextEvidenceScope } from './ContextEvidence.tsx';
import { contextReport } from '../lib/context-report.ts';
import {StoredToolResult} from './StoredToolResult.tsx';
import { BrowserEvidence, BrowserStrip, WebEvidence } from './BrowserEvidence.tsx';
import { injectedLine, injectedMessage } from '../lib/injected-messages.ts';
import { browserStep, groupBrowserSteps } from '../lib/browser-evidence.ts';
import { passageArtifacts, passageItems, samePassageContent, type PassageContent } from '../lib/passage-content.ts';
import { HistoryArtifacts } from '../lib/history-artifacts.ts';
import { ReadingKeys } from './ReadingKeys.tsx';
import { CommandText } from './CommandText.tsx';
import {commandDisplay} from '../lib/command-display.ts';
import {operationOutcome} from '../lib/operation-outcome.ts';
import { reasoningGap } from '../lib/reasoning-gap.ts';
import './reasoning-gap.css';
import { ToolInput } from './ToolInput.tsx';
import { QuestionCard } from './QuestionCard.tsx';
import { isQuestionTool } from '../lib/ask-question.ts';
import { ToolOutput } from './ToolOutput.tsx';
import { DelegationDetail, DelegationLine } from './DelegationDetail.tsx';
import { StepReading } from './StepReading.tsx';
import { CapturedPath } from './CapturedPath.tsx';
import { createContext, Fragment, memo, useCallback, useContext, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Agent, Hunk, Notice, Operation, OperationImage, Projection, Prose } from '@drishya/contracts';
import { operationFailed } from '@drishya/contracts';
import type { PinnedPlan, Scene, SceneOp, ScenePassage } from '@drishya/scene';
import { ESTIMATED_PASSAGE_HEIGHT, passageWindow } from '../lib/history-window.ts';
import type { HistoryQuery } from '../../../../packages/scene/src/history.ts';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { fileFolder, fileName } from '../lib/file-identity.ts';
import { Markdown } from '../lib/markdown.tsx';
import {prosePath} from '../lib/prose-path.ts';
import './captured-file-path.css';
import { useApp } from '../state.ts';
import { CodeView, DiffView, Output, CapturedTime, useArtifact } from './common.tsx';
import { ArtifactReader, DiffReader } from './ArtifactReader.tsx';
import { presentationOf, readingWidth } from '../lib/presentation.ts';
import { diffStat, evidenceNotes, isProse } from '../lib/card-evidence.ts';
import { ledgerBasis, ledgerParts, settingsLine } from '../lib/turn-ledger.ts';
import { useTurns } from '../lib/turns-store.ts';
import { useNow } from '../lib/now-store.ts';
import { Origins } from './Origins.tsx';
import { MaterialGlyph } from './MaterialGlyph.tsx';
import { StructuredResult } from './StructuredResult.tsx';
import { TerminalPreview } from './TerminalPreview.tsx';
import { VerificationStrip } from './VerificationStrip.tsx';
import { FixChainPanel, ReadBeforePanel } from './Verification.tsx';
import { PinnedPlanList, PlanChecklist } from './PlanChecklist.tsx';
import { DeclinedLine } from './DeclinedLine.tsx';
import { CommandRunNotes } from './CommandRun.tsx';
import { BeforeTurnPanel } from './BeforeTurn.tsx';
import { NoticeLine } from './NoticeLine.tsx';
import { OpImages, PathImage, pathOnlyImage } from './OpImages.tsx';
import { CapturedOutcomes } from './CapturedOutcomes.tsx';
import { firstChangeOffset } from '../lib/change-preview.ts';
import { FlowConnections } from './FlowConnections.tsx';
import { materialRect, materialIsMoving, moveMaterial } from '../lib/material-motion.ts';
import { useHoverReading } from '../lib/hover-reading.ts';
import { scrollsInsideMaterial } from '../lib/reading-scroll.ts';
import { NativeTurn } from './SessionWorkspace.tsx';
import {useDisclosureChoice} from './Disclosure.tsx';
import { useExperience } from '../lib/experience.ts';
import { PromptRail } from './PromptRail.tsx';
import { useWorkspaceMemory, useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { foldedHeights, foldedSteps, foldOf, measureKey } from '../lib/turn-fold.ts';

/** Navigation targets the readable world below any overlapping fixed controls. */
function readingClearance(history: HTMLElement): number {
  const bounds = history.getBoundingClientRect();
  let top = bounds.top;
  for (const control of history.closest('.viewer')?.querySelectorAll<HTMLElement>('.workspace-header, .workspace-bar') ?? []) {
    const rect = control.getBoundingClientRect();
    if (rect.width > 0 && rect.right > bounds.left && rect.left < bounds.right && rect.top <= bounds.top + 240) top = Math.max(top, rect.bottom);
  }
  return Math.max(16, top - bounds.top + 16);
}

type HistoryProps = { scene: Scene; projection: Projection; onWindow?: (query: HistoryQuery) => Promise<void> };

export function History({ scene, projection, onWindow }: HistoryProps) {
  const mode = useApp(s => s.mode);
  const selectedOp = useApp(s => s.selectedOp);
  const focusObservationId = useApp(s => s.focusObservationId);
  const promptStep = useApp(s => s.promptStep);
  const filter = useApp(s => s.filter);
  const pair = useMemo(() => ({ scene, projection, mode, selectedOp, focusObservationId, promptStep, filter }),
    [scene, projection, mode, selectedOp, focusObservationId, promptStep, filter]);
  const deferred = useDeferredValue(pair);
  // Live arrivals may render interruptibly. Scene and evidence must move together;
  // deliberate navigation, replay, page replacement and recording changes stay immediate.
  const liveArrival = mode === 'history' && deferred.mode === mode &&
    projection.recordingId === deferred.projection.recordingId &&
    scene.atEnd && deferred.scene.atEnd && scene.total >= deferred.scene.total &&
    (scene.total > deferred.scene.total || projection.observationCount > deferred.projection.observationCount) &&
    selectedOp === deferred.selectedOp && focusObservationId === deferred.focusObservationId &&
    promptStep === deferred.promptStep && filter === deferred.filter;
  const shown = liveArrival ? deferred : pair;
  const artifacts = useMemo(() => new Map(shown.projection.artifacts.map(a => [a.id, a])), [shown.projection.artifacts]);
  return <StepProjection.Provider value={shown.projection}><ContextEvidenceScope projection={shown.projection} step={shown.scene.step} total={shown.scene.total}><HistoryArtifacts.Provider value={artifacts}><HistoryBody scene={shown.scene} projection={shown.projection} onWindow={onWindow} /></HistoryArtifacts.Provider></ContextEvidenceScope></StepProjection.Provider>;
}

const HistoryBody = memo(function HistoryBody({ scene, projection, onWindow }: HistoryProps) {
  const mode = useApp((s) => s.mode);
  const compareAgents = useApp((s) => s.compareAgents);
  const explore = useApp((s) => s.explore);
  const theme = useApp((s) => s.theme);
  const lowResource = useApp((s) => s.lowResource);
  const follow = useApp((s) => s.follow);
  const selectedOp = useApp((s) => s.selectedOp);
  const [keyboardOp, setKeyboardOp] = useState<string>();
  const readingOp = selectedOp ?? keyboardOp;
  const expandedOp = useApp((s) => s.expandedOp ?? s.selectedOp);
  const hoveredOp = useApp((s) => s.hoveredOp);
  const focusObservationId = useApp((s) => s.focusObservationId);
  const promptStep = useApp((s) => s.promptStep);
  const set = useApp((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const memory = useWorkspaceMemory();
  useHoverReading(ref);
  const activeNow = useNow((s) => !!s.view?.mark);
  // Folded turns, by the id of the passage that opens each one (TURN-1b).
  const [storedFolds, setStoredFolds] = useWorkspaceState<string[]>('history/folded-turns', []);
  const foldMotion = useRef<{ opener: string; tops: Map<string, number> } | undefined>(undefined);
  const foldAnimations = useRef<Animation[]>([]);
  // Folding near the end shortens the document under the reader; the browser would clamp the scroll and move the header.
  // Hold the old extent until the reader scrolls back inside the real one (see onScroll).
  const [extentFloor, setExtentFloor] = useState(0);
  const extent = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: memory.get('history/top') as number ?? 0, height: 900 });
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [focusedPassageId, setFocusedPassageId] = useState<string | undefined>();
  const measurements = useRef(new Map<string, number>(memory.get('history/heights') as [string, number][] | undefined));
  const measuredSlots = useRef(new WeakMap<HTMLElement, { key: string; context: string; width: number; height: number; content: PassageContent }>());
  const programmatic = useRef(false);
  const lastScrollTop = useRef(0);
  const userScrollUntil = useRef(0);
  const pointerFocus = useRef(false);
  const scrollFrame = useRef<number | undefined>(undefined);
  const navigationFrame = useRef<number | undefined>(undefined);
  const navigating = useRef(false);
  const readingAnchor = useRef(memory.get('history/anchor') as { id: string; offset: number } | undefined);
  const readingAtStart = useRef(memory.get('history/top') === 0);
  const pendingNavigation = useRef<string | undefined>(undefined);
  const lastNavigation = useRef<string | undefined>(undefined);
  const navigationIntent = useRef<string | undefined>(undefined);
  const cancelledNavigation = useRef<string | undefined>(undefined);
  const navigationBoundary = useRef<{ step: number; projection: Projection } | undefined>(undefined);
  const chapterNavigation = useRef<{ id: string; step: number } | undefined>(undefined);
  const seenThrough = useRef(scene.total);
  const followFrame = useRef<number | undefined>(undefined);
  const followingStarted = useRef(false);
  const requestedWindow = useRef<{ key: string; projection: Projection } | undefined>(undefined);
  const motion = useApp(s => s.motion);
  const materialPositions = useRef(new Map<string, DOMRect>());
  const isProgrammaticScroll = useCallback(() => programmatic.current && Math.abs((ref.current?.scrollTop ?? 0) - lastScrollTop.current) < .5, []);
  useLayoutEffect(() => {
    const history = ref.current;
    if (!history) return;
    const measure = () => {
      const next = new Map<string, DOMRect>();
      const moves: { card: HTMLElement; from: DOMRect; destination: DOMRect; scale: number }[] = [];
      const viewportBounds = history.getBoundingClientRect();
      for (const card of history.querySelectorAll<HTMLElement>('article[data-op-id]')) {
        if (card.dataset.hoverReading) continue;
        const id = card.dataset.opId!;
        const r = materialRect(card);
        const stored = new DOMRect(r.left, r.top + history.scrollTop, r.width, r.height);
        const before = materialPositions.current.get(id);
        if (before && useApp.getState().follow && performance.now()>userScrollUntil.current && useApp.getState().motion && !lowResource && !matchMedia('(prefers-reduced-motion: reduce)').matches && !materialIsMoving(card) && r.bottom > viewportBounds.top && r.top < viewportBounds.bottom && [stored.x - before.x, stored.y - before.y, stored.width - before.width, stored.height - before.height].some(delta => Math.abs(delta) > 1)) {
          moves.push({ card, from: new DOMRect(before.x, before.y - history.scrollTop, before.width, before.height), destination: r, scale: parseFloat(getComputedStyle(card).getPropertyValue('--material-scale')) || 1 });
        }
        next.set(id, stored);
        if (next.size >= 80) break;
      }
      // Read every destination before starting any animation.
      for (const move of moves) moveMaterial(move.card, move.from, 300, 'surface-Reflow', { destination: move.destination, scale: move.scale });
      materialPositions.current = next;
    };
    measure();
    const inner = history.querySelector('.history-inner');
    const observer = new ResizeObserver(entries => {
      measure();
      // Composer clearance changes padding after the first layout. It changes the
      // scroll destination without changing any passage's measured content height.
      if (entries.some(entry => entry.target === inner) && useApp.getState().follow && !(navigationBoundary.current?.step === scene.step && navigationBoundary.current.projection === projection)) followLatest();
    });
    if (inner) observer.observe(inner, { box: 'border-box' });
    for (const card of history.querySelectorAll('article[data-op-id]')) observer.observe(card);
    return () => observer.disconnect();
  }, [scene.passages, follow, lowResource, measurementVersion, viewport.height]);

  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => { for (const card of ref.current?.querySelectorAll('article[data-op-id]') ?? []) for (const a of card.getAnimations()) if (a.id === 'surface-Reflow') a.cancel(); };
    if (!motion || lowResource || !follow) cancel();
    const changed = () => { if (preference.matches) cancel(); };
    preference.addEventListener('change', changed);
    const history = ref.current;
    // Cancel after hit testing; mouse-down cancellation can move the chosen
    // control before mouse-up and lose its click during a reflow.
    history?.addEventListener('click', cancel, true);
    history?.addEventListener('keydown', cancel);
    return () => { preference.removeEventListener('change', changed); history?.removeEventListener('click', cancel, true); history?.removeEventListener('keydown', cancel); };
  }, [motion, lowResource, follow]);

  const ops = useMemo(() => new Map(projection.operations.map((o) => [o.id, o])), [projection]);
  const artifacts = useMemo(() => new Map(projection.artifacts.map(a => [a.id, a])), [projection]);
  const prose = useMemo(() => new Map(projection.prose.map((p) => [p.id, p])), [projection]);
  const notices = useMemo(() => new Map((projection.notices ?? []).map((n) => [n.id, n])), [projection]);
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
    readingOp ? ps.ops.some((op) => op.id === readingOp) : focusObservationId ?
      ps.ops.some((op) => ops.get(op.id)?.observationIds.includes(focusObservationId)) ||
      ps.prose.some((p) => prose.get(p.id)?.observationIds.includes(focusObservationId)) : promptStep !== undefined ? ps.id === scene.passages.find(p => p.turnStep !== undefined && p.turnStep >= promptStep - 1)?.id : false,
  );
  const targetId = scene.passages[targetIndex]?.id;
  const intent = readingOp ? `${keyboardOp===readingOp?'key':'op'}:${readingOp}` : focusObservationId ? `observation:${focusObservationId}` : promptStep !== undefined ? `prompt:${promptStep}` : undefined;
  const expandedId = scene.passages.find((ps) => ps.ops.some((op) => op.id === expandedOp))?.id;
  const ids = scene.passages.map((ps) => ps.id);
  const hoverPassageId = scene.passages.find(ps => ps.ops.some(op => op.id === hoveredOp))?.id;
  const pinned = new Set([readingAnchor.current?.id, targetId, expandedId, focusedPassageId, hoverPassageId].filter((id): id is string => !!id));
  // A folded turn opens for whatever a reader is sent to inside it, and the newest turn never folds while the agent works in it.
  // Folding belongs to the Modern chapter header; the retained UIs have no control to unfold with.
  const targetTurn = scene.passages[targetIndex]?.inTurn;
  const expandedTurn = expandedId ? scene.passages.find((ps) => ps.id === expandedId)?.inTurn : undefined;
  const newestTurn = scene.passages.at(-1)?.inTurn;
  const stored = useMemo(() => new Set(storedFolds), [storedFolds]);
  const modern = typeof document !== 'undefined' && document.documentElement.dataset.uiVersion === 'modern';
  const folded = useMemo(() => mode === 'history' && modern
    ? foldedSteps(scene.passages, stored, new Set([targetTurn, expandedTurn, activeNow ? newestTurn : undefined].filter((n): n is number => n !== undefined)))
    : new Set<number>(), [scene.passages, stored, mode, modern, targetTurn, expandedTurn, activeNow, newestTurn]);
  const heights = useMemo(() => foldedHeights(scene.passages, measurements.current, folded), [scene.passages, folded, measurementVersion]);
  const layout = useMemo(() => passageWindow(ids, heights, viewport.top, viewport.height, pinned, lowResource ? 300 : 900),
    // IDs and pinning are recreated as scene and reader state change. Measurements need their own revision.
    [scene.passages, viewport, heights, targetId, expandedId, focusedPassageId, hoverPassageId, readingAnchor.current?.id, lowResource]);

  // Opening a turn to show a selection is the reader's choice from then on, so it stays open after the selection clears.
  useEffect(() => {
    const opened = scene.passages.filter((ps) => ps.turnStep !== undefined && (ps.turnStep === targetTurn || ps.turnStep === expandedTurn) && stored.has(ps.id)).map((ps) => ps.id);
    if (opened.length) setStoredFolds((list) => list.filter((id) => !opened.includes(id)));
  }, [targetTurn, expandedTurn, stored]);

  const setFolds = useRef(setStoredFolds);
  setFolds.current = setStoredFolds;
  const toggleFold = useCallback((id: string) => {
    const el = ref.current;
    for (const animation of foldAnimations.current) animation.finish();
    foldAnimations.current = [];
    // Remember where the work below the header sits, so it moves from there instead of jumping (see the layout effect).
    if (el && useApp.getState().motion && !lowResource && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const slots = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]:not([data-folded=hidden])')];
      const bottom = el.getBoundingClientRect().bottom;
      foldMotion.current = { opener: id, tops: new Map(slots.slice(slots.findIndex((slot) => slot.dataset.passageId === id) + 1).flatMap((slot) => {
        const top = slot.getBoundingClientRect().top;
        return top < bottom + 400 ? [[slot.dataset.passageId!, top] as const] : [];
      })) };
    }
    if (!useApp.getState().follow) setExtentFloor((floor) => Math.max(floor, extentTotal.current));
    setFolds.current((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }, [lowResource]);
  const extentTotal = useRef(layout.total);
  extentTotal.current = layout.total;
  useLayoutEffect(() => { if (follow) setExtentFloor(0); }, [follow]);

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
    const visible = passageWindow(ids, heights, viewport.top, viewport.height, new Set(), lowResource ? 300 : 900);
    const missing = visible.runs.flatMap((run) => Array.from({ length: run.end - run.start }, (_, i) => run.start + i))
      .find((i) => scene.passages[i]?.unloaded && foldOf(scene.passages[i]!, folded) !== 'hidden');
    if (missing === undefined) { requestedWindow.current = undefined; return; }
    const start = Math.max(0, missing - 8);
    const key = `${scene.step}:${start}`;
    // A background refresh can supersede this request without moving the reader.
    // Deduplicate within one projection, never suppress its replacement's missing page.
    if (requestedWindow.current?.key === key && requestedWindow.current.projection === projection) return;
    requestedWindow.current = { key, projection };
    void onWindow({ start, count: 32, pinnedPassageIds: [...pinned].slice(0, 3) }).catch((error) => {
      requestedWindow.current = undefined;
      set({ error: error.message });
    });
  }, [scene.passages, scene.step, viewport, heights, onWindow]);

  const rememberReading = () => {
    const el = ref.current;
    if (!el) return;
    const viewport = el.getBoundingClientRect();
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]:not([data-folded=hidden])')].find((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.bottom > viewport.top + 1 && bounds.top < viewport.bottom;
    });
    // The start boundary exists even while virtualization has no mounted passage there.
    // A native focus/scrollIntoView can leave the start while a scroll event is
    // still settling. Only preserve an upward start intent; a downward move wins.
    readingAtStart.current = el.scrollTop < 1 || navigating.current && readingAtStart.current && el.scrollTop <= lastScrollTop.current + .5;
    readingAnchor.current = node?.dataset.passageId ? { id: node.dataset.passageId, offset: node.getBoundingClientRect().top - viewport.top } : undefined;
    memory.set('history/top', el.scrollTop);
    memory.set('history/anchor', readingAnchor.current);
    memory.set('history/heights', [...measurements.current].slice(-96));
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

  useLayoutEffect(() => {
    readingAnchor.current = memory.get('history/anchor') as { id: string; offset: number } | undefined;
    readingAtStart.current = memory.get('history/top') === 0;
    measurements.current = new Map(memory.get('history/heights') as [string, number][] | undefined);
    if (!useApp.getState().follow) setScrollTop(memory.get('history/top') as number ?? 0);
  }, [memory]);

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

  const restoreReading = (committedLayout=false) => {
    const el = ref.current;
    const anchor = readingAnchor.current;
    const boundary = navigationBoundary.current;
    const atDestination = boundary?.step === scene.step && boundary.projection === projection;
    if (!el || follow && !atDestination || navigating.current&&!committedLayout) return;
    // Native scrolling can precede its scroll event. Never restore an older anchor
    // over that still-unreported user delta while a measurement commits.
    if(committedLayout&&!programmatic.current&&Math.abs(el.scrollTop-lastScrollTop.current)>.5) {
      rememberReading();return;
    }
    // At the document start, late allocation changes must preserve the boundary,
    // rather than pull the reader down to an old first-passage pixel offset.
    if (readingAtStart.current) { if (el.scrollTop > .5) setScrollTop(0); return; }
    if (!anchor) return;
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')].find((item) => item.dataset.passageId === anchor.id);
    if (!node) return;
    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) > 0.5) {
      const requested = el.scrollTop + delta;
      setScrollTop(requested);
      // A shorter allocation can clamp the scroll at either boundary. Keep the
      // attained offset so later growth cannot replay the unapplied correction.
      if (!pointerFocus.current) anchor.offset += requested - el.scrollTop;
    }
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
    // Newly mounted runs must replace their estimates in this same commit. Waiting
    // for ResizeObserver lets a frame expose their extra height, then jumps back.
    let changed = false;
    const width = ref.current?.clientWidth ?? 0;
    const context = JSON.stringify([theme, compareAgents, explore, expandedOp, hoveredOp, readingOp, viewport.height]);
    const passages = new Map(scene.passages.map(ps => [ps.id, ps]));
    const sizes: { node: HTMLElement; key: string; height: number; content: PassageContent }[] = [];
    if (!pointerFocus.current) for (const node of ref.current?.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]') ?? []) {
      if (node.dataset.unloaded === 'true' || node.dataset.folded === 'hidden') continue;
      const ps = passages.get(node.dataset.passageId!);
      if (!ps) continue;
      const fold = foldOf(ps, folded);
      const content: PassageContent = { ps, artifacts: passageArtifacts(ps, ops, artifacts), ops: passageItems(ps.ops, ops), prose: passageItems(ps.prose, prose), notices: passageItems(ps.notices ?? [], notices),
        agent: agents.get(ps.agentId), agents: projection.agents, focus: scene.focus?.passageId === ps.id,
        foldable: modern && mode === 'history' && ps.turnStep !== undefined && !(activeNow && ps.turnStep === newestTurn), folded: fold === 'header', onFold: toggleFold };
      const key = node.dataset.measureKey!;
      const previous = measuredSlots.current.get(node);
      // Observer sizes stay valid until material, allocation or presentation changes.
      const reusable = previous && previous.key === key && previous.context === context && previous.width === width && samePassageContent(previous.content, content);
      sizes.push({ node, key, height: reusable ? previous.height : node.getBoundingClientRect().height, content });
    }
    for (const { node, key, height, content } of sizes) {
      measuredSlots.current.set(node, { key, context, width, height, content });
      if (Math.abs((measurements.current.get(key) ?? 0) - height) > .5) {
        measurements.current.set(key, height);
        changed = true;
      }
    }
    if (changed) setMeasurementVersion(n => n + 1);
    // Correct measured spacer changes before paint, using the latest user-scroll anchor.
    restoreReading(true);
  }, [scene.passages, layout, follow, compareAgents, explore, theme, measurementVersion, expandedOp, hoveredOp, readingOp]);

  // Folding moves the work below the header: it travels from where it was, and unfolded work eases in under the header.
  useLayoutEffect(() => {
    const moved = foldMotion.current, el = ref.current;
    if (!moved || !el) return;
    foldMotion.current = undefined;
    const slots = [...el.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]:not([data-folded=hidden])')];
    const bottom = el.getBoundingClientRect().bottom;
    const easing = 'cubic-bezier(.23,1,.32,1)';
    const positions = slots.slice(slots.findIndex((item) => item.dataset.passageId === moved.opener) + 1).map(slot => ({ slot, top: slot.getBoundingClientRect().top }));
    for (const { slot, top } of positions) {
      if (top > bottom) break;
      const before = moved.tops.get(slot.dataset.passageId!);
      if (before === undefined) foldAnimations.current.push(slot.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing, id: 'turn-fold' }));
      else if (Math.abs(before - top) > 1) foldAnimations.current.push(slot.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: 260, easing, id: 'turn-fold' }));
    }
  }, [storedFolds]);

  // A passage can grow after its artifact arrives or its width changes. Record the actual slot
  // height, then reflow spacers; preserve the captured passage/pixel anchor while detached.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        // A paged-out placeholder retains its last real allocation; it is not a
        // fresh measurement of the captured passage that will replace it.
        if ((entry.target as HTMLElement).dataset.unloaded === 'true' || (entry.target as HTMLElement).dataset.folded === 'hidden') continue;
        const id = (entry.target as HTMLElement).dataset.measureKey;
        if (!id) continue;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        const measured = measuredSlots.current.get(entry.target as HTMLElement);
        if (measured) measured.height = height;
        if (Math.abs((measurements.current.get(id) ?? 0) - height) > 0.5) {
          measurements.current.set(id, height);
          changed = true;
        }
      }
      if (changed) {
        // Measurements may resolve while a button is pressed. Keep the current spacer
        // layout until activation; rebuilding it now can put another passage under it.
        if (pointerFocus.current) return;
        // Artifact text can resize between React commits. ResizeObserver delivers
        // before paint; preserve reading now, not after a later React revision.
        restoreReading(true);
        setMeasurementVersion((n) => n + 1);
        // A burst can detach follow before this observer's closure is replaced.
        if (useApp.getState().follow && !(navigationBoundary.current?.step === scene.step && navigationBoundary.current.projection === projection)) {
          followLatest();
        }
        // The measurement revision restores detached reading in useLayoutEffect,
        // before paint. A second, untracked RAF can run after the next wheel's
        // native scroll but before its scroll event, restoring an obsolete anchor.
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
    if (navigationIntent.current !== intent) {
      navigationIntent.current = intent; cancelledNavigation.current = undefined;
      lastNavigation.current = undefined; pendingNavigation.current = undefined;
    }
    if (!el || !targetId || intent && cancelledNavigation.current === intent) return;
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
    const selected = readingOp ? [...node.querySelectorAll<HTMLElement>('[data-op-id]')].find((n) => n.dataset.opId === readingOp) : undefined;
    const nodeBounds = node.getBoundingClientRect();
    const bounds = selected ? selected.getBoundingClientRect() : nodeBounds;
    const viewportBounds = el.getBoundingClientRect();
    const clearance = readingClearance(el);
    const available = Math.max(0, el.clientHeight - clearance);
    const scrollBefore = el.scrollTop;
    if (bounds.top < viewportBounds.top + clearance || bounds.bottom > viewportBounds.bottom) setScrollTop(el.scrollTop + bounds.top - viewportBounds.top - clearance - Math.max(0, (available - bounds.height) / 2));
    // Anchor reading to the navigated passage itself. Passages above may still carry estimated
    // heights; anchoring to whichever slot was first visible let their measurement pull the
    // reader away from the action just opened.
    readingAnchor.current = { id: targetId, offset: nodeBounds.top - viewportBounds.top - (el.scrollTop - scrollBefore) };
    if (useApp.getState().readingPassageId !== targetId) set({ readingPassageId: targetId });
    pendingNavigation.current = undefined;
  }, [intent, targetId, targetIndex, layout, readingOp]);

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
    // A held extent shrinks to what the reader still sees below the real content, and goes once that is none.
    if (extentFloor && extent.current) {
      const below = el.getBoundingClientRect().bottom - extent.current.getBoundingClientRect().top;
      if (below <= layout.total + .5) setExtentFloor(0);
      else if (below < extentFloor - .5) setExtentFloor(below);
    }
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
        // Layout changes restore in the layout effect, before paint. Never apply
        // an older scroll event's anchor later over a new wheel/native position.
        rememberReading();
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
    <div className="history" role={modern?"region":undefined} aria-label={modern?"Captured work":undefined} tabIndex={modern?0:undefined} ref={ref} onPointerDownCapture={() => { pointerFocus.current = true; }} onPointerUpCapture={() => { pointerFocus.current = false; }} onPointerCancelCapture={() => { pointerFocus.current = false; }} onScroll={onScroll} onWheel={(e) => {
      if (scrollsInsideMaterial(e.target)) { e.stopPropagation(); return; }
      // A slot still moving after a fold would be remembered at its moving position.
      for (const animation of foldAnimations.current) animation.finish();
      foldAnimations.current = [];
      cancelledNavigation.current = intent; pendingNavigation.current = undefined;
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
          rememberReading(); navigating.current = false; navigationFrame.current = undefined;
        });
      });
    }} onPointerDown={(e) => { if (e.target === ref.current || e.pointerType === 'touch' && !scrollsInsideMaterial(e.target) && !(e.target as HTMLElement).closest('button, input, select, a')) { userScrollUntil.current = performance.now() + 750; readingAtStart.current = false; } }} onKeyDown={(e) => { pointerFocus.current = false; if (scrollsInsideMaterial(e.target)) return; if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) { readingAtStart.current = false; cancelledNavigation.current = intent; pendingNavigation.current = undefined; } if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) { userScrollUntil.current = performance.now() + 750; if (follow) { rememberReading(); set({ follow: false }); } } }} onClickCapture={(e) => {
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
      <div className="history-inner"><div ref={extent} style={{ minHeight: Math.max(layout.total, extentFloor) }}>
        {scene.passages.length === 0 && <div className="history-empty">No captured work in this view yet.</div>}
        {layout.runs.flatMap((run) => [
          ...(run.before > 0 ? [<div key={`gap-${run.start}`} aria-hidden="true" style={{ height: run.before }} />] : []),
          ...scene.passages.slice(run.start, run.end).map((ps) => {
            // A folded opener keeps its prompt while paged out, so it shows as a header rather than a loading slot.
            const fold = foldOf(ps, folded);
            const unloaded = ps.unloaded && fold !== 'header';
            return <div className="passage-slot" data-passage-id={ps.id} data-measure-key={measureKey(ps.id, fold)} data-folded={fold} data-in-turn={ps.inTurn} data-unloaded={unloaded || undefined} key={ps.id}>
              {fold !== 'hidden' && !unloaded && <SessionLineage projection={projection} passageId={ps.id} visibleStep={scene.step} />}
              {fold === 'hidden' ? null : unloaded ? <div className="muted" style={{ minHeight: measurements.current.get(ps.id) ?? ESTIMATED_PASSAGE_HEIGHT }} aria-busy="true">Loading captured work…</div> : <PassageView ps={ps} artifacts={passageArtifacts(ps, ops, artifacts)} ops={passageItems(ps.ops, ops)} prose={passageItems(ps.prose, prose)} notices={passageItems(ps.notices ?? [], notices)} agent={agents.get(ps.agentId)} agents={projection.agents} focus={scene.focus?.passageId === ps.id} foldable={modern && mode === 'history' && ps.turnStep !== undefined && !(activeNow && ps.turnStep === newestTurn)} folded={fold === 'header'} onFold={toggleFold} />}
            </div>;
          }),
        ])}
        {layout.runs.length > 0 && <div aria-hidden="true" style={{ height: layout.total - layout.prefix[layout.runs.at(-1)!.end]! }} />}
      </div>
      <NativeTurn projection={projection} />
      </div>
      <Origins scene={scene} projection={projection} isProgrammaticScroll={isProgrammaticScroll} />
      <FlowConnections projection={projection} />
    </div>
      <ReadingKeys root={ref} projection={projection} focused={keyboardOp} focus={setKeyboardOp} navigate={async target=>{
        pointerFocus.current=false;
        set({follow:false,selectedOp:undefined,expandedOp:undefined,focusObservationId:undefined,promptStep:target.type==='turn'?target.step+1:undefined});
        setKeyboardOp(target.id);
        if(onWindow && (target.type==='turn'||!ops.has(target.id!))) await onWindow(target.type==='turn'?{promptStep:target.step+1}:{selectedOperationId:target.id});
        // Let the measured virtual window pin and position the real card before focus.
        await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
        if(target.type==='turn')ref.current?.focus({preventScroll:true});
      }} fold={collapse=>{
        pointerFocus.current=false;rememberReading();
        for(const animation of foldAnimations.current)animation.finish();foldAnimations.current=[];foldMotion.current=undefined;
        const keep=targetTurn??expandedTurn??scene.passages.find(ps=>ps.id===readingAnchor.current?.id)?.inTurn;
        setExtentFloor(floor=>Math.max(floor,extentTotal.current));
        setStoredFolds(collapse?scene.passages.filter(ps=>ps.turnStep!==undefined&&ps.turnStep!==keep&&!(activeNow&&ps.turnStep===newestTurn)).map(ps=>ps.id):[]);
      }}/>
      {mode === 'history' && prompts.length > 0 && <PromptRail chapters={prompts.map(({ ps, index }) => ({ id: ps.id, label: (() => { const note = injectedMessage(ps.turnPrompt!); return note ? injectedLine(note) : ps.turnPrompt!; })(), index,time:ps.turnTime,turnStep:ps.turnStep }))} activeId={activePrompt} open={({ id, index }) => {
          const ps = scene.passages[index]!;
          // A chapter jump lands on an open turn; it is a jump, so nothing travels.
          if (stored.has(ps.id)) setFolds.current((list) => list.filter((item) => item !== ps.id));
          // Choosing a chapter is deliberate navigation: it stops following the live edge, or the next record pulls the view back down.
          set({ follow: false, selectedOp: undefined, expandedOp: undefined, focusObservationId: undefined, promptStep: undefined, readingPassageId: ps.id });
          navigationBoundary.current = { step: scene.step, projection };
          chapterNavigation.current = onWindow && ps.unloaded ? { id: ps.id, step: scene.step } : undefined;
          setFocusedPassageId(ps.id);
          readingAnchor.current = { id: ps.id, offset: ref.current ? readingClearance(ref.current) : 16 }; readingAtStart.current = false;
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
          ↓{mode === 'history' && scene.total > seenThrough.current && <small>{scene.total - seenThrough.current}</small>}
        </button>
      )}
    </>
  );
});

const PassageView = memo(function PassageView({ ps, artifacts, ops, prose, notices, agent, agents, focus, foldable = false, folded = false, onFold }: PassageContent) {
  const color = agentColor(agent, agents);
  const first = ps.ops[0] ? ops.get(ps.ops[0].id) : undefined;
  return (
    <HistoryArtifacts.Provider value={artifacts}><section data-passage-id={ps.id} className={`passage${ps.settled ? ' settled' : ''}${ps.matchesFilter ? '' : ' filtered-out'}${focus ? ' focus' : ''}${folded ? ' folded-turn' : ''}`} style={{ '--agent': color } as React.CSSProperties}>
      {!!(ps.turnPrompt || ps.turnImages?.length) && <TurnBlock prompt={ps.turnPrompt ?? ''} time={ps.turnTime} step={ps.turnStep} permissionMode={ps.turnPermissionMode} images={ps.turnImages} plan={ps.turnPlan} fold={foldable && onFold ? { folded, toggle: () => onFold(ps.id) } : undefined} />}
      {!folded && ps.notices?.filter((n) => n.leading).map((n) => { const notice = notices.get(n.id); return notice ? <NoticeLine key={n.id} notice={notice} /> : null; })}
      {!folded && ps.ops.length > 0 && (
        <>
          <div className="passage-head">
            {agents.length > 1 && <><span className="agent-dot" /><span className="passage-agent">{agentName(agent)}</span></>}
            {first?.startTime && <CapturedTime iso={first.startTime} />}
          </div>
          <div className="ops-row">
            {groupBrowserSteps(ps.ops, ops).map((group) => {
              const first = group[0]!;
              const op = ops.get(first.id);
              if (!op) return null;
              if (group.length === 1) return <OpCard key={first.id} so={first} op={op} index={ps.ops.indexOf(first)} />;
              const grouped = group.map(item => ops.get(item.id)!).filter(Boolean);
              return <BrowserStrip key={first.id} operations={grouped} renderOperation={(chosen) => <OpCard key={chosen.id} so={group.find(item => item.id === chosen.id)!} op={chosen} index={ps.ops.findIndex(item => item.id === chosen.id)} />} />;
            })}
          </div>
        </>
      )}
      {!folded && ps.compactionIds?.map(id => <CompactionEvidence key={id} id={id} />)}
      {!folded && ps.compactionSummaryIds?.map(id => <CompactionEvidence key={id} summaryId={id} />)}
      {!folded && ps.prose.map((p) => {
        const pr = prose.get(p.id);
        return pr ? <ProseView key={p.id} pr={pr} arriving={p.arriving} agent={agent} /> : null;
      })}
      {!folded && ps.notices?.filter((n) => !n.leading).map((n) => { const notice = notices.get(n.id); return notice ? <NoticeLine key={n.id} notice={notice} /> : null; })}
    </section></HistoryArtifacts.Provider>
  );
}, samePassageContent);

function openCapturedFile(path:string,line?:number,evidence?:string) {
  const state=useApp.getState(),reference=prosePath(path,state.recording?.workspaceRoot,true);
  if(reference)state.set({hoveredPath:reference.path,filePanel:reference.path,filePanelLine:line??reference.line,filePanelEvidence:evidence,filePanelFocus:undefined,currentFile:undefined,selectedOp:undefined,follow:false,held:true});
}

function ProseView({ pr, arriving, agent }: { pr: Prose; arriving: boolean; agent?: Agent }) {
  const detail = useApp(s => s.reasoningDetail);
  const workspaceRoot = useApp(s => s.recording?.workspaceRoot);
  const [open, setOpen] = useDisclosureChoice(`prose/${pr.id}`, pr.role !== 'reasoning' || detail === 'expanded');
  const [full, setFull] = useState(false);
  const prose = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = prose.current;
    if (!root || !arriving || !useApp.getState().motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations = [...root.querySelectorAll(':scope > p, :scope > ul, :scope > pre')].slice(0, 12).map((el, i) => el.animate([{ opacity: .4, transform: 'translateY(2px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: Math.min(120, i * 30), fill: 'backwards', easing: 'cubic-bezier(.23,1,.32,1)' }));
    const cancel = () => animations.forEach(a => a.cancel());
    root.addEventListener('pointerdown', cancel); window.addEventListener('keydown', cancel);
    return () => { cancel(); root.removeEventListener('pointerdown', cancel); window.removeEventListener('keydown', cancel); };
  }, [arriving, pr.id]);
  const label = pr.role === 'reasoning' ? (pr.exposure === 'summary' ? 'Reasoning summary' : 'Thinking') : undefined;
  if (label && detail === 'hidden') return null;
  if (pr.exposure === 'none') return <ReasoningGapLine pr={pr} agent={agent} />;
  return (
    <div ref={prose} data-prose-id={pr.id} data-agent-id={pr.agentId} className={`prose prose-${pr.role}${arriving ? ' arriving' : ''}`} aria-label={`${agentName(agent)} ${label ?? 'said'}`}>
      {label && (
        <button className="prose-label" onClick={() => { setOpen(!open); }} aria-expanded={open}>
          {label}
          {open ? ' · collapse' : ' · show'}
        </button>
      )}
      {open && <Markdown text={pr.text} workspaceRoot={workspaceRoot} onPath={openCapturedFile} />}
      {pr.truncated && <><button className="material-more" onClick={() => { setFull((value) => !value); }}>{full ? 'Close full captured text' : 'Preview · read full captured text'}</button>{full && <ArtifactReader id={`art_${pr.id}_prose`} kind="output" />}</>}
    </div>
  );
}

/** One quiet line where reasoning happened but its text was never saved. Never filled in. */
function ReasoningGapLine({ pr, agent }: { pr: Prose; agent?: Agent }) {
  const [why, setWhy] = useState(false);
  const gap = reasoningGap(pr, agent?.harness);
  return (
    <div data-prose-id={pr.id} data-agent-id={pr.agentId} className="prose prose-reasoning reasoning-gap">
      <button className="reasoning-gap-line" onClick={() => setWhy((v) => !v)} aria-expanded={why} title={gap.explain}>
        <span>{gap.line}</span>{gap.count && <small>{gap.count}</small>}<span className="reasoning-gap-info" aria-hidden>ⓘ</span>
      </button>
      {why && <p className="reasoning-gap-why">{gap.explain}</p>}
    </div>
  );
}

// ─── operation cards ─────────────────────────────────────────────────────────────────────

const OpCard = memo(function OpCard({ so, op, index }: { so: SceneOp; op: Operation; index: number }) {
  const experience = useExperience();
  const workspaceRoot = useApp(s=>s.recording?.workspaceRoot);
  const card = useRef<HTMLElement>(null);
  const selected = useApp((s) => s.selectedOp === op.id);
  const expanded = useApp((s) => (s.expandedOp ?? s.selectedOp) === op.id);
  const hoveredPath = useApp((s) => s.hoveredPath);
  const select = useApp((s) => s.select);
  const set = useApp((s) => s.set);
  const lit = !!hoveredPath && op.paths.some((p) => p.path === hoveredPath);
  const from = so.origin.type === 'map' ? 'from-map' : 'from-dock';
  const presentation = presentationOf(op);
  // The operation a search result jumped to keeps a quiet marker until the reader moves on.
  const searchHit = useApp(s => !!s.focusObservationId && op.observationIds.includes(s.focusObservationId));
  const [sourceWidth, setSourceWidth] = useState<number>();
  const measureSource = useCallback((text: string) => setSourceWidth(Math.max(280, Math.min(420, readingWidth(...text.split('\n').slice(0, 12))))), []);
  const readingAllocation = presentation.width ?? sourceWidth;
  const originLabel = so.origin.type === 'mcp' ? so.origin.server : KIND_LABEL[op.kind];
  const command = op.detail.kind === 'shell' || op.detail.kind === 'test' ? commandDisplay(op.detail.command) : undefined;
  const file=op.detail.kind==='read'||op.detail.kind==='edit'?{path:op.detail.path}:undefined;
  const asked=op.tool==='AskUserQuestion'||op.tool==='request_user_input';
  const said=op.detail.kind==='shell'||op.detail.kind==='test'?op.detail.description:undefined;
  // A card is named by what differs between cards: the file, the agent's own words, the tool of a server.
  const displayTitle = asked ? 'Asked you' : said ?? (file ? fileName(file.path) : op.detail.kind === 'mcp' ? op.detail.tool : command?.decoded ? command.text : op.title.replace(/^(Read|Edit|Write|Create|Search|Test ·|Run) /, ''));
  const lines=op.detail.kind==='read'&&op.detail.lineCount>0&&op.detail.startLine>1?`lines ${op.detail.startLine}–${op.detail.startLine+op.detail.lineCount-1}`:undefined;
  const note=[lines,file&&fileFolder(file.path)].filter(Boolean).join(' · ');
  const evidence=op.detail.kind==='read'?`${op.id}/read`:op.detail.kind==='edit'&&op.detail.hunks.length?`${op.id}/patch`:undefined;
  const title=file?<button type="button" className="op-title captured-file-path" title={file.path} aria-label={`Open captured work for ${file.path}`} onClick={event=>{event.stopPropagation();openCapturedFileReading(file.path,op);}}>{displayTitle}</button>:<span className="op-title" title={displayTitle}>{displayTitle}</span>;
  const imagePath=pathOnlyImage(op);
  const hasImage=op.images?.some(image=>image.sha);
  // Keep the same evidence readers; images get the primary allocation, not a second card.
  const imageOriginal=op.detail.kind==='read'&&!op.detail.excerptArtifactId
    ?<ToolInput value={op.detail}/>:<ExpandedMaterial op={op}/>;
  const imageMaterial=imagePath||hasImage?<>
    {imagePath?<PathImage op={op} path={imagePath}/>:<OpImages images={op.images!}/>}
    {!imagePath&&['mcp','web'].includes(op.detail.kind)
      ?expanded?<ExpandedMaterial op={op}/>:<OpPreview op={op} resolving={so.resolving} onSource={measureSource}/>
      :<details className="image-original"><summary>Original input and output</summary>{imageOriginal}</details>}
  </>:null;
  return (
    <article ref={card}
      data-op-id={op.id}
      data-search-hit={searchHit || undefined}
      data-material={presentation.material}
      data-origin={so.origin.type}
      data-tool-exchange={['shell','test','mcp','web','other'].includes(op.detail.kind) || undefined}
      data-diff={op.detail.kind === 'edit' && op.detail.hunks.length > 0 && presentation.shape === 'wide' ? (isProse(op.detail.path) ? 'prose' : 'code') : undefined}
      className={`op op-${op.kind} shape-${presentation.shape} material-${presentation.material} st-${so.declined ? 'declined' : so.state} ph-${so.phase}${so.resolving ? ' resolving' : ''}${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}${lit ? ' lit' : ''}${so.matchesFilter ? '' : ' filtered-out'} ${so.phase === 'arriving' ? from : ''}`}
      style={{ zIndex: selected ? 50 : 10 + index, ...(readingAllocation ? { '--reading-width': `${readingAllocation}px` } : {}) } as React.CSSProperties}
      tabIndex={0}
      onClick={(e) => {
        // Reading or selecting captured content must not open the step and reflow
        // the text between pointer events. The heading and Enter still open it.
        if ((e.target as HTMLElement).closest('.op-body, .op-expanded, .step-reading')) return;
        select(expanded ? undefined : op.id);
      }}
      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && select(op.id)}
      onMouseEnter={() => set({ hoveredOp: op.id, hoveredPath: op.paths.find((p) => p.role !== 'search-hit')?.path })}
      onMouseLeave={e => { if (e.currentTarget.dataset.hoverReading !== 'focused') set({ hoveredOp: undefined, hoveredPath: undefined }); }}
      aria-label={op.title}
    >
      <header className="op-head">
        <MaterialGlyph material={presentation.material} />
        {experience !== 'legacy' ? <span className="studio-action-identity">{title}<span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`} title={op.tool}>{asked ? 'Question' : originLabel}{note && <><span aria-hidden="true"> · </span>{note}</>}</span></span> : <><span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`} title={so.origin.type === 'map' ? `File reference: ${so.origin.path}` : so.origin.type === 'mcp' ? `Observed MCP server: ${so.origin.server}` : `Observed tool: ${op.tool}`}>{originLabel}</span><span className="op-title" title={op.title}>{op.title.replace(/^(Read|Edit|Write|Create|Search|Test ·|Run) /, '')}</span></>}
        {op.detail.kind === 'edit' && op.detail.hunks.length > 0 && !op.declined && <DiffStat hunks={op.detail.hunks} />}
        <StateMark state={so.state} op={op} />
        {['read', 'edit', 'search', 'test', 'shell', 'mcp', 'web', 'plan', 'spawn', 'other'].includes(op.detail.kind) && (
          <button data-expand-op={op.id} className="op-expand" aria-label={`${expanded ? 'Close' : 'Expand'} ${op.title} in history`} aria-expanded={expanded} onClick={(e) => {
            e.stopPropagation();
            set({ expandedOp: expanded ? undefined : op.id, selectedOp: undefined });
          }}>{expanded ? 'Close' : 'Expand'}</button>
        )}
      </header>
      {op.declined && <DeclinedLine declined={op.declined} />}
      {!expanded && <div className="op-body">
        {imageMaterial??<><OpPreview op={op} resolving={so.resolving} onSource={measureSource}/>{op.images?.length&&op.detail.kind!=='read'?<OpImages images={op.images} compact/>:null}</>}
      </div>}
      {expanded&&<ExpandedOperation op={op} image={imageMaterial}/>}
      {!expanded && op.artifactIds.some((id) => id.endsWith('_input')) && <div className="material-context">Shortened · Expand to read all of it</div>}
      <EvidenceNote op={op} />
    </article>
  );
});

const StepProjection = createContext<Projection | undefined>(undefined);

function ScriptDetails({ op, projection }: { op: Operation; projection: Projection }) {
  const parent = op.parentOperationId ? projection.operations.find(item => item.id === op.parentOperationId) : undefined;
  const script = projection.artifacts.find(artifact => op.artifactIds.includes(artifact.id) && artifact.id.endsWith('_script'));
  const relation = parent && projection.links.find(link => link.from === parent.id && link.to === op.id && link.relation === 'tool-result');
  return parent || script ? <details className="captured-script" onClick={event => event.stopPropagation()}><summary>Script</summary><p className="insp-note">{parent ? `${relation?.explanation ?? 'Captured script reference.'} This relationship does not assert which instruction caused the work.` : 'The captured script containing this patch.'}</p>{parent ? <><ExpandedMaterial op={parent} />{parent.images?.length ? <OpImages key={parent.id} images={parent.images} /> : null}</> : <ArtifactReader key={script?.id} id={script?.id} kind="code" />}</details> : null;
}

function ExpandedOperation({ op, image }: { op: Operation; image?: React.ReactNode }) {
  const projection = useContext(StepProjection);
  return <section aria-label="Operation detail">{image ? <div className="image-material-expanded">{image}</div> : <><ExpandedMaterial op={op} />{op.images?.length ? <OpImages key={op.id} images={op.images} /> : null}</>}{projection && <><ScriptDetails op={op} projection={projection} /><StepReading op={op} projection={projection} /></>}</section>;
}

function ExpandedMaterial({ op }: { op: Operation }) {
  const d = op.detail;
  const input = op.artifactIds.find((id) => id.endsWith('_input'));
  if (browserStep(op)) return <div className="op-expanded mcp-material" onClick={e => e.stopPropagation()}><BrowserEvidence op={op} full/></div>;
  switch (d.kind) {
    case 'read':
      return <div className="op-expanded read-material" onClick={(e) => e.stopPropagation()}>
        <FileReadingActions path={d.path} op={op}/>
        <ArtifactReader key={d.excerptArtifactId} id={d.excerptArtifactId} kind="code" startLine={d.startLine} path={d.path} provenance />
      </div>;
    case 'edit':
      return <div className="op-expanded edit-material" onClick={(e) => e.stopPropagation()}>
        {d.reconstruction !== 'complete' && <div className="material-context">The file after this edit could not be verified{d.reconstructionNote ? `: ${d.reconstructionNote}` : ''}</div>}
        <FileReadingActions path={d.path} op={op}/><ReadBeforePanel op={op} />
        <BeforeTurnPanel op={op} />
        {d.hunks.length ? <DiffReader key={op.id} hunks={d.hunks} path={d.path} /> : op.artifactIds.some(id => id.endsWith('_after')) ? <ArtifactReader id={op.artifactIds.find(id => id.endsWith('_after'))} kind="code" path={d.path} provenance /> : <p className="muted">No source bytes or patch captured.</p>}
      </div>;
    case 'search':
      return <div className="op-expanded search-material" onClick={(e) => e.stopPropagation()}>
        <div className="query">{d.query} · {d.total ?? d.hits.length} recorded result{(d.total ?? d.hits.length) === 1 ? '' : 's'}</div>
        {d.hits.map((hit, i) => <button type="button" className="hit search-bead" key={i} title={`Open captured match on ${hit.path}`} onClick={event=>{event.stopPropagation();openCapturedFile(hit.path,hit.line,`${op.id}/search/${i}`);}}>{hit.path}{hit.line ? `:${hit.line}` : ''}{hit.text ? ` · ${hit.text}` : ''}</button>)}
        <CommandRunNotes op={op} />
      </div>;
    case 'test':
      return <div className="op-expanded test-material" onClick={(e) => e.stopPropagation()}>
        <CommandText text={d.command}/>
        <FixChainPanel op={op} />
        {input && <ArtifactReader id={input} kind="code" />}
        <CapturedOutcomes artifactId={d.outputArtifactId} output={d.outputPreview} fallback={d.summary ? <div className="test-counts"><span className="good">{d.summary.passed} passed</span><span className={d.summary.failed ? 'bad' : 'muted'}>{d.summary.failed} failed</span>{d.summary.skipped > 0 && <span>{d.summary.skipped} skipped</span>}<span className="muted">derived from output</span></div> : <div className="muted">Exit {d.exitCode ?? 'not captured'}</div>} />
        {d.summary?.failures.map((failure, i) => <div className="failure" key={i}><div className="failure-name">{failure.name}</div>{failure.file && <div className="muted"><CapturedPath path={failure.file} line={failure.line}>{failure.file}{failure.line ? `:${failure.line}` : ''}</CapturedPath></div>}{failure.message && <div className="failure-msg">{failure.message}</div>}</div>)}
        <ArtifactReader key={d.outputArtifactId} id={d.outputArtifactId} kind="output" fallback={d.outputPreview} />
        <CommandRunNotes op={op} />
        <div className="muted small">Exit {d.exitCode ?? 'not captured'}</div>
      </div>;
    case 'shell':
      return <div className="op-expanded shell-material" onClick={(e) => e.stopPropagation()}>
        <CommandText text={d.command}/>
        <FixChainPanel op={op} />
        {input && <ArtifactReader id={input} kind="code" />}
        <CapturedOutcomes artifactId={d.outputArtifactId} output={d.outputPreview} />
        <ArtifactReader key={d.outputArtifactId} id={d.outputArtifactId} kind="output" fallback={d.outputPreview} />
        <CommandRunNotes op={op} />
        <div className="muted small">Exit {d.exitCode ?? 'not captured'}</div>
      </div>;
    case 'mcp':
      return <div className="op-expanded mcp-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">{d.server} / {d.tool} · captured input</div>
        <ToolInput value={d.input}/>
        <StoredToolResult op={op} full/>
      </div>;
    case 'web':
      return <div className="op-expanded web-material" onClick={e => e.stopPropagation()}><WebEvidence op={op} full/></div>;
    case 'plan':
      return <div className="op-expanded plan-material" onClick={(e) => e.stopPropagation()}><PlanChecklist op={op} full/></div>;
    case 'spawn':
      return <DelegationDetail op={op} d={d}/>;
    case 'other':
      if (isQuestionTool(op.tool)) return <div className="op-expanded other-material" onClick={(e) => e.stopPropagation()}><QuestionCard op={op}/><div className="material-context">Captured result</div><ToolOutput text={d.resultPreview || (op.status === 'running' ? 'Waiting for the answer' : 'No result content captured')}/></div>;
      return <div className="op-expanded other-material" onClick={(e) => e.stopPropagation()}>
        <div className="material-context">Captured input</div>
        <ToolInput value={d.input}/>
        <StoredToolResult op={op} full/>
      </div>;
    default:
      return null;
  }
}

function StateMark({ state,op }: { state: SceneOp['state'];op:Operation }) {
  if (op.declined) return <span className="state state-declined" aria-label="declined" title={op.declined.by === 'person' ? 'You declined this action; it did not run.' : 'Claude Code’s auto mode blocked this action; it did not run.'}>⊘</span>;
  const outcome=operationOutcome({...op,status:state});
  if(outcome.tone==='returned'||outcome.tone==='reported')return <span className={`state state-${outcome.tone}`} aria-label={outcome.label} title={outcome.explanation}>{outcome.mark}</span>;
  if (state === 'running') return <span className="state state-running" aria-label="running" />;
  if (state === 'error') return <span className="state state-error" aria-label="failed">✕</span>;
  if (state === 'ok') return <span className="state state-ok" aria-label="done">✓</span>;
  return <span className="state state-unknown" aria-label={outcome.label} title={outcome.explanation}>{outcome.mark}</span>;
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
  if (browserStep(op)) return <BrowserEvidence op={op}/>;
  switch (d.kind) {
    case 'read':
      return <>
        {op.status === 'running' && <div className="request-line excerpt-range">Requested from line {d.startLine}{d.lineCount > 0 ? ` through ${d.startLine + d.lineCount - 1}` : ''} · awaiting excerpt</div>}
        <ResultArea state={op.status} resolving={resolving}>{op.status === 'running' && !d.excerptArtifactId ? <PendingResult /> : pathOnlyImage(op) ? <>{op.images?.length ? <OpImages images={op.images} compact /> : null}<PathImage op={op} path={pathOnlyImage(op)!} /></> : !d.excerptArtifactId && op.images?.length ? <OpImages images={op.images!} compact /> : <ReadPreview onSource={onSource} opId={op.id} artifactId={d.excerptArtifactId} start={d.startLine} path={d.path} />}</ResultArea>
      </>;
    case 'edit':
      return <>
        {(op.status === 'running' || op.status === 'unknown' || d.reconstruction !== 'complete') && <div className="request-line">{op.status === 'running' ? 'Patch request · awaiting recorded outcome' : op.status === 'unknown' && op.classification.kind === 'derived' ? 'Outcome not exposed' : 'After-state not verified'}</div>}
        {op.status === 'running' && <PatchRequest op={op} path={d.path} />}
        <ResultArea state={op.status} resolving={resolving}>{d.hunks.length ? <ChangePreview hunks={d.hunks} path={d.path} /> : op.artifactIds.some(id => id.endsWith('_after')) ? <ReadPreview opId={op.id} artifactId={op.artifactIds.find(id => id.endsWith('_after'))} start={1} path={d.path} /> : op.status === 'running' ? <PendingResult /> : <div className="muted">{d.reconstructionNote ?? 'No source bytes or patch captured.'}</div>}</ResultArea>
      </>;
    case 'search':
      return (
        <div className="hits">
          <div className="query">{d.query}</div>
          <ResultArea state={op.status} resolving={resolving}>
            {d.hits.slice(0, 5).map((h, i) => (
              <button key={i} className="hit search-bead" title={`Open captured match on ${h.path}`} onClick={(e) => { e.stopPropagation(); openCapturedFile(h.path,h.line,`${op.id}/search/${i}`); }} onMouseEnter={() => set({ hoveredPath: h.path })}>
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
          <CommandText text={d.command} compact/>
          <ResultArea state={op.status} resolving={resolving}><CapturedOutcomes artifactId={d.outputArtifactId} output={d.outputPreview} onFailure={() => set({ expandedOp: op.id, selectedOp: undefined })} fallback={s ? (
            <VerificationStrip summary={s} output={d.outputPreview} onFailure={() => set({ expandedOp: op.id, selectedOp: undefined })} />
          ) : op.status !== 'running' ? (
            <div className="muted">exit {d.exitCode ?? '?'}</div>
          ) : <div className="muted">Waiting for output</div>} />
          {s?.failures[0] && (
            <div className="failure">
              <div className="failure-name">{s.failures[0].name}</div>
              {s.failures[0].message && <div className="failure-msg">{s.failures[0].message}</div>}
            </div>
          )}
          {d.outputPreview&&<TerminalPreview artifactId={d.outputArtifactId} text={d.outputPreview} failed={operationFailed(op)}/>}
          </ResultArea>
        </div>
      );
    }
    case 'shell':
      return (
        <div className="shell">
          <CommandText text={d.command} compact/>
          <ResultArea state={op.status} resolving={resolving}>
            <CapturedOutcomes artifactId={d.outputArtifactId} output={d.outputPreview} onFailure={() => set({ expandedOp: op.id, selectedOp: undefined })} />
            {d.outputPreview ? <TerminalPreview artifactId={d.outputArtifactId} text={d.outputPreview} failed={operationFailed(op)} /> : <span className="muted">{op.status === 'running' ? 'Waiting for output' : 'No output captured'}</span>}
            {d.exitCode !== undefined && d.exitCode !== 0 && d.exitCode !== null && <div className="bad">exit {d.exitCode}</div>}
          </ResultArea>
        </div>
      );
    case 'mcp':
      return (
        <div className="mcp">
          <div className="mcp-tool">{d.tool}</div>
          <ToolInput value={d.input}/>
          <ResultArea state={op.status} resolving={resolving}>
            <div className="mcp-result"><StoredToolResult op={op}/></div>
          </ResultArea>
        </div>
      );
    case 'web':
      return <WebEvidence op={op}/>;
    case 'spawn':
      return (
        <div className="spawn">
          <div className="query">{d.agentType ?? 'subagent'}</div>
          <div className="muted">{d.descriptionEncrypted ? 'Task text not recorded: Codex stored it encrypted' : d.description}</div>
          <DelegationLine d={d}/>
        </div>
      );
    case 'plan':
      return <PlanChecklist op={op}/>;
    default:
      if (isQuestionTool(op.tool)) return <QuestionCard op={op}/>;
      return <>
        <ToolInput value={d.input}/>
        <ResultArea state={op.status} resolving={resolving}><div className="mcp-result"><StoredToolResult op={op}/></div></ResultArea>
      </>;
  }
}

/**
 * A prompt as a chapter: the person's words (three lines, the rest one click away) and, once the turn is over,
 * a single line of what it did. The newest turn waits until the agent is quiet, and replay shows no ledger,
 * so nothing here tells the future.
 */
function TurnBlock({ prompt, time, step, fold, permissionMode, images, plan }: { prompt: string; time?: string; step?: number; permissionMode?: string; images?: OperationImage[]; plan?: PinnedPlan; fold?: { folded: boolean; toggle: () => void } }) {
  const ledger = useTurns((s) => step === undefined ? undefined : s.byStep.get(step));
  const newest = useTurns((s) => s.lastStep === step);
  const active = useNow((s) => !!s.view?.mark);
  const mode = useApp((s) => s.mode);
  const text = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useDisclosureChoice(`prompt/${step ?? 'first'}`, false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = text.current;
    if (!el) return;
    const measure = () => { if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [prompt, expanded]);
  // Claude Code writes some notices in the user role (a finished background task, a command echo); those are not the person's words.
  const injected = injectedMessage(prompt);
  const who = injected ? <span className="turn-who turn-source" title={`Written into the journal by Claude Code, not typed by you${injected.hover ? ` · ${injected.hover}` : ''}`}>Claude Code · {injected.label}</span> : <span className="turn-who">You</span>;
  const report = contextReport(prompt);
  const shown = report ? undefined : injected ? injected.detail : prompt;
  const captured = injected && !report ? <details className="turn-captured"><summary>Captured text</summary><pre className="output">{prompt}</pre></details> : null;
  // The chapter treatment belongs to Modern; the retained UIs keep their original prompt block.
  if (typeof document === 'undefined' || document.documentElement.dataset.uiVersion !== 'modern') return <div className="turn">{who}{shown && <div className="turn-text">{shown}</div>}{captured}{report && <CapturedContextReport report={report} time={time} />}{images?.length ? <div className="turn-images"><OpImages images={images} compact /></div> : null}</div>;
  const parts = ledger && mode === 'history' && !(newest && active) ? ledgerParts(ledger) : [];
  const basis = ledgerBasis(ledger);
  const settings = ledger?.recorded?.settingsChange && mode === 'history' ? settingsLine(ledger.recorded.settingsChange) : undefined;
  return (
    <div className="turn">
      {who}
      {shown && <div ref={text} className={`turn-text${expanded ? '' : ' clamped'}`}>{shown}</div>}
      {captured}
      {report && <CapturedContextReport report={report} time={time} />}
      {(overflows || expanded) && <button type="button" className="turn-more" aria-expanded={expanded} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>{expanded ? 'Show less' : `Show full prompt · ${shown?.length.toLocaleString() ?? 0} characters`}</button>}
      {images?.length ? <div className="turn-images"><OpImages images={images} compact /></div> : null}
      {plan && <PinnedPlanList plan={plan} />}
      {permissionMode && <div className="turn-mode" title="Claude Code permission mode recorded with this prompt; shown when it changes">{PERMISSION_MODE[permissionMode] ?? permissionMode}</div>}
      {settings && <div className="turn-mode" title={settings.title}>{settings.text}</div>}
      {fold ? (
        // The ledger line is the fold control: what the turn did is what stays when it folds.
        <button type="button" className="turn-ledger turn-fold" aria-expanded={!fold.folded} aria-label={`${fold.folded ? 'Unfold' : 'Fold'} this turn${parts.length ? `: ${parts.map((part) => part.text).join(', ')}` : ''}`} title={`${fold.folded ? 'Unfold' : 'Fold'} this turn${parts.length ? `. ${basis}` : ''}`} onClick={(e) => { e.stopPropagation(); fold.toggle(); }}>
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {parts.map((part, i) => <Fragment key={i}>{i > 0 && ' · '}<span className={part.tone}>{part.text}</span></Fragment>)}
        </button>
      ) : parts.length > 0 && <div className="turn-ledger" title={basis}>{parts.map((part, i) => <Fragment key={i}>{i > 0 && ' · '}<span className={part.tone}>{part.text}</span></Fragment>)}</div>}
    </div>
  );
}

/** Claude Code permission modes, in its own words where it has them. */
const PERMISSION_MODE: Record<string, string> = { default: 'Asks before edits', acceptEdits: 'Accepts edits', auto: 'Auto mode', bypassPermissions: 'Bypasses permissions', plan: 'Plan mode' };

/** Added and removed lines, counted from the captured patch. */
function DiffStat({ hunks }: { hunks: Hunk[] }) {
  const { added, removed } = diffStat(hunks);
  return <span className="op-stat" aria-label={`${added} lines added, ${removed} removed`}><b className="add">+{added}</b><b className="del">−{removed}</b></span>;
}

/** One quiet note per card: what the evidence is and where it stops. Hidden at rest, reachable by hover, focus and touch. */
function EvidenceNote({ op }: { op: Operation }) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  return <>
    <button type="button" className="op-info" popoverTarget={id} aria-label="About this evidence" onClick={(e) => {
      e.stopPropagation();
      const box = e.currentTarget.getBoundingClientRect(), note = popover.current;
      if (note) { note.style.left = `${Math.max(8, Math.min(innerWidth - 328, box.right - 320))}px`; note.style.top = `${Math.min(innerHeight - 190, box.bottom + 6)}px`; }
    }}>ⓘ</button>
    <div ref={popover} id={id} popover="auto" role="note" className="op-evidence">{evidenceNotes(op).map((line, i) => <p key={i}>{line}</p>)}</div>
  </>;
}

// A live burst mounts many previews in one commit. Scrolling each one in its own layout effect
// interleaves an offsetTop read with a scrollTop write, so every card forces a full layout.
// Queue them and flush once, after the commit and before paint: all reads, then all writes.
const pendingPreviewScrolls = new Set<HTMLElement>();
function flushPreviewScrolls() {
  const targets = [...pendingPreviewScrolls].map(root => ({ body: root.closest<HTMLElement>('.op-body'), changed: root.querySelector<HTMLElement>('.add,.del') }))
    .map(({ body, changed }) => body && changed ? { body, top: Math.max(0, changed.offsetTop - body.offsetTop - 48) } : undefined);
  pendingPreviewScrolls.clear();
  for (const target of targets) if (target) target.body.scrollTop = target.top;
}

/** All captured changes are reachable; large patches page explicitly rather than disappearing. */
function ChangePreview({ hunks, path }: { hunks: Hunk[]; path: string }) {
  const total = hunks.reduce((n, h) => n + h.lines.length, 0);
  const paged = total > 600;
  const [page, setPage] = useState(() => paged ? Math.floor(firstChangeOffset(hunks) / 120) : 0);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    if (!pendingPreviewScrolls.size) queueMicrotask(flushPreviewScrolls);
    pendingPreviewScrolls.add(root.current);
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
