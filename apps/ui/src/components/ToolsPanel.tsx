import {Disclosure} from './Disclosure.tsx';
import { useEffect, useMemo, useState,type MouseEvent,type ReactNode } from 'react';
import { toolInventory, toolTrail, type ComposeInput, type ToolEntry, type ToolInventory, type ToolTrail } from '@drishya/scene';
import { useApp } from '../state.ts';
import './tools-panel.css';

type Filter = ComposeInput['filter'];

/** The whole recording's tools: from the daemon when it can, else from the operations in hand (offline bundles). */
function useRemote<T>(enabled: boolean, key: string, load: (() => Promise<T>) | undefined, local: () => T | undefined): { value?: T; error?: string } {
  const [remote, setRemote] = useState<{ key: string; value?: T; error?: string }>();
  const localValue = useMemo(() => enabled && !load ? local() : undefined, [enabled, load, local]);
  useEffect(() => {
    if (!enabled || !load) return;
    let current = true;
    load().then(value => { if (current) setRemote({ key, value }); }, (error: Error) => { if (current) setRemote({ key, error: error.message }); });
    return () => { current = false; };
  }, [enabled, load, key]);
  // A newer answer replaces an older one; until it arrives the older one stays on screen.
  return localValue ? { value: localValue } : { value: remote?.value, error: remote?.error };
}

function useReplayStep() { return useApp(s => s.mode === 'replay' ? s.step : undefined); }
function useRevision() { return useApp(s => s.historyPage?.scene.total ?? s.projection?.timeline.length ?? 0); }

export function useToolInventory(): ToolInventory | undefined {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), projection = useApp(s => s.projection);
  const step = useReplayStep(), revision = useRevision();
  const load = useMemo(() => source?.tools && id ? () => source.tools!(id, step) : undefined, [source, id, step, revision]);
  const local = useMemo(() => () => projection ? toolInventory(projection) : undefined, [projection]);
  return useRemote(true, `${id}/${step ?? 'end'}/${revision}`, load, local).value;
}

function useTrail(filter: NonNullable<Filter>, at: string | undefined): ToolTrail | undefined {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), projection = useApp(s => s.projection);
  const step = useReplayStep(), revision = useRevision();
  const spec = { tool: filter.tool, server: filter.server, kind: filter.kind, agent: filter.agentId };
  const specKey = JSON.stringify(spec);
  const load = useMemo(() => source?.toolTrail && id ? () => source.toolTrail!(id, spec, { id: at }, step) : undefined, [source, id, specKey, at, step, revision]);
  const local = useMemo(() => () => projection ? toolTrail(projection, spec, { id: at }) : undefined, [projection, specKey, at]);
  return useRemote(true, `${id}/${specKey}/${at}/${step ?? 'end'}/${revision}`, load, local).value;
}

/** The tool names an entry stands for as a filter, or nothing when it was never used (there is nothing to dim or walk). */
const entryFilter = (entry: ToolEntry, current: Filter): Filter => entry.filterTool
  ? { ...(current?.agentId ? { agentId: current.agentId } : {}), tool: entry.filterTool, ...(entry.server ? { server: entry.server } : {}) }
  : current;
const isSelected = (entry: ToolEntry, filter: Filter) => !!entry.filterTool && filter?.tool === entry.filterTool && (filter.server ?? undefined) === (entry.server ?? undefined);

const LONG = 14;

/** Every tool the harness listed as available, and every tool that was used, with how often. Shown by default. */
export function ToolList({recordedLabel=false,onExpand,expanded,renderBody=(body)=>body}:{recordedLabel?:boolean;onExpand?:(event:MouseEvent<HTMLElement>)=>void;expanded?:boolean;renderBody?:(body:ReactNode)=>ReactNode}={}) {
  const inventory = useToolInventory();
  const filter = useApp(s => s.filter), setFilter = useApp(s => s.setFilter);
  const [query, setQuery] = useState(''), [unused, setUnused] = useState<string>();
  if (!inventory) return null;
  const needle = query.trim().toLowerCase();
  const tools = needle ? inventory.tools.filter(t => `${t.name} ${t.server ?? ''}`.toLowerCase().includes(needle)) : inventory.tools;
  const groups = new Map<string, ToolEntry[]>();
  for (const tool of tools) groups.set(tool.server ?? '', [...(groups.get(tool.server ?? '') ?? []), tool]);
  const usedCount = inventory.tools.filter(t => t.uses).length;
  return <Disclosure surface="tools/inventory" className="tool-list" aria-label="Available tools">
    <summary className="tool-heading" onClick={onExpand} aria-haspopup={onExpand?'dialog':undefined} aria-expanded={onExpand?expanded:undefined}>{inventory.recorded ? recordedLabel?'Available tools · recorded':'Available tools' : recordedLabel?'Tools used · recorded':'Tools used'} <span title={inventory.recorded ? `${usedCount} used of ${inventory.tools.length} available` : undefined}>{inventory.recorded ? `${usedCount} of ${inventory.tools.length}` : inventory.tools.length}</span></summary>
    {renderBody(<>
    {!inventory.recorded && <p className="tool-note">This harness did not record which tools were available, so only the tools it used are shown.</p>}
    {inventory.tools.length > LONG && <input type="search" className="tool-search" aria-label="Search tools" placeholder="Search tools" value={query} onChange={event => setQuery(event.target.value)}/>}
    <div className="tool-groups" role="group" aria-label="Tools">
      {[...groups].map(([server, entries]) => <div className="tool-group" key={server || 'native'}>
        <div className="tool-group-name">{server || 'Native tools'}<span>{entries.length}</span></div>
        {entries.map(entry => <button key={entry.key} type="button" className={`tool-row${entry.uses ? '' : ' unused'}`} aria-pressed={isSelected(entry, filter)}
          title={`${entry.name}${entry.listed ? '' : ' · used but not in the harness list'}${entry.uses ? '' : ' · not used in this session'}`}
          onClick={() => {
            if (!entry.filterTool) { setUnused(unused === entry.key ? undefined : entry.key); return; }
            setUnused(undefined);
            setFilter(isSelected(entry, filter) ? undefined : entryFilter(entry, filter));
          }}>
          <span className="tool-name">{entry.server && entry.name.startsWith(`mcp__${entry.server}__`) ? entry.name.slice(`mcp__${entry.server}__`.length) : entry.name}</span>
          <span className="tool-uses">{entry.uses || '—'}</span>
          {unused === entry.key && <span className="tool-unused" role="status">Not used in this session</span>}
        </button>)}
      </div>)}
      {!tools.length && <p className="tool-note">No tool matches.</p>}
    </div></>)}
  </Disclosure>;
}

/** Where the reader stands among the uses of the chosen tool, server or kind, with a way to walk them. */
export function ToolTrailBar() {
  const filter = useApp(s => s.filter);
  const at = useApp(s => s.trailAt ?? s.selectedOp ?? s.expandedOp);
  if (!filter || !(filter.tool || filter.server || filter.kind)) return null;
  return <TrailBody filter={filter} at={at}/>;
}

function TrailBody({ filter, at }: { filter: NonNullable<Filter>; at?: string }) {
  const trail = useTrail(filter, at);
  const label = filter.tool ?? filter.server ?? filter.kind ?? '';
  const go = (target?: { id: string; step: number }) => { if (target) window.dispatchEvent(new CustomEvent('drishya-reading-navigate', { detail: { type: 'operation', id: target.id, step: target.step } })); };
  return <div className="tool-trail" role="group" aria-label={`Uses of ${label}`}>
    <div className="trail-head"><span className="trail-label" title={label}>{label}</span>
      {trail && <output className="trail-count" aria-live="polite">{trail.total ? `${trail.index ?? '–'} of ${trail.total}` : 'No uses'}</output>}</div>
    {trail && <>
      <button type="button" aria-label="First use" title="First use" disabled={!trail.first || trail.index === 1} onClick={() => go(trail.first)}>«</button>
      <button type="button" aria-label="Previous use" title="Previous use" disabled={!trail.previous} onClick={() => go(trail.previous)}>‹</button>
      <button type="button" aria-label="Next use" title="Next use" disabled={!trail.next} onClick={() => go(trail.next)}>›</button>
      <button type="button" aria-label="Last use" title="Last use" disabled={!trail.last || trail.index === trail.total} onClick={() => go(trail.last)}>»</button>
    </>}
  </div>;
}
