import type {RealCase} from './types.ts';

// The Codex scanner finds candidates while a command reports a running process;
// actual acceptance also checks the genuine steer RPC/source ordering. It does
// not infer delivery or associate a queue item with a prompt by matching text.
let running = false;
export const midTurnInput: RealCase = {
  name: 'mid-turn-input',
  about: 'Claude queue receipts and Codex input recorded while a command reports running',
  harnesses: ['claude-code', 'codex'],
  prefilter: '"type":',
  scan(row, harness) {
    if (harness === 'claude-code') return row.type === 'queue-operation' && row.operation === 'enqueue' ? {hits: 1} : undefined;
    const payload = row.payload as Record<string, unknown> | undefined;
    if (row.type === 'session_meta') {running = false; return;}
    if (row.type === 'event_msg' && ['task_complete','turn_aborted'].includes(String(payload?.type))) {running = false; return;}
    if (row.type !== 'response_item' || !payload) return;
    if (['custom_tool_call_output','function_call_output'].includes(String(payload.type))) {
      const output = typeof payload.output === 'string' ? payload.output : '';
      if (/Process running with session ID|Script running with cell ID|"session_id"\s*:\s*\d+/.test(output)) running = true;
      else if (/Process exited with code/.test(output)) running = false;
    }
    if (running && payload.type === 'message' && payload.role === 'user') return {hits: 1};
  },
  verify(projection, found) {
    const receipts = projection.timeline.filter(item => item.type === 'queue' && item.operation === 'enqueue');
    const turns = projection.timeline.filter(item => item.type === 'turn');
    return projection.harnesses.includes('claude-code')
      ? [`${receipts.length === found.hits ? 'PASS' : 'FAIL'} ${found.hits} native enqueue receipts / ${receipts.length} projected; ${turns.length} distinct delivered turns remain separate`]
      : [`${turns.length >= found.hits ? 'PASS' : 'FAIL'} ${found.hits} running-command input candidates; ${turns.length} presented prompts; source/RPC ordering requires separate genuine acceptance`];
  },
};
