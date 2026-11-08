import {expect,it} from 'vitest';
import type {Projection} from '@drishya/contracts';
import type {Scene} from '@drishya/scene';
import {searchDestination} from '../src/lib/search-destination.ts';
const projection={operations:[{id:'op-one',startSequence:8,observationIds:['call-one','result-one']}],prose:[{id:'prose-one',sequence:12,observationIds:['assistant-one']}],timeline:[{type:'turn',id:'turn_prompt-one'}]} as Projection;
it('resolves a tool receipt, prose and a prompt by exact captured identity',()=>{
 expect(searchDestination(projection,'result-one')).toEqual({kind:'operation',id:'op-one',step:9});
 expect(searchDestination(projection,'assistant-one')).toEqual({kind:'prose',step:13});
 expect(searchDestination(projection,'prompt-one')).toEqual({kind:'prompt',step:1});
});
it('resolves an unloaded prompt from bounded scene metadata, never its ordinal or text',()=>{
 const page={...projection,timeline:[]};
 const scene={passages:[{id:'passage-one',turnId:'turn_older-prompt',turnStep:256,turnPrompt:'Same words',unloaded:true}]} as Scene;
 expect(searchDestination(page,'older-prompt',scene)).toEqual({kind:'prompt',step:257});
 expect(searchDestination(page,'unrecorded-prompt',scene)).toBeUndefined();
});
