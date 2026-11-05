import {describe,expect,it} from 'vitest';
import {loadNotes,mergeLegacy,notesKey,packetQuestions,readNotes,saveNote,type StepNote} from '../src/lib/step-notes.ts';
import {momentKey,type SavedMoment} from '../src/lib/saved-moments.ts';
import type {ReviewQuestion} from '../src/lib/review-questions.ts';

const moment=(operationId:string,note=''):SavedMoment=>({operationId,sequence:4,title:'Edit total.ts',note});
const question=(operationId:string,text:string,status:ReviewQuestion['status']='open'):ReviewQuestion=>({id:`${operationId}/${text}`,operationId,title:'Edit total.ts',sequence:4,question:text,owner:'Reviewer',status,createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z',sequenceBasis:'timeline-position'});
const note=(operationId:string):StepNote=>({operationId,sequence:1,sequenceBasis:'captured-observation',title:'Read',note:'',owner:'',status:'saved',createdAt:'',updatedAt:''});

describe('one note on a step',()=>{
  it('keeps both kinds of old note, and a step that had both keeps all of its text',()=>{
    const merged=mergeLegacy([moment('a','Keep this'),moment('b')],[question('a','Does this cover zero?'),question('c','Who owns this?','resolved')]);
    expect(merged.map(item=>item.operationId).sort()).toEqual(['a','b','c']);
    const both=merged.find(item=>item.operationId==='a')!;
    expect(both.note).toBe('Keep this\n\nDoes this cover zero?');
    expect(both.status).toBe('open');expect(both.owner).toBe('Reviewer');
    expect(merged.find(item=>item.operationId==='b')!.status).toBe('saved');
    expect(merged.find(item=>item.operationId==='c')!.status).toBe('resolved');
  });
  it('an open question on a step wins over a resolved one, and repeated text stays once',()=>{
    const [item]=mergeLegacy([],[question('a','Same text','resolved'),question('a','Same text')]);
    expect(item!.status).toBe('open');expect(item!.note).toBe('Same text');
  });
  it('reads the old stores until the first save, then only the new list, leaving the old ones in place',()=>{
    const store=new Map([[momentKey('daemon','r'),JSON.stringify([moment('a','Old')])]]);
    const read=(key:string)=>store.get(key)??null;
    expect(loadNotes(read,'daemon','r')[0]!.note).toBe('Old');
    store.set(notesKey('daemon','r'),JSON.stringify([]));
    expect(loadNotes(read,'daemon','r')).toEqual([]);
    expect(store.has(momentKey('daemon','r'))).toBe(true);
  });
  it('has one note per step, redacts, bounds and refuses a store that is not a list',()=>{
    expect(readNotes(JSON.stringify([note('a'),note('a')]))).toHaveLength(1);
    expect(readNotes(JSON.stringify([{...note('a'),note:'token sk-proj-abcdefghijklmnopqrstuvw0123456789'}]))[0]!.note).not.toContain('abcdefghijklmnop');
    expect(readNotes('{}')).toEqual([]);
    const full=Array.from({length:150},(_,index)=>note(`op-${index}`));
    expect(()=>saveNote(full,note('another'))).toThrow('150 notes');
    expect(saveNote(full,{...note('op-3'),title:'Replaced'})).toHaveLength(150);
  });
  it('sends only notes that need or needed following up to the packet as questions',()=>{
    const out=packetQuestions([note('a'),{...note('b'),status:'open',note:'Check'},{...note('c'),status:'resolved'}]);
    expect(out.map(item=>[item.operationId,item.status])).toEqual([['b','open'],['c','resolved']]);
    expect(out[0]!.question).toBe('Check');
  });
});
