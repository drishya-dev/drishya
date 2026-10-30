import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { screenRun, type ScreenRun, type ScreenStep } from '@drishya/scene';
import type { OperationImage } from '@drishya/contracts';
import { useApp } from '../state.ts';
import './screen-view.css';

const MAX_PLAY_GAP_MS = 2500, MIN_PLAY_GAP_MS = 600;

/** The recorded computer-use run: from the daemon over the whole recording when it can, else from the operations in hand (offline bundles). */
export function useScreenRun(enabled: boolean) {
  const source = useApp(s => s.source);
  const recordingId = useApp(s => s.recordingId);
  const replayStep = useApp(s => s.mode === 'replay' ? s.step : undefined);
  const projection = useApp(s => s.projection);
  const revision = useApp(s => s.historyPage?.scene.total ?? s.projection?.timeline.length ?? 0);
  const [remote, setRemote] = useState<{ key: string; run?: ScreenRun; error?: string }>();
  const key = `${recordingId}/${replayStep ?? 'end'}/${revision}`;
  const local = useMemo(() => enabled && !source?.screen && projection ? screenRun(projection.operations) : undefined, [enabled, source, projection]);
  useEffect(() => {
    if (!enabled || !source?.screen || !recordingId) return;
    let current = true;
    const timer = setTimeout(() => {
      source.screen!(recordingId, replayStep).then(run => { if (current) setRemote({ key, run }); }, (error: Error) => { if (current) setRemote({ key, error: error.message }); });
    }, replayStep === undefined ? 0 : 250);
    return () => { current = false; clearTimeout(timer); };
  }, [enabled, source, recordingId, replayStep, key]);
  if (local) return { run: local };
  // A newer answer replaces an older one; until it arrives the older run stays on screen rather than flashing empty.
  return { run: remote?.run, error: remote?.error, loading: !remote };
}

/** Session-menu entry: only when the run has at least one captured frame. */
export function ScreenEntry({ menuOpen }: { menuOpen: boolean }) {
  const { run } = useScreenRun(menuOpen);
  if (!run?.frames) return null;
  return <button type="button" className="btn ghost screen-entry" onClick={event => {
    event.currentTarget.closest('details.workspace-menu')?.removeAttribute('open');
    useApp.setState({ screenView: {} });
  }}>Screen · {run.frames} {run.frames === 1 ? 'frame' : 'frames'}</button>;
}

/** Mounted once in the viewer so the strip and the session menu open the same reader. */
export function ScreenHost() {
  const open = useApp(s => s.screenView);
  return open ? <ScreenView opId={open.opId} onClose={() => useApp.setState({ screenView: undefined })}/> : null;
}

const SIZE_UNITS = ['B', 'KB', 'MB'];
const bytesLabel = (bytes?: number) => { if (bytes === undefined) return ''; let n = bytes, i = 0; while (n >= 1024 && i < 2) { n /= 1024; i++; } return `${i ? n.toFixed(1) : n} ${SIZE_UNITS[i]}`; };
const WHY: Record<string, string> = { 'too-large': 'larger than the 4 MB kept per image', 'recording-budget': 'past the 256 MB of images kept per session', protected: 'from a protected file', unrecognised: 'not a recognised image type', remote: 'a remote reference, never fetched' };
const clip = (value: string, n: number) => value.length > n ? `${value.slice(0, n)}…` : value;

function describe(step: ScreenStep): string {
  const at = step.point ? ` at ${Math.round(step.point[0])}, ${Math.round(step.point[1])}` : '';
  switch (step.gesture) {
    case 'screenshot': return 'Screenshot';
    case 'zoom': return step.region ? `Zoom into ${step.region.map(Math.round).join(', ')}` : 'Zoom';
    case 'click': return `Click${at}`;
    case 'double-click': return `Double click${at}`;
    case 'triple-click': return `Triple click${at}`;
    case 'right-click': return `Right click${at}`;
    case 'hover': return `Move pointer${at}`;
    case 'drag': return step.from && step.point ? `Drag ${Math.round(step.from[0])}, ${Math.round(step.from[1])} to ${Math.round(step.point[0])}, ${Math.round(step.point[1])}` : 'Drag';
    case 'scroll': return `Scroll ${step.scroll?.direction ?? ''}${step.scroll?.amount !== undefined ? ` ${step.scroll.amount}` : ''}${at}`.replace(/\s+/g, ' ').trim();
    case 'type': return step.text !== undefined ? `Type “${clip(step.text, 120)}”` : 'Type';
    case 'key': return step.text !== undefined ? `Key ${clip(step.text, 60)}` : 'Key';
    case 'wait': return step.waitSeconds !== undefined ? `Wait ${step.waitSeconds} s` : 'Wait';
    case 'scroll-to': return step.ref ? `Scroll element ${step.ref} into view` : 'Scroll an element into view';
    default: return step.action.replace(/_/g, ' ');
  }
}
const UNPLACED: Record<NonNullable<ScreenStep['unplaced']>, string> = {
  'no-position': 'No position was recorded.',
  'element-only': 'Targets an element, not a position, so nothing is drawn.',
  'no-frame': 'No earlier frame was captured to place it on.',
  'result-frame': 'This image is the result of the action; its position belongs to the previous frame.',
  'outside-frame': 'The recorded position lies outside the captured frame, so nothing is drawn.',
  'frame-size-unknown': 'The frame size was not recorded, so the position is not drawn.',
  'frame-size-differs': 'The recorded frame size does not match the stored image, so the position is not drawn.',
};
const SHORT: Record<string, string> = { screenshot: 'shot', zoom: 'zoom', click: 'click', 'double-click': '2×', 'triple-click': '3×', 'right-click': 'right', drag: 'drag', hover: 'move', scroll: 'scroll', type: 'type', key: 'key', wait: 'wait', 'scroll-to': 'scroll', other: '·' };

function gapLabel(ms: number | undefined): string | undefined {
  if (ms === undefined || ms < 5000) return;
  const minutes = Math.round(ms / 60000);
  return minutes < 1 ? `${Math.round(ms / 1000)} s later` : minutes < 90 ? `${minutes} min later` : `${(ms / 3600000).toFixed(1)} h later`;
}
const gapBefore = (steps: readonly ScreenStep[], i: number) => {
  const a = steps[i - 1]?.time, b = steps[i]?.time;
  if (!a || !b) return undefined;
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
};

function useImageUrl() {
  const source = useApp(s => s.source);
  const recordingId = useApp(s => s.recordingId);
  return (image?: OperationImage) => image?.sha && source?.imageUrl && recordingId ? source.imageUrl(recordingId, image.sha) : undefined;
}

export function ScreenView({ opId, onClose }: { opId?: string; onClose: () => void }) {
  const { run, error } = useScreenRun(true);
  const imageUrl = useImageUrl();
  const dialog = useRef<HTMLDialogElement>(null);
  const live = useApp(s => s.recording?.live === true);
  const steps = run?.steps ?? [];
  const [choice, setChoice] = useState<number>();
  const [full, setFull] = useState(false);
  const [playing, setPlaying] = useState(false);
  const last = steps.length - 1;
  const lastFrame = (() => { for (let i = last; i >= 0; i--) if (steps[i]!.image) return i; return last; })();
  const wanted = opId ? steps.findIndex(s => s.id === opId) : -1;
  // Until the reader moves, it shows the step it was opened on, else the newest frame; a live run keeps following the end.
  const [pinned, setPinned] = useState(false);
  const index = Math.max(0, Math.min(last, choice ?? (wanted >= 0 ? wanted : lastFrame)));
  const step = steps[index];
  const follow = live && !pinned && wanted < 0;
  const shownIndex = follow ? lastFrame : index;
  const shown = steps[shownIndex];
  const go = (next: number) => { setPinned(true); setChoice(Math.max(0, Math.min(last, next))); };

  useEffect(() => { dialog.current?.showModal(); }, []);
  // Playback follows captured timestamps with long gaps capped; it never reveals a step the run does not yet hold.
  useEffect(() => {
    if (!playing) return;
    if (shownIndex >= last) { setPlaying(false); return; }
    const gap = gapBefore(steps, shownIndex + 1);
    const timer = setTimeout(() => { setPinned(true); setChoice(shownIndex + 1); }, Math.max(MIN_PLAY_GAP_MS, Math.min(MAX_PLAY_GAP_MS, gap ?? 1000)));
    return () => clearTimeout(timer);
  }, [playing, shownIndex, last, steps]);

  // The strip keeps the current cell in view without moving the page.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { strip.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [shownIndex]);

  if (!shown || !step) {
    return <dialog ref={dialog} className="screen-view" aria-label="Screen view" onClose={onClose}>
      <div className="screen-bar"><span>Screen</span><button type="button" onClick={() => dialog.current?.close()}>Close</button></div>
      <p className="screen-empty" role="status">{error ? `The screen run could not be loaded: ${error}` : run ? 'No computer-use steps were captured in this session.' : 'Loading captured screen steps…'}</p>
    </dialog>;
  }

  const frameStep = shown.frame !== undefined ? steps[shown.frame] : undefined;
  const image = frameStep?.image;
  const url = imageUrl(image);
  const gap = gapLabel(gapBefore(steps, shownIndex));
  const frameNote = !frameStep ? 'No frame captured yet' : shown.image ? 'Frame returned by this step' : `No new frame captured · showing step ${shown.frame! + 1}`;
  const ratio = image?.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined;
  const key = (event: React.KeyboardEvent) => {
    const k = event.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') go(shownIndex + 1);
    else if (k === 'ArrowLeft' || k === 'ArrowUp') go(shownIndex - 1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(last);
    else if (k === ' ' && !(event.target as HTMLElement).closest('button')) setPlaying(p => !p);
    else if (k === 'f' || k === 'F') setFull(v => !v);
    else return;
    event.preventDefault();
  };

  return <dialog ref={dialog} className={`screen-view${full ? ' full' : ''}`} aria-label="Screen view" onClose={onClose} onKeyDown={key}
    onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <div className="screen-bar">
      <span className="screen-title">Screen</span>
      <span className="screen-count" aria-live="polite">Step {shownIndex + 1} of {steps.length}{run?.truncated ? ` · newest ${steps.length} of ${run.total}` : ''}{follow ? ' · following live' : ''}</span>
      <span className="screen-spacer"/>
      <button type="button" aria-label="Previous step" disabled={shownIndex === 0} onClick={() => go(shownIndex - 1)}>‹</button>
      <button type="button" aria-pressed={playing} disabled={shownIndex >= last && !playing} onClick={() => { if (!playing && shownIndex >= last) return; setPlaying(p => !p); }}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" aria-label="Next step" disabled={shownIndex >= last} onClick={() => go(shownIndex + 1)}>›</button>
      <button type="button" aria-pressed={full} title="Full window (F)" onClick={() => setFull(v => !v)}>{full ? 'Window' : 'Full window'}</button>
      <button type="button" onClick={() => dialog.current?.close()}>Close</button>
    </div>
    <div className="screen-stage">
      {url && image ? <Frame key={shown.frame} url={url} image={image} ratio={ratio} step={shown} previous={steps[shownIndex - 1] && steps[shownIndex - 1]!.frame !== shown.frame ? imageUrl(steps[steps[shownIndex - 1]!.frame ?? -1]?.image) : undefined}/>
        : <div className="screen-missing" role="status" style={ratio}>{image ? `Image not retained${image.omitted ? `: ${WHY[image.omitted] ?? image.omitted}` : ''}${image.width && image.height ? ` · recorded ${image.width}×${image.height}` : ''}${image.bytes ? ` · ${bytesLabel(image.bytes)}` : ''}` : 'No frame captured yet'}</div>}
    </div>
    <div className="screen-caption">
      <strong>{describe(shown)}</strong>
      {shown.status === 'error' && <span className="screen-fail">Failed</span>}
      {shown.status === 'running' && <span>Running</span>}
      {gap && <span title="Time before this step in the recording; playback shortens long gaps">{gap}</span>}
    </div>
    <div className="screen-meta">
      <span>{frameNote}</span>
      {shown.context?.title && <span title={shown.context.url}>{shown.context.title}</span>}
      {shown.context?.url && <span className="screen-url" title={shown.context.url}>{shown.context.url}</span>}
      {shown.unplaced && !shown.marker && shown.unplaced !== 'no-position' && <span>{UNPLACED[shown.unplaced]}</span>}
      <button type="button" className="screen-link" onClick={() => { dialog.current?.close(); useApp.getState().select(shown.id); }}>Open operation</button>
    </div>
    <div className="screen-strip" ref={strip} role="listbox" aria-label="Captured steps">
      {steps.map((s, i) => {
        const thumb = s.image ? imageUrl(s.image) : undefined;
        return <button type="button" role="option" key={s.id} className={`screen-cell${s.image ? ' frame' : ''}${s.status === 'error' ? ' failed' : ''}`} aria-selected={i === shownIndex} aria-current={i === shownIndex ? 'step' : undefined}
          aria-label={`Step ${i + 1}: ${describe(s)}`} title={`${i + 1} · ${describe(s)}`} tabIndex={i === shownIndex ? 0 : -1} onClick={() => go(i)}>
          {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async"/> : <span>{s.image ? 'no image' : SHORT[s.gesture]}</span>}
          <small>{i + 1}</small>
        </button>;
      })}
    </div>
  </dialog>;
}

/** One captured screenshot with the recorded action drawn on it at its recorded position; the previous frame fades out beneath. */
function Frame({ url, image, step, previous, ratio }: { url: string; image: OperationImage; step: ScreenStep; previous?: string; ratio?: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(previous);
  useEffect(() => { if (!leaving) return; const t = setTimeout(() => setLeaving(undefined), 220); return () => clearTimeout(t); }, [leaving]);
  const m = step.marker;
  const origin = m ? { transformOrigin: `${m.x * 100}% ${m.y * 100}%` } : undefined;
  if (failed) return <div className="screen-missing" role="status" style={ratio}>The captured image could not be loaded.</div>;
  return <div className="screen-frame">
    {leaving && <img className="screen-leaving" src={leaving} alt="" aria-hidden="true"/>}
    <img className="screen-image" style={origin} src={url} alt={`Captured screen · ${image.width && image.height ? `${image.width}×${image.height}` : 'size not recorded'}`} width={image.width} height={image.height} decoding="async" onError={() => setFailed(true)}/>
    {m && <Mark step={step} x={m.x} y={m.y} fromX={m.fromX} fromY={m.fromY}/>}
  </div>;
}

function Mark({ step, x, y, fromX, fromY }: { step: ScreenStep; x: number; y: number; fromX?: number; fromY?: number }) {
  const at = { left: `${x * 100}%`, top: `${y * 100}%` } as CSSProperties;
  return <>
    {step.gesture === 'drag' && fromX !== undefined && fromY !== undefined && <>
      <svg className="screen-drag" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={fromX * 100} y1={fromY * 100} x2={x * 100} y2={y * 100} vectorEffect="non-scaling-stroke"/></svg>
      <span className="screen-mark start" style={{ left: `${fromX * 100}%`, top: `${fromY * 100}%` }} aria-hidden="true"/>
    </>}
    <span className={`screen-mark ${step.gesture}`} data-direction={step.scroll?.direction} style={at} aria-hidden="true"/>
  </>;
}
