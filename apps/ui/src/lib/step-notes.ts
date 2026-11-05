import {redactText} from '../../../../packages/privacy/src/index.ts';
import {momentKey,readMoments,type SavedMoment} from './saved-moments.ts';
import {readQuestions,type ReviewQuestion} from './review-questions.ts';

/** A reader's one note on a step. `open` still needs following up; `saved` is a note or a bookmark. */
export interface StepNote {operationId:string;sequence:number;sequenceBasis:'captured-observation'|'timeline-position';title:string;note:string;owner:string;status:'saved'|'open'|'resolved';createdAt:string;updatedAt:string}
const LIMIT=150,TEXT=3000;
export const notesKey=(kind:string,id:string)=>`drishya-step-notes-v1:${kind}:${id}`;
const questionsKey=(kind:string,id:string)=>`drishya-review-questions-v1:${kind}:${id}`;
const clean=(text:string,limit:number)=>redactText(text.slice(0,limit)).text;

export function readNotes(raw:string):StepNote[] {
  if(raw.length>512*1024)return [];
  try {
    const items:unknown=JSON.parse(raw);if(!Array.isArray(items))return [];
    const seen=new Set<string>();
    return items.slice(-LIMIT).flatMap(item=>{
      if(!item||typeof item.operationId!=='string'||item.operationId.length>512||seen.has(item.operationId)||!Number.isSafeInteger(item.sequence)||item.sequence<0||typeof item.title!=='string'||typeof item.note!=='string')return [];
      seen.add(item.operationId);
      return [{operationId:item.operationId,sequence:item.sequence,sequenceBasis:item.sequenceBasis==='timeline-position'?'timeline-position' as const:'captured-observation' as const,title:clean(item.title,240),note:clean(item.note,TEXT),owner:clean(typeof item.owner==='string'?item.owner:'',80),status:item.status==='open'||item.status==='resolved'?item.status:'saved' as StepNote['status'],createdAt:typeof item.createdAt==='string'?item.createdAt.slice(0,40):'',updatedAt:typeof item.updatedAt==='string'?item.updatedAt.slice(0,40):''}];
    });
  }catch{return [];}
}
export function saveNote(items:StepNote[],next:StepNote) {
  if(items.length>=LIMIT&&!items.some(item=>item.operationId===next.operationId))throw new Error(`${LIMIT} notes are saved. Remove one before adding another.`);
  return readNotes(JSON.stringify([...items.filter(item=>item.operationId!==next.operationId),next]));
}

/** Saved moments and review questions were two stores for one thing; a step that had both keeps all of its text. */
export function mergeLegacy(moments:SavedMoment[],questions:ReviewQuestion[]):StepNote[] {
  const notes=new Map<string,StepNote>();
  for(const moment of moments)notes.set(moment.operationId,{...moment,sequenceBasis:'captured-observation',owner:'',status:'saved',createdAt:'',updatedAt:''});
  for(const question of questions){
    const held=notes.get(question.operationId);
    notes.set(question.operationId,{
      operationId:question.operationId,title:held?.title||question.title,sequence:held?.sequence??question.sequence,sequenceBasis:held?.sequenceBasis??question.sequenceBasis??'timeline-position',
      note:[...new Set([held?.note,question.question].filter(Boolean))].join('\n\n'),owner:held?.owner||question.owner,
      status:held?.status==='open'||question.status==='open'?'open':'resolved',createdAt:held?.createdAt||question.createdAt,updatedAt:question.updatedAt,
    });
  }
  return readNotes(JSON.stringify([...notes.values()]));
}
/** The older stores stay as they are: nothing is deleted, and the first save writes the merged list. */
export function loadNotes(read:(key:string)=>string|null,kind:string,id:string):StepNote[] {
  const saved=read(notesKey(kind,id));
  return saved!==null?readNotes(saved):mergeLegacy(readMoments(read(momentKey(kind,id))??'[]'),readQuestions(read(questionsKey(kind,id))??'[]'));
}
/** The review packet reports notes that need or needed following up as questions. */
export const packetQuestions=(notes:StepNote[]):ReviewQuestion[]=>notes.filter(note=>note.status!=='saved').map(note=>({id:note.operationId.slice(-64),operationId:note.operationId,title:note.title,sequence:note.sequence,sequenceBasis:note.sequenceBasis,question:note.note,owner:note.owner,status:note.status==='open'?'open':'resolved',createdAt:note.createdAt,updatedAt:note.updatedAt}));
