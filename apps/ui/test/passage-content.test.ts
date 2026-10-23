import { expect, test } from 'vitest';
import { passageItems, samePassageContent, type PassageContent } from '../src/lib/passage-content.ts';

const content=()=>({
  artifacts:new Map([['artifact',{id:'artifact',blob:'old'}]]),
  ps:{id:'passage',agentId:'agent',ops:[{id:'op'}],prose:[{id:'prose'}],notices:[{id:'notice'}],settled:true,matchesFilter:true},
  ops:new Map([['op',{id:'op',detail:{kind:'shell',command:'invented command'},status:'ok',artifactIds:['artifact']}]]),
  prose:new Map([['prose',{id:'prose',text:'invented prose'}]]),notices:new Map([['notice',{id:'notice',snippet:'invented notice'}]]),
  agent:{id:'agent',harness:'codex',label:'Codex',firstSequence:0,lastSequence:20},
  agents:[{id:'agent',harness:'codex',label:'Codex',firstSequence:0,lastSequence:20}],focus:false,foldable:true,folded:false,
} as unknown as PassageContent);
const copy=(x:PassageContent)=>structuredClone(x);

test('fresh page objects and unrelated new cards preserve passage content identity',()=>{
  const a=content(),b=copy(a);
  expect(a.ps).not.toBe(b.ps);expect(samePassageContent(a,b)).toBe(true);
  b.ops.set('unrelated',{id:'unrelated'} as never);
  b.agent!.lastSequence++;b.agents[0]!.lastSequence++;
  expect(samePassageContent(a,b)).toBe(true);
});

test('every referenced captured field and passage presentation change invalidates memoization',()=>{
  const edits:((b:PassageContent)=>void)[]=[
    b=>{b.ps.id='different';},b=>{b.ps.settled=false;},b=>{b.ps.matchesFilter=false;},
    b=>{b.ps.ops.push({id:'new'} as never);},b=>{b.ops.get('op')!.status='error';},
    b=>{b.artifacts.get('artifact')!.blob='changed';},b=>{b.artifacts.delete('artifact');},
    b=>{b.ops.get('op')!.artifactIds.push('changed');},b=>{b.ops.delete('op');},
    b=>{b.prose.get('prose')!.text='changed';},b=>{b.notices.get('notice')!.snippet='changed';},
    b=>{b.focus=true;},b=>{b.folded=true;},b=>{b.foldable=false;},b=>{b.onFold=()=>{};},
    b=>{b.agent!.label='Renamed agent';},b=>{b.agent!.harness='claude-code';},
    b=>{b.agents.push({...b.agents[0]!,id:'second'});},
  ];
  for(const edit of edits){const a=content(),b=copy(a);edit(b);expect(samePassageContent(a,b)).toBe(false);}
});

test('sibling changes preserve the existing agent color contract',()=>{
  const a=content();a.agent!.parentId='parent';a.agents=[a.agent!,{...a.agent!,id:'sibling'}];
  const b=copy(a);b.agents.reverse();expect(samePassageContent(a,b)).toBe(false);
});

test('memo props retain only the passage evidence, never an entire older page',()=>{
  const selected={id:'selected'},unrelated={id:'other'};
  const page=new Map([['selected',selected],['other',unrelated]]);
  const scoped=passageItems([{id:'selected'},{id:'missing'}],page);
  expect([...scoped]).toEqual([['selected',selected]]);
  expect(scoped.get('selected')).toBe(selected);
  expect(scoped).not.toBe(page);
});
