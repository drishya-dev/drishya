import type { Operation } from '@drishya/contracts';
import { diffCardWidth } from './card-evidence.ts';

export type MaterialShape = 'source' | 'reading' | 'wide' | 'medium' | 'compact';

/** A repeatable view decision from captured content. Never changes evidence or tool identity. */
export function presentationOf(op: Operation): { shape: MaterialShape; material: string; width?: number } {
  const d = op.detail;
  switch (d.kind) {
    case 'read': return { shape: 'source', material: 'source' };
    case 'edit': {
      const lines = d.hunks.flatMap((h) => h.lines);
      const wide = lines.some((line) => line.length > 110) || lines.length > 24;
      // A wide diff takes the width its longest line needs, up to the passage; short edits keep their compact card.
      return { shape: wide ? 'wide' : 'source', material: 'change', ...(wide ? { width: diffCardWidth(d.hunks) } : {}) };
    }
    case 'shell': return { shape: d.command.length > 110 || d.command.includes('\n') ? 'wide' : (d.outputPreview?.length ?? 0) > 160 ? 'medium' : 'compact', material: 'terminal', width: readingWidth(d.command, d.outputPreview) };
    case 'test': return { shape: d.command.length>110||d.command.includes('\n')?'wide':'medium', material: 'verification',width:Math.max(350,readingWidth(d.command,d.outputPreview)) };
    case 'search': return { shape: d.hits.length > 3 ? 'medium' : 'compact', material: 'matches', width: readingWidth(d.query, ...d.hits.slice(0, 5).map(hit => `${hit.path}:${hit.line ?? ''} ${hit.text ?? ''}`)) };
    case 'mcp': {
      const inputNeedsSpace = typeof d.input === 'string' ? d.input.length > 180 : !!d.input && typeof d.input === 'object' && Object.values(d.input).some((value) => typeof value === 'string' && value.length > 180);
      return { shape: inputNeedsSpace || (d.resultPreview?.length ?? 0) > 300 ? 'reading' : 'medium', material: 'external',width:Math.max(320,readingWidth(typeof d.input==='string'?d.input:JSON.stringify(d.input),d.resultPreview)) };
    }
    case 'web': return { shape: (d.resultPreview?.length ?? 0) > 300 || (d.url ?? d.query ?? '').length > 180 ? 'reading' : 'medium', material: 'external' };
    case 'other': return {shape:'medium',material:'action',width:Math.max(320,readingWidth(typeof d.input==='string'?d.input:JSON.stringify(d.input),d.resultPreview))};
    default: return { shape: 'compact', material: 'action' };
  }
}

/** Preview-only sizing keeps a short receipt from inheriting a source-reader allocation. */
export function readingWidth(...texts: (string | undefined)[]): number {
  let longest = 0;
  for (const text of texts) for (const line of (text ?? '').slice(0, 4096).split('\n').slice(0, 40)) longest = Math.max(longest, Math.min(90, line.length));
  return Math.max(210, Math.min(440, 72 + longest * 6));
}
