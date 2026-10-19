import { describe, expect, it } from 'vitest';
import type { NowFacts, OpenOperation } from '../../../packages/scene/src/now.ts';
import { describeOpen, elapsed, nowView, STALE_MS, WORKING_WINDOW_MS } from '../src/lib/now-state.ts';

const NOW = Date.parse('2026-10-19T10:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ctx = { nowMs: NOW, harness: 'Codex', workspace: 'drishya' };
const open = (patch: Partial<OpenOperation> = {}): OpenOperation => ({ id: 'op', agentId: 'agent:main', agentLabel: 'main', kind: 'shell', tool: 'exec', title: 'Run', since: ago(42_000), sequence: 9, asking: false, command: 'pnpm test', ...patch });
const facts = (patch: Partial<NowFacts> = {}): NowFacts => ({ open: [], openCount: 0, turn: { operations: 0 }, agents: 1, ...patch });

describe('elapsed', () => {
  it('reads naturally across seconds, minutes and hours', () => {
    expect(elapsed(0)).toBe('0 s'); expect(elapsed(42_000)).toBe('42 s'); expect(elapsed(185_000)).toBe('3 m 05 s'); expect(elapsed(3_900_000)).toBe('1 h 05 m'); expect(elapsed(-5)).toBe('0 s');
  });
});

describe('describeOpen', () => {
  it('names what each kind of open call is doing', () => {
    expect(describeOpen(open())).toBe('running pnpm test');
    expect(describeOpen(open({ kind: 'read', path: 'src\\store\\index.ts' }))).toBe('reading index.ts');
    expect(describeOpen(open({ kind: 'edit', path: 'apps/ui/src/App.tsx' }))).toBe('editing App.tsx');
    expect(describeOpen(open({ kind: 'search', query: 'amount' }))).toBe('searching amount');
    expect(describeOpen(open({ kind: 'mcp', tool: 'github.search' }))).toBe('calling github.search');
    expect(describeOpen(open({ kind: 'spawn' }))).toBe('delegating to an agent');
    expect(describeOpen(open({ asking: true }))).toBe('waiting for your answer');
  });
  it('shortens a long command to one readable line', () => {
    const text = describeOpen(open({ command: `pnpm run build && ${'x'.repeat(200)}\nsecond line` }));
    expect(text.length).toBeLessThanOrEqual(52); expect(text).not.toContain('second line');
  });
});

describe('nowView', () => {
  it('says nothing when the recording is not live or facts are missing', () => {
    expect(nowView(undefined, true, ctx)).toBeUndefined();
    expect(nowView(facts({ open: [open()], openCount: 1 }), false, ctx)).toBeUndefined();
  });

  it('names the open call, its elapsed time and any others', () => {
    const view = nowView(facts({ open: [open(), open({ id: 'b' })], openCount: 3 }), true, ctx)!;
    expect(view).toMatchObject({ tone: 'running', mark: 'running', tab: '● Running · drishya' });
    expect(view.text).toBe('Codex · running pnpm test · 42 s +2');
    expect(view.basis).toContain('no result yet');
  });

  it('puts the turn so far in the basis, never in the short line', () => {
    const view = nowView(facts({ open: [open()], openCount: 1, turn: { operations: 7 } }), true, ctx)!;
    expect(view.basis).toContain('This turn so far: 7 operations.'); expect(view.text).not.toContain('7');
    expect(nowView(facts({ open: [open()], openCount: 1, turn: { operations: 1 } }), true, ctx)!.basis).toContain('1 operation.');
    expect(nowView(facts({ open: [open()], openCount: 1 }), true, ctx)!.basis).not.toContain('This turn');
  });

  it('uses the sub-agent label only when several agents exist', () => {
    const one = nowView(facts({ open: [open({ agentLabel: 'helper' })], openCount: 1, agents: 1 }), true, ctx)!;
    const many = nowView(facts({ open: [open({ agentLabel: 'helper' })], openCount: 1, agents: 3 }), true, ctx)!;
    expect(one.text.startsWith('Codex ·')).toBe(true); expect(many.text.startsWith('helper ·')).toBe(true);
  });

  it('puts a question to the person first, even when other calls are open', () => {
    const view = nowView(facts({ open: [open({ id: 'run' }), open({ id: 'ask', asking: true })], openCount: 2 }), true, ctx)!;
    expect(view).toMatchObject({ tone: 'asking', mark: 'asking', tab: '? Needs you · drishya' });
    expect(view.text).toContain('waiting for your answer');
  });

  it('is working only shortly after a non-final event, then quiet, and never claims more', () => {
    const recent = nowView(facts({ last: { sequence: 1, time: ago(4_000), what: 'tool-result' } }), true, ctx)!;
    expect(recent).toMatchObject({ tone: 'working', text: 'Codex · working', tab: '◐ Working · drishya' });
    const stale = nowView(facts({ last: { sequence: 1, time: ago(WORKING_WINDOW_MS + 1_000), what: 'tool-result' } }), true, ctx)!;
    expect(stale.tone).toBe('quiet'); expect(stale.text).toBe('Codex · no activity for 21 s'); expect(stale.tab).toBeUndefined();
  });

  it('reports a reply as a reply, with no activity mark', () => {
    const view = nowView(facts({ last: { sequence: 1, time: ago(125_000), what: 'reply' } }), true, ctx)!;
    expect(view).toMatchObject({ tone: 'replied', text: 'Codex · replied 2 m 05 s ago' });
    expect(view.mark).toBeUndefined(); expect(view.tab).toBeUndefined();
  });

  it('stays honest when no timed event exists or the time is unreadable', () => {
    expect(nowView(facts(), true, ctx)).toMatchObject({ tone: 'quiet', text: 'Codex · live' });
    expect(nowView(facts({ last: { sequence: 1, time: 'not a date', what: 'tool-result' } }), true, ctx)!.text).toBe('Codex · live');
  });

  it('shows nothing for a session whose newest event is hours old, even with a call left open', () => {
    expect(nowView(facts({ last: { sequence: 1, time: ago(STALE_MS + 1_000), what: 'reply' } }), true, ctx)).toBeUndefined();
    expect(nowView(facts({ open: [open({ since: ago(STALE_MS + 5_000) })], openCount: 1, last: { sequence: 1, time: ago(STALE_MS + 1_000), what: 'tool-call' } }), true, ctx)).toBeUndefined();
    expect(nowView(facts({ open: [open({ since: ago(STALE_MS - 5_000) })], openCount: 1 }), true, ctx)?.tone).toBe('running');
  });

  it('omits the workspace from the tab title when unknown', () => {
    expect(nowView(facts({ open: [open()], openCount: 1 }), true, { ...ctx, workspace: undefined })!.tab).toBe('● Running');
  });
});
