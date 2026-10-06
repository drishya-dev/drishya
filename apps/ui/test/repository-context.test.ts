import { readFileSync } from 'node:fs';
import type { ReplayBundle } from '@drishya/contracts';
import { compose } from '@drishya/scene';
import { describe, expect, it } from 'vitest';
import { repositoryContext, repositoryNeighbors } from '../src/lib/repository-context.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
const projection = bundle.projection;
const scene = compose(projection, { step: projection.timeline.length });

describe('repository reading context', () => {
  it('holds the captured place of an earlier passage instead of the latest file', () => {
    const passage = scene.passages.find((passage) => passage.ops.some((op) => op.kind === 'read'))!;
    const context = repositoryContext(projection, scene, passage.id);
    expect(context.scope).toBe('reading');
    expect(context.path).toBe('src/checkout/guard.ts');
    expect(context.actions.length).toBeLessThanOrEqual(3);
    expect(context.actions.every((action) => projection.operations.find((op) => op.id === action.id)!.paths.some((ref) => ref.path === context.path && ref.role !== 'search-hit'))).toBe(true);
    expect(repositoryContext(projection, scene).path).toBe('test/checkout.test.ts');
  });
  it('does not substitute nearby activity for a missing or unlocated passage', () => {
    expect(repositoryContext(projection, scene, 'unloaded-passage')).toEqual({ scope: 'reading', path: undefined, actions: [] });
    const search = projection.operations.find((op) => op.kind === 'search')!;
    const focused = { ...scene, focus: { ...scene.focus, operationId: search.id } } as typeof scene;
    const context = repositoryContext({ ...projection, operations: projection.operations.map((op) => op.id === search.id ? { ...op, paths: op.paths.filter((ref) => ref.role === 'search-hit') } : op) }, focused, undefined, search.id);
    expect(context.path).toBeUndefined();
    expect(context.actions).toEqual([]);
  });
  it('does not expose future actions when the supplied projection is complete', () => {
    const firstRead = projection.operations.find((op) => op.detail.kind === 'read')!;
    const at = projection.timeline.findIndex((item) => item.type === 'op-end' && item.operationId === firstRead.id) + 1;
    const early = compose(projection, { step: at });
    const context = repositoryContext(projection, early);
    expect(context.actions.map((op) => op.id)).toEqual([firstRead.id]);
  });
  it('takes outcomes from the composed boundary, not a future completed operation', () => {
    const firstRead = projection.operations.find((op) => op.detail.kind === 'read')!;
    const at = projection.timeline.findIndex((item) => item.type === 'op-start' && item.operationId === firstRead.id) + 1;
    const context = repositoryContext(projection, compose(projection, { step: at }));
    expect(context.actions).toEqual([{ id: firstRead.id, kind: firstRead.kind, status: 'running', label: firstRead.tool }]);
    expect(context.actions[0]!.label).not.toContain('line');
  });
  it('does not let automatic scene focus steal the held reading location', () => {
    const nextRead = projection.operations.find((op) => op.detail.kind === 'read' && op.detail.path === 'src/cart/discount.ts')!;
    const at = projection.timeline.findIndex((item) => item.type === 'op-start' && item.operationId === nextRead.id) + 1;
    const growing = compose(projection, { step: at });
    expect(growing.focus?.operationId).toBe(nextRead.id);
    const earlier = growing.passages.find((passage) => passage.ops.some((op) => op.kind === 'read'))!;
    expect(repositoryContext(projection, growing, earlier.id).path).toBe('src/checkout/guard.ts');
    expect(repositoryContext(projection, growing, earlier.id).scope).toBe('reading');
  });
  it('uses only qualified current static edges, deduplicates and excludes unresolved targets', () => {
    const graph = bundle.graph!;
    const [a, b, c] = graph.nodes.map((node) => node.id);
    const edge = (from: string, to: string) => ({ from, to, relation: 'static-import' as const, basis: 'deterministic-rule' as const, specifier: './file' });
    const current = { ...graph, temporal: 'current' as const, edges: [edge(a!, b!), edge(a!, b!), edge(c!, a!), edge(a!, 'missing')] };
    expect(repositoryNeighbors(current, a)).toEqual({ imports: [b], importedBy: [c] });
    expect(repositoryNeighbors({ ...current, temporal: 'recording-files-only' }, a)).toEqual({ imports: [], importedBy: [] });
  });
});
