import type { Operation, Projection, RepoGraph } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';

export interface RepositoryContext {
  scope: 'selected' | 'reading' | 'latest';
  path?: string;
  actions: Pick<Operation, 'id' | 'kind' | 'status'>[];
}

/** Resolve a place from captured references, never from prose or nearby activity. */
export function repositoryContext(projection: Projection, scene: Scene, readingPassageId?: string, selectedOperationId?: string): RepositoryContext {
  const operations = new Map(projection.operations.map((op) => [op.id, op]));
  const primaryPath = (id: string) => operations.get(id)?.paths.find((ref) => ref.role !== 'search-hit')?.path;
  let scope: RepositoryContext['scope'] = 'latest';
  let path: string | undefined;
  if (selectedOperationId) {
    scope = 'selected';
    path = primaryPath(selectedOperationId);
  } else if (readingPassageId) {
    scope = 'reading';
    const passage = scene.passages.find((item) => item.id === readingPassageId);
    path = passage?.ops.map((op) => primaryPath(op.id)).find(Boolean);
  } else {
    for (let p = scene.passages.length - 1; p >= 0 && !path; p--) {
      const ops = scene.passages[p]!.ops;
      for (let i = ops.length - 1; i >= 0 && !path; i--) path = primaryPath(ops[i]!.id);
    }
  }
  // Only currently composed actions are candidates: an offline replay projection
  // can still contain future operations, and a worker page is not the whole run.
  const visible = new Map(scene.passages.flatMap((passage) => passage.ops.map((op) => [op.id, op.state] as const)));
  const actions = path ? projection.operations.filter((op) => visible.has(op.id) && op.paths.some((ref) => ref.path === path && ref.role !== 'search-hit')).slice(-3).map((op) => ({ id: op.id, kind: op.kind, status: visible.get(op.id)! })) : [];
  return { scope, path, actions };
}

/** Static adjacency belongs to the current index, never the agent's decision flow. */
export function repositoryNeighbors(graph: RepoGraph | undefined, path: string | undefined) {
  const imports = new Set<string>();
  const importedBy = new Set<string>();
  if (graph?.temporal === 'current' && path) {
    const nodes = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      if (edge.relation !== 'static-import' || edge.basis !== 'deterministic-rule') continue;
      if (edge.from === path && nodes.has(edge.to)) imports.add(edge.to);
      if (edge.to === path && nodes.has(edge.from)) importedBy.add(edge.from);
    }
  }
  return { imports: [...imports].sort(), importedBy: [...importedBy].sort() };
}
