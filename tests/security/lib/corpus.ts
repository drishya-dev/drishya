// SEC-3: hostile strings, and the journals that carry them through every harness's real ingest path.
//
// Everything here is synthetic. A payload that ran would set `window.__pwned`; one that tried to talk
// to the network points at 127.0.0.1:9 (the discard port), so even a failure of the defence stays on
// this machine.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const SINK = 'http://127.0.0.1:9';

export interface Payload {
  id: string;
  /** The hostile text. */
  text: string;
  /** True when the payload only makes sense as a link target (checked by scheme). */
  link?: string;
}

export const PAYLOADS: Payload[] = [
  { id: 'script-tag', text: '<script>window.__pwned="script"</script>' },
  { id: 'img-onerror', text: '<img src=x onerror="window.__pwned=\'img\'">' },
  { id: 'svg-onload', text: '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=\'svg\'"><script>window.__pwned="svg-script"</script></svg>' },
  { id: 'iframe-js', text: '<iframe src="javascript:window.top.__pwned=\'iframe\'"></iframe>' },
  { id: 'iframe-srcdoc', text: `<iframe srcdoc="<script>parent.__pwned='srcdoc'</script>"></iframe>` },
  { id: 'object-embed', text: `<object data="${SINK}/object"></object><embed src="${SINK}/embed">` },
  { id: 'md-javascript', text: '[run](javascript:window.__pwned="md-link")', link: 'javascript:' },
  { id: 'md-javascript-mixed-case', text: '[run](JaVaScRiPt:window.__pwned=1)', link: 'javascript:' },
  { id: 'md-javascript-tab', text: '[run](java\tscript:window.__pwned=1)', link: 'javascript:' },
  { id: 'md-javascript-entity', text: '[run](&#106;avascript:window.__pwned=1)', link: 'javascript:' },
  { id: 'md-file', text: '[win](file:///C:/Windows/win.ini) [etc](file:///etc/passwd)', link: 'file:' },
  { id: 'md-data', text: '[d](data:text/html,<script>window.__pwned=1</script>)', link: 'data:' },
  { id: 'md-vbscript', text: '[v](vbscript:msgbox(1))', link: 'vbscript:' },
  { id: 'md-image-remote', text: `![leak](${SINK}/md-image?secret=1)` },
  { id: 'html-anchor', text: '<a href="javascript:window.__pwned=\'a\'" target="_blank">open</a>' },
  { id: 'html-anchor-blank', text: `<a href="${SINK}/anchor" target="_blank">out</a>` },
  { id: 'html-style-import', text: `<style>@import url(${SINK}/css); body{display:none!important}</style>` },
  { id: 'html-link-stylesheet', text: `<link rel="stylesheet" href="${SINK}/link.css">` },
  { id: 'html-meta-refresh', text: `<meta http-equiv="refresh" content="0;url=${SINK}/refresh">` },
  { id: 'html-base', text: `<base href="${SINK}/">` },
  { id: 'html-form', text: `<form action="${SINK}/form" method="post"><input name="q" value="x"><button>go</button></form>` },
  { id: 'css-overlay', text: '<div style="position:fixed;inset:0;z-index:2147483647;background:#f00;color:#fff">PAY ME</div>' },
  { id: 'css-url', text: `<div style="background:url(${SINK}/css-url)">x</div>` },
  { id: 'ansi-clear-and-osc8', text: '\u001b[2J\u001b[1;1H\u001b[31mred\u001b[0m \u001b]8;;http://127.0.0.1:9/osc8\u0007link\u001b]8;;\u0007' },
  { id: 'bidi-override', text: 'src/\u202Etxt.exe\u202C and \u2066isolate\u2069 \u200Bzero\u200Dwidth' },
  { id: 'long-token', text: 'A'.repeat(200_000) },
  { id: 'lone-surrogate-and-nul', text: 'a\ud800b\u0000c\udfffd' },
  { id: 'template-injection', text: "{{constructor.constructor('window.__pwned=1')()}} ${window.__pwned=1} <%= 7*7 %>" },
  { id: 'prototype-keys', text: '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}}' },
];

/** Hostile file names that are valid on every system we run on. */
export const HOSTILE_FILE_NAMES = [
  'img-onerror-x-onerror=window.__pwned=1.ts',
  "quote'and\"double.ts",
  'a b  c.ts',
  '#hash%20pct.ts',
  'unicode-\u202Efdp.ts',
];

export interface Scenario {
  cwd: string;
  branch: string;
  /** The text of the person's prompt. */
  prompt: string;
  /** What the agent says. */
  reply: string;
  command: string;
  output: string;
  readPath: string;
  editPath: string;
  editOld: string;
  editNew: string;
  mcpServer: string;
  mcpTool: string;
}

/** Every payload, in one run of text. */
export const allPayloads = () => PAYLOADS.map((p) => `[${p.id}] ${p.text}`).join('\n');

export function hostileScenario(cwd: string): Scenario {
  const blob = allPayloads();
  return {
    cwd,
    branch: 'feat/' + PAYLOADS[1]!.text.replace(/\s/g, ''),
    prompt: 'PROMPT ' + blob,
    reply: 'REPLY ' + blob,
    command: 'echo ' + JSON.stringify(PAYLOADS[1]!.text) + ' # ' + blob.slice(0, 2000),
    output: 'OUTPUT ' + blob,
    readPath: `${cwd.replace(/\\/g, '/')}/src/${HOSTILE_FILE_NAMES[0]}`,
    editPath: `${cwd.replace(/\\/g, '/')}/src/${HOSTILE_FILE_NAMES[1]}`,
    editOld: 'OLD ' + blob.slice(0, 4000),
    editNew: 'NEW ' + blob,
    mcpServer: 'evil<img src=x onerror=window.__pwned=1>',
    mcpTool: 'tool"><script>window.__pwned=1</script>',
  };
}

type Writer = (file: string, scenario: Scenario) => void;

const jsonl = (file: string, records: unknown[]) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
};

const T0 = Date.parse('2026-09-21T10:00:00.000Z');
const at = (n: number) => new Date(T0 + n * 1000).toISOString();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const claudeWriter: Writer = (file, s) => {
  const base = (n: number, parent: number | null, type: 'user' | 'assistant', message: unknown) => ({
    cwd: s.cwd, sessionId: 'c0ffee00-5ec3-4000-8000-000000000003', version: '2.1.0', gitBranch: s.branch, userType: 'external', entrypoint: 'cli',
    isSidechain: false, parentUuid: parent === null ? null : uuid(parent), type, message, uuid: uuid(n), timestamp: at(n),
  });
  const tool = (n: number, id: string, name: string, input: unknown) => base(n, n - 1, 'assistant', { id: `msg_${n}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' });
  const result = (n: number, id: string, content: string) => base(n, n - 1, 'user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] });
  jsonl(file, [
    { type: 'custom-title', customTitle: 'Hostile ' + PAYLOADS[1]!.text, sessionId: 'c0ffee00-5ec3-4000-8000-000000000003' },
    base(1, null, 'user', { role: 'user', content: s.prompt }),
    base(2, 1, 'assistant', { id: 'msg_2', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text: s.reply }], stop_reason: null }),
    tool(3, 'toolu_sec_bash', 'Bash', { command: s.command, description: s.reply.slice(0, 200) }),
    result(4, 'toolu_sec_bash', s.output),
    tool(5, 'toolu_sec_read', 'Read', { file_path: s.readPath }),
    result(6, 'toolu_sec_read', s.output),
    tool(7, 'toolu_sec_edit', 'Edit', { file_path: s.editPath, old_string: s.editOld, new_string: s.editNew }),
    result(8, 'toolu_sec_edit', 'The file has been updated.\n' + s.output.slice(0, 5000)),
    tool(9, 'toolu_sec_mcp', `mcp__${s.mcpServer}__${s.mcpTool}`, { query: s.prompt.slice(0, 4000) }),
    result(10, 'toolu_sec_mcp', s.output),
    base(11, 10, 'assistant', { id: 'msg_11', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text: 'Done. ' + s.reply.slice(0, 3000) }], stop_reason: 'end_turn' }),
  ]);
};

const codexWriter: Writer = (file, s) => {
  const item = (n: number, payload: unknown) => ({ timestamp: at(n), type: 'response_item', payload });
  jsonl(file, [
    { timestamp: at(0), type: 'session_meta', payload: { id: '0199c0de-5ec3-7000-8000-000000000003', timestamp: at(0), cwd: s.cwd, originator: 'codex_cli_rs', cli_version: '0.50.0', model_provider: 'openai', git: { branch: s.branch, commit_hash: '5ab1e0000000000000000000000000000000c0de', repository_url: 'https://example.invalid/acme/shop.git' } } },
    { timestamp: at(0), type: 'turn_context', payload: { cwd: s.cwd, approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-5-codex', effort: 'medium', summary: 'auto' } },
    { timestamp: at(0), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-1', model_context_window: 272000 } },
    item(1, { type: 'message', role: 'user', content: [{ type: 'input_text', text: s.prompt }] }),
    item(2, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: s.reply }] }),
    item(3, { type: 'function_call', name: 'shell_command', arguments: JSON.stringify({ command: s.command, workdir: s.cwd }), call_id: 'call_sec_1' }),
    item(4, { type: 'function_call_output', call_id: 'call_sec_1', output: 'Exit code: 0\nWall time: 0.1 seconds\nOutput:\n' + s.output }),
    item(5, { type: 'function_call', name: 'shell_command', arguments: JSON.stringify({ command: `cat ${s.readPath}`, workdir: s.cwd }), call_id: 'call_sec_2' }),
    item(6, { type: 'function_call_output', call_id: 'call_sec_2', output: 'Exit code: 0\nWall time: 0.1 seconds\nOutput:\n' + s.output }),
    item(7, { type: 'custom_tool_call', status: 'completed', call_id: 'call_sec_3', name: 'apply_patch', input: `*** Begin Patch\n*** Update File: ${s.editPath}\n@@\n-${s.editOld}\n+${s.editNew}\n*** End Patch` }),
    item(8, { type: 'custom_tool_call_output', call_id: 'call_sec_3', output: JSON.stringify({ output: 'Success. Updated the following files:\nM ' + s.editPath + '\n' + s.output.slice(0, 5000), metadata: { exit_code: 0 } }) }),
    item(9, { type: 'function_call', name: `${s.mcpServer}__${s.mcpTool}`, arguments: JSON.stringify({ query: s.prompt.slice(0, 4000) }), call_id: 'call_sec_4' }),
    item(10, { type: 'function_call_output', call_id: 'call_sec_4', output: s.output }),
    { timestamp: at(11), type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-1' } },
  ]);
};

/**
 * One journal writer per harness adapter, keyed by the adapter id. `adapters.test.ts` fails when the
 * ingest package lists an adapter that has no entry here, so adding a harness means adding one line.
 */
export const JOURNAL_WRITERS: Record<string, { writer: Writer; file: string }> = {
  'claude-code': { writer: claudeWriter, file: 'claude/hostile.jsonl' },
  codex: { writer: codexWriter, file: 'codex/rollout-hostile.jsonl' },
};
