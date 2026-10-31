import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {ReplayBundle,OperationDetail} from '../../../packages/contracts/src/index.ts';
export const paritySurfaces=['read','edit','search','test','plan','delegation','question','process','unknown-mcp','orchestration','truncated','missing'] as const;
export type ParitySurface=typeof paritySurfaces[number];
/** Synthetic presentation corpus only. Never stands in for genuine harness acceptance. */
export function parityFixture(surface:ParitySurface){
 const bundle=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')) as ReplayBundle;
 const op=bundle.projection.operations.find(op=>op.kind==='mcp')!;
 op.artifactIds=[];op.paths=[];op.title=`Parity ${surface}`;op.tool=`fixture_${surface}`;op.origin={type:'native',tool:op.tool};
 let detail:OperationDetail;
 switch(surface){
  case 'read':{
   const id='parity-captured-source',text=Array.from({length:620},(_,i)=>`export const captured${i+1} = ${i+1};`).join('\n');
   bundle.artifactText[id]=text;bundle.projection.artifacts.push({id,kind:'excerpt',path:'src/captured.ts',range:{start:1,end:620},totalLines:620,observedAtSequence:op.endSequence!,bytes:Buffer.byteLength(text),lineCount:620,availability:'partial',provenance:{kind:'captured',observationIds:[]},redacted:false});op.artifactIds=[id];
   detail={kind:'read',path:'src/captured.ts',startLine:1,lineCount:620,totalLines:620,excerptArtifactId:id};break;
  }
  case 'edit':detail={kind:'edit',path:'src/captured.ts',created:false,reconstruction:'partial',reconstructionNote:'Only this captured patch is available.',hunks:Array.from({length:160},(_,i)=>({oldStart:i+1,oldLines:1,newStart:i+1,newLines:1,lines:[`-const before${i+1} = false;`,`+const after${i+1} = true;`]}))};break;
  case 'search':detail={kind:'search',query:'captured-match',mode:'text',total:123,hits:Array.from({length:123},(_,i)=>({path:`src/module-${i+1}.ts`,line:i+1,text:`captured-match ${i+1}`}))};break;
  case 'test':detail={kind:'test',command:'fixture test',exitCode:1,outputPreview:'FAILED test/captured.test.ts::captured_case - AssertionError: literal captured failure\n1 failed, 2 passed in 0.02s',summary:{framework:'pytest',passed:2,failed:1,skipped:0,failures:[{name:'captured_case',message:'literal captured failure'}],basis:'derived'}};break;
  case 'plan':detail={kind:'plan',items:Array.from({length:80},(_,i)=>({text:`Captured step ${i+1}`,status:i===0?'completed':i===1?'in_progress':'pending'}))};break;
  case 'delegation':detail={kind:'spawn',agentType:'worker',description:'Captured delegated task',descriptionEncrypted:false,resultPreview:'{"task_name":"fixture-worker"}'};break;
  case 'question':op.tool='AskUserQuestion';detail={kind:'other',input:{questions:[{header:'Scope',question:'Which captured area should be checked?',multiSelect:false,options:[{label:'Captured source',description:'Keep the recorded source range'},{label:'Captured tests',description:'Keep the recorded test outcome'}]}]}};break;
  case 'process':op.tool='exec';detail={kind:'shell',command:'fixture process',outputPreview:JSON.stringify({output:'Captured process started\nStill waiting for a recorded outcome',session_id:731,exit_code:null,chunk_id:'synthetic-progress'})};break;
  case 'unknown-mcp':detail={kind:'mcp',server:'unrecognized',tool:'opaque_records',input:{literal:'input'},resultPreview:JSON.stringify({content:[{type:'text',text:'Captured mixed sibling'},{type:'resource_link',uri:'https://example.invalid/report',name:'Captured reference'},{type:'opaque',payload:'Unknown sibling retained'}],structuredContent:{records:[{id:1,amount:2},{id:2,amount:3}]}})};break;
  case 'orchestration':op.tool='exec';detail={kind:'shell',command:'literal captured orchestration',outputPreview:JSON.stringify([{status:'fulfilled',value:{output:'{"items":[{"literal":42}]}',exit_code:0}},{status:'rejected',reason:'Captured sibling failed'}])};break;
  case 'truncated':detail={kind:'other',input:{literal:'input'},resultPreview:'{"items":[{"literal":"captured incomplete source"'};break;
  case 'missing':detail={kind:'other',input:{literal:'input'}};break;
 }
 op.detail=detail;op.kind=detail.kind;op.origin=detail.kind==='mcp'?{type:'mcp',server:detail.server,tool:detail.tool}:{type:'native',tool:op.tool};
 return {bundle,opId:op.id,surface};
}
export function parityExchange(form:'mcp'|'native',balance:'large-input'|'large-output'|'error'|'empty'){
 const fixture=parityFixture('unknown-mcp'),op=fixture.bundle.projection.operations.find(op=>op.id===fixture.opId)!;
 const input=balance==='large-input'?JSON.stringify(Object.fromEntries(Array.from({length:95},(_,i)=>[`field_${i}`,`Literal captured argument ${i} ${'x'.repeat(80)}`])),null,2):'{"limit":1200}';
 const output=balance==='large-output'?JSON.stringify({items:Array.from({length:1200},(_,i)=>({id:i,label:`captured-record-${i}`,nested:{literal:true},...(i===1199?{late:'last captured field'}:{})}))}):balance==='error'?'Captured error result\nAssertionError: literal failure':balance==='empty'?'':'SHORT CAPTURED RESULT';
 op.status=balance==='error'?'error':'ok';op.kind=form==='mcp'?'mcp':'other';op.tool=form==='mcp'?'mcp__unknown__opaque':'fixture_native';op.origin=form==='mcp'?{type:'mcp',server:'unknown',tool:'opaque'}:{type:'native',tool:op.tool};op.detail=form==='mcp'?{kind:'mcp',server:'unknown',tool:'opaque',input,resultPreview:output}:{kind:'other',input,resultPreview:output};
 return {...fixture,input,output};
}
