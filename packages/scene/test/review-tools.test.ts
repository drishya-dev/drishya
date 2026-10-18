import { expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { buildReviewIndex, pageReview, reviewRules } from '../src/review-tools.ts';
const command = (id: string, sequence: number, agentId = 'agent', cwd = '/repo'): Operation => ({ id, agentId, startSequence: sequence, kind: 'shell', tool: 'exec_command', title: id, status: 'error', paths: [], detail: { kind: 'shell', command: 'git reset --hard', exitCode: 1 }, artifactIds: [], observationIds: [`obs-${id}`], origin: { type: 'native', tool: 'exec_command' }, titleProvenance: { kind: 'derived', rule: 'fixture', observationIds: [] }, classification: { kind: 'derived', rule: 'fixture', observationIds: [] }, ...{ cwd } } as Operation);
const projection = (operations: Operation[]): Projection => ({ recordingId: 'fixture', operations, prose: [], artifacts: [], timeline: [{ type: 'turn', id: 'prompt', agentId: 'agent', sequence: 0, prompt: 'Check this', time: '2026-10-18T00:00:00Z' }, { type: 'op-start', id: 'start', agentId: 'agent', sequence: 1, operationId: 'one' }, { type: 'turn', id: 'next', agentId: 'agent', sequence: 9, prompt: 'Next', time: '2026-10-18T00:01:00Z' }], files: [], gaps: [], agents: [], links: [], passages: [], capabilities: {}, reducerVersion: 'fixture', observationCount: 20, lastSequence: 19, harnesses: ['codex'] });
const inspect = (op: Operation) => ({ text: op.detail.kind === 'shell' ? op.detail.command : '', complete: true, exitCode: op.detail.kind === 'shell' ? op.detail.exitCode ?? undefined : undefined, cwd: (op as Operation & {
        cwd: string;
    }).cwd, cwdBasis: 'captured' as const, durationBasis: 'unknown' as const });
it('builds exact-evidence findings, contextual command groups and per-agent prompt summaries', () => {
    const operations = [command('one', 1), command('two', 1), command('three', 1), command('different', 1, 'agent', '/other'), command('helper', 1, 'helper')];
    operations[0]!.endSequence = 20;
    const index = buildReviewIndex(projection(operations), inspect, text => text);
    expect(index.commands).toHaveLength(5);
    expect(index.findings).toHaveLength(5);
    expect(index.findings[0]!.text.slice(index.findings[0]!.start, index.findings[0]!.end)).toBe('git reset --hard');
    expect(index.repeats).toHaveLength(1);
    expect(index.repeats[0]!.operationIds).toEqual(['one', 'two', 'three']);
    expect(index.repeats[0]!.label).not.toMatch(/stuck|no progress|wasting/i);
    expect(index.turns[0]).toMatchObject({ operations: 4, failures: 4, intervalMs: 60000 });
    expect(index.turns[1]).toMatchObject({ operations: 0 });
    expect(index.turns[1]!.intervalMs).toBeUndefined();
    expect(index.turns[2]).toMatchObject({ id: 'unassigned', operations: 1 });
    expect(pageReview(index, { section: 'commands', start: 1, count: 2, status: 'failed' }, 'rev')).toMatchObject({ total: 5, start: 1, items: [{ id: 'two' }, { id: 'three' }] });
});
it('does not invent intervals or merge incomplete commands, and matches changed test lines only', () => {
    const op = command('edit', 1);
    op.kind = 'edit';
    op.detail = { kind: 'edit', path: 'pnpm-lock.yaml', created: false, reconstruction: 'partial', hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: [' unchanged.skip()', '+it.only("case")'] }] };
    op.paths = [{ path: 'pnpm-lock.yaml', role: 'write', basis: 'captured' }];
    const p = projection([op]);
    p.timeline.forEach(item => { item.time = undefined; });
    const result = buildReviewIndex(p, inspect, text => text);
    expect(result.findings.map(f => f.rule)).toEqual(['lockfile', 'test-marker']);
    expect(result.findings[1]!.text).toBe('+it.only("case")');
    expect(result.turns.every(turn => turn.intervalMs === undefined)).toBe(true);
});
it('validates bounded JSON literals/globs and rejects executable, duplicate or oversized rules', () => {
    expect(reviewRules([{ id: 'vendor', target: 'path', mode: 'glob', pattern: 'vendor/*' }])).toHaveLength(1);
    for (const input of [[{ id: 'bad', target: 'path', mode: 'regex', pattern: '.*' }], [{ id: 'bad', target: 'path', mode: 'literal', pattern: 'x', execute: 'bad' }], Array(33).fill({}), [{ id: 'same', target: 'path', mode: 'literal', pattern: 'x' }, { id: 'same', target: 'path', mode: 'literal', pattern: 'x' }]])
        expect(() => reviewRules(input)).toThrow();
});
it('covers literal command/path rules without treating ordinary commands or unchanged context as hits',()=>{
  for(const [text,rule]of [['git push origin main --force','force-push'],['git reset --hard HEAD','hard-reset'],['rm -rf build','recursive-delete'],['Remove-Item build -Recurse','recursive-delete'],['pnpm publish','package-publish']]){
    const op=command('rule',1);op.detail={kind:'shell',command:text!,exitCode:0};
    expect(buildReviewIndex(projection([op]),inspect,text=>text).findings.map(hit=>hit.rule)).toContain(rule);
  }
  for(const [path,rule]of [['.github/workflows/ci.yml','ci-path'],['src/auth/session.ts','auth-path'],['db/migrations/001.sql','migration-path'],['pnpm-lock.yaml','lockfile']]){
    const op=command('path',1);op.detail={kind:'other',input:undefined};op.kind='write';op.paths=[{path:path!,role:'write',basis:'captured'}];
    expect(buildReviewIndex(projection([op]),inspect,text=>text).findings.map(hit=>hit.rule)).toContain(rule);
  }
  const ordinary=command('ordinary',1);ordinary.detail={kind:'shell',command:'git status --short',exitCode:0};
  expect(buildReviewIndex(projection([ordinary]),inspect,text=>text).findings).toEqual([]);
  const incomplete=buildReviewIndex(projection([command('a',1),command('b',1),command('c',1)]),op=>({...inspect(op),complete:false}),text=>text);
  expect(incomplete.repeats).toEqual([]);
});
