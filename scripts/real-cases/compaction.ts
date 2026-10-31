import type { Projection } from '@drishya/contracts';
import type { RealCase } from './types.ts';

type Raw = Record<string, any>;
type Expected = { harness: string; time?: string; before?: number; after?: number; duration?: number; trigger?: string; native?: string; summaryTime?: string; prior?: number; next?: number; priorWindow?: number; nextWindow?: number; priorTime?: string; nextTime?: string; encrypted?: boolean };
// Private in-memory comparison only. No journal text, native path or metric values are printed.
const expected: Expected[] = [];
let prior: number | undefined, priorWindow: number | undefined, priorTime: string | undefined, waiting: Expected[] = [];
export function resetCompactionScan() { prior = undefined; priorWindow = undefined; priorTime = undefined; waiting = []; }
const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
export const compaction: RealCase = {
  name: 'compaction', about: 'exact Claude boundary metrics and Codex request readings, summaries and replay cutoffs',
  harnesses: ['claude-code','codex'], prefilter: '',
  scan(row: Raw, harness) {
    if (harness === 'claude-code') {
      if (row.type === 'user' && row.isCompactSummary) { const boundary = expected.findLast(e => e.harness === harness && e.native === row.parentUuid); if (boundary) boundary.summaryTime = row.timestamp; return; }
      if (row.type !== 'system' || row.subtype !== 'compact_boundary') return;
      const m = row.compactMetadata ?? {};
      expected.push({harness,time:row.timestamp,native:row.uuid,before:count(m.preTokens)?m.preTokens:undefined,after:count(m.postTokens)?m.postTokens:undefined,duration:count(m.durationMs)?m.durationMs:undefined,trigger:typeof m.trigger==='string'?m.trigger:undefined});
      return {hits:1,only:[m.preTokens,m.postTokens,m.durationMs].every(count)?1:0};
    }
    const p = row.payload ?? {};
    if (row.type === 'session_meta') { resetCompactionScan(); }
    if (row.type === 'event_msg' && p.type === 'token_count') {
      const input = p.info?.last_token_usage?.input_tokens;
      if (count(input)) { const window = count(p.info?.model_context_window) && p.info.model_context_window > 0 ? p.info.model_context_window : undefined; for (const e of waiting) { e.next=input; e.nextWindow=window; e.nextTime=row.timestamp; } waiting=[]; prior=input; priorWindow=window; priorTime=row.timestamp; }
      return;
    }
    if (row.type !== 'compacted' && !(row.type === 'event_msg' && p.type === 'context_compacted')) return;
    const entry:Expected = {harness,time:row.timestamp,prior,priorWindow,priorTime,encrypted:Array.isArray(p.replacement_history)&&p.replacement_history.some((i:Raw)=>i?.type==='compaction'&&typeof i.encrypted_content==='string'&&i.encrypted_content.length>0)};
    expected.push(entry); waiting.push(entry);
    return {hits:1,only:prior===undefined?0:1};
  },
  verify(p: Projection, found) {
    const boundaries=p.compactions ?? [];
    let exact=0, paired=0, missing=0, encrypted=0;
    for (const c of boundaries) {
      const harness = p.agents.find(a => a.id === c.agentId)?.harness;
      const before=p.context?.readings.find(r=>r.id===c.priorReadingId),after=p.context?.readings.find(r=>r.id===c.nextReadingId),summary=p.compactionSummaries?.find(s=>s.id===c.summaryId);
      const match=expected.some(e=>e.harness===harness&&e.time===c.time&&(harness==='claude-code' ? e.before===c.beforeTokens&&e.after===c.afterTokens&&e.duration===c.durationMs&&e.trigger===c.trigger&&(!summary?.artifactId||e.summaryTime===summary.time) : e.prior===before?.input.tokens&&e.next===after?.input.tokens&&e.priorWindow===before?.window&&e.nextWindow===after?.window&&e.priorTime===before?.time&&e.nextTime===after?.time));
      if(match)exact++;
      if(before&&after)paired++; if(!before)missing++; if(summary?.availability==='encrypted')encrypted++;
    }
    const linked=(p.compactionSummaries??[]).filter(s=>s.boundaryId&&s.artifactId).length,unlinked=(p.compactionSummaries??[]).filter(s=>!s.boundaryId).length;
    return [
      `${boundaries.length} boundaries; ${paired} paired request readings; ${missing} missing prior readings; ${linked} linked summaries; ${unlinked} unlinked summaries; ${encrypted} encrypted summaries`,
      `${boundaries.length===found.hits&&exact===boundaries.length?'PASS':'FAIL'} exact captured boundary counts and metric/neighbor comparisons (${exact} matched)`,
    ];
  },
};
