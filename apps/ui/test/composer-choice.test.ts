import {expect,it} from 'vitest';
import {workingLocations} from '../../../packages/contracts/src/working-locations.ts';

const kept=(value:unknown)=>workingLocations({version:1,sessions:[{id:'rec_test',entries:[['composer/choice',value]]}]}).sessions[0]?.entries.map(([key])=>key)??[];

it('persists only the three composer choices, so an idle composer can default to its pill',()=>{
  for(const choice of ['auto','open','closed'])expect(kept(choice)).toEqual(['composer/choice']);
  for(const bad of ['collapsed','',true,1,null,{}])expect(kept(bad)).toEqual([]);
});

it('keeps the older collapsed flag valid so existing saved sessions still load',()=>{
  const entries=workingLocations({version:1,sessions:[{id:'rec_old',entries:[['composer/collapsed',false],['toolbox/collapsed',true]]}]}).sessions[0]!.entries;
  expect(entries).toEqual([['composer/collapsed',false],['toolbox/collapsed',true]]);
});
