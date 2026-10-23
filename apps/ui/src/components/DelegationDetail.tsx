import type { Operation } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { delegationFacts, delegationLine, delegationReply, type SpawnDetail } from '../lib/delegation.ts';
import { ToolOutput } from './ToolOutput.tsx';
import './delegation-detail.css';

const useChild = (d: SpawnDetail) => useApp(state => d.childAgentId ? state.projection?.agents.find(agent => agent.id === d.childAgentId) : undefined);

/** CONTENT-5: who ran the delegation, quietly, on the collapsed card. */
export function DelegationLine({ d }: { d: SpawnDetail }) {
  const line = delegationLine(d, useChild(d));
  return line ? <div className="delegation-line">{line}</div> : null;
}

/**
 * The delegation as one reading: the agent and its recorded model, the task it was given, and what came back.
 * Every fact is the harness's; nothing is joined by timing. A child's own actions live in its own session
 * for harnesses that journal sub-agents separately, and the card says so instead of implying they are missing.
 */
export function DelegationDetail({ op, d }: { op: Operation; d: SpawnDetail }) {
  const child = useChild(d);
  const own = useApp(state => child ? state.projection?.operations.filter(other => other.agentId === child.id).length ?? 0 : 0);
  const facts = delegationFacts(d, child);
  const reply = delegationReply(d);
  return <div className="op-expanded delegation-material" onClick={(e) => e.stopPropagation()}>
    {facts.length > 0 && <dl className="delegation-facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    <div className="material-context">Task given to the agent</div>
    <div className="delegation-task">{d.descriptionEncrypted ? 'Not recorded: Codex stored the task text encrypted.' : d.description ?? 'Not recorded.'}</div>
    <div className="material-context">Result returned to the parent</div>
    {reply.text ? <ToolOutput text={reply.text} />
      : <div className="muted small">{reply.acknowledgementOnly ? 'Codex recorded only an acknowledgement for this call, not the agent’s answer.' : op.status === 'running' ? 'Waiting for the result' : 'No result content captured'}</div>}
    {child && <div className="delegation-scope">{own > 0 ? `${own} action${own === 1 ? '' : 's'} by this agent in this recording.` : 'This agent’s own actions are not in this recording; harnesses that journal sub-agents separately keep them in the agent’s own session.'}</div>}
  </div>;
}
