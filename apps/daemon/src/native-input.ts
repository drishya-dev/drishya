import { sanitize } from '@drishya/privacy';
import { HttpError } from './app.ts';

import type { NativeQuestion } from './native-input-types.ts';
export type { NativeInputRequest } from './native-input-types.ts';
export interface InputSpec {questions:NativeQuestion[];keys:string[];input:Record<string,unknown>}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;

/** These are supported native requests, not questions inferred from captured prose. */
export function inputSpec(method:'codex'|'claude',raw:unknown):InputSpec {
  if(!object(raw)||JSON.stringify(raw).length>16000||JSON.stringify(sanitize(raw).value)!==JSON.stringify(raw))throw new Error('This input request contains protected or oversized content. Continue in the native harness.');
  if(!Array.isArray(raw.questions)||raw.questions.length<1||raw.questions.length>4)throw new Error('Unsupported input question count; continue in the native harness.');
  const keys:string[]=[];
  const questions=raw.questions.map((q,index):NativeQuestion=>{
    if(!object(q))throw new Error('Unsupported input question; continue in the native harness.');
    const questionText = (q.question ?? q.title) as string | undefined;
    if(!object(q)||!text(questionText,4000)||q.isSecret===true)throw new Error('Unsupported or sensitive input request; continue in the native harness.');
    const key=method==='codex'?q.id:questionText;
    if(!text(key,4000)||keys.includes(key as string))throw new Error('Invalid native question identity.');keys.push(key as string);
    const options=q.options??[];
    if(!Array.isArray(options)||options.length>8)throw new Error('Unsupported native question options.');
    return {id:`q${index}`,header:typeof q.header==='string'?q.header.slice(0,200):'Question',question:questionText as string,multiple:method==='claude'&&q.multiSelect===true,allowText:method==='claude'||!options.length||q.isOther===true,options:options.map((option,i)=>{
      if (typeof option === 'string') {
        if (!text(option, 1000)) throw new Error('Unsupported native answer option.');
        return { id: `o${i}`, label: option, description: '' };
      }
      if(!object(option)||!text(option.label,1000)||(option.description !== undefined && (typeof option.description!=='string'||option.description.length>2000)))throw new Error('Unsupported native answer option.');
      return {id:`o${i}`,label:option.label as string,description:typeof option.description === 'string' ? option.description : ''};
    })};
  });
  return {questions,keys,input:raw};
}

/** Validate against the exact pending request; arbitrary answers cannot approve tools. */
export function inputAnswers(spec:InputSpec,raw:unknown) {
  if(!object(raw)||Object.keys(raw).length!==spec.questions.length)throw new HttpError(400,'Answer every pending question.');
  const answers:Record<string,string[]>=Object.create(null);
  for(const [index,question] of spec.questions.entries()) {
    const answer=raw[question.id];
    if(!object(answer)||!Array.isArray(answer.options)||answer.options.length>8||new Set(answer.options).size!==answer.options.length)throw new HttpError(400,'Invalid answer selections.');
    const custom=typeof answer.text==='string'?answer.text.trim():'';
    if(custom.length>4000||custom&&!question.allowText||JSON.stringify(sanitize(custom).value)!==JSON.stringify(custom))throw new HttpError(400,'This reply is unsupported or contains protected text. Remove sensitive content before answering.');
    if((custom?1:0)+answer.options.length<1||!question.multiple&&(custom?1:0)+answer.options.length>1)throw new HttpError(400,'Choose an answer for each question.');
    const selected=answer.options.map(id=>{const option=question.options.find(option=>option.id===id);if(!option)throw new HttpError(400,'Choose one of the current answer options.');return option.label;});
    answers[spec.keys[index]!]=custom?[...selected,custom]:selected;
  }
  return answers;
}
