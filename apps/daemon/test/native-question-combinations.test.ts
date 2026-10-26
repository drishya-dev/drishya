import {expect,it} from 'vitest';
import {inputAnswers,inputSpec} from '../src/native-input.ts';

it('existing Claude input contract accepts explicit options and additional text together in selection order',()=>{
 const spec=inputSpec('claude',{questions:[{question:'Which checks?',multiSelect:true,options:[{label:'Unit tests',description:'Focused checks'},{label:'Typecheck',description:'Validate types'}]}]});
 const literal='  Also check "@decorator", tabs\tand punctuation...\nnext line  ';
 expect(inputAnswers(spec,{q0:{options:['o1','o0'],text:literal}})).toEqual({'Which checks?':['Typecheck','Unit tests',literal.trim()]});
});

it('single-choice contract still refuses combining an option and typed answer',()=>{
 const spec=inputSpec('codex',{questions:[{id:'approach',question:'Which approach?',isOther:true,options:[{label:'Small patch',description:'Focused'}]}]});
 expect(()=>inputAnswers(spec,{q0:{options:['o0'],text:'Other approach'}})).toThrow('Choose an answer for each question.');
});
