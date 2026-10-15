import { describe, expect, it } from 'vitest';
import { toggleWorkFocus } from '../src/modern/work-focus';

describe('Modern work focus', () => {
  it('distinguishes action kinds sharing exec and toggles without losing agent focus', () => {
    let focus = toggleWorkFocus(undefined, { kind: 'edit' });
    focus = toggleWorkFocus(focus, { agentId: 'child' });
    expect(focus).toEqual({ kind: 'edit', agentId: 'child' });
    focus = toggleWorkFocus(focus, { kind: 'shell' });
    expect(focus).toEqual({ kind: 'shell', agentId: 'child' });
    expect(toggleWorkFocus(focus, { kind: 'shell' })).toEqual({ agentId: 'child' });
  });
  it('keeps identically named MCP tools scoped to their server', () => {
    const focus = toggleWorkFocus({ tool: 'search', server: 'docs' }, { tool: 'search', server: 'issues' });
    expect(focus).toEqual({ tool: 'search', server: 'issues' });
    expect(toggleWorkFocus(focus, { tool: 'search', server: 'issues' })).toBeUndefined();
  });
});
