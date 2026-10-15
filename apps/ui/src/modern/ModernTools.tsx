import type { HistoryPage, NativeState } from '../fresh/api';

export function ModernTools({ page, native, onFilter, onClear, filter }: { page?: HistoryPage; native?: NativeState; onFilter: (tool: string) => void; onClear: () => void; filter?: string }) {
  return <aside className="md-tools" aria-label="Tools and agents">
    <div className="md-dock-heading"><span>Toolbox</span><span className="md-dock-led" /></div>
    <div className="md-tool-list">{page?.scene.dock.native.map(tool => <button key={tool.key} data-fr-tool={tool.tools.join('\n')} data-fr-kind={tool.kind} title={tool.tools.join(' · ')} aria-pressed={filter === tool.tools[0]} onClick={() => onFilter(tool.tools[0]!)}>
      <i className={`md-tool-dot kind-${tool.kind}`} /><span>{tool.kind}</span><small>{tool.uses}</small>
    </button>)}</div>
    {filter && <button className="md-clear-filter" onClick={onClear}>Clear tool focus ×</button>}
    {page?.scene.dock.mcp.map(server => <details className="md-server" key={server.server}>
      <summary><i className="md-tool-dot kind-mcp" /><span>{server.server}</span><small>MCP</small></summary>
      <div>{server.tools.map(tool => <button key={tool.tool} data-fr-tool={tool.tool} aria-pressed={filter === tool.tool} onClick={() => onFilter(tool.tool)}><span>{tool.tool}</span><small>{tool.uses}</small></button>)}</div>
    </details>)}
    <details className="md-server md-agents"><summary><i className="md-tool-dot kind-agent" /><span>Agents</span><small>{page?.projection.agents.length ?? '…'}</small></summary><div>{page?.projection.agents.map(agent => <div className="md-agent" key={agent.id}><strong>{agent.label}</strong><small>{agent.model ?? agent.harness}</small>{agent.parentId && <small>Parent: {page.projection.agents.find(a => a.id === agent.parentId)?.label ?? agent.parentId}</small>}</div>)}</div></details>
    {native?.inventory === 'runtime' && <details className="md-server"><summary><i className="md-tool-dot kind-runtime" /><span>Available tools</span><small>{native.tools.length}</small></summary><div>{native.tools.map(tool => <span className="md-runtime-tool" key={tool}>{tool}</span>)}</div></details>}
    <div className="md-dock-foot">Captured use counts</div>
  </aside>;
}
