import type { RealCase } from './types.ts';
import { decodeArgs } from '../../packages/adapter-antigravity/src/tools.ts';

export const antigravityLive: RealCase = {
  name: 'antigravity-live', about: 'Antigravity background task identity, output references and explicit child spawns (live cadence measured separately)',
  harnesses: ['antigravity'], prefilter: '',
  scan(row) {
    const tools = Array.isArray(row.tool_calls) ? row.tool_calls as { name?: string; args?: unknown }[] : [];
    const hits = tools.filter(call => ['run_command', 'manage_task', 'invoke_subagent'].includes(call.name ?? '')).length;
    return hits ? { hits, only: tools.filter(call => call.name === 'manage_task' && typeof decodeArgs(call.args).TaskId === 'string').length } : undefined;
  },
  verify(projection) {
    const background = projection.operations.filter(op => !!op.run?.backgroundTaskId);
    const spawned = projection.operations.filter(op => op.detail.kind === 'spawn' && !!op.detail.childAgentId);
    const updates = projection.links.filter(link => link.ruleVersion === 'antigravity-native-task-id-v1');
    const bad = updates.filter(link => !projection.operations.some(op => op.observationIds.includes(link.from) && !!op.run?.backgroundTaskId));
    return [`${background.length} background commands; ${spawned.length} explicit child references; ${updates.length} exact task result links`,
      bad.length ? `FAIL ${bad.length} task links lack an identified command` : 'PASS background result links use recorded task identity; no timing join'];
  },
};
