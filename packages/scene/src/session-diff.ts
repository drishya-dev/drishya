import type { Operation, Projection } from '@drishya/contracts';
import { operationObservations } from './operation-observations.ts';

export interface DiffAttribution { operationId: string; turn?: number; nextCheck?: { operationId: string; kind: 'test' | 'shell'; outcome: 'passed' | 'failed' | 'unknown' } }
export interface SessionDiffLine { kind: 'add' | 'remove'; text: string; oldLine?: number; newLine?: number; attribution: DiffAttribution }
export interface SessionDiff { basis: 'derived'; status: 'complete' | 'unavailable'; note?: string; lines: SessionDiffLine[] }
interface Token { base?: number; text?: string; attribution?: DiffAttribution }
const MAX_LINES = 100_000;
const MAX_MATERIAL = 20_000;

/** Compose captured, positioned patches. Unknown untouched lines retain identity, never invented text. */
export function sessionDiff(p: Projection, path: string, after = -1): SessionDiff {
  const unavailable = (note: string): SessionDiff => ({ basis: 'derived', status: 'unavailable', note, lines: [] });
  const { starts, ends } = operationObservations(p);
  const edits = p.operations.filter(o => o.detail.kind === 'edit' && o.detail.path === path && !o.declined && o.status !== 'error' && o.status !== 'running' && (after < 0 || (ends.get(o.id) ?? starts.get(o.id) ?? -1) > after));
  if (!edits.length) return unavailable('No completed captured patches.');
  if (edits.some(o => starts.get(o.id) === undefined)) return unavailable('An edit lacks its captured position; net order is unattributed.');
  edits.sort((a, b) => starts.get(a.id)! - starts.get(b.id)!);
  const first = starts.get(edits[0]!.id)!, last = ends.get(edits.at(-1)!.id) ?? starts.get(edits.at(-1)!.id)!;
  if (p.timeline.some(t => t.type === 'gap' && t.sequence >= first && t.sequence <= last)) return unavailable('A capture gap interrupts the patch chain. Inspect the captured edits.');
  let extent = 0, material = 0;
  for (const op of edits) {
    if (op.detail.kind !== 'edit') continue;
    if (op.status !== 'ok' || !op.detail.hunks.length) return unavailable('A patch outcome or its material is missing.');
    if (!op.detail.created && op.detail.reconstruction !== 'complete' && op.detail.hunks.every(h => !h.oldLines && !h.oldStart)) return unavailable('A replacement write lacks its captured before-state.');
    for (const h of op.detail.hunks) {
      if ((h.oldLines > 0 && h.oldStart < 1) || (h.newLines > 0 && h.newStart < 1)) return unavailable('A captured replacement has no exact file line position.');
      extent = Math.max(extent, h.oldStart + h.oldLines, h.newStart + h.newLines);
      material += h.lines.length;
    }
  }
  if (extent > MAX_LINES || material > MAX_MATERIAL) return unavailable('Net composition exceeds the bounded reading limit; all individual edits remain available.');
  // A sentinel tail keeps identity through insertions beyond the last captured line.
  const base: Token[] = Array.from({ length: extent + 1 }, (_, base) => ({ base }));
  let current = [...base];
  const removed = new Map<number, DiffAttribution>();
  const turns = p.timeline.filter(t => t.type === 'turn');
  const checks = p.operations.filter(o => (o.detail.kind === 'test' || o.detail.kind === 'shell') && !o.declined && starts.has(o.id)).sort((a, b) => starts.get(a.id)! - starts.get(b.id)!);
  for (const op of edits) {
    if (op.detail.kind !== 'edit') continue;
    const position = starts.get(op.id)!, agentTurns = turns.filter(t => t.agentId === op.agentId);
    const turn = agentTurns.filter(t => t.sequence <= position).length || undefined;
    const turnEnd = agentTurns.find(t => t.sequence > position)?.sequence ?? Infinity;
    const check = turn ? checks.find(c => c.agentId === op.agentId && starts.get(c.id)! > (ends.get(op.id) ?? position) && starts.get(c.id)! < turnEnd) : undefined;
    const attribution: DiffAttribution = { operationId: op.id, turn, ...(check && { nextCheck: { operationId: check.id, kind: check.detail.kind as 'shell' | 'test', outcome: check.status === 'ok' ? 'passed' as const : check.status === 'error' ? 'failed' as const : 'unknown' as const } }) };
    let shift = 0;
    for (const h of [...op.detail.hunks].sort((a, b) => a.oldStart - b.oldStart)) {
      const oldLines = h.lines.filter(l => l[0] === ' ' || l[0] === '-');
      const newLines = h.lines.filter(l => l[0] === ' ' || l[0] === '+');
      if (oldLines.length !== h.oldLines || newLines.length !== h.newLines) return unavailable('A captured hunk is incomplete.');
      const at = (h.oldLines ? h.oldStart - 1 : h.oldStart) + shift;
      if (at < 0 || at + h.oldLines > current.length) return unavailable('A patch falls outside its captured line range.');
      const replacement: Token[] = []; let offset = 0;
      for (const line of h.lines) {
        if (line[0] === '+') { replacement.push({ text: line.slice(1), attribution }); continue; }
        if (line[0] !== ' ' && line[0] !== '-') return unavailable('A captured hunk contains unsupported material.');
        const token = current[at + offset++]!;
        if (token.text !== undefined && token.text !== line.slice(1)) return unavailable('Captured patches do not form one continuous file state.');
        token.text = line.slice(1);
        if (line[0] === ' ') replacement.push(token);
        else if (token.base !== undefined) removed.set(token.base, attribution);
      }
      current.splice(at, h.oldLines, ...replacement); shift += h.newLines - h.oldLines;
    }
  }
  const lines: SessionDiffLine[] = [];
  let oldAt = 0, newAt = 0;
  while (newAt < current.length) {
    const token = current[newAt]!;
    if (token.base !== undefined && token.base === oldAt) { oldAt++; newAt++; continue; }
    const added: { token: Token; line: number }[] = [];
    while (newAt < current.length && current[newAt]!.base === undefined) { added.push({ token: current[newAt]!, line: newAt + 1 }); newAt++; }
    const stop = current[newAt]?.base ?? base.length;
    const deleted = base.slice(oldAt, stop);
    // Equal removed/added material has no net textual change. Keep latest writers on all surviving additions.
    let prefix = 0, suffix = 0;
    while (prefix < Math.min(deleted.length, added.length) && deleted[prefix]!.text === added[prefix]!.token.text) prefix++;
    while (suffix < Math.min(deleted.length, added.length) - prefix && deleted[deleted.length - 1 - suffix]!.text === added[added.length - 1 - suffix]!.token.text) suffix++;
    for (let i = prefix; i < deleted.length - suffix; i++) {
      const t = deleted[i]!, attribution = removed.get(t.base!);
      if (t.text === undefined || !attribution) return unavailable('A removed line has no captured material or operation.');
      lines.push({ kind: 'remove', text: t.text, oldLine: t.base! + 1, attribution });
    }
    for (const { token: t, line } of added.slice(prefix, added.length - suffix)) lines.push({ kind: 'add', text: t.text!, newLine: line, attribution: t.attribution! });
    oldAt = stop;
  }
  return { basis: 'derived', status: 'complete', lines };
}
