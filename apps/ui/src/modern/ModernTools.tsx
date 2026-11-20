import {Disclosure} from '../components/Disclosure.tsx';
import { useApp } from '../state.ts';
import type { CSSProperties, ReactNode } from 'react';
import type { WorkFocus } from './work-focus';
import type { HistoryPage, NativeState } from '../fresh/api';
import { collectionBounds } from '../lib/collection-bounds.ts';
import { ToolList, ToolTrailBar } from '../components/ToolsPanel.tsx';
import './tool-inventories.css';

function ToolCollection({count,label,children}:{count:number;label:string;children:ReactNode}) {
  const bounds=collectionBounds(count);
  return <div className="md-inventory-list" data-size={bounds.state} role="region" aria-label={label} tabIndex={bounds.state==='scroll'?0:undefined} style={{'--inventory-cap':bounds.maxBlockSize===undefined?undefined:`${bounds.maxBlockSize}px`} as CSSProperties}>{children}</div>;
}

function ToolGroup({surface,heading,children,className='',server}:{surface:string;heading:ReactNode;children:ReactNode;className?:string;server?:string}){
  return <Disclosure surface={surface} initiallyOpen={false} className={`md-server ${className}`}>
    <summary className={server?'server-name':undefined} data-mcp-server={server}>{heading}</summary>
    {children}
  </Disclosure>;
}

export function ModernTools({ page, native, onFilter, onClear, filter, agents }: { page?: Pick<HistoryPage, 'scene' | 'projection'>; native?: Pick<NativeState, 'inventory' | 'tools'>; agents?: ReactNode; onFilter: (focus: WorkFocus) => void; onClear: () => void; filter?: WorkFocus }) {
  // PERF-4: counts are of the whole session; while only its latest work is folded they read as still loading, not as a smaller number.
  const counting = useApp(s => !!s.historyPage?.partial);
  const uses = (n: number) => counting ? '…' : n;

  const setHoveredKind = (kind?: string) => {
    if (!kind) {
      useApp.setState({ hoveredOp: undefined, hoveredPath: undefined });
      return;
    }
    const op = page?.scene.passages.flatMap(p => p.ops).filter(o => o.kind === kind || (kind === 'edit' && o.kind === 'write')).at(-1);
    if (op) useApp.setState({ hoveredOp: op.id, hoveredPath: op.paths[0] });
  };

  const setHoveredMcp = (server?: string, tool?: string) => {
    if (!server) {
      useApp.setState({ hoveredOp: undefined, hoveredPath: undefined });
      return;
    }
    const op = page?.scene.passages.flatMap(p => p.ops).find(o => o.origin.type === 'mcp' && o.origin.server === server && (!tool || o.tool === tool));
    if (op) useApp.setState({ hoveredOp: op.id, hoveredPath: undefined });
  };

  return <aside className="md-tools dock modern-toolbox" aria-label="Tools and agents" title="Counts are recorded tool uses">
    <div className="md-dock-heading"><span>Toolbox</span><span className="md-dock-led" /></div>
    <div className="md-tool-list">{page?.scene.dock.native.map(tool => <button key={tool.key} data-fr-tool={tool.tools.join('\n')} className={`instrument k-${tool.kind}`} data-fr-kind={tool.kind} title={tool.tools.join(' · ')} aria-pressed={filter?.kind === tool.kind} onClick={() => onFilter({ kind: tool.kind })} onMouseEnter={() => setHoveredKind(tool.kind)} onMouseLeave={() => setHoveredKind(undefined)}>
      <i className={`md-tool-dot kind-${tool.kind}`} /><span>{tool.kind}</span><small>{uses(tool.uses)}</small>
    </button>)}</div>
    <ToolTrailBar/>
    {filter && <button className="md-clear-filter" onClick={onClear}>Clear focus ×</button>}

    {page?.scene.dock.mcp.map(server => <ToolGroup surface={`tools/mcp/${server.server}`} server={server.server} key={server.server} heading={<><i className="md-tool-dot kind-mcp"/><span>{server.server}</span><small>MCP</small></>}>
      <ToolCollection count={server.tools.length} label={`MCP tools for ${server.server}`}>{server.tools.map(tool => <button key={tool.tool} data-fr-tool={tool.tool} data-mcp-server={server.server} data-mcp-tool={tool.tool} aria-pressed={filter?.tool === tool.tool && filter?.server === server.server} onClick={() => onFilter({ tool: tool.tool, server: server.server })} onMouseEnter={() => setHoveredMcp(server.server, tool.tool)} onMouseLeave={() => setHoveredMcp(undefined)}><span>{tool.tool}</span><small>{uses(tool.uses)}</small></button>)}</ToolCollection>
    </ToolGroup>)}
    <ToolGroup surface="tools/agents" className="md-agents" heading={<><i className="md-tool-dot kind-agent"/><span>Agents</span><small>{counting ? '…' : page?.projection.agents.length ?? '…'}</small></>}><ToolCollection count={page?.projection.agents.length ?? 0} label="Agents">{agents ?? page?.projection.agents.map(agent => <button className="md-agent" key={agent.id} aria-pressed={filter?.agentId === agent.id} onClick={() => onFilter({ agentId: agent.id })}><strong>{agent.label}</strong><small>{agent.model ?? agent.harness}</small>{agent.parentId && <small>Parent: {page.projection.agents.find(a => a.id === agent.parentId)?.label ?? agent.parentId}</small>}</button>)}</ToolCollection></ToolGroup>
    {native?.inventory === 'runtime' && <ToolGroup surface="tools/runtime" heading={<><i className="md-tool-dot kind-runtime"/><span>Run tools</span><small>{native.tools.length}</small></>}><ToolCollection count={native.tools.length} label="Available runtime tools">{native.tools.map(tool => <span className="md-runtime-tool" key={tool}>{tool}</span>)}</ToolCollection></ToolGroup>}
    <ToolList recordedLabel/>
  </aside>;
}
