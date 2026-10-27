import {it,expect} from 'vitest';
import {capturedResources,resourceHref} from '../src/lib/captured-resources.ts';
it('preserves ordered MCP links, captured text, mixed siblings and exact field provenance',()=>{
 const value={content:[{type:'text',text:'not JSON'},{type:'resource_link',uri:'https://example.org/a',name:'Reference',mimeType:'application/pdf'},{type:'image',data:'omitted'},{type:'resource',resource:{uri:'resource://notes',mimeType:'text/markdown',text:'# Captured\n\nExact **text**'}}]};
 expect(capturedResources(JSON.stringify(value))?.items).toEqual([{field:'/content/1',uri:'https://example.org/a',title:'Reference',mime:'application/pdf'},{field:'/content/3/resource',uri:'resource://notes',title:'resource://notes',mime:'text/markdown',text:'# Captured\n\nExact **text**'}]);
 expect(value.content).toHaveLength(4);
});
it('recognizes explicit result URL metadata without scraping arbitrary prose or unknown objects',()=>{
 expect(capturedResources(JSON.stringify({results:[{url:'https://example.org',title:'Title',snippet:'Captured snippet'}]}))?.items[0]).toMatchObject({field:'/results/0',uri:'https://example.org',title:'Title',description:'Captured snippet'});
 for(const text of ['https://example.org','<a href="https://example.org">x</a>','{"uri":"https://example.org"}','{"unknown":{"type":"resource_link","uri":"https://example.org"}}','{"content":'])expect(capturedResources(text)).toBeUndefined();
});
it('opens only explicit clean absolute HTTP(S) destinations',()=>{
 expect(resourceHref('https://example.org/a?q=1#part')).toBe('https://example.org/a?q=1#part');expect(resourceHref('HTTP://EXAMPLE.ORG')).toBe('http://example.org/');
 for(const uri of ['javascript:alert(1)','data:text/html,x','file:///C:/notes','resource://notes','//example.org/a','/local','https://user:secret@example.org','https://example.org\n.evil','https:\\example.org','https://exa mple.org',' https://example.org'])expect(resourceHref(uri)).toBeUndefined();
});
it('finds sealed nested native/MCP JSON while retaining references as references',()=>{
 const inner={content:[{type:'resource_link',uri:'file:///private/old.png',title:'Old screenshot'}]};
 const raw=JSON.stringify([{status:'fulfilled',value:{output:JSON.stringify(inner),exit_code:0}}]);
 const item=capturedResources(raw)?.items[0]!;expect(item.uri).toBe('file:///private/old.png');expect(item.text).toBeUndefined();expect(item.field).toBe('/0/value/output (JSON)/content/0');
});
it('bounds bytes, references and traversal; malformed entries do not manufacture resources',()=>{
 expect(capturedResources('界'.repeat(90000))).toBeUndefined();
 const refs=Array.from({length:80},(_,index)=>({type:'resource_link',uri:`https://example.org/${index}`}));const result=capturedResources(JSON.stringify(refs))!;expect(result.items).toHaveLength(64);expect(result.limited).toBe(true);
 expect(capturedResources(JSON.stringify([{type:'resource_link'},{type:'resource',resource:{text:'orphan body'}},{type:'resource_link',uri:5}]))).toBeUndefined();
 let nested:unknown={type:'resource_link',uri:'https://example.org'};for(let n=0;n<12;n++)nested={status:'fulfilled',value:nested};expect(capturedResources(JSON.stringify(nested))).toBeUndefined();
});

it('keeps empty captured text distinct from absent text and retains repeated URI identities',()=>{
 const raw=JSON.stringify({content:[null,{type:'resource',resource:{uri:'resource://same',title:'First',text:''}},{type:'resource',resource:{uri:'resource://same',title:'Second',text:'literal second body'}},{type:'resource_link',uri:'resource://same',title:'Reference only'}]});
 const items=capturedResources(raw)!.items;expect(items.map(i=>i.field)).toEqual(['/content/1/resource','/content/2/resource','/content/3']);expect(items.map(i=>i.text)).toEqual(['','literal second body',undefined]);
});
it('rejects incomplete JSON as a whole instead of inventing partial resource bodies',()=>{
 const raw=JSON.stringify({content:[{type:'resource',resource:{uri:'resource://complete',text:'literal body'}}]});
 for(const incomplete of [raw.slice(0,-1),raw.slice(0,-8),raw+' trailing bytes'])expect(capturedResources(incomplete)).toBeUndefined();
});
it('enforces the UTF-8 byte limit at its boundary without changing literal text',()=>{
 const prefix=JSON.stringify({type:'resource',resource:{uri:'resource://unicode',text:'界'}}),room=262144-new TextEncoder().encode(prefix).length;
 const raw=prefix.slice(0,-3)+'x'.repeat(room)+prefix.slice(-3);expect(new TextEncoder().encode(raw).length).toBe(262144);expect(capturedResources(raw)!.items[0]!.text).toBe('界'+'x'.repeat(room));expect(capturedResources(raw+' ')).toBeUndefined();
});
it('marks a traversal cutoff while preserving earlier whole references and source order',()=>{
 const first={type:'resource_link',uri:'resource://first'};const value={content:[first,...Array.from({length:63},()=>Array.from({length:64},()=>null))]};const selection=capturedResources(JSON.stringify(value))!;expect(selection.items).toEqual([{field:'/content/0',uri:'resource://first',title:'resource://first'}]);expect(selection.limited).toBe(true);
});
import {capturedDocuments} from '../src/lib/captured-resources.ts';
it('selects sealed document bodies in order without guessing a current file or decoding binary',()=>{
 const raw=JSON.stringify({content:[{type:'text',text:'# Guide\r\n\r\nLiteral **text**'},{type:'resource',resource:{uri:'resource://notes',mimeType:'text/markdown',text:''}},{type:'resource',resource:{uri:'resource://pdf',mimeType:'application/pdf',blob:'YWJj'}},{type:'image',text:'not a document'}],unknown:{mimeType:'text/markdown',text:'not selected'}});
 expect(capturedDocuments(raw)).toEqual({items:[{field:'/content/0/text',text:'# Guide\r\n\r\nLiteral **text**'},{field:'/content/1/resource/text',mime:'text/markdown',text:''}],limited:false});
 for(const raw of ['# arbitrary prose','{"text":"untyped"}','{"mimeType":"application/pdf","text":"not decoded"}'])expect(capturedDocuments(raw)).toBeUndefined();
});
it('preserves document wrapper provenance, duplicate fields, raw limits and source boundaries',()=>{
 const document={type:'text',text:'literal'};const raw=JSON.stringify([{status:'fulfilled',value:{output:JSON.stringify({content:[document,document]}),exit_code:0}}]);
 expect(capturedDocuments(raw)?.items.map(item=>item.field)).toEqual(['/0/value/output (JSON)/content/0/text','/0/value/output (JSON)/content/1/text']);
 const many=capturedDocuments(JSON.stringify({content:Array.from({length:10},()=>document)}))!;expect(many.items).toHaveLength(8);expect(many.limited).toBe(true);
 expect(capturedDocuments(raw.slice(0,-1))).toBeUndefined();expect(capturedDocuments(JSON.stringify({type:'text',text:'界'.repeat(90000)}))).toBeUndefined();
});
it('distinguishes captured binary resources and reported sizes from absent bodies',()=>{
 expect(capturedResources(JSON.stringify({type:'resource',resource:{uri:'resource://pdf',mimeType:'application/pdf',blob:'YWJj',size:3}}))?.items[0]).toEqual({field:'/resource',uri:'resource://pdf',title:'resource://pdf',mime:'application/pdf',binary:true,size:3});
 expect(capturedResources(JSON.stringify({type:'resource_link',uri:'resource://pdf',size:-1}))?.items[0]?.size).toBeUndefined();
});
it('follows native result wrappers without losing resource and document field identity',()=>{
 const raw=JSON.stringify({status:'fulfilled',value:{result:{content:[{type:'resource',resource:{uri:'resource://guide',mimeType:'text/markdown',text:'# Exact'}}]}}});
 expect(capturedResources(raw)?.items[0]?.field).toBe('/value/result/content/0/resource');expect(capturedDocuments(raw)?.items[0]).toMatchObject({field:'/value/result/content/0/resource/text',text:'# Exact'});
});
