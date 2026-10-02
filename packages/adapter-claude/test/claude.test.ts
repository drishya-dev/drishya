import { describe, expect, it } from 'vitest';
import { createParser, intentOf, outcomeOf } from '../src/index.ts';

const ctx = { recordingId: 'r', sourceId: 's', sourcePath: 'x.jsonl' };

describe('Claude Code adapter', () => {
  it('maps harness tools to neutral intents', () => {
    expect(intentOf('Read', { file_path: '/w/a.ts', offset: 10, limit: 5 })).toEqual({ kind: 'read', path: '/w/a.ts', offset: 10, limit: 5 });
    expect(intentOf('mcp__github__search_code', {})).toEqual({ kind: 'mcp', server: 'github', tool: 'search_code' });
    expect(intentOf('Bash', { command: 'ls' }).kind).toBe('shell');
    expect(intentOf('SomeFutureTool', {}).kind).toBe('other');
  });

  it('correlates a result with its call and strips harness line numbers when only text survives', () => {
    const p = createParser(ctx);
    p.parse({ type: 'assistant', uuid: 'u1', timestamp: 't', message: { content: [{ type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: '/w/a.ts' } }] } });
    const [res] = p.parse({ type: 'user', uuid: 'u2', timestamp: 't', message: { content: [{ type: 'tool_result', tool_use_id: 'c1', content: '    40\tconst a = 1;\n    41\tconst b = 2;' }] } });
    expect(res!.kind).toBe('tool.result');
    expect(res!.operationId).toBe('c1');
    const outcome = (res!.payload as { outcome: { content: string; startLine: number; harnessLineNumbers: boolean } }).outcome;
    expect(outcome.content).toBe('const a = 1;\nconst b = 2;');
    expect(outcome.startLine).toBe(40);
    expect(outcome.harnessLineNumbers).toBe(true);
  });

  it('marks results of protected-file reads for content omission', () => {
    const p = createParser(ctx);
    p.parse({ type: 'assistant', uuid: 'u1', message: { content: [{ type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: '/w/.env' } }] } });
    const [res] = p.parse({ type: 'user', uuid: 'u2', message: { content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'SECRET=1' }] } });
    expect(res!.denyContent).toBe(true);
  });

  it('turns an unknown record type into a visible unknown, never an exception', () => {
    const [o] = createParser(ctx).parse({ type: 'brand-new-record', uuid: 'u9' });
    expect(o!.kind).toBe('unknown');
    expect(o!.availability).toBe('metadata-only');
  });

  it('ignores bookkeeping records on purpose', () => {
    const p = createParser(ctx);
    for (const type of ['queue-operation', 'file-history-snapshot', 'bridge-session', 'attachment']) expect(p.parse({ type })).toEqual([]);
  });

  it('ties a subagent to its delegating call by the harness agent id', () => {
    const p = createParser(ctx);
    p.parse({ type: 'assistant', uuid: 'u1', message: { content: [{ type: 'tool_use', id: 'c1', name: 'Task', input: { subagent_type: 'Explore', description: 'look' } }] } });
    const out = p.parse({ type: 'user', uuid: 'u2', toolUseResult: { agentId: 'abc', content: [{ type: 'text', text: 'done' }] }, message: { content: [{ type: 'tool_result', tool_use_id: 'c1', content: [{ type: 'text', text: 'done' }] }] } });
    const spawn = out.find((o) => o.kind === 'agent.spawn');
    expect(spawn?.payload).toMatchObject({ childAgentId: 'agent:abc', agentType: 'Explore', basis: 'source-id' });
  });

  it('reads Edit results with the original file and structured patch', () => {
    const o = outcomeOf({ kind: 'edit', path: '/w/a.ts', edits: [] }, { filePath: '/w/a.ts', originalFile: 'a\nb', structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [' a', '-b', '+c'] }] }, undefined);
    expect(o).toMatchObject({ kind: 'edit', originalFile: 'a\nb', hunks: [{ oldStart: 1 }] });
  });
});
