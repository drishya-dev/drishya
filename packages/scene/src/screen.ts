import type { Operation, OperationImage, OperationStatus } from '@drishya/contracts';

/** SCREEN-1: a computer-use run as captured steps over captured frames. Pure: no clock, no DOM, nothing fetched. */
export type ScreenGesture = 'screenshot' | 'zoom' | 'click' | 'double-click' | 'right-click' | 'triple-click' | 'drag' | 'hover' | 'scroll' | 'type' | 'key' | 'wait' | 'scroll-to' | 'other';
export type Point = [number, number];

export interface ScreenStep {
  /** Unique per step: the operation id, plus `#n` for the nth computer action of a batched operation. */
  id: string;
  /** The operation that recorded this step, for "open operation". */
  operationId: string;
  sequence: number;
  time?: string;
  agentId: string;
  status: OperationStatus;
  /** The recorded action word, exactly as the harness wrote it. */
  action: string;
  gesture: ScreenGesture;
  point?: Point;
  from?: Point;
  region?: [number, number, number, number];
  text?: string;
  scroll?: { direction: string; amount?: number };
  ref?: string;
  waitSeconds?: number;
  /** The `scale` a screenshot asked for; the stored image is then a scaled copy of the frame positions refer to. */
  scale?: number;
  tab?: string;
  /** Tab title and address as the result recorded them. */
  context?: { title?: string; url?: string };
  /** The image this step returned, when it returned one. */
  image?: OperationImage;
  /** A batch returned this many images but not one per screenshot action, so none is matched to a step; they stay on the operation. */
  unmatchedImages?: number;
  /** Index (in `steps`) of the step whose image this one shows: its own, else the latest screenshot. */
  frame?: number;
  /** Where the recorded position falls on that frame, as fractions. Absent when it cannot be placed truthfully. */
  marker?: { x: number; y: number; fromX?: number; fromY?: number };
  /** Why a recorded position is not drawn. */
  unplaced?: 'no-position' | 'element-only' | 'no-frame' | 'result-frame' | 'outside-frame' | 'frame-size-unknown' | 'frame-size-differs';
}

export interface ScreenRun { steps: ScreenStep[]; /** All matching steps, before the cap. */ total: number; /** Steps with a captured or omitted image. */ frames: number; truncated: boolean }

export const SCREEN_STEP_CAP = 1000;

const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === 'string' ? value : undefined;
const finite = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const point = (value: unknown): Point | undefined => Array.isArray(value) && value.length === 2 && finite(value[0]) !== undefined && finite(value[1]) !== undefined ? [value[0] as number, value[1] as number] : undefined;

const BROWSER_SERVER = /(?:browser|chrome|playwright|computer)/i;

/** The computer tool of a browser server (Claude Code MCP), Claude Code's own `computer` tool, or a browser batch holding computer actions. */
export function isScreenOperation(op: Operation): boolean {
  const d = op.detail;
  if (d.kind === 'mcp') return d.tool === 'computer' && BROWSER_SERVER.test(d.server) || batchedActions(op).length > 0;
  return d.kind === 'other' && op.tool === 'computer';
}

const GESTURES: Record<string, ScreenGesture> = {
  screenshot: 'screenshot', zoom: 'zoom', left_click: 'click', middle_click: 'click', right_click: 'right-click', double_click: 'double-click', triple_click: 'triple-click',
  left_click_drag: 'drag', mouse_move: 'hover', hover: 'hover', scroll: 'scroll', type: 'type', key: 'key', hold_key: 'key', wait: 'wait', scroll_to: 'scroll-to',
};
const POINTER = new Set<ScreenGesture>(['click', 'double-click', 'right-click', 'triple-click', 'drag', 'hover', 'scroll']);

function input(op: Operation): Record<string, unknown> | undefined {
  let value = op.detail.kind === 'mcp' || op.detail.kind === 'other' ? op.detail.input : undefined;
  if (typeof value === 'string' && value.length <= 131072) { try { value = JSON.parse(value); } catch { /* Incomplete input stays in the raw reader. */ } }
  return object(value);
}

const result = (op: Operation) => op.detail.kind === 'mcp' || op.detail.kind === 'other' ? op.detail.resultPreview : undefined;

/** The coordinate frame the harness reported for a screenshot ("Screenshot size: 1568x882"). */
function reportedSize(preview: string | undefined): { width: number; height: number } | undefined {
  const m = preview && /Screenshot size:\s*(\d{1,5})x(\d{1,5})/.exec(preview);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

function tabContext(preview: string | undefined, tab: string | undefined): ScreenStep['context'] {
  if (!preview) return;
  const id = tab ?? /Executed on tabId:\s*(\S+)/.exec(preview)?.[1];
  if (!id) return;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`tabId ${escaped}: "([^"\\n]{0,300})"(?: \\("?([^")\\n]{0,500})"?\\))?`).exec(preview);
  return m ? { title: m[1] || undefined, url: m[2] || undefined } : undefined;
}

/** The computer actions a browser batch recorded, in order. */
function batchedActions(op: Operation): Record<string, unknown>[] {
  const d = op.detail;
  if (d.kind !== 'mcp' || d.tool !== 'browser_batch' || !BROWSER_SERVER.test(d.server)) return [];
  const actions = input(op)?.actions;
  return Array.isArray(actions) ? actions.flatMap(entry => { const e = object(entry), fields = object(e?.input); return text(e?.name) === 'computer' && fields ? [fields] : []; }) : [];
}

interface Item { op: Operation; id: string; fields?: Record<string, unknown>; image?: OperationImage; reported?: { width: number; height: number }; unmatchedImages?: number }

/** One item per computer action: a direct call is one; a batch is one per computer action inside it. */
function items(op: Operation): Item[] {
  const preview = result(op);
  const actions = batchedActions(op);
  if (!actions.length) return [{ op, id: op.id, fields: input(op), image: op.images?.[0], reported: reportedSize(preview) }];
  // A batch returns its screenshots in order. They are matched to its screenshot and zoom actions only when the counts agree.
  const producing = actions.filter(a => a.action === 'screenshot' || a.action === 'zoom').length;
  const images = op.images ?? [];
  const matched = images.length === producing;
  const reports = [...(preview ?? '').matchAll(/Screenshot size:\s*(\d{1,5})x(\d{1,5})/g)].map(m => ({ width: Number(m[1]), height: Number(m[2]) }));
  const shots = actions.filter(a => a.action === 'screenshot').length;
  let image = 0, shot = 0;
  return actions.map((fields, i) => {
    const makes = fields.action === 'screenshot' || fields.action === 'zoom';
    const item: Item = { op, id: `${op.id}#${i}`, fields, image: makes && matched ? images[image] : undefined, unmatchedImages: !matched && images.length ? images.length : undefined };
    if (makes) image++;
    if (fields.action === 'screenshot') { if (reports.length === shots) item.reported = reports[shot]; shot++; }
    return item;
  });
}

export function screenRun(operations: readonly Operation[]): ScreenRun {
  const ordered = operations.filter(isScreenOperation).sort((a, b) => a.startSequence - b.startSequence || (a.id < b.id ? -1 : 1)).flatMap(items);
  const steps: ScreenStep[] = [];
  const sizes = new Map<number, { width: number; height: number; basis: 'reported' | 'image' }>();
  let latestShot: number | undefined;
  // A position refers to the latest screenshot of its own tab; '' holds screenshots that recorded no tab.
  const shotByTab = new Map<string, number>();
  for (const { op, id, fields, image, reported, unmatchedImages } of ordered) {
    const action = text(fields?.action) ?? 'unknown', gesture = GESTURES[action] ?? 'other';
    const preview = result(op);
    const step: ScreenStep = {
      id, operationId: op.id, unmatchedImages, sequence: op.startSequence, time: op.startTime, agentId: op.agentId, status: op.status, action, gesture,
      point: point(fields?.coordinate), from: point(fields?.start_coordinate),
      region: Array.isArray(fields?.region) && fields.region.length === 4 && fields.region.every(v => finite(v) !== undefined) ? fields.region as [number, number, number, number] : undefined,
      text: text(fields?.text), ref: text(fields?.ref), waitSeconds: finite(fields?.duration), scale: finite(fields?.scale),
      tab: text(fields?.tabId) ?? (finite(fields?.tabId) !== undefined ? String(fields!.tabId) : undefined),
      image,
    };
    const direction = text(fields?.scroll_direction);
    if (direction) step.scroll = { direction, amount: finite(fields?.scroll_amount) };
    step.context = tabContext(preview, step.tab);
    const index = steps.length;
    if (image && gesture === 'screenshot') {
      if (reported) sizes.set(index, { ...reported, basis: 'reported' });
      // Without a reported frame, the stored image is the frame only when no scaling was asked for; otherwise positions cannot be placed.
      else if (image.width && image.height && (step.scale === undefined || step.scale === 1)) sizes.set(index, { width: image.width, height: image.height, basis: 'image' });
      latestShot = index;
      shotByTab.set(step.tab ?? '', index);
    }
    if (image) step.frame = index;
    else {
      const aimed = !POINTER.has(gesture) || step.tab === undefined ? latestShot : shotByTab.get(step.tab) ?? shotByTab.get('');
      if (aimed !== undefined) step.frame = aimed;
    }
    if (POINTER.has(gesture)) place(step, steps, sizes);
    steps.push(step);
  }
  const total = steps.length;
  if (total <= SCREEN_STEP_CAP) return { steps, total, frames: steps.filter(s => s.image).length, truncated: false };
  const offset = total - SCREEN_STEP_CAP;
  const kept = steps.slice(offset).map(s => ({ ...s, frame: s.frame !== undefined && s.frame >= offset ? s.frame - offset : undefined }));
  return { steps: kept, total, frames: kept.filter(s => s.image).length, truncated: true };
}

/** A recorded position is drawn only where the evidence puts it: on the screenshot it was aimed at, inside that frame. */
function place(step: ScreenStep, steps: ScreenStep[], sizes: Map<number, { width: number; height: number; basis: 'reported' | 'image' }>) {
  if (!step.point && !(step.gesture === 'drag' && step.from)) { step.unplaced = step.ref ? 'element-only' : 'no-position'; return; }
  const frame = step.frame;
  if (frame === undefined) { step.unplaced = 'no-frame'; return; }
  const shown = steps[frame] ?? step;
  // A step that returned its own image shows the result of the action; its position was aimed at an earlier frame.
  if (shown.gesture !== 'screenshot') { step.unplaced = 'result-frame'; return; }
  const size = sizes.get(frame);
  if (!size) { step.unplaced = 'frame-size-unknown'; return; }
  const image = shown.image;
  if (size.basis === 'reported' && image?.width && image.height && Math.abs(size.width / size.height - image.width / image.height) > 0.02) { step.unplaced = 'frame-size-differs'; return; }
  const at = step.point ?? step.from!;
  if (at[0] < 0 || at[1] < 0 || at[0] > size.width || at[1] > size.height) { step.unplaced = 'outside-frame'; return; }
  const marker: NonNullable<ScreenStep['marker']> = { x: at[0] / size.width, y: at[1] / size.height };
  if (step.gesture === 'drag' && step.from && step.point) {
    if (step.from[0] < 0 || step.from[1] < 0 || step.from[0] > size.width || step.from[1] > size.height) { step.unplaced = 'outside-frame'; return; }
    marker.fromX = step.from[0] / size.width; marker.fromY = step.from[1] / size.height;
  }
  step.marker = marker;
}
