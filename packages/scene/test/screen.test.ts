import { describe, it, expect } from 'vitest';
import type { Operation, OperationImage } from '@drishya/contracts';
import { screenRun, isScreenOperation, SCREEN_STEP_CAP } from '../src/screen.ts';

const base = { agentId: 'agent', titleProvenance: { kind: 'captured' as const, observationIds: [] }, classification: { kind: 'derived' as const, rule: 'test', observationIds: [] }, paths: [], observationIds: [], artifactIds: [], status: 'ok' as const };
const mcp = (n: number, input: unknown, opts: { images?: OperationImage[]; preview?: string; server?: string; tool?: string } = {}): Operation => ({
  ...base, id: `op-${n}`, kind: 'mcp', tool: opts.tool ?? 'computer', title: 'computer', startSequence: n, startTime: `2026-10-30T10:00:${String(n % 60).padStart(2, '0')}Z`,
  origin: { type: 'mcp', server: opts.server ?? 'Claude_Browser', tool: opts.tool ?? 'computer' }, images: opts.images,
  detail: { kind: 'mcp', server: opts.server ?? 'Claude_Browser', tool: opts.tool ?? 'computer', input, resultPreview: opts.preview },
});
const shot = (n: number, w = 1000, h = 500, preview = `Screenshot size: ${w}x${h}\n\nTab Context:\n- Executed on tabId: 7\n- Available tabs:\n  • tabId 7: "Docs" ("http://localhost:3000/")`) =>
  mcp(n, { action: 'screenshot', tabId: 7 }, { images: [{ sha: `sha${n}`, mime: 'image/jpeg', width: w, height: h }], preview });

describe('screen run', () => {
  it('recognises the computer tool of a browser server and Claude Code\'s own computer tool, nothing else', () => {
    expect(isScreenOperation(mcp(1, { action: 'screenshot' }))).toBe(true);
    expect(isScreenOperation(mcp(1, {}, { server: 'filesystem' }))).toBe(false);
    expect(isScreenOperation(mcp(1, {}, { tool: 'navigate' }))).toBe(false);
    expect(isScreenOperation({ ...base, id: 'n', kind: 'other', tool: 'computer', title: 'computer', startSequence: 1, origin: { type: 'native', tool: 'computer' }, detail: { kind: 'other', input: { action: 'key', text: 'Enter' } } })).toBe(true);
  });

  it('places a click at its recorded coordinate on the screenshot it was aimed at', () => {
    const run = screenRun([shot(1), mcp(2, { action: 'left_click', coordinate: [250, 125], tabId: 7 }), shot(3)]);
    const click = run.steps[1]!;
    expect(click.gesture).toBe('click');
    expect(click.frame).toBe(0);
    expect(click.marker).toEqual({ x: 0.25, y: 0.25 });
    expect(run.steps[2]!.frame).toBe(2);
    expect(run.frames).toBe(2);
  });

  it('scales by the reported coordinate frame when the stored image is a scaled copy of it', () => {
    const scaled = mcp(1, { action: 'screenshot', scale: 0.5 }, { images: [{ sha: 'a', width: 784, height: 441 }], preview: 'Screenshot size: 1568x882' });
    const run = screenRun([scaled, mcp(2, { action: 'left_click', coordinate: [1176, 441] })]);
    expect(run.steps[1]!.marker).toEqual({ x: 0.75, y: 0.5 });
  });

  it('falls back to the image size, and refuses when the reported frame disagrees with the stored image', () => {
    const noText = mcp(1, { action: 'screenshot' }, { images: [{ sha: 'a', width: 800, height: 400 }] });
    expect(screenRun([noText, mcp(2, { action: 'left_click', coordinate: [400, 200] })]).steps[1]!.marker).toEqual({ x: 0.5, y: 0.5 });
    const differs = mcp(1, { action: 'screenshot' }, { images: [{ sha: 'a', width: 800, height: 400 }], preview: 'Screenshot size: 800x800' });
    const step = screenRun([differs, mcp(2, { action: 'left_click', coordinate: [400, 200] })]).steps[1]!;
    expect(step.marker).toBeUndefined();
    expect(step.unplaced).toBe('frame-size-differs');
  });

  it('does not treat a requested-scale image as the coordinate frame when the harness reported none', () => {
    const scaled = mcp(1, { action: 'screenshot', scale: 0.5 }, { images: [{ sha: 'a', width: 400, height: 200 }] });
    const step = screenRun([scaled, mcp(2, { action: 'left_click', coordinate: [100, 50] })]).steps[1]!;
    expect(step.marker).toBeUndefined();
    expect(step.unplaced).toBe('frame-size-unknown');
  });

  it('aims a position at the latest screenshot of its own tab', () => {
    const other = mcp(3, { action: 'screenshot', tabId: 9 }, { images: [{ sha: 'b', width: 100, height: 100 }], preview: 'Screenshot size: 100x100' });
    const run = screenRun([shot(1), other, mcp(4, { action: 'left_click', coordinate: [100, 50], tabId: 7 }), mcp(5, { action: 'left_click', coordinate: [50, 50], tabId: 9 }), mcp(6, { action: 'wait', duration: 1, tabId: 7 })]);
    expect(run.steps[2]).toMatchObject({ frame: 0, marker: { x: 0.1, y: 0.1 } });
    expect(run.steps[3]).toMatchObject({ frame: 1, marker: { x: 0.5, y: 0.5 } });
    // Unpositioned steps show the newest frame whatever its tab.
    expect(run.steps[4]!.frame).toBe(1);
  });

  const batch = (n: number, actions: unknown[], opts: { images?: OperationImage[]; preview?: string } = {}) => mcp(n, { actions }, { ...opts, tool: 'browser_batch' });
  const act = (input: Record<string, unknown>) => ({ name: 'computer', input });

  it('reads the computer actions of a browser batch as steps and matches its images to its screenshot actions in order', () => {
    const run = screenRun([batch(1, [act({ action: 'screenshot', tabId: 7 }), { name: 'navigate', input: { url: 'http://localhost/' } }, act({ action: 'left_click', coordinate: [100, 50], tabId: 7 }), act({ action: 'zoom', region: [0, 0, 10, 10], tabId: 7 })],
      { images: [{ sha: 'a', width: 400, height: 200 }, { sha: 'z', width: 100, height: 100 }], preview: 'Screenshot size: 400x200' })]);
    expect(run.steps.map(s => s.gesture)).toEqual(['screenshot', 'click', 'zoom']);
    expect(run.steps.map(s => s.id)).toEqual(['op-1#0', 'op-1#1', 'op-1#2']);
    expect(run.steps.every(s => s.operationId === 'op-1')).toBe(true);
    expect(run.steps[0]!.image?.sha).toBe('a');
    expect(run.steps[2]!.image?.sha).toBe('z');
    expect(run.steps[1]).toMatchObject({ frame: 0, marker: { x: 0.25, y: 0.25 } });
    expect(run.frames).toBe(2);
  });

  it('does not match a batch\'s images to steps when the counts disagree, and says how many it holds back', () => {
    const run = screenRun([batch(1, [act({ action: 'screenshot' }), act({ action: 'screenshot' })], { images: [{ sha: 'a', width: 10, height: 10 }] })]);
    expect(run.steps.map(s => s.image)).toEqual([undefined, undefined]);
    expect(run.steps.every(s => s.unmatchedImages === 1)).toBe(true);
    expect(run.frames).toBe(0);
  });

  it('keeps direct calls and batches in captured order', () => {
    const run = screenRun([shot(1), batch(2, [act({ action: 'left_click', coordinate: [100, 50] })]), mcp(3, { action: 'key', text: 'Enter' })]);
    expect(run.steps.map(s => s.id)).toEqual(['op-1', 'op-2#0', 'op-3']);
    expect(run.steps[1]!.marker).toEqual({ x: 0.1, y: 0.1 });
  });

  it('never guesses a position', () => {
    const run = screenRun([
      shot(1),
      mcp(2, { action: 'left_click', ref: 'ref_3' }),
      mcp(3, { action: 'left_click' }),
      mcp(4, { action: 'left_click', coordinate: [5000, 10] }),
      mcp(5, { action: 'zoom', region: [0, 0, 100, 50] }, { images: [{ sha: 'z', width: 400, height: 200 }] }),
      mcp(6, { action: 'left_click', coordinate: [1, 1] }, { images: [{ sha: 'r', width: 1000, height: 500 }] }),
    ]);
    expect(run.steps.map(s => s.unplaced)).toEqual([undefined, 'element-only', 'no-position', 'outside-frame', undefined, 'result-frame']);
    expect(run.steps.every(s => !s.marker)).toBe(true);
    expect(screenRun([mcp(1, { action: 'left_click', coordinate: [1, 1] })]).steps[0]!.unplaced).toBe('no-frame');
    // After a zoom, a position still refers to the last full screenshot, not to the cropped image.
    expect(screenRun([shot(1), mcp(2, { action: 'zoom', region: [0, 0, 100, 50] }, { images: [{ sha: 'z', width: 400, height: 200 }] }), mcp(3, { action: 'hover', coordinate: [100, 50] })]).steps[2]).toMatchObject({ frame: 0, marker: { x: 0.1, y: 0.1 } });
  });

  it('draws a drag from its recorded start to its recorded end, and keeps typed text, keys, scroll and waits as recorded', () => {
    const run = screenRun([shot(1), mcp(2, { action: 'left_click_drag', start_coordinate: [100, 50], coordinate: [900, 450] }), mcp(3, { action: 'type', text: 'hello' }), mcp(4, { action: 'key', text: 'ctrl+a' }),
      mcp(5, { action: 'scroll', coordinate: [500, 250], scroll_direction: 'down', scroll_amount: 3 }), mcp(6, { action: 'wait', duration: 2 })]);
    expect(run.steps[1]!.marker).toEqual({ x: 0.9, y: 0.9, fromX: 0.1, fromY: 0.1 });
    expect(run.steps[2]).toMatchObject({ gesture: 'type', text: 'hello' });
    expect(run.steps[3]).toMatchObject({ gesture: 'key', text: 'ctrl+a' });
    expect(run.steps[4]).toMatchObject({ gesture: 'scroll', scroll: { direction: 'down', amount: 3 }, marker: { x: 0.5, y: 0.5 } });
    expect(run.steps[5]).toMatchObject({ gesture: 'wait', waitSeconds: 2, frame: 0 });
  });

  it('carries the last frame when a step returns none, and keeps an omitted image as a frame', () => {
    const omitted = mcp(1, { action: 'screenshot' }, { images: [{ omitted: 'too-large', bytes: 9_000_000, width: 1000, height: 500 }] });
    const run = screenRun([omitted, mcp(2, { action: 'wait', duration: 1 })]);
    expect(run.steps[0]!.image?.omitted).toBe('too-large');
    expect(run.steps[1]!.frame).toBe(0);
    expect(screenRun([mcp(1, { action: 'wait', duration: 1 })]).steps[0]!.frame).toBeUndefined();
    const failed = screenRun([shot(1), { ...mcp(2, { action: 'screenshot' }, { preview: 'screenshot failed: timed out' }), status: 'error' }]);
    expect(failed.steps[1]).toMatchObject({ image: undefined, frame: 0, status: 'error' });
  });

  it('reads the tab title and address the result recorded', () => {
    expect(screenRun([shot(1)]).steps[0]!.context).toEqual({ title: 'Docs', url: 'http://localhost:3000/' });
    expect(screenRun([mcp(1, { action: 'wait', duration: 1 }, { preview: 'waited 1s' })]).steps[0]!.context).toBeUndefined();
  });

  it('orders by captured sequence and keeps only the newest steps past the cap, with frame links remapped', () => {
    const ops = [shot(0)];
    for (let n = 1; n <= SCREEN_STEP_CAP + 4; n++) ops.push(n % 2 ? mcp(n, { action: 'left_click', coordinate: [10, 10] }) : shot(n));
    const run = screenRun([...ops].reverse());
    expect(run.total).toBe(SCREEN_STEP_CAP + 5);
    expect(run.truncated).toBe(true);
    expect(run.steps).toHaveLength(SCREEN_STEP_CAP);
    expect(run.steps[0]!.sequence).toBe(5);
    expect(run.steps[0]!.frame).toBeUndefined();
    expect(run.steps[1]!.frame).toBe(1);
    expect(run.steps.every(s => s.frame === undefined || run.steps[s.frame]!.image)).toBe(true);
  });
});
