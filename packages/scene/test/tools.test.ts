import { describe, it, expect } from 'vitest';
import type { AvailableTool, Operation, Projection } from '@drishya/contracts';
import { toolInventory, toolTrail } from '../src/tools.ts';

const base = { agentId: 'agent', titleProvenance: { kind: 'captured' as const, observationIds: [] }, classification: { kind: 'derived' as const, rule: 'test', observationIds: [] }, paths: [], observationIds: [], artifactIds: [], status: 'ok' as const };
const op = (n: number, tool: string, server?: string, kind: Operation['kind'] = 'other'): Operation => ({
  ...base, id: `op-${n}`, kind, tool, title: tool, startSequence: n,
  origin: server ? { type: 'mcp', server, tool: tool.split('__').at(-1)! } : { type: 'native', tool },
  detail: { kind: 'other', input: {} },
});
const projection = (operations: Operation[], availableTools?: AvailableTool[]): Projection => ({ operations, availableTools } as unknown as Projection);
const listed = (name: string, extra: Partial<AvailableTool> = {}): AvailableTool => ({ name, since: 0, ...extra });

describe('tool inventory', () => {
  it('lists every available tool, used or not, and adds tools that were used but never listed', () => {
    const inventory = toolInventory(projection(
      [op(1, 'Read', undefined, 'read'), op(2, 'Read', undefined, 'read'), op(3, 'mcp__github__search_code', 'github'), op(4, 'MysteryTool')],
      [listed('Read'), listed('Bash'), listed('mcp__github__search_code', { server: 'github' }), listed('mcp__github__create_issue', { server: 'github' })],
    ));
    expect(inventory.recorded).toBe(true);
    const row = (name: string) => inventory.tools.find(t => t.name === name)!;
    expect(row('Read')).toMatchObject({ uses: 2, listed: true, filterTool: 'Read', kind: 'read' });
    expect(row('Bash')).toMatchObject({ uses: 0, listed: true });
    expect(row('Bash').filterTool).toBeUndefined();
    expect(row('mcp__github__create_issue')).toMatchObject({ uses: 0, listed: true, server: 'github' });
    expect(row('mcp__github__search_code')).toMatchObject({ uses: 1, listed: true });
    expect(row('MysteryTool')).toMatchObject({ uses: 1, listed: false });
    // Native tools come before MCP servers; within a group the most used first.
    expect(inventory.tools.map(t => t.name)).toEqual(['Read', 'MysteryTool', 'Bash', 'mcp__github__search_code', 'mcp__github__create_issue']);
  });

  it('recognises a Codex group tool by its bare or group-qualified name, and says when no list was recorded', () => {
    const inventory = toolInventory(projection([op(1, 'exec_command'), op(2, 'functions.apply_patch')], [listed('exec_command', { namespace: 'functions' }), listed('apply_patch', { namespace: 'functions' })]));
    expect(inventory.tools.map(t => [t.name, t.uses])).toEqual([['apply_patch', 1], ['exec_command', 1]]);
    const none = toolInventory(projection([op(1, 'Read')]));
    expect(none.recorded).toBe(false);
    expect(none.tools).toMatchObject([{ name: 'Read', uses: 1, listed: false }]);
  });

  it('does not list a tool the harness withdrew', () => {
    expect(toolInventory(projection([], [listed('Bash', { until: 3 }), listed('Read')])).tools.map(t => t.name)).toEqual(['Read']);
  });
});

describe('tool trail', () => {
  const ops = [op(1, 'Read'), op(2, 'Bash'), op(3, 'Read'), op(5, 'Read'), op(6, 'Bash')];
  const p = projection(ops);

  it('counts every use and finds the previous and next from an operation that is a use', () => {
    const trail = toolTrail(p, { tool: 'Read' }, { id: 'op-3' });
    expect(trail).toMatchObject({ total: 3, index: 2, before: 1, previous: { id: 'op-1' }, next: { id: 'op-5' }, first: { id: 'op-1' }, last: { id: 'op-5' } });
  });

  it('places the reader between uses when the current operation is another tool, and by captured position', () => {
    const between = toolTrail(p, { tool: 'Read' }, { id: 'op-2' });
    expect(between).toMatchObject({ total: 3, before: 1, previous: { id: 'op-1' }, next: { id: 'op-3' } });
    expect(between.index).toBeUndefined();
    expect(toolTrail(p, { tool: 'Read' }, { at: 4 })).toMatchObject({ before: 2, previous: { id: 'op-3' }, next: { id: 'op-5' } });
  });

  it('has no previous before the first use, no next after the last, and starts at the first when the position is unknown', () => {
    const first = toolTrail(p, { tool: 'Read' }, { id: 'op-1' }), last = toolTrail(p, { tool: 'Read' }, { id: 'op-5' }), unknown = toolTrail(p, { tool: 'Read' });
    expect(first).toMatchObject({ index: 1, next: { id: 'op-3' } });
    expect(first.previous).toBeUndefined();
    expect(last).toMatchObject({ index: 3, previous: { id: 'op-3' } });
    expect(last.next).toBeUndefined();
    expect(unknown).toMatchObject({ before: 0, next: { id: 'op-1' } });
    expect(unknown.previous).toBeUndefined();
    expect(toolTrail(p, { tool: 'Nothing' })).toEqual({ total: 0, before: 0 });
  });

  it('follows a server and a kind the same way', () => {
    const mixed = projection([op(1, 'mcp__a__x', 'a'), op(2, 'mcp__b__y', 'b'), op(3, 'mcp__a__z', 'a')]);
    expect(toolTrail(mixed, { server: 'a' }, { id: 'op-1' })).toMatchObject({ total: 2, next: { id: 'op-3' } });
  });
});
