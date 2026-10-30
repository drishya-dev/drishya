import type { RealCase } from './types.ts';
import { intentOf } from '../../packages/adapter-codex/src/index.ts';
import { classifyShell } from '../../packages/projection/src/shell.ts';

/** Native file/shell calls are candidates; only imported file references prove the case. */
export const workspaceFiles: RealCase = {
  name: 'workspace-files',
  about: 'Recorded file references for Files and Workspace reading',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': 'tool_use', codex: 'response_item' },
  scan(row, harness) {
    if (harness === 'claude-code') {
      const content = (row.message as { content?: unknown } | undefined)?.content;
      if (!Array.isArray(content)) return;
      const hits = content.filter(block => block?.type === 'tool_use' &&
        ['Read', 'Edit', 'Write'].includes(block.name) && typeof block.input?.file_path === 'string').length;
      return hits ? { hits } : undefined;
    }
    const payload = row.payload as Record<string, unknown> | undefined;
    if (row.type !== 'response_item' || !payload) return;
    if (!['function_call', 'custom_tool_call'].includes(String(payload.type))) return;
    let args: Record<string, unknown>;
    try { args = payload.type === 'custom_tool_call' ? { raw: payload.input } : JSON.parse(String(payload.arguments)); }
    catch { return; }
    if (!args || typeof args !== 'object' || Array.isArray(args)) return;
    const intent = intentOf(String(payload.name), args);
    if (intent.kind === 'patch' && /^\*\*\* (?:Add|Update|Delete) File: /m.test(intent.patch)) return { hits: 1 };
    return intent.kind === 'read' && intent.path || intent.kind === 'shell' && classifyShell(intent.command).kind === 'read'
      ? { hits: 1 } : undefined;
  },
  verify(projection, found) {
    return [`${projection.files.length ? '' : 'FAIL '}${found.hits} native file/shell calls; ${projection.files.length} captured file references; current availability requires separate approved reading`];
  },
};
