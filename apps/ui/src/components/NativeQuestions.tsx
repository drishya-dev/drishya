import { useId, useState } from 'react';
import type { NativeInputRequest } from '../../../daemon/src/native-input-types.ts';

export function NativeQuestions({request,busy,answer,stop}:{request:NativeInputRequest;busy:boolean;answer:(answers:Record<string,{options:string[];text?:string}>)=>void;stop:()=>void}) {
  const name=useId(),[answers,setAnswers]=useState<Record<string,{options:string[];text?:string}>>({});
  const complete=request.questions.every(q=>!!answers[q.id]?.options.length||!!answers[q.id]?.text?.trim());
  return <form className="native-questions" aria-label="Agent needs your input" onSubmit={e=>{e.preventDefault();if(complete&&!busy)answer(answers);}}>
    <header><strong>Answer requested</strong><span>The connected agent is waiting</span></header>
    <div className="native-question-list">{request.questions.map(q=><fieldset key={q.id} disabled={busy}><legend>{q.question}</legend>
      {q.options.map(option=><label className="native-answer-option" key={option.id}><input type={q.multiple?'checkbox':'radio'} name={`${name}/${q.id}`} checked={answers[q.id]?.options.includes(option.id)??false} onChange={e=>setAnswers(old=>({...old,[q.id]:{options:q.multiple?e.target.checked?[...(old[q.id]?.options??[]),option.id]:(old[q.id]?.options??[]).filter(id=>id!==option.id):[option.id],text:q.multiple?old[q.id]?.text??'':''}}))}/><span>{option.label}<small>{option.description}</small></span></label>)}
      {q.allowText&&<label className="native-answer-text">{q.options.length?q.multiple?'Add your own answer (optional)':'Or write your answer':'Your answer'}<textarea rows={2} maxLength={4000} aria-label={`Answer: ${q.question}`} value={answers[q.id]?.text??''} onChange={e=>setAnswers(old=>({...old,[q.id]:{options:q.multiple?old[q.id]?.options??[]:[],text:e.target.value}}))}/></label>}
    </fieldset>)}</div>
    <footer><button type="button" className="btn ghost" disabled={busy} onClick={stop}>Stop turn</button><button className="btn" disabled={busy||!complete}>Send answer</button></footer>
  </form>;
}
