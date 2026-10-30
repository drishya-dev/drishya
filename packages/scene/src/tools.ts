import type { Operation, OperationKind, Projection } from '@drishya/contracts';

/** TOOLS-1: every tool the harness listed as available, merged with every tool the recording used. Pure: no clock, no DOM. */
export interface ToolEntry {
  /** Stable key for lists. */
  key: string;
  /** The name as the harness listed it, or as the operations carried it when it was never listed. */
  name: string;
  namespace?: string;
  server?: string;
  kind?: OperationKind;
  /** The tool name the scene filter and a trail match on (`Operation.origin.tool`, which for an MCP tool is its own name without the server). Absent while the tool was never used. */
  filterTool?: string;
  uses: number;
  /** The harness listed it as available. */
  listed: boolean;
}

export interface ToolInventory {
  tools: ToolEntry[];
  /** The harness recorded a list of available tools. When false, only tools that were used can be shown. */
  recorded: boolean;
}

const keysOf = (op: Operation): string[] => op.origin.type === 'mcp' ? [op.tool, `mcp__${op.origin.server}__${op.origin.tool}`] : [op.tool];

/** Operations that belong to a listed tool: by its own name, its group-qualified name, or the full MCP name. */
function listedKeys(tool: { name: string; namespace?: string }): string[] {
  return [tool.name, ...(tool.namespace ? [`${tool.namespace}.${tool.name}`] : [])];
}

export function toolInventory(projection: Projection): ToolInventory {
  const listed = projection.availableTools ?? [];
  const byKey = new Map<string, ToolEntry>();
  const owner = new Map<string, string>();
  for (const t of listed) {
    if (t.until !== undefined) continue;
    const key = `${t.namespace ?? ''}|${t.name}`;
    byKey.set(key, { key, name: t.name, namespace: t.namespace, server: t.server, uses: 0, listed: true });
    for (const name of listedKeys(t)) owner.set(name, key);
  }
  const seenTool = new Map<string, Map<string, number>>();
  for (const op of projection.operations) {
    const keys = keysOf(op);
    const hit = keys.map(name => owner.get(name)).find((k): k is string => k !== undefined);
    const key = hit ?? `observed|${op.tool}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { key, name: op.tool, server: op.origin.type === 'mcp' ? op.origin.server : undefined, uses: 0, listed: false };
      byKey.set(key, entry);
    }
    entry.uses++;
    entry.kind ??= op.kind;
    const names = seenTool.get(key) ?? new Map<string, number>();
    names.set(op.origin.tool, (names.get(op.origin.tool) ?? 0) + 1);
    seenTool.set(key, names);
  }
  for (const [key, names] of seenTool) {
    const entry = byKey.get(key)!;
    entry.filterTool = [...names].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  }
  const tools = [...byKey.values()].sort((a, b) => Number(!!a.server) - Number(!!b.server) || (a.server ?? '').localeCompare(b.server ?? '') || b.uses - a.uses || a.name.localeCompare(b.name));
  return { tools, recorded: listed.length > 0 };
}

export interface ToolFilter { tool?: string; server?: string; kind?: string; agent?: string }
export interface TrailStep { id: string; step: number }
export interface ToolTrail {
  /** All uses that match, over the whole recording. */
  total: number;
  /** 1-based position of the current use, when the current operation is one of them. */
  index?: number;
  /** Uses before the current position, whether or not the current operation is one of them. */
  before: number;
  previous?: TrailStep;
  next?: TrailStep;
  first?: TrailStep;
  last?: TrailStep;
}

export const matchesTool = (op: Operation, filter: ToolFilter): boolean =>
  (!filter.agent || op.agentId === filter.agent) && (!filter.tool || op.origin.tool === filter.tool) &&
  (!filter.server || op.origin.type === 'mcp' && op.origin.server === filter.server) && (!filter.kind || op.kind === filter.kind);

/** The uses of a tool in captured order, and where the reader stands among them. `from` is an operation id; `at` is a captured sequence. */
export function toolTrail(projection: Projection, filter: ToolFilter, from?: { id?: string; at?: number }): ToolTrail {
  const uses = projection.operations.filter(op => matchesTool(op, filter)).sort((a, b) => a.startSequence - b.startSequence || (a.id < b.id ? -1 : 1));
  const step = (op: Operation): TrailStep => ({ id: op.id, step: op.startSequence });
  const total = uses.length;
  if (!total) return { total, before: 0 };
  const current = from?.id ? uses.findIndex(op => op.id === from.id) : -1;
  const reference = current >= 0 ? uses[current]!.startSequence : from?.id ? projection.operations.find(op => op.id === from.id)?.startSequence : from?.at;
  const before = current >= 0 ? current : reference === undefined ? 0 : uses.filter(op => op.startSequence < reference).length;
  const after = current >= 0 ? current + 1 : reference === undefined ? 0 : before + uses.slice(before).filter(op => op.startSequence <= reference).length;
  return {
    total,
    ...(current >= 0 ? { index: current + 1 } : {}),
    before,
    ...(before > 0 ? { previous: step(uses[before - 1]!) } : {}),
    ...(after < total ? { next: step(uses[after]!) } : {}),
    first: step(uses[0]!),
    last: step(uses[total - 1]!),
  };
}
