import type { Operation } from '@drishya/contracts';

export interface FileEvidence {
  key: string;
  label: string;
  operation: Operation;
  artifactId?: string;
  patch?: boolean;
  startLine?: number;
  /** Exact captured search result, not a whole-file snapshot or reconstructed source. */
  snippet?: string;
}

/** Choices reference actual captured artifacts, never today's disk or an invented intermediate file. */
export function fileEvidence(op: Operation, path: string): FileEvidence[] {
  const detail = op.detail;
  const choices: FileEvidence[] = [];
  const add = (key: string, label: string, artifactId?: string, patch = false, startLine?: number) => choices.push({ key: `${op.id}/${key}`, label, operation: op, artifactId, patch, startLine });
  if (detail.kind === 'read' && detail.path === path && detail.excerptArtifactId) add('read', 'Read excerpt', detail.excerptArtifactId, false, detail.startLine);
  if (detail.kind === 'search') detail.hits.forEach((hit, index) => {
    if (hit.path === path && hit.text !== undefined) choices.push({ key: `${op.id}/search/${index}`, label: `Search match${hit.line ? ` · line ${hit.line}` : ''}`, operation: op, snippet: hit.text, startLine: hit.line });
  });
  if (detail.kind === 'edit' && detail.path === path) {
    if (detail.hunks.length) add('patch', 'Patch', undefined, true);
    for (const state of ['before', 'after']) {
      const id = op.artifactIds.find((id) => id.endsWith(`_${state}`));
      if (id) add(state, `${state === 'before' ? 'Before' : 'After'}-state reference`, id);
    }
  }
  return choices;
}
