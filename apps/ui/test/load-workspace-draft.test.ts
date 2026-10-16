import {describe,expect,it} from 'vitest';
import {loadWorkspaceDraft} from '../src/lib/load-workspace-draft.ts';
import type {CurrentFile} from '../src/api.ts';
const page=(text:string,start:number,totalLines:number,hasMore:boolean,modifiedAt='v1'):CurrentFile=>({path:'file.ts',scope:'current-workspace',text,start,totalLines,returnedLines:text.split('\n').length,hasMore,redacted:false,modifiedAt});
describe('complete stable workspace draft loading',()=>{
 it('reads the current full file until exhaustion, including growth before draft loading',async()=>{const lines=Array.from({length:600},(_,i)=>`line ${i}`), starts:number[]=[];const result=await loadWorkspaceDraft(async start=>{starts.push(start);return page(lines.slice(start,start+200).join('\n'),start,600,start+200<600);});expect(starts).toEqual([0,200,400]);expect(result.base).toBe(lines.join('\n'));});
 it('preserves CRLF, BOM and final newline exactly',async()=>{const text='\ufeffone\r\ntwo\r\n';expect((await loadWorkspaceDraft(async()=>page(text,0,3,false))).base).toBe(text);});
 it('rejects a mid-read version or line-count change',async()=>{for(const changed of [page('end',200,201,false,'v2'),page('end',200,202,false)]){await expect(loadWorkspaceDraft(async start=>start===0?page(Array(200).fill('a').join('\n'),0,201,true):changed)).rejects.toThrow('File changed');}});
 it('rejects gaps, false completion and redacted text',async()=>{await expect(loadWorkspaceDraft(async()=>page('only one',0,2,false))).rejects.toThrow('Incomplete');await expect(loadWorkspaceDraft(async()=>page('line',1,1,false))).rejects.toThrow('Incomplete');await expect(loadWorkspaceDraft(async()=>({...page('secret',0,1,false),redacted:true}))).rejects.toThrow('Redacted');});
});
