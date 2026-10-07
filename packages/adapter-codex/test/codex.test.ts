import { describe, expect, it } from 'vitest';
import { createParser, intentOf, parseShellOutput } from '../src/index.ts';

const ctx = { recordingId: 'r', sourceId: 's', sourcePath: 'x.jsonl' };

describe('Codex adapter', () => {
  it('captures the actual model on same-workspace turn changes without confusing it with the provider', () => {
    const parser = createParser(ctx);
    const [meta] = parser.parse({ type: 'session_meta', payload: { cwd: '/repo', model_provider: 'openai' } });
    expect(meta!.payload).not.toHaveProperty('model');
    const turn = { type: 'turn_context', payload: { cwd: '/repo', model: 'captured-model-a' } };
    const [first] = parser.parse(turn);
    expect(first!.payload).toMatchObject({ model: 'captured-model-a', cwd: '/repo' });
    expect(parser.parse(turn)).toEqual([]);
    expect(parser.parse({ ...turn, payload: { ...turn.payload, model: 'captured-model-b' } })[0]!.payload).toMatchObject({ model: 'captured-model-b' });
  });
  it('parses both shell output encodings', () => {
    expect(parseShellOutput('Exit code: 1\nWall time: 0.5 seconds\nOutput:\nboom\n')).toEqual({ text: 'boom\n', exitCode: 1, durationMs: 500 });
    expect(parseShellOutput(JSON.stringify({ output: 'ok', metadata: { exit_code: 0, duration_seconds: 1.2 } }))).toEqual({ text: 'ok', exitCode: 0, durationMs: 1200 });
  });

  it('unwraps shell argv arrays', () => {
    expect(intentOf('shell', { command: ['bash', '-lc', 'npm test'] })).toMatchObject({ kind: 'shell', command: 'npm test' });
    for (const name of ['exec_command', 'functions.exec_command']) expect(intentOf(name, { cmd: 'echo captured' })).toEqual({ kind: 'shell', command: 'echo captured', cwd: undefined });
  });

  it('never surfaces encrypted reasoning, only summaries', () => {
    const p = createParser(ctx);
    expect(p.parse({ type: 'response_item', payload: { type: 'reasoning', summary: [], encrypted_content: 'gAAAA' } })).toEqual([]);
    const [o] = p.parse({ type: 'response_item', payload: { type: 'reasoning', summary: [{ type: 'summary_text', text: 'Plan' }], encrypted_content: 'gAAAA' } });
    expect(o!.payload).toEqual({ text: 'Plan', exposure: 'summary' });
    expect(JSON.stringify(o)).not.toContain('gAAAA');
  });

  it('drops injected context and developer messages, keeps what the person typed', () => {
    const p = createParser(ctx);
    expect(p.parse({ type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'rules' }] } })).toEqual([]);
    expect(p.parse({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>x</environment_context>' }] } })).toEqual([]);
    expect(p.parse({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'fix it' }] } })[0]!.kind).toBe('message.user');
  });

  it('correlates outputs with calls and flags non-zero exits as errors', () => {
    const p = createParser(ctx);
    p.parse({ type: 'response_item', payload: { type: 'function_call', name: 'shell_command', arguments: '{"command":"npm test"}', call_id: 'c1' } });
    const [o] = p.parse({ type: 'response_item', payload: { type: 'function_call_output', call_id: 'c1', output: 'Exit code: 1\nWall time: 1 seconds\nOutput:\nfail' } });
    expect(o!.payload).toMatchObject({ tool: 'shell_command', isError: true, exitCode: 1 });
  });

  it('keeps unknown record kinds visible', () => {
    expect(createParser(ctx).parse({ type: 'response_item', payload: { type: 'hologram' } })[0]!.kind).toBe('unknown');
  });
});
