import {Disclosure} from '../components/Disclosure.tsx';
import type { CSSProperties, ReactNode } from 'react';
import type { WorkFocus } from './work-focus';
import type { HistoryPage, NativeState } from '../fresh/api';
import { collectionBounds } from '../lib/collection-bounds.ts';
import { ToolList, ToolTrailBar } from '../components/ToolsPanel.tsx';
import {createPortal} from 'react-dom';
import {useToolboxPart,useToolboxWindow} from './ToolboxWindow.tsx';
import './tool-inventories.css';

function ToolCollection({count,label,children}:{count:number;label:string;children:ReactNode}) {
  const bounds=collectionBounds(count);
  return <div className="md-inventory-list" data-size={bounds.state} role="region" aria-label={label} tabIndex={bounds.state==='scroll'?0:undefined} style={{'--inventory-cap':bounds.maxBlockSize===undefined?undefined:`${bounds.maxBlockSize}px`} as CSSProperties}>{children}</div>;
}

function ToolGroup({surface,title,heading,children,className='',server}:{surface:string;title:string;heading:ReactNode;children:ReactNode;className?:string;server?:string}){
  const part=useToolboxPart(surface,title);
  return <Disclosure surface={surface} initiallyOpen={false} className={`md-server ${className}`}>
    <summary className={server?'server-name':undefined} data-mcp-server={server} onClick={part.open} aria-haspopup="dialog" aria-expanded={part.expanded}>{heading}</summary>
    <div ref={part.home} className="toolbox-part-home">{createPortal(children,part.material)}</div>
  </Disclosure>;
}

function RecordedTools(){
  const part=useToolboxPart('tools/inventory','Recorded tools');
  return <ToolList recordedLabel onExpand={part.open} expanded={part.expanded} renderBody={body=><div ref={part.home} className="toolbox-part-home">{createPortal(body,part.material)}</div>}/>;
}

export function ModernTools({ page, native, onFilter, onClear, filter, agents }: { page?: Pick<HistoryPage, 'scene' | 'projection'>; native?: Pick<NativeState, 'inventory' | 'tools'>; agents?: ReactNode; onFilter: (focus: WorkFocus) => void; onClear: () => void; filter?: WorkFocus }) {
  const whole=useToolboxPart('toolbox','Toolbox'),window=useToolboxWindow();
  return <aside className="md-tools dock modern-toolbox" aria-label="Tools and agents" title="Counts are recorded tool uses">
    <div className="md-dock-heading"><button className="toolbox-open" aria-label="Open toolbox" aria-haspopup="dialog" aria-expanded={whole.expanded} onClick={whole.open}><span>Toolbox</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3h4v4M13 3 7 9M6 4H3v9h9v-3"/></svg></button><span className="md-dock-led" /></div>
    <div className="md-tool-list">{page?.scene.dock.native.map(tool => <button key={tool.key} data-fr-tool={tool.tools.join('\n')} className={`instrument k-${tool.kind}`} data-fr-kind={tool.kind} title={tool.tools.join(' · ')} aria-pressed={filter?.kind === tool.kind} onClick={() => onFilter({ kind: tool.kind })}>
      <i className={`md-tool-dot kind-${tool.kind}`} /><span>{tool.kind}</span><small>{tool.uses}</small>
    </button>)}</div>
    {!window.active&&<ToolTrailBar/>}
    {filter && <button className="md-clear-filter" onClick={onClear}>Clear focus ×</button>}
    <div ref={whole.home} className="toolbox-part-home">{createPortal(<>
    {page?.scene.dock.mcp.map(server => <ToolGroup surface={`tools/mcp/${server.server}`} title={`MCP tools for ${server.server}`} server={server.server} key={server.server} heading={<><i className="md-tool-dot kind-mcp"/><span>{server.server}</span><small>MCP</small></>}>
      <ToolCollection count={server.tools.length} label={`MCP tools for ${server.server}`}>{server.tools.map(tool => <button key={tool.tool} data-fr-tool={tool.tool} data-mcp-server={server.server} data-mcp-tool={tool.tool} aria-pressed={filter?.tool === tool.tool && filter?.server === server.server} onClick={() => onFilter({ tool: tool.tool, server: server.server })}><span>{tool.tool}</span><small>{tool.uses}</small></button>)}</ToolCollection>
    </ToolGroup>)}
    <ToolGroup surface="tools/agents" title="Agents" className="md-agents" heading={<><i className="md-tool-dot kind-agent"/><span>Agents</span><small>{page?.projection.agents.length ?? '…'}</small></>}><ToolCollection count={page?.projection.agents.length ?? 0} label="Agents">{agents ?? page?.projection.agents.map(agent => <button className="md-agent" key={agent.id} aria-pressed={filter?.agentId === agent.id} onClick={() => onFilter({ agentId: agent.id })}><strong>{agent.label}</strong><small>{agent.model ?? agent.harness}</small>{agent.parentId && <small>Parent: {page.projection.agents.find(a => a.id === agent.parentId)?.label ?? agent.parentId}</small>}</button>)}</ToolCollection></ToolGroup>
    {native?.inventory === 'runtime' && <ToolGroup surface="tools/runtime" title="Run tools" heading={<><i className="md-tool-dot kind-runtime"/><span>Run tools</span><small>{native.tools.length}</small></>}><ToolCollection count={native.tools.length} label="Available runtime tools">{native.tools.map(tool => <span className="md-runtime-tool" key={tool}>{tool}</span>)}</ToolCollection></ToolGroup>}
    <RecordedTools/>
    </>,whole.material)}</div>
  </aside>;
}
