import {askQuestions,isQuestionTool} from '../../apps/ui/src/lib/ask-question.ts';
import type {RealCase} from './types.ts';

/** Genuine question calls only. Duplicate AgentMessage metadata is not a second question. */
export const questions:RealCase={
 name:'questions',about:'Native Claude and Codex questions with captured offered options and literal answers',
 harnesses:['claude-code','codex'],prefilter:{'claude-code':'AskUserQuestion',codex:'request_user_input'},
 scan(row,harness){
  if(harness==='codex'){
   const p=row.payload as Record<string,unknown>|undefined;
   if(row.type!=='response_item'||p?.type!=='function_call'||!isQuestionTool(p.name))return;
   try{const q=JSON.parse(String(p.arguments));const count=askQuestions(q).length;return count?{hits:count}:undefined;}catch{return;}
  }
  const content=(row.message as {content?:unknown})?.content;
  if(!Array.isArray(content))return;
  const hits=content.reduce((n,b)=>n+(b?.type==='tool_use'&&b.name==='AskUserQuestion'?askQuestions(b.input).length:0),0);
  return hits?{hits}:undefined;
 },
 verify(projection,found){
  const ops=projection.operations.filter(op=>isQuestionTool(op.tool)&&op.detail.kind==='other');
  const displayed=ops.flatMap(op=>op.detail.kind==='other'?askQuestions(op.detail.input,op.detail.resultPreview):[]);
  return[`${found.hits>0&&!displayed.length?'FAIL ':''}${found.hits} native questions; ${displayed.length} projected question cards; ${displayed.reduce((n,q)=>n+q.options.length,0)} offered options; ${displayed.filter(q=>q.answer).length} literal answers (accepted acknowledgements are not answers)`];
 }
};
