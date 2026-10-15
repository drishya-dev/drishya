import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { asOfProjection, compose } from '@drishya/scene';
import { canvasLayout, NODE_WIDTH } from '../src/lib/canvas-layout.ts';
const projection = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8')).projection as Projection;

describe('observation canvas layout', () => {
  it('keeps every captured action in order, separates readable nodes and uses only captured helper parentage', () => {
    const scene = compose(projection, { step: projection.timeline.length });
    const layout = canvasLayout(scene, projection, 3);
    expect(new Set(layout.nodes.map(n => n.id)).size).toBe(projection.operations.length);
    for (const group of layout.groups) {
      const nodes = layout.nodes.filter(n => n.passageId === group.id);
      expect(nodes.map(n => n.op.startSequence)).toEqual(nodes.map(n => n.op.startSequence).sort((a, b) => a - b));
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!;
        expect(a.x + NODE_WIDTH <= b.x || a.y + a.height <= b.y || b.x + NODE_WIDTH <= a.x || b.y + b.height <= a.y).toBe(true);
      }
    }
    for (const link of layout.links.filter(l => l.label === 'started helper')) {
      expect(link.from.op.detail.kind).toBe('spawn');
      if (link.from.op.detail.kind === 'spawn') expect(link.to.op.agentId).toBe(link.from.op.detail.childAgentId);
    }
  });
  it('does not bridge an unloaded passage with a next-action edge', () => {
    const scene = compose(projection, { step: projection.timeline.length });
    const agent = scene.passages.find(p => p.ops.length)!.agentId;
    const passages = scene.passages.filter(p => p.agentId === agent && p.ops.length);
    expect(passages.length).toBeGreaterThan(2);
    const middle = passages[1]!;
    scene.passages = scene.passages.map(p => p.id === middle.id ? { ...p, unloaded: true, ops: [], prose: [] } : p);
    const layout = canvasLayout(scene, projection, 2);
    const before = new Set(passages[0]!.ops.map(op => op.id));
    const after = new Set(passages[2]!.ops.map(op => op.id));
    expect(layout.links.some(link => before.has(link.from.id) && after.has(link.to.id))).toBe(false);
  });
  it('renders only the composer’s evidence boundary and retains one lane per captured agent', () => {
    const end = projection.timeline.findIndex(event => event.type === 'op-end') + 1;
    const scene = compose(projection, { step: end });
    const historical = asOfProjection(projection, end);
    const layout = canvasLayout(scene, historical, 2, true);
    expect(layout.nodes.every(n => historical.operations.some(op => op.id === n.id))).toBe(true);
    expect(layout.nodes.length).toBeLessThan(projection.operations.length);
    const full = canvasLayout(compose(projection, { step: projection.timeline.length }), projection, 2, true);
    const agentOrder = full.groups.map(g => g.agentId).filter((id, i, all) => all[i - 1] !== id);
    expect(new Set(agentOrder).size).toBe(agentOrder.length);
  });
});
