import type { Operation, Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';

export const NODE_WIDTH = 292;
export const COLUMN_GAP = 44;
export const ROW_HEIGHT = 326;
export interface CanvasNode { id: string; op: Operation; x: number; y: number; height: number; passageId: string; matches: boolean }
export interface CanvasGroup { id: string; agentId: string; x: number; y: number; width: number; height: number; unloaded: boolean; prompt?: string; proseIds: string[]; proseY: number }
export interface CanvasLink { id: string; from: CanvasNode; to: CanvasNode; label: 'next' | 'started helper' }
export interface CanvasLayout { nodes: CanvasNode[]; groups: CanvasGroup[]; links: CanvasLink[]; width: number; height: number }

export function nodeHeight(op: Operation): number {
  return ({ read: 274, search: 252, edit: 260, write: 260, shell: 228, test: 216, mcp: 244, spawn: 192, plan: 228 } as Record<string, number>)[op.kind] ?? 224;
}

/** Coordinates express captured order and explicit parentage, never inferred causality. */
export function canvasLayout(scene: Scene, projection: Projection, columns: number, lanes = false): CanvasLayout {
  columns = Math.max(1, Math.min(4, Math.floor(columns)));
  const byId = new Map(projection.operations.map(op => [op.id, op]));
  const nodes: CanvasNode[] = [], groups: CanvasGroup[] = [];
  let y = 32;
  let worldWidth = columns * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP + 24;
  const laneOffsets = new Map<string, number>();
  const passages = lanes ? scene.agents.flatMap(agent => scene.passages.filter(p => p.agentId === agent.id)) : scene.passages;
  let previousAgent: string | undefined;
  for (const passage of passages) {
    // Canvas draws operations and prose; a passage holding only harness notices (DATA-6) has nothing to place.
    if (!passage.unloaded && !passage.ops.length && !passage.prose.length && !passage.turnPrompt) continue;
    const agent = projection.agents.find(a => a.id === passage.agentId);
    const x = lanes ? laneOffsets.get(passage.agentId) ?? 0 : agent?.parentId ? 24 : 0;
    const laneStart = lanes && previousAgent !== passage.agentId;
    if (lanes) y = scene.agents.findIndex(a => a.id === passage.agentId) * 640 + 32;
    const heading = lanes ? 92 : passage.turnPrompt ? 92 : laneStart ? 48 : 32;
    const ops = passage.ops.map(s => ({ scene: s, op: byId.get(s.id) })).filter(item => !!item.op);
    ops.forEach(({ scene: item, op }, index) => nodes.push({ id: item.id, op: op!, x: x + (lanes ? index : index % columns) * (NODE_WIDTH + COLUMN_GAP), y: y + heading + (lanes ? 0 : Math.floor(index / columns) * ROW_HEIGHT), height: nodeHeight(op!), passageId: passage.id, matches: item.matchesFilter }));
    const rows = lanes ? Number(ops.length > 0) : Math.ceil(ops.length / columns);
    const proseY = y + heading + (rows ? (rows - 1) * ROW_HEIGHT + Math.max(...ops.slice(lanes ? 0 : (rows - 1) * columns).map(item => nodeHeight(item.op!))) + 32 : 0);
    const proseHeight = passage.prose.length ? 166 : 0;
    const height = passage.unloaded ? 350 : Math.max(100, proseY - y + proseHeight + 40);
    const width = lanes ? Math.max(NODE_WIDTH, ops.length * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP, passage.prose.length || passage.turnPrompt ? 660 : 0) : worldWidth - x;
    groups.push({ id: passage.id, agentId: passage.agentId, x, y, width, height, unloaded: !!passage.unloaded, prompt: passage.turnPrompt, proseIds: passage.prose.map(p => p.id), proseY });
    if (lanes) { laneOffsets.set(passage.agentId, x + width + COLUMN_GAP); worldWidth = Math.max(worldWidth, x + width); }
    else y += height;
    previousAgent = passage.agentId;
  }
  const links: CanvasLink[] = [];
  const previous = new Map<string, CanvasNode>();
  const byGroup = new Map<string, CanvasNode[]>();
  for (const node of nodes) { const list = byGroup.get(node.passageId) ?? []; list.push(node); byGroup.set(node.passageId, list); }
  for (const group of groups) {
    if (group.unloaded) { previous.delete(group.agentId); continue; }
    for (const node of byGroup.get(group.id) ?? []) {
      const before = previous.get(node.op.agentId);
      if (before) links.push({ id: `${before.id}/${node.id}`, from: before, to: node, label: 'next' });
      previous.set(node.op.agentId, node);
    }
  }
  for (const node of nodes) {
    if (node.op.detail.kind !== 'spawn' || !node.op.detail.childAgentId) continue;
    const childId = node.op.detail.childAgentId;
    const child = nodes.find(n => n.op.agentId === childId);
    if (child) links.push({ id: `${node.id}/helper/${child.id}`, from: node, to: child, label: 'started helper' });
  }
  return { nodes, groups, links, width: worldWidth, height: lanes ? Math.max(400, scene.agents.length * 640 + 32) : Math.max(400, y) };
}

export function connectorPath(from: CanvasNode, to: CanvasNode): string {
  const x1 = from.x + NODE_WIDTH, y1 = from.y + 42, x2 = to.x, y2 = to.y + 42;
  if (x2 > x1) { const bend = Math.max(24, (x2 - x1) / 2); return `M${x1},${y1}C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`; }
  const middle = from.y + from.height + 22;
  return `M${x1},${y1}C${x1 + 26},${y1} ${x1 + 26},${middle} ${x1},${middle}L${x2 - 22},${middle}Q${x2 - 34},${middle} ${x2 - 34},${middle + 12}L${x2 - 34},${y2 - 18}Q${x2 - 34},${y2} ${x2},${y2}`;
}
