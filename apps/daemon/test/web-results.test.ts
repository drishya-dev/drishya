import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Store} from '@drishya/store';
import {seal,type RawObservation} from '@drishya/capture-core';
import {defaultAdapters} from '@drishya/ingest';
import {readWebResult} from '../src/web-results.ts';

let store:Store,dir:string,sequence:number;
const recording='rec_web',source='src_web',cursor={offset:1,generation:0,fingerprint:'fixture'};
beforeEach(()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-web-results-'));store=new Store(dir);sequence=0;
  store.upsertRecording({id:recording,adapterId:'claude-code',harness:'claude-code',sourcePath:join(dir,'never-opened.jsonl')});
  store.upsertSource({id:source,recordingId:recording,path:join(dir,'never-opened.jsonl'),role:'main',cursor});
});
afterEach(()=>{store.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
function append(kind:string,operationId:string,payload:Record<string,unknown>,extras:Partial<RawObservation>={},sourceId=source){
  const raw:RawObservation={part:0,recordId:`record-${sequence++}`,kind,agentId:'agent:main',operationId,sourceTime:'2026-10-30T12:00:00Z',payload,...extras};
  const observation=seal({raw,recordingId:recording,adapter:defaultAdapters()[0]!.descriptor,sourceId,generation:0,byteOffset:sequence,observedAt:'2026-10-30T12:00:00Z'});
  store.appendObservations(recording,source,cursor,[observation]);return observation.id;
}
const call=(id='call')=>append('tool.call',id,{tool:'WebSearch',intent:{kind:'web',query:'Captured query'},input:{query:'Captured query'}});
const result=(text:string,id='call')=>append('tool.result',id,{isError:false,text,outcome:{kind:'web',text}});
describe('sealed web result pages',()=>{
  it('reads full redacted blob-backed material and searches every result before paging',()=>{
    call();const secret='AKIA'+'ABCDEFGHIJKLMNOP';
    const rows=Array.from({length:261},(_,n)=>({url:`https://example.test/${n}`,title:`Captured title ${n}: ${'full context '.repeat(60)} ${n===260?secret:''}`,snippet:`Snippet ${n}`}));
    const id=result(`Before.\nLinks: ${JSON.stringify(rows.slice(0,100))}\nBetween.\nLinks: ${JSON.stringify(rows.slice(100))}\nAfter.`);
    const get=vi.spyOn(store.blobs,'get');const page=readWebResult(store,recording,`${recording}.call`,{start:200,count:500,resultId:id});
    expect(page).toMatchObject({total:261,matched:261,start:200,hasMore:false,availability:'captured',originalComplete:false,query:'Captured query'});
    expect(page.results).toHaveLength(61);expect(page.results[0]!.title).toBe(rows[200]!.title);expect(page.results.at(-1)!.title).not.toContain(secret);
    expect(page.text).toBe('Before.\n\nBetween.\n\nAfter.');expect(Buffer.byteLength(page.original)).toBeLessThanOrEqual(65536);expect(get).toHaveBeenCalled();
    const selected=readWebResult(store,recording,`${recording}.call`,{q:'Snippet 260'});
    expect(selected).toMatchObject({total:261,matched:1,start:0,hasMore:false});expect(selected.results[0]!.url).toBe(rows[260]!.url);
    expect(JSON.stringify(page)).not.toContain(secret);expect(store.getRecording(recording)?.observationCount).toBe(2);
  });
  it('binds exact results to the web call and keeps its first authoritative receipt',()=>{
    call();call('sibling');const sibling=result('Sibling captured result','sibling');
    const first=result('First captured result'),later=result('Later duplicate result');
    expect(readWebResult(store,recording,`${recording}.call`,{resultId:first}).original).toBe('First captured result');
    for(const resultId of [sibling,later,'unknown'])expect(()=>readWebResult(store,recording,`${recording}.call`,{resultId})).toThrow('Invalid web result');
    for(const operation of ['call','rec_other.call',`${recording}.call#0`])expect(()=>readWebResult(store,recording,operation)).toThrow();
    append('tool.call','shell',{tool:'Bash',intent:{kind:'shell',command:'echo Links'},input:{}});result('Links: []','shell');
    expect(()=>readWebResult(store,recording,`${recording}.shell`)).toThrow('Invalid web operation');
  });
  it('does not borrow a sibling-source receipt or invent a result before arrival',()=>{
    call();result('Sibling-only prose','other');append('tool.result','call',{text:'Other source body'}, {}, 'src_sibling');
    expect(readWebResult(store,recording,`${recording}.call`)).toMatchObject({availability:'missing',results:[],text:'',original:''});
    const id=result('Captured returned prose');expect(readWebResult(store,recording,`${recording}.call`,{resultId:id}).original).toBe('Captured returned prose');
  });
  it('uses only the captured web-search item and retains metadata-only absence',()=>{
    const rows=Array.from({length:29},(_,n)=>({url:`https://example.test/${n}`,title:`Complete captured ${n}`}));
    const id=append('item.completed','native-item',{item:'web-search',itemId:'native-item',web:{query:'Native query',results:rows}});
    expect(readWebResult(store,recording,`${recording}.item:${id}`)).toMatchObject({total:29,query:'Native query',text:'',availability:'captured',results:rows});
    const absent=append('item.completed','no-result',{item:'web-search',itemId:'no-result',web:{query:'Only recorded query'}});
    expect(readWebResult(store,recording,`${recording}.item:${absent}`)).toMatchObject({availability:'missing',text:'',original:'',results:[]});
    const empty=append('item.completed','empty-result',{item:'web-search',itemId:'empty-result',web:{query:'Recorded empty query',results:[]}});
    expect(readWebResult(store,recording,`${recording}.item:${empty}`)).toMatchObject({availability:'captured',total:0,text:'',original:''});
    expect(()=>readWebResult(store,recording,`${recording}.item:${id}`,{resultId:id})).toThrow();
  });
  it('reports removed sealed bytes and never treats a blob key as a local path',()=>{
    call();append('tool.result','call',{outcome:{kind:'web',text:{$blob:'0'.repeat(64),bytes:10,preview:'Unavailable original'}}});
    expect(readWebResult(store,recording,`${recording}.call`)).toMatchObject({availability:'removed',originalComplete:false,original:''});
    call('bad-key');append('tool.result','bad-key',{text:{$blob:join(dir,'never-opened.jsonl'),bytes:10,preview:'Never read'}});
    const get=vi.spyOn(store.blobs,'get');expect(readWebResult(store,recording,`${recording}.bad-key`).availability).toBe('removed');expect(get).not.toHaveBeenCalled();
  });
  it('keeps complete structured seeds, inert URLs, empty lists and UTF8 bounds honest',()=>{
    call();append('tool.result','call',{outcome:{kind:'web',results:[{url:'javascript:alert(1)',title:'Exact inert address'}],text:'界'.repeat(30000)}});
    const page=readWebResult(store,recording,`${recording}.call`);
    expect(page.results).toEqual([{url:'javascript:alert(1)',title:'Exact inert address'}]);expect(page.originalComplete).toBe(false);expect(Buffer.byteLength(page.original)).toBeLessThanOrEqual(65536);expect(page.original).not.toContain('\uFFFD');
    call('empty');result('Links: []','empty');expect(readWebResult(store,recording,`${recording}.empty`)).toMatchObject({total:0,availability:'captured',originalComplete:true});
  });
});
