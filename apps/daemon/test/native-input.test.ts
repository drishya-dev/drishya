import { expect,it } from 'vitest';
import { inputSpec,inputAnswers } from '../src/native-input.ts';
const raw={questions:[{id:'choice',header:'Approach',question:'Which approach?',isOther:true,isSecret:false,options:[{label:'Small patch',description:'Focused change'},{label:'Refactor',description:'Wider change'}]}]};
it('maps opaque choices back to the exact native question and validates reply shape',()=>{
  const spec=inputSpec('codex',raw);
  expect(inputAnswers(spec,{q0:{options:['o0']}})).toEqual({choice:['Small patch']});
  expect(inputAnswers(spec,{q0:{options:[],text:'Another approach'}})).toEqual({choice:['Another approach']});
  for(const invalid of [{},{q0:{options:['missing']}},{q0:{options:['o0','o1']}},{q0:{options:['o0','o0']}},{q0:{options:['o0']},extra:{options:[]}}])expect(()=>inputAnswers(spec,invalid)).toThrow();
});
it('supports Claude multiple selections and rejects sensitive or unsupported questions',()=>{
  const spec=inputSpec('claude',{questions:[{question:'Which approach?',header:'Approach',multiSelect:true,options:raw.questions[0]!.options}]});
  expect(inputAnswers(spec,{q0:{options:['o0','o1']}})).toEqual({'Which approach?':['Small patch','Refactor']});
  expect(()=>inputSpec('codex',{questions:[{...raw.questions[0],isSecret:true}]})).toThrow('sensitive');
  expect(()=>inputSpec('codex',{questions:[]})).toThrow();
  expect(()=>inputAnswers(spec,{q0:{options:[],text:'sk-proj-abcdefghijklmnopqrstuvw0123456789'}})).toThrow('protected');
  expect(()=>inputSpec('codex',{...raw,questions:[{...raw.questions[0],question:'sk-proj-abcdefghijklmnopqrstuvw0123456789'}]})).toThrow('protected');
});
