import type { Operation } from '@drishya/contracts';

export type MaterialShape = 'source' | 'wide' | 'medium' | 'compact';

/** A repeatable view decision from captured content. Never changes evidence or tool identity. */
export function presentationOf(op: Operation): { shape: MaterialShape; material: string } {
  const d = op.detail;
  switch (d.kind) {
    case 'read': return { shape: 'source', material: 'source' };
    case 'edit': {
      const lines = d.hunks.flatMap((h) => h.lines);
      return { shape: lines.some((line) => line.length > 110) || lines.length > 24 ? 'wide' : 'source', material: 'change' };
    }
    case 'shell': return { shape: d.command.length > 110 || d.command.includes('\n') ? 'wide' : (d.outputPreview?.length ?? 0) > 160 ? 'medium' : 'compact', material: 'terminal' };
    case 'test': return { shape: d.summary?.failures.length ? 'medium' : 'compact', material: 'verification' };
    case 'search': return { shape: d.hits.length > 3 ? 'medium' : 'compact', material: 'matches' };
    case 'mcp': return { shape: (d.resultPreview?.length ?? 0) > 180 ? 'medium' : 'compact', material: 'external' };
    case 'web': return { shape: 'medium', material: 'external' };
    default: return { shape: 'compact', material: 'action' };
  }
}
