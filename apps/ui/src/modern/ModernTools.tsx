import type { ReactNode } from 'react';
import type { WorkFocus } from './work-focus';
import type { HistoryPage, NativeState } from '../fresh/api';

export function ModernTools({ page, native, onFilter, onClear, filter, agents }: { page?: Pick<HistoryPage, 'scene' | 'projection'>; native?: Pick<NativeState, 'inventory' | 'tools'>; agents?: ReactNode; onFilter: (focus: WorkFocus) => void; onClear: () => void; filter?: WorkFocus }) {
  return <aside className="md-tools dock modern-toolbox" aria-label="Tools and agents" title="Counts are captured tool uses">
    <div className="md-dock-heading"><span>Toolbox</span><span className="md-dock-led" /></div>
    <div className="md-tool-list">{page?.scene.dock.native.map(tool => <button key={tool.key} data-fr-tool={tool.tools.join('\n')} className={`instrument k-${tool.kind}`} data-fr-kind={tool.kind} title={tool.tools.join(' · ')} aria-pressed={filter?.kind === tool.kind} onClick={() => onFilter({ kind: tool.kind })}>
      <i className={`md-tool-dot kind-${tool.kind}`} /><span>{tool.kind}</span><small>{tool.uses}</small>
    </button>)}</div>
    {filter && <button className="md-clear-filter" onClick={onClear}>Clear focus ×</button>}
    {page?.scene.dock.mcp.map(server => <details className="md-server" key={server.server}>
      <summary className="server-name" data-mcp-server={server.server}><i className="md-tool-dot kind-mcp" /><span>{server.server}</span><small>MCP</small></summary>
      <div>{server.tools.map(tool => <button key={tool.tool} data-fr-tool={tool.tool} data-mcp-server={server.server} data-mcp-tool={tool.tool} aria-pressed={filter?.tool === tool.tool && filter?.server === server.server} onClick={() => onFilter({ tool: tool.tool, server: server.server })}><span>{tool.tool}</span><small>{tool.uses}</small></button>)}</div>
    </details>)}
    <details className="md-server md-agents"><summary><i className="md-tool-dot kind-agent" /><span>Agents</span><small>{page?.projection.agents.length ?? '…'}</small></summary><div>{agents ?? page?.projection.agents.map(agent => <button className="md-agent" key={agent.id} aria-pressed={filter?.agentId === agent.id} onClick={() => onFilter({ agentId: agent.id })}><strong>{agent.label}</strong><small>{agent.model ?? agent.harness}</small>{agent.parentId && <small>Parent: {page.projection.agents.find(a => a.id === agent.parentId)?.label ?? agent.parentId}</small>}</button>)}</div></details>
    {native?.inventory === 'runtime' && <details className="md-server"><summary><i className="md-tool-dot kind-runtime" /><span>Available tools</span><small>{native.tools.length}</small></summary><div>{native.tools.map(tool => <span className="md-runtime-tool" key={tool}>{tool}</span>)}</div></details>}
  </aside>;
}
