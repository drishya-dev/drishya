// READ-6 read-before-write: for one edit, whether and which lines of the file the same agent had
// read earlier in the recording.
//
// A fact about recorded reads, not a judgement and not a risk score. Only the harness's own read
// tool counts: file text that reached the agent through a shell command or a search result is not
// seen here, so "no read recorded" means none in this capture. Line numbers of a read taken before
// a later edit to the same file may have shifted, so such reads are marked and never used to say
// where an edit landed relative to them.

import type { Operation, Projection } from '@drishya/contracts';

export interface ReadSpan {
  operationId: string;
  sequence: number;
  start: number;
  /** Undefined when the read reached the end of the file or its length was not captured. */
  end?: number;
  /** The file was edited after this read and before this edit, so its line numbers may be stale. */
  changedSince: boolean;
}
export interface ReadBeforeWrite {
  operationId: string;
  path: string;
  created: boolean;
  /** The most recent reads first, at most 8. */
  reads: ReadSpan[];
  totalReads: number;
  /** Lines of the file as it was before this edit that its hunks replace, e.g. 40–58. */
  edited: { start: number; end: number }[];
  /** How the lines this edit changes relate to the reads whose line numbers still hold. */
  coverage: 'none' | 'unknown' | 'inside' | 'partly' | 'outside';
}

const isFileChange = (o: Operation): o is Operation & { detail: Extract<Operation['detail'], { kind: 'edit' }> } => o.detail.kind === 'edit';

/** Undefined for anything that is not a captured edit by an agent whose reads are captured (Claude Code). */
export function readBeforeWriteFor(p: Projection, operationId: string): ReadBeforeWrite | undefined {
  const edit = p.operations.find((o) => o.id === operationId);
  if (!edit || !isFileChange(edit)) return undefined;
  if (p.agents.find((a) => a.id === edit.agentId)?.harness !== 'claude-code') return undefined;
  const path = edit.detail.path;
  const edited = edit.detail.hunks.map((h) => ({ start: h.oldStart, end: h.oldStart + Math.max(h.oldLines, 1) - 1 }));
  if (edit.detail.created) return { operationId, path, created: true, reads: [], totalReads: 0, edited, coverage: 'none' };

  const before = p.operations.filter((o) => o.agentId === edit.agentId && o.startSequence < edit.startSequence && o.id !== edit.id);
  const writes = before.filter((o) => isFileChange(o) && o.detail.path === path).map((o) => o.endSequence ?? o.startSequence);
  const reads: ReadSpan[] = before
    .filter((o) => o.detail.kind === 'read' && o.detail.path === path && o.status !== 'error')
    .sort((a, b) => b.startSequence - a.startSequence || a.id.localeCompare(b.id))
    .map((o) => {
      const d = o.detail as Extract<Operation['detail'], { kind: 'read' }>;
      const start = Math.max(1, d.startLine || 1);
      const end = d.lineCount > 0 ? start + d.lineCount - 1 : undefined;
      const whole = end === undefined || (d.totalLines !== undefined && end >= d.totalLines);
      return { operationId: o.id, sequence: o.endSequence ?? o.startSequence, start, end: whole ? undefined : end, changedSince: writes.some((w) => w > o.startSequence) };
    });

  const usable = reads.filter((r) => !r.changedSince);
  let coverage: ReadBeforeWrite['coverage'] = 'none';
  if (reads.length) {
    coverage = 'unknown';
    if (edited.length && usable.length) {
      const hits = edited.map((range) => {
        const covered = (line: number) => usable.some((r) => line >= r.start && (r.end === undefined || line <= r.end));
        let inside = 0;
        for (let line = range.start; line <= range.end; line++) if (covered(line)) inside++;
        return inside === 0 ? 'outside' : inside === range.end - range.start + 1 ? 'inside' : 'partly';
      });
      coverage = hits.every((h) => h === 'inside') ? 'inside' : hits.every((h) => h === 'outside') ? 'outside' : 'partly';
    }
  }
  return { operationId, path, created: false, reads: reads.slice(0, 8), totalReads: reads.length, edited: edited.slice(0, 12), coverage };
}
