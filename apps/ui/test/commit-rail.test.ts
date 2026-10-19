import {it,expect} from 'vitest';
import {commitRail} from '../src/lib/commit-rail.ts';

it('keeps actual fork/merge parent lanes connected without implying temporal causality',()=>{
  const graph=commitRail([{hash:'merge',parents:['main','feature']},{hash:'feature',parents:['root']},{hash:'main',parents:['root']},{hash:'root',parents:[]}]);
  expect(graph.rows[0]!.segments.filter(edge=>edge.start===.5).map(edge=>edge.to)).toEqual([0,1]);
  expect(graph.rows[1]!.lane).toBe(1);expect(graph.rows[2]!.lane).toBe(0);expect(graph.rows[2]!.segments).toContainEqual({from:0,to:1,start:.5,end:1});expect(graph.rows[3]!.lane).toBe(1);expect(graph.continuations).toBe(0);
});
it('retains off-page continuations and omits excess topology rather than joining unrelated parents',()=>{
  const graph=commitRail([{hash:'merge',parents:Array.from({length:30},(_,n)=>`parent-${n}`)}],4);
  expect(graph.rows[0]!.hidden).toBe(26);expect(graph.rows[0]!.segments.filter(edge=>edge.start===.5)).toHaveLength(4);expect(graph.continuations).toBe(4);expect(graph.lanes).toBe(4);
  expect(commitRail([])).toEqual({rows:[],lanes:1,continuations:0});
});
