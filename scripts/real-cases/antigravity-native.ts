import type { RealCase } from './types.ts';
import { decodeArgs } from '../../packages/adapter-antigravity/src/tools.ts';

/** Native tool names/receipts only. No stdout keyword is treated as an approval or filesystem outcome. */
const toolsCase = (name: string, tools: string[]): RealCase => {
  const seen = new Set<number>();
  return {
    name, about: 'Antigravity recorded native inputs/results and explicit unavailable states', harnesses: ['antigravity'], prefilter: '',
    reset() { seen.clear(); },
    scan(row) {
      if (row.type !== 'PLANNER_RESPONSE' || typeof row.step_index !== 'number' || seen.has(row.step_index)) return;
      seen.add(row.step_index);
      const calls = (Array.isArray(row.tool_calls) ? row.tool_calls : []).filter(c => c && typeof c === 'object' && tools.includes(c.name));
      return calls.length ? {hits:calls.length} : undefined;
    },
    verify(projection, expected) {
      const ops = projection.operations.filter(op => tools.includes(op.tool));
      const missing = ops.filter(op => !op.observationIds.length);
      const unknownPermission = ops.filter(op => op.tool === 'ask_permission');
      const permissionGaps = projection.gaps.filter(gap => /approval or denial cannot be identified/.test(gap.detail ?? ''));
      return [ops.length === expected.hits ? `PASS ${ops.length} native operations` : `FAIL native operations ${ops.length}/${expected.hits}`,
        missing.length ? `FAIL ${missing.length} operations lack captured provenance` : 'PASS original recorded provenance retained',
        ...(unknownPermission.length ? [permissionGaps.length >= unknownPermission.length ? `PASS ${unknownPermission.length} permission requests remain explicitly unresolved` : 'FAIL unresolved permission gap missing'] : [])];
    },
  };
};
const fileCommandCandidate = (command: unknown) => typeof command === 'string' && /renameSync|unlinkSync|Move-Item|Remove-Item|\b(?:mv|rm)\b/i.test(command);
export const antigravityNativeCases: RealCase[] = [
  toolsCase('antigravity-browser',['webview_browser']),
  toolsCase('antigravity-mcp',['call_mcp_tool']),
  toolsCase('antigravity-questions',['ask_question']),
  toolsCase('antigravity-permission',['ask_permission']),
  toolsCase('antigravity-lifecycle',['manage_task','invoke_subagent','swarm','read_board','post_message']),
  {
    name:'antigravity-file-commands',about:'Captured move/delete command requests remain shell evidence, never inferred applied file diffs',harnesses:['antigravity'],prefilter:'',
    scan(row) {const calls=(Array.isArray(row.tool_calls)?row.tool_calls:[]).filter(c=>c?.name==='run_command'&&fileCommandCandidate(decodeArgs(c.args).CommandLine));return calls.length?{hits:calls.length}:undefined;},
    verify(projection,expected) {const commands=projection.operations.filter(o=>(o.detail.kind==='shell'||o.detail.kind==='test')&&fileCommandCandidate(o.detail.command));return [commands.length>=expected.hits?`PASS ${commands.length} recorded file-command candidates; applied changes not inferred`:`FAIL file-command candidates ${commands.length}/${expected.hits}`];},
  },
  {
    name:'antigravity-pdf',about:'Recorded PDF references remain visible; no PDF bytes are imported as images',harnesses:['antigravity'],prefilter:'',
    scan(row) { const refs=(Array.isArray(row.media)?row.media:[]).filter(m=>m&&m.mime_type==='application/pdf'&&typeof m.uri==='string');return refs.length?{hits:refs.length}:undefined; },
    verify(projection,expected) {const gaps=projection.gaps.filter(g=>g.detail?.includes('application/pdf:'));return [gaps.length?'PASS recorded PDF references are visible; bytes were not read':'FAIL recorded PDF reference is not visible',`${expected.hits} recorded PDF references; ${gaps.length} attachment notices`];},
  },
  {
    name:'antigravity-review-artifact',about:'Explicit same-conversation Markdown review artifacts remain documents rather than repository writes',harnesses:['antigravity'],prefilter:'',
    scan(row) {const calls=(Array.isArray(row.tool_calls)?row.tool_calls:[]).filter(c=>{const a=decodeArgs(c?.args);return a.ArtifactMetadata&&typeof a.Path==='string'&&/[\\/]brain[\\/][^\\/]+[\\/][A-Za-z0-9_-][A-Za-z0-9_.-]*\.md$/.test(a.Path);});return calls.length?{hits:calls.length}:undefined;},
    verify(projection,expected) {const plans=projection.operations.filter(o=>o.detail.kind==='plan'&&o.detail.document?.source==='native-call');return [plans.length>=expected.hits?`PASS ${plans.length} recorded artifact documents`:`FAIL artifact documents ${plans.length}/${expected.hits}`,plans.some(o=>o.paths.length)?'FAIL artifact entered repository paths':'PASS artifacts do not imply repository changes or a review decision'];},
  },
];
