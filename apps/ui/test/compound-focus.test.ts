import { describe, expect, it } from 'vitest';
import { focusAgent, focusKind, focusMcp } from '../src/lib/compound-focus.ts';

describe('independent agent and action focus', () => {
  it('keeps tool focus when switching or clearing an agent', () => {
    const tool = { server: 'docs', tool: 'find' };
    expect(focusAgent(tool, 'worker')).toEqual({ ...tool, agentId: 'worker' });
    expect(focusAgent({ ...tool, agentId: 'worker' }, 'worker')).toEqual(tool);
    expect(focusAgent({ kind: 'read', agentId: 'worker' })).toEqual({ kind: 'read' });
    expect(focusAgent({ agentId: 'worker' }, 'worker')).toBeUndefined();
  });
  it('changes the action dimension without losing the selected agent', () => {
    expect(focusKind({ agentId: 'worker', server: 'docs', tool: 'find' }, 'read')).toEqual({ agentId: 'worker', kind: 'read' });
    expect(focusKind({ agentId: 'worker', kind: 'read' }, 'read')).toEqual({ agentId: 'worker' });
    expect(focusMcp({ agentId: 'worker', kind: 'read' }, 'docs', 'find')).toEqual({ agentId: 'worker', server: 'docs', tool: 'find' });
    expect(focusMcp({ agentId: 'worker', server: 'docs', tool: 'find' }, 'docs', 'find')).toEqual({ agentId: 'worker' });
    expect(focusMcp({ agentId: 'worker', server: 'docs', tool: 'find' }, 'docs')).toEqual({ agentId: 'worker', server: 'docs' });
  });
});
