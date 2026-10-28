import { describe, expect, it } from 'vitest';
import type { Agent } from '@drishya/contracts';
import { delegationFacts, delegationLine, delegationReply, type SpawnDetail } from '../src/lib/delegation.ts';

const spawn = (more: Partial<SpawnDetail> = {}): SpawnDetail => ({ kind: 'spawn', ...more });
const agent = (more: Partial<Agent> = {}): Agent => ({ id: 'r.agent:worker', harness: 'codex', label: 'Worker', firstSequence: 1, lastSequence: 2, ...more });

describe('delegation card facts', () => {
  it('shows the sub-agent reply Claude Code returned', () => {
    expect(delegationReply(spawn({ resultPreview: 'Found three tests covering totals.' }))).toEqual({ text: 'Found three tests covering totals.' });
  });
  it('does not present Codex’s task acknowledgement as a reply', () => {
    expect(delegationReply(spawn({ resultPreview: '{"task_name":"review"}' }))).toEqual({ acknowledgementOnly: true });
    expect(delegationReply(spawn({resultPreview:'{"agent_id":"child-id","nickname":"Reviewer"}'}))).toEqual({acknowledgementOnly:true});
    expect(delegationReply(spawn({ resultPreview: '{"task_name":"review","answer":"yes"}' })).text).toContain('answer');
    expect(delegationReply(spawn({ resultPreview: '{"broken' })).text).toBe('{"broken');
    expect(delegationReply(spawn())).toEqual({});
  });
  it('lists only what was recorded', () => {
    expect(delegationFacts(spawn({ agentType: 'explorer' }), agent({ address: '/root/worker', model: 'gpt-5-codex', effort: 'high' }))).toEqual([
      { label: 'Agent', value: 'Worker (explorer)' }, { label: 'Address', value: '/root/worker' }, { label: 'Model', value: 'gpt-5-codex · high effort' },
    ]);
    expect(delegationFacts(spawn({ agentType: 'Explore' }), undefined)).toEqual([{ label: 'Agent', value: 'Explore' }]);
    expect(delegationFacts(spawn(), undefined)).toEqual([]);
  });
  it('gives one quiet line for the collapsed card, or none', () => {
    expect(delegationLine(spawn(), agent({ address: '/root/worker', model: 'gpt-5-codex', effort: 'high' }))).toBe('/root/worker · gpt-5-codex · high');
    expect(delegationLine(spawn({ agentType: 'Explore' }), agent({ label: 'Explore', model: 'claude-opus-5' }))).toBe('claude-opus-5');
    expect(delegationLine(spawn({ agentType: 'explorer' }), agent({ label: 'Worker' }))).toBe('Worker');
    expect(delegationLine(spawn(), undefined)).toBeUndefined();
  });
});
