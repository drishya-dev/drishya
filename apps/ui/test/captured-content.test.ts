import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {capturedContent} from '../src/lib/captured-content.ts';
import {StructuredResult} from '../src/components/StructuredResult.tsx';
import {ToolInput} from '../src/components/ToolInput.tsx';

it('offers all applicable modes for mixed native and MCP material without dropping siblings',()=>{
 const text=JSON.stringify({content:[{type:'text',text:'a,b\n1,2'},{type:'resource_link',uri:'resource://report',name:'Report'},{type:'text',text:'Sibling'}]});
 const result=capturedContent(text);expect(result.json).toBe(true);expect(result.delimited).toEqual([{field:'/content/0/text',text:'a,b\n1,2'}]);expect(result.resources?.items[0]?.uri).toBe('resource://report');expect(result.documents?.items).toHaveLength(2);expect(result.data[0]?.text).toBe(text);
 const native=capturedContent(JSON.stringify({output:'a,b\n1,2',exit_code:0}));expect(native.json).toBe(true);expect(native.delimited).toHaveLength(1);
});
it('keeps candidate hints distinct from validity and reports bounded-out inspection',()=>{
 expect(capturedContent('{incomplete').json).toBe(true);
 expect(capturedContent('plain prose')).toMatchObject({json:false,data:[],delimited:[],resources:undefined,documents:undefined,limited:false});
 expect(capturedContent('界'.repeat(90000))).toMatchObject({json:false,data:[],delimited:[],limited:true});
 expect(capturedContent('https://example.org').resources).toBeUndefined();
});
it('prefers sealed MIME and content fields, even for malformed or scalar JSON',()=>{
 const raw=JSON.stringify({content:[{type:'text',mimeType:'Application/Problem+Json; charset=UTF-8',text:'incomplete'},{type:'text',mimeType:'text/csv',text:'a,b'},{type:'text',text:'{"ok":true}'},{type:'image',mimeType:'image/png',data:'not decoded'}]});
 const result=capturedContent(raw);expect(result.data.map(item=>item.field)).toEqual(['Whole captured result','/content/0/text','/content/2/text']);expect(result.data[1]?.text).toBe('incomplete');expect(result.delimited).toEqual([{field:'/content/1/text',text:'a,b'}]);
 expect(capturedContent('null',{mime:'application/json'}).json).toBe(true);
 expect(capturedContent(JSON.stringify({mimeType:'application/json',text:'42'})).data[1]?.text).toBe('42');
});
it('native, MCP and fulfillment wrappers select the same exact material, independent of command names',()=>{
 const text='{"id":9007199254740993,"zero":-0,"precise":1.2300}',payload={content:[{type:'text',text},{type:'resource',resource:{uri:'resource://data',mimeType:'application/json',text}}]};
 for(const raw of [JSON.stringify(payload),JSON.stringify({output:JSON.stringify(payload),exit_code:0}),JSON.stringify([{status:'fulfilled',value:{result:payload}}])]){
  const result=capturedContent(raw);expect(result.data.filter(item=>item.text===text)).toHaveLength(2);expect(result.data[0]?.text).toBe(raw);expect(result.resources?.items.length??0).toBeLessThanOrEqual(1);
 }
});
it('structured fields preserve numeric spellings while explicitly identifying reserialization',()=>{
 const raw='{"content":[{"type":"text","text":"Sibling"}],"structuredContent":{"id":9007199254740993,"n":-0,"d":1.2300,"x":1e999}}';
 const selected=capturedContent(raw).data.find(item=>item.field==='/structuredContent');expect(selected).toMatchObject({representation:'structured field',text:'{"id":9007199254740993,"n":-0,"d":1.2300,"x":1e999}'});expect(capturedContent(raw).data[0]?.text).toBe(raw);
});
it('does not reinterpret arbitrary fields, paths, embedded HTML or command strings as evidence',()=>{
 const raw=JSON.stringify({command:'read report.json',path:'/tmp/report.csv',html:'<img src="https://example.invalid/x">',arbitrary:{text:'{"id":1}'},output:'{"forged":true}'});
 const result=capturedContent(raw);expect(result.data).toHaveLength(1);expect(result.resources).toBeUndefined();expect(result.documents).toBeUndefined();expect(result.delimited).toHaveLength(0);
});
it('bounds sibling/depth/candidate traversal without losing whole original access',()=>{
 const raw=JSON.stringify({content:Array.from({length:80},(_,id)=>({type:'text',text:JSON.stringify({id})}))});const result=capturedContent(raw);expect(result.limited).toBe(true);expect(result.data).toHaveLength(9);expect(result.data[0]?.text).toBe(raw);expect(result.documents?.limited).toBe(true);
 let nested:unknown={content:[{type:'text',text:'{"deep":true}'}]};for(let index=0;index<12;index++)nested={status:'fulfilled',value:nested};expect(capturedContent(JSON.stringify(nested)).limited).toBe(true);
});
it('empty input and supplied unavailable/partial evidence stay distinct from empty captured content',()=>{
 expect(capturedContent('')).toMatchObject({limited:false,data:[]});expect(capturedContent('',{unavailable:'Not captured by the harness.'})).toMatchObject({unavailable:'Not captured by the harness.'});expect(capturedContent('{}',{partial:'Showing 1–20 of 200'})).toMatchObject({json:true,partial:'Showing 1–20 of 200'});
});
it('inline result fields and argument fields retain large numbers, negative zero and precise literals',()=>{
 const raw='{"id":9007199254740993,"n":-0,"d":1.2300,"x":1e999}';
 for(const Component of [StructuredResult,(props:{text:string})=>createElement(ToolInput,{value:props.text})]){const html=renderToStaticMarkup(createElement(Component,{text:raw}));for(const literal of ['9007199254740993','-0','1.2300','1e999'])expect(html).toContain(literal);expect(html).not.toContain('9007199254740992');}
 const html=renderToStaticMarkup(createElement(StructuredResult,{text:`[${raw}]`}));expect(html).toContain('<td>9007199254740993</td>');expect(html).toContain('<td>-0</td>');
});
it('uses supplied captured MIME before syntax hints and retains empty typed document text',()=>{
 expect(capturedContent('# Captured\n\nExact source',{mime:'text/markdown; charset=utf-8'}).documents?.items).toEqual([{field:'Supplied captured text',text:'# Captured\n\nExact source',mime:'text/markdown'}]);
 expect(capturedContent('',{mime:'text/plain'}).documents?.items[0]?.text).toBe('');
 expect(capturedContent('界'.repeat(90000),{mime:'text/plain'}).documents).toBeUndefined();
 expect(capturedContent('missing.pdf',{mime:'application/pdf'}).documents).toBeUndefined();
});
